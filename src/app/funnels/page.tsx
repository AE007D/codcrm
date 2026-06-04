"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import { useLang } from "@/lib/i18n";

type LeadType = "purchase" | "abandoned";

type FunnelLead = {
  id: string;
  type: LeadType;
  customer: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  product: string;
  amount: number;
  currency: string;
  funnel: string;
  funnelUrl: string;
  quantity: number;
  created_at: string;
  received_at: string;
  callAttempts: number;
  recovered: boolean;
  notes: string;
};


type Filter = "tous" | "purchase" | "abandoned" | "recovered";

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `il y a ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

export default function FunnelsPage() {
  const { t } = useLang();
  const [leads, setLeads] = useState<FunnelLead[]>([]);
  const [filter, setFilter] = useState<Filter>("tous");
  const [search, setSearch] = useState("");
  const [noteModal, setNoteModal] = useState<FunnelLead | null>(null);
  const [noteText, setNoteText] = useState("");

  /* Poll server — always replace from source of truth */
  const pollLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/lf-leads");
      const data = await res.json();
      const serverLeads: FunnelLead[] = data.leads ?? [];
      // Preserve local notes/callAttempts/recovered for existing leads
      setLeads(prev => {
        const localById = new Map(prev.map(l => [l.id, l]));
        return serverLeads.map(l => {
          const existing = localById.get(l.id);
          return existing
            ? { ...l, notes: existing.notes, callAttempts: existing.callAttempts, recovered: existing.recovered }
            : l;
        });
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    pollLeads();
    const t = setInterval(pollLeads, 8000);
    return () => clearInterval(t);
  }, [pollLeads]);

  function patchLead(id: string, patch: Partial<FunnelLead>) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    // Also update server
    fetch("/api/lf-leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    }).catch(() => {});
  }

  function markRecovered(lead: FunnelLead) {
    patchLead(lead.id, { recovered: true, notes: lead.notes || "Récupéré via appel" });
  }

  function incrementCall(lead: FunnelLead) {
    patchLead(lead.id, { callAttempts: lead.callAttempts + 1 });
  }

  /* KPIs */
  const purchases  = leads.filter(l => l.type === "purchase");
  const abandoned  = leads.filter(l => l.type === "abandoned");
  const recovered  = abandoned.filter(l => l.recovered);
  const totalRevenue = purchases.reduce((s, l) => s + l.amount, 0);
  const potentialRevenue = abandoned.filter(l => !l.recovered).reduce((s, l) => s + l.amount, 0);
  const conversionRate = leads.length > 0 ? Math.round((purchases.length / leads.length) * 100) : 0;
  const recoveryRate = abandoned.length > 0 ? Math.round((recovered.length / abandoned.length) * 100) : 0;

  /* Filter + search */
  const displayed = leads.filter(l => {
    if (filter === "purchase" && l.type !== "purchase") return false;
    if (filter === "abandoned" && (l.type !== "abandoned" || l.recovered)) return false;
    if (filter === "recovered" && !l.recovered) return false;
    const q = search.toLowerCase();
    return !q || l.customer.toLowerCase().includes(q) || l.phone.includes(q) || l.product.toLowerCase().includes(q) || l.city.toLowerCase().includes(q) || l.funnel.toLowerCase().includes(q);
  });

  /* Group by funnel name */
  const funnelNames = [...new Set(leads.map(l => l.funnel).filter(Boolean))];

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between shrink-0 sidebar-header-pl">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t("checkouts_title")}</h1>
            <p className="text-sm text-slate-400 hidden sm:block">{t("checkouts_subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Webhook actif
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5 mb-6">
            {[
              { label: "Total", value: leads.length, sub: `${funnelNames.length} source(s)`, color: "text-slate-900", icon: "📊" },
              { label: "Achetés ✅", value: purchases.length, sub: `${totalRevenue.toLocaleString()} MAD encaissés`, color: "text-emerald-600", icon: "🛒" },
              { label: "Abandonnés 📵", value: abandoned.filter(l => !l.recovered).length, sub: `${potentialRevenue.toLocaleString()} MAD à récupérer`, color: "text-red-500", icon: "⚠️" },
              { label: "Taux conv.", value: `${conversionRate}%`, sub: `${recoveryRate}% récupérés`, color: conversionRate >= 50 ? "text-emerald-600" : conversionRate >= 30 ? "text-amber-600" : "text-red-500", icon: "📈" },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-2xl p-4 lg:p-5 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-500 font-medium leading-tight">{k.label}</p>
                  <span className="text-xl">{k.icon}</span>
                </div>
                <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
                <p className="text-xs text-slate-400 mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Recovery opportunity banner */}
          {abandoned.filter(l => !l.recovered && l.callAttempts === 0).length > 0 && (
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl px-5 py-4 mb-5 flex items-center gap-4">
              <span className="text-3xl">🔥</span>
              <div className="flex-1">
                <p className="text-white font-bold text-base">
                  {abandoned.filter(l => !l.recovered && l.callAttempts === 0).length} panier(s) abandonné(s) jamais rappelés
                </p>
                <p className="text-white/80 text-sm mt-0.5">
                  {abandoned.filter(l => !l.recovered && l.callAttempts === 0).reduce((s, l) => s + l.amount, 0).toLocaleString()} MAD de chiffre à récupérer — appelez maintenant !
                </p>
              </div>
              <button onClick={() => setFilter("abandoned")} className="bg-white text-amber-600 font-bold text-sm px-4 py-2 rounded-xl shrink-0 hover:bg-amber-50 transition-colors">
                Voir les abandons →
              </button>
            </div>
          )}

          {/* Funnel breakdown pills */}
          {funnelNames.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {funnelNames.map(fn => {
                const fLeads = leads.filter(l => l.funnel === fn);
                const fPurchases = fLeads.filter(l => l.type === "purchase").length;
                const fRate = fLeads.length > 0 ? Math.round((fPurchases / fLeads.length) * 100) : 0;
                return (
                  <div key={fn} className="bg-white border border-slate-100 rounded-xl px-4 py-2 flex items-center gap-3 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm font-semibold text-slate-800 max-w-[150px] truncate">{fn || "Funnel sans nom"}</span>
                    <span className="text-xs text-slate-400">{fLeads.length} abandons</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${fRate >= 50 ? "bg-emerald-50 text-emerald-600" : fRate >= 30 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-500"}`}>
                      {fRate}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Filter tabs + search */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex gap-2 flex-wrap">
              {([
                { key: "tous",      label: t("filter_all"),    count: leads.length },
                { key: "purchase",  label: t("purchased"),     count: purchases.length },
                { key: "abandoned", label: t("abandoned_tab"), count: abandoned.filter(l => !l.recovered).length },
                { key: "recovered", label: t("recovered"),     count: recovered.length },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setFilter(tab.key)}
                  className={`text-xs font-semibold px-3 py-2 rounded-xl border transition-all ${filter === tab.key ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input type="text" placeholder={t("search_funnel")} value={search} onChange={e => setSearch(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white" />
            </div>
          </div>

          {/* Leads list */}
          <div className="space-y-3">
            {displayed.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-16 flex flex-col items-center gap-3">
                <span className="text-5xl">📭</span>
                <p className="text-slate-600 font-semibold">Aucun abandon trouvé</p>
                <p className="text-slate-400 text-sm text-center">Configurez vos webhooks Lightfunnels pour recevoir les commandes et paniers abandonnés</p>
              </div>
            )}

            {displayed.map(lead => {
              const isAbandoned = lead.type === "abandoned" && !lead.recovered;
              const isPurchase = lead.type === "purchase";
              const isRecovered = lead.type === "abandoned" && lead.recovered;

              return (
                <div key={lead.id} className={`bg-white rounded-2xl border-2 shadow-sm transition-all hover:shadow-md ${isPurchase ? "border-emerald-100" : isRecovered ? "border-blue-100" : lead.callAttempts === 0 ? "border-amber-200" : "border-slate-100"}`}>
                  <div className="p-4 lg:p-5">
                    <div className="flex items-start gap-4">
                      {/* Type icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${isPurchase ? "bg-emerald-50" : isRecovered ? "bg-blue-50" : "bg-amber-50"}`}>
                        {isPurchase ? "✅" : isRecovered ? "🔄" : "📵"}
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-bold text-slate-900">{lead.customer || "Client inconnu"}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${isPurchase ? "bg-emerald-50 text-emerald-600" : isRecovered ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>
                            {isPurchase ? "Achat confirmé" : isRecovered ? "Récupéré ✓" : "Panier abandonné"}
                          </span>
                          {lead.callAttempts > 0 && !isRecovered && (
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg font-medium">
                              {lead.callAttempts} appel{lead.callAttempts > 1 ? "s" : ""}
                            </span>
                          )}
                          <span className="text-xs text-slate-400 ml-auto">{relTime(lead.created_at)}</span>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-500 mb-2">
                          {lead.city && <span>📍 {lead.city}</span>}
                          {lead.product && <span className="font-medium text-slate-700">🛍️ {lead.product}</span>}
                          {lead.funnel && <span className="truncate max-w-[180px]">🔗 {lead.funnel}</span>}
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-black text-slate-900">{lead.amount} {lead.currency}</span>
                            {lead.quantity > 1 && <span className="text-xs text-slate-400">× {lead.quantity}</span>}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {lead.phone && (
                              <a href={`tel:${lead.phone}`}
                                onClick={() => incrementCall(lead)}
                                className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl transition-colors ${isPurchase ? "bg-slate-100 hover:bg-slate-200 text-slate-700" : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"}`}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                                {lead.phone}
                              </a>
                            )}
                            {isAbandoned && (
                              <button onClick={() => markRecovered(lead)}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-2 rounded-xl shadow-md shadow-emerald-200 transition-colors">
                                ✓ Récupéré
                              </button>
                            )}
                            <button onClick={() => { setNoteModal(lead); setNoteText(lead.notes); }}
                              className="border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs px-2.5 py-2 rounded-xl transition-colors">
                              📝{lead.notes ? " ✓" : ""}
                            </button>
                          </div>
                        </div>

                        {lead.notes && (
                          <p className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-1.5 border border-slate-100">{lead.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Notes modal */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-slate-900 mb-1">Notes — {noteModal.customer}</h2>
            <p className="text-xs text-slate-400 mb-4">{noteModal.phone} · {noteModal.product}</p>
            <textarea rows={3} value={noteText} onChange={e => setNoteText(e.target.value)}
              placeholder="Raison d'abandon, heure préférée de rappel, objection client…"
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-400 resize-none" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setNoteModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">{t("cancel")}</button>
              <button onClick={() => { patchLead(noteModal.id, { notes: noteText }); setNoteModal(null); }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
