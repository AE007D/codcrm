// Products persisted in Supabase
import { supabase } from "./supabase";
import crypto from "crypto";

export type Product = {
  id: string;
  ownerId: string;
  name: string;
  sku: string;
  image: string;
  sellPrice: number;
  purchasePrice: number;
  stock: number;
  minStock: number;
  createdAt: string;
  pageViews?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProduct(row: any): Product {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    sku: row.sku ?? "",
    image: row.image ?? "",
    sellPrice: parseFloat(row.sell_price ?? "0"),
    purchasePrice: parseFloat(row.purchase_price ?? "0"),
    stock: row.stock ?? 0,
    minStock: row.min_stock ?? 5,
    createdAt: row.created_at,
    pageViews: row.page_views ?? 0,
  };
}

export async function getProducts(ownerId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from("crm_products")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) { console.error("getProducts:", error.message); return []; }
  return (data ?? []).map(rowToProduct);
}

export async function createProduct(p: Omit<Product, "id" | "createdAt">): Promise<Product> {
  const { data, error } = await supabase
    .from("crm_products")
    .insert({
      id: crypto.randomUUID(),
      owner_id: p.ownerId,
      name: p.name,
      sku: p.sku,
      image: p.image,
      sell_price: p.sellPrice,
      purchase_price: p.purchasePrice,
      stock: p.stock,
      min_stock: p.minStock,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error("createProduct: " + error.message);
  return rowToProduct(data);
}

export async function updateProduct(id: string, ownerId: string, patch: Partial<Omit<Product, "id" | "ownerId" | "createdAt">>): Promise<Product | null> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.sku !== undefined) dbPatch.sku = patch.sku;
  if (patch.image !== undefined) dbPatch.image = patch.image;
  if (patch.sellPrice !== undefined) dbPatch.sell_price = patch.sellPrice;
  if (patch.purchasePrice !== undefined) dbPatch.purchase_price = patch.purchasePrice;
  if (patch.stock !== undefined) dbPatch.stock = patch.stock;
  if (patch.minStock !== undefined) dbPatch.min_stock = patch.minStock;

  const { data, error } = await supabase
    .from("crm_products")
    .update(dbPatch)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select()
    .maybeSingle();
  if (error) { console.error("updateProduct:", error.message); return null; }
  return data ? rowToProduct(data) : null;
}

export async function addStock(id: string, ownerId: string, qty: number): Promise<Product | null> {
  // Fetch current stock first
  const { data: current } = await supabase
    .from("crm_products")
    .select("stock")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!current) return null;

  const newStock = (current.stock ?? 0) + qty;
  const { data, error } = await supabase
    .from("crm_products")
    .update({ stock: newStock })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select()
    .maybeSingle();
  if (error) { console.error("addStock:", error.message); return null; }
  return data ? rowToProduct(data) : null;
}

export async function deleteProduct(id: string, ownerId: string): Promise<boolean> {
  const { error } = await supabase
    .from("crm_products")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId);
  if (error) { console.error("deleteProduct:", error.message); return false; }
  return true;
}
