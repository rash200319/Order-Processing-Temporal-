export type OrderItem = {
  sku: string;
  quantity: number;
};

export type PolicyResult = {
  allowed: boolean;
  violations: string[];
  total: number;
};

type CatalogItem = {
  price: number;
  maxQuantity: number;
  banned: boolean;
};

const CATALOG: Record<string, CatalogItem> = {
  keyboard: {
    price: 50,
    maxQuantity: 10,
    banned: false,
  },
  mouse: {
    price: 20,
    maxQuantity: 20,
    banned: false,
  },
};

export function checkOrderPolicy(items: OrderItem[]): PolicyResult {
  const violations: string[] = [];
  let total = 0;

  for (const item of items) {
    const product = CATALOG[item.sku];

    // Unknown SKU
    if (!product) {
      violations.push(`Unknown SKU: ${item.sku}`);
      continue;
    }

    // Invalid quantity
    if (item.quantity <= 0) {
      violations.push(`Invalid quantity for ${item.sku}`);
      continue;
    }

    // Quantity too high
    if (item.quantity > product.maxQuantity) {
      violations.push(
        `Quantity for ${item.sku} exceeds maximum of ${product.maxQuantity}`
      );
    }

    // Banned item
    if (product.banned) {
      violations.push(`Banned item: ${item.sku}`);
    }

    // Calculate total only for known products
    total += product.price * item.quantity;
  }

  return {
    allowed: violations.length === 0,
    violations,
    total,
  };
}