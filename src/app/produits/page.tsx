"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

type ProductRow = {
  name: string;
  unitsSold: number;
  totalRevenue: number;
  orderCount: number;
};

export default function ProduitsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("/api/lf-orders");
        const data = await res.json();
        const orders: Record<string, unknown>[] = data.orders ?? [];

        // Group by product field
        const map = new Map<string, ProductRow>();
        for (const o of orders) {
          const name = String(o.product ?? "").trim();
          if (!name) continue;
          const qty = parseInt(String(o.quantity ?? "1"), 10) || 1;
          const price = parseFloat(String(o.total_price ?? "0")) || 0;

          if (!map.has(name)) {
            map.set(name, { name, unitsSold: 0, totalRevenue: 0, orderCount: 0 });
          }
          const row = map.get(name)!;
          row.unitsSold += qty;
          row.totalRevenue += price;
          row.orderCount += 1;
        }

        const result = Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
        setProducts(result);
      } catch {
        // silent — show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  const displayed = products.filter(p => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q);
  });

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Produits</h1>
            <p className="text-sm text-slate-400">{loading ? "Chargement…" : `${products.length} produits au catalogue`}</p>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 flex flex-col items-center gap-4">
              <span className="text-5xl">📦</span>
              <p className="text-slate-700 font-semibold text-lg">Aucun produit pour le moment</p>
              <p className="text-slate-400 text-sm text-center">Les produits apparaissent automatiquement à partir de vos commandes importées.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100">
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-80 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                />
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-50">
                    {["Produit", "Commandes", "Unités vendues", "Revenue total"].map(h => (
                      <th key={h} className="text-left px-6 py-3 font-semibold uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((p, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors cursor-pointer">
                      <td className="px-6 py-3.5 font-semibold text-slate-800">{p.name}</td>
                      <td className="px-6 py-3.5 text-slate-600">{p.orderCount}</td>
                      <td className="px-6 py-3.5 text-slate-600">{p.unitsSold}</td>
                      <td className="px-6 py-3.5 font-bold text-slate-800">{p.totalRevenue.toLocaleString("fr-MA")} MAD</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
