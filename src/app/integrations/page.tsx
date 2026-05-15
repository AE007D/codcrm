"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";

/* ── types ── */
type LFOrder = { id: string; order_number: number; status: string; financial_status: string; total_price: string; currency: string; customer_name: string; customer_phone: string; city: string; product: string; quantity: number; funnel: string; received_at: string };
type Creds = { apiId: string; apiKey: string };
type EagleCreds = { tk: string; sk: string };
type Parcel = Record<string, unknown>;

/* ── storage keys ── */
const AMEEX_KEY       = "ameex_creds";
const EAGLE_KEY       = "eagle_creds";
const SHOPIFY_KEY     = "shopify_creds";
const FB_ADS_KEY      = "fb_ads_creds";
const TIKTOK_ADS_KEY  = "tiktok_ads_creds";

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
  { id: "lightfunnels", label: "Lightfunnels", category: "source",   color: "bg-orange-500", desc: "Webhook order/created v2", logo: "https://lightfunnels.com/favicon.ico" },
  { id: "shopify",      label: "Shopify",      category: "source",   color: "bg-emerald-600", desc: "Webhook orders/create",  logo: "https://www.shopify.com/favicon.ico" },
  { id: "ameex",        label: "Ameex",        category: "shipping", color: "bg-blue-700",   desc: "API · ameex.ma",          logo: "https://ameex.ma/favicon.ico" },
  { id: "eagle",        label: "Eagle Express",category: "shipping", color: "bg-amber-500",  desc: "API · eagleexpress.ma",   logo: "https://eagleexpress.ma/favicon.ico" },
  { id: "facebook-ads", label: "Facebook Ads", category: "ads",      color: "bg-blue-600",   desc: "Graph API · Meta Business", logo: "https://www.facebook.com/favicon.ico" },
  { id: "tiktok-ads",   label: "TikTok Ads",   category: "ads",      color: "bg-slate-900",  desc: "Marketing API · TikTok",    logo: "https://www.tiktok.com/favicon.ico" },
];

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════ */
export default function IntegrationsPage() {
  const [active, setActive] = useState<string>("lightfunnels");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); }

  /* Ameex state */
  const [ameex, setAmeex] = useState<Creds>({ apiId: "", apiKey: "" });
  const [ameexSaved, setAmeexSaved] = useState<Creds | null>(null);
  const [ameexParcels, setAmeexParcels] = useState<Parcel[]>([]);
  const [ameexForm, setAmeexForm] = useState({ receiver: "", phone: "", city: "", address: "", cod: "", product: "", order_num: "", comment: "", type: "SIMPLE", open: "NO", try: "NO", fragile: "0", replace: "false" });
  const [ameexTab, setAmeexTab] = useState<"config"|"add"|"parcels"|"track">("config");
  const [ameexTrack, setAmeexTrack] = useState(""); const [ameexTrackRes, setAmeexTrackRes] = useState<Parcel | null>(null);

  /* Eagle state */
  const [eagle, setEagle] = useState<EagleCreds>({ tk: "", sk: "" });
  const [eagleSaved, setEagleSaved] = useState<EagleCreds | null>(null);
  const [eagleParcels, setEagleParcels] = useState<Parcel[]>([]);
  const [eagleForm, setEagleForm] = useState({ fullname: "", phone: "", city: "", address: "", price: "", product: "", qty: "1", note: "", change: "0", openpackage: "0" });
  const [eagleTab, setEagleTab] = useState<"config"|"add"|"parcels"|"track"|"cities">("config");
  const [eagleTrack, setEagleTrack] = useState(""); const [eagleTrackRes, setEagleTrackRes] = useState<{ Etat: string; Date_Evenement: string }[]>([]);
  const [eagleCities, setEagleCities] = useState<Parcel[]>([]); const [citySearch, setCitySearch] = useState("");

  /* LF state */
  const [lfOrders, setLfOrders] = useState<LFOrder[]>([]);
  const [lfEvents, setLfEvents] = useState(0);
  const [lfTab, setLfTab] = useState<"setup"|"orders">("setup");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/lightfunnels${currentUserId ? `?uid=${currentUserId}` : ""}`
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

  /* Load from localStorage */
  useEffect(() => {
    const a = localStorage.getItem(AMEEX_KEY); if (a) { const c = JSON.parse(a); setAmeexSaved(c); setAmeex(c); }
    const e = localStorage.getItem(EAGLE_KEY);  if (e) { const c = JSON.parse(e); setEagleSaved(c); setEagle(c); }
    const s = localStorage.getItem(SHOPIFY_KEY); if (s) { const c = JSON.parse(s); setShopifySaved(c); setShopify(c); }
    const fb = localStorage.getItem(FB_ADS_KEY); if (fb) { const c = JSON.parse(fb); setFbAdsSaved(c); setFbAds(c); }
    const tt = localStorage.getItem(TIKTOK_ADS_KEY); if (tt) { const c = JSON.parse(tt); setTiktokAdsSaved(c); setTiktokAds(c); }
  }, []);

  /* Fetch current user ID for personalized webhook URL */
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => { if (d.id) setCurrentUserId(d.id); }).catch(() => {});
  }, []);

  /* LF polling */
  const fetchLF = useCallback(async () => {
    try { const d = await (await fetch("/api/lf-orders")).json(); setLfOrders(d.orders ?? []); setLfEvents(d.events ?? 0); } catch { /* silent */ }
  }, []);
  useEffect(() => { fetchLF(); const t = setInterval(fetchLF, 5000); return () => clearInterval(t); }, [fetchLF]);

  const [loading, setLoading] = useState(false);

  /* Ameex actions */
  function saveAmeex() { if (!ameex.apiId || !ameex.apiKey) { showToast("API ID et API Key requis.", false); return; } localStorage.setItem(AMEEX_KEY, JSON.stringify(ameex)); setAmeexSaved(ameex); showToast("Ameex connecté ✓"); }
  const loadAmeexParcels = useCallback(async () => { if (!ameexSaved) return; setLoading(true); const d = await ameexCall("listParcels", ameexSaved); setLoading(false); if (Array.isArray(d)) setAmeexParcels(d); else if (d?.data) setAmeexParcels(d.data); }, [ameexSaved]);
  async function addAmeex() { if (!ameexSaved) { showToast("Configurez Ameex d'abord.", false); return; } if (!ameexForm.receiver || !ameexForm.phone || !ameexForm.city || !ameexForm.address || !ameexForm.cod) { showToast("Champs obligatoires manquants.", false); return; } setLoading(true); const d = await ameexCall("addParcel", ameexSaved, { ...ameexForm }); setLoading(false); const ok = d?.message?.toLowerCase().includes("success") || d?.success; showToast(d?.message || (ok ? "Colis créé ✓" : "Erreur"), ok); if (ok) setAmeexForm({ receiver: "", phone: "", city: "", address: "", cod: "", product: "", order_num: "", comment: "", type: "SIMPLE", open: "NO", try: "NO", fragile: "0", replace: "false" }); }
  async function trackAmeex() { if (!ameexSaved || !ameexTrack) return; setLoading(true); const d = await ameexCall("trackParcel", ameexSaved, { code: ameexTrack }); setLoading(false); if (d && !d.error) setAmeexTrackRes(d); else showToast(d?.message || "Introuvable.", false); }

  /* Eagle actions */
  function saveEagle() { if (!eagle.tk || !eagle.sk) { showToast("Token et Secret Key requis.", false); return; } localStorage.setItem(EAGLE_KEY, JSON.stringify(eagle)); setEagleSaved(eagle); showToast("Eagle Express connecté ✓"); }
  const loadEagleParcels = useCallback(async () => { if (!eagleSaved) return; setLoading(true); const d = await eagleCall("list", eagleSaved); setLoading(false); if (Array.isArray(d)) setEagleParcels(d); }, [eagleSaved]);
  const loadEagleCities = useCallback(async () => { setLoading(true); const d = await eagleCall("cities", { tk: "", sk: "" }); setLoading(false); if (Array.isArray(d)) setEagleCities(d); }, []);
  async function addEagle() { if (!eagleSaved) { showToast("Configurez Eagle d'abord.", false); return; } if (!eagleForm.fullname || !eagleForm.phone || !eagleForm.city || !eagleForm.address || !eagleForm.price) { showToast("Champs obligatoires manquants.", false); return; } setLoading(true); const d = await eagleCall("add", eagleSaved, { ...eagleForm }); setLoading(false); const ok = d?.message?.toLowerCase().includes("success"); showToast(d?.message || (ok ? "Colis créé ✓" : "Erreur"), ok); if (ok) setEagleForm({ fullname: "", phone: "", city: "", address: "", price: "", product: "", qty: "1", note: "", change: "0", openpackage: "0" }); }
  async function trackEagle() { if (!eagleTrack) return; setLoading(true); const d = await eagleCall("track", { tk: "", sk: "" }, { code: eagleTrack }); setLoading(false); if (Array.isArray(d)) setEagleTrackRes(d); else showToast(d?.message || "Introuvable.", false); }

  /* LF test */
  async function sendLFTest() { const dummy = { id: `test_${Date.now()}`, order_number: Math.floor(Math.random()*9000)+1000, status: "open", financial_status: "pending", total_price: "350.00", currency: "MAD", customer: { first_name: "Test", last_name: "Client", phone: "06 00 00 00 00", email: "test@codcrm.ma" }, shipping_address: { first_name: "Test", last_name: "Client", phone: "06 00 00 00 00", address1: "12 Rue Hassan II", city: "Casablanca" }, line_items: [{ title: "Produit Test", quantity: 1, price: "350.00" }], funnel: { name: "Test Funnel" }, created_at: new Date().toISOString() }; await fetch("/api/webhooks/lightfunnels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dummy) }); setTimeout(fetchLF, 500); setLfTab("orders"); }

  /* Shopify save */
  function saveShopify() { if (!shopify.store || !shopify.apiKey) { showToast("Store URL et API Key requis.", false); return; } localStorage.setItem(SHOPIFY_KEY, JSON.stringify(shopify)); setShopifySaved(shopify); showToast("Shopify connecté ✓"); }

  /* Facebook Ads save */
  function saveFbAds() { if (!fbAds.accessToken || !fbAds.adAccountId) { showToast("Access Token et Ad Account ID requis.", false); return; } localStorage.setItem(FB_ADS_KEY, JSON.stringify(fbAds)); setFbAdsSaved(fbAds); showToast("Facebook Ads connecté ✓"); }

  /* TikTok Ads save */
  function saveTiktokAds() { if (!tiktokAds.accessToken || !tiktokAds.advertiserId) { showToast("Access Token et Advertiser ID requis.", false); return; } localStorage.setItem(TIKTOK_ADS_KEY, JSON.stringify(tiktokAds)); setTiktokAdsSaved(tiktokAds); showToast("TikTok Ads connecté ✓"); }

  useEffect(() => { if (active === "ameex" && ameexTab === "parcels") loadAmeexParcels(); }, [active, ameexTab, loadAmeexParcels]);
  useEffect(() => { if (active === "eagle" && eagleTab === "parcels") loadEagleParcels(); if (active === "eagle" && eagleTab === "cities" && eagleCities.length === 0) loadEagleCities(); }, [active, eagleTab, loadEagleParcels, loadEagleCities, eagleCities.length]);

  const connected: Record<string, boolean> = { lightfunnels: lfEvents > 0, shopify: !!shopifySaved?.store, ameex: !!ameexSaved?.apiId, eagle: !!eagleSaved?.tk, "facebook-ads": !!fbAdsSaved?.accessToken, "tiktok-ads": !!tiktokAdsSaved?.accessToken };
  const sources   = INTEGRATIONS.filter(i => i.category === "source");
  const shippers  = INTEGRATIONS.filter(i => i.category === "shipping");
  const adsInteg  = INTEGRATIONS.filter(i => i.category === "ads");

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
                  {(["config","add","parcels","track"] as const).map(t => (
                    <button key={t} onClick={() => setAmeexTab(t)} className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${ameexTab === t ? "bg-blue-700 text-white shadow-md shadow-blue-200" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>
                      {t === "config" ? "⚙️ Config" : t === "add" ? "➕ Ajouter" : t === "parcels" ? `📦 Colis${ameexParcels.length ? ` (${ameexParcels.length})` : ""}` : "🔍 Track"}
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
