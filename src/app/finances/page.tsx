"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "@/components/Sidebar";

type Order = {
  id: string;
  totalPrice?: number;
  total_price?: string | number;
  status?: string;
  product?: string;
  quantity?: number;
  receivedAt?: string;
  received_at?: string;
};

type Product = {
  id: string;
  name: string;
  purchasePrice: number;
  sellPrice: number;
};

type Period = "today" | "week" | "month" | "all";

const STORAGE_KEY = "codcrm_finance_costs_v1";

type CostSettings = {
  dailyAdsBudget: number;
  confirmationCostPerOrder: number;
  shippingCostPerOrder: number;
  returnShippingCost: number;
};

type Campaign = {
  id: number;
  date: string;
  spend: number;
};

type Virement = {
  id: number;
  date: string;
  amount: number;
  note: string;
};

const DEFAULT_COSTS: CostSettings = {
  dailyAdsBudget: 0,
  confirmationCostPerOrder: 0,
  shippingCostPerOrder: 38, // Eagle Express flat rate
  returnShippingCost: 0,
};

function parsePrice(v: unknown): number {
  return parseFloat(String(v ?? "0")) || 0;
}

function getDate(o: Order): Date {
  return new Date(o.receivedAt ?? o.received_at ?? "");
}

function startOf(period: Period): Date {
  const now = new Date();
  if (period === "today") { const d = new Date(now); d.setHours(0,0,0,0); return d; }
  if (period === "week")  { const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d; }
  if (period === "month") { const d = new Date(now); d.setDate(d.getDate() - 29); d.setHours(0,0,0,0); return d; }
  return new Date(0);
}

