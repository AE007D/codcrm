import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// GET /api/p/[id] — public: returns product info for the order page
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("crm_products")
    .select("id, name, image, sell_price, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });

  return NextResponse.json({
    id: data.id,
    name: data.name,
    image: data.image ?? "",
    price: parseFloat(data.sell_price ?? "0"),
    ownerId: data.owner_id,
  });
}

// POST /api/p/[id] — public: submit a COD order for this product
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { customerName, phone, city, address, quantity = 1 } = body as {
    customerName: string; phone: string; city: string; address: string; quantity?: number;
  };

  if (!customerName || !phone || !city) {
    return NextResponse.json({ error: "Nom, téléphone et ville sont requis." }, { status: 400 });
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

  // Reduce stock by quantity
  if (product.stock > 0) {
    await supabase
      .from("crm_products")
      .update({ stock: Math.max(0, product.stock - Number(quantity)) })
      .eq("id", id);
  }

  return NextResponse.json({ ok: true, orderId });
}
