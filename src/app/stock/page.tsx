"use client";

import { useEffect, useState, type FormEvent } from "react";
import Sidebar from "@/components/Sidebar";
import { ProductImage, StockBadge } from "@/components/ProductStockDisplay";

type StockMovement = { id: string; productId: string; quantity: number; unitCost: number; totalCost: number; note: string; createdAt: string; stockAfter: number };

type Product = {
  id: string;
  name: string;
  sku: string;
  image: string;
  stock: number;
  minStock: number;
  purchasePrice: number;
  stockMovements?: StockMovement[];
};

const money = new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" });
const fieldClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [purchased, setPurchased] = useState("");
  const [sent, setSent] = useState("");
  const [correctionMessage, setCorrectionMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadProducts() {
      try {
        const response = await fetch("/api/products", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (!response.ok) throw new Error();
        const data = await response.json();
        setProducts(data.products ?? []);
      } catch {
        if (!controller.signal.aborted) setLoadError("Impossible de charger le stock.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadProducts();
    return () => controller.abort();
  }, []);

  const selected = products.find(product => product.id === selectedId);
  const search = query.trim().toLowerCase();
  const displayed = products.filter(product =>
    product.name.toLowerCase().includes(search) || (product.sku ?? "").toLowerCase().includes(search),
  );

  function selectProduct(id: string) {
    setSelectedId(id);
    setQuantity("");
    setCost("");
    setNote("");
    setSaveError("");
    setPurchased("");
    setSent("");
    setCorrectionMessage("");
  }

  const correctedStock = purchased.trim() && sent.trim()
    && Number.isSafeInteger(Number(purchased)) && Number.isSafeInteger(Number(sent))
    && Number(purchased) >= Number(sent) && Number(sent) >= 0
    ? Number(purchased) - Number(sent) : null;

  async function correctStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving || correctedStock === null) return;
    setSaving(true);
    setCorrectionMessage("");
    try {
      const response = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, action: "correctStock", stock: correctedStock,
          expectedStock: selected.stock,
          note: `Inventaire corrigé : ${Number(purchased)} achetées − ${Number(sent)} sorties = ${correctedStock} restantes.` }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de corriger le stock.");
      setProducts(current => current.map(product => product.id === selected.id ? { ...product, stock: data.stock } : product));
      setCorrectionMessage(`Stock corrigé : ${data.stock} pièces restantes.`);
    } catch (error) {
      setCorrectionMessage(error instanceof Error ? error.message : "Impossible de corriger le stock.");
    } finally {
      setSaving(false);
    }
  }

  async function receiveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;
    const qty = Number(quantity);
    const purchasePrice = cost.trim() === "" ? null : Number(cost);
    if (!Number.isSafeInteger(qty) || qty < 1 || (purchasePrice !== null && (!Number.isFinite(purchasePrice) || purchasePrice < 0))) {
      setSaveError("Saisissez une quantité entière et un coût unitaire valide.");
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, action: "addStock", qty, purchasePrice, note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible d’enregistrer la réception.");
      setProducts(current => current.map(product => product.id === selected.id ? {
        ...product,
        ...data.product,
        stockMovements: [data.movement, ...(product.stockMovements ?? [])],
      } : product));
      setQuantity("");
      setCost("");
      setNote("");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Impossible d’enregistrer la réception.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sidebar-header-pl border-b border-slate-100 bg-white py-4 pl-14 pr-4 lg:px-8">
          <h1 className="text-xl font-bold text-slate-900">Stock &amp; coûts</h1>
        </header>
        <main className="grid items-start gap-5 p-4 lg:p-8 xl:grid-cols-2">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white">
            <div className="p-4">
              <input className={fieldClass} type="search" aria-label="Rechercher un produit" placeholder="Rechercher par nom ou SKU" value={query} onChange={event => setQuery(event.target.value)} />
            </div>
            {loading && <p className="p-4 text-sm text-slate-500" role="status">Chargement du stock…</p>}
            {loadError && <p className="p-4 text-sm text-red-700" role="alert">{loadError}</p>}
            {!loading && !loadError && displayed.length === 0 && <p className="p-4 text-sm text-slate-500">Aucun produit trouvé.</p>}
            <ul className="divide-y divide-slate-100">
              {displayed.map(product => (
                <li key={product.id}>
                  <button type="button" disabled={saving} aria-pressed={selectedId === product.id} onClick={() => selectProduct(product.id)}
                    className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 aria-pressed:bg-blue-50">
                    <ProductImage image={product.image} name={product.name} size={40} />
                    <span className="min-w-32 flex-1">
                      <span className="block font-semibold text-slate-900">{product.name}</span>
                      {product.sku && <span className="block text-xs text-slate-500">{product.sku}</span>}
                    </span>
                    <StockBadge stock={product.stock} minStock={product.minStock} />
                    <span className="text-sm font-semibold text-slate-700">{money.format(product.purchasePrice)} / unité</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {selected && (
            <section className="min-w-0 rounded-2xl border border-slate-100 bg-white p-5">
              <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
              <p className="mt-1 text-sm text-slate-500">Coût moyen d’achat · {money.format(selected.purchasePrice)} par unité</p>
              <form className="mt-5 space-y-4" onSubmit={receiveStock}>
                <h3 className="text-sm font-bold text-slate-800">Alimenter le stock</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm text-slate-700">
                    <span>Quantité à ajouter</span>
                    <input className={fieldClass} type="number" min="1" step="1" required value={quantity} onChange={event => setQuantity(event.target.value)} />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span>Coût d’achat unitaire (MAD)</span>
                    <input className={fieldClass} type="number" min="0" step="0.01" placeholder={String(selected.purchasePrice)} value={cost} onChange={event => setCost(event.target.value)} />
                  </label>
                </div>
                <label className="block space-y-1 text-sm text-slate-700">
                  <span>Note (facultatif)</span>
                  <input className={fieldClass} value={note} onChange={event => setNote(event.target.value)} />
                </label>
                {saveError && <p className="text-sm text-red-700" role="alert">{saveError}</p>}
                <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                  {saving ? "Enregistrement…" : "Enregistrer la réception"}
                </button>
              </form>
              <form className="mt-6 space-y-3 border-t border-slate-100 pt-4" onSubmit={correctStock}>
                <h3 className="text-sm font-bold text-slate-800">Corriger le stock actuel</h3>
                <p className="text-xs text-slate-500">Indiquez le total acheté et les sorties nettes de retours pour la même période. La correction conserve l’historique des achats et le coût unitaire.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm text-slate-700">
                    <span>Total acheté (pièces)</span>
                    <input className={fieldClass} type="number" min="0" step="1" required value={purchased} onChange={event => setPurchased(event.target.value)} />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span>Total sorti (pièces)</span>
                    <input className={fieldClass} type="number" min="0" step="1" required value={sent} onChange={event => setSent(event.target.value)} />
                  </label>
                </div>
                {correctedStock !== null && <p className="text-sm font-semibold text-slate-700">{Number(purchased)} − {Number(sent)} = {correctedStock} pièces restantes</p>}
                <button type="submit" disabled={saving || correctedStock === null} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  {saving ? "Enregistrement…" : "Enregistrer la correction"}
                </button>
                {correctionMessage && <p role="status" className="text-sm text-slate-700">{correctionMessage}</p>}
              </form>
              <div className="mt-6 border-t border-slate-100 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800">Historique des achats</h3>
                  <span className="text-xs text-slate-400">{selected.stockMovements?.length ?? 0} réception(s)</span>
                </div>
                {!selected.stockMovements?.length ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">Les prochains achats apparaîtront ici.</p>
                ) : (
                  <div className="space-y-2">
                    {selected.stockMovements.map(movement => (
                      <div key={movement.id} className="rounded-xl bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-bold text-slate-700">{new Date(movement.createdAt).toLocaleDateString("fr-MA")}</span>
                          <span className="font-semibold text-slate-600">+{movement.quantity} · {movement.unitCost} MAD/unité</span>
                          <span className="font-bold text-slate-800">{movement.totalCost.toLocaleString("fr-MA")} MAD</span>
                        </div>
                        <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                          <span>{movement.note || "Aucune note"}</span><span>Stock après achat : {movement.stockAfter}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
