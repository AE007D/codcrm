"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import { useLang } from "@/lib/i18n";

type ShippingMode = "ramassage" | "stock";

type Store = {
  id: number;
  name: string;
  logo: string;          // URL or empty → show initials
  city: string;
  address: string;
  phone: string;
  manager: string;
  shippingMode: ShippingMode;
  status: "Active" | "Inactive";
};

const SHIPPING_MODE_LABELS: Record<ShippingMode, { label: string; sub: string; icon: string; color: string; bg: string }> = {
  ramassage: {
    label: "Ramassage",
    sub: "Le transporteur vient récupérer",
    icon: "🚚",
    color: "text-blue-700",
    bg: "bg-blue-50",
  },
  stock: {
    label: "Stock transporteur",
    sub: "Stock déposé chez le livreur",
    icon: "🏭",
    color: "text-violet-700",
    bg: "bg-violet-50",
  },
};

function StoreLogo({ logo, name, size = 48 }: { logo: string; name: string; size?: number }) {
  const colors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const cls = `rounded-2xl flex items-center justify-center shrink-0`;
  const style = { width: size, height: size, minWidth: size };

  if (logo) {
    return (
      <div className={`${cls} overflow-hidden bg-slate-100 border border-slate-100`} style={style}>
        <Image src={logo} alt={name} width={size} height={size} className="object-cover w-full h-full" unoptimized />
      </div>
    );
  }
  return (
    <div className={`${cls} ${color} text-white font-bold`} style={style}>
      <span style={{ fontSize: size * 0.35 }}>{initials}</span>
    </div>
  );
}

type Product = { id: string; name: string; agentName?: string; boutiqueNom?: string; commissionAmount?: number };

const emptyForm = { name: "", logo: "", city: "", address: "", phone: "", manager: "", shippingMode: "ramassage" as ShippingMode };

