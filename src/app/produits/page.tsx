import Sidebar from "@/components/Sidebar";

const products = [
  { name: "Montre Sport Pro", sku: "MSP-001", price: "350 MAD", stock: 42, sold: 128, status: "Actif" },
  { name: "Écouteurs BT X2", sku: "EBT-002", price: "199 MAD", stock: 15, sold: 97, status: "Actif" },
  { name: "Sac à dos XL", sku: "SAX-003", price: "420 MAD", stock: 0, sold: 54, status: "Rupture" },
  { name: "Chargeur rapide 65W", sku: "CR65-004", price: "149 MAD", stock: 88, sold: 213, status: "Actif" },
  { name: "Lampe LED bureau", sku: "LLB-005", price: "89 MAD", stock: 31, sold: 76, status: "Actif" },
  { name: "Coque iPhone 15", sku: "CI15-006", price: "59 MAD", stock: 5, sold: 189, status: "Faible" },
];

const statusStyle: Record<string, string> = {
  "Actif": "bg-emerald-50 text-emerald-600",
  "Rupture": "bg-red-50 text-red-500",
  "Faible": "bg-amber-50 text-amber-600",
};

export default function ProduitsPage() {
  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Produits</h1>
            <p className="text-sm text-slate-400">{products.length} produits au catalogue</p>
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-blue-200">
            + Nouveau produit
          </button>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100">
              <input type="text" placeholder="Rechercher un produit..." className="w-80 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-50">
                  {["Produit","SKU","Prix","Stock","Vendus","Statut"].map(h => (
                    <th key={h} className="text-left px-6 py-3 font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.sku} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors cursor-pointer">
                    <td className="px-6 py-3.5 font-semibold text-slate-800">{p.name}</td>
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-400">{p.sku}</td>
                    <td className="px-6 py-3.5 font-bold text-slate-800">{p.price}</td>
                    <td className="px-6 py-3.5 text-slate-600">{p.stock}</td>
                    <td className="px-6 py-3.5 text-slate-600">{p.sold}</td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusStyle[p.status]}`}>{p.status}</span>
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
