import type { Order } from './types';
import { runAgent } from './agent/graph';
import type { AgentState } from './agent/state';

export async function greet(name: string): Promise<string> {
  return `Hello, ${name}!`;
}

export async function interpretOrder(rawText: string): Promise<AgentState> {
  return runAgent(rawText);
}


// The original greet activity is kept as a simple Temporal learning example.
export async function validateOrder(order: Order): Promise<number> {
  if (!order.orderId || !order.customerId || order.items.length === 0) {
    throw new Error('An order must have an ID, customer, and at least one item');
  }

  for (const item of order.items) {
    if (!item.sku || item.quantity <= 0 || item.unitPrice < 0) {
      throw new Error(`Invalid item: ${item.sku}`);
    }
  }

  return order.items.reduce(
    (total, item) => total + item.quantity * item.unitPrice,
    0,
  );
}

export async function reserveInventory(order: Order): Promise<void> {
  console.log(`Reserved inventory for order ${order.orderId}`);
}

export async function releaseInventory(order: Order): Promise<void> {
  console.log(`Released inventory for order ${order.orderId}`);
}

export async function chargePayment(
  order: Order,
  total: number,
): Promise<string> {
  console.log(`Charged ${total.toFixed(2)} for order ${order.orderId}`);
  return `payment-${order.orderId}`;
}

export async function createShipment(order: Order): Promise<string> {
  console.log(`Created shipment for order ${order.orderId}`);
  return `TRACK-${order.orderId}`;
}

export async function sendConfirmation(
  order: Order,
  paymentId: string,
  trackingNumber: string,
): Promise<void> {
  console.log(
    `Sent confirmation for ${order.orderId}: ${paymentId}, ${trackingNumber}`,
  );
}
