import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// GET — agents see their own, admins see all workspace requests
export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  let query = supabase
    .from("crm_payment_requests")
    .select("*")
    .eq("workspace_id", user.workspaceId)
    .order("created_at", { ascending: false });

  if (user.role === "agent") {
    query = query.eq("agent_id", user.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] }, { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } });
}

// POST — agent submits a payment request
export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await request.json();
  const { amount, message } = body;
  if (!amount || parseFloat(amount) <= 0) {
    return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("crm_payment_requests")
    .insert({
      id: crypto.randomUUID(),
      workspace_id: user.workspaceId,
      agent_id: user.id,
      agent_name: user.name,
      amount: parseFloat(amount),
      message: String(message ?? ""),
      status: "pending",
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, request: data });
}

// PATCH — admin marks a request as paid/rejected
export async function PATCH(request: NextRequest) {
  const user = await getRequestUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin requis." }, { status: 403 });
  }

  const body = await request.json();
  const { id, status } = body;
  if (!id || !["paid", "rejected", "pending"].includes(status)) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("crm_payment_requests")
    .update({ status })
    .eq("id", id)
    .eq("workspace_id", user.workspaceId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, request: data });
}
