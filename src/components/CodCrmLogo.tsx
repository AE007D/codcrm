"use client";

import { useId } from "react";

/**
 * COD CRM brand logo mark.
 * Visual: C (for COD) + ✓ (delivery confirmed) on a blue→violet gradient background.
 * Tagline: "Commandez. Expédiez. Encaissez."
 */
export function CodCrmLogo({ size = 36 }: { size?: number }) {
  const uid = useId();
  const gid = `codcrm-g-${uid.replace(/:/g, "")}`;

  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-label="COD CRM">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="36" height="36" rx="10" fill={`url(#${gid})`} />

      {/* C shape — 270° arc, opens to the right */}
      <path
        d="M24 12 A9 9 0 1 0 24 24"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Check mark — nestled inside the C */}
      <path
        d="M11 18 L14.5 22 L20 14"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Full logo lockup — icon + wordmark */
export function CodCrmWordmark({
  size = 36,
  dark = false,
}: {
  size?: number;
  dark?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <CodCrmLogo size={size} />
      <div className="flex-1 min-w-0 leading-none">
        <span
          className={`block font-extrabold tracking-tight ${
            dark ? "text-white" : "text-slate-900"
          }`}
          style={{ fontSize: size * 0.44, lineHeight: 1 }}
        >
          COD CRM
        </span>
        <span
          className={`block mt-0.5 font-medium ${
            dark ? "text-blue-300/80" : "text-slate-400"
          }`}
          style={{ fontSize: size * 0.28, lineHeight: 1.2 }}
        >
          Commandez. Expédiez. Encaissez.
        </span>
      </div>
    </div>
  );
}
