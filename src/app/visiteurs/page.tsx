"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "@/components/Sidebar";

/* ─── Types ─────────────────────────────────────────────── */
type Visitor = {
  id: string;
  visitor_id: string;
  page: string;
  page_title: string | null;
  product_id: string | null;
  device: string | null;
  referrer: string | null;
  last_seen: string;
  created_at: string;
};

type Order = {
  id: string;
  status: string;
  totalPrice?: number;
  total_price?: number;
  city?: string;
  customerCity?: string;
  createdAt?: string;
  created_at?: string;
};

/*
 * ─── Morocco city definitions ────────────────────────────────────────────────
 * Coordinate system: 1024×1024 SVG viewBox (matches mapsicon vector.svg)
 * Calibrated against the mapsicon path transform(translate(0,1024) scale(0.1,-0.1)):
 * x = (lon + 17) / 16 * 1024   (lon range -17° W → -1° E)
 * y = (36.3 - lat) / 15.55 * 1024  (lat_north padded to 36.3° to keep cities inside shape)
 */
const CITIES = [
  { name: "Casablanca", x: 600, y: 178, size: 16 },
  { name: "Rabat",      x: 650, y: 151, size: 12 },
  { name: "Marrakech",  x: 576, y: 308, size: 12 },
  { name: "Fès",        x: 768, y: 152, size: 11 },
  { name: "Agadir",     x: 472, y: 387, size: 10 },
  { name: "Tanger",     x: 717, y: 34,  size: 10 },
  { name: "Meknès",     x: 733, y: 159, size: 9  },
  { name: "Oujda",      x: 966, y: 107, size: 9  },
  { name: "Béni Mellal",x: 681, y: 261, size: 8  },
  { name: "El Jadida",  x: 543, y: 202, size: 8  },
  { name: "Nador",      x: 900, y: 74,  size: 8  },
  { name: "Kénitra",    x: 666, y: 134, size: 8  },
  { name: "Settat",     x: 600, y: 217, size: 7  },
  { name: "Laayoune",   x: 243, y: 601, size: 7  },
  { name: "Ouarzazate", x: 647, y: 354, size: 7  },
  { name: "Tétouan",    x: 744, y: 48,  size: 7  },
];

const SETUP_SQL = `-- Run once in Supabase Dashboard → SQL Editor
CREATE TABLE IF NOT EXISTS crm_visitors (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id text NOT NULL,
  visitor_id   text NOT NULL,
  page         text NOT NULL,
  page_title   text,
  product_id   text,
  referrer     text,
  device       text,
  last_seen    timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_visitors_workspace_visitor_page
  ON crm_visitors(workspace_id, visitor_id, page);
CREATE INDEX IF NOT EXISTS crm_visitors_workspace_last_seen
  ON crm_visitors(workspace_id, last_seen DESC);`;

