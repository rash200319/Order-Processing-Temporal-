import { after, before, describe, it } from 'mocha';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import assert from 'assert';
import { processOrder } from '../workflows';
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
    const order = {
      orderId: 'order-2',
      customerId: 'customer-2',
      items: [{ sku: 'book', quantity: 1, unitPrice: 10 }],
    };

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../workflows'),
      activities: {
        interpretOrder: async () => ({
          decision: 'PROCEED' as const,
          order,
          policyResult: { allowed: true, violations: [], total: 10 },
          reason: 'Order passed policy check',
        }),
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
          args: ['Please fulfill this order.'],
          workflowId: 'order-test-2',
          taskQueue,
        }),
      ),
    );
    assert.deepEqual(calls, ['reserve', 'charge', 'charge', 'charge', 'release']);
  });

  it('rejects before starting fulfillment when policy fails', async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = 'order-rejected-test';
    const calls: string[] = [];
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../workflows'),
      activities: {
        interpretOrder: async () => ({
          decision: 'REJECT' as const,
          policyResult: {
            allowed: false,
            violations: ['Quantity for keyboard exceeds maximum of 10'],
            total: 50000,
          },
          reason: 'Quantity for keyboard exceeds maximum of 10',
        }),
        validateOrder: async () => {
          calls.push('validate');
          return 50000;
        },
        reserveInventory: async () => calls.push('reserve'),
        chargePayment: async () => {
          calls.push('charge');
          return 'payment-1';
        },
        createShipment: async () => {
          calls.push('ship');
          return 'tracking-1';
        },
        sendConfirmation: async () => calls.push('confirm'),
      },
    });

    const result = await worker.runUntil(
      client.workflow.execute(processOrder, {
        args: ["I'm customer-123. Need 1000 keyboards."],
        workflowId: 'order-rejected-test-1',
        taskQueue,
      }),
    );

    assert.deepEqual(result, {
      status: 'REJECTED',
      reason: 'Quantity for keyboard exceeds maximum of 10',
    });
    assert.deepEqual(calls, []);
  });
});
