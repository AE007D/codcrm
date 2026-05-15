import { NextRequest, NextResponse } from "next/server";
import { getPageBySlug, incrementPageOrders } from "@/lib/supabasePageStore";
import { upsertOrder } from "@/lib/supabaseOrderStore";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const slug = String(body.slug || "");
  const page = await getPageBySlug(slug);
  if (!page) return NextResponse.json({ error: "Page introuvable" }, { status: 404 });
  if (!page.active) return NextResponse.json({ error: "Page inactive" }, { status: 403 });

  const ownerId = page.ownerId;
  const customer = String(body.customer || "").trim();
  const phone = String(body.phone || "").trim();
  const city = String(body.city || "").trim();
  const address = String(body.address || "").trim();

  if (!customer || !phone || !city) {
    return NextResponse.json({ error: "يرجى ملء جميع الحقول الإلزامية" }, { status: 422 });
  }

  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();

  await upsertOrder({
    id: orderId,
    workspaceId: ownerId,
    orderNumber: String(Date.now()).slice(-8),
    customerName: customer,
    customerPhone: phone,
    customerEmail: "",
    city,
    address,
    product: page.title,
    totalPrice: page.price,
    currency: page.currency,
    quantity: 1,
    funnel: page.title,
    source: "page",
    status: "nouveau",
    notes: "",
    attempts: 0,
    noAnswer: 0,
    receivedAt: now,
  });

  await incrementPageOrders(slug).catch(() => {});

  return NextResponse.json({ ok: true, order_id: orderId });
}
