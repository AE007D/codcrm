import { NextRequest, NextResponse } from "next/server";

import { getRequestUser } from "@/lib/getRequestUser";
import { supabase } from "@/lib/supabase";

const BASE = "https://eagleexpress.ma";

export async function POST(request: NextRequest) {
  const { action, crmOrderId, ...params } = await request.json();

  const endpoints: Record<string, string> = {
    add:    "/addcolis.php",
    list:   "/colislist.php",
    track:  "/track.php",
    cities: "/cities.php",
    edit:   "/editstate.php",
  };

  const path = endpoints[action];
  if (!path) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  let workspaceId: string | undefined;
  if (action === "add" && crmOrderId !== undefined) {
    if (typeof crmOrderId !== "string" || !crmOrderId) {
      return NextResponse.json({ error: "Commande invalide." }, { status: 400 });
    }
    const user = await getRequestUser();
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    workspaceId = user.workspaceId;
    const { data: order, error } = await supabase
      .from("crm_orders")
      .select("eagle_shipped_at, carrier_tracking, carrier_name, status")
      .eq("workspace_id", workspaceId)
      .eq("id", crmOrderId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Impossible de vérifier la commande." }, { status: 503 });
    if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    if (order.eagle_shipped_at || (order.carrier_name === "eagle" && order.carrier_tracking
      && ["expédié", "livré", "retourné"].includes(order.status))) {
      return NextResponse.json({ error: "Cette commande a déjà été envoyée à Eagle Express." }, { status: 409 });
    }
  }

  const commonHeaders = {
    "Accept": "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://eagleexpress.ma/",
  };

  try {
    // Eagle Express API uses GET with all params in the query string for every endpoint
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    const sentKeys = [...qs.keys()];
    const url = `${BASE}${path}?${qs.toString()}`;
    console.log(`Eagle ${action} → GET ${path} — keys: ${sentKeys.join(", ")} — qs: ${qs.toString().replace(/sk=[^&]+/, "sk=***")}`);

    const fetchRes = await fetch(url, { method: "GET", headers: commonHeaders });
    const text = await fetchRes.text();

    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = { message: text, raw: true }; }

    const p = parsed as Record<string, unknown>;
    console.log(`Eagle ${action} ← HTTP ${fetchRes.status} — body: ${text.slice(0, 300)}`);
    if (p?.message && (String(p.message).toLowerCase().includes("missing") || String(p.message).toLowerCase().includes("empty"))) {
      return NextResponse.json({ ...p, _sentKeys: sentKeys, _rawBody: text.slice(0, 500) });
    }

    if (workspaceId && fetchRes.ok && p && typeof p === "object") {
      const tracking = p.code ?? p.CODE ?? p.tracking ?? p.barcode ?? p.id ?? p.parcel_id;
      const success = [p.message, p.status].some(value =>
        typeof value === "string" && /\bsuccess(?:ful|fully)?\b/i.test(value),
      );
      if (!p.error && (tracking != null || success)) {
        const { error } = await supabase.from("crm_orders").update({
          status: "expédié",
          carrier_name: "eagle",
          eagle_shipped_at: new Date().toISOString(),
          ...(tracking ? { carrier_tracking: String(tracking) } : {}),
        })
          .eq("workspace_id", workspaceId)
          .eq("id", crmOrderId)
          .is("eagle_shipped_at", null);
        return NextResponse.json({ ...p, crmShipmentSaved: !error });
      }
    }

    return NextResponse.json(parsed, { status: fetchRes.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
