import { NextRequest, NextResponse } from "next/server";

const BASE = "https://eagleexpress.ma";

// Proxy to avoid CORS — credentials come from client in POST body
export async function POST(request: NextRequest) {
  const { action, ...params } = await request.json();

  const endpoints: Record<string, string> = {
    add: "/addcolis.php",
    list: "/colislist.php",
    track: "/track.php",
    cities: "/cities.php",
    edit: "/editstate.php",
  };

  const path = endpoints[action];
  if (!path) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }

  try {
    const res = await fetch(`${BASE}${path}?${qs.toString()}`, {
      headers: { "Accept": "application/json, text/plain, */*" },
      // Eagle uses GET with query params
    });
    const text = await res.text();
    // Try JSON parse, else wrap as message
    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      return NextResponse.json({ message: text, raw: true });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
