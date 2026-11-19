import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { getUsersByWorkspace } from "@/lib/authStore";
import { getOrdersByWorkspace } from "@/lib/supabaseOrderStore";
import { assignManualOrders, type OrderAssignments } from "@/lib/orderAssignment";
import { supabase } from "@/lib/supabase";

export async function PATCH(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin requis." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.orderIds) || body.orderIds.length > 1000
    || !body.orderIds.every((id: unknown) => typeof id === "string") || typeof body.agentId !== "string") {
    return NextResponse.json({ error: "Sélection invalide." }, { status: 400 });
  }
  const [users, orders, result] = await Promise.all([
    getUsersByWorkspace(user.workspaceId), getOrdersByWorkspace(user.workspaceId),
    supabase.from("crm_settings").select("settings").eq("workspace_id", user.workspaceId).maybeSingle(),
  ]);
  const agent = users.find(member => member.id === body.agentId && member.active && member.role === "agent");
  if (!agent) return NextResponse.json({ error: "Agent introuvable dans cette équipe." }, { status: 400 });
  if (result.error || !result.data) return NextResponse.json({ error: "Impossible de lire les affectations." }, { status: 503 });
  const settings = result.data.settings ?? {};
  const assignment = { agentId: agent.id, agentName: agent.name, assignedAt: new Date().toISOString() };
  const orderAssignments = assignManualOrders(orders, body.orderIds, settings.orderAssignments as OrderAssignments ?? {}, assignment);
  if (!orderAssignments) return NextResponse.json({ error: "Sélectionnez uniquement des commandes MAN de cette équipe." }, { status: 400 });
  // Compare-and-swap prevents overwriting concurrent settings or assignments.
  const { data, error } = await supabase.from("crm_settings")
    .update({ settings: { ...settings, orderAssignments } })
    .eq("workspace_id", user.workspaceId).eq("settings", JSON.stringify(settings)).select("workspace_id");
  if (error) return NextResponse.json({ error: "Impossible d’enregistrer les affectations." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "Les données ont changé. Réessayez." }, { status: 409 });
  return NextResponse.json({ ok: true, count: new Set(body.orderIds).size, assignment });
}
