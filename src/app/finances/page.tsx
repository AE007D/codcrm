"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import { Package, TrendingDown, TrendingUp, Target, Bird, ArrowUpRight, ArrowDownRight, ArrowRight, Wallet, ChevronDown, CheckCircle2 } from "lucide-react";
import { useLang } from "@/lib/i18n";

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
  stockMovements?: { createdAt: string; quantity: number; totalCost: number }[];
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
  const { t } = useLang();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [period, setPeriod] = useState<Period>("week");
  const [costs, setCosts] = useState<CostSettings>(DEFAULT_COSTS);
  const [editingCosts, setEditingCosts] = useState(false);
  const [draftCosts, setDraftCosts] = useState<CostSettings>(DEFAULT_COSTS);
  const [sendingReport, setSendingReport] = useState(false);
  const reportSentRef = useRef(false);
  const [virements, setVirements] = useState<Virement[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<{ amount: number; status: string; created_at: string }[]>([]);
  const [showAddVirement, setShowAddVirement] = useState(false);
  const [draftVirement, setDraftVirement] = useState({ date: new Date().toISOString().slice(0, 10), amount: "", note: "" });

  // Load cost settings and ad campaigns from Supabase
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error("Settings unavailable");
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
      } catch { setLoadError(true); }
      finally { setSettingsLoading(false); }
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
      `💸 Coûts de la période : <b>${fmt(totalCost)} MAD</b>`,
      `🏆 Bénéfice net : <b>${netProfit >= 0 ? "+" : ""}${fmt(netProfit)} MAD</b> (résultat de la période)`,
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
      const [oRes, pRes, prRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/products"),
        fetch("/api/payment-requests"),
      ]);
      if (![oRes, pRes, prRes].every(response => response.ok)) throw new Error("Finance data unavailable");
      const oData = await oRes.json();
      const pData = await pRes.json();
      const prData = await prRes.json();
      setOrders(oData.orders ?? []);
      setProducts(pData.products ?? []);
      setPaymentRequests(prData.requests ?? []);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void Promise.resolve().then(fetchData); }, [fetchData]);

  // ── Filtered orders by period ──────────────────────────────────────────
  const start = startOf(period);
  const now = new Date();
  const filtered = orders.filter(o => {
    const d = getDate(o);
    return d >= start && d <= now;
  });

  const earliestOrder = new Date(Math.min(now.getTime(), ...orders.map(o => getDate(o).getTime()).filter(Number.isFinite)));
  earliestOrder.setHours(0, 0, 0, 0);
  const days = period === "all" ? daysBetween(earliestOrder, now) : period === "today" ? 1 : period === "week" ? 7 : 30;

  const stockPurchases = products.flatMap(product => product.stockMovements ?? []).filter(movement => {
    const date = new Date(movement.createdAt);
    return date >= start && date <= now;
  });
  const stockPurchaseTotal = stockPurchases.reduce((total, movement) => total + (Number(movement.totalCost) || 0), 0);
  const stockUnitsReceived = stockPurchases.reduce((total, movement) => total + (Number(movement.quantity) || 0), 0);

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
      || s === "retourné" || s === "retourne" || s === "shipped" || s === "delivered" || s === "returned";
  });
  // shipped = physically sent via carrier (confirmation + shipping fee applies)
  const shipped = filtered.filter(o => {
    const s = String(o.status ?? "").toLowerCase();
    return s === "expédié" || s === "expedie"
      || s === "livré" || s === "livre"
      || s === "retourné" || s === "retourne" || s === "shipped" || s === "delivered" || s === "returned";
  });
  const returned = filtered.filter(o => {
    const s = String(o.status ?? "").toLowerCase();
    return s === "retourné" || s === "retourne" || s === "returned";
  });

  const revenue = delivered.reduce((s, o) => s + parsePrice(o.totalPrice ?? o.total_price), 0);

  // ── Costs ──────────────────────────────────────────────────────────────
  // Product purchase cost: only count delivered orders
  const productCostByProduct: Record<string, { qty: number; cost: number; revenue: number }> = {};
  for (const o of delivered) {
    const key = String(o.product ?? "").trim();
    const keyLow = key.toLowerCase();
    const purchase = purchaseMap[keyLow] ?? 0;
    const qty = Number(o.quantity) || 1;
    const rev = parsePrice(o.totalPrice ?? o.total_price);
    if (!productCostByProduct[key]) productCostByProduct[key] = { qty: 0, cost: 0, revenue: 0 };
    productCostByProduct[key].qty += qty;
    productCostByProduct[key].cost += purchase * qty;
    productCostByProduct[key].revenue += rev;
  }
  const productCost = Object.values(productCostByProduct).reduce((s, v) => s + v.cost, 0);

  // Sum actual campaign spend within the period; fall back to daily budget if none entered
  const campaignsInPeriod = campaigns.filter(c => {
    const d = new Date(c.date);
    return d >= start && d <= now;
  });
  const campaignAdSpend = campaignsInPeriod.reduce((s, c) => s + c.spend, 0);
  const adsCost = campaignAdSpend > 0 ? campaignAdSpend : costs.dailyAdsBudget * days;
  // Eagle Express only charges on delivered orders (not returned/in-transit)
  const shippingCost = delivered.length * costs.shippingCostPerOrder;
  // Agent commissions: pending + paid in this period
  const commissionCost = paymentRequests
    .filter(r => {
      if (r.status === "rejected") return false;
      const d = new Date(r.created_at);
      return d >= start && d <= now;
    })
    .reduce((s, r) => s + r.amount, 0);

  const confirmationCost = delivered.length * costs.confirmationCostPerOrder;
  const totalCost = productCost + adsCost + shippingCost + confirmationCost + commissionCost;
  const netProfit = revenue - totalCost;

  // Campaign spend and agent commissions are distributed by order volume for per-product reporting.
  const productProfitMap: Record<string, {
    name: string; orderCount: number; confirmedOrders: number; deliveredOrders: number;
    shippedOrders: number; returnedOrders: number; deliveredQty: number; revenue: number;
    purchaseCost: number;
  }> = {};
  for (const o of filtered) {
    const name = String(o.product ?? "").trim() || "Inconnu";
    const key = name.toLowerCase();
    const row = productProfitMap[key] ?? {
      name, orderCount: 0, confirmedOrders: 0, deliveredOrders: 0, shippedOrders: 0,
      returnedOrders: 0, deliveredQty: 0, revenue: 0, purchaseCost: 0,
    };
    const status = String(o.status ?? "").toLowerCase();
    const isDelivered = status === "livré" || status === "livre" || status === "delivered";
    const isConfirmed = ["confirmé", "confirme", "confirmed", "expédié", "expedie", "livré", "livre", "retourné", "retourne", "shipped", "delivered", "returned"].includes(status);
    const isShipped = ["expédié", "expedie", "livré", "livre", "retourné", "retourne", "shipped", "delivered", "returned"].includes(status);
    const isReturned = ["retourné", "retourne", "returned"].includes(status);
    const qty = Number(o.quantity) || 1;
    row.orderCount += 1;
    if (isConfirmed) row.confirmedOrders += 1;
    if (isShipped) row.shippedOrders += 1;
    if (isReturned) row.returnedOrders += 1;
    if (isDelivered) {
      row.deliveredOrders += 1;
      row.deliveredQty += qty;
      row.revenue += parsePrice(o.totalPrice ?? o.total_price);
      row.purchaseCost += (purchaseMap[key] ?? 0) * qty;
    }
    productProfitMap[key] = row;
  }
  const productProfitRows = Object.values(productProfitMap).map(row => {
    const productConfirmation = row.deliveredOrders * costs.confirmationCostPerOrder;
    const productShipping = row.deliveredOrders * costs.shippingCostPerOrder;
    const productAds = filtered.length ? adsCost * row.orderCount / filtered.length : 0;
    const productCommissions = delivered.length ? commissionCost * row.deliveredOrders / delivered.length : 0;
    const totalProductCosts = row.purchaseCost + productConfirmation + productShipping + productAds + productCommissions;
    return { ...row, productConfirmation, productShipping, productAds, productCommissions, totalProductCosts, profit: row.revenue - totalProductCosts };
  });
  const profitPerDay = netProfit / days;

  // ── Cost per lead ──────────────────────────────────────────────────────────
  const avgRevPerDelivery = delivered.length > 0 ? revenue / delivered.length : 0;

  // Estimate using observed delivery economics, including confirmation and commissions.
  const avgPurchasePerOrder = delivered.length > 0 ? productCost / delivered.length : 0;
  const commissionPerDelivery = delivered.length > 0 ? commissionCost / delivered.length : 0;
  const marginPerDelivery = avgRevPerDelivery - costs.shippingCostPerOrder - costs.confirmationCostPerOrder - avgPurchasePerOrder - commissionPerDelivery;
  const extraDeliveries = delivered.length > 0 && marginPerDelivery > 0 && netProfit < 0
    ? Math.ceil(-netProfit / marginPerDelivery) : null;
  const inTransit = shipped.filter(o => ["expédié", "expedie", "shipped"].includes(String(o.status ?? "").toLowerCase()));
  const deliveryRate = shipped.length > 0 ? delivered.length / shipped.length * 100 : 0;
  const adCostPerDelivery = delivered.length > 0 ? adsCost / delivered.length : null;
  const missingPurchasePrices = delivered.filter(o => !(purchaseMap[String(o.product ?? "").toLowerCase().trim()] > 0)).length;
  const periodLabel = period === "today" ? "Aujourd’hui" : period === "week" ? "7 derniers jours" : period === "month" ? "30 derniers jours" : "Toute la période";
  const priorities = [
    ...(missingPurchasePrices > 0 ? [{ title: "Compléter les coûts produits", detail: `${missingPurchasePrices} commande(s) livrée(s) sans coût d’achat renseigné. Le résultat peut être surestimé.`, href: "/produits", action: "Voir les produits" }] : []),
    ...(inTransit.length > 0 ? [{ title: `Suivre ${inTransit.length} colis en cours`, detail: "Ces commandes ne génèrent du revenu qu’une fois livrées. Vérifiez les blocages avec Eagle Express.", href: "/commandes", action: "Voir les commandes" }] : []),
    ...(netProfit < 0 && adsCost > 0 ? [{ title: "Vérifier les dépenses publicitaires", detail: `${fmt(adsCost)} MAD de publicité pour ${delivered.length} livraison(s). Comparez les campagnes aux ventes livrées avant d’augmenter le budget.`, href: "/ads", action: "Voir la publicité" }] : []),
  ].slice(0, 3);

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
      const isShipped = s === "expédié" || s === "expedie" || s === "livré" || s === "livre" || s === "retourné" || s === "retourne" || s === "shipped" || s === "delivered" || s === "returned";
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
      const isShipped = s === "expédié" || s === "expedie" || s === "livré" || s === "livre" || s === "retourné" || s === "retourne" || s === "shipped" || s === "delivered" || s === "returned";
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

  const dailyMap: Record<string, { revenue: number; cost: number }> = {};
  const dayKey = (date: Date) => date.toLocaleDateString("en-CA");
  const ensureDay = (key: string) => dailyMap[key] ??= { revenue: 0, cost: 0 };
  for (const o of delivered) {
    const key = dayKey(getDate(o));
    const day = ensureDay(key);
    day.revenue += parsePrice(o.totalPrice ?? o.total_price);
    day.cost += (purchaseMap[String(o.product ?? "").toLowerCase().trim()] ?? 0) * (Number(o.quantity) || 1)
      + costs.shippingCostPerOrder + costs.confirmationCostPerOrder;
  }
  if (campaignAdSpend > 0) {
    for (const c of campaignsInPeriod) ensureDay(dayKey(new Date(c.date))).cost += c.spend;
  } else if (costs.dailyAdsBudget > 0) {
    const first = period === "all" ? new Date(Math.min(now.getTime(), ...orders.map(o => getDate(o).getTime()).filter(Number.isFinite))) : new Date(start);
    first.setHours(0, 0, 0, 0);
    for (const date = first; date <= now; date.setDate(date.getDate() + 1)) ensureDay(dayKey(date)).cost += costs.dailyAdsBudget;
  }
  for (const request of paymentRequests) {
    const date = new Date(request.created_at);
    if (request.status !== "rejected" && date >= start && date <= now) ensureDay(dayKey(date)).cost += request.amount;
  }
  const chartDays = Object.keys(dailyMap).sort().slice(-14);
  const maxVal = Math.max(1, ...chartDays.map(d => Math.max(dailyMap[d].revenue, dailyMap[d].cost)));

  const PERIODS: { key: Period; label: string }[] = [
    { key: "today", label: t("today") },
    { key: "week", label: t("week") },
    { key: "month", label: t("month") },
    { key: "all", label: t("all") },
  ];

  const costFields: { key: keyof CostSettings; label: string; placeholder: string }[] = [
    { key: "shippingCostPerOrder", label: "Frais livraison / commande livrée (MAD)", placeholder: "ex: 38" },
  ];

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="sidebar-header-pl bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t("finances_title")}</h1>
            <p className="text-sm text-slate-400">Votre résultat, vos coûts et les prochaines actions</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period selector */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {PERIODS.map(p => (
                <button key={p.key} aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${period === p.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={sendTelegramReport} disabled={sendingReport || loading || settingsLoading || loadError}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 bg-white disabled:opacity-50">
              {sendingReport ? t("sending") : `📨 ${t("telegram_report")}`}
            </button>
            <button onClick={() => { setDraftCosts({ ...costs }); setEditingCosts(true); }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 bg-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              {t("modify_costs")}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {loading || settingsLoading ? (
            <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : loadError ? (
            <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-slate-700">
              <h2 className="font-bold">Les données financières n’ont pas pu être chargées.</h2>
              <p className="mt-2">Actualisez la page pour retrouver un résultat complet.</p>
              <button onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">Réessayer</button>
            </div>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" />{periodLabel} · MAD</span>
                <span>Commandes créées sur la période · statuts actuels</span>
              </div>

              <section aria-label="Résultat de la période" className="mb-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="grid lg:grid-cols-[1.1fr_1fr]">
                  <div className={`p-6 sm:p-8 ${netProfit < 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                    <div className="mb-5 flex items-center gap-2 text-xs font-semibold text-slate-600">
                      {netProfit < 0 ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                      {filtered.length === 0 && totalCost === 0 ? "Aucune activité sur cette période" : netProfit < 0 ? "Les coûts dépassent les ventes livrées" : "Les ventes livrées couvrent les coûts"}
                    </div>
                    <h2 className="text-sm font-semibold text-slate-600">{netProfit < 0 ? "Perte estimée" : "Bénéfice estimé"}</h2>
                    <p className={`mt-2 text-4xl sm:text-5xl font-black tracking-tight tabular-nums ${netProfit < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {netProfit > 0 ? "+" : ""}{fmt(netProfit)} <span className="text-lg font-semibold">MAD</span>
                    </p>
                    <p className="mt-4 text-sm leading-relaxed text-slate-600">{fmt(revenue)} MAD de ventes livrées − {fmt(totalCost)} MAD de coûts.</p>
                    <p className="mt-2 text-xs text-slate-500">D’après les coûts renseignés. Les achats de stock sont suivis séparément.</p>
                  </div>
                  <div className="flex flex-col justify-center gap-5 p-6 sm:p-8">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-5">
                      <div><p className="text-sm font-semibold text-slate-700">Ventes livrées</p><p className="mt-1 text-xs text-slate-500">{delivered.length} commandes · revenu réalisé</p></div>
                      <p className="text-xl font-bold text-slate-900 tabular-nums">{fmt(revenue)} <span className="text-xs font-medium text-slate-400">MAD</span></p>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-sm font-semibold text-slate-700">Coûts de la période</p><p className="mt-1 text-xs text-slate-500">Produits, publicité, livraison et agents</p></div>
                      <p className="text-xl font-bold text-slate-900 tabular-nums">{fmt(totalCost)} <span className="text-xs font-medium text-slate-400">MAD</span></p>
                    </div>
                    <a href="#finance-details" onClick={() => setShowDetails(true)} className="mt-1 inline-flex items-center gap-2 text-xs font-semibold text-blue-600">Comprendre le calcul <ArrowRight size={14} /></a>
                  </div>
                </div>
              </section>

              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Coût pub / vente livrée", value: adCostPerDelivery === null ? "—" : `${fmt(adCostPerDelivery)} MAD`, detail: `${fmt(adsCost)} MAD de pub · ${delivered.length} livraisons`, Icon: Target },
                  { label: "Colis encore en livraison", value: String(inTransit.length), detail: `${shipped.length} expédiés au total · ${returned.length} retournés`, Icon: Package },
                  { label: "Résultat moyen / jour", value: `${fmt(profitPerDay)} MAD`, detail: `Moyenne sur ${days} jour(s), pas une prévision`, Icon: Wallet },
                ].map(item => <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-medium text-slate-500">{item.label}</p><item.Icon size={16} className="text-slate-400" /></div>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">{item.value}</p><p className="mt-2 text-xs text-slate-500">{item.detail}</p>
                </div>)}
              </div>

              <div className="mb-5 grid items-start gap-4 lg:grid-cols-[1.15fr_1fr]">
                <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6">
                  <h2 className="text-sm font-bold text-slate-800">À faire maintenant</h2>
                  <p className="mt-1 text-xs text-slate-500">Les priorités tirées de vos résultats.</p>
                  <div className="mt-5 space-y-4">
                    {priorities.length ? priorities.map((item, index) => <div key={item.title} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">{index + 1}</span>
                      <div><h3 className="text-sm font-semibold text-slate-800">{item.title}</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">{item.detail}</p><a href={item.href} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600">{item.action}<ArrowUpRight size={13} /></a></div>
                    </div>) : <div className="flex gap-3 text-sm text-slate-600"><CheckCircle2 size={18} className="shrink-0 text-emerald-600" /><p>{filtered.length ? "Aucune priorité détectée. Consultez le détail par produit pour suivre vos marges." : "Ajoutez vos commandes et vos dépenses pour commencer le suivi."}</p></div>}
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-slate-800">Objectif : couvrir les coûts</h2><Target size={17} className="text-slate-400" /></div>
                  {delivered.length === 0 ? <p className="mt-5 text-sm leading-relaxed text-slate-500">Une première livraison est nécessaire pour estimer votre marge et le nombre de ventes à atteindre.</p> : marginPerDelivery <= 0 ? <div className="mt-5"><p className="text-lg font-bold text-red-600">Marge par livraison insuffisante</p><p className="mt-2 text-xs leading-relaxed text-slate-500">Le prix de vente ne couvre pas les coûts par livraison. Vérifiez les prix d’achat, de vente et les frais avant d’augmenter le volume.</p></div> : <>
                    <p className="mt-5 text-3xl font-black text-slate-900">{netProfit >= 0 ? "Objectif atteint" : `${extraDeliveries} livraisons`}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">{netProfit >= 0 ? "Vos ventes livrées couvrent les coûts renseignés sur cette période." : "supplémentaires estimées pour couvrir la perte actuelle, sans nouvelle dépense publicitaire."}</p>
                    <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Marge moyenne avant publicité : <strong>{fmt(marginPerDelivery)} MAD / livraison</strong><p className="mt-1 text-slate-500">Après produit, livraison, confirmation et commissions moyennes.</p></div>
                  </>}
                </section>
              </div>

              <section className="mb-5 rounded-2xl border border-slate-100 bg-white p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-sm font-bold text-slate-800">Le parcours de vos commandes</h2><p className="mt-1 text-xs text-slate-500">Chaque étape inclut les suivantes. Les retours sont comptés séparément.</p></div><a href="/commandes" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">Voir les commandes <ArrowUpRight size={13} /></a></div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[{ label: "Reçues", value: filtered.length, color: "bg-slate-400" }, { label: "Confirmées", value: confirmed.length, color: "bg-blue-500" }, { label: "Expédiées", value: shipped.length, color: "bg-amber-500" }, { label: "Livrées", value: delivered.length, color: "bg-emerald-500" }].map((step, index) => <div key={step.label} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{index + 1}. {step.label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{step.value}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${step.color}`} style={{ width: `${filtered.length ? step.value / filtered.length * 100 : 0}%` }} /></div></div>)}
                </div>
                <p className="mt-4 text-xs text-slate-500">{shipped.length ? `${deliveryRate.toFixed(0)} % des colis expédiés sont livrés (${delivered.length}/${shipped.length}).` : "Aucun colis expédié sur cette période."} {inTransit.length > 0 && `${inTransit.length} colis sont encore en cours : ce taux reste provisoire.`}</p>
              </section>

              <details id="finance-details" open={showDetails} onToggle={event => setShowDetails(event.currentTarget.open)} className="mb-5 group">
                <summary className="mb-4 flex cursor-pointer list-none items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-700">Explorer les détails : coûts, produits et tendances <ChevronDown size={18} className="transition-transform group-open:rotate-180" /></summary>
              {/* ── Cost breakdown ── */}
              <div className="mb-5">
                {/* Investment breakdown */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-1.5"><TrendingDown size={15} /> Détail des coûts</h2>
                  <div className="space-y-3">
                    {[
                      { label: "Coût des produits livrés", value: productCost, sub: `${delivered.length} cmds livrées`, color: "bg-orange-500", breakdown: Object.entries(productCostByProduct).sort((a, b) => b[1].cost - a[1].cost) },
                      { label: "Budget publicité", value: adsCost, sub: campaignAdSpend > 0 ? `${campaignsInPeriod.length} campagne(s) — Ads Manager` : `${costs.dailyAdsBudget} MAD × ${days} jours`, color: "bg-blue-500" },
                      { label: "Confirmation", value: confirmationCost, sub: `${delivered.length} commandes livrées × ${costs.confirmationCostPerOrder} MAD`, color: "bg-violet-500" },
                      { label: "Livraison Eagle Express", value: shippingCost, sub: `${delivered.length} colis livrés × ${costs.shippingCostPerOrder} MAD`, color: "bg-amber-500" },
                      { label: "Commissions agents", value: commissionCost, sub: `${paymentRequests.filter(r => r.status !== "rejected" && new Date(r.created_at) >= start && new Date(r.created_at) <= now).length} commission(s)`, color: "bg-blue-400" },
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
                          {'breakdown' in item && item.breakdown && item.breakdown.length > 0 && (
                            <div className="mt-2 ml-2 space-y-1.5 border-l-2 border-orange-100 pl-3">
                              {item.breakdown.map(([name, v]) => (
                                <div key={name} className="flex items-center justify-between text-xs">
                                  <span className="text-slate-500 truncate max-w-[140px]">{name || "Inconnu"}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-slate-400">{v.qty} × livrés</span>
                                    <span className="font-semibold text-orange-600">{fmt(v.cost)} MAD</span>
                                    <span className={`font-semibold ${v.revenue - v.cost >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                      ({v.revenue - v.cost >= 0 ? "+" : ""}{fmt(v.revenue - v.cost)})
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="border-t border-slate-100 pt-3 flex justify-between">
                      <span className="text-sm font-bold text-slate-700">Coûts de la période</span>
                      <span className="text-sm font-black text-red-600">{fmt(totalCost)} MAD</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* ── Daily chart ── */}
              {chartDays.length > 0 && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-5">
                  <h2 className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5"><TrendingUp size={15} /> Ventes livrées et coûts par jour</h2>
                  <p className="text-xs text-slate-400 mb-4">14 dernières dates d’activité de la période · bleu : ventes livrées · rouge : coûts renseignés</p>
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

              {/* ── Product profitability ── */}
              {productProfitRows.length > 0 && (
                <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-5">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                    <h2 className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Package size={15} /> Résultat par produit</h2>
                    <span className="text-xs text-slate-400">{filtered.length} commandes · frais pub répartis selon le nombre de commandes</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">Le coût de la marchandise est compté sur les commandes livrées. Les retours sont gratuits; les frais de livraison s&apos;appliquent aux colis livrés.</p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[880px] text-sm">
                      <thead><tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                        <th className="py-2 pr-3">Produit</th><th className="py-2 px-2 text-right">Conf. / livrées</th>
                        <th className="py-2 px-2 text-right">CA livré</th><th className="py-2 px-2 text-right">Marchandise</th>
                        <th className="py-2 px-2 text-right">Confirmation (livrée) + livraison</th><th className="py-2 px-2 text-right">Pub répartie</th>
                        <th className="py-2 px-2 text-right">Commission</th><th className="py-2 pl-2 text-right">Bénéfice net</th>
                      </tr></thead>
                      <tbody>{productProfitRows.map(row => (
                        <tr key={row.name} className="border-b border-slate-50 last:border-0">
                          <td className="py-3 pr-3 font-semibold text-slate-700">{row.name}</td>
                          <td className="py-3 px-2 text-right text-slate-500">{row.confirmedOrders} / {row.deliveredOrders}</td>
                          <td className="py-3 px-2 text-right font-medium text-slate-700">{fmt(row.revenue)} MAD</td>
                          <td className="py-3 px-2 text-right text-orange-600">{fmt(row.purchaseCost)} MAD</td>
                          <td className="py-3 px-2 text-right text-slate-500">{fmt(row.productConfirmation + row.productShipping)} MAD</td>
                          <td className="py-3 px-2 text-right text-blue-600">{fmt(row.productAds)} MAD</td>
                          <td className="py-3 px-2 text-right text-slate-500">{fmt(row.productCommissions)} MAD</td>
                          <td className={`py-3 pl-2 text-right font-black ${row.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{row.profit >= 0 ? "+" : ""}{fmt(row.profit)} MAD</td>
                        </tr>
                      ))}</tbody>
                      <tfoot><tr className="border-t-2 border-slate-200 font-bold">
                        <td className="py-3 pr-3 text-slate-700">Total</td><td className="py-3 px-2 text-right text-slate-500">—</td>
                        <td className="py-3 px-2 text-right">{fmt(productProfitRows.reduce((sum, row) => sum + row.revenue, 0))} MAD</td>
                        <td className="py-3 px-2 text-right text-orange-600">{fmt(productProfitRows.reduce((sum, row) => sum + row.purchaseCost, 0))} MAD</td>
                        <td className="py-3 px-2 text-right">{fmt(productProfitRows.reduce((sum, row) => sum + row.productConfirmation + row.productShipping, 0))} MAD</td>
                        <td className="py-3 px-2 text-right text-blue-600">{fmt(productProfitRows.reduce((sum, row) => sum + row.productAds, 0))} MAD</td>
                        <td className="py-3 px-2 text-right">{fmt(productProfitRows.reduce((sum, row) => sum + row.productCommissions, 0))} MAD</td>
                        <td className={`py-3 pl-2 text-right ${netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{netProfit >= 0 ? "+" : ""}{fmt(netProfit)} MAD</td>
                      </tr></tfoot>
                    </table>
                  </div>
                </section>
              )}

              {/* ── City + Product return rates ── */}
              {(cityStats.length > 0 || productStats.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                  {/* Return rate by city */}
                  {cityStats.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                      <h2 className="text-sm font-bold text-slate-700 mb-4">Taux retour par ville</h2>
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
                      <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-1.5"><Package size={15} /> Taux retour par produit</h2>
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

              </details>

              <section className="mb-5 rounded-2xl border border-slate-100 bg-white p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-sm font-bold text-slate-700">Achats de stock</h2><p className="text-xl font-bold text-slate-900">{fmt(stockPurchaseTotal)} MAD</p></div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{stockUnitsReceived} unités reçues sur la période. Seul le coût des unités livrées entre dans le résultat ci-dessus ; le stock restant servira aux prochaines ventes.</p>
              </section>

              {/* ── Cash flow tracker ── */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mt-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Bird size={15} /> Suivi des virements Eagle Express</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Ventes brutes et virements reçus sur la période. L’écart n’est pas un solde transporteur : frais déduits et dates de virement peuvent différer.</p>
                  </div>
                  <button onClick={() => setShowAddVirement(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">
                    {showAddVirement ? "Annuler" : "+ Ajouter virement"}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Ventes livrées (brut)</p>
                    <p className="text-xl font-black text-emerald-700">{fmt(revenue)} MAD</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Virements reçus</p>
                    <p className="text-xl font-black text-blue-700">{fmt(totalVirements)} MAD</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${pendingVirement > 0 ? "bg-amber-50" : "bg-emerald-50"}`}>
                    <p className="text-xs text-slate-500 mb-1">Écart indicatif</p>
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
            <p className="text-xs text-slate-400 mb-5">Ce tarif complète le coût d&apos;achat produit, le budget publicitaire et les frais de confirmation configurés dans leurs pages respectives.</p>
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
