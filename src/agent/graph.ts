import type { Order } from '../types';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { policyCheckTool } from './tools';
import type { AgentState, Intent } from './state';

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
        unitPrice: 0,
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
