import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities';
import type { ProcessOrderResult } from './types';


const orderActivities = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '1 second',
    maximumInterval: '10 seconds',
    maximumAttempts: 3,
  },
});

/** Coordinates the reliable, multi-step order fulfillment process. */
export async function processOrder(
  rawText: string,
): Promise<ProcessOrderResult> {
  const interpretation = await orderActivities.interpretOrder(rawText);

  if (
    interpretation.decision !== 'PROCEED' ||
    !interpretation.policyResult?.allowed ||
    !interpretation.order
  ) {
    return {
      status: 'REJECTED',
      reason: interpretation.reason ?? 'Order rejected',
    };
  }

  const order = interpretation.order;
  const total = await orderActivities.validateOrder(order);
  await orderActivities.reserveInventory(order);

  let paymentId: string;
  try {
    paymentId = await orderActivities.chargePayment(order, total);
  } catch (error) {
    await orderActivities.releaseInventory(order);
    throw error;
  }

  const trackingNumber = await orderActivities.createShipment(order);
  await orderActivities.sendConfirmation(order, paymentId, trackingNumber);

  return {
    orderId: order.orderId,
    paymentId,
    trackingNumber,
    status: 'CONFIRMED',
    total,
  };
}
