import { NextRequest, NextResponse } from "next/server";
import { getLeadsByWorkspace, updateLead } from "@/lib/supabaseLeadStore";
import { getOrdersByWorkspace } from "@/lib/supabaseOrderStore";
import { getRequestUser } from "@/lib/getRequestUser";

export const dynamic = "force-dynamic";

// Normalize phone: strip spaces, dashes, leading +212 → 0
function normalizePhone(p: string) {
  let s = (p ?? "").replace(/[\s\-().]/g, "");
  if (s.startsWith("+212")) s = "0" + s.slice(4);
  if (s.startsWith("212") && s.length >= 12) s = "0" + s.slice(3);
  return s;
}

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const [leads, orders] = await Promise.all([
    getLeadsByWorkspace(user.workspaceId),
    getOrdersByWorkspace(user.workspaceId),
  ]);

  // Build set of order phone numbers
  const orderPhones = new Set(orders.map(o => normalizePhone(o.customerPhone)));

  // Auto-mark abandoned leads as recovered if their phone appears in orders
  const autoRecover = leads.filter(
    l => l.type === "abandoned" && !l.recovered && orderPhones.has(normalizePhone(l.phone))
  );

  // Persist auto-recoveries in background (don't await to keep response fast)
  for (const lead of autoRecover) {
    updateLead(lead.id, user.workspaceId, {
      recovered: true,
      notes: lead.notes || "Récupéré automatiquement — commande passée",
    }).catch(() => {});
  }

  // Return leads with auto-recovered flag applied immediately
  const autoRecoverIds = new Set(autoRecover.map(l => l.id));
  const finalLeads = leads.map(l =>
    autoRecoverIds.has(l.id)
      ? { ...l, recovered: true, notes: l.notes || "Récupéré automatiquement — commande passée" }
      : l
  );

  return NextResponse.json({ leads: finalLeads, total: finalLeads.length });
}

export async function PATCH(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, callAttempts, recovered, notes } = body as {
    id: string; callAttempts?: number; recovered?: boolean; notes?: string;
  };
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const updated = await updateLead(id, user.workspaceId, { callAttempts, recovered, notes });
  if (!updated) return NextResponse.json({ error: "Lead introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true, lead: updated });
}
