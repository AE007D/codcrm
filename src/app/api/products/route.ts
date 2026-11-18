import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { getProducts, createProduct, updateProduct, deleteProduct, addStock } from "@/lib/supabaseProductStore";
import { getSettings, saveSettings } from "@/lib/supabaseSettingsStore";
import { supabase } from "@/lib/supabase";
import { parseStockCorrection } from "@/lib/stockCorrection";

type CommissionRecord = { boutiqueNom: string; agentId: string; agentName: string; commissionAmount: number };
type StockMovement = { id: string; productId: string; quantity: number; unitCost: number; totalCost: number; note: string; createdAt: string; stockAfter: number };

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const [products, settings] = await Promise.all([
    getProducts(user.workspaceId),
    getSettings(user.workspaceId),
  ]);
  const productPixels: Record<string, string> = (settings.productPixels as Record<string, string>) ?? {};
  const stockMovements = (Array.isArray(settings.productStockMovements) ? settings.productStockMovements : []) as StockMovement[];
  const productCommissions = (settings.productCommissions as Record<string, CommissionRecord>) ?? {};

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

  const enriched = products.map(p => {
    const commission = productCommissions[p.id];
    return {
      ...p,
      stockMovements: stockMovements.filter(movement => movement.productId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      pageOrders: pageOrderMap[p.name] ?? 0,
      facebookPixelId: productPixels[p.id] ?? "",
      boutiqueNom: commission?.boutiqueNom ?? "",
      agentId: commission?.agentId ?? "",
      agentName: commission?.agentName ?? "",
      commissionAmount: commission?.commissionAmount ?? 0,
    };
  });

  return NextResponse.json({ products: enriched }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  try {
    const body = await request.json();
    const { name, sku, image, sellPrice, comparePrice, purchasePrice, stock, minStock, facebookPixelId, boutiqueNom, agentId, agentName, commissionAmount } = body;
    if (!name) return NextResponse.json({ error: "Le nom est requis." }, { status: 400 });

    const product = await createProduct({
      ownerId: user.workspaceId,
      name: String(name).trim(),
      sku: String(sku ?? "").trim(),
      image: String(image ?? ""),
      sellPrice: parseFloat(sellPrice) || 0,
      comparePrice: comparePrice ? parseFloat(comparePrice) : undefined,
      purchasePrice: parseFloat(purchasePrice) || 0,
      stock: parseInt(stock) || 0,
      minStock: parseInt(minStock) || 5,
    });

    const needsSave = facebookPixelId || boutiqueNom || agentId || commissionAmount;
    if (needsSave) {
      const settings = await getSettings(user.workspaceId);
      const settingsPatch: Record<string, unknown> = {};

      if (facebookPixelId) {
        settingsPatch.productPixels = { ...(settings.productPixels as Record<string, string> ?? {}), [product.id]: String(facebookPixelId).trim() };
      }
      if (boutiqueNom || agentId || commissionAmount) {
        const commissions = { ...(settings.productCommissions as Record<string, CommissionRecord> ?? {}) };
        commissions[product.id] = {
          boutiqueNom: String(boutiqueNom ?? ""),
          agentId: String(agentId ?? ""),
          agentName: String(agentName ?? ""),
          commissionAmount: parseFloat(String(commissionAmount ?? "0")) || 0,
        };
        settingsPatch.productCommissions = commissions;
      }
      await saveSettings(user.workspaceId, settingsPatch);
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

    if (action === "correctStock") {
      if (user.role !== "admin") return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
      const correction = parseStockCorrection(rest);
      if (!correction) return NextResponse.json({ error: "Stock entier positif ou nul et motif requis." }, { status: 400 });
      const { error } = await supabase.rpc("correct_product_stock", {
        p_workspace_id: user.workspaceId,
        p_product_id: id,
        p_expected_stock: correction.expectedStock,
        p_stock: correction.stock,
        p_note: correction.note,
      });
      if (error) {
        const status = error.code === "40001" ? 409 : error.code === "P0002" ? 404 : 500;
        return NextResponse.json({ error: status === 409
          ? "Le stock a changé. Rechargez la page avant de corriger."
          : "Impossible de corriger le stock." }, { status });
      }
      return NextResponse.json({ ok: true, stock: correction.stock });
    }

    if (action === "addStock") {
      const addedQty = parseInt(qty) || 0;
      if (addedQty <= 0) return NextResponse.json({ error: "Quantité invalide." }, { status: 400 });
      const existing = (await getProducts(user.workspaceId)).find(p => p.id === id);
      if (!existing) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
      let updated = await addStock(id, user.workspaceId, addedQty);
      if (!updated) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
      const hasPurchasePrice = rest.purchasePrice !== null && rest.purchasePrice !== undefined && Number.isFinite(Number(rest.purchasePrice));
      const unitCost = hasPurchasePrice ? Math.max(0, Number(rest.purchasePrice)) : existing.purchasePrice;
      const note = String(rest.note ?? "").trim();
      const nextStock = existing.stock + addedQty;
      const averagePurchasePrice = nextStock > 0
        ? (existing.purchasePrice * existing.stock + unitCost * addedQty) / nextStock
        : unitCost;
      const costUpdated = await updateProduct(id, user.workspaceId, { purchasePrice: averagePurchasePrice });
      if (costUpdated) updated = costUpdated;

      const settings = await getSettings(user.workspaceId);
      const movements = (Array.isArray(settings.productStockMovements) ? settings.productStockMovements : []) as StockMovement[];
      const movement: StockMovement = {
        id: crypto.randomUUID(),
        productId: id,
        quantity: addedQty,
        unitCost,
        totalCost: unitCost * addedQty,
        note,
        createdAt: new Date().toISOString(),
        stockAfter: nextStock,
      };
      await saveSettings(user.workspaceId, { productStockMovements: [...movements, movement] });
      return NextResponse.json({ ok: true, product: updated, movement });
    }

    const patch: Record<string, unknown> = {};
    if (rest.name !== undefined) patch.name = rest.name;
    if (rest.sku !== undefined) patch.sku = rest.sku;
    if (rest.image !== undefined) patch.image = rest.image;
    if (rest.sellPrice !== undefined) patch.sellPrice = parseFloat(rest.sellPrice) || 0;
    if (rest.comparePrice !== undefined) patch.comparePrice = rest.comparePrice ? parseFloat(rest.comparePrice) : undefined;
    if (rest.purchasePrice !== undefined) patch.purchasePrice = parseFloat(rest.purchasePrice) || 0;
    if (rest.stock !== undefined) patch.stock = parseInt(rest.stock) || 0;
    if (rest.minStock !== undefined) patch.minStock = parseInt(rest.minStock) || 5;

    let updated = null;
    if (Object.keys(patch).length > 0) {
      updated = await updateProduct(id, user.workspaceId, patch);
      if (!updated) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    }

    const needsSettingsSave = rest.facebookPixelId !== undefined
      || rest.boutiqueNom !== undefined
      || rest.agentId !== undefined
      || rest.commissionAmount !== undefined;

    if (needsSettingsSave) {
      const settings = await getSettings(user.workspaceId);
      const settingsPatch: Record<string, unknown> = {};

      if (rest.facebookPixelId !== undefined) {
        settingsPatch.productPixels = { ...(settings.productPixels as Record<string, string> ?? {}), [id]: String(rest.facebookPixelId).trim() };
      }

      if (rest.boutiqueNom !== undefined || rest.agentId !== undefined || rest.commissionAmount !== undefined) {
        const commissions = { ...(settings.productCommissions as Record<string, CommissionRecord> ?? {}) };
        const existing = commissions[id] ?? { boutiqueNom: "", agentId: "", agentName: "", commissionAmount: 0 };
        commissions[id] = {
          boutiqueNom: rest.boutiqueNom !== undefined ? String(rest.boutiqueNom) : existing.boutiqueNom,
          agentId: rest.agentId !== undefined ? String(rest.agentId) : existing.agentId,
          agentName: rest.agentName !== undefined ? String(rest.agentName) : existing.agentName,
          commissionAmount: rest.commissionAmount !== undefined ? parseFloat(String(rest.commissionAmount)) || 0 : existing.commissionAmount,
        };
        settingsPatch.productCommissions = commissions;
      }

      await saveSettings(user.workspaceId, settingsPatch);
    }

    return NextResponse.json({ ok: true, ...(updated ? { product: updated } : {}) });
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
