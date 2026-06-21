"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Settings, CheckCircle2, PhoneOff, Truck, Undo2, Save, RefreshCw, Package, Bot } from "lucide-react";
import Sidebar from "@/components/Sidebar";

type WAStatus = "disconnected" | "qr" | "connecting" | "connected";
type Lang = "ar" | "fr";
type Tab = "confirm" | "track" | "inbox" | "compose" | "settings";

interface WaMessage {
  id: string;
  from: string;
  text: string;
  media?: { mimetype: string; data: string } | null;
  ts: number;
  fromMe: boolean;
}

interface Conversation {
  phone: string;
  name?: string | null;
  lastMsg: WaMessage | null;
  unread: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawOrder = any;

interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  phone: string;
  city: string;
  product: string;
  amount: number;
  currency: string;
  status: string;
  attempts: number;
  noAnswer: number;
  carrierTracking?: string;
}

function normalizeOrder(o: RawOrder): Order {
  return {
    id: o.id ?? "",
    orderNumber: o.orderNumber ?? o.order_number ?? "",
    customer: o.customer || o.customerName || o.customer_name || "",
    phone: o.phone || o.customerPhone || o.customer_phone || "",
    city: o.city ?? "",
    product: o.product ?? "",
    amount: o.amount ?? o.totalPrice ?? o.total_price ?? 0,
    currency: o.currency ?? "MAD",
    status: o.status ?? "",
    attempts: o.attempts ?? 0,
    noAnswer: o.noAnswer ?? o.no_answer ?? 0,
    carrierTracking: o.carrierTracking ?? o.carrier_tracking,
  };
}

/* ── Message templates ── */
const TPLS = {
  confirm: {
    label: "تأكيد الطلب",
    icon: <CheckCircle2 size={14} className="text-emerald-500 inline shrink-0" />,
    ar: (n: string, p: string, c: string, a: string, cur: string) =>
      `السلام عليكم ${n} 👋\n\nتم تأكيد طلبكم بنجاح ✅\n\n📦 المنتج : ${p}\n💵 المبلغ : ${a} ${cur}\n📍 المدينة : ${c}\n\nسنتواصل معكم قبل التوصيل.\n\nشكراً على ثقتكم 🙏`,
    fr: (n: string, p: string, c: string, a: string, cur: string) =>
      `Bonjour ${n} 👋\n\nVotre commande est *confirmée* ✅\n\n📦 ${p}\n💵 ${a} ${cur} · 📍 ${c}\n\nNous vous contacterons avant la livraison.\n\nMerci 🙏`,
  },
  shipping_attempt: {
    label: "محاولة التوصيل",
    icon: <PhoneOff size={14} className="text-amber-500 inline shrink-0" />,
    ar: (n: string) =>
      `السلام عليكم ${n} 👋\n\nحاول مندوب التوصيل الاتصال بكم اليوم 📦\n\nيرجى الاتصال به في أقرب وقت أو راسلونا لتحديد موعد آخر.\n\nشكراً 🙏`,
    fr: (n: string) =>
      `Bonjour ${n} 👋\n\nNotre transporteur a essayé de vous joindre aujourd'hui 📦\n\nMerci de le rappeler ou répondez pour fixer un autre créneau 🙏`,
  },
  shipped: {
    label: "تم الشحن",
    icon: <Truck size={14} className="text-blue-500 inline shrink-0" />,
    ar: (n: string, p: string, c: string) =>
      `السلام عليكم ${n} 👋\n\nطلبكم *${p}* في الطريق إلى *${c}* 🚚\n\nسيتصل بكم المندوب قبل التسليم.\n\nشكراً 🙏`,
    fr: (n: string, p: string, c: string) =>
      `Bonjour ${n} 👋\n\nVotre colis *${p}* est en route vers *${c}* 🚚\n\nLe livreur vous contactera avant la livraison 🙏`,
  },
  return: {
    label: "إرجاع الطلب",
    icon: <Undo2 size={14} className="text-orange-500 inline shrink-0" />,
    ar: (n: string) =>
      `السلام عليكم ${n} 👋\n\nتم إرجاع طردكم إلينا ↩️\n\nيرجى التواصل معنا لإعادة جدولة التوصيل.\n\nشكراً 🙏`,
    fr: (n: string) =>
      `Bonjour ${n} 👋\n\nVotre colis nous a été retourné ↩️\n\nContactez-nous pour reprogrammer la livraison 🙏`,
  },
};

type TplKey = keyof typeof TPLS;

function buildMsg(tpl: TplKey, lang: Lang, order: Order) {
  const t = TPLS[tpl];
  if (tpl === "confirm") return t[lang](order.customer, order.product, order.city, String(order.amount), order.currency);
  if (tpl === "shipping_attempt") return (t as typeof TPLS["shipping_attempt"])[lang](order.customer);
  if (tpl === "shipped") return (t as typeof TPLS["shipped"])[lang](order.customer, order.product, order.city);
  return (t as typeof TPLS["return"])[lang](order.customer);
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const isToday = d.toDateString() === new Date().toDateString();
  if (isToday) return d.toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit" });
}

