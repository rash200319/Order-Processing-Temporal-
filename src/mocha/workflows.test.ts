import { TestWorkflowEnvironment } from '@temporalio/testing';
import { after, before, describe, it } from 'mocha';
import { Worker } from '@temporalio/worker';
import assert from 'assert';
import { processOrder } from '../workflows';
import * as activities from '../activities';
import type { Order } from '../types';

describe('processOrder workflow', function () {
  this.timeout(30_000);

  let testEnv: TestWorkflowEnvironment;

  before(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  after(async () => {
    await testEnv?.teardown();
  });

  it('fulfills an order from validation through confirmation', async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = 'order-test';
    const order: Order = {
      orderId: 'order-1',
      customerId: 'customer-1',
      items: [{ sku: 'book', quantity: 2, unitPrice: 15 }],
    };

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../workflows'),
      activities,
    });

    const result = await worker.runUntil(
      client.workflow.execute(processOrder, {
        args: [order],
        workflowId: 'order-test-1',
        taskQueue,
      }),
    );

    assert.deepEqual(result, {
      orderId: 'order-1',
      paymentId: 'payment-order-1',
      trackingNumber: 'TRACK-order-1',
      status: 'CONFIRMED',
      total: 30,
    });
  });
});
