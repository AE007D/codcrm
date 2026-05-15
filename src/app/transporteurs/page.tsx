"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";

type Carrier = {
  id: number;
  name: string;
  contact: string;
  zones: string;
  price: string;
  delay: string;
  orders: number;
  status: string;
};

const initialCarriers: Carrier[] = [];

const statusStyle: Record<string, string> = {
  "Actif": "bg-emerald-50 text-emerald-600",
  "Inactif": "bg-slate-100 text-slate-500",
};

export default function TransporteursPage() {
  const [carriers, setCarriers] = useState(initialCarriers);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", zones: "", price: "", delay: "" });
  const [error, setError] = useState("");

  function handleAdd() {
    if (!form.name || !form.contact || !form.zones || !form.price || !form.delay) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setCarriers((prev) => [
      ...prev,
      { id: prev.length + 1, ...form, orders: 0, status: "Actif" },
    ]);
    setForm({ name: "", contact: "", zones: "", price: "", delay: "" });
    setError("");
    setShowModal(false);
  }

  function handleDelete(id: number) {
    setCarriers((prev) => prev.filter((c) => c.id !== id));
  }

  function handleToggle(id: number) {
    setCarriers((prev) =>
      prev.map((c) => c.id === id ? { ...c, status: c.status === "Actif" ? "Inactif" : "Actif" } : c)
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Sociétés de livraison</h1>
            <p className="text-sm text-slate-400">{carriers.length} transporteurs enregistrés</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-blue-200"
          >
            + Ajouter transporteur
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-5 mb-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <p className="text-sm text-slate-500 font-medium mb-2">Total transporteurs</p>
              <p className="text-2xl font-bold text-slate-900">{carriers.length}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <p className="text-sm text-slate-500 font-medium mb-2">Transporteurs actifs</p>
              <p className="text-2xl font-bold text-slate-900">{carriers.filter(c => c.status === "Actif").length}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <p className="text-sm text-slate-500 font-medium mb-2">Colis traités</p>
              <p className="text-2xl font-bold text-slate-900">{carriers.reduce((a, c) => a + c.orders, 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Empty state */}
          {carriers.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 flex flex-col items-center gap-4 mb-6">
              <span className="text-5xl">🚚</span>
              <p className="text-slate-700 font-semibold text-lg">Aucun transporteur enregistré</p>
              <p className="text-slate-400 text-sm text-center">Ajoutez vos sociétés de livraison manuellement.</p>
            </div>
          )}

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-5 mb-6">
            {carriers.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth={2} className="w-5 h-5">
                      <rect x="1" y="3" width="15" height="13" rx="1"/>
                      <path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusStyle[c.status]}`}>{c.status}</span>
                </div>
                <h3 className="font-bold text-slate-900 mb-1">{c.name}</h3>
                <p className="text-xs text-slate-400 mb-3">{c.contact}</p>
                <div className="flex flex-col gap-1.5 text-xs text-slate-500 mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Zones</span>
                    <span className="font-medium text-slate-700">{c.zones}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tarif</span>
                    <span className="font-bold text-blue-600">{c.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Délai</span>
                    <span className="font-medium text-slate-700">{c.delay}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Colis traités</span>
                    <span className="font-semibold text-slate-700">{c.orders.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleToggle(c.id)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    {c.status === "Actif" ? "Désactiver" : "Activer"}
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="flex-1 py-2 rounded-xl border border-red-100 text-xs font-semibold text-red-400 hover:bg-red-50 transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Ajouter un transporteur</h2>
              <button onClick={() => { setShowModal(false); setError(""); }} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}
            <div className="flex flex-col gap-3">
              {[
                { key: "name", label: "Nom de la société", placeholder: "Ex: Amana Express" },
                { key: "contact", label: "Téléphone / Contact", placeholder: "Ex: 05 22 00 11 22" },
                { key: "zones", label: "Zones de couverture", placeholder: "Ex: Tout le Maroc" },
                { key: "price", label: "Tarif par colis", placeholder: "Ex: 25 MAD" },
                { key: "delay", label: "Délai de livraison", placeholder: "Ex: 24-48h" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowModal(false); setError(""); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
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
