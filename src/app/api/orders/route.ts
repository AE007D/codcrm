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
import type { OrderAssignments } from "@/lib/orderAssignment";
import { commissionId } from "@/lib/orderCommissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const [rows, settings] = await Promise.all([getOrdersByWorkspace(user.workspaceId), getSettings(user.workspaceId)]);
  const assignments = (settings.orderAssignments ?? {}) as OrderAssignments;
  const orders = rows.filter(order => user.role !== "agent" || !assignments[order.id] || assignments[order.id].agentId === user.id)
    .map(order => ({ ...order, assignedAgentId: assignments[order.id]?.agentId, assignedAgentName: assignments[order.id]?.agentName }));
  return NextResponse.json({ orders }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await request.json();
  const { customer, phone, city, address, product, amount, notes, source, quantity = 1 } = body;
  if (!customer || !phone || !product || !amount) {
    return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 });
  }

  if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: "La quantité doit être un entier supérieur ou égal à 1." }, { status: 400 });
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
    quantity,
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
  if (patch.quantity !== undefined && (typeof patch.quantity !== "number" || !Number.isSafeInteger(patch.quantity) || patch.quantity < 1)) {
    return NextResponse.json({ error: "La quantité doit être un entier supérieur ou égal à 1." }, { status: 400 });
  }
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
        const assignment = (settings.orderAssignments as OrderAssignments | undefined)?.[id];
        const agentId = assignment?.agentId ?? commission?.agentId;
        const agentName = assignment?.agentName ?? commission?.agentName;
        if (agentId && commission?.commissionAmount > 0) {
          const linked = (settings.orderCommissionRequests as Record<string, string> | undefined)?.[id];
          await supabase.from("crm_payment_requests").upsert({
            id: linked ?? commissionId(user.workspaceId, id),
            workspace_id: user.workspaceId,
            agent_id: agentId,
            agent_name: agentName,
            amount: commission.commissionAmount,
            message: `Commission · ${productName} · ${updated.orderNumber}`,
            status: "pending",
            created_at: new Date().toISOString(),
          }, { onConflict: "id", ignoreDuplicates: true });
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
