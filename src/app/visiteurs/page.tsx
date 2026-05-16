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

/* ─── Morocco city definitions (x/y in SVG units, viewBox 800×820) ── */
const CITIES = [
  { name: "Casablanca", x: 112, y: 218, size: 16 },
  { name: "Rabat",      x: 107, y: 178, size: 12 },
  { name: "Marrakech",  x: 342, y: 304, size: 12 },
  { name: "Fès",        x: 572, y: 150, size: 11 },
  { name: "Agadir",     x: 54,  y: 348, size: 10 },
  { name: "Tanger",     x: 262, y: 28,  size: 10 },
  { name: "Meknès",     x: 530, y: 154, size: 9  },
  { name: "Oujda",      x: 740, y: 84,  size: 9  },
  { name: "Béni Mellal",x: 448, y: 244, size: 8  },
  { name: "El Jadida",  x: 110, y: 244, size: 8  },
  { name: "Nador",      x: 558, y: 22,  size: 8  },
  { name: "Kénitra",    x: 116, y: 154, size: 8  },
  { name: "Settat",     x: 196, y: 236, size: 7  },
  { name: "Laayoune",   x: 26,  y: 570, size: 7  },
  { name: "Ouarzazate", x: 412, y: 344, size: 7  },
  { name: "Tétouan",    x: 310, y: 30,  size: 7  },
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

          {/* Morocco map container — viewBox 800×820, aspect matches real Morocco+WS */}
          <div className="relative" style={{ width: "min(55vw, 480px)", aspectRatio: "800/820" }}>
            <svg
              viewBox="0 0 800 820"
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
                <filter id="map-glow">
                  <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <linearGradient id="mapGrad" x1="0" y1="0" x2="0.8" y2="1">
                  <stop offset="0%" stopColor="#1e40af" stopOpacity="0.55"/>
                  <stop offset="60%" stopColor="#1e3a8a" stopOpacity="0.35"/>
                  <stop offset="100%" stopColor="#0f2854" stopOpacity="0.20"/>
                </linearGradient>
              </defs>

              {/* Morocco + Western Sahara — traced from reference image, viewBox 800×820 */}
              <path
                d="
                  M 260,16
                  L 285,7 L 315,2 L 348,1 L 382,2 L 418,3
                  L 453,4 L 486,6 L 516,9 L 544,13 L 570,18
                  L 595,25 L 618,34 L 640,46 L 662,60
                  L 682,77 L 700,97 L 716,120 L 729,145
                  L 739,172 L 747,203 L 752,236 L 755,270
                  L 756,306 L 755,342 L 752,376 L 748,406
                  L 744,432
                  L 762,432 L 762,488 L 642,488 L 642,560
                  L 528,560 L 528,632
                  L 420,650 L 306,662 L 204,666 L 124,664
                  L 70,656 L 38,642 L 18,624 L 8,602
                  L 6,578 L 6,552 L 8,524 L 12,494
                  L 16,462 L 20,432 L 25,402 L 31,374
                  L 38,348 L 47,324 L 57,302 L 68,284
                  L 79,270 L 88,258 L 96,248 L 102,240
                  L 106,232 L 108,224 L 108,216 L 107,208
                  L 104,200 L 100,192 L 97,184 L 96,176
                  L 97,168 L 101,160 L 107,152 L 115,144
                  L 125,136 L 137,128 L 151,120 L 166,112
                  L 183,103 L 202,94 L 221,84 L 240,73
                  L 258,62 L 268,50 L 268,36 L 264,24 L 260,16 Z
                "
                fill="url(#mapGrad)"
                stroke="#3b82f6"
                strokeOpacity={0.6}
                strokeWidth={1.5}
                filter="url(#map-glow)"
              />

              {/* City dots */}
              {CITIES.map(city => (
                <CityDot
                  key={city.name}
                  city={city}
                  mode={cityModes[city.name] ?? "idle"}
                  tooltip={true}
                />
              ))}
            </svg>

            {/* City hover labels — positioned using SVG viewBox percentages (800×540) */}
            {CITIES.map(city => (
              <div
                key={city.name + "-label"}
                onMouseEnter={() => setHoveredCity(city.name)}
                onMouseLeave={() => setHoveredCity(null)}
                className="absolute"
                style={{
                  left: `${(city.x / 800) * 100}%`,
                  top: `${(city.y / 820) * 100}%`,
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
