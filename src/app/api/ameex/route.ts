import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { getSettings } from "@/lib/supabaseSettingsStore";

const BASE = "https://api.ameex.app/customer";

const ENDPOINTS: Record<string, { path: string; method: string }> = {
  addParcel:      { path: "/Delivery/Parcels/Action/Type/Add", method: "POST" },
  listParcels:        { path: "/Delivery/Parcels", method: "POST" },
  listParcelsDirect:  { path: "/Delivery/Parcels/Action/Type/List", method: "POST" },
  trackParcel:        { path: "/Delivery/Parcels/Track", method: "POST" },
  deliveryNote:   { path: "/Delivery/Parcels/Note", method: "GET" },
  pickupRequest:  { path: "/Pickup/Request", method: "POST" },
  cities:         { path: "/Delivery/Cities", method: "GET" },
  depots:         { path: "/Delivery/Depots", method: "GET" },
  stocks:         { path: "/Stock/Depots", method: "GET" },
  stockProducts:  { path: "/Stock/Products", method: "GET" },
  stockItems:     { path: "/Stock/Items", method: "GET" },
  cnfgApp:        { path: "/Cnfg/App", method: "POST" },
};

export async function POST(request: NextRequest) {
  const { action, apiId, apiKey, ...params } = await request.json();

  // For addParcel with STOCK type: ensure p_hub is always injected
  if (action === "addParcel" && params.type === "STOCK") {
    // Only inject if not already a valid numeric hub id
    const currentHub = String(params.p_hub ?? "").trim();
    const isValid = currentHub && /^\d+$/.test(currentHub);
    if (!isValid) {
      // Try reading from user's saved settings first
      let depotId = "";
      try {
        const user = await getRequestUser();
        if (user) {
          const settings = await getSettings(user.workspaceId);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          depotId = String((settings as any).ameex?.depotId ?? "").trim();
        }
      } catch { /* silent */ }
      // Always fall back to 34 (Casablanca Hub Principal) — confirmed from account JWT
      params.p_hub = /^\d+$/.test(depotId) ? depotId : "34";
    }
  }

  const ep = ENDPOINTS[action];
  if (!ep) return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

  const headers: Record<string, string> = {
    "C-Api-Id": apiId ?? "",
    "C-Api-Key": apiKey ?? "",
  };

  let url = `${BASE}${ep.path}`;
  let body: BodyInit | undefined;

  if (ep.method === "POST") {
    const fd = new FormData();
    // Add business = apiId by default if not set
    if (!params.business) params.business = apiId;
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
    }
    body = fd;
  } else {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    }
    if (qs.toString()) url += `?${qs}`;
  }

  try {
    const res = await fetch(url, { method: ep.method, headers, body });
    const text = await res.text();
    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      return NextResponse.json({ message: text, raw: true, status: res.status });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
