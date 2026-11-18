export function parseStockCorrection(body: Record<string, unknown>) {
  const { stock, expectedStock, note } = body;
  if (typeof stock !== "number" || !Number.isSafeInteger(stock) || stock < 0 || stock > 2147483647
    || typeof expectedStock !== "number" || !Number.isSafeInteger(expectedStock)
    || typeof note !== "string" || !note.trim() || note.length > 1000) {
    return null;
  }
  return { stock, expectedStock, note: note.trim() };
}
