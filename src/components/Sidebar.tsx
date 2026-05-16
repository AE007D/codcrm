"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "agent" | "viewer";
  avatar?: string | null;
};

type NavItem = { label: string; href: string; icon: React.ReactNode; adminOnly?: boolean; agentVisible?: boolean };

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", adminOnly: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )},
  { label: "Commandes", href: "/commandes", agentVisible: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>
    </svg>
  )},
  { label: "Mes Paiements", href: "/paiements", agentVisible: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  )},
  { label: "Funnels & Leads", href: "/funnels", adminOnly: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
    </svg>
  )},
  { label: "Clients", href: "/clients", adminOnly: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )},
  { label: "Produits", href: "/produits", adminOnly: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  )},
  { label: "Boutiques", href: "/boutiques", adminOnly: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )},
  { label: "Équipe", href: "/equipe", adminOnly: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )},
  { label: "Paiements équipe", href: "/paiements", adminOnly: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  )},
  { label: "Finances", href: "/finances", adminOnly: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  )},
  { label: "Calculateur", href: "/calculateur", adminOnly: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/>
      <line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/>
    </svg>
  )},
  { label: "En Transit", href: "/transit", adminOnly: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3M9 17h6m4 0h2"/><circle cx="7" cy="17" r="2"/>
      <path d="M13 17V9h5l3 4v4h-2"/><circle cx="19" cy="17" r="2"/>
    </svg>
  )},
  { label: "Visiteurs live", href: "/visiteurs", adminOnly: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  )},
  { label: "Ads Manager", href: "/ads", adminOnly: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  )},
  { label: "Telegram", href: "/telegram", adminOnly: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M21.5 4.5L2.5 10.5l7 2m12-8L17 21.5l-7.5-9m12-8l-10 7"/>
    </svg>
  )},
  { label: "Intégrations", href: "/integrations", adminOnly: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
    </svg>
  )},
  { label: "Rapports", href: "/rapports", adminOnly: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  )},
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Fetch current user (and re-fetch on profile updates)
  function fetchMe() {
    fetch("/api/auth/me")
      .then(r => {
        if (r.status === 401) { window.location.href = "/login"; return null; }
        return r.ok ? r.json() : null;
      })
      .then(data => { if (data) setCurrentUser(data); })
      .catch(() => {});
  }
  useEffect(() => {
    fetchMe();
    window.addEventListener("profile-updated", fetchMe);
    return () => window.removeEventListener("profile-updated", fetchMe);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
    } catch {
      setLoggingOut(false);
    }
  }

  // ── New order sound + polling ─────────────────────────────────────────────
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastOrderCount = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlocked = useRef(false);

  // Notification bell state
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [nouveauOrders, setNouveauOrders] = useState<{ id: string; customerName: string; product: string; totalPrice: number }[]>([]);
  const [confirmedOrders, setConfirmedOrders] = useState<{ id: string; customerName: string; product: string; totalPrice: number }[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifTotal = nouveauOrders.length + confirmedOrders.length;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifDropdown(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Pre-load the MP3 once
  useEffect(() => {
    const audio = new Audio("/sell-sound.mp3");
    audio.preload = "auto";
    audioRef.current = audio;
  }, []);

  function playChaChing() {
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } catch { /* browser blocked audio */ }
  }

  // Unlock audio on first user interaction (required by browsers)
  useEffect(() => {
    function unlock() {
      audioUnlocked.current = true;
      // Pre-play at volume 0 to warm up the audio context
      if (audioRef.current) {
        audioRef.current.volume = 0;
        audioRef.current.play().then(() => {
          audioRef.current!.pause();
          audioRef.current!.currentTime = 0;
          audioRef.current!.volume = 1;
        }).catch(() => {});
      }
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    }
    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Poll for new orders every 30s — also track pending/confirmed
  useEffect(() => {
    async function checkOrders() {
      try {
        const res = await fetch("/api/orders");
        if (!res.ok) return;
        const data = await res.json();
        const orders: { id: string; customerName?: string; customer_name?: string; product?: string; totalPrice?: number; total_price?: number; status?: string }[] = data.orders ?? [];
        const count = orders.length;

        // Update notification buckets
        const toConfirm = orders.filter(o => o.status === "nouveau").map(o => ({
          id: o.id,
          customerName: o.customerName ?? o.customer_name ?? "Client",
          product: o.product ?? "",
          totalPrice: Number(o.totalPrice ?? o.total_price ?? 0),
        }));
        const toShip = orders.filter(o => o.status === "confirmé").map(o => ({
          id: o.id,
          customerName: o.customerName ?? o.customer_name ?? "Client",
          product: o.product ?? "",
          totalPrice: Number(o.totalPrice ?? o.total_price ?? 0),
        }));
        setNouveauOrders(toConfirm);
        setConfirmedOrders(toShip);

        if (lastOrderCount.current === null) {
          lastOrderCount.current = count;
        } else if (count > lastOrderCount.current) {
          const newCount = count - lastOrderCount.current;
          lastOrderCount.current = count;
          if (soundEnabled && audioUnlocked.current) {
            const plays = Math.min(newCount, 3);
            for (let i = 0; i < plays; i++) setTimeout(() => playChaChing(), i * 700);
          }
          // Browser notification
          if (Notification.permission === "granted") {
            new Notification(`🛍️ ${newCount} nouvelle${newCount > 1 ? "s" : ""} commande${newCount > 1 ? "s" : ""}`, {
              body: "Cliquez pour voir les commandes à confirmer",
              icon: "/favicon.ico",
            });
          }
          window.dispatchEvent(new CustomEvent("new-orders", { detail: { count: newCount } }));
        }
      } catch { /* ignore */ }
    }

    // Request browser notification permission
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    checkOrders();
    const interval = setInterval(checkOrders, 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled]);

  // Pending payment requests badge (admin only)
  const [pendingPayments, setPendingPayments] = useState(0);
  useEffect(() => {
    if (currentUser?.role !== "admin") return;
    fetch("/api/payment-requests")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.requests) setPendingPayments(d.requests.filter((r: { status: string }) => r.status === "pending").length);
      })
      .catch(() => {});
    const t = setInterval(() => {
      if (currentUser?.role !== "admin") return;
      fetch("/api/payment-requests")
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.requests) setPendingPayments(d.requests.filter((r: { status: string }) => r.status === "pending").length);
        }).catch(() => {});
    }, 60_000);
    return () => clearInterval(t);
  }, [currentUser?.role]);

  const roleBadgeLabel: Record<string, string> = {
    admin: "Admin",
    agent: "Agent",
    viewer: "Viewer",
  };
  const roleColors: Record<string, string> = {
    admin: "bg-blue-100 text-blue-700",
    agent: "bg-emerald-100 text-emerald-700",
    viewer: "bg-slate-100 text-slate-600",
  };
  const userRole = currentUser?.role ?? "agent";
  const userInitial = (currentUser?.name ?? "?")[0].toUpperCase();

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="lg:hidden fixed top-3.5 left-3.5 z-[60] w-9 h-9 bg-white rounded-xl shadow-md border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
        aria-label="Menu"
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-[55] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-[58]
        w-72 lg:w-64 h-full lg:h-auto
        bg-white border-r border-slate-100 flex flex-col shrink-0 shadow-sm
        transition-transform duration-200 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200 shrink-0">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-base font-bold text-slate-900 leading-none">COD CRM</span>
              <p className="text-xs text-slate-400 mt-0.5">e-commerce Maroc</p>
            </div>

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifDropdown(v => !v)}
                className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
                title="Notifications"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
                {notifTotal > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse shadow-md">
                    {notifTotal > 99 ? "99+" : notifTotal}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {showNotifDropdown && (
                <div className="absolute top-11 left-0 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-[100] overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">Notifications</span>
                    {notifTotal === 0 && <span className="text-xs text-slate-400">Tout est à jour ✓</span>}
                    {notifTotal > 0 && <span className="text-xs font-semibold text-red-500">{notifTotal} en attente</span>}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {/* Orders to confirm */}
                    {nouveauOrders.length > 0 && (
                      <div>
                        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                          <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                            📞 À confirmer ({nouveauOrders.length})
                          </span>
                        </div>
                        {nouveauOrders.slice(0, 5).map(o => (
                          <Link key={o.id} href="/commandes" onClick={() => setShowNotifDropdown(false)}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-50 transition-colors">
                            <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{o.customerName}</p>
                              <p className="text-xs text-slate-400 truncate">{o.product}</p>
                            </div>
                            <span className="text-xs font-bold text-slate-600 shrink-0">{o.totalPrice} MAD</span>
                          </Link>
                        ))}
                        {nouveauOrders.length > 5 && (
                          <Link href="/commandes" onClick={() => setShowNotifDropdown(false)}
                            className="block px-4 py-2 text-xs text-center text-amber-600 font-semibold hover:bg-amber-50">
                            +{nouveauOrders.length - 5} de plus →
                          </Link>
                        )}
                      </div>
                    )}

                    {/* Orders to ship */}
                    {confirmedOrders.length > 0 && (
                      <div>
                        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                          <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                            🚚 À expédier ({confirmedOrders.length})
                          </span>
                        </div>
                        {confirmedOrders.slice(0, 5).map(o => (
                          <Link key={o.id} href="/commandes" onClick={() => setShowNotifDropdown(false)}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-50 transition-colors">
                            <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{o.customerName}</p>
                              <p className="text-xs text-slate-400 truncate">{o.product}</p>
                            </div>
                            <span className="text-xs font-bold text-slate-600 shrink-0">{o.totalPrice} MAD</span>
                          </Link>
                        ))}
                        {confirmedOrders.length > 5 && (
                          <Link href="/commandes" onClick={() => setShowNotifDropdown(false)}
                            className="block px-4 py-2 text-xs text-center text-blue-600 font-semibold hover:bg-blue-50">
                            +{confirmedOrders.length - 5} de plus →
                          </Link>
                        )}
                      </div>
                    )}

                    {notifTotal === 0 && (
                      <div className="px-4 py-8 text-center">
                        <p className="text-2xl mb-2">✅</p>
                        <p className="text-sm text-slate-500">Aucune commande en attente</p>
                      </div>
                    )}
                  </div>

                  {notifTotal > 0 && (
                    <div className="px-4 py-3 border-t border-slate-100">
                      <Link href="/commandes" onClick={() => setShowNotifDropdown(false)}
                        className="block w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl text-center transition-colors">
                        Voir toutes les commandes →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2 mt-1">Menu</p>
          {navItems.filter(item => {
            if (!currentUser) return false;
            if (currentUser.role === "admin") return true; // admin sees all
            if (currentUser.role === "agent") return item.agentVisible === true;
            return false;
          }).map((item) => {
            const active = pathname === item.href;
            const isPaiementsAdmin = item.href === "/paiements" && currentUser?.role === "admin" && pendingPayments > 0;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {isPaiementsAdmin && (
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {pendingPayments}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100">
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(v => !v)}
            title={soundEnabled ? "Désactiver le son" : "Activer le son"}
            className="w-full mb-1 flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            {soundEnabled ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-emerald-500">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"/>
                </svg>
                <span className="text-slate-500">Son activé</span>
                <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400"/>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
                <span>Son désactivé</span>
              </>
            )}
          </button>

          <Link href="/compte" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-xl shrink-0 overflow-hidden shadow-md shadow-blue-100">
              {currentUser?.avatar ? (
                <Image src={currentUser.avatar} alt={currentUser.name} width={32} height={32} className="object-cover w-full h-full" unoptimized />
              ) : (
                <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                  {userInitial}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-slate-800 leading-none truncate">
                  {currentUser?.name ?? "Chargement..."}
                </p>
                {currentUser && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${roleColors[userRole]}`}>
                    {roleBadgeLabel[userRole]}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {currentUser?.email ?? ""}
              </p>
            </div>
            {/* Settings icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {loggingOut ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      </aside>
    </>
  );
}