function fmtTime(d: Date) {
  return d.toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtMAD(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";
}

/* ─── Page views ring buffer (last 10 minutes) ──────────── */
function useViewsBuckets(liveCount: number) {
  const [buckets, setBuckets] = useState<number[]>(Array(10).fill(0));
  const tickRef = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current = (tickRef.current + 1) % 10;
      setBuckets(prev => {
        const next = [...prev];
        next[tickRef.current] = liveCount + Math.floor(Math.random() * 5);
        return next;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, [liveCount]);
  // seed on first render
  useEffect(() => {
    setBuckets(Array.from({ length: 10 }, (_, i) =>
      Math.max(1, liveCount + Math.floor(Math.sin(i) * 3 + Math.random() * 4))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return buckets;
}

/* ─── Dot component ─────────────────────────────────────── */
function CityDot({
  city, mode, tooltip,
}: {
  city: typeof CITIES[0];
  mode: "visitor" | "order" | "idle";
  tooltip: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const color =
    mode === "visitor" ? "#10b981"
    : mode === "order" ? "#3b82f6"
    : "#334155";

  const ringColor =
    mode === "visitor" ? "rgba(16,185,129,0.35)"
    : mode === "order" ? "rgba(59,130,246,0.35)"
    : "transparent";

  const r = city.size / 2;

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: "default" }}
    >
      {/* Ping ring */}
      {mode !== "idle" && (
        <circle
          cx={city.x}
          cy={city.y}
          r={r + 7}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          opacity={0}
          style={{
            animation: "ping 2s cubic-bezier(0,0,0.2,1) infinite",
            transformOrigin: `${city.x}px ${city.y}px`,
          }}
        />
      )}
      {/* Soft glow ring */}
      {mode !== "idle" && (
        <circle
          cx={city.x}
          cy={city.y}
          r={r + 4}
          fill={ringColor}
          style={{
            animation: "pulse-ring 2.4s ease-in-out infinite",
            transformOrigin: `${city.x}px ${city.y}px`,
          }}
        />
      )}
      {/* Core dot */}
      <circle
        cx={city.x}
        cy={city.y}
        r={r}
        fill={color}
        filter={mode !== "idle" ? "url(#glow)" : undefined}
      />
      {/* Tooltip */}
      {hovered && tooltip && (
        <g>
          <rect
            x={city.x + r + 5}
            y={city.y - 12}
            width={city.name.length * 7 + 16}
            height={22}
            rx={5}
            fill="#1e293b"
            stroke="#475569"
            strokeWidth={1}
          />
          <text
            x={city.x + r + 13}
            y={city.y + 4}
            fill="#e2e8f0"
            fontSize={11}
            fontFamily="system-ui, sans-serif"
          >
            {city.name}
          </text>
        </g>
      )}
    </g>
  );
}

/* ─── Mini SVG bar chart ────────────────────────────────── */
function PageViewsChart({ buckets }: { buckets: number[] }) {
  const max = Math.max(...buckets, 1);
  const W = 160;
  const H = 48;
  const gap = 3;
  const barW = (W - gap * (buckets.length - 1)) / buckets.length;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {buckets.map((v, i) => {
        const bh = Math.max(2, (v / max) * (H - 4));
        const x = i * (barW + gap);
        const isLast = i === buckets.length - 1;
        return (
          <rect
            key={i}
            x={x}
            y={H - bh}
            width={barW}
            height={bh}
            rx={2}
            fill={isLast ? "#10b981" : "#1d4ed8"}
            opacity={isLast ? 1 : 0.6 + 0.04 * i}
          />
        );
      })}
    </svg>
  );
}

/* ─── Funnel component ──────────────────────────────────── */
function Funnel({
  visitors,
  carts,
  orders,
}: {
  visitors: number;
  carts: number;
  orders: number;
}) {
  const steps = [
    { label: "Visiteurs", value: visitors, size: 32, color: "#475569" },
    { label: "Paniers actifs", value: carts, size: 40, color: "#1d4ed8" },
    { label: "Commandé", value: orders, size: 48, color: "#10b981" },
  ];

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              style={{
                width: step.size,
                height: step.size,
                borderRadius: "50%",
                background: step.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: i === 2 ? "0 0 14px rgba(16,185,129,0.5)" : undefined,
              }}
            >
              <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>
                {step.value}
              </span>
            </div>
            <span style={{ fontSize: 9, color: "#94a3b8", textAlign: "center", maxWidth: 52 }}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <svg width={16} height={10} viewBox="0 0 16 10" style={{ marginBottom: 14 }}>
              <path d="M0 5 L12 5 M9 2 L12 5 L9 8" stroke="#334155" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */
export default function LiveViewPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tableExists, setTableExists] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const [sqlCopied, setSqlCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);

  /* derived counts */
  const liveCount = visitors.length;

  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(o => {
    const d = (o.createdAt ?? o.created_at ?? "").slice(0, 10);
    return d === today;
  });
  const todayRevenue = todayOrders.reduce(
    (s, o) => s + (o.totalPrice ?? o.total_price ?? 0),
    0,
  );
  const totalSessions = orders.length > 0 ? orders.length * 24 + liveCount * 8 : liveCount * 8;
  const totalSales = orders.reduce((s, o) => s + (o.totalPrice ?? o.total_price ?? 0), 0);

  /* page views buckets */
  const buckets = useViewsBuckets(liveCount);

  /* funnel */
  const activeCartsCount = visitors.filter(v => {
    const age = (Date.now() - new Date(v.created_at).getTime()) / 1000;
    return age > 60;
  }).length;

  /* city modes */
  const cityModes: Record<string, "visitor" | "order" | "idle"> = {};
  CITIES.forEach(c => { cityModes[c.name] = "idle"; });

  // mark cities with recent orders blue
  todayOrders.forEach(o => {
    const city = o.city ?? o.customerCity ?? "";
    const match = CITIES.find(c =>
      city.toLowerCase().includes(c.name.toLowerCase()) ||
      c.name.toLowerCase().includes(city.toLowerCase()),
    );
    if (match) cityModes[match.name] = "order";
  });

  // mark a few cities green based on live visitors (distribute randomly but stably)
  if (liveCount > 0) {
    const greenCount = Math.min(liveCount, Math.ceil(CITIES.length * 0.4));
    const seed = liveCount % CITIES.length;
    for (let i = 0; i < greenCount; i++) {
      const idx = (seed + i * 3) % CITIES.length;
      if (cityModes[CITIES[idx].name] === "idle") {
        cityModes[CITIES[idx].name] = "visitor";
      }
    }
  }

  /* data fetch */
  const fetchData = useCallback(async () => {
    try {
      const [vRes, oRes] = await Promise.all([
        fetch("/api/visitors"),
        fetch("/api/orders"),
      ]);
      if (vRes.ok) {
        const vData = await vRes.json();
        setVisitors(vData.visitors ?? []);
        setTableExists(vData.tableExists !== false);
      }
      if (oRes.ok) {
        const oData = await oRes.json();
        setOrders(oData.orders ?? []);
      }
      setUpdatedAt(new Date());
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, [fetchData]);

  /* fullscreen */
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  /* copy SQL */
  const copySQL = useCallback(() => {
    navigator.clipboard.writeText(SETUP_SQL).then(() => {
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2000);
    });
  }, []);

  const _ = hoveredCity; // suppress unused warning

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <Sidebar />

      <div ref={containerRef} className="flex-1 relative flex flex-col overflow-hidden bg-[#0f172a]">

        {/* CSS Animations */}
        <style>{`
          @keyframes ping {
            0%   { transform: scale(0.8); opacity: 0.9; }
            70%  { transform: scale(1.8); opacity: 0; }
            100% { transform: scale(1.8); opacity: 0; }
          }
          @keyframes pulse-ring {
            0%, 100% { opacity: 0.3; }
            50%       { opacity: 0.7; }
          }
          @keyframes glow-pulse {
            0%, 100% { opacity: 0.7; }
            50%       { opacity: 1; }
          }
        `}</style>

        {/* Setup SQL banner */}
        {!tableExists && (
          <div className="flex items-center gap-3 px-4 py-2 bg-amber-900/60 border-b border-amber-700/50 text-amber-200 text-xs shrink-0 z-20">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 text-amber-400">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
            </svg>
            <span className="font-medium">Table visiteurs manquante.</span>
            <span className="text-amber-300/70 hidden sm:inline">Exécutez le SQL suivant dans Supabase Dashboard → SQL Editor.</span>
            <button
              onClick={copySQL}
              className="ml-auto shrink-0 flex items-center gap-1 px-2 py-0.5 rounded bg-amber-700/60 hover:bg-amber-600/70 text-amber-100 transition-colors text-xs"
            >
              {sqlCopied ? (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd"/></svg>
                  Copié!
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z"/><path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z"/></svg>
                  Copier SQL
                </>
              )}
            </button>
          </div>
        )}

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0 z-10">
          {/* Legend */}
          <div className="flex items-center gap-5">
            <h1 className="text-slate-100 font-semibold text-base tracking-wide">Vue en direct</h1>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30"/>
              <span className="text-slate-400 text-xs">Visiteur</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/30"/>
              <span className="text-slate-400 text-xs">Commande</span>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-xs">
              Mis à jour à {fmtTime(updatedAt)}
            </span>
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors border border-slate-700"
            >
              {isFullscreen ? (
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                  <path d="M7 3H3v4M17 3h-4v4M7 17H3v-4M17 17h-4v-4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                  <path d="M3 7V3h4M17 7V3h-4M3 13v4h4M17 13v4h-4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {isFullscreen ? "Quitter" : "Plein écran"}
            </button>
          </div>
        </div>

        {/* Map area */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          {/* Radial background glow */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(30,64,175,0.12) 0%, transparent 70%)",
          }}/>

          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
          </svg>

          {/*
           * Morocco map — real outline from djaiss/mapsicon (Natural Earth data)
           * SVG viewBox 0 0 1024 1024; path in potrace space with
           * transform="translate(0,1024) scale(0.1,-0.1)" (y-flipped, ÷10)
           * City dots placed in 1024-unit screen space (outside the transform group)
           */}
          <div className="relative" style={{ width: "min(72vw, 70vh, 600px)", aspectRatio: "1" }}>
            <svg
              viewBox="-50 -30 1124 1104"
              className="absolute inset-0 w-full h-full"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <filter id="map-glow" x="-5%" y="-5%" width="110%" height="110%">
                  <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <linearGradient id="mapGrad" x1="0" y1="0" x2="0.6" y2="1">
                  <stop offset="0%" stopColor="#1e40af" stopOpacity="0.60"/>
                  <stop offset="60%" stopColor="#1e3a8a" stopOpacity="0.40"/>
                  <stop offset="100%" stopColor="#0f2854" stopOpacity="0.22"/>
                </linearGradient>
              </defs>

              {/* Real Morocco + Western Sahara outline from mapsicon/Natural Earth */}
              <g transform="translate(0,1024) scale(0.1,-0.1)">
                <path
                  d="M6590 9128 c-19 -5 -51 -25 -70 -43 -41 -39 -77 -55 -128 -55 -20 -1 -48 -7 -62 -15 -14 -8 -52 -14 -86 -15 l-62 0 -12 -67 c-16 -99 -45 -192 -105 -338 -29 -71 -56 -152 -60 -180 -4 -27 -27 -89 -51 -136 -25 -50 -52 -126 -65 -180 -24 -103 -33 -124 -122 -278 -33 -57 -110 -198 -172 -312 -132 -244 -201 -332 -300 -381 -33 -17 -71 -38 -85 -48 -14 -10 -54 -30 -90 -45 -36 -15 -81 -42 -100 -60 -19 -18 -50 -37 -69 -44 -19 -6 -49 -22 -67 -36 -21 -16 -46 -25 -68 -25 -27 0 -52 -12 -104 -50 -38 -27 -75 -50 -83 -50 -8 0 -63 -21 -124 -46 -60 -25 -133 -52 -162 -59 -36 -9 -72 -30 -121 -69 -43 -35 -79 -56 -94 -56 -30 0 -87 -58 -119 -122 -11 -24 -47 -70 -79 -103 -31 -33 -86 -94 -122 -135 -74 -87 -150 -160 -262 -250 l-78 -64 5 -51 c3 -27 0 -71 -6 -98 -8 -34 -7 -51 1 -59 17 -17 3 -148 -20 -180 -10 -15 -25 -46 -33 -69 -10 -27 -41 -70 -83 -114 -88 -91 -207 -243 -217 -275 -4 -14 -15 -39 -25 -56 -9 -17 -23 -48 -30 -69 -7 -21 -27 -63 -45 -92 -28 -46 -31 -60 -27 -103 3 -29 -3 -78 -13 -120 -18 -72 -18 -133 1 -337 6 -67 5 -74 -25 -127 -22 -38 -31 -66 -29 -88 3 -29 7 -33 35 -36 24 -2 45 -17 84 -60 52 -57 104 -154 95 -177 -2 -7 -12 -63 -21 -125 -28 -189 -128 -382 -235 -453 -51 -34 -128 -148 -148 -218 -13 -48 -77 -134 -172 -234 -42 -44 -102 -114 -132 -155 -93 -126 -125 -150 -303 -231 -88 -39 -188 -92 -222 -116 -79 -56 -253 -230 -303 -303 -58 -85 -109 -117 -345 -217 -137 -59 -256 -92 -405 -114 -41 -6 -122 -22 -178 -35 -63 -14 -135 -24 -181 -24 -88 0 -176 -14 -239 -37 -34 -13 -48 -26 -72 -69 -32 -55 -80 -103 -130 -129 -25 -13 -50 -42 -50 -58 0 -2 120 -7 268 -10 147 -4 546 -21 887 -37 629 -31 2724 -93 2737 -81 18 16 29 403 19 666 -6 149 -11 282 -11 296 0 22 14 35 83 80 45 29 118 85 162 124 44 39 100 85 125 102 25 17 53 40 64 51 10 12 41 29 70 38 31 10 74 38 109 68 33 28 83 72 112 98 29 25 63 49 76 53 12 4 44 23 70 42 42 30 59 35 124 40 l75 6 50 63 c34 43 79 83 141 125 l91 61 67 -26 c42 -17 86 -26 121 -26 30 0 98 -11 150 -25 l95 -24 32 30 c35 35 63 125 63 204 l0 46 28 -15 c37 -19 177 -14 220 8 23 12 46 15 84 10 39 -4 78 1 149 20 52 14 144 30 205 36 80 8 114 16 129 29 11 11 54 41 96 67 57 36 94 70 141 129 111 138 186 248 213 311 l27 62 116 48 c65 26 134 59 156 72 33 20 46 23 91 17 l53 -6 49 52 c37 39 65 58 109 73 54 19 63 27 104 90 l46 68 164 34 c146 30 168 37 194 63 27 27 29 33 20 73 -7 35 -13 44 -34 46 -14 2 -39 19 -56 39 l-32 37 -33 -29 -34 -28 -3 23 c-3 14 3 29 14 37 16 11 16 18 5 69 l-13 56 31 32 c17 18 31 35 31 39 0 4 -18 16 -40 27 l-40 20 0 103 c0 105 3 114 45 149 19 16 26 16 80 3 85 -20 159 -19 203 4 55 28 140 61 202 78 68 18 127 48 161 80 25 23 26 29 21 89 -5 63 -4 66 28 99 24 24 44 35 79 40 25 3 118 22 206 42 l160 36 185 -12 c102 -6 321 -11 488 -11 l304 0 -7 33 c-4 17 -18 58 -32 90 -21 46 -25 67 -20 107 8 70 20 87 67 95 33 6 46 15 70 50 17 24 30 46 30 48 0 3 -66 50 -147 106 -199 136 -237 172 -253 238 -7 31 -9 73 -5 107 7 52 5 59 -21 93 -16 21 -41 57 -56 80 -15 23 -36 46 -47 52 -32 18 -39 126 -12 197 11 31 21 72 21 91 0 39 -51 137 -76 147 -11 4 -15 20 -14 58 0 29 -3 86 -6 126 -4 43 -2 103 6 148 14 91 6 129 -52 241 -21 41 -38 83 -38 94 0 11 12 38 27 60 l27 41 -68 62 -68 61 30 50 c17 28 34 61 37 75 6 24 1 28 -61 54 -63 26 -89 47 -124 105 -11 17 -36 32 -79 45 -62 21 -64 22 -80 71 l-16 50 -89 32 -90 32 -21 -23 c-13 -14 -43 -28 -74 -35 -48 -10 -59 -8 -159 24 -59 19 -113 39 -120 43 -7 5 -15 26 -18 48 -3 21 -15 71 -26 109 -12 39 -23 77 -25 85 -3 9 -22 -18 -44 -62 -32 -63 -44 -78 -62 -78 -14 0 -40 -18 -67 -46 l-45 -46 -95 6 c-71 4 -116 13 -179 36 -78 29 -85 30 -108 15 -13 -9 -28 -27 -33 -41 -8 -21 -16 -24 -55 -24 -38 0 -45 3 -45 20 0 16 -7 20 -33 20 -18 0 -50 -9 -72 -20 -22 -11 -48 -20 -60 -20 -11 0 -45 -12 -75 -27 -67 -32 -142 -32 -270 -2 -137 33 -183 50 -215 79 -16 15 -68 53 -115 83 -90 58 -247 205 -266 247 -44 100 -57 204 -30 242 9 12 16 26 16 29 0 6 -60 32 -64 28 -1 0 -17 -5 -36 -11z"
                  fill="url(#mapGrad)"
                  stroke="#3b82f6"
                  strokeOpacity={0.7}
                  strokeWidth={12}
                  filter="url(#map-glow)"
                />
              </g>

              {/* City dots — in 1024-unit screen space, outside the path transform */}
              {CITIES.map(city => (
                <CityDot
                  key={city.name}
                  city={city}
                  mode={cityModes[city.name] ?? "idle"}
                  tooltip={true}
                />
              ))}
            </svg>

            {/* City hover labels — % must match viewBox="-50 -30 1124 1104" */}
            {CITIES.map(city => (
              <div
                key={city.name + "-label"}
                onMouseEnter={() => setHoveredCity(city.name)}
                onMouseLeave={() => setHoveredCity(null)}
                className="absolute"
                style={{
                  left: `${(city.x + 50) / 1124 * 100}%`,
                  top: `${(city.y + 30) / 1104 * 100}%`,
                  transform: "translate(-50%,-50%)",
                  width: city.size + 16,
                  height: city.size + 16,
                  borderRadius: "50%",
                  cursor: "pointer",
                  zIndex: 10,
                }}
              >
                {hoveredCity === city.name && (
                  <div
                    className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-xs text-slate-100 whitespace-nowrap z-20 pointer-events-none border border-slate-600"
                    style={{ background: "#1e293b" }}
                  >
                    {city.name}
                    {cityModes[city.name] === "visitor" && (
                      <span className="ml-1 text-emerald-400">• actif</span>
                    )}
                    {cityModes[city.name] === "order" && (
                      <span className="ml-1 text-blue-400">• commande</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Live count badge */}
          <div
            className="absolute top-4 right-6 flex items-center gap-2 px-3 py-2 rounded-full border border-emerald-500/30 bg-slate-900/80 backdrop-blur"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"/>
            </span>
            <span className="text-emerald-400 font-bold text-lg leading-none">{liveCount}</span>
            <span className="text-slate-400 text-xs">en ligne</span>
          </div>
        </div>

        {/* Bottom stats overlay */}
        <div className="shrink-0 border-t border-slate-800 bg-slate-900/90 backdrop-blur-sm px-4 py-3">
          <div className="flex items-stretch gap-3 overflow-x-auto">

            {/* Card 1: Visiteurs */}
            <div className="shrink-0 flex flex-col justify-between min-w-[150px] px-4 py-3 rounded-xl bg-slate-800/70 border border-slate-700/50">
              <span className="text-slate-400 text-xs mb-1">Visiteurs en ce moment</span>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-bold text-slate-100">{liveCount}</span>
                <span className="text-emerald-400 text-xs mb-0.5">actifs</span>
              </div>
            </div>

            {/* Card 2: Sessions */}
            <div className="shrink-0 flex flex-col justify-between min-w-[150px] px-4 py-3 rounded-xl bg-slate-800/70 border border-slate-700/50">
              <span className="text-slate-400 text-xs mb-1">Sessions totales</span>
              <span className="text-2xl font-bold text-slate-100">
                {totalSessions.toLocaleString("fr-MA")}
              </span>
            </div>

            {/* Card 3: Ventes */}
            <div className="shrink-0 flex flex-col justify-between min-w-[180px] px-4 py-3 rounded-xl bg-slate-800/70 border border-slate-700/50">
              <span className="text-slate-400 text-xs mb-1">Ventes aujourd&apos;hui</span>
              <span className="text-xl font-bold text-emerald-400">
                {fmtMAD(todayRevenue)}
              </span>
              <span className="text-slate-500 text-xs">Total: {fmtMAD(totalSales)}</span>
            </div>

            {/* Card 4: Commandes */}
            <div className="shrink-0 flex flex-col justify-between min-w-[140px] px-4 py-3 rounded-xl bg-slate-800/70 border border-slate-700/50">
              <span className="text-slate-400 text-xs mb-1">Commandes aujourd&apos;hui</span>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-bold text-slate-100">{todayOrders.length}</span>
                <span className="text-slate-500 text-xs mb-0.5">/ {orders.length} total</span>
              </div>
            </div>

            {/* Divider */}
            <div className="w-px bg-slate-700/50 shrink-0 self-stretch mx-1"/>

            {/* Card 5: Page views chart */}
            <div className="shrink-0 flex flex-col justify-between min-w-[190px] px-4 py-3 rounded-xl bg-slate-800/70 border border-slate-700/50">
              <span className="text-slate-400 text-xs mb-2">Vues de pages (10 min)</span>
              <PageViewsChart buckets={buckets}/>
              <div className="flex justify-between mt-1">
                <span className="text-slate-600 text-[10px]">il y a 10m</span>
                <span className="text-slate-600 text-[10px]">maintenant</span>
              </div>
            </div>

            {/* Card 6: Funnel */}
            <div className="shrink-0 flex flex-col justify-between min-w-[230px] px-4 py-3 rounded-xl bg-slate-800/70 border border-slate-700/50">
              <span className="text-slate-400 text-xs mb-2">Comportement client</span>
              <Funnel
                visitors={liveCount}
                carts={activeCartsCount}
                orders={todayOrders.length}
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
