import { NextRequest, NextResponse } from "next/server";
import { getLeads, updateLead } from "@/lib/leadStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const leads = getLeads();
  return NextResponse.json({ leads, total: leads.length });
}

// PATCH to update a lead (callAttempts, recovered, notes)
export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { id, ...patch } = body as { id: string } & Record<string, unknown>;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  updateLead(id, patch);
  return NextResponse.json({ ok: true });
}
