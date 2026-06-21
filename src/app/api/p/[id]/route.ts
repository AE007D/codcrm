import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSettings } from "@/lib/supabaseSettingsStore";
import { upsertLead } from "@/lib/supabaseLeadStore";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// GET /api/p/[id] — public: returns product info + increments page views
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("crm_products")
    .select("id, name, image, sell_price, compare_price, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });

  // Increment page views (silently ignored if column doesn't exist yet)
  void supabase.rpc("increment_page_views", { product_id: id });

  const settings = await getSettings(data.owner_id);
  const productPixels = (settings.productPixels as Record<string, string>) ?? {};

  // Per-product pixel takes priority; fall back to first workspace FB pixel
  let facebookPixelId = productPixels[id] ?? "";

  if (!facebookPixelId) {
    type PixelEntry = { pixelId: string; platform: string; productName: string };
    const pixels: PixelEntry[] = Array.isArray(settings.pixels) ? (settings.pixels as PixelEntry[]) : [];
    const productName = (data.name as string).trim().toLowerCase();
    const matched = pixels.find(p => p.platform === "facebook" && p.productName.trim().toLowerCase() === productName)
      ?? pixels.find(p => p.platform === "facebook");
    if (matched) facebookPixelId = matched.pixelId;
  }

  return NextResponse.json({
    id: data.id,
    name: data.name,
    image: data.image ?? "",
    price: parseFloat(data.sell_price ?? "0"),
    comparePrice: data.compare_price ? parseFloat(data.compare_price) : null,
    ownerId: data.owner_id,
    facebookPixelId,
  });
}

// POST /api/p/[id] — public: submit a COD order for this product
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { action, customerName, phone, city, address, quantity = 1 } = body as {
    action?: string; customerName: string; phone: string; city: string; address: string; quantity?: number;
  };

  // ── Abandoned lead capture ──────────────────────────────────────────────
  if (action === "save-lead") {
    if (!customerName || !phone) return NextResponse.json({ ok: false }, { status: 400 });

    const { data: product } = await supabase
      .from("crm_products")
      .select("id, name, sell_price, owner_id")
      .eq("id", id)
      .maybeSingle();

    if (!product) return NextResponse.json({ ok: false }, { status: 404 });

    await upsertLead({
      id: `abandoned_page_${id}_${String(phone).replace(/\s/g, "")}`,
      workspaceId: product.owner_id,
      type: "abandoned",
      customer: String(customerName).trim(),
      phone: String(phone).trim(),
      email: "",
      city: String(city ?? "").trim(),
      address: String(address ?? "").trim(),
      product: product.name,
      amount: parseFloat(product.sell_price ?? "0"),
      currency: "MAD",
      funnel: "Page produit",
      funnelUrl: `/p/${id}`,
      quantity: 1,
      createdAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      callAttempts: 0,
      recovered: false,
      notes: "",
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  }

  if (!customerName || !phone || !city) {
    return NextResponse.json({ error: "يرجى تعبئة الاسم والهاتف والمدينة" }, { status: 400 });
  }

  // Get product info
  const { data: product, error: pErr } = await supabase
    .from("crm_products")
    .select("id, name, sell_price, owner_id, stock")
    .eq("id", id)
    .maybeSingle();

  if (pErr || !product) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });

  const totalPrice = parseFloat(product.sell_price ?? "0") * Number(quantity);

  const orderId = crypto.randomUUID();
  const { error: oErr } = await supabase.from("crm_orders").insert({
    id: orderId,
    workspace_id: product.owner_id,
    order_number: String(Date.now()).slice(-8),
    customer_name: String(customerName).trim(),
    customer_phone: String(phone).trim(),
    customer_email: "",
    city: String(city).trim(),
    address: String(address ?? "").trim(),
    product: product.name,
    total_price: totalPrice,
    currency: "MAD",
    quantity: Number(quantity) || 1,
    funnel: "Page produit",
    source: "page",
    status: "nouveau",
    notes: "",
    attempts: 0,
    no_answer: 0,
    received_at: new Date().toISOString(),
  });

  if (oErr) {
    console.error("Page order insert:", oErr.message);
    return NextResponse.json({ error: "Erreur lors de la commande." }, { status: 500 });
  }

  // Reduce stock by quantity ordered
  if (product.stock > 0) {
    await supabase
      .from("crm_products")
      .update({ stock: Math.max(0, product.stock - Number(quantity)) })
      .eq("id", id);
  }

  return NextResponse.json({ ok: true, orderId });
}
