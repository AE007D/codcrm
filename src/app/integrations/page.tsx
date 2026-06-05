"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import { useLang } from "@/lib/i18n";

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
  { id: "eagle",          label: "Eagle Express",    category: "shipping", color: "bg-amber-500",   desc: "API · eagleexpress.ma",        logo: "/eagle-logo.png" },
  { id: "ameex",          label: "Ameex",            category: "shipping", color: "bg-blue-700",    desc: "API · ameex.ma",               logo: "/ameex-logo.png" },
  { id: "facebook-ads",   label: "Facebook Ads",     category: "ads",      color: "bg-blue-600",    desc: "Graph API · Meta Business",    logo: "https://www.facebook.com/favicon.ico" },
  { id: "tiktok-ads",     label: "TikTok Ads",       category: "ads",      color: "bg-slate-900",   desc: "Marketing API · TikTok",       logo: "https://www.tiktok.com/favicon.ico" },
  { id: "telegram-bot",  label: "Telegram Bot",     category: "notif",    color: "bg-blue-500",    desc: "Rapports quotidiens · Alertes", logo: "https://telegram.org/favicon.ico" },
];

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════ */
export default function IntegrationsPage() {
  const { t } = useLang();
  const [active, setActive] = useState<string>("lightfunnels");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); }

  /* Eagle state */
  const [eagle, setEagle] = useState<EagleCreds>({ tk: "", sk: "" });
  const [eagleSaved, setEagleSaved] = useState<EagleCreds | null>(null);
  const [eagleParcels, setEagleParcels] = useState<Parcel[]>([]);
  const [eagleForm, setEagleForm] = useState({ fullname: "", phone: "", city: "", address: "", price: "", product: "", qty: "1", note: "", change: "0", openpackage: "0", stock: "0" });
  const [eagleTab, setEagleTab] = useState<"config"|"add"|"parcels"|"track"|"cities">("config");
  const [eagleTrack, setEagleTrack] = useState(""); const [eagleTrackRes, setEagleTrackRes] = useState<{ Etat: string; Date_Evenement: string }[]>([]);
  const [eagleCities, setEagleCities] = useState<Parcel[]>([]); const [citySearch, setCitySearch] = useState("");
  const [eagleApiStatus, setEagleApiStatus] = useState<"unknown"|"ok"|"broken">("unknown");
  const [eagleApiTesting, setEagleApiTesting] = useState(false);
  const [eagleApiRaw, setEagleApiRaw] = useState<string>("");

  /* Ameex state */
  const [ameex, setAmeex] = useState({ apiId: "", apiKey: "", depotId: "" });
  const [ameexSaved, setAmeexSaved] = useState<{ apiId: string; apiKey: string; depotId: string } | null>(null);
  const [ameexCities, setAmeexCities] = useState<{ id: string; name: string }[]>([]);
  const [ameexCitySearch, setAmeexCitySearch] = useState("");
  const [ameexTab, setAmeexTab] = useState<"config"|"cities">("config");
  function saveAmeex() {
    if (!ameex.apiId || !ameex.apiKey) { showToast("API ID et API Key requis.", false); return; }
    patchSettings({ ameex }).then(() => { setAmeexSaved(ameex); showToast("Ameex connecté ✓"); });
  }
  async function loadAmeexCities() {
    if (!ameexSaved) return;
    const d = await fetch("/api/ameex", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cities", apiId: ameexSaved.apiId, apiKey: ameexSaved.apiKey }) }).then(r => r.json());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: unknown[] = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : Array.isArray(d?.cities) ? d.cities : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cities = list.map((c: any) => ({ id: String(c.id ?? c.ID ?? ""), name: String(c.name ?? c.label ?? c.ville ?? "") })).filter(c => c.name && c.id);
    setAmeexCities(cities);
    if (!cities.length) showToast("Aucune ville trouvée", false);
  }

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

  /* Telegram bot state */
  const [tgBot, setTgBot] = useState({ botToken: "", chatId: "" });
  const [tgBotSaved, setTgBotSaved] = useState<{ botToken: string; chatId: string } | null>(null);

  /* Load settings from server (per-user, not localStorage) */
  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => {
      const s = d.settings ?? {};
      if (s.eagle)            { setEagleSaved(s.eagle);          setEagle(s.eagle); }
      if (s.ameex)            { setAmeexSaved(s.ameex);          setAmeex(s.ameex); }
      if (s.shopify)          { setShopifySaved(s.shopify);      setShopify(s.shopify); }
      if (s.facebook)         { setFbAdsSaved(s.facebook);       setFbAds(s.facebook); }
      if (s.tiktok)           { setTiktokAdsSaved(s.tiktok);     setTiktokAds(s.tiktok); }
      if (s.telegram)         { setTgBotSaved(s.telegram);       setTgBot(s.telegram); }
    }).catch(() => {});
    fetch("/api/auth/me").then(r => r.json()).then(d => { if (d.workspaceId) setCurrentWorkspaceId(d.workspaceId); else if (d.id) setCurrentWorkspaceId(d.id); }).catch(() => {});
  }, []);

  /* LF polling */
  const fetchLF = useCallback(async () => {
    try { const d = await (await fetch("/api/lf-orders")).json(); setLfOrders(d.orders ?? []); setLfEvents(d.events ?? 0); } catch { /* silent */ }
  }, []);
  useEffect(() => { fetchLF(); const t = setInterval(fetchLF, 5000); return () => clearInterval(t); }, [fetchLF]);

  const [loading, setLoading] = useState(false);

  /* Eagle actions */
  function saveEagle() { if (!eagle.tk || !eagle.sk) { showToast("Token et Secret Key requis.", false); return; } patchSettings({ eagle }).then(() => { setEagleSaved(eagle); showToast("Eagle Express connecté ✓"); }); }
  const loadEagleParcels = useCallback(async () => { if (!eagleSaved) return; setLoading(true); const d = await eagleCall("list", eagleSaved); setLoading(false); const list = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : Array.isArray(d?.colis) ? d.colis : []; setEagleParcels(list); }, [eagleSaved]);
  const loadEagleCities = useCallback(async () => {
    if (!eagleSaved) return;
    setLoading(true);
    const d = await eagleCall("cities", eagleSaved);
    setLoading(false);
    const list: unknown[] = Array.isArray(d) ? d
      : Array.isArray(d?.data) ? d.data
      : Array.isArray(d?.cities) ? d.cities
      : Array.isArray(d?.result) ? d.result
      : [];
    if (list.length) {
      setEagleCities(list as Parcel[]);
      // Debug: detect if field names don't match our guesses
      const first = list[0] as Record<string, unknown>;
      const nameVal = first?.name ?? first?.ville ?? first?.Ville ?? first?.city ?? first?.City ??
        first?.city_name ?? first?.designation ?? first?.libelle ?? first?.nom ?? "";
      if (!nameVal) showToast(`Champs reçus: ${Object.keys(first).join(", ")}`, false);
    }
  }, [eagleSaved, showToast]);
  async function addEagle() {
    if (!eagleSaved) { showToast("Configurez Eagle d'abord.", false); return; }
    if (!eagleForm.fullname || !eagleForm.phone || !eagleForm.city || !eagleForm.address || !eagleForm.price) { showToast("Champs obligatoires manquants.", false); return; }
    setLoading(true);
    const d = await eagleCall("add", eagleSaved, { ...eagleForm });
    setLoading(false);
    const ok = d?.message?.toLowerCase().includes("success");
    // Translate common Eagle API errors to actionable messages
    let msg = d?.message || (ok ? "Colis créé ✓" : "Erreur");
    if (!ok && (msg.toLowerCase().includes("permission") || msg.includes("403") || msg.toLowerCase().includes("unauthorized"))) {
      msg = "Accès refusé — vérifiez vos identifiants API Eagle Express";
    }
    showToast(msg, ok);
    if (ok) setEagleForm({ fullname: "", phone: "", city: "", address: "", price: "", product: "", qty: "1", note: "", change: "0", openpackage: "0", stock: "0" });
  }
  async function trackEagle() { if (!eagleTrack) return; setLoading(true); const d = await eagleCall("track", eagleSaved ?? { tk: "", sk: "" }, { code: eagleTrack }); setLoading(false); if (Array.isArray(d) && d.length) setEagleTrackRes(d); else if (d && !Array.isArray(d)) setEagleTrackRes([d as { Etat: string; Date_Evenement: string }]); else showToast("Aucun résultat.", false); }
  async function testEagleApiStatus() {
    if (!eagleSaved) return;
    setEagleApiTesting(true);
    setEagleApiRaw("");
    try {
      // Probe addcolis with a full realistic test order (won't be saved — Eagle rejects incomplete/test orders)
      const d = await eagleCall("add", eagleSaved, {
        code: "TEST-0000",
        fullname: "Test Client",
        phone: "0600000000",
        city: "Casablanca",
        address: "Casablanca",
        price: "1",
        product: "Test",
        qty: "1",
        note: "TEST-0000",
        change: "0",
        openpackage: "0",
        stock: "1",
      });
      const raw = JSON.stringify(d);
      setEagleApiRaw(raw);
      const msg = String(d?.message ?? "").toLowerCase();
      if (msg.includes("success") || msg.includes("added")) {
        setEagleApiStatus("ok");
      } else if (msg.includes("account") && (msg.includes("exist") || msg.includes("disabled"))) {
        setEagleApiStatus("broken");
      } else if (msg.includes("missing") || msg.includes("empty")) {
        // Parameters were received but Eagle still complained — show raw for debug
        setEagleApiStatus("broken");
      } else {
        setEagleApiStatus("ok");
      }
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
  function saveFbAds() { if (!fbAds.accessToken || !fbAds.adAccountId) { showToast("Access Token et Ad Account ID requis.", false); return; } patchSettings({ facebook: fbAds }).then(() => { setFbAdsSaved(fbAds); showToast("Facebook Ads connecté ✓"); }); }

  /* TikTok Ads save */
  function saveTiktokAds() { if (!tiktokAds.accessToken || !tiktokAds.advertiserId) { showToast("Access Token et Advertiser ID requis.", false); return; } patchSettings({ tiktok: tiktokAds }).then(() => { setTiktokAdsSaved(tiktokAds); showToast("TikTok Ads connecté ✓"); }); }
  function saveTgBot() { if (!tgBot.botToken || !tgBot.chatId) { showToast("Bot Token et Chat ID requis.", false); return; } patchSettings({ telegram: tgBot }).then(() => { setTgBotSaved(tgBot); showToast("Telegram Bot connecté ✓"); }); }

  useEffect(() => { if (active === "eagle" && eagleTab === "parcels") loadEagleParcels(); if (active === "eagle" && eagleTab === "cities" && eagleCities.length === 0) loadEagleCities(); }, [active, eagleTab, loadEagleParcels, loadEagleCities, eagleCities.length]);

  const connected: Record<string, boolean> = { lightfunnels: lfEvents > 0, shopify: !!shopifySaved?.store, eagle: !!eagleSaved?.tk, "facebook-ads": !!fbAdsSaved?.accessToken, "tiktok-ads": !!tiktokAdsSaved?.accessToken, "telegram-bot": !!tgBotSaved?.botToken };
  const sources  = INTEGRATIONS.filter(i => i.category === "source");
  const shippers = INTEGRATIONS.filter(i => i.category === "shipping");
  const adsInteg = INTEGRATIONS.filter(i => i.category === "ads");
  const notifInteg = INTEGRATIONS.filter(i => i.category === "notif");

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between sidebar-header-pl">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t("integrations_title")}</h1>
            <p className="text-sm text-slate-400 hidden sm:block">{t("integrations_subtitle")}</p>
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
              { label: t("integ_sources"), items: sources },
              { label: t("integ_shipping"), items: shippers },
              { label: t("integ_ads"), items: adsInteg },
              { label: t("integ_notif"), items: notifInteg },
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
                  <button onClick={saveShopify} className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-emerald-200 transition-colors">{t("save")}</button>
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
                    <button onClick={saveEagle} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm rounded-xl shadow-md shadow-amber-200 transition-colors">{t("save")}</button>
                    {/* API Status Diagnostic */}
                    {eagleSaved && (
                      <div className={`rounded-xl p-3 text-sm flex items-start gap-3 ${eagleApiStatus === "ok" ? "bg-emerald-50 border border-emerald-200" : eagleApiStatus === "broken" ? "bg-red-50 border border-red-200" : "bg-slate-50 border border-slate-200"}`}>
                        <span className="text-lg shrink-0">{eagleApiStatus === "ok" ? "✅" : eagleApiStatus === "broken" ? "❌" : "🔍"}</span>
                        <div className="flex-1">
                          {eagleApiStatus === "ok" && <p className="font-semibold text-emerald-700">API Eagle Express opérationnelle ✓</p>}
                          {eagleApiStatus === "broken" && (
                            <>
                              <p className="font-semibold text-red-700">Erreur addcolis</p>
                              {eagleApiRaw && <p className="text-red-600 text-xs mt-1 font-mono break-all">{eagleApiRaw}</p>}
                              {!eagleApiRaw && <p className="text-red-600 text-xs mt-1">Eagle Express refuse les requêtes — vérifiez vos identifiants.</p>}
                            </>
                          )}
                          {eagleApiStatus === "unknown" && <p className="text-slate-500">Cliquez &quot;Tester l&apos;API&quot; pour diagnostiquer l&apos;endpoint addcolis.php</p>}
                        </div>
                        <button onClick={testEagleApiStatus} disabled={eagleApiTesting} className="shrink-0 text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                          {eagleApiTesting ? "Test…" : t("test_api")}
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
                      <tbody>{eagleParcels.map((p,i)=><tr key={i} className="border-b hover:bg-slate-50/60"><td className="px-5 py-3 font-mono text-xs text-slate-400">{String(p.code??p.barcode??p.tracking??"—")}</td><td className="px-5 py-3 font-semibold text-slate-800">{String(p.fullname??p.client??p.nom??p.name??"—")}</td><td className="px-5 py-3 text-slate-500">{String(p.city??p.ville??p.city_name??"—")}</td><td className="px-5 py-3 font-bold">{String(p.price??p.prix??p.cod??p.montant??"—")} MAD</td><td className="px-5 py-3"><span className="px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 rounded-lg">{String(p.state??p.etat??p.status??"—")}</span></td></tr>)}</tbody>
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
                        {eagleTrackRes.map((e,i)=>{const ev=e as Record<string,unknown>;const label=String(ev.Etat??ev.state??ev.etat??ev.status??ev.statut??ev.message??"—");const date=String(ev.Date_Evenement??ev.date??ev.created_at??ev.datetime??"");return <div key={i} className="relative mb-4 last:mb-0"><div className="absolute -left-3 top-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white"/><p className="text-sm font-semibold text-slate-800">{label}</p>{date&&<p className="text-xs text-slate-400">{date}</p>}</div>;})}
                      </div>
                    )}
                  </div>
                )}
                {eagleTab === "cities" && (
                  <div className="bg-white rounded-2xl border border-slate-100">
                    <div className="px-5 py-3 border-b flex items-center gap-3">
                      <span className="font-semibold text-slate-800">Villes & Tarifs</span>
                      <span className="text-xs bg-amber-50 text-amber-700 font-bold px-2.5 py-1 rounded-lg border border-amber-200">Tarif fixe : 38 MAD</span>
                      <input type="text" placeholder="Rechercher…" value={citySearch} onChange={e=>setCitySearch(e.target.value)} className="ml-auto w-48 text-sm border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-amber-400" />
                    </div>
                    {eagleCities.length === 0 ? <p className="text-center py-10 text-slate-400 text-sm">{loading?"Chargement…":"Aucune ville."}</p> : (
                      <table className="w-full text-sm"><thead><tr className="text-xs text-slate-400 border-b"><th className="text-left px-5 py-2 font-semibold uppercase tracking-wide">Ville</th><th className="text-left px-5 py-2 font-semibold uppercase tracking-wide">Tarif livraison</th></tr></thead>
                      <tbody>{eagleCities.filter(c=>{
                          const r=c as Record<string,unknown>;
                          const n=String(r.name??r.ville??r.Ville??r.city??r.City??r.city_name??r.designation??r.libelle??r.nom??"");
                          return !citySearch||n.toLowerCase().includes(citySearch.toLowerCase());
                        }).map((c,i)=>{
                          const r=c as Record<string,unknown>;
                          const cityName=String(r.name??r.ville??r.Ville??r.city??r.City??r.city_name??r.designation??r.libelle??r.nom??"")||"—";
                          const rawFee=String(r.tarif??r.Tarif??r.fee??r.Fee??r.price??r.prix??r.delivery_fee??r.livraison??r.frais??r.cost??"")||"";
                          const fee = rawFee || "38";
                          return <tr key={i} className="border-b hover:bg-slate-50/60"><td className="px-5 py-2.5 font-medium text-slate-800">{cityName}</td><td className="px-5 py-2.5"><span className="bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-lg">{fee} MAD</span></td></tr>;
                        })}
                        {eagleCities.length > 0 && (() => {
                          const r=eagleCities[0] as Record<string,unknown>;
                          const nameVal=String(r.name??r.ville??r.Ville??r.city??r.City??r.city_name??r.designation??r.libelle??r.nom??"")||"";
                          return !nameVal ? <tr><td colSpan={2} className="px-5 py-2 text-xs text-red-500 font-mono bg-red-50">⚠ Champs reçus: {Object.keys(r).join(", ")}</td></tr> : null;
                        })()}</tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── AMEEX ── */}
            {active === "ameex" && (
              <div className="max-w-lg space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center shrink-0">
                    <img src="/ameex-logo.png" alt="Ameex" className="w-9 h-9 object-contain" />
                  </div>
                  <div><h2 className="font-bold text-slate-900 text-lg">Ameex</h2><p className="text-xs text-slate-400">ameex.ma · API ID / API Key</p></div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                  {(["config", "cities"] as const).map(tab => (
                    <button key={tab} onClick={() => { setAmeexTab(tab); if (tab === "cities" && ameexCities.length === 0) loadAmeexCities(); }}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${ameexTab === tab ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                      {tab === "config" ? "⚙️ Configuration" : `🏙️ Villes (${ameexCities.length})`}
                    </button>
                  ))}
                </div>

                {ameexTab === "config" && (
                  <div className="space-y-4">
                    {ameexSaved && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700">
                        ✅ Ameex connecté
                      </div>
                    )}
                    <div className="space-y-3 bg-slate-50 rounded-2xl p-4 border border-slate-200">
                      {[
                        { key: "apiId", label: "API ID *", placeholder: "Votre API ID Ameex" },
                        { key: "apiKey", label: "API Key *", placeholder: "Votre API Key Ameex" },
                        { key: "depotId", label: "Depot ID (optionnel)", placeholder: "Ex: 34 (Casablanca)" },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="text-xs font-semibold text-slate-600 mb-1 block">{f.label}</label>
                          <input type={f.key === "apiKey" ? "password" : "text"} placeholder={f.placeholder}
                            value={(ameex as Record<string, string>)[f.key] ?? ""}
                            onChange={e => setAmeex(a => ({ ...a, [f.key]: e.target.value }))}
                            className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 font-mono bg-white" />
                        </div>
                      ))}
                    </div>
                    <button onClick={saveAmeex}
                      className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm rounded-xl shadow shadow-blue-200 transition-colors">
                      💾 Sauvegarder Ameex
                    </button>
                  </div>
                )}

                {ameexTab === "cities" && (
                  <div className="space-y-3">
                    {!ameexSaved ? (
                      <p className="text-sm text-slate-400 text-center py-8">Configurez Ameex d&apos;abord</p>
                    ) : (
                      <>
                        <input type="text" placeholder="Rechercher une ville…" value={ameexCitySearch}
                          onChange={e => setAmeexCitySearch(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 bg-white" />
                        <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                          {ameexCities
                            .filter(c => !ameexCitySearch || c.name.toLowerCase().includes(ameexCitySearch.toLowerCase()))
                            .map(c => (
                              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                                <img src="/ameex-logo.png" alt="Ameex" className="w-6 h-4 object-contain shrink-0 opacity-70" />
                                <span className="text-sm font-medium text-slate-800 flex-1">{c.name}</span>
                                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">ID: {c.id}</span>
                              </div>
                            ))}
                          {ameexCities.length === 0 && (
                            <button onClick={loadAmeexCities} className="w-full py-6 text-sm text-blue-600 font-semibold hover:bg-blue-50">
                              Charger les villes →
                            </button>
                          )}
                        </div>
                      </>
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
                  <button onClick={saveFbAds} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-200 transition-colors">{t("save")}</button>
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
                  <button onClick={saveTiktokAds} className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl shadow-md transition-colors">{t("save")}</button>
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

            {active === "telegram-bot" && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500 flex items-center justify-center shadow-md shadow-blue-200">
                    <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
                  </div>
                  <div><h2 className="font-bold text-slate-900 text-lg">Telegram Bot</h2><p className="text-xs text-slate-400">Rapports quotidiens · Alertes nouvelles commandes</p></div>
                  <Badge connected={connected["telegram-bot"]} />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
                  <p className="font-semibold mb-1">Comment créer un bot Telegram :</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Ouvrez Telegram → cherchez <strong>@BotFather</strong></li>
                    <li>Tapez <strong>/newbot</strong> et suivez les instructions</li>
                    <li>Copiez le <strong>Bot Token</strong> fourni</li>
                    <li>Envoyez un message à votre bot, puis allez sur <strong>api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</strong> pour trouver votre <strong>Chat ID</strong></li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Bot Token</label>
                    <input type="password" placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      value={tgBot.botToken} onChange={e => setTgBot(c => ({ ...c, botToken: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 font-mono" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Chat ID</label>
                    <input type="text" placeholder="-1001234567890 ou 123456789"
                      value={tgBot.chatId} onChange={e => setTgBot(c => ({ ...c, chatId: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 font-mono" />
                  </div>
                  <button onClick={saveTgBot} className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-200 transition-colors">{t("save")}</button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3">
                  <span className="text-slate-500 text-lg">💡</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Une fois connecté</p>
                    <p className="text-sm text-slate-600">Allez dans <strong>Finances</strong> → bouton <strong>📨 Rapport Telegram</strong> pour envoyer le résumé du jour sur votre chat.</p>
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
