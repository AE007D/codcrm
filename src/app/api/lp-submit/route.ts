import { NextRequest, NextResponse } from "next/server";
import { getPageBySlug, incrementOrders } from "@/lib/pageStore";
import { addOrder, LFOrder } from "@/lib/orderStore";
import { addLead, FunnelLead } from "@/lib/leadStore";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const slug = String(body.slug || "");
  const page = getPageBySlug(slug);
  if (!page) return NextResponse.json({ error: "Page introuvable" }, { status: 404 });
  if (!page.active) return NextResponse.json({ error: "Page inactive" }, { status: 403 });

  const customer = String(body.customer || "").trim();
  const phone = String(body.phone || "").trim();
  const city = String(body.city || "").trim();
  const address = String(body.address || "").trim();

  if (!customer || !phone || !city) {
    return NextResponse.json({ error: "Nom, téléphone et ville sont obligatoires." }, { status: 422 });
  }

  const id = `lp_order_${Date.now()}`;

  // Add to orders (Commandes page)
  const order: LFOrder = {
    id,
    order_number: Math.floor(10000 + Math.random() * 90000),
    status: "pending",
    financial_status: "cod",
    total_price: String(page.price),
    currency: page.currency,
    customer_name: customer,
    customer_phone: phone,
    customer_email: "",
    city,
    address,
    product: page.title,
    quantity: 1,
    funnel: page.title,
    created_at: new Date().toISOString(),
    received_at: new Date().toISOString(),
  };
  addOrder(order);

  // Also add to funnel leads as a purchase
  const lead: FunnelLead = {
    id: `purchase_${id}`,
    type: "purchase",
    customer,
    phone,
    email: "",
    city,
    address,
    product: page.title,
    amount: page.price,
    currency: page.currency,
    funnel: page.title,
    funnelUrl: `/lp/${slug}`,
    quantity: 1,
    created_at: new Date().toISOString(),
    received_at: new Date().toISOString(),
    callAttempts: 0,
    recovered: false,
    notes: "",
  };
  addLead(lead);

  incrementOrders(slug);

  return NextResponse.json({ ok: true, order_id: id });
}
