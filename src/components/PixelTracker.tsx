"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { initFBPixel, initTTPixel, trackFBEvent, type PixelEntry } from "@/lib/pixelEvents";

function normalizePixels(s: Record<string, unknown>): PixelEntry[] {
  if (Array.isArray(s.pixels) && s.pixels.length > 0) {
    return s.pixels as PixelEntry[];
  }
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
        state.current.fetched = true;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!state.current.fetched) return;
    for (const p of state.current.pixels) {
      if (p.platform === "facebook") trackFBEvent("PageView");
      else if (p.platform === "tiktok" && window.ttq) window.ttq.page();
    }
  }, [pathname]);

  return null;
}
