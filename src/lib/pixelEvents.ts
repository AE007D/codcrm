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

const fbInitialized = new Set<string>();
const ttInitialized = new Set<string>();
let fbSdkInjected = false;
let ttSdkInjected = false;

export function injectFBSdk() {
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

export function initFBPixel(pixelId: string) {
  if (fbInitialized.has(pixelId) || typeof window === "undefined") return;
  injectFBSdk();
  fbInitialized.add(pixelId);
  window.fbq!("init", pixelId);
  window.fbq!("track", "PageView");
}

export function trackFBEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", event, params);
}

export function injectTTSdk() {
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

export function initTTPixel(pixelId: string) {
  if (ttInitialized.has(pixelId) || typeof window === "undefined") return;
  injectTTSdk();
  ttInitialized.add(pixelId);
  window.ttq!.load(pixelId);
  window.ttq!.page();
}

export function trackTTEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.ttq) return;
  window.ttq.track(event, params);
}

export type PixelEntry = {
  pixelId: string;
  platform: "facebook" | "tiktok";
  productName: string;
};

export function initPixels(pixels: PixelEntry[]) {
  for (const p of pixels) {
    if (p.platform === "facebook") initFBPixel(p.pixelId);
    else if (p.platform === "tiktok") initTTPixel(p.pixelId);
  }
}
