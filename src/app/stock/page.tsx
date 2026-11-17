"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Package, Plus, RefreshCw, Wallet, Truck, RotateCcw, ShoppingCart, ReceiptText } from "lucide-react";

type Product = { id: string; name: string; sku?: string; image?: string; stock: number; purchasePrice: number; minStock: number; stockMovements?: { id: string; quantity: number; unitCost: number; totalCost: number; note: string; createdAt: string; stockAfter: number }[] };
type Order = { id: string; product: string; quantity?: number; status: string; total_price?: number; totalPrice?: number; receivedAt?: string; received_at?: string };
type LedgerEntry = { id: string; type: "supplier_payment" | "eagle_settlement" | "expense"; amount: number; date: string; label: string; note?: string };
type Purchase = { id: string; productId: string; productName: string; quantity: number; unitCost: number; totalCost: number; paidAmount: number; supplier: string; date: string; note?: string };

const money = (n: number) => new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
const dateLabel = (s: string) => { try { return new Date(s).toLocaleDateString("fr-MA"); } catch { return s; } };

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"stock" | "achats" | "reglements">("stock");
  const [kind, setKind] = useState<"purchase" | "supplier_payment" | "eagle_settlement" | "expense">("purchase");
  const [form, setForm] = useState({ productId: "", quantity: "", unitCost: "", paidAmount: "", supplier: "", amount: "", label: "", date: new Date().toISOString().slice(0,10), note: "" });
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, o, s] = await Promise.all([fetch("/api/products", { cache: "no-store" }), fetch("/api/lf-orders", { cache: "no-store" }), fetch("/api/settings", { cache: "no-store" })]);
      if (p.status === 401 || o.status === 401 || s.status === 401) { window.location.href = "/login"; return; }
      const [pd, od, sd] = await Promise.all([p.json(), o.json(), s.json()]);
      setProducts(pd.products ?? []);
      setOrders(od.orders ?? []);
      setPurchases(Array.isArray(sd.settings?.inventoryPurchases) ? sd.settings.inventoryPurchases : []);
      setLedger(Array.isArray(sd.settings?.inventoryLedger) ? sd.settings.inventoryLedger : []);
    } catch { setMessage("Impossible de charger les données."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const stock = products.reduce((n,p) => n + (Number(p.stock)||0), 0);
    const stockValue = products.reduce((n,p) => n + (Number(p.stock)||0) * (Number(p.purchasePrice)||0), 0);
    const shipped = orders.filter(o => ["expédié","livré","retourné"].includes((o.status||"").toLowerCase())).reduce((n,o) => n + Math.max(1, Number(o.quantity)||1), 0);
    const inTransit = orders.filter(o => (o.status||"").toLowerCase() === "expédié").reduce((n,o) => n + Math.max(1, Number(o.quantity)||1), 0);
    const returned = orders.filter(o => (o.status||"").toLowerCase() === "retourné").reduce((n,o) => n + Math.max(1, Number(o.quantity)||1), 0);
    const delivered = orders.filter(o => (o.status||"").toLowerCase() === "livré").reduce((n,o) => n + Math.max(1, Number(o.quantity)||1), 0);
    const spent = purchases.reduce((n,p) => n + Number(p.totalCost||0), 0);
    const supplierPaid = purchases.reduce((n,p) => n + Number(p.paidAmount||0), 0) + ledger.filter(x => x.type === "supplier_payment").reduce((n,x) => n + Number(x.amount||0), 0);
    const supplierDue = Math.max(0, spent - supplierPaid);
    const settlements = ledger.filter(x => x.type === "eagle_settlement").reduce((n,x) => n + Number(x.amount||0), 0);
    const expenses = ledger.filter(x => x.type === "expense").reduce((n,x) => n + Number(x.amount||0), 0);
    return { stock, stockValue, shipped, inTransit, returned, delivered, spent, supplierPaid, supplierDue, settlements, expenses };
  }, [products, orders, purchases, ledger]);

  async function persist(nextPurchases: Purchase[], nextLedger: LedgerEntry[]) {
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inventoryPurchases: nextPurchases, inventoryLedger: nextLedger }) });
    if (!res.ok) throw new Error("Enregistrement impossible");
    setPurchases(nextPurchases); setLedger(nextLedger);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMessage("");
    try {
      if (kind === "purchase") {
        const product = products.find(p => p.id === form.productId);
        const qty = Math.floor(Number(form.quantity));
        const unit = Number(form.unitCost);
        const paid = Number(form.paidAmount || 0);
        if (!product || qty <= 0 || unit < 0 || paid < 0 || paid > qty * unit) throw new Error("Vérifiez le produit, la quantité, le coût et le montant payé.");
        const res = await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: product.id, action: "addStock", qty, purchasePrice: unit, note: form.note || "Achat stock Eagle" }) });
        if (!res.ok) throw new Error("Le stock n'a pas pu être ajouté.");
        const next = [{ id: crypto.randomUUID(), productId: product.id, productName: product.name, quantity: qty, unitCost: unit, totalCost: qty*unit, paidAmount: paid, supplier: form.supplier, date: form.date, note: form.note }, ...purchases];
        await persist(next, ledger);
      } else {
        const amount = Number(form.amount);
        if (!(amount > 0)) throw new Error("Saisissez un montant valide.");
        const entry: LedgerEntry = { id: crypto.randomUUID(), type: kind, amount, date: form.date, label: form.label || (kind === "supplier_payment" ? "Paiement fournisseur" : kind === "eagle_settlement" ? "Règlement Eagle" : "Dépense"), note: form.note };
        await persist(purchases, [entry, ...ledger]);
      }
      setForm({ productId: "", quantity: "", unitCost: "", paidAmount: "", supplier: "", amount: "", label: "", date: new Date().toISOString().slice(0,10), note: "" });
      setMessage("Enregistré avec succès.");
      await load();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Erreur d'enregistrement."); }
    finally { setSaving(false); }
  }

  const tabs = [{id:"stock",label:"Stock Eagle"},{id:"achats",label:"Achats & fournisseurs"},{id:"reglements",label:"Règlements & dépenses"}] as const;
  return <div className="min-h-screen bg-slate-50 lg:flex"><Sidebar /><main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Gestion commerciale</p><h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">Stock & achats</h1><p className="text-sm text-slate-500 mt-1">Suivi centralisé de votre stock chez Eagle Express</p></div><button onClick={load} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={16}/> Actualiser</button></div>
    {message && <div className="mb-4 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">{message}</div>}
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
      {[{label:"Stock enregistré chez Eagle",value:stats.stock+" unités",icon:Package},{label:"Valeur estimée du stock",value:money(stats.stockValue),icon:Wallet},{label:"Colis en cours",value:stats.inTransit+" unités",icon:Truck},{label:"Retours enregistrés",value:stats.returned+" unités",icon:RotateCcw}].map((x,i)=><div key={x.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm"><div className="flex items-center justify-between text-slate-400"><span className="text-xs font-semibold">{x.label}</span><x.icon size={18}/></div><p className="text-xl sm:text-2xl font-black text-slate-900 mt-3">{loading?"—":x.value}</p></div>)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
      <div className="bg-white rounded-2xl border border-slate-100 p-4"><p className="text-xs text-slate-500 font-semibold">Total achats enregistrés</p><p className="text-xl font-black mt-1">{money(stats.spent)}</p></div>
      <div className="bg-white rounded-2xl border border-slate-100 p-4"><p className="text-xs text-slate-500 font-semibold">Payé aux fournisseurs</p><p className="text-xl font-black text-emerald-600 mt-1">{money(stats.supplierPaid)}</p></div>
      <div className="bg-white rounded-2xl border border-slate-100 p-4"><p className="text-xs text-slate-500 font-semibold">Reste fournisseur à payer</p><p className="text-xl font-black text-orange-600 mt-1">{money(stats.supplierDue)}</p></div>
      <div className="bg-white rounded-2xl border border-slate-100 p-4"><p className="text-xs text-slate-500 font-semibold">Règlements Eagle reçus</p><p className="text-xl font-black text-emerald-600 mt-1">{money(stats.settlements)}</p></div>
      <div className="bg-white rounded-2xl border border-slate-100 p-4"><p className="text-xs text-slate-500 font-semibold">Dépenses diverses</p><p className="text-xl font-black mt-1">{money(stats.expenses)}</p></div>
      <div className="bg-white rounded-2xl border border-slate-100 p-4"><p className="text-xs text-slate-500 font-semibold">Commandes livrées (unités)</p><p className="text-xl font-black mt-1">{stats.delivered}</p><p className="text-[11px] text-slate-400 mt-1">À rapprocher avec les règlements Eagle</p></div>
    </div>
    <div className="flex gap-2 border-b border-slate-200 mb-5 overflow-x-auto">{tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 ${tab===t.id?"border-blue-600 text-blue-700":"border-transparent text-slate-500"}`}>{t.label}</button>)}</div>
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
      <section className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {tab==="stock" && <><div className="p-4 border-b border-slate-100"><h2 className="font-extrabold text-slate-900">Produits chez Eagle</h2><p className="text-xs text-slate-500 mt-1">Le stock affiché reprend les quantités enregistrées dans Produits.</p></div>{products.length===0?<p className="p-8 text-center text-sm text-slate-400">Aucun produit enregistré.</p>:<div className="divide-y divide-slate-100">{products.map(p=><div key={p.id} className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Package size={18}/></div><div className="flex-1 min-w-0"><p className="font-bold text-sm text-slate-800 truncate">{p.name}</p><p className="text-xs text-slate-400">{p.sku||"Sans SKU"} · coût moyen {money(p.purchasePrice||0)}</p></div><div className="text-right"><p className={`font-black ${p.stock<=p.minStock?"text-orange-600":"text-slate-900"}`}>{p.stock} unités</p><p className="text-[11px] text-slate-400">seuil {p.minStock}</p></div></div>)}</div>}</>}
        {tab==="achats" && <><div className="p-4 border-b border-slate-100"><h2 className="font-extrabold text-slate-900">Historique des achats</h2></div>{purchases.length===0?<p className="p-8 text-center text-sm text-slate-400">Aucun achat saisi pour le moment.</p>:<div className="divide-y divide-slate-100">{purchases.map(p=><div key={p.id} className="p-4"><div className="flex justify-between gap-3"><div><p className="font-bold text-sm">{p.productName} · {p.quantity} unités</p><p className="text-xs text-slate-400 mt-1">{p.supplier||"Fournisseur non précisé"} · {dateLabel(p.date)}</p></div><div className="text-right"><p className="font-black">{money(p.totalCost)}</p><p className="text-xs text-emerald-600">Payé {money(p.paidAmount)}</p></div></div><p className="text-xs text-orange-600 mt-2">Reste à payer : {money(Math.max(0,p.totalCost-p.paidAmount))}</p></div>)}</div>}</>}
        {tab==="reglements" && <><div className="p-4 border-b border-slate-100"><h2 className="font-extrabold text-slate-900">Règlements & dépenses</h2></div>{ledger.length===0?<p className="p-8 text-center text-sm text-slate-400">Aucune opération saisie.</p>:<div className="divide-y divide-slate-100">{ledger.map(x=><div key={x.id} className="p-4 flex justify-between gap-3"><div><p className="font-bold text-sm">{x.label}</p><p className="text-xs text-slate-400 mt-1">{dateLabel(x.date)}{x.note? " · "+x.note:""}</p></div><div className="text-right"><p className="font-black">{money(x.amount)}</p><p className="text-[11px] text-slate-500">{x.type==="eagle_settlement"?"Reçu Eagle":x.type==="supplier_payment"?"Paiement fournisseur":"Dépense"}</p></div></div>)}</div>}</>}
      </section>
      <aside className="bg-white rounded-2xl border border-slate-100 p-5 h-fit"><h2 className="font-extrabold text-slate-900 flex items-center gap-2"><Plus size={18}/> Ajouter une opération</h2><div className="grid grid-cols-2 gap-2 mt-4">{[{id:"purchase",label:"Achat stock"},{id:"supplier_payment",label:"Payer fournisseur"},{id:"eagle_settlement",label:"Règlement Eagle"},{id:"expense",label:"Autre dépense"}].map(x=><button key={x.id} onClick={()=>setKind(x.id as typeof kind)} className={`rounded-xl border px-2 py-2 text-xs font-bold ${kind===x.id?"bg-blue-600 text-white border-blue-600":"border-slate-200 text-slate-600"}`}>{x.label}</button>)}</div>
      <form onSubmit={submit} className="space-y-3 mt-4">
        {kind==="purchase"?<><label className="block text-xs font-semibold text-slate-600">Produit<select required value={form.productId} onChange={e=>setForm(f=>({...f,productId:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm bg-white"><option value="">Choisir un produit</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-slate-600">Quantité<input required type="number" min="1" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"/></label><label className="text-xs font-semibold text-slate-600">Prix achat / unité<input required type="number" min="0" step="0.01" value={form.unitCost} onChange={e=>setForm(f=>({...f,unitCost:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"/></label></div><label className="block text-xs font-semibold text-slate-600">Montant déjà payé<input type="number" min="0" step="0.01" value={form.paidAmount} onChange={e=>setForm(f=>({...f,paidAmount:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" placeholder="0"/></label><label className="block text-xs font-semibold text-slate-600">Fournisseur<input value={form.supplier} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"/></label></>:<><label className="block text-xs font-semibold text-slate-600">Montant (MAD)<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"/></label><label className="block text-xs font-semibold text-slate-600">Libellé<input value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" placeholder={kind==="eagle_settlement"?"Règlement Eagle #...":"Description"}/></label></>}
        <label className="block text-xs font-semibold text-slate-600">Date<input required type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"/></label><label className="block text-xs font-semibold text-slate-600">Note<input value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"/></label>
        {kind==="purchase"&&form.quantity&&form.unitCost&&<div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Total achat : <strong>{money(Number(form.quantity)*Number(form.unitCost))}</strong></div>}
        <button disabled={saving||loading} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 text-sm">{saving?"Enregistrement…":"Enregistrer"}</button>
      </form>
      <p className="text-[11px] text-slate-400 mt-4">Les règlements Eagle sont saisis manuellement. Les données du stock réel du dépôt doivent être rapprochées avec le relevé Eagle.</p></aside>
    </div>
    <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-800"><strong>À savoir :</strong> Eagle synchronise les statuts des colis, mais son API publique ne fournit pas le solde réel des articles en entrepôt ni les règlements financiers. Le stock et les montants reçus sont donc suivis dans le CRM à partir des saisies et des relevés que vous ajoutez.</div>
  </main></div>;
}
