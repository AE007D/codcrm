export type OrderAssignment = { agentId: string; agentName: string; assignedAt: string };
export type OrderAssignments = Record<string, OrderAssignment>;

export function assignManualOrders(
  orders: { id: string; orderNumber: string }[], orderIds: string[],
  current: OrderAssignments, assignment: OrderAssignment,
) {
  const ids = new Set(orderIds);
  const matched = orders.filter(order => ids.has(order.id) && /^MAN-/i.test(order.orderNumber));
  if (matched.length !== ids.size || ids.size === 0) return null;
  return { ...current, ...Object.fromEntries(matched.map(order => [order.id, assignment])) };
}
