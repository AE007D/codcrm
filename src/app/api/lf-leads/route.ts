import { NextRequest, NextResponse } from "next/server";
import { getLeadsByWorkspace, updateLead } from "@/lib/supabaseLeadStore";
import { getRequestUser } from "@/lib/getRequestUser";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const leads = await getLeadsByWorkspace(user.workspaceId);
  return NextResponse.json({ leads, total: leads.length });
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
