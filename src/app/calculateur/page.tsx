"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";

type Product = {
  id: number;
  name: string;
  purchasePrice: number;
  sellPrice: number;
  shippingCost: number;
  cpd: number;
  platform: string;
  /* Real delivery rate from shippers */
  realDeliveryRate?: number;
  totalSent?: number;
  totalDelivered?: number;
  totalReturned?: number;
  rateSource?: "ameex" | "eagle" | "both" | "manual";
};

const STORAGE_KEY   = "codcrm_products_calc_v2"; // v2: starts empty, no fake defaults
const LAST_RUN_KEY  = "codcrm_calc_last_run";
const AMEEX_KEY     = "ameex_creds";
const EAGLE_KEY     = "eagle_creds";
const INTERVAL_DAYS = 3;


/* ── Delivery status classification ── */
const DELIVERED_KEYWORDS = ["livré", "delivered", "remis", "succès", "success", "réussi"];
const RETURNED_KEYWORDS  = ["retourné", "retour", "returned", "non livré", "refusé", "refused", "annulé", "cancelled", "échec", "failed", "injoignable"];

function classifyStatus(status: string): "delivered" | "returned" | "transit" {
  const s = status.toLowerCase();
  if (DELIVERED_KEYWORDS.some(k => s.includes(k))) return "delivered";
  if (RETURNED_KEYWORDS.some(k => s.includes(k))) return "returned";
  return "transit";
}

/* ── Product name matching ── */
function wordsOf(s: string) {
  return s.toLowerCase().split(/[\s\-_/]+/).filter(w => w.length > 2);
}
function matches(productName: string, parcelProduct: string) {
  const pWords = wordsOf(productName);
  const cWords = wordsOf(parcelProduct);
  return pWords.some(w => cWords.some(c => c.includes(w) || w.includes(c)));
}

type ParcelStats = { delivered: number; returned: number };
function buildRateMap(parcels: Record<string, unknown>[], productField: string, statusField: string): Map<string, ParcelStats> {
  const map = new Map<string, ParcelStats>();
  for (const p of parcels) {
    const prod = String(p[productField] ?? "").trim();
    const stat = String(p[statusField] ?? "").trim();
    if (!prod) continue;
    const cls = classifyStatus(stat);
    if (cls === "transit") continue;
    if (!map.has(prod)) map.set(prod, { delivered: 0, returned: 0 });
    const entry = map.get(prod)!;
    if (cls === "delivered") entry.delivered++; else entry.returned++;
  }
  return map;
}

function calcRateForProduct(productName: string, rateMap: Map<string, ParcelStats>): ParcelStats & { rate: number; total: number } | null {
  let delivered = 0, returned = 0;
  for (const [key, stats] of rateMap) {
    if (matches(productName, key)) { delivered += stats.delivered; returned += stats.returned; }
  }
  const total = delivered + returned;
  if (total === 0) return null;
  return { delivered, returned, rate: (delivered / total) * 100, total };
}

/*
  Profit formula (COD, delivery rate R%):
  Net/order = R*(sell - purchase - shipping - cpd) - (1-R)*(purchase + shipping)
  Break-even R = (purchase + shipping) / (sell - cpd)
*/
function calcMetrics(p: Product, deliveryRate: number) {
  const R = deliveryRate / 100;
  const profitPerDelivered = p.sellPrice - p.purchasePrice - p.shippingCost - p.cpd;
  const lossPerReturn = p.purchasePrice + p.shippingCost;
  const netPerOrder = R * profitPerDelivered - (1 - R) * lossPerReturn;
  const margin = p.sellPrice > 0 ? (profitPerDelivered / p.sellPrice) * 100 : 0;
  const roi = (p.purchasePrice + p.shippingCost + p.cpd) > 0
    ? (profitPerDelivered / (p.purchasePrice + p.shippingCost + p.cpd)) * 100 : 0;
  const denominator = p.sellPrice - p.cpd;
  const breakEvenRate = denominator > 0
    ? Math.min(100, Math.max(0, ((p.purchasePrice + p.shippingCost) / denominator) * 100))
    : 100;
  return { profitPerDelivered, netPerOrder, margin, roi, breakEvenRate, isWinner: netPerOrder > 0 && profitPerDelivered > 0 };
}

