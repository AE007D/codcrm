/** Public product-page offer: one 50 MAD discount on an order of exactly two. */
export function productOrderTotal(unitPrice: number, quantity: number): number {
  const subtotal = Math.round(unitPrice * 100) * quantity;
  return Math.max(0, subtotal - (quantity === 2 ? 5000 : 0)) / 100;
}
