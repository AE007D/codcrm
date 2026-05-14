"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

type PaymentRecord = {
  id: number;
  amount: number;
  orders: number;
  date: string;
  note: string;
};

type Agent = {
  id: number;
  name: string;
  phone: string;
  email: string;
  ratePerDelivered: number;
  confirmedOrders: number;
  deliveredOrders: number;
  paidOrders: number;
  status: "Actif" | "Inactif";
  joinDate: string;
  payments: PaymentRecord[];
};

const STORAGE_KEY = "codcrm_equipe";

const defaultAgents: Agent[] = [
  { id: 1, name: "Sara Benali", phone: "06 11 22 33 44", email: "sara@codcrm.ma", ratePerDelivered: 5, confirmedOrders: 312, deliveredOrders: 280, paidOrders: 200, status: "Actif", joinDate: "01/01/2026", payments: [{ id: 1, amount: 1000, orders: 200, date: "01/04/2026", note: "Paiement Avril" }] },
  { id: 2, name: "Karim Idrissi", phone: "06 55 66 77 88", email: "karim@codcrm.ma", ratePerDelivered: 5, confirmedOrders: 198, deliveredOrders: 171, paidOrders: 100, status: "Actif", joinDate: "15/01/2026", payments: [{ id: 1, amount: 500, orders: 100, date: "01/04/2026", note: "Paiement Avril" }] },
  { id: 3, name: "Nour El Houda", phone: "07 33 44 55 66", email: "nour@codcrm.ma", ratePerDelivered: 4, confirmedOrders: 145, deliveredOrders: 122, paidOrders: 122, status: "Actif", joinDate: "01/02/2026", payments: [{ id: 1, amount: 488, orders: 122, date: "30/04/2026", note: "Paiement complet" }] },
  { id: 4, name: "Mehdi Tazi", phone: "06 77 88 99 00", email: "mehdi@codcrm.ma", ratePerDelivered: 5, confirmedOrders: 89, deliveredOrders: 74, paidOrders: 0, status: "Inactif", joinDate: "01/03/2026", payments: [] },
];

const emptyForm = { name: "", phone: "", email: "", ratePerDelivered: "5" };

function AgentInitial({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
      {initials}
    </div>
  );
}

