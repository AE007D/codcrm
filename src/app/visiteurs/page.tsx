"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

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

const SETUP_SQL = `-- Run once in your Supabase Dashboard → SQL Editor
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

function timeSince(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h`;
}

function deviceIcon(device: string | null) {
  if (device === "mobile") return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  );
  if (device === "tablet") return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  );
}

function pageLabel(page: string, title: string | null): string {
  if (title) return title;
  if (page.startsWith("/p/")) return "Page produit";
  if (page.startsWith("/lp/")) return "Landing page";
  return page;
}

function referrerLabel(ref: string | null): string {
  if (!ref) return "Direct";
  try {
    const url = new URL(ref);
    const host = url.hostname.replace("www.", "");
    if (host.includes("facebook") || host.includes("fb.com")) return "Facebook";
    if (host.includes("tiktok")) return "TikTok";
    if (host.includes("instagram")) return "Instagram";
    if (host.includes("google")) return "Google";
    if (host.includes("youtube")) return "YouTube";
    return host;
  } catch { return "Direct"; }
}

function referrerColor(ref: string | null): string {
  const label = referrerLabel(ref);
  if (label === "Facebook") return "bg-blue-50 text-blue-600";
  if (label === "TikTok") return "bg-slate-100 text-slate-700";
  if (label === "Instagram") return "bg-pink-50 text-pink-600";
  if (label === "Google") return "bg-emerald-50 text-emerald-600";
  return "bg-slate-50 text-slate-500";
}

