import { NextRequest, NextResponse } from "next/server";

const BASE = "https://eagleexpress.ma";

export async function POST(request: NextRequest) {
  const { action, ...params } = await request.json();

  const endpoints: Record<string, string> = {
    add:    "/addcolis.php",
    list:   "/colislist.php",
    track:  "/track.php",
    cities: "/cities.php",
    edit:   "/editstate.php",
  };

  const path = endpoints[action];
  if (!path) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

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

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
