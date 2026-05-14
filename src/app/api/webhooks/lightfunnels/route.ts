import { NextRequest, NextResponse } from "next/server";
import { addOrder, LFOrder } from "@/lib/orderStore";
import { addLead, FunnelLead } from "@/lib/leadStore";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = String(body.event ?? body.type ?? "order/created");

  // ── Abandoned checkout ──────────────────────────────────────────────────
  if (
    eventType === "checkout/abandoned" ||
    eventType === "checkout_abandoned" ||
    body.abandoned_checkout
  ) {
    const raw = (body.checkout ?? body.abandoned_checkout ?? body) as Record<string, unknown>;
    const customer = (raw.customer ?? raw.billing_address ?? raw) as Record<string, unknown>;
    const shipping = (raw.shipping_address ?? customer) as Record<string, unknown>;
    const lineItems = (raw.line_items ?? []) as Record<string, unknown>[];
    const funnel = (raw.funnel ?? body.funnel ?? {}) as Record<string, unknown>;

    const firstName = String(customer.first_name ?? shipping.first_name ?? raw.first_name ?? "");
    const lastName = String(customer.last_name ?? shipping.last_name ?? raw.last_name ?? "");
    const productTitle = lineItems.length > 0
      ? String(lineItems[0].title ?? lineItems[0].name ?? "Produit")
      : "Produit";

    const lead: FunnelLead = {
      id: `abandoned_${String(raw.id ?? raw.token ?? Date.now())}`,
      type: "abandoned",
      customer: `${firstName} ${lastName}`.trim() || String(raw.name ?? customer.name ?? "Prospect"),
      phone: String(customer.phone ?? shipping.phone ?? raw.phone ?? ""),
      email: String(customer.email ?? raw.email ?? ""),
      city: String(shipping.city ?? shipping.province ?? raw.city ?? ""),
      address: String(shipping.address1 ?? shipping.address ?? raw.address ?? ""),
      product: productTitle,
      amount: parseFloat(String(raw.total_price ?? raw.subtotal_price ?? "0")),
      currency: String(raw.currency ?? "MAD"),
      funnel: String(funnel.name ?? funnel.title ?? raw.funnel_name ?? ""),
      funnelUrl: String(funnel.url ?? funnel.domain ?? raw.funnel_url ?? ""),
      quantity: lineItems.reduce((s, i) => s + (Number(i.quantity) || 1), 0) || 1,
      created_at: String(raw.created_at ?? new Date().toISOString()),
      received_at: new Date().toISOString(),
      callAttempts: 0,
      recovered: false,
      notes: "",
    };

    addLead(lead);
    return NextResponse.json({ ok: true, type: "abandoned", lead_id: lead.id });
  }

  // ── Completed order (order/created) ────────────────────────────────────
  const order = body as Record<string, unknown>;
  const customer = (order.customer ?? order.billing_address ?? {}) as Record<string, unknown>;
  const shipping = (order.shipping_address ?? customer) as Record<string, unknown>;
  const lineItems = (order.line_items ?? []) as Record<string, unknown>[];
  const funnel = (order.funnel ?? {}) as Record<string, unknown>;

  const firstName = String(customer.first_name ?? shipping.first_name ?? "");
  const lastName = String(customer.last_name ?? shipping.last_name ?? "");
  const productTitle = lineItems.length > 0
    ? String(lineItems[0].title ?? lineItems[0].name ?? "Produit")
    : "Produit";
  const totalQty = lineItems.reduce((s, i) => s + (Number(i.quantity) || 1), 0);

  const parsed: LFOrder = {
    id: String(order.id ?? order._id ?? Date.now()),
    order_number: Number(order.order_number ?? order.number ?? 0),
    status: String(order.status ?? order.fulfillment_status ?? "pending"),
    financial_status: String(order.financial_status ?? order.payment_status ?? "pending"),
    total_price: String(order.total_price ?? order.total ?? "0"),
    currency: String(order.currency ?? "MAD"),
    customer_name: `${firstName} ${lastName}`.trim() || "Client",
    customer_phone: String(customer.phone ?? shipping.phone ?? ""),
    customer_email: String(customer.email ?? ""),
    city: String(shipping.city ?? shipping.province ?? ""),
    address: String(shipping.address1 ?? shipping.address ?? ""),
    product: productTitle,
    quantity: totalQty,
    funnel: String(funnel.name ?? funnel.title ?? ""),
    created_at: String(order.created_at ?? new Date().toISOString()),
    received_at: new Date().toISOString(),
  };

  addOrder(parsed);

  // Also mirror as a purchase lead for the funnels dashboard
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
    funnelUrl: String((funnel as Record<string,unknown>).url ?? ""),
    quantity: parsed.quantity,
    created_at: parsed.created_at,
    received_at: parsed.received_at,
    callAttempts: 0,
    recovered: false,
    notes: "",
  };
  addLead(purchaseLead);

  return NextResponse.json({ ok: true, type: "purchase", order_id: parsed.id });
}

export async function GET() {
  return NextResponse.json({ status: "COD CRM webhook active", version: "v2", events: ["order/created", "checkout/abandoned"] });
}
