"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import { useLang } from "@/lib/i18n";
import { AlertTriangle } from "lucide-react";

type Creds = { apiId: string; apiKey: string };
const CREDS_KEY = "ameex_creds";

async function ameexCall(action: string, creds: Creds, extra: Record<string, unknown> = {}) {
  const res = await fetch("/api/ameex", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, apiId: creds.apiId, apiKey: creds.apiKey, ...extra }),
  });
  return res.json();
}

type Parcel = Record<string, unknown>;

const emptyForm = {
  receiver: "", phone: "", city: "", address: "", cod: "",
  product: "", order_num: "", comment: "",
  type: "SIMPLE", open: "NO", try: "NO", fragile: "0",
  replace: "false", exchange_code: "",
};

export default function AmeexPage() {
  const { t } = useLang();
  const [creds, setCreds] = useState<Creds>({ apiId: "", apiKey: "" });
  const [savedCreds, setSavedCreds] = useState<Creds | null>(null);
  const [tab, setTab] = useState<"config" | "add" | "parcels" | "track">("config");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [addResult, setAddResult] = useState<string | null>(null);
  const [trackCode, setTrackCode] = useState("");
  const [trackResult, setTrackResult] = useState<Record<string, unknown> | null>(null);
  const [cities, setCities] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    // Load from server (workspace-isolated), never from localStorage
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => {
      const c = d?.settings?.ameex;
      if (c?.apiId) { setSavedCreds(c); setCreds(c); }
    }).catch(() => {});
  }, []);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function saveCreds() {
    if (!creds.apiId || !creds.apiKey) { showToast("API ID et API Key requis.", false); return; }
    await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ameex: creds }) });
    setSavedCreds(creds);
    showToast("Identifiants sauvegardés ✓");
  }

  const loadParcels = useCallback(async () => {
    if (!savedCreds) return;
    setLoading(true);
    const data = await ameexCall("listParcels", savedCreds);
    setLoading(false);
    if (Array.isArray(data)) setParcels(data);
    else if (data?.data && Array.isArray(data.data)) setParcels(data.data);
    else if (data?.message) showToast(data.message, false);
  }, [savedCreds]);

  const loadCities = useCallback(async () => {
    if (!savedCreds) return;
    setLoading(true);
    const data = await ameexCall("cities", savedCreds);
    setLoading(false);
    if (Array.isArray(data)) setCities(data);
    else if (data?.data && Array.isArray(data.data)) setCities(data.data);
  }, [savedCreds]);

  useEffect(() => {
    if (tab === "parcels" && savedCreds) loadParcels();
    if (tab === "add" && cities.length === 0 && savedCreds) loadCities();
  }, [tab, savedCreds, loadParcels, loadCities, cities.length]);

  async function handleAdd() {
    if (!savedCreds) { showToast("Configurez vos identifiants d'abord.", false); return; }
    if (!form.receiver || !form.phone || !form.city || !form.address || !form.cod) {
      showToast("Remplissez tous les champs obligatoires.", false); return;
    }
    setLoading(true); setAddResult(null);
    const data = await ameexCall("addParcel", savedCreds, { ...form });
    setLoading(false);
    const msg = data?.message ?? data?.msg ?? JSON.stringify(data);
    const ok = msg?.toLowerCase().includes("success") || data?.status === "success" || data?.success;
    if (ok) {
      setAddResult(msg);
      showToast("Colis ajouté avec succès ✓");
      setForm(emptyForm);
    } else {
      showToast(msg || "Erreur lors de l'ajout.", false);
    }
  }

  async function handleTrack() {
    if (!trackCode.trim()) { showToast("Entrez un code de suivi.", false); return; }
    if (!savedCreds) { showToast("Configurez vos identifiants d'abord.", false); return; }
    setLoading(true); setTrackResult(null);
    const data = await ameexCall("trackParcel", savedCreds, { code: trackCode.trim() });
    setLoading(false);
    if (data && !data.error) setTrackResult(data);
    else showToast(data?.message || data?.error || "Code introuvable.", false);
  }

  const isConnected = !!savedCreds?.apiId;

  const tabs = [
    { key: "config",  label: t("tab_config") },
    { key: "add",     label: t("tab_add_parcel") },
    { key: "parcels", label: `${t("tab_my_parcels")}${parcels.length ? ` (${parcels.length})` : ""}` },
    { key: "track",   label: t("tab_tracking") },
  ] as const;

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between sidebar-header-pl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{t("ameex_title")}</h1>
              <p className="text-sm text-slate-400">{t("ameex_subtitle")}</p>
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
            {tabs.map(tb => (
              <button key={tb.key} onClick={() => setTab(tb.key)}
                className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${tab === tb.key ? "bg-blue-700 text-white shadow-md shadow-blue-200" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>
                {tb.label}
              </button>
            ))}
          </div>

          {/* Config */}
          {tab === "config" && (
            <div className="max-w-lg space-y-5">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h2 className="font-bold text-slate-900 mb-1">Identifiants Ameex API</h2>
                <p className="text-xs text-slate-400 mb-5">
                  Trouvez votre <strong>API ID</strong> et <strong>API Key</strong> dans votre espace client Ameex → Paramètres → API.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">API ID (C-Api-Id)</label>
                    <input type="text" placeholder="Votre API ID Ameex"
                      value={creds.apiId}
                      onChange={e => setCreds(c => ({ ...c, apiId: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 font-mono" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">API Key (C-Api-Key)</label>
                    <input type="password" placeholder="Votre API Key"
                      value={creds.apiKey}
                      onChange={e => setCreds(c => ({ ...c, apiKey: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 font-mono" />
                  </div>
                </div>
                <button onClick={saveCreds}
                  className="mt-4 w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-200 transition-colors">
                  Sauvegarder
                </button>
              </div>

              {isConnected && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                  <p className="text-sm font-bold text-emerald-700 mb-1">✓ Identifiants enregistrés</p>
                  <p className="text-xs text-emerald-600 font-mono">API ID: {savedCreds!.apiId.slice(0, 6)}•••</p>
                  <p className="text-xs text-emerald-500 mt-1">Vous pouvez maintenant créer des colis et les suivre.</p>
                </div>
              )}

              {/* API info */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Endpoints disponibles</h3>
                <div className="space-y-2">
                  {[
                    { method: "POST", path: "/Delivery/Parcels/Action/Type/Add", label: "Créer un colis" },
                    { method: "GET",  path: "/Delivery/Parcels", label: "Lister les colis" },
                    { method: "GET",  path: "/Delivery/Parcels/Track", label: "Tracking colis" },
                    { method: "GET",  path: "/Delivery/Parcels/Note", label: "Bon de livraison" },
                    { method: "POST", path: "/Pickup/Request", label: "Demande de ramassage" },
                    { method: "GET",  path: "/Delivery/Cities", label: "Villes couvertes" },
                  ].map(e => (
                    <div key={e.path} className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded font-bold font-mono ${e.method === "POST" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{e.method}</span>
                      <code className="text-slate-500 flex-1 truncate">{e.path}</code>
                      <span className="text-slate-400 shrink-0">{e.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Add parcel */}
          {tab === "add" && (
            <div className="max-w-xl">
              {!isConnected && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 text-sm text-amber-700 font-medium">
                  <AlertTriangle size={15} className="inline mr-1 text-amber-600" />Configurez vos identifiants dans l&apos;onglet Config.
                </div>
              )}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h2 className="font-bold text-slate-900 mb-5">{t("new_parcel")}</h2>
                {addResult && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 text-sm text-emerald-700 font-medium">{addResult}</div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "receiver", label: "Nom destinataire *", placeholder: "Ex: Youssef Alami", full: true },
                    { key: "phone",    label: "Téléphone *", placeholder: "Ex: 0612345678" },
                    { key: "city",     label: "ID Ville *", placeholder: "Ex: 1 (Casablanca)" },
                    { key: "address",  label: "Adresse *", placeholder: "Ex: 12 Rue Hassan II", full: true },
                    { key: "cod",      label: "Prix COD (MAD) *", placeholder: "Ex: 350" },
                    { key: "product",  label: "Produit", placeholder: "Ex: Montre Sport" },
                    { key: "order_num", label: "Numéro commande", placeholder: "Optionnel" },
                    { key: "comment",  label: "Commentaire", placeholder: "Optionnel" },
                  ].map(({ key, label, placeholder, full }) => (
                    <div key={key} className={full ? "col-span-2" : ""}>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
                      <input type="text" placeholder={placeholder}
                        value={form[key as keyof typeof emptyForm]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                    </div>
                  ))}

                  {/* Options */}
                  {[
                    { key: "type", label: "Type", options: ["SIMPLE", "STOCK"] },
                    { key: "open", label: "Ouverture", options: ["NO", "YES"] },
                    { key: "try",  label: "Essayage", options: ["NO", "YES"] },
                    { key: "fragile", label: "Fragile", options: ["0", "1"] },
                    { key: "replace", label: "Remplacement", options: ["false", "true"] },
                  ].map(({ key, label, options }) => (
                    <div key={key}>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
                      <select value={form[key as keyof typeof emptyForm]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400">
                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <button onClick={handleAdd} disabled={loading || !isConnected}
                  className="mt-5 w-full py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-200 transition-colors">
                  {loading ? "Ajout en cours…" : "Créer le colis"}
                </button>
              </div>
            </div>
          )}

          {/* Parcels list */}
          {tab === "parcels" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Mes colis Ameex</h2>
                <button onClick={loadParcels} disabled={loading}
                  className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                  {loading ? "Chargement…" : "↻ Actualiser"}
                </button>
              </div>
              {!isConnected ? (
                <p className="px-6 py-10 text-center text-sm text-amber-600">Configurez vos identifiants d&apos;abord.</p>
              ) : parcels.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-400">{loading ? "Chargement…" : "Aucun colis trouvé."}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-50">
                      {["Code","Destinataire","Ville","Produit","COD","Statut"].map(h => (
                        <th key={h} className="text-left px-5 py-3 font-semibold uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parcels.map((p, i) => {
                      const code   = String(p.code ?? p.barcode ?? p.id ?? "—");
                      const name   = String(p.receiver ?? p.recipient ?? p.name ?? "—");
                      const city   = String(p.city ?? p.city_name ?? "—");
                      const prod   = String(p.product ?? p.products ?? "—");
                      const cod    = String(p.cod ?? p.price ?? "—");
                      const status = String(p.status ?? p.state ?? p.etat ?? "—");
                      return (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{code}</td>
                          <td className="px-5 py-3.5 font-semibold text-slate-800">{name}</td>
                          <td className="px-5 py-3.5 text-slate-500">{city}</td>
                          <td className="px-5 py-3.5 text-slate-600 max-w-[140px] truncate">{prod}</td>
                          <td className="px-5 py-3.5 font-bold text-slate-800">{cod} MAD</td>
                          <td className="px-5 py-3.5">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700">{status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Track */}
          {tab === "track" && (
            <div className="max-w-lg space-y-5">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h2 className="font-bold text-slate-900 mb-4">Suivre un colis Ameex</h2>
                <div className="flex gap-2">
                  <input type="text" placeholder="Code de suivi Ameex"
                    value={trackCode}
                    onChange={e => setTrackCode(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleTrack()}
                    className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 font-mono" />
                  <button onClick={handleTrack} disabled={loading}
                    className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200 transition-colors disabled:opacity-50">
                    {loading ? "…" : "Suivre"}
                  </button>
                </div>
              </div>

              {trackResult && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="font-bold text-slate-900 mb-4">
                    Résultat — <span className="text-blue-700 font-mono">{trackCode}</span>
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(trackResult).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-sm border-b border-slate-50 pb-2">
                        <span className="text-slate-400 font-medium capitalize">{k.replace(/_/g, " ")}</span>
                        <span className="font-semibold text-slate-800 text-right max-w-[60%] truncate">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold ${toast.ok ? "bg-emerald-600 text-white" : "bg-red-500 text-white"}`}>
          {toast.ok ? "✓" : "✕"} {toast.msg}
        </div>
      )}
    </div>
  );
}
