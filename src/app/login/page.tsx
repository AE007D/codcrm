"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

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
  { icon: "📦", label: "Gestion des commandes COD" },
  { icon: "🚚", label: "Intégration Ameex & Eagle" },
  { icon: "📊", label: "Dashboard & Analytics" },
  { icon: "👥", label: "Gestion d'équipe" },
  { icon: "🤖", label: "Notifications Telegram" },
  { icon: "💰", label: "Finances & ROAS" },
];

function Input({
  label, type = "text", value, onChange, placeholder, required, minLength, autoComplete,
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  required?: boolean; minLength?: number; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={isPassword && show ? "text" : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100 transition-all bg-slate-50 focus:bg-white placeholder:text-slate-400"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium"
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
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const [googleError, setGoogleError] = useState("");
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => { if (r.ok) router.replace("/"); }).finally(() => setCheckingAuth(false));
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
      router.replace("/");
    } catch { setGoogleError("Erreur réseau."); }
  }, [router]);

  useEffect(() => {
    if (checkingAuth) return;
    function init() {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (r: { credential: string }) => handleGoogleCredential(r.credential),
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline", size: "large", width: 368, text: "continue_with",
        shape: "rectangular", locale: "fr",
      });
    }
    if (window.google) { init(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true; s.onload = init;
    document.head.appendChild(s);
    return () => { if (document.head.contains(s)) document.head.removeChild(s); };
  }, [checkingAuth, handleGoogleCredential]);

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
      router.replace("/");
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
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword, storeName: regStore }),
      });
      const data = await res.json();
      if (!res.ok) { setRegError(data.error || "Erreur lors de la création."); return; }
      const loginRes = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail, password: regPassword }),
      });
      if (loginRes.ok) router.replace("/");
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
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[52%] bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-80px] right-[-80px] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-80px] left-[-80px] w-[350px] h-[350px] bg-indigo-600/10 rounded-full blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>
              </svg>
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">COD CRM</span>
          </div>
          <p className="text-blue-300/70 text-sm ml-[52px]">e-commerce Maroc</p>
        </div>

        {/* Hero */}
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Gérez votre business<br />
            <span className="text-blue-400">COD comme un pro</span>
          </h2>
          <p className="text-slate-400 text-base mb-10 max-w-sm">
            La plateforme tout-en-un pour les e-commerçants marocains — commandes, livraisons, équipe et finances.
          </p>

          {/* Features */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(f => (
              <div key={f.label} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/8">
                <span className="text-xl">{f.icon}</span>
                <span className="text-sm text-slate-300 font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="flex -space-x-2">
            {["E", "A", "S"].map((l, i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-blue-600 border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-white">{l}</div>
            ))}
          </div>
          <p className="text-slate-400 text-sm ml-1">Rejoignez des centaines de vendeurs COD</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 bg-slate-50">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg>
          </div>
          <span className="text-xl font-bold text-slate-900">COD CRM</span>
        </div>

        <div className="w-full max-w-[420px]">
          {mode === "login" ? (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Bon retour 👋</h1>
                <p className="text-slate-500 text-sm">Connectez-vous à votre espace CRM</p>
              </div>

              {/* Google button */}
              <div ref={googleBtnRef} className="flex justify-center min-h-[48px] mb-4" />

              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium px-1">ou avec email</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {(loginError || googleError) && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-start gap-2">
                  <span className="mt-0.5">⚠️</span>
                  <span>{loginError || googleError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <Input label="Adresse email" type="email" value={email} onChange={setEmail}
                  placeholder="vous@example.com" required autoComplete="email" />
                <Input label="Mot de passe" type="password" value={password} onChange={setPassword}
                  placeholder="••••••••" required autoComplete="current-password" />
                <button type="submit" disabled={loginLoading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-200 transition-all">
                  {loginLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Connexion...
                    </span>
                  ) : "Se connecter"}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-6">
                Pas encore de compte ?{" "}
                <button onClick={() => { setMode("register"); setLoginError(""); setGoogleError(""); }}
                  className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
                  Créer un compte gratuit
                </button>
              </p>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Créer votre compte</h1>
                <p className="text-slate-500 text-sm">Commencez gratuitement, sans carte bancaire</p>
              </div>

              {/* Google button */}
              <div ref={googleBtnRef} className="flex justify-center min-h-[48px] mb-4" />

              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium px-1">ou avec email</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {regError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-start gap-2">
                  <span className="mt-0.5">⚠️</span>
                  <span>{regError}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Nom complet" value={regName} onChange={setRegName}
                    placeholder="Votre nom" required autoComplete="name" />
                  <Input label="Nom de la boutique" value={regStore} onChange={setRegStore}
                    placeholder="Ma Boutique" autoComplete="organization" />
                </div>
                <Input label="Adresse email" type="email" value={regEmail} onChange={setRegEmail}
                  placeholder="vous@example.com" required autoComplete="email" />
                <Input label="Mot de passe" type="password" value={regPassword} onChange={setRegPassword}
                  placeholder="8 caractères minimum" required minLength={8} autoComplete="new-password" />
                <Input label="Confirmer le mot de passe" type="password" value={regConfirm} onChange={setRegConfirm}
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
                      {regPassword.length < 6 ? "Faible" : regPassword.length < 8 ? "Moyen" : regPassword.length < 10 ? "Bon" : "Fort"}
                    </span>
                  </div>
                )}

                <button type="submit" disabled={regLoading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-200 transition-all mt-1">
                  {regLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Création en cours...
                    </span>
                  ) : "Créer mon compte →"}
                </button>

                <p className="text-xs text-slate-400 text-center">
                  En créant un compte, vous acceptez nos{" "}
                  <a href="/privacy" target="_blank" className="text-blue-500 hover:underline">conditions d&apos;utilisation</a>
                </p>
              </form>

              <p className="text-center text-sm text-slate-500 mt-5">
                Déjà un compte ?{" "}
                <button onClick={() => { setMode("login"); setRegError(""); }}
                  className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
                  Se connecter
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
