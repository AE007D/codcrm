"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useLang } from "@/lib/i18n";

type MonthlyRow = {
  month: string;
  orders: number;
  revenue: number;
  delivered: number;
  returned: number;
};

const MONTH_NAMES = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default function RapportsPage() {
  const { t } = useLang();
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [deliveryRate, setDeliveryRate] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/lf-orders");
        const data = await res.json();
        const orders: Record<string, unknown>[] = data.orders ?? [];

        let revSum = 0;
        let deliveredCount = 0;
        const monthMap = new Map<string, MonthlyRow>();

        for (const o of orders) {
          const status = String(o.status ?? "").toLowerCase();
          const price = parseFloat(String(o.total_price ?? "0")) || 0;
          const dateStr = String(o.received_at ?? "");
          const d = dateStr ? new Date(dateStr) : new Date();
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const monthLabel = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;

          if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, { month: monthLabel, orders: 0, revenue: 0, delivered: 0, returned: 0 });
          }
          const row = monthMap.get(monthKey)!;
          row.orders += 1;

          if (["confirmé", "livré", "expédié"].includes(status)) {
            row.revenue += price;
            revSum += price;
          }
          if (status === "livré") {
            row.delivered += 1;
            deliveredCount += 1;
          }
          if (status === "retourné") {
            row.returned += 1;
          }
        }

        const confirmedTotal = orders.filter(o => {
          const s = String(o.status ?? "").toLowerCase();
          return ["confirmé", "livré", "expédié", "retourné"].includes(s);
        }).length;
        const rate = confirmedTotal > 0 ? Math.round((deliveredCount / confirmedTotal) * 100) : 0;

        const sorted = Array.from(monthMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, v]) => v);

        setMonthly(sorted);
        setTotalRevenue(revSum);
        setTotalOrders(orders.length);
        setDeliveryRate(rate);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="sidebar-header-pl bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t("reports_title")}</h1>
            <p className="text-sm text-slate-400">{t("real_performance")}</p>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : totalOrders === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 flex flex-col items-center gap-4">
              <span className="text-5xl">📊</span>
              <p className="text-slate-700 font-semibold text-lg">Aucune donnée pour le moment</p>
              <p className="text-slate-400 text-sm text-center">Importez des commandes via vos intégrations pour voir vos rapports.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-5 mb-6">
                {[
                  { label: "Chiffre d'affaires", value: `${totalRevenue.toLocaleString("fr-MA")} MAD` },
                  { label: "Total commandes", value: totalOrders.toLocaleString("fr-MA") },
                  { label: "Taux de livraison", value: `${deliveryRate}%` },
                ].map(k => (
                  <div key={k.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <p className="text-sm text-slate-500 font-medium mb-3">{k.label}</p>
                    <p className="text-2xl font-bold text-slate-900 mb-1">{k.value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="text-base font-bold text-slate-900">{t("monthly_report")}</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-50">
                      {[t("col_month"), "Commandes", t("col_revenue_short"), t("kpi_delivered"), t("col_returned"), t("col_delivery_rate")].map(h => (
                        <th key={h} className="text-left px-6 py-3 font-semibold uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map(r => {
                      const rate = r.orders > 0 ? Math.round((r.delivered / r.orders) * 100) : 0;
                      return (
                        <tr key={r.month} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-3.5 font-semibold text-slate-800">{r.month}</td>
                          <td className="px-6 py-3.5 text-slate-600">{r.orders}</td>
                          <td className="px-6 py-3.5 font-bold text-slate-800">{r.revenue.toLocaleString("fr-MA")} MAD</td>
                          <td className="px-6 py-3.5">
                            <span className="bg-emerald-50 text-emerald-600 text-xs font-semibold px-2.5 py-1 rounded-lg">{r.delivered}</span>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="bg-red-50 text-red-500 text-xs font-semibold px-2.5 py-1 rounded-lg">{r.returned}</span>
                          </td>
                          <td className="px-6 py-3.5 font-semibold text-slate-700">{rate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