async function waSend(phone: string, message: string) {
  const r = await fetch("/api/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, message }),
  });
  return r.json();
}

async function waSendConfirm(phone: string, message: string, orderId: string, imageUrl?: string) {
  const r = await fetch("/api/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "send-confirm", phone, message, orderId, imageUrl }),
  });
  return r.json();
}

function buildConfirmPoll(lang: Lang, order: Order) {
  if (lang === "ar") {
    return (
      `السلام عليكم ${order.customer} 👋\n\n` +
      `لديكم طلب جديد في انتظار التأكيد:\n\n` +
      `📦 المنتج : *${order.product}*\n` +
      `💵 المبلغ : *${order.amount} ${order.currency}*\n` +
      `📍 المدينة : *${order.city}*\n\n` +
      `هل تريد تأكيد هذا الطلب؟`
    );
  }
  return (
    `Bonjour ${order.customer} 👋\n\n` +
    `Vous avez une nouvelle commande en attente de confirmation :\n\n` +
    `📦 Produit : *${order.product}*\n` +
    `💵 Montant : *${order.amount} ${order.currency}*\n` +
    `📍 Ville : *${order.city}*\n\n` +
    `Souhaitez-vous confirmer cette commande ?`
  );
}

/* ── Order row for "À confirmer" tab ── */
function ConfirmOrderRow({
  order, lang, isPending, imageUrl, onSent,
}: {
  order: Order; lang: Lang; isPending: boolean; imageUrl?: string; onSent: (msg: string, ok: boolean) => void;
}) {
  const [sending, setSending] = useState(false);

  async function sendPoll() {
    if (!order.phone) return onSent("Pas de numéro de téléphone", false);
    setSending(true);
    try {
      const msg = buildConfirmPoll(lang, order);
      const d = await waSendConfirm(order.phone, msg, order.id, imageUrl);
      onSent(d.ok ? `✓ Demande envoyée à ${order.customer} — en attente de réponse` : (d.error ?? "Erreur"), d.ok);
    } catch { onSent("Erreur réseau", false); }
    setSending(false);
  }

  return (
    <div className={`bg-white border rounded-2xl p-4 space-y-3 transition-all ${isPending ? "border-amber-300 shadow-sm shadow-amber-100" : "border-slate-200"}`}>
      <div className="flex items-start gap-3">
        {imageUrl && (
          <img src={imageUrl} alt={order.product} className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-slate-900 text-sm">{order.customer}</p>
            {isPending && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                En attente de réponse
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-slate-700 mt-0.5"><Package size={11} className="inline mr-0.5" />{order.product}</p>
          <p className="text-xs text-slate-500">{order.phone} · {order.city} · {order.amount} {order.currency}</p>
        </div>
        <span className="text-xs font-mono text-slate-400 shrink-0">#{order.orderNumber}</span>
      </div>

      {/* Poll preview */}
      {!isPending && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-600 leading-relaxed" dir="auto">
          <p className="font-semibold text-slate-400 mb-1 text-[11px] uppercase tracking-wide">Message envoyé au client</p>
          <p className="whitespace-pre-wrap">{buildConfirmPoll(lang, order)}</p>
        </div>
      )}

      {isPending ? (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-amber-500 text-lg">⏳</span>
          <div>
            <p className="text-xs font-bold text-amber-700">En attente de la réponse du client</p>
            <p className="text-xs text-amber-600">Le statut changera automatiquement dès que le client répond 1 ou 2</p>
          </div>
        </div>
      ) : (
        <button onClick={sendPoll} disabled={sending || !order.phone}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold transition-colors shadow shadow-emerald-200">
          {sending ? "Envoi…" : (
            <>
              <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
              </svg>
              {lang === "ar" ? "إرسال طلب التأكيد للعميل" : "Demander confirmation au client"}
            </>
          )}
        </button>
      )}
    </div>
  );
}

/* ── Order row for "À suivre" tab ── */
function TrackOrderRow({ order, lang, onSent }: { order: Order; lang: Lang; onSent: (msg: string, ok: boolean) => void }) {
  const [sending, setSending] = useState<TplKey | null>(null);

  async function send(tpl: TplKey) {
    if (!order.phone) return onSent("Pas de numéro", false);
    setSending(tpl);
    try {
      const d = await waSend(order.phone, buildMsg(tpl, lang, order));
      onSent(d.ok ? `✓ WhatsApp envoyé à ${order.customer}` : (d.error ?? "Erreur"), d.ok);
    } catch { onSent("Erreur réseau", false); }
    setSending(null);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900 text-sm">{order.customer}</p>
          <p className="text-xs text-slate-500">{order.phone} · {order.city}</p>
          <p className="text-xs text-slate-400 mt-0.5">{order.product} · {order.amount} {order.currency}</p>
          {order.carrierTracking && <p className="text-xs font-mono text-indigo-600 mt-0.5"><Package size={11} className="inline mr-0.5" />{order.carrierTracking}</p>}
        </div>
        <span className="text-xs font-mono text-slate-400 shrink-0">#{order.orderNumber}</span>
      </div>
      {order.noAnswer > 0 && (
        <div className="text-xs text-amber-600 font-semibold bg-amber-50 px-3 py-1.5 rounded-xl">
          <PhoneOff size={11} className="inline mr-1" />{order.noAnswer} sans réponse
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => send("shipping_attempt")} disabled={!!sending}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors disabled:opacity-50">
          {sending === "shipping_attempt" ? "…" : <><PhoneOff size={14} strokeWidth={1.5} /> Transporteur a appelé</>}
        </button>
        <button onClick={() => send("shipped")} disabled={!!sending}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors disabled:opacity-50">
          {sending === "shipped" ? "…" : <><Truck size={14} strokeWidth={1.5} /> En route</>}
        </button>
        <button onClick={() => send("return")} disabled={!!sending}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 transition-colors disabled:opacity-50">
          {sending === "return" ? "…" : <><Undo2 size={14} strokeWidth={1.5} /> Retourné</>}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function WhatsAppPage() {
  const [waStatus, setWaStatus] = useState<WAStatus>("disconnected");
  const [qr, setQr] = useState<string | null>(null);
  const [jid, setJid] = useState<string | null>(null);
  const [waError, setWaError] = useState(false);
  const [myRole, setMyRole] = useState<string>("agent");
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => { if (d?.role) setMyRole(d.role); }).catch(() => {});
  }, []);

  const [orders, setOrders] = useState<Order[]>([]);
  const [productImages, setProductImages] = useState<Record<string, string>>({}); // product name → image url
  const [pendingPhones, setPendingPhones] = useState<string[]>([]); // phones waiting for client reply
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sendingMedia, setSendingMedia] = useState(false);

  const [lang, setLang] = useState<Lang>("ar");
  const [tab, setTab] = useState<Tab>("inbox");

  /* ── WA Settings state ── */
  const [waSettings, setWaSettings] = useState({
    autoConfirmEnabled: false,
    autoConfirmDelayMinutes: 30,
    defaultLang: "ar" as Lang,
    templates: {
      confirm: {
        ar: "السلام عليكم {{name}} 👋\n\nلديكم طلب جديد في انتظار التأكيد:\n\n📦 المنتج : *{{product}}*\n💵 المبلغ : *{{amount}} {{currency}}*\n📍 المدينة : *{{city}}*\n\nهل تريد تأكيد هذا الطلب؟",
        fr: "Bonjour {{name}} 👋\n\nVous avez une nouvelle commande en attente :\n\n📦 *{{product}}*\n💵 *{{amount}} {{currency}}*\n📍 *{{city}}*\n\nSouhaitez-vous confirmer ?",
      },
      shipping_attempt: {
        ar: "السلام عليكم {{name}} 👋\n\nحاول مندوب التوصيل الاتصال بكم اليوم 📦\n\nيرجى الاتصال به في أقرب وقت أو راسلونا لتحديد موعد آخر.\n\nشكراً 🙏",
        fr: "Bonjour {{name}} 👋\n\nNotre transporteur a essayé de vous joindre aujourd'hui 📦\n\nMerci de le rappeler ou répondez pour fixer un autre créneau 🙏",
      },
      shipped: {
        ar: "السلام عليكم {{name}} 👋\n\nطلبكم *{{product}}* في الطريق إلى *{{city}}* 🚚\n\nسيتصل بكم المندوب قبل التسليم.\n\nشكراً 🙏",
        fr: "Bonjour {{name}} 👋\n\nVotre colis *{{product}}* est en route vers *{{city}}* 🚚\n\nLe livreur vous contactera avant la livraison 🙏",
      },
      return: {
        ar: "السلام عليكم {{name}} 👋\n\nتم إرجاع طردكم إلينا ↩️\n\nيرجى التواصل معنا لإعادة جدولة التوصيل.\n\nشكراً 🙏",
        fr: "Bonjour {{name}} 👋\n\nVotre colis nous a été retourné ↩️\n\nContactez-nous pour reprogrammer la livraison 🙏",
      },
    },
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Compose
  const [composePhone, setComposePhone] = useState("");
  const [composeTpl, setComposeTpl] = useState<TplKey>("confirm");
  const [composeName, setComposeName] = useState("");
  const [composeProduct, setComposeProduct] = useState("");
  const [composeCity, setComposeCity] = useState("");
  const [composeAmount, setComposeAmount] = useState("");
  const [composeSending, setComposeSending] = useState(false);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); }

  /* ── fetchers ── */
  const fetchWaStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/whatsapp", { cache: "no-store" });
      if (!r.ok) { setWaError(true); return; }
      const d = await r.json();
      setWaError(false);
      setWaStatus(d.status ?? "disconnected");
      setQr(d.qr ?? null);
      setJid(d.jid ?? null);
    } catch { setWaError(true); setWaStatus("disconnected"); }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const r = await fetch("/api/whatsapp?action=conversations", { cache: "no-store" });
      if (r.ok) { const d = await r.json(); if (Array.isArray(d)) setConversations(d); }
    } catch {}
  }, []);

  const fetchMessages = useCallback(async (phone: string) => {
    try {
      const r = await fetch(`/api/whatsapp?action=messages&phone=${encodeURIComponent(phone)}`, { cache: "no-store" });
      if (r.ok) { const d = await r.json(); if (Array.isArray(d)) setMessages(d); }
    } catch {}
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { cache: "no-store" });
      if (r.ok) { const d = await r.json(); if (d.orders) setOrders(d.orders.map(normalizeOrder)); }
    } catch {}
  }, []);

  const fetchWaSettings = useCallback(async () => {
    try {
      const r = await fetch("/api/wa-settings");
      if (r.ok) {
        const d = await r.json();
        if (d.whatsapp && Object.keys(d.whatsapp).length > 0) {
          setWaSettings(prev => ({ ...prev, ...d.whatsapp }));
        }
      }
    } catch {}
    setSettingsLoaded(true);
  }, []);

  async function saveWaSettings() {
    setSettingsSaving(true);
    try {
      await fetch("/api/wa-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(waSettings),
      });
      showToast("Paramètres sauvegardés ✓");
    } catch { showToast("Erreur sauvegarde", false); }
    setSettingsSaving(false);
  }

  const fetchPending = useCallback(async () => {
    try {
      const r = await fetch("/api/whatsapp?action=pending", { cache: "no-store" });
      if (r.ok) { const d = await r.json(); if (Array.isArray(d)) setPendingPhones(d); }
    } catch {}
  }, []);

  /* ── fetch WA settings once ── */
  useEffect(() => { fetchWaSettings(); }, [fetchWaSettings]);

  /* ── fetch product images once ── */
  useEffect(() => {
    fetch("/api/products").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.products) {
        const map: Record<string, string> = {};
        for (const p of d.products) { if (p.name && p.image) map[p.name] = p.image; }
        setProductImages(map);
      }
    }).catch(() => {});
  }, []);

  /* ── polling ── */
  useEffect(() => {
    fetchWaStatus();
    fetchOrders();
    const t = setInterval(() => {
      fetchWaStatus();
      fetchConversations();
      fetchPending();
      fetchOrders(); // refresh orders so confirmed ones disappear
      if (activePhone) fetchMessages(activePhone);
    }, 3000);
    return () => clearInterval(t);
  }, [fetchWaStatus, fetchConversations, fetchMessages, fetchOrders, fetchPending, activePhone]);

  useEffect(() => {
    if (waStatus === "connected") fetchConversations();
  }, [waStatus, fetchConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── actions ── */
  async function handleLogout() {
    await fetch("/api/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    setWaStatus("disconnected"); setQr(null); setJid(null);
    // Keep polling — QR will appear within ~10s when server reinitializes
    setTimeout(fetchWaStatus, 5000);
    setTimeout(fetchWaStatus, 10000);
    setTimeout(fetchWaStatus, 15000);
  }

  const [reconnecting, setReconnecting] = useState(false);
  async function handleReconnect() {
    setReconnecting(true);
    try {
      // Logout resets the WA server session so it generates a fresh QR
      await fetch("/api/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    } catch {}
    setQr(null);
    // Poll aggressively for the new QR
    for (const ms of [2000, 4000, 7000, 10000, 15000]) {
      setTimeout(fetchWaStatus, ms);
    }
    setTimeout(() => setReconnecting(false), 16000);
  }

  async function handleReply() {
    if (!replyText.trim() || !activePhone) return;
    setReplying(true);
    try {
      const d = await waSend(activePhone, replyText);
      if (d.ok) { setReplyText(""); fetchMessages(activePhone); fetchConversations(); }
      else showToast(d.error ?? "Erreur", false);
    } catch { showToast("Erreur réseau", false); }
    setReplying(false);
  }

  async function handleMediaSend(file: File) {
    if (!activePhone) return;
    setSendingMedia(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        const d = await fetch("/api/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send-media", phone: activePhone, mimetype: file.type, data: base64, caption: replyText }),
        }).then(r => r.json());
        if (d.ok) { setReplyText(""); fetchMessages(activePhone); }
        else showToast(d.error ?? "Erreur envoi image", false);
        setSendingMedia(false);
      };
      reader.readAsDataURL(file);
    } catch { showToast("Erreur réseau", false); setSendingMedia(false); }
  }

  async function handleComposeSend() {
    if (!composePhone) return showToast("Entrez un numéro", false);
    const fakeOrder: Order = { id: "", orderNumber: "", customer: composeName || "عميل", phone: composePhone, city: composeCity, product: composeProduct, amount: parseFloat(composeAmount) || 0, currency: "MAD", status: "", attempts: 0, noAnswer: 0 };
    setComposeSending(true);
    try {
      const d = await waSend(composePhone, buildMsg(composeTpl, lang, fakeOrder));
      if (d.ok) { showToast("Message envoyé ✓"); fetchConversations(); }
      else showToast(d.error ?? "Erreur", false);
    } catch { showToast("Erreur réseau", false); }
    setComposeSending(false);
  }

  /* ── derived ── */
  const nouveauOrders = orders.filter(o => o.status === "nouveau");
  const expedieOrders = orders.filter(o => o.status === "expédié");

  const statusInfo = {
    disconnected: { label: "Déconnecté", dot: "bg-slate-300", badge: "bg-slate-100 text-slate-500 border-slate-200" },
    qr:           { label: "Scanner QR", dot: "bg-amber-400 animate-pulse", badge: "bg-amber-50 text-amber-700 border-amber-200" },
    connecting:   { label: "Connexion…", dot: "bg-blue-400 animate-pulse", badge: "bg-blue-50 text-blue-700 border-blue-200" },
    connected:    { label: "Connecté", dot: "bg-emerald-500 animate-pulse", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  }[waStatus];

  const composeTplObj = TPLS[composeTpl];
  const previewMsg = buildMsg(composeTpl, lang, {
    id: "", orderNumber: "", customer: composeName || (lang === "ar" ? "عزيزي العميل" : "client"),
    phone: composePhone, city: composeCity || (lang === "ar" ? "مدينتكم" : "votre ville"),
    product: composeProduct || (lang === "ar" ? "المنتج" : "votre produit"),
    amount: parseFloat(composeAmount) || 0, currency: "MAD", status: "", attempts: 0, noAnswer: 0,
  });

  const TABS: { id: Tab; label: string; count?: number; isSettings?: boolean }[] = [
    { id: "inbox", label: "Conversations", count: conversations.length },
    { id: "confirm", label: "À confirmer", count: nouveauOrders.length },
    { id: "track", label: "À suivre", count: expedieOrders.length },
    { id: "settings", label: "Paramètres", isSettings: true },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow shadow-emerald-200">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
              </svg>
            </div>
            <div>
              <h1 className="font-black text-slate-900">WhatsApp</h1>
              <p className="text-xs text-slate-400">Messagerie clients · {lang === "ar" ? "العربية" : "Français"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Lang toggle */}
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
              <button onClick={() => setLang("ar")} className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${lang === "ar" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}>🇲🇦 AR</button>
              <button onClick={() => setLang("fr")} className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${lang === "fr" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>🇫🇷 FR</button>
            </div>
            {/* WA status */}
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${statusInfo.badge}`}>
              <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
              {statusInfo.label}
              {jid && <span className="font-mono opacity-60">{jid.split(":")[0]}</span>}
            </span>
            {waStatus === "connected" && (
              <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
                🔗 Compte partagé workspace
              </span>
            )}
            {waStatus === "connected" && myRole === "admin" && (
              <button onClick={handleLogout} className="text-xs font-semibold text-red-500 hover:text-red-700 px-3 py-1.5 rounded-xl hover:bg-red-50">
                Déconnecter
              </button>
            )}
          </div>
        </div>

        {/* QR banner — show whenever QR is available (some servers return status=disconnected with a QR) */}
        {(qr && waStatus !== "connected") && (
          <div className="mx-6 mt-4 border border-amber-200 rounded-2xl p-5 bg-amber-50 shrink-0">
            <div className="flex items-center gap-6">
              <div className="bg-white p-3 rounded-xl shadow border border-amber-200 shrink-0">
                <img src={qr} alt="QR" className="w-44 h-44" />
              </div>
              <div className="space-y-2">
                <p className="font-bold text-amber-800 text-lg">Scanner le QR code</p>
                <ol className="text-sm text-amber-700 space-y-1.5 list-decimal list-inside">
                  <li>Ouvrez WhatsApp sur votre téléphone</li>
                  <li>Appareils connectés → Connecter un appareil</li>
                  <li>Scannez ce QR code</li>
                </ol>
                <p className="text-xs text-amber-400">Se rafraîchit automatiquement toutes les 60 secondes</p>
              </div>
            </div>
          </div>
        )}
        {waStatus === "disconnected" && !qr && (
          <div className="mx-6 mt-4 border border-amber-200 rounded-2xl p-4 bg-amber-50 shrink-0 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {reconnecting ? "Génération du QR code…" : "WhatsApp déconnecté"}
                </p>
                <p className="text-xs text-amber-600">
                  {reconnecting
                    ? "Le QR code va apparaître dans quelques secondes, gardez cette page ouverte"
                    : myRole === "admin"
                      ? "Cliquez sur \"Se connecter\" pour scanner un QR code et partager l'accès avec toute l'équipe"
                      : "En attente que l'admin connecte le compte WhatsApp du workspace"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!reconnecting && (
                <button onClick={fetchWaStatus} className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-xl hover:bg-white border border-slate-200 transition-colors">
                  <RefreshCw size={12} className="inline mr-1" />Actualiser
                </button>
              )}
              {myRole === "admin" && (
                <button onClick={handleReconnect} disabled={reconnecting} className="text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 px-3 py-1.5 rounded-xl border border-emerald-600 transition-colors">
                  {reconnecting ? <><RefreshCw size={12} className="inline mr-1 animate-spin" />En attente du QR…</> : "📱 Se connecter"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tabs + content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-slate-200 bg-white px-6 shrink-0 gap-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === t.id ? "border-emerald-500 text-emerald-700" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                {t.isSettings ? <Settings size={14} strokeWidth={1.5} /> : null}{t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden flex">

            {/* ── À confirmer ── */}
            {tab === "confirm" && (
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {nouveauOrders.length} commande(s) en attente
                  </p>
                  {pendingPhones.length > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      {pendingPhones.length} en attente de réponse
                    </span>
                  )}
                </div>
                {nouveauOrders.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
                    <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
                    <p className="font-semibold">Tout est confirmé !</p>
                    <p className="text-sm">Aucune commande en attente</p>
                  </div>
                ) : nouveauOrders.map(o => {
                  const normPhone = (o.phone ?? "").replace(/[\s\-().]/g, "").replace(/^0/, "212").replace(/^\+/, "");
                  const isPending = pendingPhones.includes(normPhone);
                  return (
                    <ConfirmOrderRow key={o.id} order={o} lang={lang} isPending={isPending}
                      imageUrl={productImages[o.product] || undefined}
                      onSent={(msg, ok) => showToast(msg, ok)} />
                  );
                })}
              </div>
            )}

            {/* ── À suivre ── */}
            {tab === "track" && (
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {expedieOrders.length} commande(s) expédiée(s) à suivre
                </p>
                {expedieOrders.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
                    <Package size={32} className="text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold">Aucun colis en livraison</p>
                  </div>
                ) : expedieOrders.map(o => (
                  <TrackOrderRow key={o.id} order={o} lang={lang} onSent={(msg, ok) => showToast(msg, ok)} />
                ))}
              </div>
            )}

            {/* ── Inbox (live conversations) ── */}
            {tab === "inbox" && (
              <div className="flex-1 flex overflow-hidden">
                {/* Conversation list */}
                <div className="w-72 border-r border-slate-200 bg-white overflow-y-auto shrink-0">
                  {waStatus !== "connected" ? (
                    <div className="p-6 text-center text-slate-400 text-sm">WhatsApp non connecté</div>
                  ) : conversations.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm space-y-2">
                      <p className="text-2xl">💬</p>
                      <p className="font-semibold">Aucune conversation</p>
                      <p className="text-xs">Les messages apparaissent ici après envoi ou réception</p>
                    </div>
                  ) : conversations.map(c => {
                    const linked = orders.find(o =>
                      (o.phone ?? "").replace(/[\s\-().+]/g, "").replace(/^00/, "").replace(/^0/, "212") === c.phone
                    );
                    return (
                      <button key={c.phone} onClick={() => { setActivePhone(c.phone); fetchMessages(c.phone); }}
                        className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${activePhone === c.phone ? "bg-emerald-50 border-l-2 border-l-emerald-400" : ""}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
                            {(linked?.customer || c.name || c.phone)[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-semibold text-sm text-slate-800 truncate">
                                {linked ? linked.customer : (c.name || `+${c.phone}`)}
                              </span>
                              <span className="text-xs text-slate-400 shrink-0">{c.lastMsg ? formatTime(c.lastMsg.ts) : ""}</span>
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {c.lastMsg?.fromMe && <span className="text-emerald-500">✓ </span>}
                              {c.lastMsg?.text?.startsWith("[") ? "📎 message" : (c.lastMsg?.text ?? "")}
                            </p>
                            {linked && (
                              <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${
                                linked.status === "confirmé" ? "bg-emerald-100 text-emerald-700" :
                                linked.status === "expédié" ? "bg-indigo-100 text-indigo-700" :
                                linked.status === "annulé" ? "bg-red-100 text-red-700" :
                                "bg-blue-100 text-blue-700"
                              }`}>{linked.status}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Chat panel */}
                <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: "#efeae2", backgroundImage: "url('/wa-bg.png')", backgroundSize: "contain", backgroundRepeat: "repeat" }}>
                  {activePhone ? (
                    <>
                      {/* Chat header */}
                      <div style={{ backgroundColor: "#202c33", padding: "12px 20px", display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                        <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {(() => {
                            const linked = orders.find(o => (o.phone ?? "").replace(/[\s\-().+]/g, "").replace(/^00/, "").replace(/^0/, "212") === activePhone);
                            return linked ? linked.customer[0]?.toUpperCase() : activePhone.slice(-2);
                          })()}
                        </div>
                        <div className="flex-1 min-w-0">
                          {(() => {
                            const linked = orders.find(o => (o.phone ?? "").replace(/[\s\-().+]/g, "").replace(/^00/, "").replace(/^0/, "212") === activePhone);
                            return (
                              <>
                                <p className="font-bold text-white text-sm">{linked ? linked.customer : (conversations.find(c => c.phone === activePhone)?.name || `+${activePhone}`)}</p>
                                <p className="text-xs text-slate-400">{linked ? `${linked.product} · +${activePhone}` : `+${activePhone}`}</p>
                              </>
                            );
                          })()}
                        </div>
                        <span className="text-xs text-slate-400">{messages.length} messages</span>
                      </div>

                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
                        {messages.filter(m => !m.text?.startsWith("[")).length === 0 ? (
                          <div className="text-center text-slate-500 text-sm pt-10">Aucun message</div>
                        ) : messages.filter(m => !m.text?.startsWith("[")).map(m => (
                          <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                            <div style={{
                              backgroundColor: m.fromMe ? "#005c4b" : "#ffffff",
                              borderRadius: m.fromMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                              padding: m.media ? "4px" : "8px 12px",
                              maxWidth: "320px",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                              overflow: "hidden",
                            }}>
                              {m.media && (
                                <img
                                  src={`data:${m.media.mimetype};base64,${m.media.data}`}
                                  alt="media"
                                  style={{ maxWidth: "280px", maxHeight: "280px", borderRadius: "8px", display: "block", cursor: "pointer" }}
                                  onClick={() => window.open(`data:${m.media!.mimetype};base64,${m.media!.data}`)}
                                />
                              )}
                              {m.text && (
                                <p style={{ color: m.fromMe ? "#ffffff" : "#111827", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "14px", lineHeight: "1.5", padding: m.media ? "4px 8px" : "0" }} dir="auto">{m.text}</p>
                              )}
                              <p style={{ color: m.fromMe ? "#a7f3d0" : "#6b7280", fontSize: "11px", marginTop: "4px", textAlign: "right", padding: m.media ? "0 8px 4px" : "0" }}>
                                {formatTime(m.ts)}
                                {m.fromMe && " ✓"}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Reply box */}
                      <div style={{ backgroundColor: "#202c33", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px", flexShrink: 0 }}>
                        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
                          {(Object.keys(TPLS) as TplKey[]).map(k => (
                            <button key={k} onClick={() => {
                              const linked = orders.find(o => (o.phone ?? "").replace(/[\s\-().+]/g, "").replace(/^00/, "").replace(/^0/, "212") === activePhone);
                              const fakeOrder: Order = linked ?? { id: "", orderNumber: "", customer: "", phone: activePhone ?? "", city: "", product: "", amount: 0, currency: "MAD", status: "", attempts: 0, noAnswer: 0 };
                              setReplyText(buildMsg(k, lang, fakeOrder));
                            }}
                              style={{ backgroundColor: "#2a3942", color: "#cbd5e1", border: "1px solid #3b4a54", borderRadius: "12px", padding: "6px 12px", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0 }}>
                              {TPLS[k].icon} {TPLS[k].label}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
                          {/* Image upload button */}
                          <button onClick={() => fileInputRef.current?.click()} disabled={sendingMedia}
                            style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#2a3942", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: sendingMedia ? 0.5 : 1 }}
                            title="Envoyer une image">
                            {sendingMedia ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10"/></svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ width: "18px", height: "18px" }}>
                                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                              </svg>
                            )}
                          </button>
                          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaSend(f); e.target.value = ""; }} />
                          <textarea rows={2} placeholder="Écrire un message…" value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                            dir="auto"
                            style={{ flex: 1, backgroundColor: "#2a3942", color: "#ffffff", border: "none", borderRadius: "20px", padding: "10px 16px", fontSize: "14px", resize: "none", outline: "none" }} />
                          <button onClick={handleReply} disabled={replying || !replyText.trim()}
                            style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#25d366", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: (replying || !replyText.trim()) ? 0.4 : 1 }}>
                            <svg viewBox="0 0 24 24" fill="white" style={{ width: "20px", height: "20px", transform: "rotate(90deg)" }}><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center text-slate-500 space-y-2">
                        <p className="text-5xl">💬</p>
                        <p className="font-semibold text-slate-600">Sélectionnez une conversation</p>
                        <p className="text-sm text-slate-400">Les messages envoyés et reçus apparaissent ici</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Compose ── */}
            {tab === "compose" && (
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-lg mx-auto px-6 py-5 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Téléphone *</label>
                    <input type="tel" placeholder="0612345678" value={composePhone} onChange={e => setComposePhone(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(TPLS) as TplKey[]).map(k => (
                      <button key={k} onClick={() => setComposeTpl(k)}
                        className={`text-left px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${composeTpl === k ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                        {TPLS[k].icon} {TPLS[k].label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">{lang === "ar" ? "الاسم" : "Nom"}</label>
                      <input type="text" value={composeName} onChange={e => setComposeName(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">{lang === "ar" ? "المنتج" : "Produit"}</label>
                      <input type="text" value={composeProduct} onChange={e => setComposeProduct(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">{lang === "ar" ? "المدينة" : "Ville"}</label>
                      <input type="text" value={composeCity} onChange={e => setComposeCity(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Montant (MAD)</label>
                      <input type="text" value={composeAmount} onChange={e => setComposeAmount(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400" />
                    </div>
                  </div>
                  {/* Preview */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-400 mb-2">Aperçu</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed" dir="auto">{previewMsg}</p>
                  </div>
                  <button onClick={handleComposeSend} disabled={composeSending || !composePhone}
                    className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-sm shadow shadow-emerald-200 transition-colors">
                    {composeSending ? "Envoi…" : "Envoyer via WhatsApp"}
                  </button>
                </div>
              </div>
            )}
            {/* ── Settings ── */}
            {tab === "settings" && (
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="max-w-2xl mx-auto space-y-6">

                  {/* Auto-confirm */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-bold text-slate-900 flex items-center gap-1.5"><Bot size={16} /> Confirmation automatique</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Envoie automatiquement le sondage de confirmation après une nouvelle commande</p>
                      </div>
                      <button onClick={() => setWaSettings(p => ({ ...p, autoConfirmEnabled: !p.autoConfirmEnabled }))}
                        className={`relative w-12 h-6 rounded-full transition-colors ${waSettings.autoConfirmEnabled ? "bg-emerald-500" : "bg-slate-200"}`}>
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${waSettings.autoConfirmEnabled ? "translate-x-7" : "translate-x-1"}`} />
                      </button>
                    </div>
                    {waSettings.autoConfirmEnabled && (
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                        <div>
                          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Délai après la commande</label>
                          <select value={waSettings.autoConfirmDelayMinutes}
                            onChange={e => setWaSettings(p => ({ ...p, autoConfirmDelayMinutes: Number(e.target.value) }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400">
                            <option value={1}>1 minute</option>
                            <option value={5}>5 minutes</option>
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={60}>1 heure</option>
                            <option value={120}>2 heures</option>
                            <option value={360}>6 heures</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Langue du message</label>
                          <select value={waSettings.defaultLang}
                            onChange={e => setWaSettings(p => ({ ...p, defaultLang: e.target.value as Lang }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400">
                            <option value="ar">🇲🇦 Arabe</option>
                            <option value="fr">🇫🇷 Français</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Template editor */}
                  {(["confirm", "shipping_attempt", "shipped", "return"] as const).map(tplKey => {
                    const icons: Record<string, React.ReactNode> = {
                      confirm: <CheckCircle2 size={14} strokeWidth={1.5} className="text-emerald-600 inline" />,
                      shipping_attempt: <PhoneOff size={14} strokeWidth={1.5} className="text-amber-600 inline" />,
                      shipped: <Truck size={14} strokeWidth={1.5} className="text-indigo-600 inline" />,
                      return: <Undo2 size={14} strokeWidth={1.5} className="text-orange-600 inline" />,
                    };
                    const labels: Record<string, string> = { confirm: "Confirmation commande", shipping_attempt: "Transporteur a appelé", shipped: "En cours de livraison", return: "Retour colis" };
                    return (
                      <div key={tplKey} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">{icons[tplKey]} {labels[tplKey]}</h3>
                        <p className="text-xs text-slate-400">Variables : <code className="bg-slate-100 px-1 rounded">{"{{name}}"}</code> <code className="bg-slate-100 px-1 rounded">{"{{product}}"}</code> <code className="bg-slate-100 px-1 rounded">{"{{amount}}"}</code> <code className="bg-slate-100 px-1 rounded">{"{{currency}}"}</code> <code className="bg-slate-100 px-1 rounded">{"{{city}}"}</code></p>
                        <div className="grid grid-cols-2 gap-3">
                          {(["ar", "fr"] as const).map(l => (
                            <div key={l}>
                              <label className="text-xs font-semibold text-slate-500 mb-1 block">{l === "ar" ? "🇲🇦 Arabe" : "🇫🇷 Français"}</label>
                              <textarea rows={5} dir={l === "ar" ? "rtl" : "ltr"}
                                value={waSettings.templates[tplKey]?.[l] ?? ""}
                                onChange={e => setWaSettings(p => ({
                                  ...p,
                                  templates: {
                                    ...p.templates,
                                    [tplKey]: { ...p.templates[tplKey], [l]: e.target.value }
                                  }
                                }))}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400 resize-none font-mono leading-relaxed" />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <button onClick={saveWaSettings} disabled={settingsSaving}
                    className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-sm shadow shadow-emerald-200 transition-colors">
                    {settingsSaving ? "Sauvegarde…" : <><Save size={14} strokeWidth={1.5} className="inline mr-1" /> Sauvegarder les paramètres</>}
                  </button>

                  {!settingsLoaded && (
                    <p className="text-center text-xs text-slate-400">Chargement des paramètres…</p>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold ${toast.ok ? "bg-emerald-600 text-white" : "bg-red-500 text-white"}`}>
          {toast.ok ? "✓" : "✕"} {toast.msg}
        </div>
      )}
    </div>
  );
}
