// Product catalog — per-user, in-memory (survives HMR, lost on server restart)
// Migrate to Supabase later if needed

export type Product = {
  id: string;
  ownerId: string;
  name: string;
  sku: string;
  image: string;         // URL or base64 data URL
  sellPrice: number;     // Prix de vente COD
  purchasePrice: number; // Prix d'achat
  stock: number;         // Quantité en stock
  minStock: number;      // Seuil d'alerte stock bas
  createdAt: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __crmProducts: Product[] | undefined;
}

function getAll(): Product[] {
  if (!globalThis.__crmProducts) globalThis.__crmProducts = [];
  return globalThis.__crmProducts;
}

export function getProducts(ownerId: string): Product[] {
  return getAll().filter(p => p.ownerId === ownerId);
}

export function getProductById(id: string, ownerId: string): Product | undefined {
  return getAll().find(p => p.id === id && p.ownerId === ownerId);
}

export function createProduct(data: Omit<Product, "id" | "createdAt">): Product {
  const product: Product = {
    ...data,
    id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  getAll().push(product);
  return product;
}

export function updateProduct(id: string, ownerId: string, patch: Partial<Omit<Product, "id" | "ownerId" | "createdAt">>): Product | null {
  const all = getAll();
  const idx = all.findIndex(p => p.id === id && p.ownerId === ownerId);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  return all[idx];
}

export function deleteProduct(id: string, ownerId: string): boolean {
  const all = getAll();
  const idx = all.findIndex(p => p.id === id && p.ownerId === ownerId);
  if (idx === -1) return false;
  all.splice(idx, 1);
  return true;
}

export function addStock(id: string, ownerId: string, qty: number): Product | null {
  return updateProduct(id, ownerId, { stock: Math.max(0, (getProductById(id, ownerId)?.stock ?? 0) + qty) });
}
