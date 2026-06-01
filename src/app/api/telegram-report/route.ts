import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { getSettings } from "@/lib/supabaseSettingsStore";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const settings = await getSettings(user.workspaceId);
  const tg = (settings as Record<string, unknown>)?.telegram as { botToken?: string; chatId?: string } | undefined;

  if (!tg?.botToken || !tg?.chatId) {
    return NextResponse.json({ error: "Telegram non configuré. Ajoutez botToken et chatId dans Intégrations." }, { status: 400 });
  }

  // Accept pre-built message or build from stats body
  let text: string;
  try {
    const body = await request.json() as { message?: string };
    text = body.message ?? "";
  } catch {
    text = "";
  }

  if (!text) return NextResponse.json({ error: "Message vide." }, { status: 400 });

  const tgRes = await fetch(`https://api.telegram.org/bot${tg.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: tg.chatId, text, parse_mode: "HTML" }),
  });

  const tgData = await tgRes.json() as { ok: boolean; description?: string };
  if (!tgData.ok) {
    return NextResponse.json({ error: tgData.description ?? "Erreur Telegram" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
