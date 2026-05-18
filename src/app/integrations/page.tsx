"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";

/* ── types ── */
type LFOrder = { id: string; order_number: number; status: string; financial_status: string; total_price: string; currency: string; customer_name: string; customer_phone: string; city: string; product: string; quantity: number; funnel: string; received_at: string };
type Creds = { apiId: string; apiKey: string };
type EagleCreds = { tk: string; sk: string };
type Parcel = Record<string, unknown>;

/* ── server settings helper ── */
async function patchSettings(patch: Record<string, unknown>) {
  await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
}

/* ── helpers ── */
async function ameexCall(action: string, c: Creds, extra: Record<string, unknown> = {}) {
  const r = await fetch("/api/ameex", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, apiId: c.apiId, apiKey: c.apiKey, ...extra }) });
  return r.json();
}
async function eagleCall(action: string, c: EagleCreds, extra: Record<string, unknown> = {}) {
  const r = await fetch("/api/eagle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, tk: c.tk, sk: c.sk, ...extra }) });
  return r.json();
}

function Badge({ connected }: { connected: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${connected ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
      {connected ? "Connecté" : "Non configuré"}
    </span>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0 ${copied ? "bg-emerald-100 text-emerald-600" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}>
      {copied ? "✓ Copié" : "Copier"}
    </button>
  );
}

function Toast({ toast }: { toast: { msg: string; ok: boolean } | null }) {
  if (!toast) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold ${toast.ok ? "bg-emerald-600 text-white" : "bg-red-500 text-white"}`}>
      {toast.ok ? "✓" : "✕"} {toast.msg}
    </div>
  );
}

function LogoAvatar({ logo, fallback, color, size = "sm" }: { logo?: string; fallback: string; color: string; size?: "sm" | "lg" }) {
  const [err, setErr] = useState(false);
  const dim = size === "lg" ? "w-10 h-10" : "w-8 h-8";
  const radius = size === "lg" ? "rounded-xl" : "rounded-lg";
  if (logo && !err) {
    return (
      <div className={`${dim} ${radius} bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm`}>
        <img src={logo} onError={() => setErr(true)} alt={fallback} className={size === "lg" ? "w-7 h-7" : "w-5 h-5"} style={{ objectFit: "contain" }} />
      </div>
    );
  }
  return (
    <div className={`${dim} ${radius} ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {fallback}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   INTEGRATION CARDS (left panel)
═══════════════════════════════════════════════════════ */
const INTEGRATIONS = [
  { id: "lightfunnels",   label: "Lightfunnels",    category: "source",   color: "bg-orange-500",  desc: "Webhook order/created v2",    logo: "https://lightfunnels.com/favicon.ico" },
  { id: "shopify",        label: "Shopify",          category: "source",   color: "bg-emerald-600", desc: "Webhook orders/create",        logo: "https://www.shopify.com/favicon.ico" },
  { id: "ameex",          label: "Ameex",            category: "shipping", color: "bg-blue-700",    desc: "API · ameex.ma",               logo: "https://ameex.ma/favicon.ico" },
  { id: "eagle",          label: "Eagle Express",    category: "shipping", color: "bg-amber-500",   desc: "API · eagleexpress.ma",        logo: "https://eagleexpress.ma/favicon.ico" },
  { id: "facebook-ads",   label: "Facebook Ads",     category: "ads",      color: "bg-blue-600",    desc: "Graph API · Meta Business",    logo: "https://www.facebook.com/favicon.ico" },
  { id: "tiktok-ads",     label: "TikTok Ads",       category: "ads",      color: "bg-slate-900",   desc: "Marketing API · TikTok",       logo: "https://www.tiktok.com/favicon.ico" },
];

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════ */
export default function IntegrationsPage() {
  const [active, setActive] = useState<string>("lightfunnels");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); }

  /* Ameex state */
  type AmeexCreds = Creds & { defaultType?: string; depotId?: string };
  const [ameex, setAmeex] = useState<AmeexCreds>({ apiId: "", apiKey: "", defaultType: "SIMPLE", depotId: "" });
  const [ameexSaved, setAmeexSaved] = useState<AmeexCreds | null>(null);
  const [ameexParcels, setAmeexParcels] = useState<Parcel[]>([]);
  const [ameexForm, setAmeexForm] = useState({ receiver: "", phone: "", city: "", address: "", cod: "", product: "", order_num: "", comment: "", type: "SIMPLE", open: "NO", try: "NO", fragile: "0", replace: "false" });
  const [ameexTab, setAmeexTab] = useState<"config"|"add"|"parcels"|"track"|"cities"|"stock">("config");
  const [ameexTrack, setAmeexTrack] = useState(""); const [ameexTrackRes, setAmeexTrackRes] = useState<Parcel | null>(null);
  const [ameexCities, setAmeexCities] = useState<Parcel[]>([]); const [ameexCitySearch, setAmeexCitySearch] = useState(""); const [ameexCitiesRaw, setAmeexCitiesRaw] = useState<string>("");
  const [ameexStockDebug, setAmeexStockDebug] = useState<{ depots: string; products: string; trackCode: string; trackResult: string }>({ depots: "", products: "", trackCode: "", trackResult: "" });

  /* Eagle state */
  const [eagle, setEagle] = useState<EagleCreds>({ tk: "", sk: "" });
  const [eagleSaved, setEagleSaved] = useState<EagleCreds | null>(null);
  const [eagleParcels, setEagleParcels] = useState<Parcel[]>([]);
  const [eagleForm, setEagleForm] = useState({ fullname: "", phone: "", city: "", address: "", price: "", product: "", qty: "1", note: "", change: "0", openpackage: "0" });
  const [eagleTab, setEagleTab] = useState<"config"|"add"|"parcels"|"track"|"cities">("config");
  const [eagleTrack, setEagleTrack] = useState(""); const [eagleTrackRes, setEagleTrackRes] = useState<{ Etat: string; Date_Evenement: string }[]>([]);
  const [eagleCities, setEagleCities] = useState<Parcel[]>([]); const [citySearch, setCitySearch] = useState("");
  const [eagleApiStatus, setEagleApiStatus] = useState<"unknown"|"ok"|"broken">("unknown");
  const [eagleApiTesting, setEagleApiTesting] = useState(false);

  /* LF state */
  const [lfOrders, setLfOrders] = useState<LFOrder[]>([]);
  const [lfEvents, setLfEvents] = useState(0);
  const [lfTab, setLfTab] = useState<"setup"|"orders">("setup");
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>("");
  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/lightfunnels${currentWorkspaceId ? `?uid=${currentWorkspaceId}` : ""}`
    : "https://yourapp.com/api/webhooks/lightfunnels";

  /* Shopify state */
  const [shopify, setShopify] = useState({ store: "", apiKey: "" });
  const [shopifySaved, setShopifySaved] = useState<{ store: string; apiKey: string } | null>(null);

  /* Facebook Ads state */
  const [fbAds, setFbAds] = useState({ accessToken: "", adAccountId: "" });
  const [fbAdsSaved, setFbAdsSaved] = useState<{ accessToken: string; adAccountId: string } | null>(null);

  /* TikTok Ads state */
  const [tiktokAds, setTiktokAds] = useState({ accessToken: "", advertiserId: "" });
  const [tiktokAdsSaved, setTiktokAdsSaved] = useState<{ accessToken: string; advertiserId: string } | null>(null);

  /* Load settings from server (per-user, not localStorage) */
  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => {
      const s = d.settings ?? {};
      if (s.ameex)            { setAmeexSaved(s.ameex);         setAmeex(s.ameex); }
      if (s.eagle)            { setEagleSaved(s.eagle);          setEagle(s.eagle); }
      if (s.shopify)          { setShopifySaved(s.shopify);      setShopify(s.shopify); }
      if (s.facebook)         { setFbAdsSaved(s.facebook);       setFbAds(s.facebook); }
      if (s.tiktok)           { setTiktokAdsSaved(s.tiktok);     setTiktokAds(s.tiktok); }
    }).catch(() => {});
    fetch("/api/auth/me").then(r => r.json()).then(d => { if (d.workspaceId) setCurrentWorkspaceId(d.workspaceId); else if (d.id) setCurrentWorkspaceId(d.id); }).catch(() => {});
  }, []);

  /* LF polling */
  const fetchLF = useCallback(async () => {
    try { const d = await (await fetch("/api/lf-orders")).json(); setLfOrders(d.orders ?? []); setLfEvents(d.events ?? 0); } catch { /* silent */ }
  }, []);
  useEffect(() => { fetchLF(); const t = setInterval(fetchLF, 5000); return () => clearInterval(t); }, [fetchLF]);

  const [loading, setLoading] = useState(false);

  /* Ameex actions */
  function saveAmeex() { if (!ameex.apiId || !ameex.apiKey) { showToast("API ID et API Key requis.", false); return; } patchSettings({ ameex }).then(() => { setAmeexSaved(ameex); showToast("Ameex connecté ✓"); }); }
  const loadAmeexParcels = useCallback(async () => { if (!ameexSaved) return; setLoading(true); const d = await ameexCall("listParcels", ameexSaved); setLoading(false); if (Array.isArray(d)) setAmeexParcels(d); else if (d?.data) setAmeexParcels(d.data); }, [ameexSaved]);
  const loadAmeexCities = useCallback(async () => {
    if (!ameexSaved) { showToast("Configurez Ameex d'abord.", false); return; }
    setLoading(true);
    const d = await ameexCall("cities", ameexSaved);
    setLoading(false);
    setAmeexCitiesRaw(JSON.stringify(d, null, 2));
    // Ameex returns cities as an object keyed by ID: {"api":{"cities":{"1":{...},"2":{...}}}}
    const raw: unknown[] = Array.isArray(d) ? d
      : d?.api?.cities && typeof d.api.cities === "object" && !Array.isArray(d.api.cities)
        ? Object.values(d.api.cities as Record<string, unknown>)
      : Array.isArray(d?.api?.cities) ? d.api.cities
      : Array.isArray(d?.api?.data) ? d.api.data
      : Array.isArray(d?.data) ? d.data
      : Array.isArray(d?.cities) ? d.cities
      : Array.isArray(d?.result) ? d.result
      : [];
    const parsedCities = raw.map((c) => { const r = c as Record<string,unknown>; return { id: String(r.id ?? r.city_id ?? ""), name: String(r.name ?? r.city_name ?? r.ville ?? "") }; }).filter(c => c.id && c.name);
    if (parsedCities.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAmeexCities(parsedCities as any);
      // Also cache in localStorage for commandes page
      try { localStorage.setItem("codcrm_ameex_cities", JSON.stringify(parsedCities)); } catch { /* */ }
    }
  }, [ameexSaved]);
  async function addAmeex() { if (!ameexSaved) { showToast("Configurez Ameex d'abord.", false); return; } if (!ameexForm.receiver || !ameexForm.phone || !ameexForm.city || !ameexForm.address || !ameexForm.cod) { showToast("Champs obligatoires manquants.", false); return; } setLoading(true); const d = await ameexCall("addParcel", ameexSaved, { ...ameexForm }); setLoading(false); const nested = d?.api?.data ?? d?.data ?? null; const trackCode = nested?.code ?? nested?.id ?? d?.code ?? d?.id ?? d?.tracking ?? d?.barcode; const ok = trackCode != null || d?.api?.type === "success" || d?.status === "success"; const errMsg = d?.api?.msg ?? d?.message ?? JSON.stringify(d); const label = ok ? `Colis créé ✓ — ${trackCode ?? d?.api?.msg ?? "OK"}` : `Erreur: ${errMsg}`; showToast(label, ok); if (ok) setAmeexForm({ receiver: "", phone: "", city: "", address: "", cod: "", product: "", order_num: "", comment: "", type: "SIMPLE", open: "NO", try: "NO", fragile: "0", replace: "false" }); }
  async function trackAmeex() { if (!ameexSaved || !ameexTrack) return; setLoading(true); const d = await ameexCall("trackParcel", ameexSaved, { code: ameexTrack }); setLoading(false); if (d && !d.error) setAmeexTrackRes(d); else showToast(d?.message || "Introuvable.", false); }

  /* Eagle actions */
  function saveEagle() { if (!eagle.tk || !eagle.sk) { showToast("Token et Secret Key requis.", false); return; } patchSettings({ eagle }).then(() => { setEagleSaved(eagle); showToast("Eagle Express connecté ✓"); }); }
  const loadEagleParcels = useCallback(async () => { if (!eagleSaved) return; setLoading(true); const d = await eagleCall("list", eagleSaved); setLoading(false); if (Array.isArray(d)) setEagleParcels(d); }, [eagleSaved]);
  const loadEagleCities = useCallback(async () => { setLoading(true); const d = await eagleCall("cities", { tk: "", sk: "" }); setLoading(false); if (Array.isArray(d)) setEagleCities(d); }, []);
  async function addEagle() {
    if (!eagleSaved) { showToast("Configurez Eagle d'abord.", false); return; }
    if (!eagleForm.fullname || !eagleForm.phone || !eagleForm.city || !eagleForm.address || !eagleForm.price) { showToast("Champs obligatoires manquants.", false); return; }
    setLoading(true);
    const d = await eagleCall("add", eagleSaved, { ...eagleForm });
    setLoading(false);
    const ok = d?.message?.toLowerCase().includes("success");
    // Translate common Eagle API errors to actionable messages
    let msg = d?.message || (ok ? "Colis créé ✓" : "Erreur");
    if (!ok && msg.toLowerCase().includes("parameter")) {
      msg = "API Eagle indisponible — contactez Eagle Express pour réactiver votre accès API (addcolis.php)";
    } else if (!ok && (msg.toLowerCase().includes("permission") || msg.includes("403"))) {
      msg = "Accès refusé — vérifiez vos identifiants API Eagle Express";
    }
    showToast(msg, ok);
    if (ok) setEagleForm({ fullname: "", phone: "", city: "", address: "", price: "", product: "", qty: "1", note: "", change: "0", openpackage: "0" });
  }
  async function trackEagle() { if (!eagleTrack) return; setLoading(true); const d = await eagleCall("track", { tk: "", sk: "" }, { code: eagleTrack }); setLoading(false); if (Array.isArray(d)) setEagleTrackRes(d); else showToast(d?.message || "Introuvable.", false); }
  async function testEagleApiStatus() {
    if (!eagleSaved) return;
    setEagleApiTesting(true);
    try {
      // Test write access by calling add with a dummy payload — a "Some parameter are missing" or 403 means broken
      const d = await eagleCall("add", eagleSaved, { fullname: "_test_", phone: "0600000000", city: "Casablanca", address: "test", price: "1", product: "test", qty: "1", note: "", change: "0", openpackage: "0" });
      const msg = String(d?.message ?? "").toLowerCase();
      if (msg.includes("success")) setEagleApiStatus("ok");
      else if (msg.includes("parameter") || msg.includes("permission") || msg.includes("403")) setEagleApiStatus("broken");
      else setEagleApiStatus("unknown");
    } catch {
      setEagleApiStatus("broken");
    }
    setEagleApiTesting(false);
  }

  /* LF test */
  async function sendLFTest() { const dummy = { id: `test_${Date.now()}`, order_number: Math.floor(Math.random()*9000)+1000, status: "open", financial_status: "pending", total_price: "350.00", currency: "MAD", customer: { first_name: "Test", last_name: "Client", phone: "06 00 00 00 00", email: "test@codcrm.ma" }, shipping_address: { first_name: "Test", last_name: "Client", phone: "06 00 00 00 00", address1: "12 Rue Hassan II", city: "Casablanca" }, line_items: [{ title: "Produit Test", quantity: 1, price: "350.00" }], funnel: { name: "Test Funnel" }, created_at: new Date().toISOString() }; await fetch("/api/webhooks/lightfunnels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dummy) }); setTimeout(fetchLF, 500); setLfTab("orders"); }

  /* Shopify save */
  function saveShopify() { if (!shopify.store || !shopify.apiKey) { showToast("Store URL et API Key requis.", false); return; } patchSettings({ shopify }).then(() => { setShopifySaved(shopify); showToast("Shopify connecté ✓"); }); }

  /* Facebook Ads save */
  function saveFbAds() { if (!fbAds.accessToken || !fbAds.adAccountId) { showToast("Access Token et Ad Account ID requis.", false); return; } patchSettings({ facebook: fbAds }).then(() => { setFbAdsSaved(fbAds); try { localStorage.setItem("fb_ads_creds", JSON.stringify(fbAds)); } catch { /* ignore */ } showToast("Facebook Ads connecté ✓"); }); }

  /* TikTok Ads save */
  function saveTiktokAds() { if (!tiktokAds.accessToken || !tiktokAds.advertiserId) { showToast("Access Token et Advertiser ID requis.", false); return; } patchSettings({ tiktok: tiktokAds }).then(() => { setTiktokAdsSaved(tiktokAds); showToast("TikTok Ads connecté ✓"); }); }

  useEffect(() => {
    if (active === "ameex" && ameexTab === "parcels") loadAmeexParcels();
    if (active === "ameex" && ameexTab === "cities" && ameexCities.length === 0) loadAmeexCities();
  }, [active, ameexTab, loadAmeexParcels, loadAmeexCities, ameexCities.length]);
  useEffect(() => { if (active === "eagle" && eagleTab === "parcels") loadEagleParcels(); if (active === "eagle" && eagleTab === "cities" && eagleCities.length === 0) loadEagleCities(); }, [active, eagleTab, loadEagleParcels, loadEagleCities, eagleCities.length]);

  const connected: Record<string, boolean> = { lightfunnels: lfEvents > 0, shopify: !!shopifySaved?.store, ameex: !!ameexSaved?.apiId, eagle: !!eagleSaved?.tk, "facebook-ads": !!fbAdsSaved?.accessToken, "tiktok-ads": !!tiktokAdsSaved?.accessToken };
  const sources  = INTEGRATIONS.filter(i => i.category === "source");
  const shippers = INTEGRATIONS.filter(i => i.category === "shipping");
  const adsInteg = INTEGRATIONS.filter(i => i.category === "ads");

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Intégrations</h1>
            <p className="text-sm text-slate-400 hidden sm:block">Sources de commandes & sociétés de livraison</p>
          </div>
          <div className="flex items-center gap-2">
            {Object.values(connected).filter(Boolean).length > 0 && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                {Object.values(connected).filter(Boolean).length} connectée(s)
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left panel — integration list */}
          <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-100 p-4 flex flex-col gap-4 lg:gap-6 overflow-y-auto lg:overflow-y-auto max-h-48 lg:max-h-none">
            {[
              { label: "Sources", items: sources },
              { label: "Livraison", items: shippers },
              { label: "Publicité", items: adsInteg },
            ].map(({ label, items }) => (
              <div key={label}>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">{label}</p>
                <div className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0">
                  {items.map(i => (
                    <button key={i.id} onClick={() => setActive(i.id)}
                      className={`flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-2.5 rounded-xl text-sm transition-all text-left shrink-0 lg:shrink ${active === i.id ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50 border border-transparent"}`}>
                      <LogoAvatar logo={i.logo} fallback={i.label[0]} color={i.color} />
                      <div className="min-w-0 hidden lg:block">
                        <p className={`font-semibold text-sm ${active === i.id ? "text-blue-700" : "text-slate-800"}`}>{i.label}</p>
                        <p className="text-xs text-slate-400 truncate">{i.desc}</p>
                      </div>
                      <p className={`font-semibold text-sm lg:hidden ${active === i.id ? "text-blue-700" : "text-slate-800"} whitespace-nowrap`}>{i.label}</p>
                      {connected[i.id] && <span className="w-2 h-2 rounded-full bg-emerald-500 ml-auto shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </aside>

          {/* Right panel */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-8">

            {/* ── LIGHTFUNNELS ── */}
            {active === "lightfunnels" && (
              <div className="max-w-3xl space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <LogoAvatar logo="https://lightfunnels.com/favicon.ico" fallback="L" color="bg-orange-500" size="lg" />
                  <div><h2 className="font-bold text-slate-900 text-lg">Lightfunnels</h2><p className="text-xs text-slate-400">Webhook order/created (v2)</p></div>
                  <Badge connected={connected.lightfunnels} />
                </div>
                <div className="flex gap-2 mb-4">
                  {(["setup","orders"] as const).map(t => (
                    <button key={t} onClick={() => setLfTab(t)} className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${lfTab === t ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>
                      {t === "setup" ? "⚙️ Configuration" : `📦 Commandes (${lfOrders.length})`}
                    </button>
                  ))}
                </div>
                {lfTab === "setup" && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-100 p-5">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">URL Webhook à coller dans Lightfunnels</p>
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                        <code className="flex-1 text-sm text-blue-700 font-mono break-all">{webhookUrl}</code>
                        <CopyBtn text={webhookUrl} />
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-5">
                      <h3 className="font-bold text-slate-800 mb-4">Comment connecter — Commandes achetées</h3>
                      {[
                        "Lightfunnels → Settings → Webhooks → Add new webhook",
                        'Événement : "order/created (v2)"',
                        "Collez l'URL ci-dessus dans le champ URL",
                        'Cliquez "Send dummy" pour tester la connexion',
                      ].map((s, i) => (
                        <div key={i} className="flex gap-3 mb-3 last:mb-0">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{i+1}</span>
                          <p className="text-sm text-slate-600 pt-0.5">{s}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">📵</span>
                        <h3 className="font-bold text-amber-800">Paniers abandonnés (optionnel)</h3>
                      </div>
                      <p className="text-sm text-amber-700 mb-3">Ajoutez un 2ème webhook avec l&apos;événement <strong>checkout/abandoned</strong> sur la même URL pour recevoir les prospects qui n&apos;ont pas finalisé leur commande.</p>
                      {[
                        "Créez un 2ème webhook sur la même URL",
                        'Événement : "checkout/abandoned"',
                        "Les paniers abandonnés apparaîtront dans Funnels & Leads",
                        "Appelez-les pour récupérer la vente !",
                      ].map((s, i) => (
                        <div key={i} className="flex gap-3 mb-2 last:mb-0">
                          <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center shrink-0">{i+1}</span>
                          <p className="text-sm text-amber-700 pt-0.5">{s}</p>
                        </div>
                      ))}
                    </div>
                    <button onClick={sendLFTest} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm rounded-xl shadow-md transition-colors">Envoyer une commande test</button>
                  </div>
                )}
                {lfTab === "orders" && (
                  <div className="bg-white rounded-2xl border border-slate-100">
                    {lfOrders.length === 0 ? (
                      <div className="flex flex-col items-center py-16 gap-3">
                        <p className="text-slate-400 text-sm">En attente de commandes Lightfunnels…</p>
                        <button onClick={sendLFTest} className="bg-orange-500 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-orange-600 transition-colors">Envoyer un test</button>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead><tr className="text-xs text-slate-400 border-b border-slate-50">{["#","Client","Ville","Produit","Total","Funnel","Statut","Reçu"].map(h => <th key={h} className="text-left px-5 py-3 font-semibold uppercase tracking-wide">{h}</th>)}</tr></thead>
                        <tbody>
                          {lfOrders.map(o => (
                            <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                              <td className="px-5 py-3 font-mono text-xs text-slate-400">#{o.order_number || o.id.slice(-5)}</td>
                              <td className="px-5 py-3"><p className="font-semibold text-slate-800">{o.customer_name}</p><p className="text-xs text-slate-400">{o.customer_phone}</p></td>
                              <td className="px-5 py-3 text-slate-500">{o.city || "—"}</td>
                              <td className="px-5 py-3 text-slate-600 max-w-[130px] truncate">{o.product}</td>
                              <td className="px-5 py-3 font-bold text-slate-800">{o.total_price} {o.currency}</td>
                              <td className="px-5 py-3 text-slate-400 text-xs">{o.funnel || "—"}</td>
                              <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-600">{o.financial_status}</span></td>
                              <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(o.received_at).toLocaleString("fr-MA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── SHOPIFY ── */}
            {active === "shopify" && (
              <div className="max-w-lg space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <LogoAvatar logo="https://www.shopify.com/favicon.ico" fallback="S" color="bg-emerald-600" size="lg" />
                  <div><h2 className="font-bold text-slate-900 text-lg">Shopify</h2><p className="text-xs text-slate-400">Webhook orders/create</p></div>
                  <Badge connected={connected.shopify} />
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <h3 className="font-bold text-slate-900 mb-4">Connexion Shopify</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">URL de votre boutique</label>
                      <input type="text" placeholder="Ex: mystore.myshopify.com" value={shopify.store} onChange={e => setShopify(s => ({ ...s, store: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Admin API Access Token</label>
                      <input type="password" placeholder="shpat_xxxx" value={shopify.apiKey} onChange={e => setShopify(s => ({ ...s, apiKey: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 font-mono" />
                    </div>
                  </div>
                  <button onClick={saveShopify} className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-emerald-200 transition-colors">Sauvegarder</button>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <h3 className="font-bold text-slate-800 mb-3">Comment connecter</h3>
                  {["Shopify Admin → Settings → Notifications → Webhooks","Événement : Order creation","URL : " + (typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/shopify` : "https://yourapp.com/api/webhooks/shopify"),"Format : JSON"].map((s,i) => (
                    <div key={i} className="flex gap-3 mb-3 last:mb-0">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{i+1}</span>
                      <p className="text-sm text-slate-600 pt-0.5">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── AMEEX ── */}
            {active === "ameex" && (
              <div className="max-w-2xl space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <LogoAvatar logo="https://ameex.ma/favicon.ico" fallback="A" color="bg-blue-700" size="lg" />
                  <div><h2 className="font-bold text-slate-900 text-lg">Ameex</h2><p className="text-xs text-slate-400">api.ameex.app · C-Api-Id / C-Api-Key</p></div>
                  <Badge connected={connected.ameex} />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(["config","add","parcels","track","cities","stock"] as const).map(t => (
                    <button key={t} onClick={() => setAmeexTab(t)} className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${ameexTab === t ? "bg-blue-700 text-white shadow-md shadow-blue-200" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>
                      {t === "config" ? "⚙️ Config" : t === "add" ? "➕ Ajouter" : t === "parcels" ? `📦 Colis${ameexParcels.length ? ` (${ameexParcels.length})` : ""}` : t === "track" ? "🔍 Track" : t === "cities" ? "🏙️ Villes" : "🏭 Stock Debug"}
                    </button>
                  ))}
                </div>
                {ameexTab === "config" && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-3">
                    {[{key:"apiId",label:"API ID (C-Api-Id)",ph:"Votre API ID"},{key:"apiKey",label:"API Key (C-Api-Key)",ph:"Votre API Key",pw:true}].map(f => (
                      <div key={f.key}><label className="text-xs font-semibold text-slate-600 mb-1 block">{f.label}</label>
                        <input type={f.pw ? "password" : "text"} placeholder={f.ph} value={ameex[f.key as keyof Creds]} onChange={e => setAmeex(c => ({ ...c, [f.key]: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 font-mono" />
                      </div>
                    ))}
                    {/* Ship type preference */}
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-2 block">Mode d&apos;envoi par défaut</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([["SIMPLE","🚚 Ramassage"],["STOCK","🏭 Stock / Hub"]] as const).map(([val, lbl]) => (
                          <button key={val} type="button" onClick={() => setAmeex(c => ({ ...c, defaultType: val }))}
                            className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${(ameex.defaultType ?? "SIMPLE") === val ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Depot ID — only shown for STOCK */}
                    {(ameex.defaultType ?? "SIMPLE") === "STOCK" && (
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">ID du dépôt / Hub Ameex</label>
                        <input type="text" placeholder="Ex: 1 (Casablanca Hub Principal)"
                          value={ameex.depotId ?? ""}
                          onChange={e => setAmeex(c => ({ ...c, depotId: e.target.value }))}
                          className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 font-mono" />
                        <p className="text-xs text-slate-400 mt-1">Trouvez l&apos;ID dans Ameex → Villes ou contactez le support Ameex.</p>
                      </div>
                    )}
                    <button onClick={saveAmeex} className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-200 transition-colors">Sauvegarder</button>
                  </div>
                )}
                {ameexTab === "add" && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <div className="grid grid-cols-2 gap-3">
                      {[{k:"receiver",l:"Destinataire *",ph:"Nom complet",full:true},{k:"phone",l:"Téléphone *",ph:"0612345678"},{k:"city",l:"ID Ville *",ph:"Ex: 1"},{k:"address",l:"Adresse *",ph:"Rue, ville",full:true},{k:"cod",l:"COD (MAD) *",ph:"350"},{k:"product",l:"Produit",ph:"Ex: Montre"},{k:"order_num",l:"N° commande",ph:"Optionnel"},{k:"comment",l:"Commentaire",ph:"Optionnel"}].map(({k,l,ph,full}) => (
                        <div key={k} className={full ? "col-span-2" : ""}>
                          <label className="text-xs font-semibold text-slate-600 mb-1 block">{l}</label>
                          <input type="text" placeholder={ph} value={ameexForm[k as keyof typeof ameexForm]} onChange={e => setAmeexForm(f => ({...f,[k]:e.target.value}))} className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400" />
                        </div>
                      ))}
                      {[{k:"type",l:"Type",o:["SIMPLE","STOCK"]},{k:"open",l:"Ouverture",o:["NO","YES"]},{k:"try",l:"Essayage",o:["NO","YES"]},{k:"fragile",l:"Fragile",o:["0","1"]}].map(({k,l,o}) => (
                        <div key={k}><label className="text-xs font-semibold text-slate-600 mb-1 block">{l}</label>
                          <select value={ameexForm[k as keyof typeof ameexForm]} onChange={e => setAmeexForm(f => ({...f,[k]:e.target.value}))} className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400">{o.map(x => <option key={x}>{x}</option>)}</select>
                        </div>
                      ))}
                    </div>
                    <button onClick={addAmeex} disabled={loading} className="mt-4 w-full py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors">{loading ? "Ajout…" : "Créer le colis"}</button>
                  </div>
                )}
                {ameexTab === "parcels" && (
                  <div className="bg-white rounded-2xl border border-slate-100">
                    <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center"><span className="font-semibold text-slate-800">Colis Ameex</span><button onClick={loadAmeexParcels} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">{loading?"…":"↻ Actualiser"}</button></div>
                    {ameexParcels.length === 0 ? <p className="text-center py-10 text-slate-400 text-sm">{loading?"Chargement…":"Aucun colis."}</p> : (
                      <table className="w-full text-sm"><thead><tr className="text-xs text-slate-400 border-b">{["Code","Destinataire","Produit","COD","Statut"].map(h=><th key={h} className="text-left px-5 py-2 font-semibold uppercase tracking-wide">{h}</th>)}</tr></thead>
                      <tbody>{ameexParcels.map((p,i)=><tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60"><td className="px-5 py-3 font-mono text-xs text-slate-400">{String(p.code??p.barcode??p.id??"—")}</td><td className="px-5 py-3 font-semibold text-slate-800">{String(p.receiver??p.name??"—")}</td><td className="px-5 py-3 text-slate-500 truncate max-w-[120px]">{String(p.product??"—")}</td><td className="px-5 py-3 font-bold">{String(p.cod??p.price??"—")} MAD</td><td className="px-5 py-3"><span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg">{String(p.status??p.state??"—")}</span></td></tr>)}</tbody>
                      </table>
                    )}
                  </div>
                )}
                {ameexTab === "track" && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
                    <div className="flex gap-2">
                      <input type="text" placeholder="Code de suivi Ameex" value={ameexTrack} onChange={e=>setAmeexTrack(e.target.value)} onKeyDown={e=>e.key==="Enter"&&trackAmeex()} className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 font-mono" />
                      <button onClick={trackAmeex} className="px-4 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-xl">{loading?"…":"Suivre"}</button>
                    </div>
                    {ameexTrackRes && <div className="space-y-1">{Object.entries(ameexTrackRes).map(([k,v])=><div key={k} className="flex justify-between text-sm border-b border-slate-50 pb-1"><span className="text-slate-400">{k}</span><span className="font-semibold text-slate-800">{String(v)}</span></div>)}</div>}
                  </div>
                )}
                {ameexTab === "cities" && (
                  <div className="space-y-3">
                    <div className="bg-white rounded-2xl border border-slate-100">
                      <div className="px-5 py-3 border-b flex items-center gap-3 flex-wrap">
                        <span className="font-semibold text-slate-800">Villes Ameex</span>
                        <input type="text" placeholder="Rechercher…" value={ameexCitySearch} onChange={e=>setAmeexCitySearch(e.target.value)} className="w-44 text-sm border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-blue-400" />
                        <button onClick={loadAmeexCities} className="ml-auto text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">{loading?"…":"↻ Actualiser"}</button>
                      </div>
                      {ameexCities.length === 0 ? (
                        <div className="py-10 text-center text-slate-400 text-sm space-y-3">
                          <p>{loading ? "Chargement…" : "Aucune ville retournée par l'API."}</p>
                          {!loading && ameexCitiesRaw && (
                            <details className="text-left mx-5">
                              <summary className="cursor-pointer text-xs text-blue-600 font-semibold">Voir réponse brute de l&apos;API</summary>
                              <pre className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-auto max-h-60 text-slate-700">{ameexCitiesRaw}</pre>
                            </details>
                          )}
                        </div>
                      ) : (
                        <>
                          <table className="w-full text-sm">
                            <thead><tr className="text-xs text-slate-400 border-b"><th className="text-left px-5 py-2 font-semibold uppercase tracking-wide">ID</th><th className="text-left px-5 py-2 font-semibold uppercase tracking-wide">Ville</th><th className="text-left px-5 py-2 font-semibold uppercase tracking-wide">Région</th><th className="text-right px-5 py-2 font-semibold uppercase tracking-wide">Copier</th></tr></thead>
                            <tbody>
                              {ameexCities
                                .filter(c => {
                                  const q = ameexCitySearch.toLowerCase();
                                  return !q || String(c.name??c.city_name??c.ville??"").toLowerCase().includes(q) || String(c.id??c.city_id??"").includes(q);
                                })
                                .map((c,i) => (
                                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                                    <td className="px-5 py-2.5 font-mono text-xs font-bold text-blue-700">{String(c.id??c.city_id??"—")}</td>
                                    <td className="px-5 py-2.5 font-medium text-slate-800">{String(c.name??c.city_name??c.ville??"—")}</td>
                                    <td className="px-5 py-2.5 text-xs text-slate-400">{String(c.region??c.zone??c.area??"")}</td>
                                    <td className="px-5 py-2.5 text-right"><button onClick={()=>{navigator.clipboard.writeText(String(c.id??c.city_id??""));}} className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-semibold">ID</button></td>
                                  </tr>
                                ))
                              }
                            </tbody>
                          </table>
                          {ameexCitiesRaw && (
                            <details className="px-5 pb-3 pt-1">
                              <summary className="cursor-pointer text-xs text-slate-400 hover:text-blue-600">Voir réponse brute</summary>
                              <pre className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-auto max-h-48 text-slate-600">{ameexCitiesRaw}</pre>
                            </details>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
                {ameexTab === "stock" && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
                    <p className="text-sm font-semibold text-slate-700">🔍 Diagnostic Stock Ameex — données brutes de vos colis STOCK existants</p>

                    {/* Step 1: listParcels — see raw data of existing STOCK parcels with hub badge */}
                    <button
                      onClick={async () => {
                        if (!ameexSaved) return;
                        // Try every possible hub/depot param variant to find what works
                        const hub = ameexSaved.depotId || "34";
                        const r = await ameexCall("listParcels", ameexSaved, {
                          type: "STOCK", p_hub: hub, hub, depot: hub, limit: 5, per_page: 5, page: 1,
                        });
                        setAmeexStockDebug(d => ({ ...d, depots: JSON.stringify(r, null, 2) }));
                      }}
                      className="w-full px-4 py-3 bg-blue-700 text-white text-sm font-semibold rounded-xl"
                    >
                      📦 Charger les 5 derniers colis STOCK (listParcels) — voir les champs réels
                    </button>
                    {ameexStockDebug.depots && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Réponse listParcels :</p>
                        <pre className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-auto max-h-80 text-slate-700 whitespace-pre-wrap">{ameexStockDebug.depots}</pre>
                      </div>
                    )}

                    {/* Step 2: stockProducts with no extra params */}
                    <button
                      onClick={async () => {
                        if (!ameexSaved) return;
                        // Try without any extra params first, then with hub
                        const r = await ameexCall("stockProducts", ameexSaved);
                        setAmeexStockDebug(d => ({ ...d, products: JSON.stringify(r, null, 2) }));
                      }}
                      className="w-full px-4 py-3 bg-purple-600 text-white text-sm font-semibold rounded-xl"
                    >
                      📋 Charger produits stock (/Stock/Products — sans paramètre hub)
                    </button>
                    {ameexStockDebug.products && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Réponse stockProducts :</p>
                        <pre className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-auto max-h-80 text-slate-700 whitespace-pre-wrap">{ameexStockDebug.products}</pre>
                      </div>
                    )}

                    {/* Step 3: trackParcel with different field variants */}
                    <div className="border-t pt-3 space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tracker un colis STOCK (essayer plusieurs noms de champ) :</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="ex: CSA0526B23336LV6307977"
                          value={ameexStockDebug.trackCode}
                          onChange={e => setAmeexStockDebug(d => ({ ...d, trackCode: e.target.value }))}
                          className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 font-mono"
                        />
                        <button
                          onClick={async () => {
                            if (!ameexSaved || !ameexStockDebug.trackCode) return;
                            const c = ameexStockDebug.trackCode.trim();
                            // Try all known field name variants for tracking code
                            const r = await ameexCall("trackParcel", ameexSaved, {
                              code: c, barcode: c, tracking: c, parcel_code: c, num: c, p_code: c,
                            });
                            setAmeexStockDebug(d => ({ ...d, trackResult: JSON.stringify(r, null, 2) }));
                          }}
                          className="px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-xl"
                        >
                          Tracker
                        </button>
                      </div>
                      {ameexStockDebug.trackResult && (
                        <pre className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-auto max-h-64 text-slate-700 whitespace-pre-wrap">{ameexStockDebug.trackResult}</pre>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── EAGLE EXPRESS ── */}
            {active === "eagle" && (
              <div className="max-w-2xl space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <LogoAvatar logo="https://eagleexpress.ma/favicon.ico" fallback="E" color="bg-amber-500" size="lg" />
                  <div><h2 className="font-bold text-slate-900 text-lg">Eagle Express</h2><p className="text-xs text-slate-400">eagleexpress.ma · Token / Secret Key</p></div>
                  <Badge connected={connected.eagle} />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(["config","add","parcels","track","cities"] as const).map(t => (
                    <button key={t} onClick={() => setEagleTab(t)} className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${eagleTab === t ? "bg-amber-500 text-white shadow-md shadow-amber-200" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>
                      {t === "config" ? "⚙️ Config" : t === "add" ? "➕ Ajouter" : t === "parcels" ? `📦 Colis${eagleParcels.length ? ` (${eagleParcels.length})` : ""}` : t === "track" ? "🔍 Track" : "🏙️ Villes"}
                    </button>
                  ))}
                </div>
                {eagleTab === "config" && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-3">
                    {[{k:"tk",l:"Token (tk)",ph:"Votre token"},{k:"sk",l:"Secret Key (sk)",ph:"Votre secret",pw:true}].map(f=>(
                      <div key={f.k}><label className="text-xs font-semibold text-slate-600 mb-1 block">{f.l}</label>
                        <input type={f.pw?"password":"text"} placeholder={f.ph} value={eagle[f.k as keyof EagleCreds]} onChange={e=>setEagle(c=>({...c,[f.k]:e.target.value}))} className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-amber-400 font-mono" />
                      </div>
                    ))}
                    <button onClick={saveEagle} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm rounded-xl shadow-md shadow-amber-200 transition-colors">Sauvegarder</button>
                    {/* API Status Diagnostic */}
                    {eagleSaved && (
                      <div className={`rounded-xl p-3 text-sm flex items-start gap-3 ${eagleApiStatus === "ok" ? "bg-emerald-50 border border-emerald-200" : eagleApiStatus === "broken" ? "bg-red-50 border border-red-200" : "bg-slate-50 border border-slate-200"}`}>
                        <span className="text-lg shrink-0">{eagleApiStatus === "ok" ? "✅" : eagleApiStatus === "broken" ? "❌" : "🔍"}</span>
                        <div className="flex-1">
                          {eagleApiStatus === "ok" && <p className="font-semibold text-emerald-700">API Eagle Express opérationnelle</p>}
                          {eagleApiStatus === "broken" && (
                            <>
                              <p className="font-semibold text-red-700">API Eagle Express indisponible</p>
                              <p className="text-red-600 text-xs mt-1">
                                L&apos;endpoint <code className="font-mono bg-red-100 px-1 rounded">addcolis.php</code> renvoie une erreur pour toutes les requêtes.
                                Contactez Eagle Express sur WhatsApp <strong>0690666093</strong> ou par email <strong>eagleexpress@gmail.com</strong> pour réactiver votre accès API.
                              </p>
                            </>
                          )}
                          {eagleApiStatus === "unknown" && <p className="text-slate-500">Cliquez &quot;Tester l&apos;API&quot; pour vérifier l&apos;accès à l&apos;endpoint addcolis.php</p>}
                        </div>
                        <button onClick={testEagleApiStatus} disabled={eagleApiTesting} className="shrink-0 text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                          {eagleApiTesting ? "Test…" : "Tester l'API"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {eagleTab === "add" && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <div className="grid grid-cols-2 gap-3">
                      {[{k:"fullname",l:"Nom *",ph:"Nom complet",full:true},{k:"phone",l:"Téléphone *",ph:"0612345678"},{k:"city",l:"Ville *",ph:"Ex: Casablanca"},{k:"address",l:"Adresse *",ph:"Rue, ville",full:true},{k:"price",l:"Prix COD (MAD) *",ph:"350"},{k:"product",l:"Produit",ph:"Ex: Montre"},{k:"qty",l:"Qté",ph:"1"},{k:"note",l:"Note",ph:"Optionnel"}].map(({k,l,ph,full})=>(
                        <div key={k} className={full?"col-span-2":""}><label className="text-xs font-semibold text-slate-600 mb-1 block">{l}</label>
                          <input type="text" placeholder={ph} value={eagleForm[k as keyof typeof eagleForm]} onChange={e=>setEagleForm(f=>({...f,[k]:e.target.value}))} className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-amber-400" /></div>
                      ))}
                      {[{k:"change",l:"Échange",o:["0","1"]},{k:"openpackage",l:"Ouverture",o:["0","1"]}].map(({k,l,o})=>(
                        <div key={k}><label className="text-xs font-semibold text-slate-600 mb-1 block">{l}</label>
                          <select value={eagleForm[k as keyof typeof eagleForm]} onChange={e=>setEagleForm(f=>({...f,[k]:e.target.value}))} className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none">{o.map(x=><option key={x}>{x}</option>)}</select></div>
                      ))}
                    </div>
                    <button onClick={addEagle} disabled={loading} className="mt-4 w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors">{loading?"Ajout…":"Créer le colis"}</button>
                  </div>
                )}
                {eagleTab === "parcels" && (
                  <div className="bg-white rounded-2xl border border-slate-100">
                    <div className="px-5 py-3 border-b flex justify-between items-center"><span className="font-semibold text-slate-800">Colis Eagle</span><button onClick={loadEagleParcels} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">{loading?"…":"↻ Actualiser"}</button></div>
                    {eagleParcels.length===0 ? <p className="text-center py-10 text-slate-400 text-sm">{loading?"Chargement…":"Aucun colis."}</p> : (
                      <table className="w-full text-sm"><thead><tr className="text-xs text-slate-400 border-b">{["Code","Client","Ville","COD","Statut"].map(h=><th key={h} className="text-left px-5 py-2 font-semibold uppercase tracking-wide">{h}</th>)}</tr></thead>
                      <tbody>{eagleParcels.map((p,i)=><tr key={i} className="border-b hover:bg-slate-50/60"><td className="px-5 py-3 font-mono text-xs text-slate-400">{String(p.code??"—")}</td><td className="px-5 py-3 font-semibold text-slate-800">{String(p.fullname??p.nom??"—")}</td><td className="px-5 py-3 text-slate-500">{String(p.city??p.ville??"—")}</td><td className="px-5 py-3 font-bold">{String(p.price??p.prix??"—")} MAD</td><td className="px-5 py-3"><span className="px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 rounded-lg">{String(p.state??p.etat??"—")}</span></td></tr>)}</tbody>
                      </table>
                    )}
                  </div>
                )}
                {eagleTab === "track" && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
                    <div className="flex gap-2">
                      <input type="text" placeholder="Code de suivi Eagle" value={eagleTrack} onChange={e=>setEagleTrack(e.target.value)} onKeyDown={e=>e.key==="Enter"&&trackEagle()} className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-amber-400 font-mono" />
                      <button onClick={trackEagle} className="px-4 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl">{loading?"…":"Suivre"}</button>
                    </div>
                    {eagleTrackRes.length > 0 && (
                      <div className="relative pl-5"><div className="absolute left-2 top-0 bottom-0 w-0.5 bg-slate-100"/>
                        {eagleTrackRes.map((e,i)=><div key={i} className="relative mb-4 last:mb-0"><div className="absolute -left-3 top-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white"/><p className="text-sm font-semibold text-slate-800">{e.Etat}</p><p className="text-xs text-slate-400">{e.Date_Evenement}</p></div>)}
                      </div>
                    )}
                  </div>
                )}
                {eagleTab === "cities" && (
                  <div className="bg-white rounded-2xl border border-slate-100">
                    <div className="px-5 py-3 border-b flex items-center gap-3">
                      <span className="font-semibold text-slate-800">Villes & Tarifs</span>
                      <input type="text" placeholder="Rechercher…" value={citySearch} onChange={e=>setCitySearch(e.target.value)} className="ml-auto w-48 text-sm border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-amber-400" />
                    </div>
                    {eagleCities.length === 0 ? <p className="text-center py-10 text-slate-400 text-sm">{loading?"Chargement…":"Aucune ville."}</p> : (
                      <table className="w-full text-sm"><thead><tr className="text-xs text-slate-400 border-b"><th className="text-left px-5 py-2 font-semibold uppercase tracking-wide">Ville</th><th className="text-left px-5 py-2 font-semibold uppercase tracking-wide">Tarif</th></tr></thead>
                      <tbody>{eagleCities.filter(c=>String(c.ville??c.city??"").toLowerCase().includes(citySearch.toLowerCase())).map((c,i)=><tr key={i} className="border-b hover:bg-slate-50/60"><td className="px-5 py-2.5 font-medium text-slate-800">{String(c.ville??c.city??"—")}</td><td className="px-5 py-2.5"><span className="bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-lg">{String(c.tarif??c.fee??"—")} MAD</span></td></tr>)}</tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── FACEBOOK ADS ── */}
            {active === "facebook-ads" && (
              <div className="max-w-lg space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <LogoAvatar logo="https://www.facebook.com/favicon.ico" fallback="F" color="bg-blue-600" size="lg" />
                  <div><h2 className="font-bold text-slate-900 text-lg">Facebook Ads</h2><p className="text-xs text-slate-400">Meta Graph API · Importer vos campagnes</p></div>
                  <Badge connected={connected["facebook-ads"]} />
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
                  <h3 className="font-bold text-slate-900">Identifiants Meta Business</h3>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Access Token</label>
                    <input type="password" placeholder="EAAxxxxxxxxx..." value={fbAds.accessToken} onChange={e => setFbAds(c => ({ ...c, accessToken: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 font-mono" />
                    <p className="text-xs text-slate-400 mt-1">Token permanent depuis Meta Business Suite → Paramètres → Accès à l'API</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Ad Account ID</label>
                    <input type="text" placeholder="act_123456789" value={fbAds.adAccountId} onChange={e => setFbAds(c => ({ ...c, adAccountId: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 font-mono" />
                    <p className="text-xs text-slate-400 mt-1">Format : act_XXXXXXXX — visible dans Ads Manager → URL</p>
                  </div>
                  <button onClick={saveFbAds} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-200 transition-colors">Sauvegarder</button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <h3 className="font-bold text-slate-800 mb-4">Comment obtenir votre Access Token</h3>
                  {[
                    "Allez sur business.facebook.com → Paramètres → Accès à l'API",
                    "Créez ou sélectionnez une app → Générez un token avec les permissions ads_read",
                    "Copiez le token et collez-le ci-dessus",
                    "Dans Ads Manager, l'ID du compte apparaît dans l'URL : act_XXXXXXXX",
                  ].map((s, i) => (
                    <div key={i} className="flex gap-3 mb-3 last:mb-0">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{i+1}</span>
                      <p className="text-sm text-slate-600 pt-0.5">{s}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
                  <span className="text-blue-500 text-lg">💡</span>
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Une fois connecté</p>
                    <p className="text-sm text-blue-600">Allez dans <strong>Ads Manager</strong> → bouton <strong>Sync Facebook</strong> pour importer automatiquement vos campagnes et leurs métriques.</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── TIKTOK ADS ── */}
            {active === "tiktok-ads" && (
              <div className="max-w-lg space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <LogoAvatar logo="https://www.tiktok.com/favicon.ico" fallback="T" color="bg-slate-900" size="lg" />
                  <div><h2 className="font-bold text-slate-900 text-lg">TikTok Ads</h2><p className="text-xs text-slate-400">Marketing API · TikTok for Business</p></div>
                  <Badge connected={connected["tiktok-ads"]} />
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
                  <h3 className="font-bold text-slate-900">Identifiants TikTok for Business</h3>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Access Token</label>
                    <input type="password" placeholder="xxxxxxxxxxxxxxxxxxxxxxxx" value={tiktokAds.accessToken} onChange={e => setTiktokAds(c => ({ ...c, accessToken: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-50 font-mono" />
                    <p className="text-xs text-slate-400 mt-1">Token depuis TikTok for Business → Actifs → API Marketing</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Advertiser ID</label>
                    <input type="text" placeholder="7000000000000000000" value={tiktokAds.advertiserId} onChange={e => setTiktokAds(c => ({ ...c, advertiserId: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-50 font-mono" />
                    <p className="text-xs text-slate-400 mt-1">Visible dans TikTok Ads Manager → URL du compte</p>
                  </div>
                  <button onClick={saveTiktokAds} className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl shadow-md transition-colors">Sauvegarder</button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <h3 className="font-bold text-slate-800 mb-4">Comment obtenir votre Access Token</h3>
                  {[
                    "Allez sur ads.tiktok.com → Actifs → API Marketing",
                    "Créez une application et générez un Access Token long terme",
                    "Copiez le token et collez-le ci-dessus",
                    "L'Advertiser ID est visible dans l'URL de votre compte TikTok Ads",
                  ].map((s, i) => (
                    <div key={i} className="flex gap-3 mb-3 last:mb-0">
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">{i+1}</span>
                      <p className="text-sm text-slate-600 pt-0.5">{s}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3">
                  <span className="text-slate-500 text-lg">💡</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Une fois connecté</p>
                    <p className="text-sm text-slate-600">Allez dans <strong>Ads Manager</strong> → bouton <strong>Sync TikTok</strong> pour importer automatiquement vos campagnes et leurs métriques.</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
      <Toast toast={toast} />
    </div>
  );
}
