"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import { useLang } from "@/lib/i18n";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#2563EB", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"];
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const DAYS = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
type Period = "today" | "week" | "month" | "year";

type Order = {
  id: string;
  order_number: number;
  status: string;
  financial_status: string;
  total_price: string;
  currency: string;
  customer_name: string;
  city: string;
  product: string;
  quantity: number;
  created_at: string; // normalized from receivedAt
};

type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  lastSeen?: string | null;
};

function isOnline(lastSeen?: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000; // 5 min
}

function AgentAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {initials}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  "confirmé": "bg-blue-50 text-blue-600",
  "livré": "bg-emerald-50 text-emerald-600",
  "expédié": "bg-violet-50 text-violet-600",
  "annulé": "bg-red-50 text-red-500",
  "pending": "bg-amber-50 text-amber-600",
  "retourné": "bg-orange-50 text-orange-500",
};


// ── Date helpers ──────────────────────────────────────────────────────────────
function startOf(period: Period, now: Date): Date {
  const d = new Date(now);
  if (period === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (period === "week") {
    const day = d.getDay(); // 0=Sun
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "month") { d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
  // year
  d.setMonth(0, 1); d.setHours(0, 0, 0, 0); return d;
}

function filterByPeriod(orders: Order[], period: Period, now: Date) {
  const start = startOf(period, now).getTime();
  return orders.filter(o => new Date(o.created_at).getTime() >= start);
}

// ── Chart data builders ───────────────────────────────────────────────────────
function buildChartData(orders: Order[], period: Period, now: Date) {
  if (period === "today") {
    // 24 hours
    const buckets: { label: string; commandes: number; revenue: number }[] = Array.from({ length: 24 }, (_, h) => ({
      label: `${h}h`, commandes: 0, revenue: 0,
    }));
    orders.forEach(o => {
      const h = new Date(o.created_at).getHours();
      buckets[h].commandes++;
      if (["confirmé","livré","expédié"].includes(o.status))
        buckets[h].revenue += parseFloat(o.total_price) || 0;
    });
    // Only show up to current hour + 1
    const curH = now.getHours();
    return buckets.slice(0, curH + 2).map(b => ({ ...b, revenue: Math.round(b.revenue) }));
  }

  if (period === "week") {
    const buckets = DAYS.map(d => ({ label: d, commandes: 0, revenue: 0 }));
    orders.forEach(o => {
      const day = new Date(o.created_at).getDay();
      buckets[day].commandes++;
      if (["confirmé","livré","expédié"].includes(o.status))
        buckets[day].revenue += parseFloat(o.total_price) || 0;
    });
    return buckets.map(b => ({ ...b, revenue: Math.round(b.revenue) }));
  }

  if (period === "month") {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const buckets = Array.from({ length: daysInMonth }, (_, i) => ({
      label: `${i + 1}`, commandes: 0, revenue: 0,
    }));
    orders.forEach(o => {
      const d = new Date(o.created_at).getDate() - 1;
      if (d >= 0 && d < daysInMonth) {
        buckets[d].commandes++;
        if (["confirmé","livré","expédié"].includes(o.status))
          buckets[d].revenue += parseFloat(o.total_price) || 0;
      }
    });
    return buckets.map(b => ({ ...b, revenue: Math.round(b.revenue) }));
  }

  // year — by month
  const buckets = MONTHS.map(m => ({ label: m, commandes: 0, revenue: 0 }));
  orders.forEach(o => {
    const month = new Date(o.created_at).getMonth();
    buckets[month].commandes++;
    if (["confirmé","livré","expédié"].includes(o.status))
      buckets[month].revenue += parseFloat(o.total_price) || 0;
  });
  return buckets.map(b => ({ ...b, revenue: Math.round(b.revenue) }));
}

export default function Home() {
  const { t } = useLang();
  const PERIOD_LABELS: Record<Period, string> = {
    today: t("period_today"),
    week: t("period_week"),
    month: t("period_month"),
    year: t("period_year"),
  };
  const statusT = (s: string) => {
    const m: Record<string, string> = {
      confirmé: t("status_confirmed"), livré: t("status_delivered"), expédié: t("status_shipped"),
      annulé: t("status_cancelled"), pending: t("status_pending"), retourné: t("status_returned"),
      confirmed: t("status_confirmed"), delivered: t("status_delivered"), cancelled: t("status_cancelled"),
    };
    return m[s] ?? s;
  };
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [period, setPeriod] = useState<Period>("today");
  const [chartMode, setChartMode] = useState<"commandes" | "revenue">("commandes");
  const isFirstLoad = useRef(true);

  const now = useMemo(() => new Date(), []);

  const fetchData = useCallback(() => {
    if (isFirstLoad.current) setLoading(true);
    Promise.all([
      fetch("/api/orders").then(r => {
        if (r.status === 401) { window.location.href = "/login"; return { orders: [] }; }
        return r.ok ? r.json() : { orders: [] };
      }),
      fetch("/api/auth/users").then(r => r.ok ? r.json() : { users: [] }),
    ]).then(([ordersData, teamData]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalized = (ordersData.orders ?? []).map((o: any) => ({
        id: o.id,
        order_number: o.orderNumber ?? o.order_number ?? "",
        status: o.status ?? "nouveau",
        financial_status: o.financial_status ?? "cod",
        total_price: String(o.totalPrice ?? o.total_price ?? "0"),
        currency: o.currency ?? "MAD",
        customer_name: o.customerName ?? o.customer_name ?? "",
        city: o.city ?? "",
        product: o.product ?? "",
        quantity: o.quantity ?? 1,
        created_at: o.receivedAt ?? o.received_at ?? o.created_at ?? new Date().toISOString(),
      }));
      setAllOrders(normalized);
      setTeam((teamData.users ?? []).filter((u: TeamUser) => u.active));
      setLastRefresh(new Date());
    }).finally(() => {
      setLoading(false);
      isFirstLoad.current = false;
    });
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Filtered orders for selected period ──────────────────────────────────────
  const orders = useMemo(() => filterByPeriod(allOrders, period, now), [allOrders, period, now]);

  // ── Today's snapshot (always) ─────────────────────────────────────────────
  const todayOrders = useMemo(() => filterByPeriod(allOrders, "today", now), [allOrders, now]);
  const todayTotal = todayOrders.length;
  const todayConfirmed = todayOrders.filter(o => ["confirmé","confirmed"].includes(o.status)).length;
  const todayCancelled = todayOrders.filter(o => ["annulé","cancelled"].includes(o.status)).length;
  const todayDelivered = todayOrders.filter(o => ["livré","delivered"].includes(o.status)).length;

  // ── Period stats ──────────────────────────────────────────────────────────────
  const totalOrders = orders.length;
  const confirmed = orders.filter(o => ["confirmé","confirmed"].includes(o.status)).length;
  const cancelled = orders.filter(o => ["annulé","cancelled"].includes(o.status)).length;
  const delivered = orders.filter(o => ["livré","delivered"].includes(o.status)).length;
  const pending = orders.filter(o => o.status === "pending").length;
  const revenue = orders
    .filter(o => ["confirmé","livré","expédié","confirmed","delivered"].includes(o.status))
    .reduce((s, o) => s + (parseFloat(o.total_price) || 0), 0);
  const deliveryRate = confirmed > 0 ? Math.round((delivered / confirmed) * 100) : 0;
  const confirmRate = totalOrders > 0 ? Math.round((confirmed / totalOrders) * 100) : 0;

  // ── Chart ─────────────────────────────────────────────────────────────────────
  const chartData = useMemo(() => buildChartData(orders, period, now), [orders, period, now]);

  // ── City distribution (period) ────────────────────────────────────────────────
  const cityData = useMemo(() => {
    const cityCount: Record<string, number> = {};
    orders.forEach(o => {
      const city = (o.city || "Autre").trim() || "Autre";
      cityCount[city] = (cityCount[city] || 0) + 1;
    });
    const total = orders.length || 1;
    const sorted = Object.entries(cityCount).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 4).map(([name, count]) => ({ name, value: Math.round((count / total) * 100) }));
    const other = 100 - top.reduce((s, c) => s + c.value, 0);
    if (other > 0) top.push({ name: "Autre", value: other });
    return top.length > 0 ? top : [{ name: "Aucune donnée", value: 100 }];
  }, [orders]);

  // ── Best products (period) ────────────────────────────────────────────────────
  const bestProducts = useMemo(() => {
    const productMap: Record<string, { sold: number; revenue: number }> = {};
    orders.forEach(o => {
      const key = o.product || "Produit";
      if (!productMap[key]) productMap[key] = { sold: 0, revenue: 0 };
      productMap[key].sold += o.quantity || 1;
      productMap[key].revenue += parseFloat(o.total_price) || 0;
    });
    return Object.entries(productMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([name, { sold, revenue: rev }], i) => ({
        rank: i + 1, name, sold,
        revenue: `${Math.round(rev).toLocaleString("fr-MA")} MAD`,
      }));
  }, [orders]);

  // ── Recent orders (period) ────────────────────────────────────────────────────
  const recentOrders = useMemo(() =>
    [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5),
    [orders]
  );

  const kpis = [
    { label: t("kpi_orders"), value: totalOrders, color: "text-blue-600", bg: "bg-blue-50", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg> },
    { label: t("kpi_confirmed"), value: confirmed, color: "text-emerald-600", bg: "bg-emerald-50", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
    { label: t("kpi_cancelled"), value: cancelled, color: "text-red-500", bg: "bg-red-50", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> },
    { label: t("kpi_delivered"), value: delivered, color: "text-violet-600", bg: "bg-violet-50", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3M9 17h6m4 0h2"/><circle cx="7" cy="17" r="2"/><path d="M13 17V9h5l3 4v4h-2"/><circle cx="19" cy="17" r="2"/></svg> },
    { label: t("kpi_pending"), value: pending, color: "text-amber-600", bg: "bg-amber-50", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label: t("kpi_revenue"), value: `${Math.round(revenue).toLocaleString("fr-MA")}`, color: "text-slate-900", bg: "bg-slate-50", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
    { label: t("kpi_confirm_rate"), value: `${confirmRate}%`, color: "text-blue-700", bg: "bg-blue-50", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg> },
    { label: t("kpi_delivery_rate"), value: `${deliveryRate}%`, color: "text-emerald-700", bg: "bg-emerald-50", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  ];

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="sidebar-header-pl bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t("dashboard")}</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <p className="text-xs text-slate-400">
                {lastRefresh
                  ? `${t("updated_at")} ${lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · auto 1 min`
                  : t("loading")}
              </p>
            </div>
          </div>
          <a href="/commandes" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-md shadow-blue-200 whitespace-nowrap">
            {t("new_order_btn")}
          </a>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ── Today's snapshot strip ── */}
              <div className="bg-blue-600 rounded-2xl p-4 lg:p-5 mb-6 shadow-md shadow-blue-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-0.5">{t("today")}</p>
                    <p className="text-white font-bold text-lg leading-tight">
                      {new Date().toLocaleDateString("fr-MA", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 lg:gap-6">
                    {[
                      { label: t("today_placed"), value: todayTotal, color: "text-white" },
                      { label: t("kpi_confirmed"), value: todayConfirmed, color: "text-emerald-300" },
                      { label: t("kpi_cancelled"), value: todayCancelled, color: "text-red-300" },
                      { label: t("kpi_delivered"), value: todayDelivered, color: "text-blue-200" },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-blue-200 text-xs mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Period selector ── */}
              <div className="flex items-center gap-2 mb-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-1.5 w-fit">
                {(["today","week","month","year"] as Period[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      period === p ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-slate-500 hover:bg-slate-50"
                    }`}>
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>

              {/* ── KPI grid ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
                {kpis.map(k => (
                  <div key={k.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${k.bg} ${k.color}`}>{k.icon}</div>
                    <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                    <p className="text-xs text-slate-400 font-medium leading-tight">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* ── Chart + cities ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5 mb-6">
                {/* Main chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-slate-900">{t("chart_evolution")} — {PERIOD_LABELS[period]}</h2>
                    <div className="flex gap-1 bg-slate-50 rounded-xl p-1">
                      {(["commandes","revenue"] as const).map(m => (
                        <button key={m} onClick={() => setChartMode(m)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            chartMode === m ? "bg-white shadow-sm text-slate-800" : "text-slate-400 hover:text-slate-600"
                          }`}>
                          {m === "commandes" ? t("chart_orders") : t("chart_revenue")}
                        </button>
                      ))}
                    </div>
                  </div>
                  {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[200px] text-slate-300">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-2"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-4"/></svg>
                      <p className="text-sm">{t("no_chart_data")}</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      {chartMode === "commandes" ? (
                        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} interval={period === "month" ? 3 : 0} />
                          <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: 12 }}
                            formatter={(v) => [v, "Commandes"]} />
                          <Bar dataKey="commandes" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={32} />
                        </BarChart>
                      ) : (
                        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                          <defs>
                            <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} interval={period === "month" ? 3 : 0} />
                          <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                          <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: 12 }}
                            formatter={(v) => [`${Number(v).toLocaleString("fr-MA")} MAD`, "Revenue"]} />
                          <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2.5} fill="url(#gr)" dot={false} activeDot={{ r: 5, fill: "#2563EB" }} />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Cities pie */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <h2 className="text-base font-bold text-slate-900 mb-4">{t("top_cities")}</h2>
                  {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[200px] text-slate-300">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-2"><circle cx="12" cy="12" r="10"/></svg>
                      <p className="text-sm text-center">{t("no_orders")}</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={cityData} cx="50%" cy="42%" innerRadius={50} outerRadius={72} paddingAngle={3} dataKey="value">
                          {cityData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: "#64748B" }}>{v}</span>} />
                        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: 12 }} formatter={(v) => [`${v}%`, ""]} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* ── Products + Team ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5 mb-6">
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">{t("top_products")}</h2>
                    <span className="text-xs text-slate-400">{PERIOD_LABELS[period]}</span>
                  </div>
                  {bestProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-300">
                      <p className="text-sm">{t("no_products_period")}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {bestProducts.map((p) => (
                        <div key={p.rank} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50/60 transition-colors">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${p.rank === 1 ? "bg-amber-100 text-amber-600" : p.rank === 2 ? "bg-slate-100 text-slate-500" : "bg-orange-50 text-orange-400"}`}>
                            {p.rank}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                            <p className="text-xs text-slate-400">{p.sold} {t("sold")}</p>
                          </div>
                          <p className="text-sm font-bold text-slate-800 shrink-0">{p.revenue}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">{t("team")}</h2>
                    <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">{team.length} {t("members")}</span>
                  </div>
                  {team.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-300">
                      <p className="text-sm">{t("no_members")}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {team.map((a) => {
                        const online = isOnline(a.lastSeen);
                        return (
                          <div key={a.id} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50/60 transition-colors">
                            <div className="relative shrink-0">
                              <AgentAvatar name={a.name} />
                              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${online ? "bg-emerald-400" : "bg-slate-300"}`} title={online ? "En ligne" : "Hors ligne"} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{a.name}</p>
                              <p className="text-xs text-slate-400">{online ? "En ligne" : "Hors ligne"}</p>
                            </div>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${a.role === "admin" ? "bg-blue-50 text-blue-600" : a.role === "agent" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                              {a.role}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="px-6 py-3 border-t border-slate-50">
                    <a href="/equipe" className="text-xs text-blue-600 font-medium hover:underline">{t("manage_team")}</a>
                  </div>
                </div>
              </div>

              {/* ── Recent orders ── */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
                <div className="px-4 lg:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">{t("recent_orders_title")} — {PERIOD_LABELS[period]}</h2>
                  <a href="/commandes" className="text-sm text-blue-600 font-medium hover:underline">{t("see_all")}</a>
                </div>
                {recentOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-300">
                    <p className="text-sm">{t("no_orders_period")}</p>
                    <a href="/integrations" className="text-xs text-blue-500 mt-1 hover:underline">{t("configure_integrations")} →</a>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[480px]">
                      <thead>
                        <tr className="text-xs text-slate-400 border-b border-slate-50">
                          {[t("col_id"), t("col_client"), t("col_city"), t("col_amount"), t("col_status"), t("col_date")].map(h => (
                            <th key={h} className="text-left px-6 py-3 font-semibold uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentOrders.map((o) => (
                          <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                            <td className="px-6 py-3.5 font-mono text-xs text-slate-400">#{o.order_number || o.id.slice(-5)}</td>
                            <td className="px-6 py-3.5 font-semibold text-slate-800">{o.customer_name}</td>
                            <td className="px-6 py-3.5 text-slate-500">{o.city || "—"}</td>
                            <td className="px-6 py-3.5 font-bold text-slate-800">{parseFloat(o.total_price).toLocaleString("fr-MA")} MAD</td>
                            <td className="px-6 py-3.5">
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_STYLE[o.status] ?? "bg-slate-100 text-slate-500"}`}>
                                {statusT(o.status)}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-xs text-slate-400">
                              {new Date(o.created_at).toLocaleDateString("fr-MA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
