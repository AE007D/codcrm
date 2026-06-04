"use client";

import { useState, useCallback, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useLang } from "@/lib/i18n";

type Parcel = Record<string, unknown>;

// Ameex status → display config
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  "livré":              { label: "Livré ✓",        color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  "delivered":          { label: "Livré ✓",        color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  "retourné":           { label: "Retourné",        color: "text-red-600",     bg: "bg-red-50 border-red-200" },
  "returned":           { label: "Retourné",        color: "text-red-600",     bg: "bg-red-50 border-red-200" },
  "annulé":             { label: "Annulé",          color: "text-slate-500",   bg: "bg-slate-100 border-slate-200" },
  "cancelled":          { label: "Annulé",          color: "text-slate-500",   bg: "bg-slate-100 border-slate-200" },
  "en voyage":          { label: "En voyage",       color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
  "en livraison":       { label: "En livraison",    color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
  "en cours":           { label: "En cours",        color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
  "sorti pour livraison":{ label: "Sorti livraison",color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  "ramassé":            { label: "Ramassé",         color: "text-indigo-700",  bg: "bg-indigo-50 border-indigo-200" },
  "picked up":          { label: "Ramassé",         color: "text-indigo-700",  bg: "bg-indigo-50 border-indigo-200" },
  "en attente":         { label: "En attente",      color: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
};

function statusStyle(raw: string) {
  const lower = raw.toLowerCase();
  for (const [key, val] of Object.entries(STATUS_MAP)) {
    if (lower.includes(key)) return val;
  }
  return { label: raw, color: "text-slate-600", bg: "bg-slate-100 border-slate-200" };
}

function daysSince(dateStr: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function DaysChip({ days }: { days: number | null }) {
  if (days === null) return <span className="text-slate-400 text-xs">—</span>;
  const color = days <= 3 ? "bg-emerald-50 text-emerald-600" : days <= 7 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600";
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${color}`}>{days}j</span>;
}

const STATUS_FILTERS = ["Tous", "En cours", "Livré", "Retourné", "Annulé"];

export default function TransitPage() {
  const { t } = useLang();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Tous");
  const [hubName, setHubName] = useState("Casablanca Hub Principal");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"Tous" | "STOCK" | "SIMPLE">("Tous");

  const loadAll = useCallback(async () => {
    setLoading(true); setError("");
    const s = await fetch("/api/settings").then(r => r.json()).then(d => d.settings ?? {}).catch(() => ({}));

    if (!s.ameex?.apiId) {
      setError("Identifiants Ameex non configurés. Allez dans Intégrations → Ameex.");
      setLoading(false);
      return;
    }

    const c = s.ameex;
    if (c.depotName) setHubName(c.depotName);
    const depotId = c.depotId || "34";

    function toList(d: unknown): Parcel[] {
      function expandMap(obj: Record<string, unknown>): Parcel[] {
        const keys = Object.keys(obj);
        if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
          return Object.values(obj).filter(v => v && typeof v === "object" && !Array.isArray(v)) as Parcel[];
        }
        return [obj as Parcel];
      }
      function extr(obj: Record<string, unknown>): Parcel[] {
        if (Array.isArray(obj.data))    return obj.data    as Parcel[];
        if (Array.isArray(obj.parcels)) return obj.parcels as Parcel[];
        if (Array.isArray(obj.items))   return obj.items   as Parcel[];
        const vals = Object.values(obj).filter(v => v && typeof v === "object" && !Array.isArray(v)) as Record<string, unknown>[];
        if (vals.length > 0) return vals.flatMap(expandMap);
        return [];
      }
      if (Array.isArray(d)) return d as Parcel[];
      const dd = d as Record<string, unknown>;
      const api = dd?.api;
      if (Array.isArray(api)) return api as Parcel[];
      if (api && typeof api === "object" && api !== null) {
        const r = extr(api as Record<string, unknown>);
        if (r.length > 0) return r;
      }
      return extr(dd);
    }

    try {
      const [rStock, rSimple] = await Promise.all([
        fetch("/api/ameex", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "listParcels", apiId: c.apiId, apiKey: c.apiKey, p_hub: depotId, type: "STOCK" }),
        }).then(r => r.json()),
        fetch("/api/ameex", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "listParcels", apiId: c.apiId, apiKey: c.apiKey, type: "SIMPLE" }),
        }).then(r => r.json()),
      ]);

      const stockList = toList(rStock).map(p => ({ ...p, _type: "STOCK" } as Parcel));
      const simpleList = toList(rSimple).map(p => ({ ...p, _type: "SIMPLE" } as Parcel));

      // Merge, dedup by code
      const seen = new Set<string>();
      const merged: Parcel[] = [];
      for (const p of [...stockList, ...simpleList]) {
        const key = String(p.for_code ?? p.code ?? p.barcode ?? "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(p);
      }
      setParcels(merged);
    } catch (e) {
      setError("Erreur lors du chargement: " + String(e));
    }

    setLoading(false); setLoaded(true);
  }, []);

  // Derived stats
  const delivered = parcels.filter(p => String(p.statut ?? p.status ?? "").toLowerCase().includes("livr"));
  const returned  = parcels.filter(p => String(p.statut ?? p.status ?? "").toLowerCase().includes("retour"));
  const inTransit = parcels.filter(p => {
    const s = String(p.statut ?? p.status ?? "").toLowerCase();
    return s.includes("voyage") || s.includes("livraison") || s.includes("cours") || s.includes("ramassé") || s.includes("picked");
  });
  const totalCOD = parcels.reduce((sum, p) => sum + parseFloat(String(p.cod ?? p.price ?? "0")), 0);
  const stockCount  = parcels.filter(p => p._type === "STOCK").length;
  const simpleCount = parcels.filter(p => p._type === "SIMPLE").length;

  const filtered = parcels.filter(p => {
    const s = String(p.statut ?? p.status ?? "").toLowerCase();
    const matchFilter =
      filter === "Tous"     ? true :
      filter === "Livré"    ? s.includes("livr") :
      filter === "Retourné" ? s.includes("retour") :
      filter === "Annulé"   ? s.includes("annul") || s.includes("cancel") :
      filter === "En cours" ? (s.includes("voyage") || s.includes("livraison") || s.includes("cours") || s.includes("ramassé")) :
      true;
    const matchType = typeFilter === "Tous" || p._type === typeFilter;
    const matchSearch = !search || (
      String(p.for_code ?? p.code ?? p.barcode ?? "").toLowerCase().includes(search.toLowerCase()) ||
      String(p.receiver ?? p.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      String(p.city ?? p.ville ?? "").toLowerCase().includes(search.toLowerCase())
    );
    return matchFilter && matchType && matchSearch;
  });

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between gap-3 sidebar-header-pl">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t("transit_title")}</h1>
            <p className="text-sm text-slate-400 hidden sm:block">
              {t("transit_subtitle")}
            </p>
          </div>
          <button onClick={loadAll} disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-4 lg:px-5 py-2.5 rounded-xl shadow-md shadow-blue-200 transition-colors whitespace-nowrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            {loading ? "Chargement…" : "Actualiser"}
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {error && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 flex items-center gap-3">
              <span className="text-amber-500 text-lg">⚠️</span>
              <p className="text-sm text-amber-700">{error}</p>
            </div>
          )}

          {!loaded && !loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-5">
              <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth={1.5} className="w-10 h-10">
                  <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3M9 17h6m4 0h2"/><circle cx="7" cy="17" r="2"/>
                  <path d="M13 17V9h5l3 4v4h-2"/><circle cx="19" cy="17" r="2"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-slate-800 font-bold text-lg">Colis Ameex — Stock + Ramassage</p>
                <p className="text-slate-400 text-sm mt-1">Cliquez sur Actualiser pour charger tous vos colis Ameex</p>
              </div>
              <button onClick={loadAll} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl shadow-md shadow-blue-200 transition-colors">
                Charger les colis
              </button>
            </div>
          )}

          {loaded && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Total colis</p>
                  <p className="text-2xl font-bold text-blue-600">{parcels.length}</p>
                  <p className="text-xs text-slate-400 mt-0.5">depuis le hub</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">En livraison</p>
                  <p className="text-2xl font-bold text-indigo-600">{inTransit.length}</p>
                  <p className="text-xs text-slate-400 mt-0.5">en cours</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Livrés</p>
                  <p className="text-2xl font-bold text-emerald-600">{delivered.length}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{parcels.length > 0 ? Math.round(delivered.length / parcels.length * 100) : 0}% taux</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">COD total</p>
                  <p className="text-2xl font-bold text-slate-800">{totalCOD.toFixed(0)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">MAD · {returned.length} retours</p>
                </div>
              </div>

              {/* Filters + Search */}
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex gap-2 flex-wrap items-center">
                  {STATUS_FILTERS.map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${filter === f ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"}`}>
                      {f === "Tous" ? t("type_all") : f === "En cours" ? t("in_progress") : f === "Livré" ? t("status_livre") : f}
                      {f !== "Tous" && (
                        <span className="ml-1 opacity-60">
                          ({f === "Livré" ? delivered.length : f === "Retourné" ? returned.length : f === "En cours" ? inTransit.length : parcels.filter(p => String(p.statut ?? p.status ?? "").toLowerCase().includes("annul")).length})
                        </span>
                      )}
                    </button>
                  ))}
                  <span className="text-slate-200 hidden sm:block">|</span>
                  {(["Tous", "STOCK", "SIMPLE"] as const).map(typ => (
                    <button key={typ} onClick={() => setTypeFilter(typ)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${typeFilter === typ ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300"}`}>
                      {typ === "Tous" ? t("type_all") : typ === "STOCK" ? `${t("type_stock")} (${stockCount})` : `${t("type_simple")} (${simpleCount})`}
                    </button>
                  ))}
                  <input
                    type="text"
                    placeholder={t("search_transit")}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="sm:ml-auto w-full sm:w-64 text-sm border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-400 bg-white"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-700 flex items-center justify-center text-white text-xs font-bold">A</div>
                  <span className="font-bold text-slate-800 text-sm">Ameex — Stock + Ramassage</span>
                  <span className="ml-auto text-xs text-slate-400">{filtered.length} / {parcels.length} colis</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400 border-b border-slate-50 bg-slate-50/50">
                        <th className="text-left px-5 py-3 font-semibold uppercase tracking-wide">Code suivi</th>
                        <th className="text-left px-5 py-3 font-semibold uppercase tracking-wide">Destinataire</th>
                        <th className="text-left px-5 py-3 font-semibold uppercase tracking-wide hidden sm:table-cell">Ville</th>
                        <th className="text-left px-5 py-3 font-semibold uppercase tracking-wide">COD</th>
                        <th className="text-left px-5 py-3 font-semibold uppercase tracking-wide hidden md:table-cell">Type</th>
                        <th className="text-left px-5 py-3 font-semibold uppercase tracking-wide">Statut</th>
                        <th className="text-left px-5 py-3 font-semibold uppercase tracking-wide hidden md:table-cell">Âge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">Aucun colis</td></tr>
                      ) : filtered.map((p, i) => {
                        const rawStatus = String(p.statut ?? p.status ?? p.state ?? p.etat ?? "");
                        const st = statusStyle(rawStatus);
                        const days = daysSince(String(p.created_at ?? p.date ?? p.date_creation ?? ""));
                        const pType = String(p._type ?? "");
                        return (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                            <td className="px-5 py-3.5 font-mono text-xs text-blue-600 whitespace-nowrap">{String(p.for_code ?? p.code ?? p.barcode ?? "—")}</td>
                            <td className="px-5 py-3.5">
                              <p className="font-semibold text-slate-800">{String(p.receiver ?? p.name ?? p.destinataire ?? "—")}</p>
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 hidden sm:table-cell">{String(p.city ?? p.ville ?? "—")}</td>
                            <td className="px-5 py-3.5 font-bold text-slate-800 whitespace-nowrap">{String(p.cod ?? p.price ?? p.crbt ?? "—")} MAD</td>
                            <td className="px-5 py-3.5 hidden md:table-cell">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${pType === "STOCK" ? "bg-purple-50 text-purple-700" : "bg-sky-50 text-sky-700"}`}>
                                {pType === "STOCK" ? "Stock" : "Ramassage"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold border ${st.bg} ${st.color} whitespace-nowrap`}>
                                {st.label !== rawStatus ? st.label : rawStatus.split(/[\n,]+/)[0].trim().slice(0, 30)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 hidden md:table-cell"><DaysChip days={days} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
