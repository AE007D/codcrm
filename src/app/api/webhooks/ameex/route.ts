import { NextRequest, NextResponse } from "next/server";
import { updateOrderByTracking, updateCarrierStatusOnly } from "@/lib/supabaseOrderStore";
import { storeDebugPayload } from "@/app/api/webhook-debug/route";

export const dynamic = "force-dynamic";

// Statuses that change the CRM status field
const AMEEX_STATUS_MAP: Record<string, string> = {
  DELIVERED:        "livré",
  DISTRIBUTION:     "expédié",
  IN_PROGRESS:      "expédié",
  PICKED_UP:        "expédié",
  COLLECTED:        "expédié",
  RAMASSE:          "expédié",
  RETURNED:         "retourné",
  RETURN:           "retourné",
  RETURN_PROGRESS:  "retourné",
  CANCELLED:        "annulé",
  CANCELED:         "annulé",
};

// Intermediate statuses — only update carrier_status, keep CRM status unchanged
const AMEEX_INTERMEDIATE = new Set([
  "PAS_REPONSE", "ABSENT", "REPORTED", "POSTPONED", "REPORTEE",
  "EN_TRANSIT", "TENTATIVE", "NOT_DELIVERED", "FAILED_DELIVERY",
  "LIVRAISON", "EN_COURS", "AVIS_DE_PASSAGE",
]);

// POST /api/webhooks/ameex
// Ameex sends application/x-www-form-urlencoded with fields:
//   CODE, STATUT, STATUT_NAME, COMMENT, DATE, STATUT_S, STATUT_S_NAME
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    let code: string | undefined;
    let statut: string | undefined;
    let statutS: string | undefined;
    let statutSName: string | undefined;
    let statutName: string | undefined;
    let comment: string | undefined;
    let date: string | undefined;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      code        = params.get("CODE")          ?? undefined;
      statut      = params.get("STATUT")        ?? undefined;
      statutS     = params.get("STATUT_S")      ?? undefined;
      statutSName = params.get("STATUT_S_NAME") ?? undefined;
      statutName  = params.get("STATUT_NAME")   ?? undefined;
      comment     = params.get("COMMENT")       ?? undefined;
      date        = params.get("DATE")          ?? undefined;
    } else {
      const body = await request.json().catch(() => ({}));
      code        = body.CODE;
      statut      = body.STATUT;
      statutS     = body.STATUT_S;
      statutSName = body.STATUT_S_NAME;
      statutName  = body.STATUT_NAME;
      comment     = body.COMMENT;
      date        = body.DATE;
    }

    storeDebugPayload({ source: "ameex", code, statut, statutS, statutName, statutSName, comment, date });

    if (!code || !statut) {
      return NextResponse.json({ error: "Missing CODE or STATUT" }, { status: 400 });
    }

    // Combine STATUT_NAME + STATUT_S_NAME for full visibility
    // e.g. "En cours — Pas de réponse" or just "Livré"
    const parts = [statutName, statutSName].filter(Boolean);
    const carrierStatus = parts.length > 1 && statutName !== statutSName
      ? parts.join(" — ")
      : (statutName || statutSName || statut);
    const statutUp = statut.toUpperCase();

    const crmStatus = AMEEX_STATUS_MAP[statutUp];

    if (crmStatus) {
      // Known status → update both CRM status and carrier_status
      const updated = await updateOrderByTracking(code, crmStatus, carrierStatus);
      if (!updated) {
        console.warn(`Ameex webhook: NO ORDER FOUND with carrier_tracking="${code}" — ${crmStatus} not applied`);
      } else {
        console.log(`Ameex webhook: ${code} → ${statut} (${carrierStatus}) → ${crmStatus} ✓`);
      }
      return NextResponse.json({ ok: true, code, crmStatus });
    }

    if (AMEEX_INTERMEDIATE.has(statutUp)) {
      // Intermediate status (Pas de réponse, Absent…) → only update carrier_status
      const updated = await updateCarrierStatusOnly(code, carrierStatus);
      console.log(`Ameex webhook: ${code} → intermediate "${statut}" (${carrierStatus}) — carrier_status updated: ${updated}`);
      return NextResponse.json({ ok: true, code, intermediate: true, carrierStatus });
    }

    // Completely unknown status → only update carrier_status, never touch CRM status
    console.log(`Ameex webhook: unknown status "${statut}" for code="${code}" — saving carrier_status only`);
    await updateCarrierStatusOnly(code, carrierStatus);
    return NextResponse.json({ ok: true, skipped: true });

  } catch (err) {
    console.error("Ameex webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
