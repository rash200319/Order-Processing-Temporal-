import type { Order } from '../types';
import { ChatGroq } from '@langchain/groq';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { policyCheckTool } from './tools';
import type { AgentState, Intent } from './state';
import { z } from 'zod';

export const AgentStateAnnotation = Annotation.Root({
  rawText: Annotation<string>(),
  intent: Annotation<Intent | undefined>(),
  order: Annotation<Order | undefined>(),
  policyResult: Annotation<AgentState['policyResult']>(),
  decision: Annotation<AgentState['decision']>(),
  reason: Annotation<string | undefined>(),
});

type GraphState = typeof AgentStateAnnotation.State;

function classifyNode(state: GraphState) {
  const text = state.rawText.toLowerCase();
  let intent: Intent = 'other';

  if (text.includes('cancel')) {
    intent = 'cancel';
  } else if (text.includes('order') || text.includes('need') || text.includes('want')) {
    intent = 'new_order';
  }

  return { intent };
}

function extractOrderNode(state: GraphState) {
  const customerId = state.rawText.match(/customer[- ]([\w-]+)/i)?.[1];
  const items = [...state.rawText.matchAll(/(\d+)\s+(keyboards?|mice?|mouse)/gi)].map(
    ([, quantity, rawSku]) => {
      const normalizedSku = rawSku.toLowerCase();
      return {
        sku: normalizedSku.startsWith('mice') ? 'mouse' : normalizedSku.replace(/s$/, ''),
        quantity: Number(quantity),
        unitPrice: normalizedSku.startsWith('keyboard') ? 50 : 20,
      };
    },
  );

  if (!customerId || items.length === 0) return { order: undefined };

  return {
    order: {
      orderId: 'mock-order-1',
      customerId: `customer-${customerId}`,
      items,
    },
  };
}

async function policyCheckNode(state: GraphState) {
  if (!state.order) return {};

  const policyResult = await policyCheckTool.invoke({
    items: state.order.items.map(({ sku, quantity }) => ({ sku, quantity })),
  });
  return { policyResult };
}

function decideNode(state: GraphState) {
  if (!state.order) {
    return { decision: 'REJECT' as const, reason: 'Could not extract an order' };
  }
  if (!state.policyResult) {
    return { decision: 'REJECT' as const, reason: 'Policy check was not run' };
  }
  if (!state.policyResult.allowed) {
    return {
      decision: 'REJECT' as const,
      reason: state.policyResult.violations.join('; '),
    };
  }
  return { decision: 'PROCEED' as const, reason: 'Order passed policy check' };
}

function routeIntent(state: GraphState) {
  return state.intent === 'new_order' ? 'extract' : 'decide';
}

function routeOrder(state: GraphState) {
  return state.order ? 'policy_check' : 'decide';
}

export const orderGraph = new StateGraph(AgentStateAnnotation)
  .addNode('classify', classifyNode)
  .addNode('extract', extractOrderNode)
  .addNode('policy_check', policyCheckNode)
  .addNode('decide', decideNode)
  .addEdge(START, 'classify')
  .addConditionalEdges('classify', routeIntent, {
    extract: 'extract',
    decide: 'decide',
  })
  .addConditionalEdges('extract', routeOrder, {
    policy_check: 'policy_check',
    decide: 'decide',
  })
  .addEdge('policy_check', 'decide')
  .addEdge('decide', END)
  .compile();

export async function runMockAgent(rawText: string): Promise<AgentState> {
  return (await orderGraph.invoke({ rawText })) as AgentState;
}

export const agentNodes = {
  classify: classifyNode,
  extractOrder: extractOrderNode,
  policyCheck: policyCheckNode,
  decide: decideNode,
};

const extractionSchema = z.object({
  customerId: z.string(),
  items: z.array(
    z.object({
      sku: z.enum(['keyboard', 'mouse']),
      quantity: z.number().int().positive(),
    }),
  ),
});

const decisionSchema = z.object({
  decision: z.enum(['PROCEED', 'REJECT']),
  reason: z.string(),
});

function catalogPrice(sku: 'keyboard' | 'mouse'): number {
  return sku === 'keyboard' ? 50 : 20;
}

export function createLiveAgentGraph() {
  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
    temperature: 0,
  });

  const extractLive = async (state: GraphState) => {
    const extracted = await llm.withStructuredOutput(extractionSchema).invoke([
      ['system', 'Extract the customer ID and catalog items. Do not decide policy.'],
      ['human', state.rawText],
    ]);

    return {
      order: {
        orderId: 'llm-order-1',
        customerId: extracted.customerId,
        items: extracted.items.map((item) => ({
          ...item,
          unitPrice: catalogPrice(item.sku),
        })),
      },
    };
  };

  const policyLive = async (state: GraphState) => {
    if (!state.order) return {};

    const response = await llm.bindTools([policyCheckTool]).invoke([
      ['system', 'You must call policy_check. Never calculate policy yourself.'],
      [
        'human',
        JSON.stringify({
          items: state.order.items.map(({ sku, quantity }) => ({ sku, quantity })),
        }),
      ],
    ]);
    const toolCall = response.tool_calls?.find((call) => call.name === 'policy_check');

    return toolCall
      ? {
          policyResult: await policyCheckTool.invoke(
            toolCall.args as { items: { sku: string; quantity: number }[] },
          ),
        }
      : {};
  };

  const decideLive = async (state: GraphState) => {
    if (!state.order || !state.policyResult) return decideNode(state);

    const decision = await llm.withStructuredOutput(decisionSchema).invoke([
      ['system', 'Decide PROCEED or REJECT using only the policy result.'],
      ['human', JSON.stringify({ order: state.order, policyResult: state.policyResult })],
    ]);
    return decision;
  };

  return new StateGraph(AgentStateAnnotation)
    .addNode('extract', extractLive)
    .addNode('policy_check', policyLive)
    .addNode('decide', decideLive)
    .addEdge(START, 'extract')
    .addEdge('extract', 'policy_check')
    .addEdge('policy_check', 'decide')
    .addEdge('decide', END)
    .compile();
}

export async function runAgent(rawText: string): Promise<AgentState> {
  if (!process.env.GROQ_API_KEY || process.env.AGENT_MODE === 'mock') {
    return runMockAgent(rawText);
  }
  return (await createLiveAgentGraph().invoke({ rawText })) as AgentState;
}
