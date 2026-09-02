import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { checkOrderPolicy } from './policy';

const policyCheckSchema = z.object({
  items: z.array(
    z.object({
      sku: z.string(),
      quantity: z.number().int(),
    }),
  ),
});

/**
 * The agent's only tool. Policy decisions are calculated by ordinary
 * TypeScript code in checkOrderPolicy, never by the model.
 */
export const policyCheckTool = tool(
  ({ items }) => checkOrderPolicy(items),
  {
    name: 'policy_check',
    description:
      'Check an order against the deterministic catalog and quantity policy. Use this before deciding whether the order can proceed.',
    schema: policyCheckSchema,
  },
);
