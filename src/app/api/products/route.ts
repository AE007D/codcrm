import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { getProducts, createProduct, updateProduct, deleteProduct, addStock } from "@/lib/supabaseProductStore";
import { getSettings, saveSettings } from "@/lib/supabaseSettingsStore";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const [products, settings] = await Promise.all([
    getProducts(user.workspaceId),
    getSettings(user.workspaceId),
  ]);
  const productPixels: Record<string, string> = (settings.productPixels as Record<string, string>) ?? {};

  // Fetch page order counts per product (source='page') in one query
  const { data: pageOrders } = await supabase
    .from("crm_orders")
    .select("product")
    .eq("workspace_id", user.workspaceId)
    .eq("source", "page");

  const pageOrderMap: Record<string, number> = {};
  for (const o of pageOrders ?? []) {
    const key = String(o.product ?? "").trim();
    pageOrderMap[key] = (pageOrderMap[key] ?? 0) + 1;
  }

  const enriched = products.map(p => ({
    ...p,
    pageOrders: pageOrderMap[p.name] ?? 0,
    facebookPixelId: productPixels[p.id] ?? "",
  }));

  return NextResponse.json({ products: enriched });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  try {
    const body = await request.json();
    const { name, sku, image, sellPrice, purchasePrice, stock, minStock, facebookPixelId } = body;
    if (!name) return NextResponse.json({ error: "Le nom est requis." }, { status: 400 });

    const product = await createProduct({
      ownerId: user.workspaceId,
      name: String(name).trim(),
      sku: String(sku ?? "").trim(),
      image: String(image ?? ""),
      sellPrice: parseFloat(sellPrice) || 0,
      purchasePrice: parseFloat(purchasePrice) || 0,
      stock: parseInt(stock) || 0,
      minStock: parseInt(minStock) || 5,
    });

    if (facebookPixelId) {
      const settings = await getSettings(user.workspaceId);
      const productPixels = { ...(settings.productPixels as Record<string, string> ?? {}), [product.id]: String(facebookPixelId).trim() };
      await saveSettings(user.workspaceId, { productPixels });
    }

    return NextResponse.json({ ok: true, product: { ...product, facebookPixelId: facebookPixelId ? String(facebookPixelId).trim() : "" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  try {
    const body = await request.json();
    const { id, action, qty, ...rest } = body;
    if (!id) return NextResponse.json({ error: "ID requis." }, { status: 400 });

    if (action === "addStock") {
      const updated = await addStock(id, user.workspaceId, parseInt(qty) || 0);
      if (!updated) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
      return NextResponse.json({ ok: true, product: updated });
    }

    // Normalize field names
    const patch: Record<string, unknown> = {};
    if (rest.name !== undefined) patch.name = rest.name;
    if (rest.sku !== undefined) patch.sku = rest.sku;
    if (rest.image !== undefined) patch.image = rest.image;
    if (rest.sellPrice !== undefined) patch.sellPrice = parseFloat(rest.sellPrice) || 0;
    if (rest.purchasePrice !== undefined) patch.purchasePrice = parseFloat(rest.purchasePrice) || 0;
    if (rest.stock !== undefined) patch.stock = parseInt(rest.stock) || 0;
    if (rest.minStock !== undefined) patch.minStock = parseInt(rest.minStock) || 5;

    const updated = await updateProduct(id, user.workspaceId, patch);
    if (rest.facebookPixelId !== undefined) {
      const settings = await getSettings(user.workspaceId);
      const productPixels = { ...(settings.productPixels as Record<string, string> ?? {}), [id]: String(rest.facebookPixelId).trim() };
      await saveSettings(user.workspaceId, { productPixels });
    }
    if (!updated) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true, product: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "ID requis." }, { status: 400 });

  const ok = await deleteProduct(id, user.workspaceId);
  if (!ok) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
