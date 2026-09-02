import { after, before, describe, it } from 'mocha';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import assert from 'assert';
import { processOrder } from '../workflows';
import * as activities from '../activities';
import { createLocalTestEnvironment } from './test-env';

describe('processOrder workflow', function () {
  this.timeout(30_000);

  let testEnv: TestWorkflowEnvironment;

  before(async () => {
    testEnv = await createLocalTestEnvironment();
  });

  after(async () => {
    await testEnv?.teardown();
  });

  it('fulfills an order from validation through confirmation', async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = 'order-test';
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../workflows'),
      activities,
    });

    const result = await worker.runUntil(
      client.workflow.execute(processOrder, {
        args: [
          "Hi, I'm customer-123. Need 1 keyboard and 2 mice, ship whenever.",
        ],
        workflowId: 'order-test-1',
        taskQueue,
      }),
    );

    assert.deepEqual(result, {
      orderId: 'mock-order-1',
      paymentId: 'payment-mock-order-1',
      trackingNumber: 'TRACK-mock-order-1',
      status: 'CONFIRMED',
      total: 90,
    });
  });
});
