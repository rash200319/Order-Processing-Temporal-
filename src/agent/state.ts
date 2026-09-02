import type { Order } from '../types';
import type { PolicyResult } from './policy';

export type Intent = 'new_order' | 'cancel' | 'other';
export type Decision = 'PROCEED' | 'REJECT';

export type AgentState = {
  rawText: string;
  intent?: Intent;
  order?: Order;
  policyResult?: PolicyResult;
  decision?: Decision;
  reason?: string;
};
