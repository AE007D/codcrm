"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";

type OrderStatus = "nouveau" | "confirmé" | "annulé" | "expédié" | "livré" | "retourné";

type Order = {
  id: string;
  orderNumber: string;
  customer: string;
  city: string;
  phone: string;
  product: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  date: string;
  source: "lightfunnels" | "shopify" | "manuel";
  notes: string;
  attempts: number;
  noAnswer: number; // times client didn't pick up
};

const ORDERS_KEY = "codcrm_orders";

const DEMO_ORDERS: Order[] = [
  { id: "d1", orderNumber: "#10041", customer: "Youssef Alami",   city: "Casablanca", phone: "0612345678", product: "Montre Sport Pro",    amount: 350, currency: "MAD", status: "nouveau",  date: "14/05/2026", source: "lightfunnels", notes: "", attempts: 0, noAnswer: 0 },
  { id: "d2", orderNumber: "#10040", customer: "Fatima Zahra",    city: "Rabat",      phone: "0698765432", product: "Écouteurs BT X2",    amount: 199, currency: "MAD", status: "confirmé", date: "14/05/2026", source: "lightfunnels", notes: "", attempts: 1, noAnswer: 0 },
  { id: "d3", orderNumber: "#10039", customer: "Hamid Benali",    city: "Marrakech",  phone: "0711223344", product: "Sac à dos XL",       amount: 420, currency: "MAD", status: "expédié",  date: "13/05/2026", source: "manuel",       notes: "", attempts: 1, noAnswer: 0 },
  { id: "d4", orderNumber: "#10038", customer: "Samira Oukili",   city: "Fès",        phone: "0655667788", product: "Chargeur rapide 65W", amount: 149, currency: "MAD", status: "retourné", date: "13/05/2026", source: "lightfunnels", notes: "", attempts: 2, noAnswer: 0 },
  { id: "d5", orderNumber: "#10037", customer: "Khalid Tazi",     city: "Agadir",     phone: "0799887766", product: "Montre Sport Pro",    amount: 350, currency: "MAD", status: "livré",    date: "12/05/2026", source: "lightfunnels", notes: "", attempts: 1, noAnswer: 0 },
  { id: "d6", orderNumber: "#10036", customer: "Nadia Chraibi",   city: "Tanger",     phone: "0633445566", product: "Lampe LED bureau",    amount: 89,  currency: "MAD", status: "nouveau",  date: "12/05/2026", source: "shopify",      notes: "", attempts: 2, noAnswer: 2 },
  { id: "d7", orderNumber: "#10035", customer: "Omar Benhaddou",  city: "Oujda",      phone: "0777889900", product: "Écouteurs BT X2",    amount: 199, currency: "MAD", status: "annulé",   date: "11/05/2026", source: "lightfunnels", notes: "Pas intéressé", attempts: 2, noAnswer: 0 },
  { id: "d8", orderNumber: "#10034", customer: "Zineb Mernissi",  city: "Meknès",     phone: "0644556677", product: "Coque iPhone 15",     amount: 59,  currency: "MAD", status: "nouveau",  date: "11/05/2026", source: "lightfunnels", notes: "", attempts: 3, noAnswer: 3 },
];

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; border: string; icon: string }> = {
  nouveau:   { label: "Nouveau",   color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200",   icon: "🔔" },
  confirmé:  { label: "Confirmé",  color: "text-emerald-600",bg: "bg-emerald-50",border: "border-emerald-200", icon: "✅" },
  annulé:    { label: "Annulé",    color: "text-red-500",    bg: "bg-red-50",    border: "border-red-200",    icon: "❌" },
  expédié:   { label: "Expédié",   color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200",  icon: "📦" },
  livré:     { label: "Livré",     color: "text-emerald-700",bg: "bg-emerald-100",border:"border-emerald-300", icon: "🎉" },
  retourné:  { label: "Retourné",  color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200",  icon: "↩️" },
};

const PIPELINE: OrderStatus[] = ["nouveau", "confirmé", "annulé", "expédié", "livré", "retourné"];

const emptyForm = { customer: "", city: "", phone: "", product: "", amount: "", notes: "", source: "manuel" as Order["source"] };

export default function CommandesPage() {
  const [orders, setOrders] = useState<Order[]>(DEMO_ORDERS);
  const [filter, setFilter] = useState<OrderStatus | "tous">("tous");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [notesModal, setNotesModal] = useState<Order | null>(null);
  const [noteText, setNoteText] = useState("");
  const [drawer, setDrawer] = useState<Order | null>(null);

  /* Load from localStorage */
  useEffect(() => {
    const stored = localStorage.getItem(ORDERS_KEY);
    if (stored) setOrders(JSON.parse(stored));
  }, []);

  useEffect(() => {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  }, [orders]);

  /* Pull new orders from Lightfunnels webhook store */
  const pullLF = useCallback(async () => {
    try {
      const res = await fetch("/api/lf-orders");
      const data = await res.json();
      const lfOrders: Record<string, unknown>[] = data.orders ?? [];
      setOrders(prev => {
        const existingIds = new Set(prev.map(o => o.id));
        const newOrders: Order[] = lfOrders
          .filter(o => !existingIds.has(String(o.id)))
          .map(o => ({
            id: String(o.id),
            orderNumber: `#${o.order_number ?? String(o.id).slice(-5)}`,
            customer: String(o.customer_name ?? ""),
            city: String(o.city ?? ""),
            phone: String(o.customer_phone ?? ""),
            product: String(o.product ?? ""),
            amount: parseFloat(String(o.total_price ?? "0")),
            currency: String(o.currency ?? "MAD"),
            status: "nouveau" as OrderStatus,
            date: new Date(String(o.received_at ?? Date.now())).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" }),
            source: "lightfunnels" as Order["source"],
            notes: "",
            attempts: 0,
            noAnswer: 0,
          }));
        return newOrders.length > 0 ? [...newOrders, ...prev] : prev;
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    pullLF();
    const t = setInterval(pullLF, 10000);
    return () => clearInterval(t);
  }, [pullLF]);

  function setStatus(id: string, status: OrderStatus) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    setDrawer(prev => prev?.id === id ? { ...prev, status } : prev);
  }

  function incrementAttempt(id: string) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, attempts: o.attempts + 1 } : o));
    setDrawer(prev => prev?.id === id ? { ...prev, attempts: prev.attempts + 1 } : prev);
  }

  function markNoAnswer(id: string) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, noAnswer: o.noAnswer + 1, attempts: o.attempts + 1 } : o));
    setDrawer(prev => prev?.id === id ? { ...prev, noAnswer: prev.noAnswer + 1, attempts: prev.attempts + 1 } : prev);
  }

  function saveNoteInline(id: string, note: string) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, notes: note } : o));
    setDrawer(prev => prev?.id === id ? { ...prev, notes: note } : prev);
  }

  function addOrder() {
    if (!form.customer || !form.phone || !form.product || !form.amount) return;
    const now = new Date();
    const o: Order = {
      id: `m_${Date.now()}`,
      orderNumber: `#${Math.floor(10000 + Math.random() * 90000)}`,
      customer: form.customer,
      city: form.city,
      phone: form.phone,
      product: form.product,
      amount: parseFloat(form.amount),
      currency: "MAD",
      status: "nouveau",
      date: now.toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" }),
      source: form.source,
      notes: form.notes,
      attempts: 0,
      noAnswer: 0,
    };
    setOrders(prev => [o, ...prev]);
    setForm(emptyForm);
    setShowModal(false);
  }

  function saveNote(id: string, note: string) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, notes: note } : o));
    setNotesModal(null);
  }

  const counts = PIPELINE.reduce((acc, s) => { acc[s] = orders.filter(o => o.status === s).length; return acc; }, {} as Record<OrderStatus, number>);
  const needsCall = counts["nouveau"];
  const injoignable = orders.filter(o => o.status === "nouveau" && o.noAnswer >= 3).length;

  const displayed = orders.filter(o => {
    const matchStatus = filter === "tous" || o.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || o.customer.toLowerCase().includes(q) || o.phone.includes(q) || o.product.toLowerCase().includes(q) || o.orderNumber.includes(q) || o.city.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Commandes</h1>
            <p className="text-sm text-slate-400 hidden sm:block">{orders.length} commandes · {needsCall > 0 ? <span className="text-blue-600 font-semibold">{needsCall} appel(s) à faire</span> : "aucun appel en attente"}</p>
          </div>
          <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 lg:px-5 py-2.5 rounded-xl shadow-md shadow-blue-200 transition-colors whitespace-nowrap">
            + Nouvelle commande
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {/* Pipeline overview */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 lg:gap-3 mb-6">
            {PIPELINE.map(s => {
              const cfg = STATUS_CONFIG[s];
              return (
                <button key={s} onClick={() => setFilter(filter === s ? "tous" : s)}
                  className={`rounded-2xl p-4 border-2 text-left transition-all ${filter === s ? `${cfg.bg} ${cfg.border}` : "bg-white border-slate-100 hover:border-slate-200"}`}>
                  <div className="text-xl mb-1">{cfg.icon}</div>
                  <p className={`text-2xl font-black ${filter === s ? cfg.color : "text-slate-900"}`}>{counts[s]}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${filter === s ? cfg.color : "text-slate-400"}`}>{cfg.label}</p>
                </button>
              );
            })}
          </div>

          {/* Call queue banner */}
          {needsCall > 0 && (filter === "tous" || filter === "nouveau") && (
            <div className="bg-blue-600 rounded-2xl px-5 py-3 mb-3 flex items-center gap-3">
              <span className="text-white text-xl">📞</span>
              <p className="text-white text-sm font-semibold flex-1">{needsCall} commande(s) en attente d'appel — Appelez chaque client pour confirmer ou annuler</p>
              <button onClick={() => setFilter("nouveau")} className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
                Voir seulement
              </button>
            </div>
          )}
          {injoignable > 0 && (filter === "tous" || filter === "nouveau") && (
            <div className="bg-amber-500 rounded-2xl px-5 py-3 mb-5 flex items-center gap-3">
              <span className="text-white text-xl">📵</span>
              <p className="text-white text-sm font-semibold flex-1">{injoignable} client(s) injoignable(s) — 3 tentatives sans réponse, pensez à annuler</p>
            </div>
          )}

          {/* Search + filter */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input type="text" placeholder="Rechercher client, téléphone, produit…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white" />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value as OrderStatus | "tous")}
              className="text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none text-slate-600 bg-white focus:border-blue-400">
              <option value="tous">Tous les statuts</option>
              {PIPELINE.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label} ({counts[s]})</option>)}
            </select>
          </div>

          {/* Orders table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-100 bg-slate-50/50">
                    {["#", "Client", "Ville", "Téléphone", "Produit", "Montant", "Source", "Statut", "Actions"].map(h => (
                      <th key={h} className="text-left px-5 py-3 font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-16 text-slate-400 text-sm">Aucune commande trouvée</td></tr>
                  )}
                  {displayed.map(o => {
                    const cfg = STATUS_CONFIG[o.status];
                    const isInjoignable = o.status === "nouveau" && o.noAnswer >= 3;
                    const hasNoAnswer = o.status === "nouveau" && o.noAnswer > 0 && o.noAnswer < 3;
                    return (
                      <tr key={o.id} onClick={() => setDrawer(o)} className={`border-b transition-colors cursor-pointer ${isInjoignable ? "bg-amber-50/60 hover:bg-amber-50 border-amber-100" : hasNoAnswer ? "bg-slate-50/40 hover:bg-slate-50/80 border-slate-50" : "border-slate-50 hover:bg-slate-50/60"}`}>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-400 whitespace-nowrap">{o.orderNumber}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-slate-800">{o.customer}</p>
                          {o.notes && <p className="text-xs text-slate-400 truncate max-w-[140px]">{o.notes}</p>}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{o.city}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <a href={`tel:${o.phone}`} onClick={e => { e.stopPropagation(); incrementAttempt(o.id); }}
                            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium transition-colors group">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 group-hover:scale-110 transition-transform"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                            {o.phone}
                          </a>
                          {o.noAnswer > 0 && (
                            <span className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg ${o.noAnswer >= 3 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                              📵 {o.noAnswer}× sans réponse
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 max-w-[130px] truncate">{o.product}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-800 whitespace-nowrap">{o.amount} {o.currency}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${
                            o.source === "lightfunnels" ? "bg-orange-50 text-orange-600" :
                            o.source === "shopify" ? "bg-emerald-50 text-emerald-600" :
                            "bg-slate-100 text-slate-500"
                          }`}>{o.source}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {o.status === "nouveau" && (
                              <>
                                <button onClick={() => setStatus(o.id, "confirmé")}
                                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm shadow-emerald-200">
                                  ✓ Confirmer
                                </button>
                                <button onClick={() => markNoAnswer(o.id)}
                                  className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${o.noAnswer >= 3 ? "bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-200" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}>
                                  📵 Pas dispo
                                </button>
                                <button onClick={() => setStatus(o.id, "annulé")}
                                  className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm shadow-red-200">
                                  ✗ Annuler
                                </button>
                              </>
                            )}
                            {o.status === "confirmé" && (
                              <button onClick={() => setStatus(o.id, "expédié")}
                                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                                📦 Expédier
                              </button>
                            )}
                            {o.status === "expédié" && (
                              <>
                                <button onClick={() => setStatus(o.id, "livré")}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                                  🎉 Livré
                                </button>
                                <button onClick={() => setStatus(o.id, "retourné")}
                                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                                  ↩ Retourné
                                </button>
                              </>
                            )}
                            <button onClick={() => { setNotesModal(o); setNoteText(o.notes); }}
                              className="text-slate-400 hover:text-slate-600 border border-slate-200 hover:bg-slate-50 text-xs px-2.5 py-1.5 rounded-lg transition-colors">
                              📝
                            </button>
                          </div>
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

      {/* Add order modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Nouvelle commande</h2>
              <button onClick={() => { setShowModal(false); setForm(emptyForm); }} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "customer", label: "Nom client *", ph: "Ex: Youssef Alami", full: true },
                { key: "phone", label: "Téléphone *", ph: "0612345678" },
                { key: "city", label: "Ville", ph: "Casablanca" },
                { key: "product", label: "Produit *", ph: "Ex: Montre Sport", full: true },
                { key: "amount", label: "Montant COD (MAD) *", ph: "350" },
                { key: "notes", label: "Notes", ph: "Optionnel" },
              ].map(({ key, label, ph, full }) => (
                <div key={key} className={full ? "col-span-2" : ""}>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
                  <input type="text" placeholder={ph} value={form[key as keyof typeof emptyForm] as string}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Source</label>
                <div className="flex gap-2">
                  {(["manuel", "lightfunnels", "shopify"] as Order["source"][]).map(s => (
                    <button key={s} onClick={() => setForm(f => ({ ...f, source: s }))}
                      className={`flex-1 py-2 rounded-xl border-2 text-xs font-semibold capitalize transition-all ${form.source === s ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-500"}`}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowModal(false); setForm(emptyForm); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
              <button onClick={addOrder} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-200">Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* Notes modal */}
      {notesModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-slate-900 mb-1">Notes — {notesModal.customer}</h2>
            <p className="text-xs text-slate-400 mb-4">{notesModal.orderNumber} · {notesModal.product}</p>
            <textarea rows={4} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Raison d'annulation, adresse précise, préférence de livraison…"
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-400 resize-none" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setNotesModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
              <button onClick={() => saveNote(notesModal.id, noteText)} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {/* Order detail drawer */}
      {drawer && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setDrawer(null)} />
          <div className="fixed right-0 top-0 h-full w-full sm:w-[440px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-slate-400">{drawer.orderNumber}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                  drawer.source === "lightfunnels" ? "bg-orange-50 text-orange-600" :
                  drawer.source === "shopify" ? "bg-emerald-50 text-emerald-600" :
                  "bg-slate-100 text-slate-500"
                }`}>{drawer.source}</span>
                <span className="text-xs text-slate-400">{drawer.date}</span>
              </div>
              <button onClick={() => setDrawer(null)} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Client info */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Client</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg shrink-0">
                    {drawer.customer.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-base">{drawer.customer}</p>
                    <p className="text-sm text-slate-500">{drawer.city || "Ville inconnue"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <a href={`tel:${drawer.phone}`} onClick={() => incrementAttempt(drawer.id)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-md shadow-blue-200">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                    {drawer.phone}
                  </a>
                  <button onClick={() => markNoAnswer(drawer.id)}
                    className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${drawer.noAnswer >= 3 ? "bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-200" : "bg-slate-200 hover:bg-slate-300 text-slate-700"}`}>
                    📵 Pas dispo
                  </button>
                </div>
                {drawer.noAnswer > 0 && (
                  <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl ${drawer.noAnswer >= 3 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                    <span>📵</span>
                    <span>{drawer.noAnswer} tentative{drawer.noAnswer > 1 ? "s" : ""} sans réponse · {drawer.attempts} appel{drawer.attempts > 1 ? "s" : ""} au total</span>
                  </div>
                )}
              </div>

              {/* Product & amount */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Commande</h3>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800">{drawer.product}</p>
                  <p className="text-lg font-black text-slate-900">{drawer.amount} {drawer.currency}</p>
                </div>
              </div>

              {/* Status change */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Changer le statut</h3>
                <div className="grid grid-cols-3 gap-2">
                  {PIPELINE.map(s => {
                    const cfg = STATUS_CONFIG[s];
                    const active = drawer.status === s;
                    return (
                      <button key={s} onClick={() => setStatus(drawer.id, s)}
                        className={`flex flex-col items-center gap-1 py-3 px-2 rounded-2xl border-2 text-xs font-semibold transition-all ${active ? `${cfg.bg} ${cfg.border} ${cfg.color}` : "bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600"}`}>
                        <span className="text-lg">{cfg.icon}</span>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notes</h3>
                <textarea
                  rows={3}
                  defaultValue={drawer.notes}
                  onBlur={e => saveNoteInline(drawer.id, e.target.value)}
                  placeholder="Raison d'annulation, adresse précise, préférence de livraison…"
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-none bg-white"
                />
                <p className="text-xs text-slate-400">Sauvegardé automatiquement à la perte de focus</p>
              </div>

              {/* Quick actions based on status */}
              {drawer.status === "nouveau" && (
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setStatus(drawer.id, "confirmé")}
                    className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md shadow-emerald-200 transition-colors">
                    ✓ Confirmer la commande
                  </button>
                  <button onClick={() => setStatus(drawer.id, "annulé")}
                    className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold shadow-md shadow-red-200 transition-colors">
                    ✗ Annuler
                  </button>
                </div>
              )}
              {drawer.status === "confirmé" && (
                <button onClick={() => setStatus(drawer.id, "expédié")}
                  className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-200 transition-colors">
                  📦 Marquer comme expédié
                </button>
              )}
              {drawer.status === "expédié" && (
                <div className="flex gap-2">
                  <button onClick={() => setStatus(drawer.id, "livré")}
                    className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md shadow-emerald-200 transition-colors">
                    🎉 Livré
                  </button>
                  <button onClick={() => setStatus(drawer.id, "retourné")}
                    className="flex-1 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold shadow-md shadow-orange-200 transition-colors">
                    ↩ Retourné
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
