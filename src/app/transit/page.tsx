"use client";

import { useState, useCallback, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

type Creds = { apiId: string; apiKey: string };
type EagleCreds = { tk: string; sk: string };
type Parcel = Record<string, unknown>;

const AMEEX_TRANSIT = ["en cours", "in transit", "picked up", "en livraison", "ramassé", "sorti pour livraison", "processing"];
const EAGLE_TRANSIT = ["en cours", "in transit", "in_transit", "en livraison", "livraison", "sorti", "pris en charge"];

function isTransit(status: string, list: string[]) {
  return list.some(s => status.toLowerCase().includes(s));
}

function daysSince(dateStr: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function DaysChip({ days }: { days: number | null }) {
  if (days === null) return <span className="text-slate-400 text-xs">—</span>;
  const color = days <= 3 ? "bg-emerald-50 text-emerald-600" : days <= 7 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-500";
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${color}`}>{days}j</span>;
}

export default function TransitPage() {
  const [ameexParcels, setAmeexParcels] = useState<Parcel[]>([]);
  const [eagleParcels, setEagleParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true); setError("");
    const results: { ameex: Parcel[]; eagle: Parcel[] } = { ameex: [], eagle: [] };

    const s = await fetch("/api/settings").then(r => r.json()).then(d => d.settings ?? {}).catch(() => ({}));

    if (s.ameex) {
      const c: Creds = s.ameex;
      try {
        const r = await fetch("/api/ameex", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "listParcels", apiId: c.apiId, apiKey: c.apiKey }) });
        const d = await r.json();
        const all: Parcel[] = Array.isArray(d) ? d : (d?.data ?? []);
        results.ameex = all.filter(p => isTransit(String(p.status ?? p.state ?? p.etat ?? ""), AMEEX_TRANSIT));
      } catch { /* silent */ }
    }

    if (s.eagle) {
      const c: EagleCreds = s.eagle;
      try {
        const r = await fetch("/api/eagle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list", tk: c.tk, sk: c.sk }) });
        const d = await r.json();
        const all: Parcel[] = Array.isArray(d) ? d : [];
        results.eagle = all.filter(p => isTransit(String(p.state ?? p.etat ?? p.status ?? ""), EAGLE_TRANSIT));
      } catch { /* silent */ }
    }

    if (!s.ameex && !s.eagle) setError("Aucun transporteur configuré. Allez dans Intégrations pour ajouter Ameex ou Eagle Express.");
    setAmeexParcels(results.ameex);
    setEagleParcels(results.eagle);
    setLoading(false); setLoaded(true);
  }, []);

  const total = ameexParcels.length + eagleParcels.length;
  const totalCOD = [...ameexParcels, ...eagleParcels].reduce((s, p) => s + parseFloat(String(p.cod ?? p.price ?? p.prix ?? "0")), 0);
  const oldParcels = [...ameexParcels, ...eagleParcels].filter(p => {
    const d = daysSince(String(p.created_at ?? p.date ?? p.date_creation ?? ""));
    return d !== null && d > 7;
  }).length;

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">En Transit</h1>
            <p className="text-sm text-slate-400 hidden sm:block">Commandes chez le transporteur — non encore livrées</p>
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
                <p className="text-slate-800 font-bold text-lg">Vérifier les colis en transit</p>
                <p className="text-slate-400 text-sm mt-1">Cliquez sur Actualiser pour charger les colis chez Ameex et Eagle Express</p>
              </div>
              <button onClick={loadAll} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl shadow-md shadow-blue-200 transition-colors">
                Charger les colis
              </button>
            </div>
          )}

          {loaded && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5 mb-6">
                {[
                  { label: "Colis en transit", value: total, sub: "total", color: "text-blue-600" },
                  { label: "COD immobilisé", value: `${totalCOD.toFixed(0)} MAD`, sub: "en attente de livraison", color: "text-slate-900" },
                  { label: "Colis Ameex", value: ameexParcels.length, sub: "en cours", color: "text-blue-700" },
                  { label: "Retard +7j ⚠️", value: oldParcels, sub: "à relancer", color: oldParcels > 0 ? "text-red-500" : "text-emerald-600" },
                ].map(k => (
                  <div key={k.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <p className="text-sm text-slate-500 font-medium mb-2">{k.label}</p>
                    <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                    <p className="text-xs text-slate-400 mt-1">{k.sub}</p>
                  </div>
                ))}
              </div>

              {/* Ameex table */}
              {ameexParcels.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-5">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-700 flex items-center justify-center text-white text-xs font-bold">A</div>
                    <h2 className="font-bold text-slate-900">Ameex — En transit ({ameexParcels.length})</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-xs text-slate-400 border-b border-slate-50">
                        {["Code", "Destinataire", "Ville", "COD", "Statut", "Âge"].map(h => <th key={h} className="text-left px-5 py-3 font-semibold uppercase tracking-wide">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {ameexParcels.map((p, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                            <td className="px-5 py-3 font-mono text-xs text-blue-600">{String(p.code ?? p.barcode ?? "—")}</td>
                            <td className="px-5 py-3 font-semibold text-slate-800">{String(p.receiver ?? p.name ?? "—")}</td>
                            <td className="px-5 py-3 text-slate-500">{String(p.city ?? p.ville ?? "—")}</td>
                            <td className="px-5 py-3 font-bold text-slate-800">{String(p.cod ?? p.price ?? "—")} MAD</td>
                            <td className="px-5 py-3"><span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg">{String(p.status ?? p.state ?? "—")}</span></td>
                            <td className="px-5 py-3"><DaysChip days={daysSince(String(p.created_at ?? p.date ?? ""))} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Eagle table */}
              {eagleParcels.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-5">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-white text-xs font-bold">E</div>
                    <h2 className="font-bold text-slate-900">Eagle Express — En transit ({eagleParcels.length})</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-xs text-slate-400 border-b border-slate-50">
                        {["Code", "Client", "Ville", "COD", "Statut", "Âge"].map(h => <th key={h} className="text-left px-5 py-3 font-semibold uppercase tracking-wide">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {eagleParcels.map((p, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                            <td className="px-5 py-3 font-mono text-xs text-amber-600">{String(p.code ?? "—")}</td>
                            <td className="px-5 py-3 font-semibold text-slate-800">{String(p.fullname ?? p.nom ?? "—")}</td>
                            <td className="px-5 py-3 text-slate-500">{String(p.city ?? p.ville ?? "—")}</td>
                            <td className="px-5 py-3 font-bold text-slate-800">{String(p.price ?? p.prix ?? "—")} MAD</td>
                            <td className="px-5 py-3"><span className="px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 rounded-lg">{String(p.state ?? p.etat ?? "—")}</span></td>
                            <td className="px-5 py-3"><DaysChip days={daysSince(String(p.created_at ?? p.date ?? ""))} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {total === 0 && (
                <div className="flex flex-col items-center py-16 gap-3">
                  <span className="text-5xl">📦</span>
                  <p className="text-slate-600 font-semibold">Aucun colis en transit</p>
                  <p className="text-slate-400 text-sm">Tous les colis sont livrés ou en attente de ramassage</p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
