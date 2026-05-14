"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";

const initialStores = [
  { id: 1, name: "Boutique Casa Centre", city: "Casablanca", address: "23 Bd Mohammed V", phone: "05 22 11 22 33", manager: "Youssef Alami", orders: 412, status: "Active" },
  { id: 2, name: "Shop Rabat Agdal", city: "Rabat", address: "7 Rue Patrice Lumumba", phone: "05 37 44 55 66", manager: "Fatima Zahra", orders: 289, status: "Active" },
  { id: 3, name: "Marrakech Store", city: "Marrakech", address: "Guéliz, Av. Mohammed VI", phone: "05 24 33 44 55", manager: "Hamid Benali", orders: 198, status: "Active" },
  { id: 4, name: "Fès Médina Shop", city: "Fès", address: "Quartier Narjiss, Fès", phone: "05 35 66 77 88", manager: "Samira Oukili", orders: 134, status: "Inactive" },
  { id: 5, name: "Tanger Bay Store", city: "Tanger", address: "12 Av. des FAR, Tanger", phone: "05 39 77 88 99", manager: "Khalid Tazi", orders: 167, status: "Active" },
];

const statusStyle: Record<string, string> = {
  "Active": "bg-emerald-50 text-emerald-600",
  "Inactive": "bg-slate-100 text-slate-500",
};

type Store = typeof initialStores[0];

export default function BoutiquesPage() {
  const [stores, setStores] = useState(initialStores);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", address: "", phone: "", manager: "" });
  const [error, setError] = useState("");

  function handleAdd() {
    if (!form.name || !form.city || !form.address || !form.phone || !form.manager) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setStores((prev) => [
      ...prev,
      { id: prev.length + 1, ...form, orders: 0, status: "Active" },
    ]);
    setForm({ name: "", city: "", address: "", phone: "", manager: "" });
    setError("");
    setShowModal(false);
  }

  function handleDelete(id: number) {
    setStores((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Boutiques</h1>
            <p className="text-sm text-slate-400">{stores.length} boutiques enregistrées</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-blue-200"
          >
            + Ajouter boutique
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-5 mb-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <p className="text-sm text-slate-500 font-medium mb-2">Total boutiques</p>
              <p className="text-2xl font-bold text-slate-900">{stores.length}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <p className="text-sm text-slate-500 font-medium mb-2">Boutiques actives</p>
              <p className="text-2xl font-bold text-slate-900">{stores.filter(s => s.status === "Active").length}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <p className="text-sm text-slate-500 font-medium mb-2">Commandes totales</p>
              <p className="text-2xl font-bold text-slate-900">{stores.reduce((a, s) => a + s.orders, 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100">
              <input type="text" placeholder="Rechercher une boutique..." className="w-80 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-50">
                  {["Boutique","Ville","Adresse","Téléphone","Responsable","Commandes","Statut","Actions"].map(h => (
                    <th key={h} className="text-left px-6 py-3 font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-slate-800">{s.name}</td>
                    <td className="px-6 py-3.5 text-slate-500">{s.city}</td>
                    <td className="px-6 py-3.5 text-slate-500 text-xs">{s.address}</td>
                    <td className="px-6 py-3.5 text-slate-500">{s.phone}</td>
                    <td className="px-6 py-3.5 text-slate-600">{s.manager}</td>
                    <td className="px-6 py-3.5">
                      <span className="bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-1 rounded-lg">{s.orders}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusStyle[s.status]}`}>{s.status}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <button onClick={() => handleDelete(s.id)} className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Ajouter une boutique</h2>
              <button onClick={() => { setShowModal(false); setError(""); }} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}
            <div className="flex flex-col gap-3">
              {[
                { key: "name", label: "Nom de la boutique", placeholder: "Ex: Boutique Casa Nord" },
                { key: "city", label: "Ville", placeholder: "Ex: Casablanca" },
                { key: "address", label: "Adresse", placeholder: "Ex: 12 Rue Hassan II" },
                { key: "phone", label: "Téléphone", placeholder: "Ex: 05 22 00 11 22" },
                { key: "manager", label: "Responsable", placeholder: "Ex: Ahmed Bennani" },
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