function daysBetween(a: Date, b: Date) {
  return Math.max(1, Math.ceil((b.getTime() - a.getTime()) / 86400000));
}

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function FinancesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("week");
  const [costs, setCosts] = useState<CostSettings>(DEFAULT_COSTS);
  const [editingCosts, setEditingCosts] = useState(false);
  const [draftCosts, setDraftCosts] = useState<CostSettings>(DEFAULT_COSTS);
  const [sendingReport, setSendingReport] = useState(false);
  const reportSentRef = useRef(false);
  const [virements, setVirements] = useState<Virement[]>([]);
  const [showAddVirement, setShowAddVirement] = useState(false);
  const [draftVirement, setDraftVirement] = useState({ date: new Date().toISOString().slice(0, 10), amount: "", note: "" });

  // Load cost settings and ad campaigns from Supabase
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        const serverCosts = data.settings?.financeCosts;
        if (serverCosts) setCosts({ ...DEFAULT_COSTS, ...serverCosts });
        else {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) { try { setCosts(JSON.parse(stored)); } catch { /* ignore */ } }
        }
        const saved = data.settings?.adCampaigns;
        if (Array.isArray(saved)) setCampaigns(saved);
        const savedVirements = data.settings?.virements;
        if (Array.isArray(savedVirements)) setVirements(savedVirements as Virement[]);
      } catch { /* ignore */ }
    }
    loadSettings();
  }, []);

  async function saveCosts() {
    setCosts(draftCosts);
    setEditingCosts(false);
    // Save to Supabase
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ financeCosts: draftCosts }),
      });
    } catch { /* silent */ }
    // Also keep localStorage as backup
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draftCosts)); } catch { /* ignore */ }
  }

  async function addVirement() {
    const amount = parseFloat(draftVirement.amount) || 0;
    if (!amount) return;
    const updated = [...virements, { id: Date.now(), date: draftVirement.date, amount, note: draftVirement.note }];
    setVirements(updated);
    setShowAddVirement(false);
    setDraftVirement({ date: new Date().toISOString().slice(0, 10), amount: "", note: "" });
    try {
      await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ virements: updated }) });
    } catch { /* silent */ }
  }

  async function removeVirement(id: number) {
    const updated = virements.filter(v => v.id !== id);
    setVirements(updated);
    try {
      await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ virements: updated }) });
    } catch { /* silent */ }
  }

  async function sendTelegramReport() {
    setSendingReport(true);
    const d = new Date().toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" });
    const message = [
      `📊 <b>Rapport journalier — ${d}</b>`,
      ``,
      `💰 CA livré : <b>${fmt(revenue)} MAD</b> (${delivered.length} cmds)`,
      `💸 Total investi : <b>${fmt(totalCost)} MAD</b>`,
      `🏆 Bénéfice net : <b>${netProfit >= 0 ? "+" : ""}${fmt(netProfit)} MAD</b> (ROI ${roi.toFixed(0)}%)`,
      ``,
      `📦 Expédiées : ${shipped.length} · Livrées : ${delivered.length} · Retournées : ${returned.length}`,
      `📈 Taux livraison : ${delivered.length && shipped.length ? ((delivered.length / shipped.length) * 100).toFixed(0) : 0}%`,
    ].join("\n");
    try {
      const res = await fetch("/api/telegram-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) { reportSentRef.current = true; alert("Rapport envoyé sur Telegram ✓"); }
      else alert("Erreur: " + (data.error ?? "inconnu"));
    } catch (e) { alert(String(e)); }
    setSendingReport(false);
  }

  const fetchData = useCallback(async () => {
    try {
      const [oRes, pRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/products"),
      ]);
      const oData = await oRes.json();
      const pData = await pRes.json();
      setOrders(oData.orders ?? []);
      setProducts(pData.products ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filtered orders by period ──────────────────────────────────────────
  const start = startOf(period);
  const now = new Date();
  const filtered = orders.filter(o => {
    const d = getDate(o);
    return d >= start && d <= now;
  });

  const days = period === "all" ? daysBetween(
    orders.length ? getDate(orders[orders.length - 1]) : now, now
  ) : period === "today" ? 1 : period === "week" ? 7 : 30;

  // Build purchase price map from product catalog
  const purchaseMap: Record<string, number> = {};
  for (const p of products) purchaseMap[p.name.toLowerCase().trim()] = p.purchasePrice;

  // ── Revenue ────────────────────────────────────────────────────────────
  const delivered = filtered.filter(o => {
    const s = String(o.status ?? "").toLowerCase();
    return s === "livré" || s === "livre" || s === "delivered";
  });
  // confirmed = orders that went through confirmation (exclude nouveau/injoignable/fausse)
  const confirmed = filtered.filter(o => {
    const s = String(o.status ?? "").toLowerCase();
    return s === "confirmé" || s === "confirme" || s === "confirmed"
      || s === "expédié" || s === "expedie"
      || s === "livré" || s === "livre"
      || s === "retourné" || s === "retourne";
  });
  // shipped = physically sent via carrier (confirmation + shipping fee applies)
  const shipped = filtered.filter(o => {
    const s = String(o.status ?? "").toLowerCase();
    return s === "expédié" || s === "expedie"
      || s === "livré" || s === "livre"
      || s === "retourné" || s === "retourne";
  });
  const returned = filtered.filter(o => {
    const s = String(o.status ?? "").toLowerCase();
    return s === "retourné" || s === "retourne" || s === "returned" || s === "annulé" || s === "annule";
  });

  const revenue = delivered.reduce((s, o) => s + parsePrice(o.totalPrice ?? o.total_price), 0);

  // ── Costs ──────────────────────────────────────────────────────────────
  // Product purchase cost: use catalog price if available, else estimate from sell price
  const productCost = confirmed.reduce((s, o) => {
    const key = String(o.product ?? "").toLowerCase().trim();
    const purchase = purchaseMap[key] ?? 0;
    const qty = Number(o.quantity) || 1;
    return s + purchase * qty;
  }, 0);

  // Sum actual campaign spend within the period; fall back to daily budget if none entered
  const campaignsInPeriod = campaigns.filter(c => {
    const d = new Date(c.date);
    return d >= start && d <= now;
  });
  const campaignAdSpend = campaignsInPeriod.reduce((s, c) => s + c.spend, 0);
  const adsCost = campaignAdSpend > 0 ? campaignAdSpend : costs.dailyAdsBudget * days;
  const confirmCost = shipped.length * costs.confirmationCostPerOrder;
  const shippingCost = shipped.length * costs.shippingCostPerOrder; // only on shipped orders
  const returnCost = returned.length * costs.returnShippingCost;

  const totalCost = productCost + adsCost + confirmCost + shippingCost + returnCost;
  const netProfit = revenue - totalCost;
  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  const profitPerDay = netProfit / days;
  const profitPerWeek = profitPerDay * 7;

  // ── Cost per lead ──────────────────────────────────────────────────────────
  const costPerLead = filtered.length > 0 ? adsCost / filtered.length : 0;
  const avgRevPerDelivery = delivered.length > 0 ? revenue / delivered.length : 0;

  // ── Break-even ─────────────────────────────────────────────────────────────
  const avgPurchasePerOrder = confirmed.length > 0 ? productCost / confirmed.length : 0;
  const marginPerDelivery = avgRevPerDelivery - costs.shippingCostPerOrder - costs.confirmationCostPerOrder - avgPurchasePerOrder;
  const breakEvenOrders = marginPerDelivery > 0 ? Math.ceil(adsCost / marginPerDelivery) : 0;
  const breakEvenRemaining = Math.max(0, breakEvenOrders - delivered.length);
  const breakEvenProgress = breakEvenOrders > 0 ? Math.min(100, (delivered.length / breakEvenOrders) * 100) : 100;

  // ── Cash flow ──────────────────────────────────────────────────────────────
  const virementsInPeriod = virements.filter(v => { const d = new Date(v.date); return d >= start && d <= now; });
  const totalVirements = virementsInPeriod.reduce((s, v) => s + v.amount, 0);
  const pendingVirement = revenue - totalVirements;

  // ── Return rate per city ───────────────────────────────────────────────
  const cityStats = (() => {
    const map: Record<string, { shipped: number; returned: number }> = {};
    for (const o of filtered) {
      const s = String(o.status ?? "").toLowerCase();
      const city = String((o as Record<string,unknown>).city ?? "").trim() || "Inconnue";
      const isShipped = s === "expédié" || s === "expedie" || s === "livré" || s === "livre" || s === "retourné" || s === "retourne";
      const isReturned = s === "retourné" || s === "retourne";
      if (!isShipped) continue;
      if (!map[city]) map[city] = { shipped: 0, returned: 0 };
      map[city].shipped++;
      if (isReturned) map[city].returned++;
    }
    return Object.entries(map)
      .map(([city, v]) => ({ city, ...v, rate: v.shipped > 0 ? (v.returned / v.shipped) * 100 : 0 }))
      .filter(c => c.shipped >= 2)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10);
  })();

  // ── Return rate per product ────────────────────────────────────────────
  const productStats = (() => {
    const map: Record<string, { shipped: number; returned: number; revenue: number }> = {};
    for (const o of filtered) {
      const s = String(o.status ?? "").toLowerCase();
      const prod = String((o as Record<string,unknown>).product ?? "").trim() || "Inconnu";
      const isShipped = s === "expédié" || s === "expedie" || s === "livré" || s === "livre" || s === "retourné" || s === "retourne";
      const isDelivered = s === "livré" || s === "livre";
      const isReturned = s === "retourné" || s === "retourne";
      if (!isShipped) continue;
      if (!map[prod]) map[prod] = { shipped: 0, returned: 0, revenue: 0 };
      map[prod].shipped++;
      if (isReturned) map[prod].returned++;
      if (isDelivered) map[prod].revenue += parsePrice((o as Record<string,unknown>).totalPrice ?? (o as Record<string,unknown>).total_price);
    }
    return Object.entries(map)
      .map(([product, v]) => ({ product, ...v, rate: v.shipped > 0 ? (v.returned / v.shipped) * 100 : 0 }))
      .filter(p => p.shipped >= 2)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 8);
  })();

  // Build campaign spend by day for chart
  const campaignSpendByDay: Record<string, number> = {};
  for (const c of campaigns) {
    campaignSpendByDay[c.date] = (campaignSpendByDay[c.date] ?? 0) + c.spend;
  }

  // ── Daily breakdown for mini chart ────────────────────────────────────
  const dailyMap: Record<string, { revenue: number; cost: number }> = {};
  for (const o of filtered) {
    const d = getDate(o);
    if (isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    if (!dailyMap[key]) dailyMap[key] = { revenue: 0, cost: 0 };
    const s = String(o.status ?? "").toLowerCase();
    const isDelivered = s === "livré" || s === "livre" || s === "delivered";
    if (isDelivered) dailyMap[key].revenue += parsePrice(o.totalPrice ?? o.total_price);
    const dayAdSpend = campaignSpendByDay[key] !== undefined ? 0 : costs.dailyAdsBudget;
    dailyMap[key].cost += dayAdSpend + costs.confirmationCostPerOrder + costs.shippingCostPerOrder;
  }
  // Add campaign ad spend into chart days (may not overlap with order days)
  for (const [day, spend] of Object.entries(campaignSpendByDay)) {
    const d = new Date(day);
    if (d >= start && d <= now) {
      if (!dailyMap[day]) dailyMap[day] = { revenue: 0, cost: 0 };
      dailyMap[day].cost += spend;
    }
  }
  const chartDays = Object.keys(dailyMap).sort().slice(-14);
  const maxVal = Math.max(1, ...chartDays.map(d => Math.max(dailyMap[d].revenue, dailyMap[d].cost)));

  const PERIODS: { key: Period; label: string }[] = [
    { key: "today", label: "Aujourd'hui" },
    { key: "week", label: "7 jours" },
    { key: "month", label: "30 jours" },
    { key: "all", label: "Tout" },
  ];

  const costFields: { key: keyof CostSettings; label: string; placeholder: string }[] = [
    { key: "dailyAdsBudget", label: "Budget pub / jour (MAD)", placeholder: "ex: 150" },
    { key: "confirmationCostPerOrder", label: "Confirmation / commande (MAD)", placeholder: "ex: 7" },
    { key: "shippingCostPerOrder", label: "Frais livraison / commande (MAD)", placeholder: "ex: 38" },
    { key: "returnShippingCost", label: "Frais retour / commande (MAD)", placeholder: "ex: 15" },
  ];

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Finances</h1>
            <p className="text-sm text-slate-400">Investissement · Revenus · Bénéfice net</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period selector */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${period === p.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={sendTelegramReport} disabled={sendingReport}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 bg-white disabled:opacity-50">
              {sendingReport ? "Envoi…" : "📨 Rapport Telegram"}
            </button>
            <button onClick={() => { setDraftCosts({ ...costs }); setEditingCosts(true); }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 bg-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Modifier coûts
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <>
              {/* ── Main KPIs ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-5">
                {[
                  { label: "Chiffre d'affaires", value: `${fmt(revenue)} MAD`, sub: `${delivered.length} cmds livrées`, color: "text-emerald-600", bg: "bg-emerald-50", icon: "📦" },
                  { label: "Total investi", value: `${fmt(totalCost)} MAD`, sub: `produits + pub + conf. + livraison`, color: "text-red-500", bg: "bg-red-50", icon: "💸" },
                  { label: "Bénéfice net", value: `${netProfit >= 0 ? "+" : ""}${fmt(netProfit)} MAD`, sub: `ROI ${roi >= 0 ? "+" : ""}${roi.toFixed(0)}%`, color: netProfit >= 0 ? "text-blue-600" : "text-red-600", bg: netProfit >= 0 ? "bg-blue-50" : "bg-red-50", icon: netProfit >= 0 ? "🏆" : "⚠️" },
                  { label: "Bénéfice / jour", value: `${profitPerDay >= 0 ? "+" : ""}${fmt(profitPerDay)} MAD`, sub: `${profitPerWeek >= 0 ? "+" : ""}${fmt(profitPerWeek)} MAD / semaine`, color: profitPerDay >= 0 ? "text-violet-600" : "text-red-500", bg: profitPerDay >= 0 ? "bg-violet-50" : "bg-red-50", icon: "📅" },
                ].map(k => (
                  <div key={k.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">{k.icon}</span>
                      <p className="text-xs text-slate-500 font-medium">{k.label}</p>
                    </div>
                    <p className={`text-xl lg:text-2xl font-black ${k.color}`}>{k.value}</p>
                    <p className="text-xs text-slate-400 mt-1">{k.sub}</p>
                  </div>
                ))}
              </div>

              {/* ── Cost per lead + Break-even ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🎯</span>
                    <p className="text-xs text-slate-500 font-medium">Coût par lead</p>
                  </div>
                  <p className="text-2xl font-black text-orange-600">{fmt(costPerLead)} MAD</p>
                  <p className="text-xs text-slate-400 mt-1">{fmt(adsCost)} MAD pub ÷ {filtered.length} commandes</p>
                  {costPerLead > 0 && avgRevPerDelivery > 0 && (
                    <p className="text-xs mt-2">
                      {costPerLead < avgRevPerDelivery * 0.2
                        ? <span className="text-emerald-600 font-semibold">✅ CPL excellent</span>
                        : costPerLead < avgRevPerDelivery * 0.4
                        ? <span className="text-amber-600 font-semibold">⚠️ CPL acceptable</span>
                        : <span className="text-red-600 font-semibold">❌ CPL élevé — réduire pub</span>
                      }
                    </p>
                  )}
                  {filtered.length === 0 && <p className="text-xs text-slate-400 mt-2">Aucune commande sur la période</p>}
                </div>

                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">📐</span>
                    <p className="text-xs text-slate-500 font-medium">Seuil de rentabilité</p>
                  </div>
                  {marginPerDelivery > 0 && breakEvenOrders > 0 ? (
                    <>
                      <p className="text-2xl font-black text-slate-800">{breakEvenOrders} <span className="text-sm font-semibold text-slate-400">livraisons</span></p>
                      <p className="text-xs text-slate-400 mt-1">pour couvrir {fmt(adsCost)} MAD pub · marge {fmt(marginPerDelivery)} MAD/cmd</p>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500">{delivered.length} livrées</span>
                          <span className={breakEvenRemaining === 0 ? "text-emerald-600 font-bold" : "text-slate-500"}>
                            {breakEvenRemaining === 0 ? "✅ Rentable!" : `encore ${breakEvenRemaining}`}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${breakEvenRemaining === 0 ? "bg-emerald-500" : "bg-blue-500"}`}
                            style={{ width: `${breakEvenProgress}%` }} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400 mt-1">Ajoutez les prix d&apos;achat produits et le budget pub pour calculer le seuil.</p>
                  )}
                </div>
              </div>

              {/* ── Cost breakdown ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                {/* Investment breakdown */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <h2 className="text-sm font-bold text-slate-700 mb-4">💸 Détail des coûts</h2>
                  <div className="space-y-3">
                    {[
                      { label: "Achats produits", value: productCost, sub: `${confirmed.length} cmds confirmées`, color: "bg-orange-500" },
                      { label: "Budget publicité", value: adsCost, sub: campaignAdSpend > 0 ? `${campaignsInPeriod.length} campagne(s) — Ads Manager` : `${costs.dailyAdsBudget} MAD × ${days} jours`, color: "bg-blue-500" },
                      { label: "Centre confirmation", value: confirmCost, sub: `${shipped.length} expédiées × ${costs.confirmationCostPerOrder} MAD`, color: "bg-violet-500" },
                      { label: "🦅 Livraison Eagle Express", value: shippingCost, sub: `${shipped.length} colis expédiés × ${costs.shippingCostPerOrder} MAD`, color: "bg-amber-500" },
                      { label: "Frais retour", value: returnCost, sub: `${returned.length} × ${costs.returnShippingCost} MAD`, color: "bg-red-400" },
                    ].map(item => {
                      const pct = totalCost > 0 ? (item.value / totalCost) * 100 : 0;
                      return (
                        <div key={item.label}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-slate-600 font-medium">{item.label}</span>
                            <span className="font-bold text-slate-800">{fmt(item.value)} MAD</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>
                        </div>
                      );
                    })}
                    <div className="border-t border-slate-100 pt-3 flex justify-between">
                      <span className="text-sm font-bold text-slate-700">Total investi</span>
                      <span className="text-sm font-black text-red-600">{fmt(totalCost)} MAD</span>
                    </div>
                  </div>
                </div>

                {/* Orders summary */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <h2 className="text-sm font-bold text-slate-700 mb-4">📊 Résumé commandes</h2>
                  <div className="space-y-3 mb-5">
                    {[
                      { label: "Total commandes", value: filtered.length, color: "text-slate-800" },
                      { label: "Confirmées (centre conf.)", value: confirmed.length, color: "text-blue-600" },
                      { label: "Expédiées (Eagle)", value: shipped.length, color: "text-amber-600" },
                      { label: "Livrées ✅", value: delivered.length, color: "text-emerald-600" },
                      { label: "Retournées ❌", value: returned.length, color: "text-red-500" },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                        <span className="text-sm text-slate-500">{r.label}</span>
                        <span className={`text-sm font-black ${r.color}`}>{r.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Delivery rate */}
                  {filtered.length > 0 && (
                    <div className={`rounded-2xl px-4 py-3 ${delivered.length / filtered.length >= 0.6 ? "bg-emerald-50 border border-emerald-100" : "bg-amber-50 border border-amber-100"}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-600">Taux de livraison</span>
                        <span className={`text-lg font-black ${delivered.length / filtered.length >= 0.6 ? "text-emerald-700" : "text-amber-700"}`}>
                          {((delivered.length / filtered.length) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 bg-white rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${delivered.length / filtered.length >= 0.6 ? "bg-emerald-500" : "bg-amber-500"}`}
                          style={{ width: `${(delivered.length / filtered.length) * 100}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Daily chart ── */}
              {chartDays.length > 0 && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-5">
                  <h2 className="text-sm font-bold text-slate-700 mb-1">📈 Revenu vs Coûts (14 derniers jours)</h2>
                  <p className="text-xs text-slate-400 mb-4">Bleu = revenu livré · Rouge = coûts estimés</p>
                  <div className="flex items-end gap-1 h-28">
                    {chartDays.map(day => {
                      const d = dailyMap[day];
                      const rh = (d.revenue / maxVal) * 100;
                      const ch = (d.cost / maxVal) * 100;
                      const label = new Date(day).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit" });
                      return (
                        <div key={day} className="flex-1 flex flex-col items-center gap-0.5">
                          <div className="w-full flex items-end gap-0.5 h-20">
                            <div className="flex-1 bg-blue-400 rounded-t-sm transition-all" style={{ height: `${rh}%` }} title={`Revenu: ${fmt(d.revenue)} MAD`} />
                            <div className="flex-1 bg-red-300 rounded-t-sm transition-all" style={{ height: `${ch}%` }} title={`Coûts: ${fmt(d.cost)} MAD`} />
                          </div>
                          <span className="text-[9px] text-slate-400 whitespace-nowrap">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── City + Product return rates ── */}
              {(cityStats.length > 0 || productStats.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                  {/* Return rate by city */}
                  {cityStats.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                      <h2 className="text-sm font-bold text-slate-700 mb-4">🏙 Taux retour par ville</h2>
                      <div className="space-y-2">
                        {cityStats.map(c => (
                          <div key={c.city}>
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className="text-slate-700 font-medium truncate flex-1">{c.city}</span>
                              <span className={`font-bold ml-2 ${c.rate >= 50 ? "text-red-600" : c.rate >= 30 ? "text-orange-500" : "text-emerald-600"}`}>
                                {c.rate.toFixed(0)}%
                              </span>
                              <span className="text-slate-400 ml-2 text-[10px]">{c.returned}/{c.shipped}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${c.rate >= 50 ? "bg-red-500" : c.rate >= 30 ? "bg-orange-400" : "bg-emerald-400"}`}
                                style={{ width: `${Math.min(100, c.rate)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Return rate by product */}
                  {productStats.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                      <h2 className="text-sm font-bold text-slate-700 mb-4">📦 Taux retour par produit</h2>
                      <div className="space-y-2">
                        {productStats.map(p => (
                          <div key={p.product}>
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className="text-slate-700 font-medium truncate flex-1">{p.product}</span>
                              <span className={`font-bold ml-2 ${p.rate >= 50 ? "text-red-600" : p.rate >= 30 ? "text-orange-500" : "text-emerald-600"}`}>
                                {p.rate.toFixed(0)}%
                              </span>
                              <span className="text-slate-400 ml-2 text-[10px]">{p.returned}/{p.shipped}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${p.rate >= 50 ? "bg-red-500" : p.rate >= 30 ? "bg-orange-400" : "bg-emerald-400"}`}
                                style={{ width: `${Math.min(100, p.rate)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Profit projection ── */}
              <div className="bg-gradient-to-br from-blue-600 to-violet-600 rounded-2xl p-5 text-white shadow-lg">
                <h2 className="text-sm font-bold opacity-80 mb-4">🎯 Projection bénéfice</h2>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "/ Jour", value: fmt(profitPerDay) },
                    { label: "/ Semaine", value: fmt(profitPerWeek) },
                    { label: "/ Mois (30j)", value: fmt(profitPerDay * 30) },
                  ].map(p => (
                    <div key={p.label} className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
                      <p className="text-xs opacity-70 mb-1">{p.label}</p>
                      <p className="text-lg font-black">{p.value}</p>
                      <p className="text-xs opacity-60">MAD</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Cash flow tracker ── */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mt-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-700">💰 Suivi des virements Eagle Express</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Enregistrez les paiements reçus d&apos;Eagle Express</p>
                  </div>
                  <button onClick={() => setShowAddVirement(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">
                    {showAddVirement ? "Annuler" : "+ Ajouter virement"}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">CA attendu (livré)</p>
                    <p className="text-lg font-black text-emerald-700">{fmt(revenue)} MAD</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Virements reçus</p>
                    <p className="text-lg font-black text-blue-700">{fmt(totalVirements)} MAD</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${pendingVirement > 0 ? "bg-amber-50" : "bg-emerald-50"}`}>
                    <p className="text-xs text-slate-500 mb-1">En attente</p>
                    <p className={`text-lg font-black ${pendingVirement > 0 ? "text-amber-700" : "text-emerald-700"}`}>{fmt(pendingVirement)} MAD</p>
                  </div>
                </div>

                {showAddVirement && (
                  <div className="bg-slate-50 rounded-xl p-4 mb-4 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">Date du virement</label>
                        <input type="date" value={draftVirement.date}
                          onChange={e => setDraftVirement(d => ({ ...d, date: e.target.value }))}
                          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">Montant (MAD)</label>
                        <input type="number" min="0" placeholder="ex: 5200"
                          value={draftVirement.amount}
                          onChange={e => setDraftVirement(d => ({ ...d, amount: e.target.value }))}
                          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Note (optionnel)</label>
                      <input type="text" placeholder="ex: Virement semaine 22"
                        value={draftVirement.note}
                        onChange={e => setDraftVirement(d => ({ ...d, note: e.target.value }))}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400" />
                    </div>
                    <button onClick={addVirement}
                      className="self-end px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">
                      Enregistrer
                    </button>
                  </div>
                )}

                {virementsInPeriod.length > 0 ? (
                  <div className="space-y-2">
                    {[...virementsInPeriod].sort((a, b) => b.date.localeCompare(a.date)).map(v => (
                      <div key={v.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">{new Date(v.date).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                          <span className="text-sm font-bold text-slate-800">{fmt(v.amount)} MAD</span>
                          {v.note && <span className="text-xs text-slate-500 italic">{v.note}</span>}
                        </div>
                        <button onClick={() => removeVirement(v.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-400 py-4">Aucun virement enregistré pour cette période</p>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── Cost settings modal ── */}
      {editingCosts && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Paramètres des coûts</h2>
              <button onClick={() => setEditingCosts(false)} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-5">Ces valeurs servent à calculer votre investissement total. Les achats produits sont automatiquement tirés du catalogue.</p>
            <div className="flex flex-col gap-4">
              {costFields.map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">{f.label}</label>
                  <input type="number" min="0" placeholder={f.placeholder}
                    value={draftCosts[f.key] || ""}
                    onChange={e => setDraftCosts(d => ({ ...d, [f.key]: parseFloat(e.target.value) || 0 }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingCosts(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
              <button onClick={saveCosts} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-200">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
