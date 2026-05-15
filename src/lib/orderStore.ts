// Global in-memory store for webhook orders
// Survives HMR restarts in dev via globalThis

export type LFOrder = {
  id: string;
  order_number: number;
  status: string;
  financial_status: string;
  total_price: string;
  currency: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  city: string;
  address: string;
  product: string;
  quantity: number;
  funnel: string;
  created_at: string;
  received_at: string;
  ownerId: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __lfOrders: LFOrder[] | undefined;
  // eslint-disable-next-line no-var
  var __lfEvents: number | undefined;
}

export function getOrders(ownerId: string): LFOrder[] {
  if (!globalThis.__lfOrders) globalThis.__lfOrders = [];
  return globalThis.__lfOrders.filter(o => o.ownerId === ownerId);
}

export function addOrder(order: LFOrder, ownerId: string) {
  if (!globalThis.__lfOrders) globalThis.__lfOrders = [];
  order.ownerId = ownerId;
  // Deduplicate by id
  const existing = globalThis.__lfOrders.findIndex(o => o.id === order.id);
  if (existing >= 0) {
    globalThis.__lfOrders[existing] = order;
  } else {
    globalThis.__lfOrders.unshift(order);
  }
  globalThis.__lfEvents = (globalThis.__lfEvents ?? 0) + 1;
}

export function getEventCount(): number {
  return globalThis.__lfEvents ?? 0;
}
