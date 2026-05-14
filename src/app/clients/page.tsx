import Sidebar from "@/components/Sidebar";

const clients = [
  { name: "Youssef Alami", city: "Casablanca", phone: "06 12 34 56 78", orders: 5, total: "1,750 MAD", last: "14/05/2026" },
  { name: "Fatima Zahra", city: "Rabat", phone: "06 98 76 54 32", orders: 3, total: "597 MAD", last: "14/05/2026" },
  { name: "Hamid Benali", city: "Marrakech", phone: "07 11 22 33 44", orders: 2, total: "840 MAD", last: "13/05/2026" },
  { name: "Samira Oukili", city: "Fès", phone: "06 55 66 77 88", orders: 1, total: "149 MAD", last: "13/05/2026" },
  { name: "Khalid Tazi", city: "Agadir", phone: "07 99 88 77 66", orders: 4, total: "1,400 MAD", last: "12/05/2026" },
  { name: "Nadia Chraibi", city: "Tanger", phone: "06 33 44 55 66", orders: 2, total: "178 MAD", last: "12/05/2026" },
  { name: "Omar Benhaddou", city: "Oujda", phone: "07 77 88 99 00", orders: 6, total: "2,194 MAD", last: "11/05/2026" },
];

export default function ClientsPage() {
  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Clients</h1>
            <p className="text-sm text-slate-400">{clients.length} clients enregistrés</p>
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-blue-200">
            + Nouveau client
          </button>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100">
              <input type="text" placeholder="Rechercher un client..." className="w-80 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-50">
                  {["Nom","Ville","Téléphone","Commandes","Total dépensé","Dernière commande"].map(h => (
                    <th key={h} className="text-left px-6 py-3 font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.phone} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors cursor-pointer">
                    <td className="px-6 py-3.5 font-semibold text-slate-800">{c.name}</td>
                    <td className="px-6 py-3.5 text-slate-500">{c.city}</td>
                    <td className="px-6 py-3.5 text-slate-500">{c.phone}</td>
                    <td className="px-6 py-3.5">
                      <span className="bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-1 rounded-lg">{c.orders}</span>
                    </td>
                    <td className="px-6 py-3.5 font-bold text-slate-800">{c.total}</td>
                    <td className="px-6 py-3.5 text-slate-400 text-xs">{c.last}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
