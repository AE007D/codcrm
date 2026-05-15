import { NextRequest, NextResponse } from "next/server";
import { updateOrderByTracking } from "@/lib/supabaseOrderStore";

export const dynamic = "force-dynamic";

// Ameex → CRM status mapping
const AMEEX_STATUS_MAP: Record<string, string> = {
  DELIVERED:    "livré",
  DISTRIBUTION: "expédié",   // out for delivery
  IN_PROGRESS:  "expédié",   // in transit
  RETURNED:     "retourné",
  RETURN:       "retourné",
  CANCELLED:    "annulé",
  CANCELED:     "annulé",
};

// POST /api/webhooks/ameex
// Ameex sends application/x-www-form-urlencoded with fields:
//   CODE, STATUT, STATUT_NAME, COMMENT, DATE, STATUT_S, STATUT_S_NAME
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    let code: string | undefined;
    let statut: string | undefined;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      code   = params.get("CODE")   ?? undefined;
      statut = params.get("STATUT") ?? undefined;
    } else {
      // Also accept JSON (useful for testing)
      const body = await request.json().catch(() => ({}));
      code   = body.CODE;
      statut = body.STATUT;
    }

    if (!code || !statut) {
      return NextResponse.json({ error: "Missing CODE or STATUT" }, { status: 400 });
    }

    const crmStatus = AMEEX_STATUS_MAP[statut.toUpperCase()];
    if (!crmStatus) {
      // Unknown status — acknowledge but don't update
      console.log(`Ameex webhook: unhandled status "${statut}" for ${code}`);
      return NextResponse.json({ ok: true, skipped: true });
    }

    const updated = await updateOrderByTracking(code, crmStatus);
    console.log(`Ameex webhook: ${code} → ${statut} → ${crmStatus} (updated: ${updated})`);

    return NextResponse.json({ ok: true, code, crmStatus });
  } catch (err) {
    console.error("Ameex webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
