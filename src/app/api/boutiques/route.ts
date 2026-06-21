import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { getSettings } from "@/lib/supabaseSettingsStore";

export const dynamic = "force-dynamic";

type Store = { id: number; name: string; logo?: string; city?: string; phone?: string; manager?: string; shippingMode?: string; status?: string };

// Returns boutique names extracted from the Store[] saved by /boutiques page
export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const settings = await getSettings(user.workspaceId);
  const raw = settings.boutiques;
  let names: string[] = [];

  if (Array.isArray(raw)) {
    names = raw
      .map(b => (typeof b === "object" && b !== null ? (b as Store).name : String(b)))
      .filter(Boolean);
  }

  return NextResponse.json({ boutiques: names }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } });
}

// POST/DELETE kept for backward compat but boutiques page manages its own list
export async function POST(request: NextRequest) {
  void request;
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  void request;
  return NextResponse.json({ ok: true });
}
