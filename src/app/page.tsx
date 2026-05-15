"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#2563EB", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"];
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

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
  created_at: string;
};

type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

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

const statusStyle: Record<string, string> = {
  "confirmé": "bg-blue-50 text-blue-600",
  "livré": "bg-emerald-50 text-emerald-600",
  "expédié": "bg-violet-50 text-violet-600",
  "annulé": "bg-red-50 text-red-500",
  "pending": "bg-amber-50 text-amber-600",
  "retourné": "bg-orange-50 text-orange-500",
};

function statusLabel(s: string) {
  const map: Record<string, string> = {
    confirmé: "Confirmé", livré: "Livré", expédié: "Expédié",
    annulé: "Annulé", pending: "En attente", retourné: "Retourné",
  };
  return map[s] ?? s;
}

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/lf-orders").then(r => r.ok ? r.json() : { orders: [] }),
      fetch("/api/auth/users").then(r => r.ok ? r.json() : { users: [] }),
    ]).then(([ordersData, teamData]) => {
      setOrders(ordersData.orders ?? []);
      setTeam((teamData.users ?? []).filter((u: TeamUser) => u.active));
    }).finally(() => setLoading(false));
  }, []);

  // ── Computed stats ──────────────────────────────────────────────────────────
  const confirmed = orders.filter(o => o.status === "confirmé" || o.status === "confirmed").length;
  const delivered = orders.filter(o => o.status === "livré" || o.status === "delivered").length;
  const revenue = orders
    .filter(o => ["confirmé","livré","expédié","confirmed","delivered"].includes(o.status))
    .reduce((s, o) => s + (parseFloat(o.total_price) || 0), 0);
  const deliveryRate = confirmed > 0 ? Math.round((delivered / confirmed) * 100) : 0;

  // ── Monthly revenue chart ───────────────────────────────────────────────────
  const now = new Date();
  const currentYear = now.getFullYear();
  const revenueByMonth: number[] = Array(12).fill(0);
  orders.forEach(o => {
    const d = new Date(o.created_at);
    if (d.getFullYear() === currentYear && ["confirmé","livré","expédié"].includes(o.status)) {
      revenueByMonth[d.getMonth()] += parseFloat(o.total_price) || 0;
    }
  });
  const revenueData = MONTHS.map((month, i) => ({ month, value: Math.round(revenueByMonth[i]) }));

  // ── City distribution ───────────────────────────────────────────────────────
  const cityCount: Record<string, number> = {};
  orders.forEach(o => {
    const city = (o.city || "Autre").trim() || "Autre";
    cityCount[city] = (cityCount[city] || 0) + 1;
  });
  const total = orders.length || 1;
  const sortedCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1]);
  const topCities = sortedCities.slice(0, 4).map(([name, count]) => ({
    name, value: Math.round((count / total) * 100),
  }));
  const otherPct = 100 - topCities.reduce((s, c) => s + c.value, 0);
  if (otherPct > 0) topCities.push({ name: "Autre", value: otherPct });
  const cityData = topCities.length > 0 ? topCities : [{ name: "Aucune donnée", value: 100 }];

  // ── Best products ───────────────────────────────────────────────────────────
  const productMap: Record<string, { sold: number; revenue: number }> = {};
  orders.forEach(o => {
    const key = o.product || "Produit";
    if (!productMap[key]) productMap[key] = { sold: 0, revenue: 0 };
    productMap[key].sold += o.quantity || 1;
    productMap[key].revenue += parseFloat(o.total_price) || 0;
  });
  const bestProducts = Object.entries(productMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([name, { sold, revenue: rev }], i) => ({
      rank: i + 1, name, sold,
      revenue: `${Math.round(rev).toLocaleString("fr-MA")} MAD`,
    }));

  // ── Recent orders ───────────────────────────────────────────────────────────
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const stats = [
    {
      label: "Commandes confirmées",
      value: confirmed.toLocaleString("fr-MA"),
      color: "bg-blue-50 text-blue-600",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>,
    },
    {
      label: "Commandes livrées",
      value: delivered.toLocaleString("fr-MA"),
      color: "bg-emerald-50 text-emerald-600",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    },
    {
      label: "Revenue (MAD)",
      value: Math.round(revenue).toLocaleString("fr-MA"),
      color: "bg-violet-50 text-violet-600",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
    },
    {
      label: "Taux de livraison",
      value: `${deliveryRate}%`,
      color: "bg-amber-50 text-amber-600",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3M9 17h6m4 0h2"/><circle cx="7" cy="17" r="2"/><path d="M13 17V9h5l3 4v4h-2"/><circle cx="19" cy="17" r="2"/></svg>,
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-400">{MONTHS[now.getMonth()]} {currentYear} — Vue d&apos;ensemble</p>
          </div>
          <div className="flex items-center gap-2 lg:gap-3">
            <button className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
            </button>
            <a href="/commandes" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 lg:px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-blue-200 whitespace-nowrap">
              + Nouvelle commande
            </a>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5 mb-6">
                {stats.map((stat) => (
                  <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stat.color}`}>{stat.icon}</div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 mb-1">{stat.value}</p>
                    <span className="text-xs text-slate-400">données réelles</span>
                  </div>
                ))}
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5 mb-6">
                <div className="lg:col-span-2 bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-base font-bold text-slate-900">Aperçu des revenus</h2>
                    <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-lg">{currentYear}</span>
                  </div>
                  {revenue === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[180px] text-slate-300">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-2"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-4"/></svg>
                      <p className="text-sm">Aucune donnée pour le moment</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={revenueData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: 12 }} formatter={(v) => [`${Number(v).toLocaleString("fr-MA")} MAD`, "Revenue"]} />
                        <Area type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2.5} fill="url(#colorRevenue)" dot={false} activeDot={{ r: 5, fill: "#2563EB" }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <h2 className="text-base font-bold text-slate-900 mb-4">Top Villes</h2>
                  {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[180px] text-slate-300">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                      <p className="text-sm text-center">Aucune commande</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
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

              {/* Bottom row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5 mb-6">
                {/* Best products */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">🏆 Meilleurs produits</h2>
                    <a href="/commandes" className="text-xs text-blue-600 font-medium hover:underline">Voir tout →</a>
                  </div>
                  {bestProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-300">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-2"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
                      <p className="text-sm">Aucun produit pour le moment</p>
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
                            <p className="text-xs text-slate-400">{p.sold} vendus</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-slate-800">{p.revenue}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Team */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">Équipe</h2>
                    <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">{team.length} membre{team.length !== 1 ? "s" : ""}</span>
                  </div>
                  {team.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-300">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                      <p className="text-sm">Aucun membre</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {team.map((a) => (
                        <div key={a.id} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50/60 transition-colors">
                          <AgentAvatar name={a.name} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{a.name}</p>
                            <p className="text-xs text-slate-400">{a.role}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            a.role === "admin" ? "bg-blue-50 text-blue-600" :
                            a.role === "agent" ? "bg-emerald-50 text-emerald-600" :
                            "bg-slate-100 text-slate-400"
                          }`}>
                            {a.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="px-6 py-3 border-t border-slate-50">
                    <a href="/equipe" className="text-xs text-blue-600 font-medium hover:underline">Gérer l&apos;équipe →</a>
                  </div>
                </div>
              </div>

              {/* Recent orders */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
                <div className="px-4 lg:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">Dernières commandes</h2>
                  <a href="/commandes" className="text-sm text-blue-600 font-medium hover:underline">Voir tout →</a>
                </div>
                {recentOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-300">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
                    <p className="text-sm">Aucune commande reçue</p>
                    <a href="/integrations" className="text-xs text-blue-500 mt-1 hover:underline">Configurer les intégrations →</a>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[480px]">
                      <thead>
                        <tr className="text-xs text-slate-400 border-b border-slate-50">
                          {["ID","Client","Ville","Montant","Statut"].map(h => (
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
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusStyle[o.status] ?? "bg-slate-100 text-slate-500"}`}>
                                {statusLabel(o.status)}
                              </span>
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
