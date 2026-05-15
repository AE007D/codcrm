"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";

type Product = {
  id: string;
  name: string;
  sku: string;
  image: string;
  sellPrice: number;
  purchasePrice: number;
  stock: number;
  minStock: number;
  createdAt: string;
};

type OrderProduct = { name: string; unitsSold: number; orderCount: number; revenue: number };

const emptyForm = {
  name: "", sku: "", image: "", sellPrice: "", purchasePrice: "", stock: "", minStock: "5",
};

function ProductImage({ image, name, size = 48 }: { image: string; name: string; size?: number }) {
  const colors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  if (image) return (
    <div className="rounded-xl overflow-hidden bg-slate-100 shrink-0" style={{ width: size, height: size }}>
      <Image src={image} alt={name} width={size} height={size} className="object-cover w-full h-full" unoptimized />
    </div>
  );
  return (
    <div className={`${color} rounded-xl flex items-center justify-center text-white font-bold shrink-0`} style={{ width: size, height: size, fontSize: size * 0.3 }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  if (stock === 0) return <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-red-100 text-red-600">Rupture</span>;
  if (stock <= minStock) return <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-amber-100 text-amber-700">Stock bas · {stock}</span>;
  return <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-700">{stock} en stock</span>;
}

export default function ProduitsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orderStats, setOrderStats] = useState<Map<string, OrderProduct>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "table">("grid");

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Stock modal
  const [stockModal, setStockModal] = useState<Product | null>(null);
  const [stockQty, setStockQty] = useState("");
  const [stockNote, setStockNote] = useState("");
  const [stockSaving, setStockSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const [pRes, oRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/lf-orders"),
      ]);
      const pData = await pRes.json();
      setProducts(pData.products ?? []);

      const oData = await oRes.json();
      const orders: Record<string, unknown>[] = oData.orders ?? [];
      const map = new Map<string, OrderProduct>();
      for (const o of orders) {
        const name = String(o.product ?? "").trim();
        if (!name) continue;
        const qty = parseInt(String(o.quantity ?? "1"), 10) || 1;
        const price = parseFloat(String(o.total_price ?? "0")) || 0;
        const existing = map.get(name) ?? { name, unitsSold: 0, orderCount: 0, revenue: 0 };
        map.set(name, { ...existing, unitsSold: existing.unitsSold + qty, orderCount: existing.orderCount + 1, revenue: existing.revenue + price });
      }
      setOrderStats(map);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  function openAdd() {
    setEditProduct(null); setForm(emptyForm); setFormError(""); setShowModal(true);
  }
  function openEdit(p: Product) {
    setEditProduct(p);
    setForm({ name: p.name, sku: p.sku, image: p.image, sellPrice: String(p.sellPrice), purchasePrice: String(p.purchasePrice), stock: String(p.stock), minStock: String(p.minStock) });
    setFormError(""); setShowModal(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, image: ev.target?.result as string }));
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError("Le nom est requis."); return; }
    setSaving(true); setFormError("");
    try {
      if (editProduct) {
        const res = await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editProduct.id, ...form, sellPrice: parseFloat(form.sellPrice) || 0, purchasePrice: parseFloat(form.purchasePrice) || 0, stock: parseInt(form.stock) || 0, minStock: parseInt(form.minStock) || 5 }) });
        if (!res.ok) { const d = await res.json(); setFormError(d.error || "Erreur."); return; }
      } else {
        const res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, sellPrice: parseFloat(form.sellPrice) || 0, purchasePrice: parseFloat(form.purchasePrice) || 0, stock: parseInt(form.stock) || 0, minStock: parseInt(form.minStock) || 5 }) });
        if (!res.ok) { const d = await res.json(); setFormError(d.error || "Erreur."); return; }
      }
      setShowModal(false);
      fetchProducts();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce produit ?")) return;
    await fetch("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchProducts();
  }

  async function handleAddStock() {
    if (!stockModal) return;
    const qty = parseInt(stockQty);
    if (!qty || qty === 0) return;
    setStockSaving(true);
    try {
      await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: stockModal.id, action: "addStock", qty }) });
      setStockModal(null); setStockQty(""); setStockNote("");
      fetchProducts();
    } finally { setStockSaving(false); }
  }

  const displayed = products.filter(p => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
  const outOfStock = products.filter(p => p.stock === 0).length;
  const totalStock = products.reduce((s, p) => s + p.stock, 0);

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Produits</h1>
            <p className="text-sm text-slate-400">{products.length} produit{products.length !== 1 ? "s" : ""} au catalogue</p>
          </div>
          <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-200 transition-colors">
            + Ajouter produit
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total produits", value: products.length, color: "text-slate-900" },
              { label: "Unités en stock", value: totalStock, color: "text-blue-600" },
              { label: "Stock bas ⚠️", value: lowStock, color: lowStock > 0 ? "text-amber-600" : "text-emerald-600" },
              { label: "Rupture 🔴", value: outOfStock, color: outOfStock > 0 ? "text-red-600" : "text-emerald-600" },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <p className="text-sm text-slate-500 mb-1">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Alert banners */}
          {outOfStock > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3 mb-3 flex items-center gap-3">
              <span className="text-red-500 text-lg">🔴</span>
              <p className="text-sm font-semibold text-red-700">{outOfStock} produit(s) en rupture de stock — réapprovisionnement requis</p>
            </div>
          )}
          {lowStock > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 mb-4 flex items-center gap-3">
              <span className="text-amber-500 text-lg">⚠️</span>
              <p className="text-sm font-semibold text-amber-700">{lowStock} produit(s) en stock bas</p>
            </div>
          )}

          {/* Search + view toggle */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input type="text" placeholder="Rechercher par nom ou SKU…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white" />
            </div>
            <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
              <button onClick={() => setView("grid")} className={`p-2 rounded-lg transition-colors ${view === "grid" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-600"}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              </button>
              <button onClick={() => setView("table")} className={`p-2 rounded-lg transition-colors ${view === "table" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-600"}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : displayed.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center py-20 gap-4">
              <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center text-3xl">📦</div>
              <p className="text-slate-700 font-bold text-lg">Aucun produit</p>
              <p className="text-slate-400 text-sm text-center px-8">Ajoutez vos produits pour gérer votre catalogue et votre stock.</p>
              <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-md shadow-blue-200">+ Ajouter un produit</button>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayed.map(p => {
                const stats = orderStats.get(p.name);
                const margin = p.sellPrice - p.purchasePrice;
                return (
                  <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    {/* Image */}
                    <div className="relative rounded-t-2xl overflow-hidden bg-slate-50 aspect-square max-h-44 flex items-center justify-center">
                      {p.image ? (
                        <Image src={p.image} alt={p.name} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-300">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          <span className="text-xs">Pas d&apos;image</span>
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <StockBadge stock={p.stock} minStock={p.minStock} />
                      </div>
                    </div>

                    <div className="p-4 flex flex-col gap-3 flex-1">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm leading-tight">{p.name}</h3>
                        {p.sku && <p className="text-xs text-slate-400 mt-0.5 font-mono">SKU: {p.sku}</p>}
                      </div>

                      {/* Prices */}
                      <div className="flex gap-3">
                        <div className="flex-1 bg-emerald-50 rounded-xl p-2.5 text-center">
                          <p className="text-xs text-emerald-600 font-medium">Vente</p>
                          <p className="text-sm font-bold text-emerald-700">{p.sellPrice} MAD</p>
                        </div>
                        <div className="flex-1 bg-slate-50 rounded-xl p-2.5 text-center">
                          <p className="text-xs text-slate-500 font-medium">Achat</p>
                          <p className="text-sm font-bold text-slate-700">{p.purchasePrice} MAD</p>
                        </div>
                        <div className="flex-1 bg-blue-50 rounded-xl p-2.5 text-center">
                          <p className="text-xs text-blue-600 font-medium">Marge</p>
                          <p className={`text-sm font-bold ${margin >= 0 ? "text-blue-700" : "text-red-600"}`}>{margin} MAD</p>
                        </div>
                      </div>

                      {/* Order stats */}
                      {stats && (
                        <div className="flex items-center gap-3 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
                          <span><strong className="text-slate-700">{stats.orderCount}</strong> cmds</span>
                          <span>·</span>
                          <span><strong className="text-slate-700">{stats.unitsSold}</strong> vendus</span>
                          <span>·</span>
                          <span><strong className="text-slate-700">{Math.round(stats.revenue).toLocaleString("fr-MA")}</strong> MAD</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 mt-auto">
                        <button onClick={() => { setStockModal(p); setStockQty(""); setStockNote(""); }}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-xl transition-colors shadow-sm shadow-blue-200">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          Stock
                        </button>
                        <button onClick={() => openEdit(p)}
                          className="flex-1 text-xs font-semibold py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                          Modifier
                        </button>
                        <button onClick={() => handleDelete(p.id)}
                          className="p-2 rounded-xl border border-red-100 text-red-400 hover:bg-red-50 transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table view */
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-100 bg-slate-50/50">
                      {["Produit", "SKU", "Prix vente", "Prix achat", "Marge", "Stock", "Vendus", "Actions"].map(h => (
                        <th key={h} className="text-left px-5 py-3 font-semibold uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(p => {
                      const stats = orderStats.get(p.name);
                      const margin = p.sellPrice - p.purchasePrice;
                      return (
                        <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <ProductImage image={p.image} name={p.name} size={36} />
                              <span className="font-semibold text-slate-800">{p.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{p.sku || "—"}</td>
                          <td className="px-5 py-3.5 font-bold text-emerald-700">{p.sellPrice} MAD</td>
                          <td className="px-5 py-3.5 text-slate-600">{p.purchasePrice} MAD</td>
                          <td className={`px-5 py-3.5 font-bold ${margin >= 0 ? "text-blue-700" : "text-red-600"}`}>{margin} MAD</td>
                          <td className="px-5 py-3.5"><StockBadge stock={p.stock} minStock={p.minStock} /></td>
                          <td className="px-5 py-3.5 text-slate-500">{stats?.unitsSold ?? 0}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => { setStockModal(p); setStockQty(""); setStockNote(""); }}
                                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors">
                                + Stock
                              </button>
                              <button onClick={() => openEdit(p)} className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">Modifier</button>
                              <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-xl border border-red-100 text-red-400 hover:bg-red-50">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M3 6h18M19 6l-1 14H6L5 6"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">{editProduct ? "Modifier le produit" : "Ajouter un produit"}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {formError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{formError}</p>}

            <div className="flex flex-col gap-4">
              {/* Image upload */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Photo du produit</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    {form.image ? (
                      <Image src={form.image} alt="preview" width={64} height={64} className="object-cover w-full h-full" unoptimized />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth={1.5} className="w-7 h-7"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 w-fit">
                      📷 Choisir une photo
                    </button>
                    <input type="url" placeholder="Ou coller une URL d'image" value={form.image.startsWith("data:") ? "" : form.image}
                      onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                      className="text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 w-full" />
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
              </div>

              {/* Name + SKU */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nom du produit <span className="text-red-400">*</span></label>
                  <input type="text" placeholder="Ex: Montre Sport Pro" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">SKU / Référence</label>
                  <input type="text" placeholder="Ex: MSP-001" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 font-mono" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Prix de vente (MAD)</label>
                  <input type="number" placeholder="350" min="0" value={form.sellPrice} onChange={e => setForm(f => ({ ...f, sellPrice: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Prix d&apos;achat (MAD)</label>
                  <input type="number" placeholder="120" min="0" value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                </div>
              </div>

              {/* Stock section */}
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Gestion du stock</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Stock initial (unités)</label>
                    <input type="number" placeholder="0" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Seuil d&apos;alerte stock bas</label>
                    <input type="number" placeholder="5" min="0" value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white" />
                  </div>
                </div>
              </div>

              {/* Margin preview */}
              {(form.sellPrice || form.purchasePrice) && (
                <div className="flex items-center gap-3 bg-blue-50 rounded-2xl px-4 py-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth={2} className="w-5 h-5 shrink-0"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                  <div>
                    <p className="text-xs text-blue-600 font-semibold">Marge estimée</p>
                    <p className="text-sm font-bold text-blue-800">{(parseFloat(form.sellPrice) || 0) - (parseFloat(form.purchasePrice) || 0)} MAD par unité</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold shadow-md shadow-blue-200">
                {saving ? "Enregistrement…" : editProduct ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Stock modal */}
      {stockModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Alimenter le stock</h2>
              <button onClick={() => setStockModal(null)} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-4 mb-5">
              <ProductImage image={stockModal.image} name={stockModal.name} size={44} />
              <div>
                <p className="font-bold text-slate-900 text-sm">{stockModal.name}</p>
                {stockModal.sku && <p className="text-xs text-slate-400 font-mono">SKU: {stockModal.sku}</p>}
                <p className="text-xs text-slate-500 mt-0.5">Stock actuel: <strong className="text-slate-800">{stockModal.stock}</strong> unités</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Quantité à ajouter <span className="text-red-400">*</span></label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setStockQty(q => String(Math.max(1, parseInt(q || "0") - 1)))}
                    className="w-10 h-10 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-lg flex items-center justify-center">−</button>
                  <input type="number" min="1" placeholder="0" value={stockQty} onChange={e => setStockQty(e.target.value)}
                    className="flex-1 text-center text-lg font-bold border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                  <button onClick={() => setStockQty(q => String(parseInt(q || "0") + 1))}
                    className="w-10 h-10 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-lg flex items-center justify-center">+</button>
                </div>
                {stockQty && parseInt(stockQty) > 0 && (
                  <p className="text-xs text-emerald-600 mt-1.5 font-semibold text-center">
                    Nouveau stock: {stockModal.stock + parseInt(stockQty)} unités
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Note (optionnel)</label>
                <input type="text" placeholder="Ex: Réception fournisseur du 15/05" value={stockNote} onChange={e => setStockNote(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setStockModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
              <button onClick={handleAddStock} disabled={stockSaving || !stockQty || parseInt(stockQty) <= 0}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold shadow-md shadow-blue-200">
                {stockSaving ? "Enregistrement…" : `+ ${stockQty || 0} unités`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
