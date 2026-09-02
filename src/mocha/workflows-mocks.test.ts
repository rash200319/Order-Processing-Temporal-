import { after, before, describe, it } from 'mocha';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import assert from 'assert';
import { processOrder } from '../workflows';
import type { Order } from '../types';
import { createLocalTestEnvironment } from './test-env';

describe('processOrder workflow with mocked activities', function () {
  this.timeout(30_000);

  let testEnv: TestWorkflowEnvironment;

  before(async () => {
    testEnv = await createLocalTestEnvironment();
  });

  after(async () => {
    await testEnv?.teardown();
  });

  it('releases inventory when payment fails', async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = 'order-mock-test';
    const calls: string[] = [];
    const order: Order = {
      orderId: 'order-2',
      customerId: 'customer-2',
      items: [{ sku: 'book', quantity: 1, unitPrice: 10 }],
    };

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../workflows'),
      activities: {
        validateOrder: async () => 10,
        reserveInventory: async () => {
          calls.push('reserve');
        },
        chargePayment: async () => {
          calls.push('charge');
          throw new Error('payment declined');
        },
        releaseInventory: async () => {
          calls.push('release');
        },
      },
    });

    await assert.rejects(
      worker.runUntil(
        client.workflow.execute(processOrder, {
          args: [order],
          workflowId: 'order-test-2',
          taskQueue,
        }),
      ),
    );
    assert.deepEqual(calls, ['reserve', 'charge', 'charge', 'charge', 'release']);
  });
});
