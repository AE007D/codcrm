import { test } from "node:test";
import assert from "node:assert/strict";
import { assignManualOrders } from "../src/lib/orderAssignment.ts";

const orders = [{ id: "manual", orderNumber: "MAN-123" }, { id: "page", orderNumber: "PAGE-123" }];
const ammar = { agentId: "ammar", agentName: "Ammar", assignedAt: "2026-11-19" };
test("moves selected MAN orders to Ammar, preserving other assignments", () => {
  const current = { manual: { agentId: "wijdane" }, page: { agentId: "wijdane" } };
  assert.deepEqual(assignManualOrders(orders, ["manual"], current, ammar), { manual: ammar, page: current.page });
  assert.equal(current.manual.agentId, "wijdane");
});
test("rejects nonmanual, missing, and cross-workspace orders without partial assignment", () => {
  for (const ids of [[], ["page"], ["unknown"], ["manual", "unknown"]]) {
    assert.equal(assignManualOrders(orders, ids, {}, ammar), null);
  }
});
