import { createHash } from "node:crypto";
import type { OrderAssignments } from "./orderAssignment";

export function commissionId(workspaceId: string, orderId: string) {
  const hash = createHash("sha256").update(JSON.stringify([workspaceId, orderId])).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

type Order = { id: string; orderNumber: string; product: string; status: string; receivedAt: string };
type Request = { id: string; message: string; amount: number; status: string; agent_id: string; agent_name: string; created_at: string };

// Repair only commissions with an explicit order link; never guess legacy ownership.
export function planCommissionReconciliation(
  workspaceId: string, orders: Order[], requests: Request[], assignments: OrderAssignments,
  links: Record<string, string>, defaults: Record<string, { agentId: string; agentName: string }>,
) {
  const matched = orders.filter(order => order.status === "livré").map(order => ({
    order,
    requests: requests.filter(request => request.id === commissionId(workspaceId, order.id)
      || request.id === links[order.id]),
    owner: assignments[order.id] ?? defaults[order.product.trim()],
  }));
  const uses = new Map<string, number>();
  for (const row of matched) for (const request of row.requests) uses.set(request.id, (uses.get(request.id) ?? 0) + 1);
  const updates: { requestId: string; orderNumber: string; previousAgentId: string; previousAgentName: string; agentId: string; agentName: string; amount: number }[] = [];
  const unresolved: string[] = [];
  for (const row of matched) {
    const request = row.requests[0];
    if (row.requests.length !== 1 || !row.owner?.agentId || uses.get(request.id) !== 1
      || !request.message.startsWith(`Commission · ${row.order.product.trim()}`)) {
      unresolved.push(row.order.orderNumber); continue;
    }
    if (request.agent_id === row.owner.agentId) continue;
    if (request.status !== "pending") { unresolved.push(row.order.orderNumber); continue; }
    updates.push({ requestId: request.id, orderNumber: row.order.orderNumber,
      previousAgentId: request.agent_id, previousAgentName: request.agent_name,
      agentId: row.owner.agentId, agentName: row.owner.agentName, amount: Number(request.amount) });
  }
  return { updates, unresolved };
}

export function planCommissionReassignment(
  workspaceId: string, orders: Order[], requests: Request[], selectedIds: string[],
  assignments: OrderAssignments, existingLinks: Record<string, string>,
) {
  const links = { ...existingLinks };
  const delivered = orders.filter(order => order.status === "livré");
  const selected = delivered.filter(order => selectedIds.includes(order.id));
  const byId = new Map(requests.map(request => [request.id, request]));
  for (const order of delivered) {
    const id = commissionId(workspaceId, order.id);
    if (byId.has(id)) links[order.id] = id;
  }
  for (const product of new Set(selected.map(order => order.product.trim()))) {
    const used = new Set(Object.values(links));
    const group = delivered.filter(order => order.product.trim() === product && !links[order.id]);
    const legacy = requests.filter(request => request.message === `Commission · ${product}` && !used.has(request.id));
    // Old records lack order IDs. Allocate only a complete, interchangeable
    // pool of unpaid commissions: same amount and original owner, one per order.
    // Mixed values, paid records, or count mismatches require explicit review.
    if (!group.length || group.length !== legacy.length || legacy.some(request => request.status !== "pending")
      || new Set(legacy.map(request => Number(request.amount))).size !== 1
      || new Set(legacy.map(request => request.agent_id)).size !== 1) continue;
    group.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id));
    legacy.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    group.forEach((order, index) => { links[order.id] = legacy[index].id; });
  }
  const updates: { requestId: string; agentId: string; agentName: string }[] = [];
  let unresolved = 0;
  for (const order of selected) {
    const request = byId.get(links[order.id]);
    const assignment = assignments[order.id];
    if (!request || !assignment) { unresolved++; continue; }
    if (request.agent_id === assignment.agentId) continue;
    if (request.status !== "pending") { unresolved++; continue; }
    updates.push({ requestId: request.id, agentId: assignment.agentId, agentName: assignment.agentName });
  }
  return { links, updates, unresolved };
}
