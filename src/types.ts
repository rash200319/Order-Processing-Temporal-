export type OrderItem = {
  sku: string;
  quantity: number;
  unitPrice: number;
};

export type Order = {
  orderId: string;
  customerId: string;
  items: OrderItem[];
};

export type OrderResult = {
  orderId: string;
  paymentId: string;
  trackingNumber: string;
  status: 'CONFIRMED';
  total: number;
};
