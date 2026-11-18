import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStockCorrection } from "../src/lib/stockCorrection.ts";

test("100 purchased minus 28 shipped corrects 83 to 72", () => {
  assert.deepEqual(parseStockCorrection({ stock: 100 - 28, expectedStock: 83, note: " 100 purchased, 28 sent " }),
    { stock: 72, expectedStock: 83, note: "100 purchased, 28 sent" });
});

test("rejects invalid balances and missing reasons without coercion", () => {
  for (const stock of [-1, 1.5, NaN, Infinity, "72", null, 2147483648]) {
    assert.equal(parseStockCorrection({ stock, expectedStock: 83, note: "Correction" }), null);
  }
  assert.equal(parseStockCorrection({ stock: 72, expectedStock: "83", note: "Correction" }), null);
  assert.equal(parseStockCorrection({ stock: 72, expectedStock: 83, note: " " }), null);
  assert.ok(parseStockCorrection({ stock: 0, expectedStock: 1, note: "Sold out" }));
});
