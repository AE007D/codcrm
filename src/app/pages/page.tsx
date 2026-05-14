"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";

type LandingPage = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  price: number;
  originalPrice: number;
  currency: string;
  images: string[];
  bullets: string[];
  urgencyText: string;
  ctaText: string;
  primaryColor: string;
  theme: "light" | "dark";
  showTrustBadges: boolean;
  showStickyBar: boolean;
  requireAddress: boolean;
  active: boolean;
  views: number;
  orders: number;
  created_at: string;
};

const COLORS = [
  { label: "Bleu", value: "#2563EB" },
  { label: "Vert", value: "#059669" },
  { label: "Orange", value: "#EA580C" },
  { label: "Rouge", value: "#DC2626" },
  { label: "Violet", value: "#7C3AED" },
  { label: "Noir", value: "#0F172A" },
];

const emptyForm = {
  title: "", subtitle: "", slug: "",
  price: "", originalPrice: "",
  images: [] as string[],
  bullet1: "", bullet2: "", bullet3: "", bullet4: "",
  urgencyText: "هذا العرض مؤقت — لن تجده مرة أخرى !!!",
  ctaText: "إستفد من العرض الآن 🛒",
  primaryColor: "#2563EB",
  theme: "light" as "light" | "dark",
  showTrustBadges: true, showStickyBar: true, requireAddress: true,
};

