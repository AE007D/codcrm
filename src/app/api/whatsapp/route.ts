import { NextRequest, NextResponse } from "next/server";

const WA_SERVER = process.env.WA_SERVER_URL ?? "http://127.0.0.1:3001";
const WA_TOKEN = process.env.WA_INTERNAL_TOKEN ?? "";

function getCrmUrl(req: NextRequest) {
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127") ? "http" : "https";
  return `${proto}://${host}`;
}

function waFetch(path: string, init?: RequestInit) {
  return fetch(`${WA_SERVER}${path}`, { ...init, signal: AbortSignal.timeout(8000) });
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const action = searchParams.get("action");
  const phone = searchParams.get("phone");

  try {
    if (action === "conversations") {
      const r = await waFetch("/conversations", { cache: "no-store" });
      return NextResponse.json(await r.json());
    }
    if (action === "messages" && phone) {
      const r = await waFetch(`/messages/${encodeURIComponent(phone)}`, { cache: "no-store" });
      return NextResponse.json(await r.json());
    }
    if (action === "pending") {
      const r = await waFetch("/pending", { cache: "no-store" });
      return NextResponse.json(await r.json());
    }
    const r = await waFetch("/status", { cache: "no-store" });
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({ status: "disconnected", jid: null, qr: null, error: "WA server unreachable" });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === "logout") {
    try {
      await waFetch("/logout", { method: "POST" });
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ ok: false, error: "WA server unreachable" }, { status: 503 });
    }
  }

  if (body.action === "send-confirm") {
    const { phone, message, orderId, imageUrl } = body;
    if (!phone || !message || !orderId)
      return NextResponse.json({ ok: false, error: "phone, message, orderId required" }, { status: 400 });
    try {
      const r = await waFetch("/send-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          bodyText: message,
          orderId,
          imageUrl: imageUrl || null,
          crmUrl: getCrmUrl(req),
          apiToken: WA_TOKEN,
        }),
      });
      return NextResponse.json(await r.json(), { status: r.status });
    } catch {
      return NextResponse.json({ ok: false, error: "WA server unreachable" }, { status: 503 });
    }
  }

  if (body.action === "send-media") {
    const { phone, mimetype, data, caption } = body;
    if (!phone || !mimetype || !data)
      return NextResponse.json({ ok: false, error: "phone, mimetype, data required" }, { status: 400 });
    try {
      const r = await waFetch("/send-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, mimetype, data, caption }),
      });
      return NextResponse.json(await r.json(), { status: r.status });
    } catch {
      return NextResponse.json({ ok: false, error: "WA server unreachable" }, { status: 503 });
    }
  }

  const { phone, message } = body;
  if (!phone || !message) return NextResponse.json({ ok: false, error: "phone + message required" }, { status: 400 });
  try {
    const r = await waFetch("/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
    });
    return NextResponse.json(await r.json(), { status: r.status });
  } catch {
    return NextResponse.json({ ok: false, error: "WA server unreachable" }, { status: 503 });
  }
}
