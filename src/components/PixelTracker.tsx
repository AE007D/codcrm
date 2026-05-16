"use client";

/**
 * PixelTracker — loads Facebook Pixel & TikTok Pixel on every authenticated page.
 * Pixel IDs are fetched from the workspace settings (/api/settings).
 * Page-view events fire automatically on each SPA route change.
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [k: string]: any;
    };
    TiktokAnalyticsObject?: string;
  }
}

// Module-level flags so pixels are only injected once per browser session
let fbLoaded = false;
let ttLoaded = false;

function injectFBPixel(pixelId: string) {
  if (fbLoaded || typeof window === "undefined") return;
  fbLoaded = true;

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

  window.fbq!("init", pixelId);
  window.fbq!("track", "PageView");
}

function injectTTPixel(pixelId: string) {
  if (ttLoaded || typeof window === "undefined") return;
  ttLoaded = true;

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

  window.ttq!.load(pixelId);
  window.ttq!.page();
}

export default function PixelTracker() {
  const pathname = usePathname();
  const state = useRef({ fbId: "", ttId: "", fetched: false });

  // Fetch workspace pixel IDs once on mount, then init pixels
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const s = data?.settings ?? {};
        state.current.fbId = s.facebookPixelId ?? "";
        state.current.ttId = s.tiktokPixelId ?? "";
        state.current.fetched = true;

        if (state.current.fbId) injectFBPixel(state.current.fbId);
        if (state.current.ttId) injectTTPixel(state.current.ttId);
      })
      .catch(() => {
        state.current.fetched = true; // not authenticated — skip silently
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track SPA navigation — fires on every route change after initial load
  useEffect(() => {
    if (!state.current.fetched) return; // pixels not ready yet
    if (state.current.fbId && window.fbq) window.fbq("track", "PageView");
    if (state.current.ttId && window.ttq) window.ttq.page();
  }, [pathname]);

  return null; // renders nothing — side-effects only
}
