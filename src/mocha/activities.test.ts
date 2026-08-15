import { MockActivityEnvironment } from '@temporalio/testing';
import { describe, it } from 'mocha';
import assert from 'assert';
import { validateOrder } from '../activities';

describe('validateOrder activity', () => {
  it('calculates the order total', async () => {
    const env = new MockActivityEnvironment();
    const result = await env.run(validateOrder, {
      orderId: 'order-1',
      customerId: 'customer-1',
      items: [{ sku: 'book', quantity: 2, unitPrice: 15 }],
    });
    assert.equal(result, 30);
  });

  it('rejects an order with no items', async () => {
    const env = new MockActivityEnvironment();
    await assert.rejects(
      env.run(validateOrder, {
        orderId: 'order-1',
        customerId: 'customer-1',
        items: [],
      }),
      /at least one item/,
    );
  });
});
