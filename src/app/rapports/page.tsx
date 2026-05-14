import Sidebar from "@/components/Sidebar";

const monthly = [
  { month: "Janvier", orders: 892, revenue: "178,400 MAD", delivered: 821, returned: 71 },
  { month: "Février", orders: 1024, revenue: "204,800 MAD", delivered: 948, returned: 76 },
  { month: "Mars", orders: 1156, revenue: "231,200 MAD", delivered: 1082, returned: 74 },
  { month: "Avril", orders: 1098, revenue: "219,600 MAD", delivered: 1015, returned: 83 },
  { month: "Mai", orders: 1284, revenue: "248,500 MAD", delivered: 987, returned: 297 },
];

const kpis = [
  { label: "Chiffre d'affaires (2026)", value: "1,082,500 MAD", change: "+21%", up: true },
  { label: "Total commandes (2026)", value: "5,454", change: "+18%", up: true },
  { label: "Taux de livraison moyen", value: "93.1%", change: "+2.3%", up: true },
];

export default function RapportsPage() {
  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Rapports</h1>
            <p className="text-sm text-slate-400">Performances 2026</p>
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-blue-200">
            Exporter CSV
          </button>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-5 mb-6">
            {kpis.map((k) => (
              <div key={k.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <p className="text-sm text-slate-500 font-medium mb-3">{k.label}</p>
                <p className="text-2xl font-bold text-slate-900 mb-1">{k.value}</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                  ▲ {k.change} <span className="font-normal text-slate-400">vs 2025</span>
                </span>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Rapport mensuel</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-50">
                  {["Mois","Commandes","Revenue","Livrées","Retournées","Taux livraison"].map(h => (
                    <th key={h} className="text-left px-6 py-3 font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthly.map((r) => {
                  const rate = Math.round((r.delivered / r.orders) * 100);
                  return (
                    <tr key={r.month} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3.5 font-semibold text-slate-800">{r.month}</td>
                      <td className="px-6 py-3.5 text-slate-600">{r.orders}</td>
                      <td className="px-6 py-3.5 font-bold text-slate-800">{r.revenue}</td>
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
        </main>
      </div>
    </div>
  );
}
