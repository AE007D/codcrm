"use client";

/**
 * PixelTracker — loads all configured Facebook & TikTok pixels on every authenticated page.
 * Pixel configs are fetched from /api/settings (settings.pixels array).
 * Falls back to legacy facebookPixelId / tiktokPixelId keys for backward compat.
 * PageView/page() events fire automatically on each SPA route change.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fbq?: (...args: any[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _fbq?: any;
    ttq?: {
      load(id: string): void;
      page(): void;
      track(event: string, params?: Record<string, unknown>): void;
      instance(id: string): { page(): void; track(event: string, params?: Record<string, unknown>): void };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [k: string]: any;
    };
    TiktokAnalyticsObject?: string;
  }
}

export type PixelEntry = {
  pixelId: string;
  platform: "facebook" | "tiktok";
  productName: string;
};

// Module-level Sets — track which pixel IDs are already injected
const fbInitialized = new Set<string>();
const ttInitialized = new Set<string>();

// Track whether the FB SDK script and TT SDK script have been injected
let fbSdkInjected = false;
let ttSdkInjected = false;

function injectFBSdk() {
  if (fbSdkInjected || typeof window === "undefined") return;
  fbSdkInjected = true;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

function initFBPixel(pixelId: string) {
  if (fbInitialized.has(pixelId) || typeof window === "undefined") return;
  injectFBSdk();
  fbInitialized.add(pixelId);
  window.fbq!("init", pixelId);
  window.fbq!("track", "PageView");
}

function injectTTSdk() {
  if (ttSdkInjected || typeof window === "undefined") return;
  ttSdkInjected = true;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  (function (w: any, d: any, t: any) {
    w.TiktokAnalyticsObject = t;
    const ttq: any = (w[t] = w[t] || []);
    ttq.methods = [
      "page", "track", "identify", "instances", "debug", "on",
      "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie",
    ];
    ttq.setAndDefer = function (obj: any, method: any) {
      obj[method] = function () {
        obj.push([method].concat(Array.prototype.slice.call(arguments, 0)));
      };
    };
    for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.instance = function (id: any) {
      const inst: any = ttq._i[id] || [];
      for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(inst, ttq.methods[n]);
      return inst;
    };
    ttq.load = function (e: any, n: any) {
      const src = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {};
      ttq._i[e] = [];
      ttq._i[e]._u = src;
      ttq._t = ttq._t || {};
      ttq._t[e] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[e] = n || {};
      const o = d.createElement("script");
      o.type = "text/javascript";
      o.async = true;
      o.src = src + "?sdkid=" + e + "&lib=" + t;
      const s = d.getElementsByTagName("script")[0];
      s.parentNode.insertBefore(o, s);
    };
  })(window, document, "ttq");
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

function initTTPixel(pixelId: string) {
  if (ttInitialized.has(pixelId) || typeof window === "undefined") return;
  injectTTSdk();
  ttInitialized.add(pixelId);
  window.ttq!.load(pixelId);
  window.ttq!.page();
}

function normalizePixels(s: Record<string, unknown>): PixelEntry[] {
  // New format
  if (Array.isArray(s.pixels) && s.pixels.length > 0) {
    return s.pixels as PixelEntry[];
  }
  // Legacy backward compat
  const entries: PixelEntry[] = [];
  if (s.facebookPixelId && typeof s.facebookPixelId === "string") {
    entries.push({ pixelId: s.facebookPixelId, platform: "facebook", productName: "" });
  }
  if (s.tiktokPixelId && typeof s.tiktokPixelId === "string") {
    entries.push({ pixelId: s.tiktokPixelId, platform: "tiktok", productName: "" });
  }
  return entries;
}

export default function PixelTracker() {
  const pathname = usePathname();
  const state = useRef<{ pixels: PixelEntry[]; fetched: boolean }>({ pixels: [], fetched: false });

  // Fetch workspace pixel configs once on mount, then init all pixels
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const s: Record<string, unknown> = data?.settings ?? {};
        state.current.pixels = normalizePixels(s);
        state.current.fetched = true;

        for (const p of state.current.pixels) {
          if (p.platform === "facebook") initFBPixel(p.pixelId);
          else if (p.platform === "tiktok") initTTPixel(p.pixelId);
        }
      })
      .catch(() => {
        state.current.fetched = true; // not authenticated — skip silently
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track SPA navigation — fires on every route change after initial load
  useEffect(() => {
    if (!state.current.fetched) return;
    for (const p of state.current.pixels) {
      if (p.platform === "facebook" && window.fbq) {
        window.fbq("track", "PageView");
      } else if (p.platform === "tiktok" && window.ttq) {
        window.ttq.page();
      }
    }
  }, [pathname]);

  return null; // renders nothing — side-effects only
}
