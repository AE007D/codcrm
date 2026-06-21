"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import { AlertTriangle } from "lucide-react";

type Creds = { tk: string; sk: string };
type City = { ID?: string; City?: string; Delivered_Fees?: string; Returned_Fees?: string; Refused_Fees?: string; Changed_Fees?: string; [k: string]: unknown };
type Colis = { Code?: string; code?: string; Full_Name?: string; fullname?: string; nom?: string; Phone?: string; phone?: string; telephone?: string; City?: string; city?: string; ville?: string; COD?: string | number; price?: string | number; prix?: string | number; Product?: string; product?: string; produit?: string; Status?: string; State?: string; state?: string; etat?: string; Date?: string; date?: string; [k: string]: unknown };

const CREDS_KEY = "eagle_creds";

async function eagleCall(action: string, creds: Creds, extra: Record<string, unknown> = {}) {
  const res = await fetch("/api/eagle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, tk: creds.tk, sk: creds.sk, ...extra }),
  });
  return res.json();
}

const statusColor: Record<string, string> = {
  "Livré": "bg-emerald-50 text-emerald-600",
  "En cours": "bg-blue-50 text-blue-600",
  "Retourné": "bg-red-50 text-red-500",
  "En attente": "bg-amber-50 text-amber-600",
};

function statusStyle(s: string) {
  for (const [k, v] of Object.entries(statusColor)) {
    if (s?.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return "bg-slate-100 text-slate-500";
}

export default function EaglePage() {
  const [creds, setCreds] = useState<Creds>({ tk: "", sk: "" });
  const [savedCreds, setSavedCreds] = useState<Creds | null>(null);
  const [tab, setTab] = useState<"config" | "packages" | "add" | "track" | "cities">("config");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Package list
  const [packages, setPackages] = useState<Colis[]>([]);
  // Cities
  const [cities, setCities] = useState<City[]>([]);
  const [citySearch, setCitySearch] = useState("");
  // Track
  const [trackCode, setTrackCode] = useState("");
  const [trackResult, setTrackResult] = useState<{ Etat: string; Date_Evenement: string }[]>([]);
  // Add form
  const [form, setForm] = useState({ fullname: "", phone: "", city: "", address: "", price: "", product: "", qty: "1", note: "", change: "0", openpackage: "0" });
  const [addResult, setAddResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => {
      const c = d?.settings?.eagle;
      if (c?.tk) { setSavedCreds(c); setCreds(c); }
    }).catch(() => {});
  }, []);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function saveCreds() {
    if (!creds.tk || !creds.sk) { showToast("Token et Secret Key requis.", false); return; }
    await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eagle: creds }) });
    setSavedCreds(creds);
    showToast("Identifiants sauvegardés ✓");
  }

  const loadPackages = useCallback(async () => {
    if (!savedCreds) return;
    setLoading(true);
    const data = await eagleCall("list", savedCreds);
    setLoading(false);
    if (Array.isArray(data)) setPackages(data);
    else if (data.message) showToast(data.message, false);
  }, [savedCreds]);

  const loadCities = useCallback(async () => {
    setLoading(true);
    const data = await eagleCall("cities", { tk: "", sk: "" });
    setLoading(false);
    if (Array.isArray(data)) setCities(data);
  }, []);

  useEffect(() => {
    if (tab === "packages" && savedCreds) loadPackages();
    if (tab === "cities" && cities.length === 0) loadCities();
  }, [tab, savedCreds, loadPackages, loadCities, cities.length]);

  async function handleTrack() {
    if (!trackCode.trim()) { showToast("Entrez un code de suivi.", false); return; }
    setLoading(true);
    const data = await eagleCall("track", { tk: "", sk: "" }, { code: trackCode.trim() });
    setLoading(false);
    if (Array.isArray(data)) setTrackResult(data);
    else showToast(data.message || "Code introuvable.", false);
  }

  async function handleAdd() {
    if (!savedCreds) { showToast("Configurez vos identifiants d'abord.", false); return; }
    const required = ["fullname", "phone", "city", "address", "price", "product", "qty"];
    if (required.some(k => !form[k as keyof typeof form])) { showToast("Remplissez tous les champs obligatoires.", false); return; }
    setLoading(true);
    const data = await eagleCall("add", savedCreds, { ...form });
    setLoading(false);
    if (data.message?.toLowerCase().includes("success")) {
      setAddResult(data.message);
      showToast("Colis ajouté avec succès ✓");
      setForm({ fullname: "", phone: "", city: "", address: "", price: "", product: "", qty: "1", note: "", change: "0", openpackage: "0" });
    } else {
      showToast(data.message || "Erreur lors de l'ajout.", false);
    }
  }

  const isConnected = !!savedCreds?.tk;
  const filteredCities = cities.filter(c => String(c.City ?? "").toLowerCase().includes(citySearch.toLowerCase()));

  const tabs = [
    { key: "config", label: "Config" },
    { key: "add", label: "+ Ajouter colis" },
    { key: "packages", label: `Mes colis${packages.length ? ` (${packages.length})` : ""}` },
    { key: "track", label: "Tracking" },
    { key: "cities", label: `Villes & Tarifs` },
  ] as const;

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-md shadow-amber-200">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Eagle Express</h1>
              <p className="text-sm text-slate-400">eagleexpress.ma · Livraison COD Maroc</p>
            </div>
          </div>
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${isConnected ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-amber-500"}`} />
            {isConnected ? "Connecté" : "Non configuré"}
          </span>
        </header>

        <main className="flex-1 p-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${tab === t.key ? "bg-amber-500 text-white shadow-md shadow-amber-200" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Config */}
          {tab === "config" && (
            <div className="max-w-lg space-y-5">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h2 className="font-bold text-slate-900 mb-1">Identifiants Eagle Express</h2>
                <p className="text-xs text-slate-400 mb-5">Trouvez votre Token et Secret Key dans votre profil Eagle Express (Mon profile).</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Token (tk)</label>
                    <input type="text" placeholder="Votre token Eagle Express"
                      value={creds.tk}
                      onChange={e => setCreds(c => ({ ...c, tk: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-50 font-mono" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Secret Key (sk)</label>
                    <input type="password" placeholder="Votre secret key"
                      value={creds.sk}
                      onChange={e => setCreds(c => ({ ...c, sk: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-50 font-mono" />
                  </div>
                </div>
                <button onClick={saveCreds}
                  className="mt-4 w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm rounded-xl shadow-md shadow-amber-200 transition-colors">
                  Sauvegarder
                </button>
              </div>

              {isConnected && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                  <p className="text-sm font-bold text-emerald-700 mb-1">✓ Identifiants enregistrés</p>
                  <p className="text-xs text-emerald-600">tk: {savedCreds!.tk.slice(0, 6)}••••• · sk: ••••••</p>
                  <p className="text-xs text-emerald-500 mt-1">Vous pouvez maintenant ajouter des colis, les lister et faire du tracking.</p>
                </div>
              )}
            </div>
          )}

          {/* Add package */}
          {tab === "add" && (
            <div className="max-w-xl">
              {!isConnected && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 text-sm text-amber-700 font-medium">
                  <AlertTriangle size={15} className="inline mr-1 text-amber-600" />Configurez vos identifiants d&apos;abord dans l&apos;onglet Config.
                </div>
              )}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h2 className="font-bold text-slate-900 mb-5">Nouveau colis</h2>
                {addResult && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 text-sm text-emerald-700 font-medium">{addResult}</div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "fullname", label: "Nom complet *", placeholder: "Ex: Youssef Alami", full: true },
                    { key: "phone", label: "Téléphone *", placeholder: "Ex: 0612345678" },
                    { key: "city", label: "Ville *", placeholder: "Ex: Casablanca" },
                    { key: "address", label: "Adresse *", placeholder: "Ex: 12 Rue Hassan II", full: true },
                    { key: "product", label: "Produit *", placeholder: "Ex: Montre Sport Pro", full: true },
                    { key: "qty", label: "Quantité *", placeholder: "1" },
                    { key: "price", label: "Prix COD (MAD) *", placeholder: "Ex: 350" },
                    { key: "note", label: "Note", placeholder: "Optionnel" },
                  ].map(({ key, label, placeholder, full }) => (
                    <div key={key} className={full ? "col-span-2" : ""}>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
                      <input type="text" placeholder={placeholder}
                        value={form[key as keyof typeof form]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-50" />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Échange</label>
                    <select value={form.change} onChange={e => setForm(f => ({ ...f, change: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-amber-400">
                      <option value="0">Non</option>
                      <option value="1">Oui</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Ouverture colis</label>
                    <select value={form.openpackage} onChange={e => setForm(f => ({ ...f, openpackage: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-amber-400">
                      <option value="0">Non</option>
                      <option value="1">Oui</option>
                    </select>
                  </div>
                </div>
                <button onClick={handleAdd} disabled={loading || !isConnected}
                  className="mt-5 w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-md shadow-amber-200 transition-colors">
                  {loading ? "Ajout en cours…" : "Ajouter le colis"}
                </button>
              </div>
            </div>
          )}

          {/* Packages list */}
          {tab === "packages" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Mes colis</h2>
                <button onClick={loadPackages} disabled={loading}
                  className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  {loading ? "Chargement…" : "↻ Actualiser"}
                </button>
              </div>
              {!isConnected ? (
                <p className="px-6 py-10 text-center text-sm text-amber-600">Configurez vos identifiants d&apos;abord.</p>
              ) : packages.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-400">{loading ? "Chargement…" : "Aucun colis trouvé."}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-50">
                      {["Code","Client","Ville","Produit","Prix COD","Statut"].map(h => (
                        <th key={h} className="text-left px-5 py-3 font-semibold uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((p, i) => (
                      <tr key={p.Code ?? p.code ?? i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{p.Code ?? p.code ?? "—"}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-slate-800">{p.Full_Name ?? p.fullname ?? p.nom ?? "—"}</p>
                          <p className="text-xs text-slate-400">{p.Phone ?? p.phone ?? p.telephone ?? ""}</p>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">{p.City ?? p.city ?? p.ville ?? "—"}</td>
                        <td className="px-5 py-3.5 text-slate-600 max-w-[150px] truncate">{p.Product ?? p.product ?? p.produit ?? "—"}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-800">{p.COD ?? p.price ?? p.prix ?? "—"} MAD</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusStyle(String(p.Status ?? p.State ?? p.state ?? p.etat ?? ""))}`}>
                            {String(p.Status ?? p.State ?? p.state ?? p.etat ?? "—")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Track */}
          {tab === "track" && (
            <div className="max-w-lg space-y-5">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h2 className="font-bold text-slate-900 mb-4">Suivre un colis</h2>
                <div className="flex gap-2">
                  <input type="text" placeholder="Code de suivi Eagle Express"
                    value={trackCode}
                    onChange={e => setTrackCode(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleTrack()}
                    className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-50 font-mono" />
                  <button onClick={handleTrack} disabled={loading}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-amber-200 transition-colors disabled:opacity-50">
                    {loading ? "…" : "Suivre"}
                  </button>
                </div>
              </div>

              {trackResult.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="font-bold text-slate-900 mb-4">Historique du colis <span className="text-amber-500 font-mono">{trackCode}</span></h3>
                  <div className="relative pl-5">
                    <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-slate-100" />
                    {trackResult.map((e, i) => (
                      <div key={i} className="relative mb-5 last:mb-0">
                        <div className="absolute -left-3 top-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white" />
                        <p className="text-sm font-semibold text-slate-800">{e.Etat}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{e.Date_Evenement}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cities */}
          {tab === "cities" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <h2 className="font-bold text-slate-900">Villes & Tarifs</h2>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">{cities.length} villes</span>
                <input type="text" placeholder="Rechercher une ville…"
                  value={citySearch}
                  onChange={e => setCitySearch(e.target.value)}
                  className="ml-auto w-56 text-sm border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-amber-400" />
              </div>
              {loading && cities.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-400">Chargement…</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-50">
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-wide">Ville</th>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-wide">Livraison</th>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-wide">Retour</th>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-wide">Refus</th>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-wide">Échange</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCities.map((c, i) => (
                      <tr key={c.ID ?? i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-800">{String(c.City ?? "—")}</td>
                        <td className="px-5 py-3">
                          <span className="bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-lg">
                            {String(c.Delivered_Fees ?? "—")} MAD
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="bg-red-50 text-red-600 text-xs font-bold px-2.5 py-1 rounded-lg">
                            {String(c.Returned_Fees ?? "—")} MAD
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2.5 py-1 rounded-lg">
                            {String(c.Refused_Fees ?? "—")} MAD
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-1 rounded-lg">
                            {String(c.Changed_Fees ?? "—")} MAD
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold transition-all ${toast.ok ? "bg-emerald-600 text-white" : "bg-red-500 text-white"}`}>
          {toast.ok ? "✓" : "✕"} {toast.msg}
        </div>
      )}
    </div>
  );
}
