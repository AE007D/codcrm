"use client";

import Sidebar from "@/components/Sidebar";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const revenueData = [
  { month: "Jan", value: 178400 },
  { month: "Fév", value: 204800 },
  { month: "Mar", value: 231200 },
  { month: "Avr", value: 219600 },
  { month: "Mai", value: 248500 },
  { month: "Jun", value: 265000 },
  { month: "Jul", value: 289000 },
];

const cityData = [
  { name: "Casablanca", value: 38 },
  { name: "Rabat", value: 22 },
  { name: "Marrakech", value: 18 },
  { name: "Fès", value: 12 },
  { name: "Autre", value: 10 },
];

const COLORS = ["#2563EB", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"];

const stats = [
  {
    label: "Commandes confirmées",
    value: "1,284",
    change: "+12.5%",
    up: true,
    color: "bg-blue-50 text-blue-600",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>,
  },
  {
    label: "Commandes livrées",
    value: "987",
    change: "+8.2%",
    up: true,
    color: "bg-emerald-50 text-emerald-600",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  },
  {
    label: "Revenue (MAD)",
    value: "248,500",
    change: "+11.7%",
    up: true,
    color: "bg-violet-50 text-violet-600",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  },
  {
    label: "Taux de livraison",
    value: "76.9%",
    change: "+1.4%",
    up: true,
    color: "bg-amber-50 text-amber-600",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3M9 17h6m4 0h2"/><circle cx="7" cy="17" r="2"/><path d="M13 17V9h5l3 4v4h-2"/><circle cx="19" cy="17" r="2"/></svg>,
  },
];

const recentOrders = [
  { id: "#10041", customer: "Youssef Alami", city: "Casablanca", amount: "350 MAD", status: "Livré" },
  { id: "#10040", customer: "Fatima Zahra", city: "Rabat", amount: "199 MAD", status: "En cours" },
  { id: "#10039", customer: "Hamid Benali", city: "Marrakech", amount: "420 MAD", status: "En attente" },
  { id: "#10038", customer: "Samira Oukili", city: "Fès", amount: "149 MAD", status: "Retourné" },
  { id: "#10037", customer: "Khalid Tazi", city: "Agadir", amount: "350 MAD", status: "Livré" },
];

const statusStyle: Record<string, string> = {
  "Livré": "bg-emerald-50 text-emerald-600",
  "En cours": "bg-blue-50 text-blue-600",
  "En attente": "bg-amber-50 text-amber-600",
  "Retourné": "bg-red-50 text-red-500",
};

const bestProducts = [
  { rank: 1, name: "Chargeur rapide 65W", sold: 213, revenue: "31,737 MAD", margin: "63%", trend: "up" },
  { rank: 2, name: "Montre Sport Pro",    sold: 128, revenue: "44,800 MAD", margin: "66%", trend: "up" },
  { rank: 3, name: "Écouteurs BT X2",    sold: 97,  revenue: "19,303 MAD", margin: "70%", trend: "up" },
  { rank: 4, name: "Coque iPhone 15",    sold: 76,  revenue:  "4,484 MAD", margin: "51%", trend: "down" },
  { rank: 5, name: "Lampe LED bureau",   sold: 54,  revenue:  "4,806 MAD", margin: "44%", trend: "down" },
];

const teamAgents = [
  { name: "Sara Benali",    confirmed: 312, delivered: 280, online: true  },
  { name: "Karim Idrissi",  confirmed: 198, delivered: 171, online: true  },
  { name: "Nour El Houda",  confirmed: 145, delivered: 122, online: false },
  { name: "Mehdi Tazi",     confirmed:  89, delivered:  74, online: false },
];

function AgentAvatar({ name, online }: { name: string; online: boolean }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className="relative shrink-0">
      <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center text-white text-xs font-bold`}>{initials}</div>
      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${online ? "bg-emerald-500" : "bg-slate-300"}`} />
    </div>
  );
}

export default function Home() {
  const onlineCount = teamAgents.filter(a => a.online).length;
  const totalConfirmed = teamAgents.reduce((s, a) => s + a.confirmed, 0);
  const totalDelivered = teamAgents.reduce((s, a) => s + a.delivered, 0);

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-400">Mai 2026 — Vue d&apos;ensemble</p>
          </div>
          <div className="flex items-center gap-2 lg:gap-3">
            <button className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full" />
            </button>
            <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 lg:px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-blue-200 whitespace-nowrap">
              + Nouvelle commande
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5 mb-6">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stat.color}`}>{stat.icon}</div>
                </div>
                <p className="text-2xl font-bold text-slate-900 mb-1">{stat.value}</p>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${stat.up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                  {stat.up ? "▲" : "▼"} {stat.change}
                  <span className="font-normal text-slate-400 ml-1">ce mois</span>
                </span>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5 mb-6">
            <div className="lg:col-span-2 bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-bold text-slate-900">Aperçu des revenus</h2>
                <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-lg">2026</span>
              </div>
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
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: 12 }} formatter={(v: number) => [`${v.toLocaleString()} MAD`, "Revenue"]} />
                  <Area type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2.5} fill="url(#colorRevenue)" dot={false} activeDot={{ r: 5, fill: "#2563EB" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-base font-bold text-slate-900 mb-4">Top Villes</h2>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={cityData} cx="50%" cy="42%" innerRadius={50} outerRadius={72} paddingAngle={3} dataKey="value">
                    {cityData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: "#64748B" }}>{v}</span>} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: 12 }} formatter={(v) => [`${v}%`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom 3-column row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5 mb-6">
            {/* Best products */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">🏆 Meilleurs produits</h2>
                <a href="/produits" className="text-xs text-blue-600 font-medium hover:underline">Voir tout →</a>
              </div>
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
                      <p className={`text-xs font-semibold ${p.trend === "up" ? "text-emerald-600" : "text-red-400"}`}>
                        {p.trend === "up" ? "▲" : "▼"} marge {p.margin}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Team online */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Équipe</h2>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  {onlineCount} en ligne
                </span>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 px-6 py-4 border-b border-slate-50">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-500 mb-0.5">Confirmées</p>
                  <p className="text-lg font-bold text-blue-700">{totalConfirmed.toLocaleString()}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-emerald-500 mb-0.5">Livrées</p>
                  <p className="text-lg font-bold text-emerald-700">{totalDelivered.toLocaleString()}</p>
                </div>
              </div>

              <div className="divide-y divide-slate-50">
                {teamAgents.map((a) => (
                  <div key={a.name} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50/60 transition-colors">
                    <AgentAvatar name={a.name} online={a.online} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.name}</p>
                      <p className="text-xs text-slate-400">{a.confirmed} conf. · {a.delivered} livrées</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.online ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                      {a.online ? "En ligne" : "Hors ligne"}
                    </span>
                  </div>
                ))}
              </div>
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
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-400">{o.id}</td>
                    <td className="px-6 py-3.5 font-semibold text-slate-800">{o.customer}</td>
                    <td className="px-6 py-3.5 text-slate-500">{o.city}</td>
                    <td className="px-6 py-3.5 font-bold text-slate-800">{o.amount}</td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusStyle[o.status]}`}>{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