function daysUntilNext(lastRun: number) {
  return Math.max(0, Math.ceil((lastRun + INTERVAL_DAYS * 86400000 - Date.now()) / 86400000));
}
function hoursUntilNext(lastRun: number) {
  const diff = (lastRun + INTERVAL_DAYS * 86400000) - Date.now();
  if (diff <= 0) return "Maintenant";
  return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
}

const emptyForm = { name: "", purchasePrice: "", sellPrice: "", shippingCost: "", cpd: "", platform: "Facebook" };

export default function CalculateurPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lastRun, setLastRun] = useState<number>(Date.now() - 86400000);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"All" | "Winner" | "Loser">("All");
  const [justRan, setJustRan] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedRun = localStorage.getItem(LAST_RUN_KEY);
    if (stored) setProducts(JSON.parse(stored));
    if (storedRun) setLastRun(Number(storedRun));
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(products)); }, [products]);

  const runAnalysis = useCallback(() => {
    const ts = Date.now();
    setLastRun(ts);
    localStorage.setItem(LAST_RUN_KEY, String(ts));
    setJustRan(true);
    setTimeout(() => setJustRan(false), 3000);
  }, []);

  useEffect(() => {
    if (Date.now() - lastRun >= INTERVAL_DAYS * 86400000) runAnalysis();
  }, [lastRun, runAnalysis]);

  /* ── Auto-sync delivery rates from shippers ── */
  const syncRates = useCallback(async (quiet = false) => {
    if (!quiet) setSyncing(true);
    const ameexRateMap = new Map<string, ParcelStats>();
    const eagleRateMap = new Map<string, ParcelStats>();

    const rawA = localStorage.getItem(AMEEX_KEY);
    if (rawA) {
      const c = JSON.parse(rawA);
      try {
        const r = await fetch("/api/ameex", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "listParcels", apiId: c.apiId, apiKey: c.apiKey }) });
        const d = await r.json();
        const parcels: Record<string, unknown>[] = Array.isArray(d) ? d : (d?.data ?? []);
        buildRateMap(parcels, "product", "status").forEach((v, k) => ameexRateMap.set(k, v));
      } catch { /* silent */ }
    }

    const rawE = localStorage.getItem(EAGLE_KEY);
    if (rawE) {
      const c = JSON.parse(rawE);
      try {
        const r = await fetch("/api/eagle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list", tk: c.tk, sk: c.sk }) });
        const d = await r.json();
        const parcels: Record<string, unknown>[] = Array.isArray(d) ? d : [];
        buildRateMap(parcels, "product", "state").forEach((v, k) => eagleRateMap.set(k, v));
      } catch { /* silent */ }
    }

    if (ameexRateMap.size > 0 || eagleRateMap.size > 0) {
      setProducts(prev => prev.map(p => {
        const aStats = calcRateForProduct(p.name, ameexRateMap);
        const eStats = calcRateForProduct(p.name, eagleRateMap);
        if (!aStats && !eStats) return p;
        let delivered = 0, returned = 0;
        let source: Product["rateSource"] = "manual";
        if (aStats && eStats) { delivered = aStats.delivered + eStats.delivered; returned = aStats.returned + eStats.returned; source = "both"; }
        else if (aStats) { delivered = aStats.delivered; returned = aStats.returned; source = "ameex"; }
        else if (eStats) { delivered = eStats.delivered; returned = eStats.returned; source = "eagle"; }
        const total = delivered + returned;
        return { ...p, realDeliveryRate: total > 0 ? Math.round((delivered / total) * 100) : undefined, totalSent: total, totalDelivered: delivered, totalReturned: returned, rateSource: source };
      }));
      setLastSync(Date.now());
    }
    setSyncing(false);
  }, []);

  /* Auto-sync on mount and every 5 minutes */
  useEffect(() => {
    syncRates();
    const t = setInterval(() => syncRates(true), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [syncRates]);

  function handleAdd() {
    const { name, purchasePrice, sellPrice, shippingCost, cpd } = form;
    if (!name || !purchasePrice || !sellPrice || !shippingCost || !cpd) { setError("Veuillez remplir tous les champs."); return; }
    setProducts(prev => [...prev, { id: Date.now(), name, purchasePrice: Number(purchasePrice), sellPrice: Number(sellPrice), shippingCost: Number(shippingCost), cpd: Number(cpd), platform: form.platform }]);
    setForm(emptyForm); setError(""); setShowModal(false);
  }

  const FALLBACK_RATE = 70;
  const withMetrics = products.map(p => {
    const rate = p.realDeliveryRate ?? FALLBACK_RATE;
    return { ...p, ...calcMetrics(p, rate), effectiveRate: rate };
  });
  const winners = withMetrics.filter(p => p.isWinner).length;
  const losers  = withMetrics.length - winners;
  const filtered = filter === "All" ? withMetrics : filter === "Winner" ? withMetrics.filter(p => p.isWinner) : withMetrics.filter(p => !p.isWinner);
  const hasRealData = products.some(p => p.realDeliveryRate !== undefined);
  const daysLeft = daysUntilNext(lastRun);
  const timeLeft = hoursUntilNext(lastRun);
  const lastRunDate = new Date(lastRun).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" });
  const lastSyncStr = lastSync ? new Date(lastSync).toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" }) : null;

  const previewProfit = form.sellPrice && form.purchasePrice && form.shippingCost && form.cpd
    ? calcMetrics({ id: 0, name: "", purchasePrice: Number(form.purchasePrice), sellPrice: Number(form.sellPrice), shippingCost: Number(form.shippingCost), cpd: Number(form.cpd), platform: form.platform }, FALLBACK_RATE)
    : null;

  const sourceLabel: Record<NonNullable<Product["rateSource"]>, string> = { ameex: "Ameex", eagle: "Eagle", both: "Ameex + Eagle", manual: "Manuel" };
  const sourceColor: Record<NonNullable<Product["rateSource"]>, string> = { ameex: "bg-blue-50 text-blue-700", eagle: "bg-amber-50 text-amber-700", both: "bg-emerald-50 text-emerald-700", manual: "bg-slate-100 text-slate-500" };

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Calculateur Produits</h1>
            <p className="text-sm text-slate-400 hidden sm:block">Taux de livraison réel par produit — depuis Ameex & Eagle Express</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {syncing ? (
              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 animate-spin text-blue-500 shrink-0"><path d="M21 12a9 9 0 11-6.22-8.56"/></svg>
                <span className="hidden sm:inline">Mise à jour…</span>
              </div>
            ) : lastSyncStr ? (
              <div className="flex items-center gap-2 text-xs sm:text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                <span className="hidden sm:inline">Sync {lastSyncStr}</span>
              </div>
            ) : null}
            <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-blue-200 transition-colors whitespace-nowrap">
              + Ajouter
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {/* Timer banner */}
          <div className={`rounded-2xl px-5 py-4 mb-6 flex items-center gap-4 border ${justRan ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-100 shadow-sm"}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${justRan ? "bg-emerald-100" : "bg-blue-50"}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke={justRan ? "#059669" : "#2563EB"} strokeWidth={2} className="w-5 h-5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div className="flex-1">
              <p className={`text-sm font-bold ${justRan ? "text-emerald-700" : "text-slate-800"}`}>{justRan ? "Analyse complète ✓" : `Prochain recalcul dans ${timeLeft}`}</p>
              <p className="text-xs text-slate-400">Dernière analyse : {lastRunDate} — Fréquence : tous les {INTERVAL_DAYS} jours</p>
            </div>
            <div className="text-right shrink-0">
              <div className="flex gap-1">{Array.from({ length: INTERVAL_DAYS }).map((_, i) => (<div key={i} className={`w-8 h-2 rounded-full ${i < (INTERVAL_DAYS - daysLeft) ? "bg-blue-600" : "bg-slate-200"}`} />))}</div>
              <p className="text-xs text-slate-400 mt-1">{daysLeft === 0 ? "Disponible" : `J-${daysLeft}`}</p>
            </div>
          </div>

          {!hasRealData && !syncing && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 mb-6 flex items-center gap-3">
              <span className="text-amber-500 text-lg">⚠️</span>
              <p className="text-sm text-amber-700">Aucun transporteur connecté — taux affiché à <strong>70%</strong> par défaut. Configurez Ameex ou Eagle Express dans <strong>Intégrations</strong> pour obtenir les vrais taux par produit.</p>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5 mb-6">
            {[
              { label: "Produits analysés", value: products.length, sub: "total", color: "text-slate-900" },
              { label: "Winners 🏆", value: winners, sub: `taux réel`, color: "text-emerald-600" },
              { label: "Losers ❌", value: losers, sub: `taux réel`, color: "text-red-500" },
              { label: "Taux moyen livraison", value: hasRealData ? `${Math.round(withMetrics.reduce((s,p) => s + p.effectiveRate, 0) / withMetrics.length)}%` : "—", sub: hasRealData ? "données réelles transporteurs" : "aucune donnée", color: "text-blue-600" },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <p className="text-sm text-slate-500 font-medium mb-2">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-slate-400 mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="mb-4 flex items-center gap-2">
            {(["All", "Winner", "Loser"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${filter === f ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"}`}>
                {f === "All" ? `Tous (${withMetrics.length})` : f === "Winner" ? `Winners (${winners})` : `Losers (${losers})`}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {filtered.map(p => (
              <div key={p.id} className={`bg-white rounded-2xl p-5 shadow-sm border-2 transition-all ${p.isWinner ? "border-emerald-200" : "border-red-100"}`}>
                {/* WIN / LOSE banner */}
                <div className={`rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between ${p.isWinner ? "bg-emerald-600" : "bg-red-500"}`}>
                  <span className="text-white font-black text-sm">{p.isWinner ? "✓ VOUS GAGNEZ" : "✗ VOUS PERDEZ"}</span>
                  <span className="text-white font-black text-xl">{p.isWinner ? "🏆" : "❌"}</span>
                </div>

                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{p.name}</h3>
                    <span className="text-xs text-slate-400">{p.platform}</span>
                  </div>
                </div>

                {/* Delivery rate badge */}
                <div className={`rounded-xl px-3 py-2.5 mb-4 flex items-center justify-between ${p.rateSource && p.rateSource !== "manual" ? "bg-emerald-50 border border-emerald-100" : "bg-amber-50 border border-amber-100"}`}>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-0.5">Taux livraison réel</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xl font-black ${p.rateSource && p.rateSource !== "manual" ? "text-emerald-600" : "text-amber-600"}`}>{p.effectiveRate}%</span>
                      {p.rateSource && p.rateSource !== "manual" && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${sourceColor[p.rateSource]}`}>{sourceLabel[p.rateSource]}</span>
                      )}
                      {(!p.rateSource || p.rateSource === "manual") && (
                        <span className="text-xs text-amber-500 font-medium">estimation</span>
                      )}
                    </div>
                  </div>
                  {p.totalSent !== undefined && p.totalSent > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-slate-400">{p.totalDelivered} livrés</p>
                      <p className="text-xs text-slate-400">{p.totalReturned} retournés</p>
                      <p className="text-xs font-semibold text-slate-600">{p.totalSent} total</p>
                    </div>
                  )}
                </div>

                {/* Breakdown */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Prix de vente</span><span className="font-semibold text-slate-800">+{p.sellPrice} MAD</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">− Prix d&apos;achat</span><span className="text-red-400 font-medium">−{p.purchasePrice} MAD</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">− Livraison</span><span className="text-red-400 font-medium">−{p.shippingCost} MAD</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">− CPD pub</span><span className="text-red-400 font-medium">−{p.cpd.toFixed(1)} MAD</span></div>
                  <div className="border-t border-slate-100 pt-1.5 flex justify-between text-sm font-bold">
                    <span className="text-slate-600">Profit / livré</span>
                    <span className={p.profitPerDelivered >= 0 ? "text-emerald-600" : "text-red-500"}>{p.profitPerDelivered >= 0 ? "+" : ""}{p.profitPerDelivered.toFixed(1)} MAD</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-slate-600">Profit réel à {p.effectiveRate}%</span>
                    <span className={p.netPerOrder >= 0 ? "text-emerald-600" : "text-red-500"}>{p.netPerOrder >= 0 ? "+" : ""}{p.netPerOrder.toFixed(1)} MAD</span>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className={`rounded-xl p-2.5 text-center ${p.isWinner ? "bg-emerald-50" : "bg-red-50"}`}>
                    <p className="text-xs text-slate-400 mb-0.5">Marge</p>
                    <p className={`text-sm font-bold ${p.isWinner ? "text-emerald-600" : "text-red-500"}`}>{p.margin.toFixed(1)}%</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                    <p className="text-xs text-slate-400 mb-0.5">ROI</p>
                    <p className="text-sm font-bold text-blue-600">{p.roi.toFixed(0)}%</p>
                  </div>
                  <div className={`rounded-xl p-2.5 text-center ${p.effectiveRate >= p.breakEvenRate ? "bg-emerald-50" : "bg-amber-50"}`}>
                    <p className="text-xs text-slate-400 mb-0.5">Seuil min</p>
                    <p className={`text-sm font-bold ${p.effectiveRate >= p.breakEvenRate ? "text-emerald-600" : "text-amber-600"}`}>{p.breakEvenRate.toFixed(0)}%</p>
                  </div>
                </div>

                {/* Break-even bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Seuil rentabilité</span>
                    <span className={p.effectiveRate >= p.breakEvenRate ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"}>
                      {p.effectiveRate >= p.breakEvenRate ? `+${(p.effectiveRate - p.breakEvenRate).toFixed(0)}% au-dessus` : `${(p.breakEvenRate - p.effectiveRate).toFixed(0)}% manquant`}
                    </span>
                  </div>
                  <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="absolute h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, p.effectiveRate)}%` }} />
                    <div className="absolute top-0 h-full w-0.5 bg-slate-900" style={{ left: `${p.breakEvenRate}%` }} />
                  </div>
                </div>

                <button onClick={() => setProducts(prev => prev.filter(x => x.id !== p.id))} className="w-full py-1.5 text-xs text-red-400 hover:text-red-600 font-medium border border-red-100 hover:bg-red-50 rounded-xl transition-colors">
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        </main>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Ajouter un produit</h2>
              <button onClick={() => { setShowModal(false); setError(""); setForm(emptyForm); }} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600 mb-2 block">Plateforme pub</label>
              <div className="flex gap-2">
                {["Facebook", "TikTok"].map(pl => (
                  <button key={pl} onClick={() => setForm(f => ({ ...f, platform: pl }))}
                    className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${form.platform === pl ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-500"}`}>{pl}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "name", label: "Nom du produit *", placeholder: "Ex: Montre Sport", full: true },
                { key: "purchasePrice", label: "Prix d'achat (MAD) *", placeholder: "120" },
                { key: "sellPrice", label: "Prix de vente (MAD) *", placeholder: "350" },
                { key: "shippingCost", label: "Frais livraison (MAD) *", placeholder: "25" },
                { key: "cpd", label: "CPD pub (MAD) *", placeholder: "29.3" },
              ].map(({ key, label, placeholder, full }) => (
                <div key={key} className={full ? "col-span-2" : ""}>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
                  <input type="text" placeholder={placeholder} value={form[key as keyof typeof emptyForm]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                </div>
              ))}
            </div>
            {previewProfit !== null && (
              <div className={`mt-4 p-4 rounded-xl border ${previewProfit.isWinner ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-black ${previewProfit.isWinner ? "text-emerald-700" : "text-red-600"}`}>{previewProfit.isWinner ? "✓ VOUS GAGNEZ" : "✗ VOUS PERDEZ"}</p>
                    <p className={`text-lg font-bold mt-0.5 ${previewProfit.netPerOrder >= 0 ? "text-emerald-600" : "text-red-500"}`}>{previewProfit.netPerOrder >= 0 ? "+" : ""}{previewProfit.netPerOrder.toFixed(1)} MAD / commande</p>
                  </div>
                  <span className="text-3xl">{previewProfit.isWinner ? "🏆" : "❌"}</span>
                </div>
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowModal(false); setError(""); setForm(emptyForm); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
              <button onClick={handleAdd} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-200">Ajouter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
