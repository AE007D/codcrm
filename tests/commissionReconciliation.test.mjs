import { test } from "node:test";
import assert from "node:assert/strict";
import { commissionId, planCommissionReconciliation } from "../src/lib/orderCommissions.ts";

const orders = Array.from({ length: 20 }, (_, i) => ({ id: `order-${i}`, orderNumber: i < 7 ? `MAN-${i}` : `PAGE-${i}`,
  product: "Heater", status: "livré", receivedAt: "2026-11-21" }));
const assignments = Object.fromEntries(orders.slice(0, 7).map(order => [order.id, { agentId: "ammar", agentName: "Ammar" }]));
const defaults = { Heater: { agentId: "wijdane", agentName: "Wijdane" } };
const requests = orders.map((order, i) => ({ id: commissionId("workspace", order.id),
  message: `Commission · Heater · ${order.orderNumber}`, amount: 5, status: "pending",
  agent_id: i < 16 ? "ammar" : "wijdane", agent_name: i < 16 ? "Ammar" : "Wijdane", created_at: "2026-11-21" }));
const plan = (rows = requests, links = {}, orderRows = orders) => planCommissionReconciliation("workspace", orderRows, rows, assignments, links, defaults);

test("repairs 16/4 to 7/13 using explicit assignments before product defaults, preserving 100 MAD", () => {
  const result = plan();
  assert.equal(result.updates.length, 9);
  assert.deepEqual(result.unresolved, []);
  const corrected = requests.map(row => ({ ...row, agent_id: result.updates.find(update => update.requestId === row.id)?.agentId ?? row.agent_id }));
  assert.equal(corrected.filter(row => row.agent_id === "ammar").length, 7);
  assert.equal(corrected.filter(row => row.agent_id === "wijdane").length, 13);
  assert.equal(corrected.reduce((sum, row) => sum + row.amount, 0), 100);
  assert.equal(plan(corrected).updates.length, 0);
});

test("accepts saved legacy links without guessing from identical product messages", () => {
  const rows = requests.map(row => ({ ...row, id: `legacy-${row.id}`, message: "Commission · Heater" }));
  assert.equal(plan(rows).updates.length, 0);
  assert.equal(plan(rows).unresolved.length, 20);
  const links = Object.fromEntries(orders.map((order, i) => [order.id, rows[i].id]));
  assert.equal(plan(rows, links).updates.length, 9);
});

test("skips paid commissions and non-delivered orders", () => {
  const rows = requests.map((row, i) => i === 7 ? { ...row, status: "paid" } : row);
  const result = plan(rows, {}, orders.map((order, i) => i === 8 ? { ...order, status: "expédié" } : order));
  assert.equal(result.updates.length, 7);
  assert.deepEqual(result.unresolved, ["PAGE-7"]);
});

test("rejects duplicate links, conflicting links and unrelated payment requests", () => {
  const duplicate = plan(requests, { "order-7": requests[8].id });
  assert(duplicate.unresolved.includes("PAGE-7"));
  assert(duplicate.unresolved.includes("PAGE-8"));
  const unrelated = plan(requests.map((row, i) => i === 7 ? { ...row, message: "Manual withdrawal" } : row));
  assert(unrelated.unresolved.includes("PAGE-7"));
  assert.equal(unrelated.updates.length, 8);
});
