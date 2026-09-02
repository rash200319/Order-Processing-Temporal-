import { MockActivityEnvironment } from '@temporalio/testing';
import { describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { interpretOrder } from '../activities';
import type { AgentState } from '../agent/state';

describe('interpretOrder activity', () => {
  it('extracts and checks a valid natural-language order', async () => {
    const env = new MockActivityEnvironment();
    const result = await env.run<[string], AgentState, typeof interpretOrder>(
      interpretOrder,
      "Hi, I'm customer-123. Need 1 keyboard and 2 mice, ship whenever.",
    );

    assert.equal(result.decision, 'PROCEED');
    assert.equal(result.order?.customerId, 'customer-123');
    assert.equal(result.policyResult?.allowed, true);
  });
});
