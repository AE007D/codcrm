"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useLang } from "@/lib/i18n";

type ClientRow = {
  name: string;
  phone: string;
  city: string;
  orders: number;
  totalSpent: number;
  lastDate: string;
  products: string[]; // distinct products ordered
};

export default function ClientsPage() {
  const { t } = useLang();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch("/api/orders", { cache: "no-store" });
        if (res.status === 401) { window.location.href = "/login"; return; }
        const data = await res.json();
        const orders: Record<string, unknown>[] = data.orders ?? [];

        // Group by phone (primary key for a client)
        const map = new Map<string, ClientRow>();
        for (const o of orders) {
          const name = String(o.customerName ?? o.customer_name ?? "");
          const phone = String(o.customerPhone ?? o.customer_phone ?? "").replace(/\s+/g, "");
          const city = String(o.city ?? "");
          const product = String(o.product ?? "").trim();
          const price = parseFloat(String(o.totalPrice ?? o.total_price ?? "0")) || 0;
          const dateStr = String(o.receivedAt ?? o.received_at ?? "");
          const key = phone || name;
          if (!key) continue;

          if (!map.has(key)) {
            map.set(key, { name, phone, city, orders: 0, totalSpent: 0, lastDate: dateStr, products: [] });
          }
          const row = map.get(key)!;
          row.orders += 1;
          row.totalSpent += price;
          if (dateStr && dateStr > row.lastDate) {
            row.lastDate = dateStr;
            row.city = city || row.city;
            row.name = name || row.name;
          }
          if (product && !row.products.includes(product)) {
            row.products.push(product);
          }
        }

        const result = Array.from(map.values()).sort((a, b) => b.orders - a.orders);
        setClients(result);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, []);

  function formatDate(iso: string) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" }); }
    catch { return iso; }
  }

  const displayed = clients.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.city.toLowerCase().includes(q) || c.products.some(p => p.toLowerCase().includes(q));
  });

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="sidebar-header-pl bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t("clients_title")}</h1>
            <p className="text-sm text-slate-400">{loading ? "Chargement…" : `${clients.length} ${t("clients_registered")}`}</p>
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
              <p className="text-slate-400 text-sm text-center">Les clients apparaissent automatiquement à partir de vos commandes.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
                <input
                  type="text"
                  placeholder={t("search_client")}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full sm:w-80 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-50">
                      <th className="text-left px-4 sm:px-6 py-3 font-semibold uppercase tracking-wide">{t("col_name")}</th>
                      <th className="text-left px-4 sm:px-6 py-3 font-semibold uppercase tracking-wide hidden sm:table-cell">{t("col_city")}</th>
                      <th className="text-left px-4 sm:px-6 py-3 font-semibold uppercase tracking-wide">{t("col_phone")}</th>
                      <th className="text-left px-4 sm:px-6 py-3 font-semibold uppercase tracking-wide">Produits</th>
                      <th className="text-left px-4 sm:px-6 py-3 font-semibold uppercase tracking-wide">{t("col_orders_short")}</th>
                      <th className="text-left px-4 sm:px-6 py-3 font-semibold uppercase tracking-wide">{t("col_total")}</th>
                      <th className="text-left px-4 sm:px-6 py-3 font-semibold uppercase tracking-wide hidden md:table-cell">{t("col_last_order")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((c, i) => (
                      <tr key={`${c.phone}_${i}`} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 sm:px-6 py-3.5 font-semibold text-slate-800">{c.name || "—"}</td>
                        <td className="px-4 sm:px-6 py-3.5 text-slate-500 hidden sm:table-cell">{c.city || "—"}</td>
                        <td className="px-4 sm:px-6 py-3.5 text-slate-500">
                          <a href={`tel:${c.phone}`} className="hover:text-blue-600 transition-colors">{c.phone || "—"}</a>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 max-w-[200px]">
                          <div className="flex flex-wrap gap-1">
                            {c.products.slice(0, 3).map(p => (
                              <span key={p} className="inline-block bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-lg truncate max-w-[120px]" title={p}>{p}</span>
                            ))}
                            {c.products.length > 3 && (
                              <span className="text-xs text-slate-400">+{c.products.length - 3}</span>
                            )}
                          </div>
                        </td>
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
