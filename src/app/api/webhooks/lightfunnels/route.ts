import { NextRequest, NextResponse } from "next/server";
import { addOrder, LFOrder } from "@/lib/orderStore";
import { addLead, FunnelLead } from "@/lib/leadStore";

// Helper: pick first non-empty string from a list of candidates
function pick(...vals: unknown[]): string {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s && s !== "undefined" && s !== "null") return s;
  }
  return "";
}

function num(...vals: unknown[]): number {
  for (const v of vals) {
    const n = parseFloat(String(v ?? ""));
    if (!isNaN(n) && n > 0) return n;
  }
  return 0;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("LF_WEBHOOK_RAW:", JSON.stringify(body));

  const eventType = pick(body.event, body.type) || "order/created";

  // ── Abandoned checkout ──────────────────────────────────────────────────
  if (
    eventType === "checkout/abandoned" ||
    eventType === "checkout_abandoned" ||
    body.abandoned_checkout
  ) {
    const raw = (body.checkout ?? body.abandoned_checkout ?? body) as Record<string, unknown>;
    const cust = (raw.customer ?? raw.billing_address ?? {}) as Record<string, unknown>;
    const ship = (raw.shipping_address ?? raw.billing_address ?? cust) as Record<string, unknown>;
    const items = (raw.line_items ?? raw.items ?? []) as Record<string, unknown>[];
    const funnel = (raw.funnel ?? body.funnel ?? {}) as Record<string, unknown>;

    const lead: FunnelLead = {
      id: `abandoned_${pick(raw.id, raw.token) || Date.now()}`,
      type: "abandoned",
      customer: pick(cust.name, `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim(), ship.name, raw.name, raw.customer_name) || "Prospect",
      phone: pick(cust.phone, ship.phone, raw.phone, raw.customer_phone),
      email: pick(cust.email, raw.email),
      city: pick(ship.city, ship.province, raw.city),
      address: pick(ship.address1, ship.address, raw.address),
      product: items.length > 0 ? pick(items[0].title, items[0].name) || "Produit" : "Produit",
      amount: num(raw.total_price, raw.subtotal_price),
      currency: pick(raw.currency, "MAD"),
      funnel: pick(funnel.name, funnel.title, raw.funnel_name),
      funnelUrl: pick(funnel.url, funnel.domain, raw.funnel_url),
      quantity: items.reduce((s, i) => s + (Number(i.quantity) || 1), 0) || 1,
      created_at: pick(raw.created_at) || new Date().toISOString(),
      received_at: new Date().toISOString(),
      callAttempts: 0, recovered: false, notes: "",
    };

    addLead(lead);
    return NextResponse.json({ ok: true, type: "abandoned", lead_id: lead.id });
  }

  // ── Completed order (order/created) ────────────────────────────────────
  // Lightfunnels v2 sends order fields at root level (not nested under "order")
  const order = body;
  const cust = (order.customer ?? order.billing_address ?? {}) as Record<string, unknown>;
  const ship = (order.shipping_address ?? order.billing_address ?? cust) as Record<string, unknown>;
  const items = (order.line_items ?? order.items ?? []) as Record<string, unknown>[];
  const funnel = (order.funnel ?? {}) as Record<string, unknown>;

  // Customer name: try customer.name, first+last, root name, root customer_name
  const customerName = pick(
    cust.name,
    `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim(),
    ship.name,
    `${ship.first_name ?? ""} ${ship.last_name ?? ""}`.trim(),
    order.name,
    order.customer_name,
  );

  // Phone: customer > shipping > root
  const customerPhone = pick(
    cust.phone, cust.telephone,
    ship.phone, ship.telephone,
    order.phone, order.customer_phone,
  );

  // City: shipping > billing > root
  const city = pick(
    ship.city, ship.province, ship.region,
    cust.city,
    order.city,
  );

  // Address
  const address = pick(
    ship.address1, ship.address, ship.adresse,
    cust.address1, cust.address,
    order.address,
  );

  // Product
  const product = items.length > 0
    ? pick(items[0].title, items[0].name, items[0].product_title) || "Produit"
    : pick(order.product_title, order.product) || "Produit";

  const parsed: LFOrder = {
    id: pick(order.id, order._id) || String(Date.now()),
    order_number: Number(order.order_number ?? order.number ?? 0),
    status: pick(order.fulfillment_status, order.status) || "pending",
    financial_status: pick(order.financial_status, order.payment_status) || "cod",
    total_price: pick(order.total_price, order.total, order.amount) || "0",
    currency: pick(order.currency) || "MAD",
    customer_name: customerName || "Client",
    customer_phone: customerPhone,
    customer_email: pick(cust.email, order.email),
    city,
    address,
    product,
    quantity: items.reduce((s, i) => s + (Number(i.quantity) || 1), 0) || 1,
    funnel: pick(funnel.name, funnel.title),
    created_at: pick(order.created_at) || new Date().toISOString(),
    received_at: new Date().toISOString(),
  };

  addOrder(parsed);

  const purchaseLead: FunnelLead = {
    id: `purchase_${parsed.id}`,
    type: "purchase",
    customer: parsed.customer_name,
    phone: parsed.customer_phone,
    email: parsed.customer_email,
    city: parsed.city,
    address: parsed.address,
    product: parsed.product,
    amount: parseFloat(parsed.total_price) || 0,
    currency: parsed.currency,
    funnel: parsed.funnel,
    funnelUrl: pick(funnel.url, funnel.domain),
    quantity: parsed.quantity,
    created_at: parsed.created_at,
    received_at: parsed.received_at,
    callAttempts: 0, recovered: false, notes: "",
  };
  addLead(purchaseLead);

  return NextResponse.json({ ok: true, type: "purchase", order_id: parsed.id });
}

export async function GET() {
  return NextResponse.json({ status: "COD CRM webhook active", version: "v2", events: ["order/created", "checkout/abandoned"] });
}