function ImageUploadSlot({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFile(file: File) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) onChange(data.url);
      else alert(data.error || "Erreur upload");
    } catch {
      alert("Erreur réseau");
    } finally {
      setUploading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">{label}</label>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {value ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 aspect-square bg-slate-50 group">
          <img src={value} alt="" className="w-full h-full object-contain" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="bg-white text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Changer
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors"
            >
              Supprimer
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          disabled={uploading}
          className={`w-full aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all cursor-pointer
            ${dragOver ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"}
            ${uploading ? "opacity-60 pointer-events-none" : ""}`}
        >
          {uploading ? (
            <>
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400">Upload…</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-slate-300">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span className="text-xs text-slate-400 text-center px-2">
                Cliquer ou glisser<br />JPG · PNG · WebP
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default function PagesAdmin() {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  async function fetchPages() {
    try {
      const res = await fetch("/api/lp-pages");
      const data = await res.json();
      setPages(data.pages ?? []);
    } catch { /* silent */ }
  }

  useEffect(() => { fetchPages(); }, []);

  function autoSlug(title: string) {
    return title.toLowerCase()
      .replace(/[àáâãäå]/g, "a").replace(/[èéêë]/g, "e")
      .replace(/[ìíîï]/g, "i").replace(/[òóôõö]/g, "o")
      .replace(/[ùúûü]/g, "u").replace(/[ç]/g, "c")
      .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
  }

  function setImage(index: number, url: string) {
    setForm(f => {
      const imgs = [...f.images];
      if (url) {
        imgs[index] = url;
      } else {
        imgs.splice(index, 1);
      }
      return { ...f, images: imgs.filter(Boolean) };
    });
  }

  async function createPage() {
    if (!form.title || !form.price) { setError("Titre et prix sont obligatoires."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/lp-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          subtitle: form.subtitle,
          slug: form.slug || autoSlug(form.title),
          price: Number(form.price),
          originalPrice: Number(form.originalPrice) || 0,
          images: form.images,
          bullets: [form.bullet1, form.bullet2, form.bullet3, form.bullet4].filter(Boolean),
          urgencyText: form.urgencyText,
          ctaText: form.ctaText,
          primaryColor: form.primaryColor,
          theme: form.theme,
          showTrustBadges: form.showTrustBadges,
          showStickyBar: form.showStickyBar,
          requireAddress: form.requireAddress,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setPages(prev => [data.page, ...prev]);
      setForm(emptyForm);
      setShowModal(false);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function toggleActive(page: LandingPage) {
    await fetch("/api/lp-pages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: page.id, active: !page.active }),
    });
    setPages(prev => prev.map(p => p.id === page.id ? { ...p, active: !p.active } : p));
  }

  async function deletePage(id: string) {
    await fetch(`/api/lp-pages?id=${id}`, { method: "DELETE" });
    setPages(prev => prev.filter(p => p.id !== id));
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const convRate = (p: LandingPage) =>
    p.views > 0 ? ((p.orders / p.views) * 100).toFixed(1) : "—";

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Mes Pages</h1>
            <p className="text-sm text-slate-400 hidden sm:block">Créez des landing pages COD sans Lightfunnels</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-blue-200 transition-colors whitespace-nowrap">
            + Nouvelle page
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {pages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-5">
              <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth={1.5} className="w-10 h-10">
                  <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-slate-800 font-bold text-lg">Aucune page créée</p>
                <p className="text-slate-400 text-sm mt-1">Créez votre première landing page COD en 2 minutes</p>
              </div>
              <button onClick={() => setShowModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl shadow-md shadow-blue-200 transition-colors">
                Créer ma première page
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {pages.map(page => (
              <div key={page.id} className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all ${page.active ? "border-emerald-100" : "border-slate-100 opacity-70"}`}>
                <div className="h-2" style={{ backgroundColor: page.primaryColor }} />

                {page.images[0] && (
                  <div className="aspect-video bg-slate-50 overflow-hidden">
                    <img src={page.images[0]} alt={page.title} className="w-full h-full object-contain" />
                  </div>
                )}

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 text-base truncate">{page.title}</h3>
                      {page.subtitle && <p className="text-xs text-slate-400 truncate mt-0.5">{page.subtitle}</p>}
                    </div>
                    <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${page.active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                      {page.active ? "● En ligne" : "● Hors ligne"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl font-black text-slate-900">{page.price} {page.currency}</span>
                    {page.originalPrice > 0 && (
                      <>
                        <span className="text-sm text-slate-400 line-through">{page.originalPrice} {page.currency}</span>
                        <span className="text-xs font-bold bg-red-50 text-red-500 px-2 py-0.5 rounded-lg">
                          -{Math.round(((page.originalPrice - page.price) / page.originalPrice) * 100)}%
                        </span>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "Vues", value: page.views },
                      { label: "Commandes", value: page.orders },
                      { label: "Taux", value: `${convRate(page)}%` },
                    ].map(s => (
                      <div key={s.label} className="bg-slate-50 rounded-xl p-2.5 text-center">
                        <p className="text-xs text-slate-400 mb-0.5">{s.label}</p>
                        <p className="font-bold text-slate-800 text-sm">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 mb-4 border border-slate-100">
                    <code className="flex-1 text-xs text-blue-700 font-mono truncate">{baseUrl}/lp/{page.slug}</code>
                    <button onClick={() => copy(`${baseUrl}/lp/${page.slug}`, page.id)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors shrink-0 ${copied === page.id ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}>
                      {copied === page.id ? "✓" : "Copier"}
                    </button>
                    <a href={`/lp/${page.slug}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 px-2.5 py-1 rounded-lg transition-colors shrink-0">
                      ↗
                    </a>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => toggleActive(page)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors border ${page.active ? "border-slate-200 text-slate-600 hover:bg-slate-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}>
                      {page.active ? "Désactiver" : "Activer"}
                    </button>
                    <button onClick={() => deletePage(page.id)}
                      className="py-2 px-3 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-50 border border-red-100 transition-colors">
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Create page modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Nouvelle landing page COD</h2>
              <button onClick={() => { setShowModal(false); setError(""); setForm(emptyForm); }}
                className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              {/* Basic info */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Produit</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Nom du produit *</label>
                    <input type="text" placeholder="Ex: Caméra voiture 4K" value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value, slug: f.slug || autoSlug(e.target.value) }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Accroche (facultatif)</label>
                    <input type="text" placeholder="Ex: Qualité HD · Vision nocturne · Détection de mouvement" value={form.subtitle}
                      onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Prix de vente (MAD) *</label>
                    <input type="number" placeholder="299" value={form.price}
                      onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Prix barré (MAD)</label>
                    <input type="number" placeholder="499" value={form.originalPrice}
                      onChange={e => setForm(f => ({ ...f, originalPrice: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Slug URL</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 shrink-0">/lp/</span>
                      <input type="text" placeholder="camera-voiture-4k" value={form.slug}
                        onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                        className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 font-mono" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Images */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Photos du produit</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map(i => (
                    <ImageUploadSlot
                      key={i}
                      label={i === 0 ? "Photo principale" : `Photo ${i + 1}`}
                      value={form.images[i] ?? ""}
                      onChange={url => setImage(i, url)}
                    />
                  ))}
                </div>
              </div>

              {/* Selling points */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Points forts du produit</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([["bullet1","Point 1","✅ Vision nocturne HD"],["bullet2","Point 2","✅ Angle 170°"],["bullet3","Point 3","✅ Installation facile"],["bullet4","Point 4","✅ Enregistrement boucle"]] as const).map(([key, label, ph]) => (
                    <div key={key}>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
                      <input type="text" placeholder={ph} value={form[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Urgency + CTA */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Textes</h3>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Texte d'urgence</label>
                  <input type="text" value={form.urgencyText}
                    onChange={e => setForm(f => ({ ...f, urgencyText: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 text-right" dir="auto" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Bouton CTA</label>
                  <input type="text" value={form.ctaText}
                    onChange={e => setForm(f => ({ ...f, ctaText: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 text-right" dir="auto" />
                </div>
              </div>

              {/* Design */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Design</h3>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Couleur principale</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map(c => (
                      <button key={c.value} type="button" onClick={() => setForm(f => ({ ...f, primaryColor: c.value }))}
                        className={`w-8 h-8 rounded-xl transition-all ${form.primaryColor === c.value ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : "hover:scale-105"}`}
                        style={{ backgroundColor: c.value }} title={c.label} />
                    ))}
                    <input type="color" value={form.primaryColor}
                      onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                      className="w-8 h-8 rounded-xl border border-slate-200 cursor-pointer" title="Couleur personnalisée" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  {[
                    { key: "showTrustBadges", label: "Badges de confiance" },
                    { key: "showStickyBar", label: "Barre sticky bas" },
                    { key: "requireAddress", label: "Champ adresse" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form[key as keyof typeof form] as boolean}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                        className="w-4 h-4 rounded accent-blue-600" />
                      <span className="text-sm text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button type="button" onClick={() => { setShowModal(false); setError(""); setForm(emptyForm); }}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Annuler
              </button>
              <button type="button" onClick={createPage} disabled={loading}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold shadow-md shadow-blue-200 transition-colors">
                {loading ? "Création…" : "Créer la page →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
