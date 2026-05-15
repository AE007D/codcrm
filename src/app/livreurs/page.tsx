"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";

type Livreur = {
  id: number;
  name: string;
  phone: string;
  zone: string;
  deliveries: number;
  success: string;
  status: string;
};

const statusStyle: Record<string, string> = {
  "Disponible": "bg-emerald-50 text-emerald-600",
  "En livraison": "bg-blue-50 text-blue-600",
  "Congé": "bg-slate-100 text-slate-500",
};

export default function LivreursPage() {
  const [livreurs, setLivreurs] = useState<Livreur[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", zone: "" });
  const [error, setError] = useState("");

  function handleAdd() {
    if (!form.name || !form.phone || !form.zone) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setLivreurs(prev => [
      ...prev,
      { id: Date.now(), name: form.name, phone: form.phone, zone: form.zone, deliveries: 0, success: "—", status: "Disponible" },
    ]);
    setForm({ name: "", phone: "", zone: "" });
    setError("");
    setShowModal(false);
  }

  function handleDelete(id: number) {
    setLivreurs(prev => prev.filter(l => l.id !== id));
  }

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Livreurs</h1>
            <p className="text-sm text-slate-400">{livreurs.length} livreurs enregistrés</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-blue-200"
          >
            + Ajouter livreur
          </button>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          {livreurs.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 flex flex-col items-center gap-4">
              <span className="text-5xl">🛵</span>
              <p className="text-slate-700 font-semibold text-lg">Aucun livreur enregistré</p>
              <p className="text-slate-400 text-sm text-center">Ajoutez vos livreurs manuellement.</p>
              <button
                onClick={() => setShowModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-blue-200"
              >
                + Ajouter livreur
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-50">
                    {["Nom", "Téléphone", "Zone", "Livraisons", "Taux succès", "Statut", "Actions"].map(h => (
                      <th key={h} className="text-left px-6 py-3 font-semibold uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {livreurs.map(l => (
                    <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors cursor-pointer">
                      <td className="px-6 py-3.5 font-semibold text-slate-800">{l.name}</td>
                      <td className="px-6 py-3.5 text-slate-500">{l.phone}</td>
                      <td className="px-6 py-3.5 text-slate-500">{l.zone}</td>
                      <td className="px-6 py-3.5 font-bold text-slate-800">{l.deliveries}</td>
                      <td className="px-6 py-3.5">
                        <span className="bg-emerald-50 text-emerald-600 text-xs font-semibold px-2.5 py-1 rounded-lg">{l.success}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusStyle[l.status] ?? "bg-slate-100 text-slate-500"}`}>{l.status}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <button onClick={() => handleDelete(l.id)} className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">Supprimer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Ajouter un livreur</h2>
              <button onClick={() => { setShowModal(false); setError(""); }} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}
            <div className="flex flex-col gap-3">
              {[
                { key: "name", label: "Nom complet", placeholder: "Ex: Amine Kabbaj" },
                { key: "phone", label: "Téléphone", placeholder: "Ex: 06 10 20 30 40" },
                { key: "zone", label: "Zone", placeholder: "Ex: Casablanca" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
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
