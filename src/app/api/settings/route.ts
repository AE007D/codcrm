import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { getSettings, saveSettings, UserSettings } from "@/lib/supabaseSettingsStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const settings = await getSettings(user.workspaceId);
  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  let body: Partial<UserSettings>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const settings = await saveSettings(user.workspaceId, body);
  return NextResponse.json({ ok: true, settings });
}
