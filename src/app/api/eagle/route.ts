import { NextRequest, NextResponse } from "next/server";

const BASE = "https://eagleexpress.ma";

// Actions that mutate data — send as POST (form-encoded) so PHP $_POST is populated
const POST_ACTIONS = new Set(["add", "edit"]);

// Proxy to avoid CORS — credentials come from client in POST body
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

  let fetchRes: Response;

  if (POST_ACTIONS.has(action)) {
    // Send as POST with URL-encoded body (standard PHP form submission)
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") body.set(k, String(v));
    }
    fetchRes = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { ...commonHeaders, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } else {
    // Read-only endpoints: use GET with query string
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    }
    fetchRes = await fetch(`${BASE}${path}?${qs.toString()}`, {
      headers: commonHeaders,
    });
  }

  try {
    const text = await fetchRes.text();
    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      return NextResponse.json({ message: text, raw: true });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
