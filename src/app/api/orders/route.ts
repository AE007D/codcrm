import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import {
  getOrdersByWorkspace,
  upsertOrder,
  updateOrderFields,
  deleteOrder,
} from "@/lib/supabaseOrderStore";
import { sendPushToWorkspace } from "@/app/api/push/route";
import { getProducts } from "@/lib/supabaseProductStore";
import { getSettings } from "@/lib/supabaseSettingsStore";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const orders = await getOrdersByWorkspace(user.workspaceId);
  return NextResponse.json({ orders }, {
    headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" },
  });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await request.json();
  const { customer, phone, city, address, product, amount, notes, source } = body;
  if (!customer || !phone || !product || !amount) {
    return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const order = await upsertOrder({
    id,
    workspaceId: user.workspaceId,
    orderNumber: `MAN-${Date.now().toString().slice(-6)}`,
    customerName: String(customer),
    customerPhone: String(phone),
    customerEmail: "",
    city: String(city ?? ""),
    address: String(address ?? ""),
    product: String(product),
    totalPrice: parseFloat(amount) || 0,
    currency: "MAD",
    quantity: 1,
    funnel: "",
    source: source ?? "manuel",
    status: "nouveau",
    notes: String(notes ?? ""),
    attempts: 0,
    noAnswer: 0,
    receivedAt: now,
  });

  if (!order) return NextResponse.json({ error: "Erreur création commande." }, { status: 500 });

  sendPushToWorkspace(user.workspaceId, {
    title: "Nouvelle commande 🛍️",
    body: `${String(customer)} — ${String(product)} (${parseFloat(amount) || 0} MAD)`,
    url: "/commandes",
    tag: `order-${id}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, order });
}

export async function PATCH(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await request.json();
  const { id, ...patch } = body;
  if (!id) return NextResponse.json({ error: "ID requis." }, { status: 400 });

  const { data: currentRow } = await supabase
    .from("crm_orders")
    .select("status, product")
    .eq("id", id)
    .eq("workspace_id", user.workspaceId)
    .maybeSingle();

  const updated = await updateOrderFields(id, user.workspaceId, patch);
  if (!updated) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

  if (patch.status === "livré" && currentRow?.status !== "livré") {
    try {
      const [products, settings] = await Promise.all([
        getProducts(user.workspaceId),
        getSettings(user.workspaceId),
      ]);
      const productName = String(currentRow?.product ?? updated.product ?? "").trim();
      const matched = products.find(p => p.name.trim() === productName);
      if (matched) {
        type CR = { boutiqueNom: string; agentId: string; agentName: string; commissionAmount: number };
        const commissions = (settings.productCommissions as Record<string, CR>) ?? {};
        const commission = commissions[matched.id];
        if (commission?.agentId && commission.commissionAmount > 0) {
          await supabase.from("crm_payment_requests").insert({
            id: crypto.randomUUID(),
            workspace_id: user.workspaceId,
            agent_id: commission.agentId,
            agent_name: commission.agentName,
            amount: commission.commissionAmount,
            message: `Commission · ${productName}`,
            status: "pending",
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.error("auto-commission:", e);
    }
  }

  return NextResponse.json({ ok: true, order: updated });
}

export async function DELETE(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "ID requis." }, { status: 400 });

  const ok = await deleteOrder(id, user.workspaceId);
  if (!ok) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
