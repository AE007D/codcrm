"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
};

function AvatarDisplay({ avatar, name, size = 88 }: { avatar: string | null; name: string; size?: number }) {
  const colors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  if (avatar) {
    return (
      <div className="rounded-2xl overflow-hidden border-2 border-white shadow-lg" style={{ width: size, height: size }}>
        <Image src={avatar} alt={name} width={size} height={size} className="object-cover w-full h-full" unoptimized />
      </div>
    );
  }
  return (
    <div className={`${color} rounded-2xl flex items-center justify-center text-white font-bold shadow-lg border-2 border-white`}
      style={{ width: size, height: size, fontSize: size * 0.32 }}>
      {initials}
    </div>
  );
}

export default function ComptePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [name, setName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Password form
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setUser(data);
          setName(data.name);
          setAvatarPreview(data.avatar ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      setAvatarPreview(result);
    };
    reader.readAsDataURL(file);
  }

  function removeAvatar() {
    setAvatarPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileSaving(true);
    try {
      const body: Record<string, string> = { name };
      // Always send avatar (null = remove, string = set)
      body.avatar = avatarPreview ?? "";
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatar: avatarPreview ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileMsg({ ok: false, text: data.error || "Erreur." });
      } else {
        setUser(data.user);
        setProfileMsg({ ok: true, text: "Profil mis à jour ✓" });
        // Refresh sidebar
        window.dispatchEvent(new Event("profile-updated"));
      }
    } catch {
      setProfileMsg({ ok: false, text: "Erreur réseau." });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd !== confirmPwd) {
      setPwdMsg({ ok: false, text: "Les mots de passe ne correspondent pas." });
      return;
    }
    if (newPwd.length < 6) {
      setPwdMsg({ ok: false, text: "Le mot de passe doit faire au moins 6 caractères." });
      return;
    }
    setPwdSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwdMsg({ ok: false, text: data.error || "Erreur." });
      } else {
        setPwdMsg({ ok: true, text: "Mot de passe changé ✓" });
        setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      }
    } catch {
      setPwdMsg({ ok: false, text: "Erreur réseau." });
    } finally {
      setPwdSaving(false);
    }
  }

  const roleLabels: Record<string, string> = { admin: "Administrateur", agent: "Agent", viewer: "Viewer" };
  const roleColors: Record<string, string> = {
    admin: "bg-blue-100 text-blue-700",
    agent: "bg-emerald-100 text-emerald-700",
    viewer: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8">
          <h1 className="text-xl font-bold text-slate-900">Mon compte</h1>
          <p className="text-sm text-slate-400 hidden sm:block">Gérez votre profil et votre mot de passe</p>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !user ? (
            <p className="text-red-500 text-sm">Impossible de charger le profil.</p>
          ) : (
            <div className="max-w-2xl flex flex-col gap-6">

              {/* Profile card */}
              <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h2 className="text-base font-bold text-slate-900 mb-5">Informations du profil</h2>

                {/* Avatar section */}
                <div className="flex items-center gap-5 mb-6">
                  <div className="relative">
                    <AvatarDisplay avatar={avatarPreview} name={name || user.name} size={88} />
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md hover:bg-blue-700 transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Photo de profil</p>
                    <p className="text-xs text-slate-400 mt-0.5 mb-3">JPG, PNG ou GIF · max 2 Mo</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => fileRef.current?.click()}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                        Changer la photo
                      </button>
                      {avatarPreview && (
                        <button type="button" onClick={removeAvatar}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 transition-colors">
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>

                {/* Name */}
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nom complet</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                  </div>

                  {/* Email (read-only) */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email</label>
                    <input type="email" value={user.email} readOnly
                      className="w-full text-sm border border-slate-100 rounded-xl px-4 py-2.5 bg-slate-50 text-slate-400 cursor-not-allowed" />
                    <p className="text-xs text-slate-400 mt-1">L&apos;email ne peut pas être modifié.</p>
                  </div>

                  {/* Role (read-only) */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Rôle</label>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${roleColors[user.role] ?? "bg-slate-100 text-slate-600"}`}>
                        {roleLabels[user.role] ?? user.role}
                      </span>
                    </div>
                  </div>
                </div>

                {profileMsg && (
                  <div className={`mt-4 text-sm px-4 py-3 rounded-xl ${profileMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                    {profileMsg.text}
                  </div>
                )}

                <div className="mt-5 flex justify-end">
                  <button type="submit" disabled={profileSaving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-md shadow-blue-200 transition-colors">
                    {profileSaving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </div>
              </form>

              {/* Password card */}
              <form onSubmit={handleSavePassword} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h2 className="text-base font-bold text-slate-900 mb-5">Changer le mot de passe</h2>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Mot de passe actuel</label>
                    <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} required
                      placeholder="••••••••"
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nouveau mot de passe</label>
                    <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required minLength={6}
                      placeholder="••••••••"
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Confirmer le nouveau mot de passe</label>
                    <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required minLength={6}
                      placeholder="••••••••"
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                  </div>
                </div>

                {pwdMsg && (
                  <div className={`mt-4 text-sm px-4 py-3 rounded-xl ${pwdMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                    {pwdMsg.text}
                  </div>
                )}

                <div className="mt-5 flex justify-end">
                  <button type="submit" disabled={pwdSaving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-md shadow-blue-200 transition-colors">
                    {pwdSaving ? "Enregistrement…" : "Changer le mot de passe"}
                  </button>
                </div>
              </form>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
