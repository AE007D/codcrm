import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { getSettings, saveSettings } from "@/lib/supabaseSettingsStore";
import webpush from "web-push";

export const dynamic = "force-dynamic";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails("mailto:admin@codcrm.ma", VAPID_PUBLIC, VAPID_PRIVATE);
}

type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

// POST — save subscription for the current user's workspace
export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const sub: PushSub = await request.json();
  if (!sub?.endpoint) return NextResponse.json({ error: "Subscription invalide." }, { status: 400 });

  const settings = await getSettings(user.workspaceId);
  const existing: PushSub[] = Array.isArray(settings.pushSubscriptions)
    ? (settings.pushSubscriptions as PushSub[])
    : [];

  // Deduplicate by endpoint
  const updated = [...existing.filter(s => s.endpoint !== sub.endpoint), sub];
  await saveSettings(user.workspaceId, { pushSubscriptions: updated });

  return NextResponse.json({ ok: true });
}

// DELETE — remove subscription
export async function DELETE(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { endpoint } = await request.json();
  const settings = await getSettings(user.workspaceId);
  const existing: PushSub[] = Array.isArray(settings.pushSubscriptions)
    ? (settings.pushSubscriptions as PushSub[])
    : [];

  await saveSettings(user.workspaceId, {
    pushSubscriptions: existing.filter(s => s.endpoint !== endpoint),
  });

  return NextResponse.json({ ok: true });
}

// Internal helper — exported for use in order handlers
export async function sendPushToWorkspace(
  workspaceId: string,
  payload: { title: string; body: string; url?: string; tag?: string }
) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const settings = await getSettings(workspaceId);
  const subs: PushSub[] = Array.isArray(settings.pushSubscriptions)
    ? (settings.pushSubscriptions as PushSub[])
    : [];

  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(sub as webpush.PushSubscription, JSON.stringify(payload))
    )
  );
}
