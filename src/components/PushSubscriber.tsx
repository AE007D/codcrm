"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export default function PushSubscriber() {
  const [showBanner, setShowBanner] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(async (reg) => {
        const existing = await reg.pushManager.getSubscription();
        if (existing) { setSubscribed(true); return; }
        // Only show banner for authenticated users (no error = logged in)
        const me = await fetch("/api/auth/me");
        if (me.ok) setShowBanner(true);
      })
      .catch(() => {});
  }, []);

  async function subscribe() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setSubscribed(true);
      setShowBanner(false);
    } catch { /* user denied or error */ setShowBanner(false); }
  }

  if (!showBanner || subscribed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm bg-slate-900 text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
      <span className="text-xl shrink-0">🔔</span>
      <p className="text-sm flex-1 leading-snug">Activez les notifications pour recevoir les nouvelles commandes instantanément.</p>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => setShowBanner(false)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1">Plus tard</button>
        <button onClick={subscribe} className="text-xs font-bold bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-xl transition-colors">Activer</button>
      </div>
    </div>
  );
}