export default function VisiteursPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [tableExists, setTableExists] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedSql, setCopiedSql] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchVisitors = useCallback(async () => {
    try {
      const res = await fetch("/api/visitors");
      const data = await res.json();
      setTableExists(data.tableExists ?? true);
      setVisitors(data.visitors ?? []);
      setLastUpdate(new Date());
    } catch {
      setTableExists(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVisitors();
    const t = setInterval(fetchVisitors, 5_000);
    return () => clearInterval(t);
  }, [fetchVisitors]);

  // Group by page
  const byPage = visitors.reduce<Record<string, Visitor[]>>((acc, v) => {
    acc[v.page] = acc[v.page] ?? [];
    acc[v.page].push(v);
    return acc;
  }, {});

  // Device breakdown
  const deviceCounts = { mobile: 0, tablet: 0, desktop: 0 };
  visitors.forEach(v => { const d = (v.device ?? "desktop") as keyof typeof deviceCounts; deviceCounts[d] = (deviceCounts[d] ?? 0) + 1; });

  // Referrer breakdown
  const refCounts: Record<string, number> = {};
  visitors.forEach(v => { const r = referrerLabel(v.referrer); refCounts[r] = (refCounts[r] ?? 0) + 1; });
  const topRefs = Object.entries(refCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">

        {/* Header */}
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Visiteurs en direct
              {visitors.length > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-bold bg-emerald-500 text-white px-2.5 py-1 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 bg-white rounded-full"/>
                  {visitors.length} en ligne
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-400 hidden sm:block">
              Pages produits & landing pages — mis à jour toutes les 5 secondes
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-xs text-slate-400">
                Sync {lastUpdate.toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
            <button onClick={fetchVisitors}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors" title="Actualiser">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path d="M21 12a9 9 0 11-6.22-8.56"/>
              </svg>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">

          {/* Setup required banner */}
          {tableExists === false && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-xl">⚙️</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-amber-900 mb-1">Table de tracking à créer</h3>
                  <p className="text-sm text-amber-700 mb-4">
                    Exécutez ce SQL une seule fois dans votre <strong>Supabase Dashboard → SQL Editor</strong> pour activer le tracking des visiteurs.
                  </p>
                  <div className="relative">
                    <pre className="bg-slate-900 text-slate-100 text-xs rounded-xl p-4 overflow-x-auto font-mono leading-relaxed">{SETUP_SQL}</pre>
                    <button
                      onClick={() => { navigator.clipboard.writeText(SETUP_SQL); setCopiedSql(true); setTimeout(() => setCopiedSql(false), 2000); }}
                      className={`absolute top-3 right-3 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${copiedSql ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-200 hover:bg-slate-600"}`}>
                      {copiedSql ? "✓ Copié" : "Copier SQL"}
                    </button>
                  </div>
                  <p className="text-xs text-amber-600 mt-3">
                    Après avoir exécuté le SQL, cette page commencera à afficher les visiteurs en temps réel sur vos pages /p/[id] et /lp/[slug].
                  </p>
                </div>
              </div>
            </div>
          )}

          {loading && tableExists === null && (
            <div className="flex items-center justify-center py-20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8 text-blue-500 animate-spin">
                <path d="M21 12a9 9 0 11-6.22-8.56"/>
              </svg>
            </div>
          )}

          {tableExists && !loading && visitors.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm mb-6">
              <div className="text-5xl mb-4">👁️</div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Aucun visiteur en ce moment</h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">
                Les visiteurs sur vos pages <strong>/p/</strong> et <strong>/lp/</strong> apparaîtront ici en temps réel. Fenêtre : 5 minutes d&apos;inactivité.
              </p>
            </div>
          )}

          {tableExists && visitors.length > 0 && (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5 mb-6">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-100 border-2">
                  <p className="text-sm text-slate-500 font-medium mb-2">En ligne maintenant</p>
                  <p className="text-3xl font-black text-emerald-600">{visitors.length}</p>
                  <p className="text-xs text-slate-400 mt-1">visiteurs uniques</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <p className="text-sm text-slate-500 font-medium mb-2">Pages actives</p>
                  <p className="text-3xl font-black text-blue-600">{Object.keys(byPage).length}</p>
                  <p className="text-xs text-slate-400 mt-1">URLs différentes</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <p className="text-sm text-slate-500 font-medium mb-2">Appareils</p>
                  <div className="flex items-end gap-3 mt-1">
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-800">{deviceCounts.mobile}</p>
                      <p className="text-[10px] text-slate-400">📱</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-800">{deviceCounts.tablet}</p>
                      <p className="text-[10px] text-slate-400">📱</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-800">{deviceCounts.desktop}</p>
                      <p className="text-[10px] text-slate-400">🖥️</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <p className="text-sm text-slate-500 font-medium mb-2">Top source</p>
                  <p className="text-lg font-bold text-slate-800">{topRefs[0]?.[0] ?? "—"}</p>
                  <p className="text-xs text-slate-400 mt-1">{topRefs[0]?.[1] ?? 0} visiteurs</p>
                </div>
              </div>

              {/* Referrer breakdown */}
              {topRefs.length > 1 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
                  <h2 className="font-bold text-slate-900 mb-4">Sources de trafic</h2>
                  <div className="flex flex-wrap gap-2">
                    {topRefs.map(([ref, count]) => (
                      <div key={ref} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ${referrerColor(ref === "Direct" ? null : ref)}`}>
                        <span>{ref}</span>
                        <span className="bg-white bg-opacity-60 px-1.5 py-0.5 rounded-lg text-xs font-bold">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pages breakdown */}
              <div className="space-y-4">
                {Object.entries(byPage).sort((a, b) => b[1].length - a[1].length).map(([page, pvs]) => {
                  const title = pvs[0].page_title;
                  const productId = pvs[0].product_id;
                  return (
                    <div key={page} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"/>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 truncate">{pageLabel(page, title)}</p>
                          <p className="text-xs text-slate-400 font-mono truncate">{page}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                            {pvs.length} en ligne
                          </span>
                          {productId && (
                            <Link href={`/p/${productId}`} target="_blank"
                              className="text-xs text-blue-500 hover:text-blue-700 font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                              Voir page ↗
                            </Link>
                          )}
                        </div>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {pvs.map(v => (
                          <div key={v.id} className="px-5 py-3 flex items-center gap-3">
                            {/* Device icon */}
                            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                              {deviceIcon(v.device)}
                            </div>
                            {/* Visitor info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${referrerColor(v.referrer)}`}>
                                  {referrerLabel(v.referrer)}
                                </span>
                                <span className="text-xs text-slate-400 capitalize">{v.device ?? "desktop"}</span>
                              </div>
                            </div>
                            {/* Time */}
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold text-slate-600">il y a {timeSince(v.last_seen)}</p>
                              <p className="text-[10px] text-slate-400">
                                arrivé il y a {timeSince(v.created_at)}
                              </p>
                            </div>
                            {/* Live dot */}
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"/>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