export default function EquipePage() {
  const [agents, setAgents] = useState<Agent[]>(defaultAgents);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState<Agent | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [payForm, setPayForm] = useState({ orders: "", note: "" });
  const [formError, setFormError] = useState("");
  const [payError, setPayError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setAgents(JSON.parse(stored));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  }, [agents]);

  function handleAdd() {
    const { name, phone, email, ratePerDelivered } = form;
    if (!name || !phone || !ratePerDelivered) { setFormError("Nom, téléphone et tarif sont requis."); return; }
    const newAgent: Agent = {
      id: Date.now(), name, phone, email,
      ratePerDelivered: Number(ratePerDelivered),
      confirmedOrders: 0, deliveredOrders: 0, paidOrders: 0,
      status: "Actif",
      joinDate: new Date().toLocaleDateString("fr-MA"),
      payments: [],
    };
    setAgents(prev => [...prev, newAgent]);
    setForm(emptyForm); setFormError(""); setShowAddModal(false);
  }

  function handlePay() {
    if (!showPayModal) return;
    const orders = Number(payForm.orders);
    const unpaidOrders = showPayModal.deliveredOrders - showPayModal.paidOrders;
    if (!orders || orders <= 0) { setPayError("Entrez un nombre de commandes valide."); return; }
    if (orders > unpaidOrders) { setPayError(`Maximum ${unpaidOrders} commandes non payées.`); return; }
    const amount = orders * showPayModal.ratePerDelivered;
    const record: PaymentRecord = {
      id: Date.now(), amount, orders,
      date: new Date().toLocaleDateString("fr-MA"),
      note: payForm.note || "Paiement",
    };
    setAgents(prev => prev.map(a =>
      a.id === showPayModal.id
        ? { ...a, paidOrders: a.paidOrders + orders, payments: [...a.payments, record] }
        : a
    ));
    if (selectedAgent?.id === showPayModal.id) {
      setSelectedAgent(prev => prev ? { ...prev, paidOrders: prev.paidOrders + orders, payments: [...prev.payments, record] } : null);
    }
    setPayForm({ orders: "", note: "" }); setPayError(""); setShowPayModal(null);
  }

  function toggleStatus(id: number) {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, status: a.status === "Actif" ? "Inactif" : "Actif" } : a));
  }

  const totalOwed = agents.reduce((s, a) => s + (a.deliveredOrders - a.paidOrders) * a.ratePerDelivered, 0);
  const totalPaid = agents.reduce((s, a) => s + a.paidOrders * a.ratePerDelivered, 0);
  const totalDelivered = agents.reduce((s, a) => s + a.deliveredOrders, 0);

  const viewAgent = selectedAgent ? agents.find(a => a.id === selectedAgent.id) ?? null : null;

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Équipe Confirmation</h1>
            <p className="text-sm text-slate-400">{agents.filter(a => a.status === "Actif").length} agents actifs — paiement par livraison confirmée</p>
          </div>
          <button onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-200 transition-colors">
            + Ajouter agent
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5 mb-6">
            {[
              { label: "Agents actifs", value: agents.filter(a => a.status === "Actif").length.toString(), color: "text-slate-900" },
              { label: "Livraisons confirmées", value: totalDelivered.toLocaleString(), color: "text-blue-600" },
              { label: "À payer", value: `${totalOwed.toLocaleString()} MAD`, color: "text-amber-600" },
              { label: "Total payé", value: `${totalPaid.toLocaleString()} MAD`, color: "text-emerald-600" },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <p className="text-sm text-slate-500 font-medium mb-2">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5">
            {/* Agents list */}
            <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Agents</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {agents.map(a => {
                  const unpaid = a.deliveredOrders - a.paidOrders;
                  const owed = unpaid * a.ratePerDelivered;
                  const progress = a.deliveredOrders ? Math.round((a.paidOrders / a.deliveredOrders) * 100) : 0;
                  return (
                    <div key={a.id}
                      onClick={() => setSelectedAgent(a)}
                      className={`px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50/60 transition-colors ${selectedAgent?.id === a.id ? "bg-blue-50/40" : ""}`}
                    >
                      <AgentInitial name={a.name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-slate-800 text-sm truncate">{a.name}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.status === "Actif" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                            {a.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{a.phone} · {a.ratePerDelivered} MAD/livré</p>
                        {/* Progress */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">{progress}% payé</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${owed > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                          {owed > 0 ? `${owed} MAD dû` : "✓ Payé"}
                        </p>
                        <p className="text-xs text-slate-400">{unpaid} cmd en attente</p>
                      </div>
                      {owed > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); setShowPayModal(a); }}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm shadow-blue-200 transition-colors shrink-0"
                        >
                          Payer
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Agent detail panel */}
            <div className="lg:col-span-2">
              {viewAgent ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 sticky top-8">
                  <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                    <AgentInitial name={viewAgent.name} />
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">{viewAgent.name}</p>
                      <p className="text-xs text-slate-400">{viewAgent.email || viewAgent.phone}</p>
                    </div>
                    <button onClick={() => toggleStatus(viewAgent.id)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 font-medium">
                      {viewAgent.status === "Actif" ? "Désactiver" : "Activer"}
                    </button>
                  </div>
                  <div className="px-6 py-4">
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      {[
                        { label: "Confirmées", value: viewAgent.confirmedOrders, color: "bg-blue-50 text-blue-600" },
                        { label: "Livrées", value: viewAgent.deliveredOrders, color: "bg-emerald-50 text-emerald-600" },
                        { label: "Payées", value: viewAgent.paidOrders, color: "bg-violet-50 text-violet-600" },
                        { label: "Tarif", value: `${viewAgent.ratePerDelivered} MAD`, color: "bg-amber-50 text-amber-600" },
                      ].map(m => (
                        <div key={m.label} className={`rounded-xl p-3 ${m.color}`}>
                          <p className="text-xs opacity-70 mb-0.5">{m.label}</p>
                          <p className="text-lg font-bold">{m.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Unpaid summary */}
                    {viewAgent.deliveredOrders - viewAgent.paidOrders > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                        <p className="text-xs font-semibold text-amber-700 mb-1">Solde à payer</p>
                        <p className="text-xl font-bold text-amber-700">
                          {(viewAgent.deliveredOrders - viewAgent.paidOrders) * viewAgent.ratePerDelivered} MAD
                        </p>
                        <p className="text-xs text-amber-600">{viewAgent.deliveredOrders - viewAgent.paidOrders} commandes × {viewAgent.ratePerDelivered} MAD</p>
                        <button onClick={() => setShowPayModal(viewAgent)}
                          className="mt-2 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors">
                          Effectuer le paiement
                        </button>
                      </div>
                    )}

                    {/* Payment history */}
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Historique paiements</h3>
                    {viewAgent.payments.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">Aucun paiement effectué</p>
                    ) : (
                      <div className="space-y-2">
                        {[...viewAgent.payments].reverse().map(p => (
                          <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{p.note}</p>
                              <p className="text-xs text-slate-400">{p.date} · {p.orders} commandes</p>
                            </div>
                            <span className="text-sm font-bold text-emerald-600">+{p.amount} MAD</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} className="w-6 h-6">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-400">Sélectionnez un agent</p>
                  <p className="text-xs text-slate-300 mt-1">pour voir ses détails et l&apos;historique</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Add agent modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Ajouter un agent</h2>
              <button onClick={() => { setShowAddModal(false); setFormError(""); setForm(emptyForm); }} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {formError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{formError}</p>}
            <div className="flex flex-col gap-3">
              {[
                { key: "name", label: "Nom complet *", placeholder: "Ex: Sara Benali" },
                { key: "phone", label: "Téléphone *", placeholder: "Ex: 06 11 22 33 44" },
                { key: "email", label: "Email", placeholder: "Ex: sara@email.com" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
                  <input type="text" placeholder={placeholder}
                    value={form[key as keyof typeof emptyForm]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Tarif par commande livrée (MAD) *</label>
                <input type="number" min="1" placeholder="Ex: 5"
                  value={form.ratePerDelivered}
                  onChange={e => setForm(f => ({ ...f, ratePerDelivered: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                <p className="text-xs text-slate-400 mt-1">L&apos;agent sera payé ce montant pour chaque commande confirmée et livrée.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowAddModal(false); setFormError(""); setForm(emptyForm); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Annuler</button>
              <button onClick={handleAdd} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-200 transition-colors">Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* Pay modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Payer {showPayModal.name}</h2>
              <button onClick={() => { setShowPayModal(null); setPayError(""); setPayForm({ orders: "", note: "" }); }} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <p className="text-xs text-amber-600 mb-1">Commandes non payées</p>
              <p className="text-2xl font-bold text-amber-700">{showPayModal.deliveredOrders - showPayModal.paidOrders}</p>
              <p className="text-xs text-amber-500">soit {(showPayModal.deliveredOrders - showPayModal.paidOrders) * showPayModal.ratePerDelivered} MAD max · {showPayModal.ratePerDelivered} MAD/livré</p>
            </div>

            {payError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{payError}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Nombre de commandes à payer</label>
                <input type="number" placeholder={`Max: ${showPayModal.deliveredOrders - showPayModal.paidOrders}`}
                  value={payForm.orders}
                  onChange={e => setPayForm(f => ({ ...f, orders: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Note (optionnel)</label>
                <input type="text" placeholder="Ex: Paiement Mai 2026"
                  value={payForm.note}
                  onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
              </div>
            </div>

            {/* Live total */}
            {payForm.orders && Number(payForm.orders) > 0 && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-emerald-700 font-medium">Montant à payer</p>
                <p className="text-xl font-bold text-emerald-700">{Number(payForm.orders) * showPayModal.ratePerDelivered} MAD</p>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowPayModal(null); setPayError(""); setPayForm({ orders: "", note: "" }); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Annuler</button>
              <button onClick={handlePay} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">Confirmer paiement</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
