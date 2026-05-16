"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: object) => void;
          prompt: () => void;
          renderButton: (el: HTMLElement, cfg: object) => void;
        };
      };
    };
  }
}

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();

  // login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // register form
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const [mode, setMode] = useState<Mode>("login");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [googleError, setGoogleError] = useState("");
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(res => {
      if (res.ok) router.replace("/");
    }).finally(() => setCheckingAuth(false));
  }, [router]);

  const handleGoogleCredential = useCallback(async (credential: string) => {
    setGoogleError("");
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) { setGoogleError(data.error || "Erreur Google."); return; }
      router.replace("/");
    } catch {
      setGoogleError("Erreur réseau, veuillez réessayer.");
    }
  }, [router]);

  // Load Google GSI script — only initialize button after auth check completes and form is visible
  useEffect(() => {
    if (checkingAuth) return; // wait until login form is actually rendered

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      || "50528925336-37s476bkh1kn9qf7s1259vfqks95vvvo.apps.googleusercontent.com";

    function initButton() {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp: { credential: string }) => handleGoogleCredential(resp.credential),
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline", size: "large", width: 352,
        text: "signin_with", shape: "rectangular", locale: "fr",
      });
    }

    // If script already loaded (e.g. hot reload), init immediately
    if (window.google) { initButton(); return; }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initButton;
    document.head.appendChild(script);
    return () => { if (document.head.contains(script)) document.head.removeChild(script); };
  }, [checkingAuth, handleGoogleCredential]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Erreur de connexion.");
        return;
      }
      router.replace("/");
    } catch {
      setLoginError("Erreur réseau, veuillez réessayer.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    setRegLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error || "Erreur lors de la création du compte.");
        return;
      }
      // Auto-login after register
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail, password: regPassword }),
      });
      if (loginRes.ok) {
        router.replace("/");
      } else {
        setMode("login");
        setEmail(regEmail);
      }
    } catch {
      setRegError("Erreur réseau, veuillez réessayer.");
    } finally {
      setRegLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#F0F4FF] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F4FF] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 mb-3">
            <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">COD CRM</h1>
          <p className="text-sm text-slate-400 mt-1">e-commerce Maroc</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          {mode === "login" ? (
            <>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Connexion</h2>
              <p className="text-sm text-slate-400 mb-6">Entrez vos identifiants pour accéder au CRM</p>

              {loginError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.ma"
                    required
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Mot de passe</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200 transition-all mt-1"
                >
                  {loginLoading ? "Connexion..." : "Se connecter"}
                </button>
              </form>

              <div className="mt-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs text-slate-400 font-medium">ou</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                {googleError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-3">
                    {googleError}
                  </div>
                )}
                <div ref={googleBtnRef} className="flex justify-center min-h-[44px]" />
              </div>

              <div className="mt-5 text-center">
                <button
                  onClick={() => { setMode("register"); setLoginError(""); }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Créer un compte
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Créer un compte</h2>
              <p className="text-sm text-slate-400 mb-6">Rejoindre l'équipe COD CRM</p>

              {regError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
                  {regError}
                </div>
              )}

              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nom complet</label>
                  <input
                    type="text"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    placeholder="Votre nom"
                    required
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="votre@email.ma"
                    required
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Mot de passe</label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200 transition-all mt-1"
                >
                  {regLoading ? "Création..." : "Créer mon compte"}
                </button>
              </form>

              <div className="mt-5 text-center">
                <button
                  onClick={() => { setMode("login"); setRegError(""); }}
                  className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Retour à la connexion
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
