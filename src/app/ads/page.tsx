"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";

type Platform = "Facebook" | "TikTok";

type Campaign = {
  id: number;
  platform: Platform;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  orders: number;
  delivered: number;
  revenue: number;
  date: string;
};

const initialCampaigns: Campaign[] = [];

const emptyForm = {
  platform: "Facebook" as Platform,
  name: "",
  spend: "",
  impressions: "",
  clicks: "",
  orders: "",
  delivered: "",
  revenue: "",
  date: "",
};

const PLATFORM_CONFIG = {
  Facebook: { color: "bg-blue-600", light: "bg-blue-50 text-blue-600", icon: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )},
  TikTok: { color: "bg-slate-900", light: "bg-slate-100 text-slate-800", icon: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/>
    </svg>
  )},
};

function fmt(n: number) { return n.toLocaleString("fr-MA"); }
function mad(n: number) { return `${fmt(n)} MAD`; }


export default function AdsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"All" | Platform>("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  // Convert campaign date "DD/MM/YYYY" → "YYYY-MM-DD" for comparison
  function toISO(d: string) {
    const [dd, mm, yyyy] = d.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

  const dateFiltered = campaigns.filter(c => {
    if (!dateFrom && !dateTo) return true;
    const iso = toISO(c.date);
    if (dateFrom && iso < dateFrom) return false;
    if (dateTo   && iso > dateTo)   return false;
    return true;
  });

  const filtered = filter === "All" ? dateFiltered : dateFiltered.filter(c => c.platform === filter);

  const totalSpend    = dateFiltered.reduce((a, c) => a + c.spend, 0);
  const totalRevenue  = dateFiltered.reduce((a, c) => a + c.revenue, 0);
  const totalOrders   = dateFiltered.reduce((a, c) => a + c.orders, 0);
  const totalDelivered = dateFiltered.reduce((a, c) => a + c.delivered, 0);
  const globalCPP = totalOrders ? totalSpend / totalOrders : 0;
  const globalCPD = totalDelivered ? totalSpend / totalDelivered : 0;
  const globalROAS = totalSpend ? totalRevenue / totalSpend : 0;
  const profit = totalRevenue - totalSpend;

  function handleAdd() {
    const { name, spend, impressions, clicks, orders, delivered, revenue, date } = form;
    if (!name || !spend || !orders || !delivered || !revenue || !date) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (Number(delivered) > Number(orders)) {
      setError("Les livrés ne peuvent pas dépasser les commandes.");
      return;
    }
    setCampaigns(prev => [...prev, {
      id: Date.now(),
      platform: form.platform,
      name,
      spend: Number(spend),
      impressions: Number(impressions) || 0,
      clicks: Number(clicks) || 0,
      orders: Number(orders),
      delivered: Number(delivered),
      revenue: Number(revenue),
      date,
    }]);
    setForm(emptyForm);
    setError("");
    setShowModal(false);
  }

  function handleDelete(id: number) {
    setCampaigns(prev => prev.filter(c => c.id !== id));
  }

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Ads Manager</h1>
            <p className="text-sm text-slate-400 hidden sm:block">Facebook & TikTok — calcul CPP / CPD / ROAS</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-md shadow-blue-200 whitespace-nowrap">
              + Ajouter campagne
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {/* Global KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5 mb-6">
            {[
              { label: "Budget total dépensé", value: mad(totalSpend), sub: `${campaigns.length} campagnes`, color: "text-slate-900" },
              { label: "Coût / Commande (CPP)", value: `${globalCPP.toFixed(1)} MAD`, sub: `${totalOrders} commandes`, color: "text-blue-600" },
              { label: "Coût / Livré (CPD)", value: `${globalCPD.toFixed(1)} MAD`, sub: `${totalDelivered} livrés`, color: "text-indigo-600" },
              { label: "ROAS global", value: `×${globalROAS.toFixed(2)}`, sub: profit >= 0 ? `+${mad(profit)} profit` : `${mad(profit)} perte`, color: profit >= 0 ? "text-emerald-600" : "text-red-500" },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <p className="text-sm text-slate-500 font-medium mb-3">{k.label}</p>
                <p className={`text-2xl font-bold mb-1 ${k.color}`}>{k.value}</p>
                <p className="text-xs text-slate-400">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Per-platform breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-5 mb-6">
            {(["Facebook", "TikTok"] as Platform[]).map(platform => {
              const pc = dateFiltered.filter(c => c.platform === platform);
              const ps = pc.reduce((a, c) => a + c.spend, 0);
              const po = pc.reduce((a, c) => a + c.orders, 0);
              const pd = pc.reduce((a, c) => a + c.delivered, 0);
              const pr = pc.reduce((a, c) => a + c.revenue, 0);
              const cfg = PLATFORM_CONFIG[platform];
              return (
                <div key={platform} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-lg ${cfg.color} flex items-center justify-center text-white`}>{cfg.icon}</div>
                    <span className="font-bold text-slate-900">{platform} Ads</span>
                    <span className="ml-auto text-xs text-slate-400">{pc.length} campagnes</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3">
                    {[
                      { label: "Dépense", value: mad(ps) },
                      { label: "CPP", value: po ? `${(ps/po).toFixed(1)} MAD` : "—" },
                      { label: "CPD", value: pd ? `${(ps/pd).toFixed(1)} MAD` : "—" },
                      { label: "ROAS", value: ps ? `×${(pr/ps).toFixed(2)}` : "—" },
                    ].map(m => (
                      <div key={m.label} className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-slate-400 mb-1">{m.label}</p>
                        <p className="text-sm font-bold text-slate-800">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Campaigns table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
              <h2 className="text-base font-bold text-slate-900 mr-auto">Campagnes</h2>

              {/* Date shortcuts */}
              {(() => {
                const today = new Date().toISOString().slice(0, 10);
                const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
                const weekStart = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
                const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
                return (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: "Aujourd'hui", f: today,      t: today },
                      { label: "Hier",         f: yesterday,  t: yesterday },
                      { label: "7 jours",      f: weekStart,  t: today },
                      { label: "Ce mois",      f: monthStart, t: today },
                    ].map(({ label, f, t }) => (
                      <button
                        key={label}
                        onClick={() => { setDateFrom(f); setDateTo(t); }}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                          dateFrom === f && dateTo === t
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >{label}</button>
                    ))}
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-blue-400" />
                    <span className="text-slate-400 text-xs">→</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-blue-400" />
                    {(dateFrom || dateTo) && (
                      <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                        className="text-xs text-red-400 hover:text-red-600 font-medium px-1">✕</button>
                    )}
                  </div>
                );
              })()}

              {/* Platform filter */}
              {(["All", "Facebook", "TikTok"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    filter === f ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {f === "All" ? "Toutes" : f}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-50">
                    {["Plateforme","Campagne","Dépense","Impressions","Clics","Commandes","Livrés","Revenue","CPP","CPD","ROAS","Date",""].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={13} className="text-center py-16 text-slate-400 text-sm">Aucune campagne — ajoutez manuellement ou synchronisez Facebook / TikTok</td></tr>
                  )}
                  {filtered.map(c => {
                    const cpp = c.orders ? c.spend / c.orders : 0;
                    const cpd = c.delivered ? c.spend / c.delivered : 0;
                    const roas = c.spend ? c.revenue / c.spend : 0;
                    const cfg = PLATFORM_CONFIG[c.platform];
                    return (
                      <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${cfg.light}`}>
                            {cfg.icon}{c.platform}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-800 max-w-[160px] truncate">{c.name}</td>
                        <td className="px-4 py-3.5 font-bold text-slate-800">{mad(c.spend)}</td>
                        <td className="px-4 py-3.5 text-slate-500">{fmt(c.impressions)}</td>
                        <td className="px-4 py-3.5 text-slate-500">{fmt(c.clicks)}</td>
                        <td className="px-4 py-3.5 text-slate-600 font-medium">{c.orders}</td>
                        <td className="px-4 py-3.5">
                          <span className="bg-emerald-50 text-emerald-600 text-xs font-semibold px-2 py-0.5 rounded-lg">{c.delivered}</span>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-800">{mad(c.revenue)}</td>
                        <td className="px-4 py-3.5">
                          <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-lg">{cpp.toFixed(1)} MAD</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="bg-indigo-50 text-indigo-600 text-xs font-bold px-2 py-0.5 rounded-lg">{cpd.toFixed(1)} MAD</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${roas >= 2 ? "bg-emerald-50 text-emerald-600" : roas >= 1 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-500"}`}>
                            ×{roas.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">{c.date}</td>
                        <td className="px-4 py-3.5">
                          <button onClick={() => handleDelete(c.id)} className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">Supprimer</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Nouvelle campagne</h2>
              <button onClick={() => { setShowModal(false); setError(""); setForm(emptyForm); }} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}

            {/* Platform selector */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600 mb-2 block">Plateforme</label>
              <div className="flex gap-2">
                {(["Facebook", "TikTok"] as Platform[]).map(p => {
                  const cfg = PLATFORM_CONFIG[p];
                  return (
                    <button
                      key={p}
                      onClick={() => setForm(f => ({ ...f, platform: p }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                        form.platform === p
                          ? `${cfg.color} text-white border-transparent shadow-md`
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {cfg.icon} {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "name", label: "Nom de la campagne *", placeholder: "Ex: Montre - Casa", full: true },
                { key: "date", label: "Date *", placeholder: "JJ/MM/AAAA", type: "date" },
                { key: "spend", label: "Budget dépensé (MAD) *", placeholder: "Ex: 1200" },
                { key: "revenue", label: "Revenue généré (MAD) *", placeholder: "Ex: 16800" },
                { key: "orders", label: "Commandes *", placeholder: "Ex: 48" },
                { key: "delivered", label: "Livrées *", placeholder: "Ex: 41" },
                { key: "impressions", label: "Impressions", placeholder: "Ex: 85000" },
                { key: "clicks", label: "Clics", placeholder: "Ex: 1240" },
              ].map(({ key, label, placeholder, full, type }) => (
                <div key={key} className={full ? "col-span-2" : ""}>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
                  <input
                    type={type || "text"}
                    placeholder={placeholder}
                    value={form[key as keyof typeof form] as string}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                  />
                </div>
              ))}
            </div>

            {/* Live preview */}
            {form.spend && form.orders && form.delivered && form.revenue && (
              <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs font-semibold text-blue-700 mb-2">Aperçu des métriques</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-blue-500">CPP</p>
                    <p className="text-sm font-bold text-blue-700">{(Number(form.spend) / Number(form.orders) || 0).toFixed(1)} MAD</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-500">CPD</p>
                    <p className="text-sm font-bold text-blue-700">{(Number(form.spend) / Number(form.delivered) || 0).toFixed(1)} MAD</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-500">ROAS</p>
                    <p className="text-sm font-bold text-blue-700">×{(Number(form.revenue) / Number(form.spend) || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowModal(false); setError(""); setForm(emptyForm); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Annuler
              </button>
              <button onClick={handleAdd} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-200 transition-colors">
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
