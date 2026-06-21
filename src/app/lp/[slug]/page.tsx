"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import LiveTracker from "@/components/LiveTracker";
import { initFBPixel, trackFBEvent } from "@/lib/pixelEvents";
import { Truck, CreditCard, CheckCircle2, Phone, HelpCircle, Lock, Zap, type LucideIcon } from "lucide-react";

type LandingPage = {
  id: string; slug: string; title: string; subtitle: string;
  price: number; originalPrice: number; currency: string;
  images: string[]; bullets: string[];
  urgencyText: string; ctaText: string;
  primaryColor: string; theme: "light" | "dark";
  showTrustBadges: boolean; showStickyBar: boolean; requireAddress: boolean;
  active: boolean; ownerId?: string; facebookPixelId?: string;
};

const TRUST_BADGES: { icon: LucideIcon; label: string; sub: string }[] = [
  { icon: Truck, label: "توصيل مجاني", sub: "Livraison gratuite" },
  { icon: CreditCard, label: "الدفع عند الاستلام", sub: "Paiement à la livraison" },
  { icon: CheckCircle2, label: "ضمان 100%", sub: "Garantie 100%" },
  { icon: Phone, label: "خدمة العملاء", sub: "Support client" },
];

export default function LandingPageView() {
  const params = useParams();
  const slug = params?.slug as string;

  const [page, setPage] = useState<LandingPage | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  const [form, setForm] = useState({ customer: "", phone: "", city: "", address: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");

  // Scroll to form
  function scrollToForm() {
    document.getElementById("order-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/lp-pages?slug=${slug}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setPage(data);
        if (data.facebookPixelId) initFBPixel(data.facebookPixelId);
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer.trim() || !form.phone.trim() || !form.city.trim()) {
      setFormError("يرجى ملء جميع الحقول الإلزامية");
      return;
    }
    setSubmitting(true); setFormError("");
    try {
      const res = await fetch("/api/lp-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ...form }),
      });
      const data = await res.json();
      if (!data.ok) { setFormError(data.error || "Erreur"); return; }
      if (page?.facebookPixelId) {
        trackFBEvent("Purchase", {
          value: page.price,
          currency: page.currency,
          content_name: page.title,
          content_type: "product",
        });
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setFormError("Erreur réseau. Réessayez."); }
    finally { setSubmitting(false); }
  }

  if (notFound) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="text-center">
        <HelpCircle size={60} className="text-slate-300 mx-auto mb-4" />
        <p className="text-xl font-bold text-slate-800">Page introuvable</p>
        <p className="text-slate-400 mt-2">Cette page n'existe pas ou a été désactivée.</p>
      </div>
    </div>
  );

  if (!page) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!page.active) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="text-center">
        <Lock size={60} className="text-slate-300 mx-auto mb-4" />
        <p className="text-xl font-bold text-slate-800">Page temporairement indisponible</p>
      </div>
    </div>
  );

  const pct = page.originalPrice > 0 ? Math.round(((page.originalPrice - page.price) / page.originalPrice) * 100) : 0;
  const bg = page.theme === "dark" ? "bg-gray-950" : "bg-gray-50";
  const textMain = page.theme === "dark" ? "text-white" : "text-slate-900";
  const cardBg = page.theme === "dark" ? "bg-gray-900 border-gray-800" : "bg-white border-slate-100";

  if (submitted) return (
    <div className={`min-h-screen ${bg} flex items-center justify-center p-6`}>
      <div className="max-w-md w-full text-center">
        <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mx-auto mb-6" style={{ backgroundColor: page.primaryColor + "20" }}>
          <CheckCircle2 size={48} style={{ color: page.primaryColor }} className="mx-auto" />
        </div>
        <h1 className={`text-2xl font-black mb-3 ${textMain}`} dir="rtl">تم استلام طلبك بنجاح!</h1>
        <p className={`text-lg font-semibold mb-2 ${textMain}`}>Votre commande a bien été reçue !</p>
        <p className="text-slate-400 mb-6">سيتصل بك فريقنا في أقرب وقت لتأكيد الطلب وتحديد موعد التوصيل</p>
        <div className="rounded-2xl p-5 border" style={{ backgroundColor: page.primaryColor + "10", borderColor: page.primaryColor + "30" }}>
          <p className={`font-bold text-lg mb-1 ${textMain}`}>{form.customer}</p>
          <p className="text-slate-500">{form.phone} · {form.city}</p>
          <p className="font-black text-2xl mt-3" style={{ color: page.primaryColor }}>{page.price} {page.currency}</p>
          <p className="text-xs text-slate-400 mt-1">الدفع عند الاستلام · Paiement à la livraison</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${bg} font-sans`}>
      <LiveTracker page={`/lp/${slug}`} pageTitle={page.title} workspaceId={page.ownerId} />
      {/* Urgency top bar */}
      {page.urgencyText && (
        <div className="text-white text-center py-3 px-4 text-sm font-bold" style={{ backgroundColor: page.primaryColor }} dir="rtl">
          <Zap size={14} className="inline mr-1" />{page.urgencyText}
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-6 pb-32">

        {/* Product images */}
        {page.images.length > 0 && (
          <div className="mb-5">
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white aspect-square">
              <img
                src={page.images[activeImg]}
                alt={page.title}
                className="w-full h-full object-contain"
                onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/600x600/f1f5f9/94a3b8?text=Image"; }}
              />
            </div>
            {page.images.length > 1 && (
              <div className="flex gap-2 mt-2 justify-center">
                {page.images.map((img, i) => (
                  <button key={i} onClick={() => setActiveImg(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${activeImg === i ? "border-blue-500" : "border-slate-200"}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Product title */}
        <div className="text-center mb-5">
          <h1 className={`text-2xl font-black mb-1 ${textMain}`}>{page.title}</h1>
          {page.subtitle && <p className="text-slate-400 text-sm">{page.subtitle}</p>}
        </div>

        {/* Price */}
        <div className={`rounded-2xl border p-4 mb-5 text-center ${cardBg}`}>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="text-4xl font-black" style={{ color: page.primaryColor }}>
              {page.price} {page.currency}
            </span>
            {page.originalPrice > 0 && (
              <>
                <span className="text-xl text-slate-400 line-through">{page.originalPrice} {page.currency}</span>
                <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-xl">-{pct}%</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">الدفع عند الاستلام · Paiement à la livraison</p>
        </div>

        {/* Bullets */}
        {page.bullets.length > 0 && (
          <div className={`rounded-2xl border p-4 mb-5 space-y-2 ${cardBg}`}>
            {page.bullets.map((b, i) => (
              <div key={i} className={`flex items-center gap-2 text-sm font-medium ${textMain}`}>
                <span>{b}</span>
              </div>
            ))}
          </div>
        )}

        {/* CTA above form */}
        <button onClick={scrollToForm} className="w-full py-4 rounded-2xl text-white text-lg font-black shadow-lg mb-6 transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundColor: page.primaryColor, boxShadow: `0 8px 24px ${page.primaryColor}40` }}>
          {page.ctaText}
        </button>

        {/* Order form */}
        <div id="order-form" className={`rounded-2xl border p-5 mb-5 ${cardBg}`}>
          <h2 className={`text-lg font-black mb-1 text-center ${textMain}`} dir="rtl">: العرض لي بغيتي</h2>
          <p className="text-center text-slate-400 text-sm mb-4">أكمل طلبك الآن</p>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <input
                type="text" placeholder="الإسم الكامل · Nom complet *" value={form.customer}
                onChange={e => setForm(f => ({ ...f, customer: e.target.value }))}
                dir="auto"
                className={`w-full text-sm rounded-xl px-4 py-3.5 outline-none border transition-all text-right ${cardBg} ${textMain} border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50`}
              />
            </div>
            <div>
              <input
                type="tel" placeholder="رقم الهاتف · Téléphone *" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className={`w-full text-sm rounded-xl px-4 py-3.5 outline-none border transition-all text-right ${cardBg} ${textMain} border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50`}
              />
            </div>
            <div>
              <input
                type="text" placeholder="المدينة · Ville *" value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                dir="auto"
                className={`w-full text-sm rounded-xl px-4 py-3.5 outline-none border transition-all text-right ${cardBg} ${textMain} border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50`}
              />
            </div>
            {page.requireAddress && (
              <div>
                <input
                  type="text" placeholder="العنوان · Adresse" value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  dir="auto"
                  className={`w-full text-sm rounded-xl px-4 py-3.5 outline-none border transition-all text-right ${cardBg} ${textMain} border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50`}
                />
              </div>
            )}

            <p className="text-red-500 text-xs text-center font-medium" dir="rtl">
              المرجو التأكد من صحة رقم الهاتف قبل الإرسال
            </p>

            {formError && <p className="text-red-500 text-xs text-center">{formError}</p>}

            <button type="submit" disabled={submitting}
              className="w-full py-4 rounded-2xl text-white text-lg font-black transition-all disabled:opacity-60 hover:scale-[1.01] active:scale-[0.99]"
              style={{ backgroundColor: page.primaryColor, boxShadow: `0 8px 20px ${page.primaryColor}40` }}>
              {submitting ? "جاري الإرسال…" : page.ctaText}
            </button>
          </form>
        </div>

        {/* Trust badges */}
        {page.showTrustBadges && (
          <div className="grid grid-cols-4 gap-2">
            {TRUST_BADGES.map(b => (
              <div key={b.label} className={`rounded-2xl border p-3 flex flex-col items-center gap-1 text-center ${cardBg}`}>
                <b.icon size={22} />
                <p className={`text-xs font-bold leading-tight ${textMain}`} dir="rtl">{b.label}</p>
                <p className="text-xs text-slate-400 leading-tight">{b.sub}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      {page.showStickyBar && (
        <div className={`fixed bottom-0 left-0 right-0 border-t shadow-2xl px-4 py-3 flex items-center gap-3 z-40 ${cardBg}`} style={{ borderColor: page.primaryColor + "30" }}>
          {page.images[0] && (
            <img src={page.images[0]} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold truncate ${textMain}`}>{page.title}</p>
            <div className="flex items-center gap-2">
              <span className="font-black text-base" style={{ color: page.primaryColor }}>{page.price} {page.currency}</span>
              {page.originalPrice > 0 && <span className="text-xs text-slate-400 line-through">{page.originalPrice}</span>}
              {pct > 0 && <span className="text-xs font-bold text-red-500">-{pct}%</span>}
            </div>
          </div>
          <button onClick={scrollToForm}
            className="text-white text-sm font-bold px-4 py-2.5 rounded-xl shrink-0 whitespace-nowrap"
            style={{ backgroundColor: page.primaryColor }}>
            اطلب الآن
          </button>
        </div>
      )}
    </div>
  );
}
