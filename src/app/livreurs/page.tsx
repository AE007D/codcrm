import Sidebar from "@/components/Sidebar";

const livreurs = [
  { name: "Amine Kabbaj", phone: "06 10 20 30 40", zone: "Casablanca", deliveries: 312, success: "94%", status: "Disponible" },
  { name: "Rachid Moussaoui", phone: "07 50 60 70 80", zone: "Rabat", deliveries: 198, success: "91%", status: "En livraison" },
  { name: "Saad Idrissi", phone: "06 23 45 67 89", zone: "Marrakech", deliveries: 145, success: "88%", status: "Disponible" },
  { name: "Mehdi Bouazza", phone: "07 34 56 78 90", zone: "Fès", deliveries: 89, success: "96%", status: "Congé" },
  { name: "Tariq Alaoui", phone: "06 45 67 89 01", zone: "Tanger", deliveries: 223, success: "93%", status: "En livraison" },
];

const statusStyle: Record<string, string> = {
  "Disponible": "bg-emerald-50 text-emerald-600",
  "En livraison": "bg-blue-50 text-blue-600",
  "Congé": "bg-slate-100 text-slate-500",
};

export default function LivreursPage() {
  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Livreurs</h1>
            <p className="text-sm text-slate-400">{livreurs.length} livreurs enregistrés</p>
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-blue-200">
            + Ajouter livreur
          </button>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-50">
                  {["Nom","Téléphone","Zone","Livraisons","Taux succès","Statut"].map(h => (
                    <th key={h} className="text-left px-6 py-3 font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {livreurs.map((l) => (
                  <tr key={l.phone} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors cursor-pointer">
                    <td className="px-6 py-3.5 font-semibold text-slate-800">{l.name}</td>
                    <td className="px-6 py-3.5 text-slate-500">{l.phone}</td>
                    <td className="px-6 py-3.5 text-slate-500">{l.zone}</td>
                    <td className="px-6 py-3.5 font-bold text-slate-800">{l.deliveries}</td>
                    <td className="px-6 py-3.5">
                      <span className="bg-emerald-50 text-emerald-600 text-xs font-semibold px-2.5 py-1 rounded-lg">{l.success}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusStyle[l.status]}`}>{l.status}</span>
                    </td>
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
