import { test } from "node:test";
import assert from "node:assert/strict";
import { commissionId, planCommissionReassignment } from "../src/lib/orderCommissions.ts";

const orders = Array.from({ length: 7 }, (_, i) => ({ id: `order-${i}`, orderNumber: i < 3 ? `MAN-${i}` : `PAGE-${i}`,
  product: "Heater", status: "livré", receivedAt: `2026-11-${10 + i}` }));
const requests = orders.map((_, i) => ({ id: `request-${i}`, message: "Commission · Heater", amount: 5,
  status: "pending", agent_id: "wijdane", agent_name: "Wijdane", created_at: `2026-11-${10 + i}` }));
const ids = orders.slice(0, 3).map(order => order.id);
const assignments = Object.fromEntries(ids.map(id => [id, { agentId: "ammar", agentName: "Ammar" }]));
const plan = (rows = requests, links = {}) => planCommissionReassignment("workspace", orders, rows, ids, assignments, links);

test("moves exactly three equal pending commissions; leaves four with Wijdane and preserves 35 MAD", () => {
  const result = plan();
  assert.equal(result.updates.length, 3);
  assert.equal(result.unresolved, 0);
  assert.equal(Object.keys(result.links).length, 7);
  const owners = requests.map(row => result.updates.find(update => update.requestId === row.id)?.agentId ?? row.agent_id);
  assert.equal(owners.filter(owner => owner === "ammar").length, 3);
  assert.equal(owners.filter(owner => owner === "wijdane").length, 4);
  assert.equal(requests.reduce((sum, row) => sum + row.amount, 0), 35);
});

test("retries reuse the saved links and do not transfer another three", () => {
  const first = plan();
  const moved = requests.map(row => first.updates.some(update => update.requestId === row.id) ? { ...row, agent_id: "ammar" } : row);
  assert.equal(plan(moved, first.links).updates.length, 0);
});

test("does not guess when legacy records are paid, mixed-value, or incomplete", () => {
  for (const rows of [requests.slice(1), requests.map((row, i) => i === 0 ? { ...row, status: "paid" } : row),
    requests.map((row, i) => i === 0 ? { ...row, amount: 10 } : row)]) {
    assert.equal(plan(rows).updates.length, 0);
    assert.equal(plan(rows).unresolved, 3);
  }
});

test("new commissions use stable per-workspace order IDs and can be reassigned directly", () => {
  const id = commissionId("workspace", "order-0");
  assert.equal(id, commissionId("workspace", "order-0"));
  assert.notEqual(id, commissionId("other-workspace", "order-0"));
  const result = planCommissionReassignment("workspace", orders, [{ ...requests[0], id, message: "Commission · Heater · MAN-0" }], ["order-0"], assignments, {});
  assert.equal(result.updates[0].requestId, id);
});
