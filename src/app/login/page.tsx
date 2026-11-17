"use client";

import { useState, useEffect, useCallback, useId, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CodCrmWordmark } from "@/components/CodCrmLogo";
import { useLang, type Lang } from "@/lib/i18n";
import { Package, Truck, BarChart3, Users, Bot, DollarSign, AlertTriangle } from "lucide-react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: object) => void;
          renderButton: (el: HTMLElement, cfg: object) => void;
        };
      };
    };
  }
}

type Mode = "login" | "register";

const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "50528925336-37s476bkh1kn9qf7s1259vfqks95vvvo.apps.googleusercontent.com";

const FEATURES = [
  { icon: Package, label: "Gestion des commandes COD" },
  { icon: Truck, label: "Intégration Ameex & Eagle" },
  { icon: BarChart3, label: "Dashboard & Analytics" },
  { icon: Users, label: "Gestion d'équipe" },
  { icon: Bot, label: "Notifications Telegram" },
  { icon: DollarSign, label: "Finances & ROAS" },
];

function Input({
  label, type = "text", value, onChange, placeholder, required, minLength, autoComplete,
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  required?: boolean; minLength?: number; autoComplete?: string;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && show ? "text" : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          className={`w-full text-base border border-slate-200 rounded-xl ps-4 py-3 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100 transition-all bg-slate-50 focus:bg-white placeholder:text-slate-400 ${isPassword ? "pe-24" : "pe-4"}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium"
          >
            {show ? "Masquer" : "Afficher"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { lang, setLang, t } = useLang();
  const [mode, setMode] = useState<Mode>("login");
  const [checkingAuth, setCheckingAuth] = useState(true);

  // login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // register
  const [regName, setRegName] = useState("");
  const [regStore, setRegStore] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regShipping, setRegShipping] = useState<string[]>([]);
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const [googleReady, setGoogleReady] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => { if (r.ok) router.replace("/dashboard"); }).catch(() => {}).finally(() => setCheckingAuth(false));
  }, [router]);

  const handleGoogleCredential = useCallback(async (credential: string) => {
    setGoogleError("");
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) { setGoogleError(data.error || "Erreur Google."); return; }
      router.replace("/dashboard");
    } catch { setGoogleError("Erreur réseau."); }
  }, [router]);

  useEffect(() => {
    if (checkingAuth) return;
    const container = googleBtnRef.current;
    if (!container) return;
    let observer: ResizeObserver | undefined;
    let lastWidth = 0;

    function init() {
      if (!window.google || !container) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (r: { credential: string }) => handleGoogleCredential(r.credential),
      });

      function renderButton() {
        if (!window.google || !container) return;
        const width = Math.min(368, Math.floor(container.clientWidth));
        if (!width || width === lastWidth) return;
        lastWidth = width;
        container.replaceChildren();
        window.google.accounts.id.renderButton(container, {
          theme: "outline", size: "large", width, text: "continue_with",
          shape: "rectangular", locale: lang === "mr" ? "fr" : lang,
        });
        setGoogleReady(true);
      }

      renderButton();
      observer = new ResizeObserver(renderButton);
      observer.observe(container);
    }

    if (window.google) {
      init();
      return () => observer?.disconnect();
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = init;
    document.head.appendChild(script);
    return () => {
      observer?.disconnect();
      script.remove();
    };
  }, [checkingAuth, handleGoogleCredential, lang, mode]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(""); setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || "Identifiants incorrects."); return; }
      router.replace("/dashboard");
    } catch { setLoginError("Erreur réseau, réessayez."); }
    finally { setLoginLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    if (regPassword !== regConfirm) { setRegError("Les mots de passe ne correspondent pas."); return; }
    if (regPassword.length < 8) { setRegError("Le mot de passe doit contenir au moins 8 caractères."); return; }
    setRegLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword, storeName: regStore, shippingCompanies: regShipping }),
      });
      const data = await res.json();
      if (!res.ok) { setRegError(data.error || "Erreur lors de la création."); return; }
      const loginRes = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail, password: regPassword }),
      });
      if (loginRes.ok) router.replace("/dashboard");
      else { setMode("login"); setEmail(regEmail); }
    } catch { setRegError("Erreur réseau, réessayez."); }
    finally { setRegLoading(false); }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="crm-login min-h-dvh flex">
      {/* Left panel — branding */}
      <div className="hidden md:flex md:w-[48%] lg:w-[52%] bg-gradient-to-br from-[#080B2C] via-[#101535] to-[#172044] flex-col justify-between p-8 lg:p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-80px] right-[-80px] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-80px] left-[-80px] w-[350px] h-[350px] bg-indigo-600/10 rounded-full blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <CodCrmWordmark width={210} onDark />

        </div>

        {/* Hero */}
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Votre business COD,<br />
            <span className="text-blue-400">enfin sous contrôle.</span>
          </h2>
          <p className="text-slate-400 text-base mb-10 max-w-sm">
            La plateforme tout-en-un pour les e-commerçants marocains — commandes, livraisons, équipe et finances.
          </p>

          {/* Features */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map(f => (
              <div key={f.label} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/8">
                <f.icon size={18} className="text-blue-300 shrink-0" />
                <span className="text-sm text-slate-300 font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(number => (
              <Image key={number} src={`/sign-in/avatar-${number}.webp`} width={40} height={40} alt=""
                className="size-10 rounded-full border-2 border-[#101535] object-cover" />
            ))}
          </div>
          <p className="text-slate-400 text-sm ml-1">Rejoignez des centaines de vendeurs COD</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center bg-slate-50 px-4 pb-8 pt-16 sm:px-8 lg:px-12">
        {/* Language picker */}
        <div className="absolute top-4 end-4 flex gap-1">
          {(["fr", "ar", "en", "mr"] as Lang[]).map(l => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors uppercase ${
                lang === l ? "bg-blue-600 text-white border-blue-600" : "text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600"
              }`}>
              {l}
            </button>
          ))}
        </div>
        {/* Mobile logo */}
        <div className="mb-8 md:hidden">
          <CodCrmWordmark width={168} />

        </div>

        <div className="w-full max-w-[420px]">
          {mode === "login" ? (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">{t("welcome_back")}</h1>
                <p className="text-slate-500 text-sm">{t("sign_in_subtitle")}</p>
              </div>

              {/* Google button */}
              <div ref={googleBtnRef} className="flex w-full justify-center" />

              {googleReady && <div className="mb-4 mt-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium px-1">{t("or_with_email")}</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>}

              {(loginError || googleError) && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>{loginError || googleError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <Input label={t("email")} type="email" value={email} onChange={setEmail}
                  placeholder="vous@example.com" required autoComplete="email" />
                <Input label={t("password")} type="password" value={password} onChange={setPassword}
                  placeholder="••••••••" required autoComplete="current-password" />
                <button type="submit" disabled={loginLoading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all">
                  {loginLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t("signing_in")}
                    </span>
                  ) : t("sign_in")}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-6">
                Pas encore de compte ?{" "}
                <a href="https://wa.me/212644587812" target="_blank" rel="noopener noreferrer"
                  className="text-green-600 font-semibold hover:text-green-700 transition-colors">
                  Contactez-nous sur WhatsApp
                </a>
              </p>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">{t("create_account")}</h1>
                <p className="text-slate-500 text-sm">{t("create_subtitle")}</p>
              </div>

              {/* Google button */}
              <div ref={googleBtnRef} className="flex w-full justify-center" />

              {googleReady && <div className="mb-4 mt-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium px-1">{t("or_with_email")}</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>}

              {regError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input label={t("full_name")} value={regName} onChange={setRegName}
                    placeholder="Votre nom" required autoComplete="name" />
                  <Input label={t("store_name")} value={regStore} onChange={setRegStore}
                    placeholder="Ma Boutique" autoComplete="organization" />
                </div>

                {/* Shipping companies */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Transporteurs utilisés</label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { id: "ameex", label: "Ameex" },
                      { id: "eagle", label: "Maystro (Eagle)" },
                    ].map(({ id, label }) => {
                      const checked = regShipping.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setRegShipping(prev => checked ? prev.filter(x => x !== id) : [...prev, id])}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            checked
                              ? "bg-blue-50 border-blue-400 text-blue-700"
                              : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                            checked ? "bg-blue-500 border-blue-500" : "border-slate-300 bg-white"
                          }`}>
                            {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </span>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Input label={t("email")} type="email" value={regEmail} onChange={setRegEmail}
                  placeholder="vous@example.com" required autoComplete="email" />
                <Input label={t("password")} type="password" value={regPassword} onChange={setRegPassword}
                  placeholder="8 caractères minimum" required minLength={8} autoComplete="new-password" />
                <Input label={t("confirm_password")} type="password" value={regConfirm} onChange={setRegConfirm}
                  placeholder="Répétez le mot de passe" required autoComplete="new-password" />

                {/* Password strength */}
                {regPassword.length > 0 && (
                  <div className="flex gap-1">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                        regPassword.length >= [4,6,8,10][i]
                          ? ["bg-red-400","bg-amber-400","bg-blue-400","bg-emerald-500"][i]
                          : "bg-slate-200"
                      }`} />
                    ))}
                    <span className="text-xs text-slate-400 ml-1">
                      {regPassword.length < 6 ? t("pw_weak") : regPassword.length < 8 ? t("pw_medium") : regPassword.length < 10 ? t("pw_good") : t("pw_strong")}
                    </span>
                  </div>
                )}

                <button type="submit" disabled={regLoading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all mt-1">
                  {regLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t("creating")}
                    </span>
                  ) : t("create_my_account")}
                </button>

                <p className="text-xs text-slate-400 text-center">
                  En créant un compte, vous acceptez nos{" "}
                  <a href="/privacy" target="_blank" className="text-blue-500 hover:underline">conditions d&apos;utilisation</a>
                </p>
              </form>

              <p className="text-center text-sm text-slate-500 mt-5">
                {t("already_account")}{" "}
                <button onClick={() => { setMode("login"); setRegError(""); }}
                  className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
                  {t("sign_in")}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
