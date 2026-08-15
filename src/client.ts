import { Client, Connection } from '@temporalio/client';
import { loadClientConnectConfig } from '@temporalio/envconfig';
import { nanoid } from 'nanoid';
import { processOrder } from './workflows';

async function run() {
  const connection = await Connection.connect(
    loadClientConnectConfig().connectionOptions,
  );
  const client = new Client({ connection });
  const orderId = `order-${nanoid(8)}`;

  const result = await client.workflow.execute(processOrder, {
    taskQueue: 'order-processing',
    workflowId: orderId,
    args: [
      {
        orderId,
        customerId: 'customer-123',
        items: [
          { sku: 'keyboard', quantity: 1, unitPrice: 79.99 },
          { sku: 'mouse', quantity: 2, unitPrice: 24.99 },
        ],
      },
    ],
  });

  console.log('Order completed:', result);
  await connection.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
