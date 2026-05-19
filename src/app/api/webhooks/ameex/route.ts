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
    let statutSName: string | undefined;
    let statutName: string | undefined;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      code        = params.get("CODE")         ?? undefined;
      statut      = params.get("STATUT")       ?? undefined;
      statutSName = params.get("STATUT_S_NAME") ?? undefined;
      statutName  = params.get("STATUT_NAME")  ?? undefined;
    } else {
      const body = await request.json().catch(() => ({}));
      code        = body.CODE;
      statut      = body.STATUT;
      statutSName = body.STATUT_S_NAME;
      statutName  = body.STATUT_NAME;
    }

    if (!code || !statut) {
      return NextResponse.json({ error: "Missing CODE or STATUT" }, { status: 400 });
    }

    // Store the detailed carrier status name for display in the UI
    const carrierStatus = statutSName || statutName || statut;

    const crmStatus = AMEEX_STATUS_MAP[statut.toUpperCase()];
    if (!crmStatus) {
      // Unknown status — still save the carrier status, just don't change CRM status
      console.log(`Ameex webhook: unhandled status "${statut}" for ${code}`);
      await updateOrderByTracking(code, statut, carrierStatus).catch(() => {});
      return NextResponse.json({ ok: true, skipped: true });
    }

    const updated = await updateOrderByTracking(code, crmStatus, carrierStatus);
    console.log(`Ameex webhook: ${code} → ${statut} (${carrierStatus}) → ${crmStatus} (updated: ${updated})`);

    return NextResponse.json({ ok: true, code, crmStatus });
  } catch (err) {
    console.error("Ameex webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
