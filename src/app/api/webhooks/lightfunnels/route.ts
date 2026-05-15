import { NextRequest, NextResponse } from "next/server";
import { addOrder, LFOrder } from "@/lib/orderStore";
import { addLead, FunnelLead } from "@/lib/leadStore";
import { upsertOrder } from "@/lib/supabaseOrderStore";
import { upsertLead } from "@/lib/supabaseLeadStore";

// Pick first non-empty string value
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

// Find order root — LF v2 GraphQL format wraps under "node"
function findOrderRoot(body: Record<string, unknown>): Record<string, unknown> {
  // LF v2: {"node": {"__typename": "Order", "_id": 12345, ...}}
  if (body.node && typeof body.node === "object") {
    return body.node as Record<string, unknown>;
  }
  const data = (body.data ?? {}) as Record<string, unknown>;
  if (body.order && typeof body.order === "object") {
    return body.order as Record<string, unknown>;
  }
  if (data.order && typeof data.order === "object") {
    return data.order as Record<string, unknown>;
  }
  if (data._id ?? data.id) return data;
  return body;
}

export async function POST(request: NextRequest) {
  // Read ownerId from ?uid= query param (set by user in their Lightfunnels webhook URL)
  const ownerId = request.nextUrl.searchParams.get("uid") ?? "";

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
    const raw = (body.checkout ?? body.abandoned_checkout ?? findOrderRoot(body)) as Record<string, unknown>;
    const cust = (raw.customer ?? raw.billing_address ?? {}) as Record<string, unknown>;
    const ship = (raw.shipping_address ?? raw.billing_address ?? cust) as Record<string, unknown>;
    const items = (raw.line_items ?? raw.items ?? []) as Record<string, unknown>[];
    const funnel = (raw.funnel ?? body.funnel ?? {}) as Record<string, unknown>;

    const lead: FunnelLead = {
      id: `abandoned_${pick(raw.id, raw.token) || Date.now()}`,
      type: "abandoned",
      customer: pick(cust.name, `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim(), ship.name, raw.name, raw.customer_name) || "Prospect",
      phone: pick(cust.phone, cust.telephone, ship.phone, raw.phone, raw.customer_phone),
      email: pick(cust.email, raw.email),
      city: pick(ship.city, ship.province, cust.city, raw.city),
      address: pick(ship.address1, ship.address, cust.address1, raw.address),
      product: items.length > 0 ? pick(items[0].title, items[0].name) || "Produit" : "Produit",
      amount: num(raw.total_price, raw.total, raw.subtotal, raw.subtotal_price),
      currency: pick(raw.currency) || "MAD",
      funnel: pick(funnel.name, funnel.title, raw.funnel_name),
      funnelUrl: pick(funnel.url, funnel.domain, raw.funnel_url),
      quantity: items.reduce((s, i) => s + (Number(i.quantity) || 1), 0) || 1,
      created_at: pick(raw.created_at) || new Date().toISOString(),
      received_at: new Date().toISOString(),
      callAttempts: 0, recovered: false, notes: "",
      ownerId,
    };

    addLead(lead, ownerId);

    // Persist to Supabase
    upsertLead({
      id: lead.id,
      workspaceId: ownerId,
      type: "abandoned",
      customer: lead.customer,
      phone: lead.phone,
      email: lead.email,
      city: lead.city,
      address: lead.address,
      product: lead.product,
      amount: lead.amount,
      currency: lead.currency,
      funnel: lead.funnel,
      funnelUrl: lead.funnelUrl,
      quantity: lead.quantity,
      createdAt: lead.created_at,
      receivedAt: lead.received_at,
      callAttempts: 0,
      recovered: false,
      notes: "",
    }).catch(e => console.error("upsertLead abandoned:", e));

    return NextResponse.json({ ok: true, type: "abandoned", lead_id: lead.id });
  }

  // ── Completed order (order/created) ────────────────────────────────────
  const order = findOrderRoot(body);
  // LF v2: customer info at root node level + shipping_address object
  const cust = (order.customer ?? {}) as Record<string, unknown>;
  const ship = (order.shipping_address ?? order.billing_address ?? {}) as Record<string, unknown>;
  // LF v2 uses "items" array (not "line_items")
  const items = (order.items ?? order.line_items ?? []) as Record<string, unknown>[];
  const funnel = (order.funnel ?? body.funnel ?? {}) as Record<string, unknown>;

  const customerName = pick(
    order.name,                // LF v2: full name at node root ✓
    cust.full_name,            // LF v2: customer.full_name
    `${ship.first_name ?? ""} ${ship.last_name ?? ""}`.trim(),
    cust.name,
    order.customer_name,
  );

  const product = items.length > 0
    ? pick(items[0].title, items[0].name, items[0].product_title) || "Produit"
    : pick(order.product_title, order.product) || "Produit";

  const parsed: LFOrder = {
    id: pick(order._id, order.id, body.id) || String(Date.now()),
    order_number: Number(order._id ?? order.order_number ?? order.number ?? 0),
    status: pick(order.fulfillment_status, order.status) || "pending",
    financial_status: pick(order.financial_status, order.payment_status) || "cod",
    total_price: pick(order.total_price, order.total, order.subtotal, order.amount) || "0",
    currency: pick(order.currency, body.currency) || "MAD",
    customer_name: customerName || "Client",
    // LF v2: phone/email at node root
    customer_phone: pick(order.phone, ship.phone, cust.phone),
    customer_email: pick(order.email, ship.email, cust.email),
    // LF v2: shipping_address uses "city" and "line1"
    city: pick(ship.city, ship.state, ship.area, order.city),
    address: pick(ship.line1, ship.address1, ship.address, order.address),
    product,
    quantity: items.reduce((s, i) => s + (Number(i.quantity) || 1), 0) || 1,
    funnel: pick(funnel.name, funnel.title, order.funnel_id),
    created_at: pick(order.created_at, body.created_at) || new Date().toISOString(),
    received_at: new Date().toISOString(),
    ownerId,
  };

  addOrder(parsed, ownerId);

  // Also persist to Supabase (survives Vercel restarts)
  upsertOrder({
    id: parsed.id,
    workspaceId: ownerId,
    orderNumber: String(parsed.order_number),
    customerName: parsed.customer_name,
    customerPhone: parsed.customer_phone,
    customerEmail: parsed.customer_email,
    city: parsed.city,
    address: parsed.address,
    product: parsed.product,
    totalPrice: parseFloat(parsed.total_price) || 0,
    currency: parsed.currency,
    quantity: parsed.quantity,
    funnel: parsed.funnel,
    source: "lightfunnels",
    status: "nouveau",
    notes: "",
    attempts: 0,
    noAnswer: 0,
    receivedAt: parsed.received_at,
  }).catch(e => console.error("upsertOrder failed:", e));

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
    ownerId,
  };
  addLead(purchaseLead, ownerId);

  // Persist purchase lead to Supabase
  upsertLead({
    id: purchaseLead.id,
    workspaceId: ownerId,
    type: "purchase",
    customer: purchaseLead.customer,
    phone: purchaseLead.phone,
    email: purchaseLead.email,
    city: purchaseLead.city,
    address: purchaseLead.address,
    product: purchaseLead.product,
    amount: purchaseLead.amount,
    currency: purchaseLead.currency,
    funnel: purchaseLead.funnel,
    funnelUrl: purchaseLead.funnelUrl,
    quantity: purchaseLead.quantity,
    createdAt: purchaseLead.created_at,
    receivedAt: purchaseLead.received_at,
    callAttempts: 0,
    recovered: false,
    notes: "",
  }).catch(e => console.error("upsertLead purchase:", e));

  return NextResponse.json({ ok: true, type: "purchase", order_id: parsed.id });
}

export async function GET() {
  return NextResponse.json({ status: "COD CRM webhook active", version: "v2", events: ["order/created", "checkout/abandoned"] });
}
