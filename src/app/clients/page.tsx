"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

type ClientRow = {
  name: string;
  phone: string;
  city: string;
  orders: number;
  totalSpent: number;
  lastDate: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch("/api/lf-orders");
        const data = await res.json();
        const orders: Record<string, unknown>[] = data.orders ?? [];

        // Group by customer_name + customer_phone
        const map = new Map<string, ClientRow>();
        for (const o of orders) {
          const name = String(o.customer_name ?? "");
          const phone = String(o.customer_phone ?? "");
          const city = String(o.city ?? "");
          const price = parseFloat(String(o.total_price ?? "0")) || 0;
          const dateStr = String(o.received_at ?? "");
          const key = `${name}__${phone}`;

          if (!map.has(key)) {
            map.set(key, { name, phone, city, orders: 0, totalSpent: 0, lastDate: dateStr });
          }
          const row = map.get(key)!;
          row.orders += 1;
          row.totalSpent += price;
          if (dateStr && dateStr > row.lastDate) {
            row.lastDate = dateStr;
            row.city = city || row.city;
          }
        }

        const result = Array.from(map.values()).sort((a, b) => b.orders - a.orders);
        setClients(result);
      } catch {
        // silent — show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, []);

  function formatDate(iso: string) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
      return iso;
    }
  }

  const displayed = clients.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.city.toLowerCase().includes(q);
  });

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Clients</h1>
            <p className="text-sm text-slate-400">{loading ? "Chargement…" : `${clients.length} clients enregistrés`}</p>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : clients.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 flex flex-col items-center gap-4">
              <span className="text-5xl">👤</span>
              <p className="text-slate-700 font-semibold text-lg">Aucun client pour le moment</p>
              <p className="text-slate-400 text-sm text-center">Les clients apparaissent automatiquement à partir de vos commandes importées.</p>
              <Link href="/integrations" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-blue-200">
                Configurer les intégrations
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
                <input
                  type="text"
                  placeholder="Rechercher un client..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full sm:w-80 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-50">
                      <th className="text-left px-4 sm:px-6 py-3 font-semibold uppercase tracking-wide">Nom</th>
                      <th className="text-left px-4 sm:px-6 py-3 font-semibold uppercase tracking-wide hidden sm:table-cell">Ville</th>
                      <th className="text-left px-4 sm:px-6 py-3 font-semibold uppercase tracking-wide">Téléphone</th>
                      <th className="text-left px-4 sm:px-6 py-3 font-semibold uppercase tracking-wide">Cmds</th>
                      <th className="text-left px-4 sm:px-6 py-3 font-semibold uppercase tracking-wide">Total</th>
                      <th className="text-left px-4 sm:px-6 py-3 font-semibold uppercase tracking-wide hidden md:table-cell">Dernière</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((c, i) => (
                      <tr key={`${c.phone}_${i}`} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors cursor-pointer">
                        <td className="px-4 sm:px-6 py-3.5 font-semibold text-slate-800">{c.name || "—"}</td>
                        <td className="px-4 sm:px-6 py-3.5 text-slate-500 hidden sm:table-cell">{c.city || "—"}</td>
                        <td className="px-4 sm:px-6 py-3.5 text-slate-500">{c.phone || "—"}</td>
                        <td className="px-4 sm:px-6 py-3.5">
                          <span className="bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-1 rounded-lg">{c.orders}</span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 font-bold text-slate-800 whitespace-nowrap">{c.totalSpent.toLocaleString("fr-MA")} MAD</td>
                        <td className="px-4 sm:px-6 py-3.5 text-slate-400 text-xs hidden md:table-cell">{formatDate(c.lastDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
