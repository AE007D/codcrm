import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { getSettings } from "@/lib/supabaseSettingsStore";

const BASE = "https://api.ameex.app/customer";

const ENDPOINTS: Record<string, { path: string; method: string }> = {
  addParcel:      { path: "/Delivery/Parcels/Action/Type/Add", method: "POST" },
  listParcels:    { path: "/Delivery/Parcels", method: "GET" },
  trackParcel:    { path: "/Delivery/Parcels/Track", method: "GET" },
  deliveryNote:   { path: "/Delivery/Parcels/Note", method: "GET" },
  pickupRequest:  { path: "/Pickup/Request", method: "POST" },
  cities:         { path: "/Delivery/Cities", method: "GET" },
  depots:         { path: "/Delivery/Depots", method: "GET" },
  stocks:         { path: "/Stock/Depots", method: "GET" },
  cnfgApp:        { path: "/Cnfg/App", method: "POST" },
};

export async function POST(request: NextRequest) {
  const { action, apiId, apiKey, ...params } = await request.json();

  // For addParcel with STOCK type: ensure p_hub is always set from saved settings
  if (action === "addParcel" && params.type === "STOCK" && !params.p_hub) {
    try {
      const user = await getRequestUser();
      if (user) {
        const settings = await getSettings(user.workspaceId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const depotId = (settings as any).ameex?.depotId;
        if (depotId) params.p_hub = depotId;
      }
    } catch { /* silent — proceed without p_hub */ }
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
