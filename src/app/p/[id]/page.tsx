"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import LiveTracker from "@/components/LiveTracker";
import { initFBPixel, trackFBEvent } from "@/lib/pixelEvents";
import { HelpCircle, Truck, DollarSign, CheckCircle2, Phone, Package, AlertTriangle, ShoppingCart } from "lucide-react";

type ProductInfo = {
  id: string;
  name: string;
  image: string;
  price: number;
  comparePrice?: number | null;
  ownerId?: string;
  facebookPixelId?: string;
};

export default function ProductPage() {
  const params = useParams();
  const id = params?.id as string;

  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ customerName: "", phone: "", city: "", address: "", quantity: "1" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [leadSaved, setLeadSaved] = useState(false);

  // Save abandoned lead as soon as phone is filled — silent, no UI change
  async function saveAbandonedLead() {
    if (leadSaved || submitted || !form.phone.trim() || !form.customerName.trim() || !id) return;
    try {
      await fetch(`/api/p/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-lead",
          customerName: form.customerName,
          phone: form.phone,
          city: form.city,
          address: form.address,
        }),
      });
      setLeadSaved(true);
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!id) return;
    fetch(`/api/p/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        setProduct(d);
        if (d.facebookPixelId) initFBPixel(d.facebookPixelId);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerName.trim() || !form.phone.trim() || !form.city.trim()) {
      setError("يرجى تعبئة الاسم الكامل والهاتف والمدينة");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/p/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName,
          phone: form.phone,
          city: form.city,
          address: form.address,
          quantity: parseInt(form.quantity) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "حدث خطأ، يرجى المحاولة مجدداً"); return; }
      if (product?.facebookPixelId) {
        trackFBEvent("Purchase", {
          value: product.price * (parseInt(form.quantity) || 1),
          currency: "MAD",
          content_name: product.name,
          content_type: "product",
        });
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("خطأ في الاتصال، يرجى المحاولة مجدداً");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="w-10 h-10 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound || !product) return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-sm w-full">
        <HelpCircle size={60} className="text-slate-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-800 mb-2">المنتج غير موجود</h1>
        <p className="text-slate-400 text-sm">هذا الرابط غير صحيح أو انتهت صلاحيته.</p>
      </div>
    </div>
  );

  const qty = parseInt(form.quantity) || 1;
  const total = (product.price * qty).toLocaleString("ar-MA");

  if (submitted) return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-sm w-full">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth={2.5} className="w-10 h-10"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-3">تم تأكيد طلبك!</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          شكراً على طلبك لـ <strong className="text-slate-700">{product.name}</strong>.<br />
          سيتصل بك فريقنا قريباً لتأكيد التوصيل.
        </p>
        <div className="bg-emerald-50 rounded-2xl px-5 py-4 border border-emerald-100">
          <p className="text-sm text-emerald-700 font-semibold">سيتم الاتصال بك على</p>
          <p className="text-xl font-black text-emerald-800 mt-1 dir-ltr" dir="ltr">{form.phone}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <LiveTracker
        page={`/p/${id}`}
        pageTitle={product.name}
        productId={id}
        workspaceId={product.ownerId}
      />
      {/* Sticky urgency bar */}
      <div className="sticky top-0 z-50 bg-red-600 text-white text-center text-sm font-bold py-2.5 px-4 shadow-lg">
        عرض محدود — اطلب الآن قبل نفاد الكمية!
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Product card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-5">
          {product.image && (
            <div className="w-full bg-slate-100">
              <Image src={product.image} alt={product.name} width={800} height={800} className="w-full h-auto object-contain" unoptimized />
            </div>
          )}
          <div className="p-6">
            <h1 className="text-2xl font-black text-slate-900 mb-3 leading-tight">{product.name}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-3xl font-black text-blue-600">{product.price.toLocaleString("ar-MA")} درهم</span>
              {product.comparePrice && product.comparePrice > product.price && (
                <span className="text-xl text-slate-400 line-through font-semibold">{product.comparePrice.toLocaleString("ar-MA")} درهم</span>
              )}
              <span className="bg-emerald-100 text-emerald-700 text-sm font-bold px-3 py-1 rounded-xl">الدفع عند الاستلام</span>
              {product.comparePrice && product.comparePrice > product.price && (
                <span className="bg-red-100 text-red-600 text-sm font-bold px-3 py-1 rounded-xl">
                  -{Math.round((1 - product.price / product.comparePrice) * 100)}%
                </span>
              )}
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-2 gap-2 mt-5">
              {[
                { Icon: Truck, text: "توصيل سريع لجميع المدن" },
                { Icon: DollarSign, text: "الدفع عند الاستلام" },
                { Icon: CheckCircle2, text: "جودة مضمونة 100%" },
                { Icon: Phone, text: "خدمة عملاء متاحة" },
              ].map(b => (
                <div key={b.text} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
                  <b.Icon size={18} className="text-blue-500 shrink-0" />
                  <span className="text-xs font-semibold text-slate-600">{b.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order form */}
        <div className="bg-white rounded-3xl shadow-xl p-6">
          <h2 className="text-xl font-black text-slate-900 mb-1 flex items-center gap-2"><Package size={20} /> أكمل طلبك الآن</h2>
          <p className="text-sm text-slate-400 mb-5">أدخل معلوماتك وسنتصل بك لتأكيد التوصيل</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3 mb-4 font-medium">
              <AlertTriangle size={14} className="inline mr-1" />{error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">الاسم الكامل *</label>
              <input type="text" placeholder="أحمد بنعلي" value={form.customerName}
                onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                className="w-full text-sm border-2 border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">رقم الهاتف *</label>
              <input type="tel" placeholder="06 00 00 00 00" value={form.phone} dir="ltr"
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                onBlur={saveAbandonedLead}
                className="w-full text-sm border-2 border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all text-left" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">المدينة *</label>
              <input type="text" placeholder="الدار البيضاء" value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className="w-full text-sm border-2 border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">العنوان التفصيلي</label>
              <input type="text" placeholder="الشارع، الحي..." value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="w-full text-sm border-2 border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">الكمية</label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setForm(f => ({ ...f, quantity: String(Math.max(1, parseInt(f.quantity || "1") - 1)) }))}
                  className="w-11 h-11 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-xl flex items-center justify-center hover:border-blue-400 transition-colors">−</button>
                <input type="number" min="1" max="99" value={form.quantity} dir="ltr"
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-16 text-center text-lg font-bold border-2 border-slate-200 rounded-xl px-2 py-2 outline-none focus:border-blue-400" />
                <button type="button" onClick={() => setForm(f => ({ ...f, quantity: String(Math.min(99, parseInt(f.quantity || "1") + 1)) }))}
                  className="w-11 h-11 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-xl flex items-center justify-center hover:border-blue-400 transition-colors">+</button>
              </div>
            </div>

            {/* Total */}
            <div className="bg-blue-50 rounded-2xl px-5 py-4 flex items-center justify-between border border-blue-100">
              <span className="text-sm font-bold text-blue-700">المبلغ الإجمالي</span>
              <span className="text-2xl font-black text-blue-800">{total} درهم</span>
            </div>

            <button type="submit" disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all">
              {submitting ? "جارٍ إرسال الطلب..." : <span className="flex items-center justify-center gap-2"><ShoppingCart size={18} /> تأكيد الطلب الآن</span>}
            </button>

            <p className="text-center text-xs text-slate-400">
              بالضغط على تأكيد الطلب، توافق على التوصيل والدفع عند الاستلام
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
