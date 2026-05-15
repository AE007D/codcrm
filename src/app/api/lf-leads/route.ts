import { NextRequest, NextResponse } from "next/server";
import { getLeads, updateLead } from "@/lib/leadStore";
import { getRequestUser } from "@/lib/getRequestUser";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const leads = getLeads(user.workspaceId);
  return NextResponse.json({ leads, total: leads.length });
}

// PATCH to update a lead (callAttempts, recovered, notes)
export async function PATCH(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { id, ...patch } = body as { id: string } & Record<string, unknown>;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  // Only allow updating a lead that belongs to this user
  const leads = getLeads(user.workspaceId);
  if (!leads.find(l => l.id === id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  updateLead(id, patch);
  return NextResponse.json({ ok: true });
}
