import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { runMockAgent } from '../agent/graph';

describe('offline order agent graph', () => {
  it('extracts, checks policy, and proceeds for a valid order', async () => {
    const result = await runMockAgent(
      "Hi, I'm customer-123. Need 1 keyboard and 2 mice, ship whenever.",
    );

    assert.equal(result.decision, 'PROCEED');
    assert.equal(result.policyResult?.allowed, true);
    assert.equal(result.order?.customerId, 'customer-123');
  });

  it('rejects an oversized order based on the policy result', async () => {
    const result = await runMockAgent("I'm customer-123. Need 1000 keyboards.");

    assert.equal(result.decision, 'REJECT');
    assert.match(result.reason ?? '', /exceeds maximum of 10/);
  });

  it('rejects when no order can be extracted', async () => {
    const result = await runMockAgent('Please tell me about delivery times.');

    assert.equal(result.decision, 'REJECT');
    assert.equal(result.policyResult, undefined);
  });
});