export default function BoutiquesPage() {
  const { t } = useLang();
  const [stores, setStores] = useState<Store[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editStore, setEditStore] = useState<Store | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [fetchOk, setFetchOk] = useState(false);

  // Product assignment panel
  const [assignBoutique, setAssignBoutique] = useState<Store | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [boutiqueAssignForm, setBoutiqueAssignForm] = useState<Record<string, boolean>>({});
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);

  /* ── Load from Supabase settings on mount ── */
  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(d => {
        const bs = d.settings?.boutiques;
        if (Array.isArray(bs)) {
          // normalize: old data may mix Store objects and plain strings
          setStores(bs.map((b: unknown) => typeof b === "object" && b !== null ? b as Store : { id: Date.now() + Math.random(), name: String(b), logo: "", city: "", address: "", phone: "", manager: "", shippingMode: "ramassage" as ShippingMode, status: "Active" as const }));
        }
        setFetchOk(true);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  /* ── Persist to Supabase settings whenever stores change ── */
  useEffect(() => {
    if (!loaded || !fetchOk) return; // don't overwrite DB before successful initial load
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boutiques: stores }),
    }).catch(() => {});
  }, [stores, loaded, fetchOk]);

  const filtered = stores.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.city.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setEditStore(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }

  function openEdit(s: Store) {
    setEditStore(s);
    setForm({ name: s.name, logo: s.logo, city: s.city, address: s.address, phone: s.phone, manager: s.manager, shippingMode: s.shippingMode });
    setError("");
    setShowModal(true);
  }

  function handleSave() {
    if (!form.name || !form.city || !form.phone) {
      setError("Nom, ville et téléphone sont obligatoires.");
      return;
    }
    if (editStore) {
      setStores(prev => prev.map(s => s.id === editStore.id ? { ...s, ...form } : s));
    } else {
      setStores(prev => [...prev, { id: Date.now(), ...form, status: "Active" }]);
    }
    setShowModal(false);
    setError("");
  }

  function handleToggleStatus(id: number) {
    setStores(prev => prev.map(s => s.id === id ? { ...s, status: s.status === "Active" ? "Inactive" : "Active" } : s));
  }

  function handleDelete(id: number) {
    if (!confirm("Supprimer cette boutique ?")) return;
    setStores(prev => prev.filter(s => s.id !== id));
  }

  async function openBoutiqueAssign(store: Store) {
    setAssignBoutique(store);
    setAssignLoading(true);
    try {
      const res = await fetch("/api/products");
      const products: Product[] = res.ok ? (await res.json()).products ?? [] : [];
      setAllProducts(products);
      const form: Record<string, boolean> = {};
      for (const p of products) form[p.id] = p.boutiqueNom === store.name;
      setBoutiqueAssignForm(form);
    } finally { setAssignLoading(false); }
  }

  async function saveBoutiqueAssign() {
    if (!assignBoutique) return;
    setAssignSaving(true);
    try {
      await Promise.all(allProducts.map(p => {
        const shouldBelong = boutiqueAssignForm[p.id];
        const belongsNow = p.boutiqueNom === assignBoutique.name;
        if (shouldBelong === belongsNow) return Promise.resolve();
        return fetch("/api/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: p.id, boutiqueNom: shouldBelong ? assignBoutique.name : "" }),
        });
      }));
      setAssignBoutique(null);
    } finally { setAssignSaving(false); }
  }

  const activeCount = stores.filter(s => s.status === "Active").length;
  const ramassageCount = stores.filter(s => s.shippingMode === "ramassage").length;
  const stockCount = stores.filter(s => s.shippingMode === "stock").length;

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="sidebar-header-pl bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t("stores_title")}</h1>
            <p className="text-sm text-slate-400">{`${stores.length} ${t("stores_count")}`}</p>
          </div>
          <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-blue-200">
            + {t("add_store")}
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5 mb-6">
            {[
              { label: "Total boutiques", value: stores.length, color: "text-slate-900" },
              { label: "Actives", value: activeCount, color: "text-emerald-600" },
              { label: "Ramassage 🚚", value: ramassageCount, color: "text-blue-700" },
              { label: "Stock transporteur 🏭", value: stockCount, color: "text-violet-700" },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <p className="text-sm text-slate-500 font-medium mb-1">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("search")}
              className="w-full sm:w-80 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white"
            />
          </div>

          {/* Cards grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-4xl">🏪</div>
              <p className="text-slate-700 font-bold text-lg">Aucune boutique</p>
              <p className="text-slate-400 text-sm text-center">Ajoutez votre première boutique pour commencer à gérer vos expéditions.</p>
              <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-md shadow-blue-200 transition-colors">
                + Ajouter boutique
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(s => {
                const mode = SHIPPING_MODE_LABELS[s.shippingMode] ?? SHIPPING_MODE_LABELS["ramassage"];
                return (
                  <div key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    {/* Card header */}
                    <div className="flex items-start gap-4 p-5 border-b border-slate-50">
                      <StoreLogo logo={s.logo} name={s.name} size={52} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-base leading-tight truncate">{s.name}</h3>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${s.status === "Active" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                            {s.status === "Active" ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">{s.city}</p>
                      </div>
                    </div>

                    {/* Shipping mode badge — prominent */}
                    <div className={`mx-5 mt-4 flex items-center gap-3 rounded-xl px-4 py-3 ${mode.bg}`}>
                      <span className="text-xl">{mode.icon}</span>
                      <div>
                        <p className={`text-sm font-bold ${mode.color}`}>{mode.label}</p>
                        <p className={`text-xs ${mode.color} opacity-75`}>{mode.sub}</p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="p-5 pt-3 flex flex-col gap-2 flex-1">
                      {s.address && (
                        <div className="flex items-start gap-2 text-sm text-slate-500">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 mt-0.5 shrink-0"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          <span className="line-clamp-1">{s.address}</span>
                        </div>
                      )}
                      {s.phone && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 shrink-0"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 11 19.79 19.79 0 01.13 2.38 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.46-.46a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                          <span>{s.phone}</span>
                        </div>
                      )}
                      {s.manager && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 shrink-0"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          <span>{s.manager}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="px-5 pb-5 flex gap-2 flex-wrap">
                      <button onClick={() => openBoutiqueAssign(s)}
                        className="flex-1 text-xs font-semibold py-2 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors">
                        Produits
                      </button>
                      <button onClick={() => openEdit(s)} className="flex-1 text-xs font-semibold py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                        Modifier
                      </button>
                      <button onClick={() => handleToggleStatus(s.id)} className="flex-1 text-xs font-semibold py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                        {s.status === "Active" ? "Désactiver" : "Activer"}
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="text-xs font-semibold py-2 px-3 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Product assignment panel */}
      {assignBoutique && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Produits — {assignBoutique.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Cochez les produits appartenant à cette boutique</p>
              </div>
              <button onClick={() => setAssignBoutique(null)} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {assignLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : allProducts.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-12">Aucun produit dans le catalogue.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {allProducts.map(p => (
                    <label key={p.id} className={`flex items-center gap-3 rounded-2xl border p-4 cursor-pointer transition-colors ${boutiqueAssignForm[p.id] ? "border-emerald-200 bg-emerald-50/40" : "border-slate-100 bg-white hover:bg-slate-50/50"}`}>
                      <input type="checkbox" checked={!!boutiqueAssignForm[p.id]}
                        onChange={e => setBoutiqueAssignForm(prev => ({ ...prev, [p.id]: e.target.checked }))}
                        className="w-4 h-4 rounded accent-emerald-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{p.name}</p>
                        {p.agentName && <p className="text-xs text-slate-400">Agent: {p.agentName}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setAssignBoutique(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">{t("cancel")}</button>
              <button onClick={saveBoutiqueAssign} disabled={assignSaving || assignLoading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold shadow-md shadow-emerald-200">
                {assignSaving ? t("saving") : t("save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">{editStore ? "Modifier la boutique" : "Ajouter une boutique"}</h2>
              <button onClick={() => { setShowModal(false); setError(""); }} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}

            <div className="flex flex-col gap-4">
              {/* Logo preview + URL */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Logo de la boutique</label>
                <div className="flex items-center gap-3">
                  <StoreLogo logo={form.logo} name={form.name || "?"} size={48} />
                  <input
                    type="url"
                    placeholder="https://exemple.com/logo.png  (optionnel)"
                    value={form.logo}
                    onChange={e => setForm(f => ({ ...f, logo: e.target.value }))}
                    className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Laissez vide pour utiliser les initiales automatiquement.</p>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nom de la boutique <span className="text-red-400">*</span></label>
                <input type="text" placeholder="Ex: Boutique Casa Nord" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
              </div>

              {/* Shipping mode — PROMINENT */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Mode de livraison <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-2 gap-3">
                  {(["ramassage", "stock"] as ShippingMode[]).map(mode => {
                    const m = SHIPPING_MODE_LABELS[mode];
                    const active = form.shippingMode === mode;
                    return (
                      <button key={mode} type="button" onClick={() => setForm(f => ({ ...f, shippingMode: mode }))}
                        className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-all cursor-pointer
                          ${active ? "border-blue-500 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                        <span className="text-3xl">{m.icon}</span>
                        <div>
                          <p className={`text-sm font-bold ${active ? m.color : "text-slate-700"}`}>{m.label}</p>
                          <p className="text-xs text-slate-400 mt-0.5 leading-snug">{m.sub}</p>
                        </div>
                        {active && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* City & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Ville <span className="text-red-400">*</span></label>
                  <input type="text" placeholder="Casablanca" value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Téléphone <span className="text-red-400">*</span></label>
                  <input type="text" placeholder="06 00 00 00 00" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Adresse</label>
                <input type="text" placeholder="12 Rue Hassan II, Quartier…" value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
              </div>

              {/* Manager */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Responsable</label>
                <input type="text" placeholder="Nom du responsable" value={form.manager}
                  onChange={e => setForm(f => ({ ...f, manager: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowModal(false); setError(""); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                {t("cancel")}
              </button>
              <button onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-200 transition-colors">
                {editStore ? t("save") : t("add")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
