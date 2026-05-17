import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { getSettings, saveSettings } from "@/lib/supabaseSettingsStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const settings = await getSettings(user.workspaceId);
  const boutiques: string[] = Array.isArray(settings.boutiques) ? settings.boutiques : [];
  return NextResponse.json({ boutiques });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nom requis." }, { status: 400 });

  const settings = await getSettings(user.workspaceId);
  const boutiques: string[] = Array.isArray(settings.boutiques) ? settings.boutiques : [];
  const trimmed = String(name).trim();
  if (boutiques.includes(trimmed)) return NextResponse.json({ boutiques });
  const updated = [...boutiques, trimmed];
  await saveSettings(user.workspaceId, { boutiques: updated });
  return NextResponse.json({ boutiques: updated });
}

export async function DELETE(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const { name } = await request.json();

  const settings = await getSettings(user.workspaceId);
  const boutiques: string[] = Array.isArray(settings.boutiques) ? settings.boutiques : [];
  const updated = boutiques.filter(b => b !== name);
  await saveSettings(user.workspaceId, { boutiques: updated });
  return NextResponse.json({ boutiques: updated });
}
