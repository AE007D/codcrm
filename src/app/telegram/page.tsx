"use client";

import { useState, useRef } from "react";
import Sidebar from "@/components/Sidebar";

type TelegramResult = { url: string; title: string; snippet: string; channel: string };

export default function TelegramPage() {
  const [query, setQuery] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [results, setResults] = useState<TelegramResult[]>([]);
  const [reverseImageUrl, setReverseImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setImageFile(f);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) handleFile(f);
  }

  async function search() {
    if (!query.trim() && !imageFile) { setError("Entrez un nom de produit ou uploadez une image."); return; }
    setLoading(true); setError(""); setSearched(false);
    try {
      let imageBase64: string | undefined;
      if (imageFile) {
        imageBase64 = await new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onload = e => resolve((e.target?.result as string).split(",")[1]);
          reader.readAsDataURL(imageFile);
        });
      }
      const searchQuery = query.trim() || (imageFile?.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") ?? "product");
      const res = await fetch("/api/telegram-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery + " COD Maroc", imageBase64 }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setResults([]); }
      else { setResults(data.results ?? []); setReverseImageUrl(data.reverseImageUrl ?? null); }
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); setSearched(true); }
  }

  function clearImage() { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = ""; }

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shadow-md shadow-blue-200">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Recherche Telegram</h1>
              <p className="text-sm text-slate-400">Uploadez une photo produit — trouvez les groupes/canaux COD Maroc</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-5">

            {/* Image upload */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="font-bold text-slate-900 mb-4">Photo du produit</h2>
              {!imagePreview ? (
                <div
                  onDrop={onDrop} onDragOver={e => e.preventDefault()}
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
                >
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={1.5} className="w-7 h-7"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-700">Glissez une image ici</p>
                    <p className="text-sm text-slate-400 mt-0.5">ou cliquez pour sélectionner — JPG, PNG, WEBP</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </div>
              ) : (
                <div className="flex gap-4 items-start">
                  <div className="w-32 h-32 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                    <img src={imagePreview} alt="product" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{imageFile?.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{imageFile ? (imageFile.size / 1024).toFixed(0) + " KB" : ""}</p>
                    <button onClick={clearImage} className="mt-3 text-xs text-red-400 hover:text-red-600 border border-red-100 px-3 py-1.5 rounded-lg transition-colors">
                      Changer l&apos;image
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Keyword input */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="font-bold text-slate-900 mb-3">Nom du produit / mots-clés</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Ex: montre sport, écouteurs bluetooth, sac à dos…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && search()}
                  className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                />
                <button onClick={search} disabled={loading}
                  className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-md shadow-blue-200 transition-colors whitespace-nowrap">
                  {loading ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 animate-spin"><path d="M21 12a9 9 0 11-6.22-8.56"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
                  )}
                  Rechercher
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">La recherche cherche automatiquement sur les canaux/groupes Telegram Maroc COD</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 flex items-center gap-3">
                <span className="text-red-500 font-bold">✕</span>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Reverse image search link */}
            {reverseImageUrl && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center gap-3">
                <span className="text-2xl">🔍</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">Recherche inversée par image</p>
                  <p className="text-xs text-amber-600 mt-0.5">Yandex peut trouver des résultats Telegram supplémentaires à partir de l&apos;image</p>
                </div>
                <a href={reverseImageUrl} target="_blank" rel="noopener noreferrer"
                  className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap">
                  Ouvrir Yandex →
                </a>
              </div>
            )}

            {/* Results */}
            {searched && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-slate-900">
                    {results.length > 0 ? `${results.length} canal(aux) trouvé(s)` : "Aucun résultat Telegram trouvé"}
                  </h2>
                  {results.length > 0 && <span className="text-xs text-slate-400">Résultats filtrés t.me</span>}
                </div>

                {results.length === 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-10 flex flex-col items-center gap-3">
                    <span className="text-5xl">📭</span>
                    <p className="text-slate-600 font-semibold">Aucun canal Telegram trouvé</p>
                    <p className="text-slate-400 text-sm text-center">Essayez avec d&apos;autres mots-clés ou utilisez la recherche inversée Yandex ci-dessus</p>
                  </div>
                )}

                <div className="space-y-3">
                  {results.map((r, i) => (
                    <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                      className="block bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 hover:border-blue-200 hover:shadow-md transition-all group">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shrink-0 shadow-md shadow-blue-200 group-hover:scale-105 transition-transform">
                          <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-slate-900 truncate">{r.title || r.channel}</p>
                            {r.channel && <span className="text-xs text-blue-500 font-mono bg-blue-50 px-2 py-0.5 rounded-lg shrink-0">@{r.channel}</span>}
                          </div>
                          {r.snippet && <p className="text-sm text-slate-500 line-clamp-2">{r.snippet}</p>}
                          <p className="text-xs text-slate-300 mt-1 truncate">{r.url}</p>
                        </div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-slate-300 group-hover:text-blue-400 shrink-0 mt-1 transition-colors"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
