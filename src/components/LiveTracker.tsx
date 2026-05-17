"use client";

/**
 * LiveTracker — pings /api/track every 30 s to register this browser session
 * as a live visitor. Added to customer-facing pages (/p/[id], /lp/[slug]).
 */

import { useEffect } from "react";

function getVisitorId(): string {
  const KEY = "codcrm_vid";
  // sessionStorage can throw in Facebook/Instagram in-app browsers
  try {
    let vid = sessionStorage.getItem(KEY);
    if (!vid) {
      vid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(KEY, vid);
    }
    return vid;
  } catch {
    try {
      let vid = localStorage.getItem(KEY);
      if (!vid) {
        vid = Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(KEY, vid);
      }
      return vid;
    } catch {
      return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  }
}

function getDevice(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

interface Props {
  page: string;
  pageTitle?: string;
  productId?: string;
  workspaceId?: string;
}

export default function LiveTracker({ page, pageTitle, productId, workspaceId }: Props) {
  useEffect(() => {
    const visitorId = getVisitorId();
    const device = getDevice();
    const referrer = document.referrer || "";
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get("utm_source") || urlParams.get("fbclid") ? "facebook" : "";

    function ping() {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, page, pageTitle, productId, workspaceId, referrer: utmSource || referrer, device }),
      }).catch(() => {});
    }

    ping();
    const t = setInterval(ping, 30_000);
    return () => clearInterval(t);
  }, [page, pageTitle, productId, workspaceId]);

  return null;
}
