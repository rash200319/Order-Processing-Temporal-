import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { policyCheckTool } from '../agent/tools';

describe('policy_check tool', () => {
  it('uses deterministic policy code to reject keyboard x1000', async () => {
    const result = await policyCheckTool.invoke({
      items: [{ sku: 'keyboard', quantity: 1000 }],
    });

    assert.equal(result.allowed, false);
    assert.deepEqual(result.violations, [
      'Quantity for keyboard exceeds maximum of 10',
    ]);
  });
});
