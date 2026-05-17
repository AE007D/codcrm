"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

type PayRequest = {
  id: string;
  agent_id: string;
  agent_name: string;
  amount: number;
  message: string;
  status: "pending" | "paid" | "rejected";
  created_at: string;
};


const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "En attente", color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  paid:     { label: "Payé ✓",    color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  rejected: { label: "Refusé",    color: "text-red-600",     bg: "bg-red-50 border-red-200" },
};

export default function PaiementsPage() {
  const [role, setRole] = useState<"admin" | "agent" | "viewer" | null>(null);
  const [requests, setRequests] = useState<PayRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/api/auth/me");
      if (meRes.status === 401) { window.location.href = "/login"; return; }
      const me = await meRes.json();
      setRole(me.role);

      const reqRes = await fetch("/api/payment-requests");
      if (reqRes.ok) {
        const d = await reqRes.json();
        setRequests(d.requests ?? []);
      }

      setLoading(false);
    }
    init();
  }, []);

  async function submitRequest() {
    const parsed = parseFloat(amount);
    if (!amount || parsed <= 0) return;
    if (parsed > availableBalance) {
      alert(`Montant trop élevé. Solde disponible : ${availableBalance} MAD`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, message }),
      });
      if (res.ok) {
        const d = await res.json();
        setRequests(prev => [d.request, ...prev]);
        setAmount("");
        setMessage("");
        setShowForm(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: string, status: "paid" | "rejected") {
    const res = await fetch("/api/payment-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    }
  }

  const pendingTotal = requests.filter(r => r.status === "pending").reduce((s, r) => s + r.amount, 0);
  const paidTotal = requests.filter(r => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  // Commissions auto-created on delivery — pending = owed but not yet paid out
  const totalEarned = pendingTotal + paidTotal;
  const availableBalance = pendingTotal;

  if (loading) return (
    <div className="flex h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F0F4FF] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">
              {role === "admin" ? "Paiements équipe" : "Mes paiements"}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {role === "admin"
                ? "Gérez les demandes de virement de votre équipe"
                : "Suivez vos gains et demandez un virement"}
            </p>
          </div>

          {success && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm font-medium">
              ✅ Demande envoyée ! L&apos;admin a été notifié.
            </div>
          )}

          {/* Agent view — stats + request form */}
          {role === "agent" && (
            <>
              {/* Stats cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Total gagné</p>
                  <p className="text-2xl font-bold text-slate-700">{totalEarned} MAD</p>
                  <p className="text-xs text-slate-400 mt-0.5">{requests.length} commission(s)</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Déjà payé</p>
                  <p className="text-2xl font-bold text-emerald-600">{paidTotal} MAD</p>
                  <p className="text-xs text-slate-400 mt-0.5">{requests.filter(r => r.status === "paid").length} virement(s)</p>
                </div>
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 shadow-md shadow-blue-200">
                  <p className="text-xs font-semibold text-blue-200 uppercase tracking-wide mb-1">Disponible</p>
                  <p className="text-2xl font-bold text-white">{availableBalance} MAD</p>
                  <p className="text-xs text-blue-200 mt-0.5">{requests.filter(r => r.status === "pending").length} en attente</p>
                </div>
              </div>

              {/* Pending & paid summary */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">En attente</p>
                  <p className="text-xl font-bold text-amber-700">{pendingTotal} MAD</p>
                  <p className="text-xs text-amber-600 mt-0.5">{requests.filter(r => r.status === "pending").length} demande(s)</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Total reçu</p>
                  <p className="text-xl font-bold text-emerald-700">{paidTotal} MAD</p>
                  <p className="text-xs text-emerald-600 mt-0.5">{requests.filter(r => r.status === "paid").length} virement(s)</p>
                </div>
              </div>

              {/* Urgent payment request button */}
              {!showForm ? (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full mb-6 flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-base rounded-2xl shadow-lg shadow-orange-200 transition-all active:scale-95"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                  </svg>
                  Demander un virement urgent
                </button>
              ) : (
                <div className="bg-white rounded-2xl border border-orange-200 shadow-sm p-5 mb-6">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"/>
                    Demande de virement urgent
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-600">Montant demandé (MAD) *</label>
                        <span className="text-xs text-emerald-600 font-semibold">Dispo : {availableBalance} MAD</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Ex: 500"
                          min={1}
                          max={availableBalance}
                          value={amount}
                          onChange={e => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > availableBalance) setAmount(String(availableBalance));
                            else setAmount(e.target.value);
                          }}
                          className={`flex-1 text-sm border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-50 ${parseFloat(amount) > availableBalance ? "border-red-400 focus:border-red-400" : "border-slate-200 focus:border-orange-400"}`}
                        />
                        <button
                          type="button"
                          onClick={() => setAmount(String(availableBalance))}
                          disabled={availableBalance <= 0}
                          className="px-3 py-2 text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          Max
                        </button>
                      </div>
                      {parseFloat(amount) > availableBalance && (
                        <p className="text-xs text-red-500 mt-1">⚠ Dépasse le solde disponible ({availableBalance} MAD)</p>
                      )}
                      {availableBalance <= 0 && (
                        <p className="text-xs text-amber-600 mt-1">Aucun solde disponible pour le moment.</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Message (optionnel)</label>
                      <textarea
                        placeholder="Ex: besoin urgent pour transport…"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={2}
                        className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-orange-400 resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
                    <button
                      onClick={submitRequest}
                      disabled={submitting || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > availableBalance || availableBalance <= 0}
                      className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold disabled:opacity-50 shadow-md shadow-orange-200"
                    >
                      {submitting ? "Envoi…" : "🚨 Envoyer"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Admin view — summary cards */}
          {role === "admin" && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">En attente</p>
                <p className="text-2xl font-bold text-amber-600">{requests.filter(r => r.status === "pending").length}</p>
                <p className="text-xs text-slate-400 mt-0.5">{pendingTotal} MAD total</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Payé</p>
                <p className="text-2xl font-bold text-emerald-600">{requests.filter(r => r.status === "paid").length}</p>
                <p className="text-xs text-slate-400 mt-0.5">{paidTotal} MAD versé</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Total demandes</p>
                <p className="text-2xl font-bold text-slate-700">{requests.length}</p>
                <p className="text-xs text-slate-400 mt-0.5">tous agents</p>
              </div>
            </div>
          )}

          {/* Requests list */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">
                {role === "admin" ? "Demandes de virement" : "Mes demandes"}
              </h2>
              {requests.filter(r => r.status === "pending").length > 0 && role === "admin" && (
                <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
                  {requests.filter(r => r.status === "pending").length} urgente(s)
                </span>
              )}
            </div>

            {requests.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mx-auto mb-3 opacity-30">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
                <p className="text-sm">Aucune demande</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {requests.map(r => {
                  const st = STATUS_LABELS[r.status] ?? STATUS_LABELS.pending;
                  return (
                    <div key={r.id} className={`px-5 py-4 flex items-start gap-4 ${r.status === "pending" && role === "admin" ? "bg-orange-50/30" : ""}`}>
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {r.agent_name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-800 text-sm">{r.agent_name}</span>
                          {r.status === "pending" && (
                            <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full animate-pulse">URGENT</span>
                          )}
                        </div>
                        {r.message && <p className="text-xs text-slate-500 mt-0.5 truncate">{r.message}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(r.created_at).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-base font-bold text-slate-900">{r.amount} MAD</span>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${st.bg} ${st.color}`}>{st.label}</span>
                        {/* Admin actions */}
                        {role === "admin" && r.status === "pending" && (
                          <div className="flex gap-1.5 mt-1">
                            <button
                              onClick={() => updateStatus(r.id, "paid")}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm"
                            >
                              ✓ Payé
                            </button>
                            <button
                              onClick={() => updateStatus(r.id, "rejected")}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 text-xs font-semibold rounded-lg"
                            >
                              Refuser
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
