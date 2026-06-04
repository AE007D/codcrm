import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { getSettings, saveSettings } from "@/lib/supabaseSettingsStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const settings = await getSettings(user.workspaceId);
  return NextResponse.json({ whatsapp: settings.whatsapp ?? {} });
}

export async function POST(req: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await req.json();
  await saveSettings(user.workspaceId, { whatsapp: body });
  return NextResponse.json({ ok: true });
}
