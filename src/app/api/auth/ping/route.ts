import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { getSettings, saveSettings } from "@/lib/supabaseSettingsStore";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  // Store presence in settings JSON — no extra DB column needed
  const settings = await getSettings(user.workspaceId);
  const presence = (settings.presence as Record<string, string>) ?? {};
  presence[user.id] = new Date().toISOString();
  await saveSettings(user.workspaceId, { presence });

  return NextResponse.json({ ok: true });
}
