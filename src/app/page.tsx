"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CodCrmLogo } from "@/components/CodCrmLogo";

const FEATURES = [
  {
    icon: "📦",
    title: "Gestion des commandes",
    desc: "Pipeline Kanban complet — confirmez, expédiez et suivez chaque commande en temps réel. Statuts automatiques, notes, historique.",
  },
  {
    icon: "🦅",
    title: "Intégration Eagle Express",
    desc: "Expédiez en 1 clic via Eagle Express. Numéro de suivi automatique, sync des statuts livrés/retournés toutes les heures.",
  },
  {
    icon: "📊",
    title: "Dashboard & Analytics",
    desc: "KPIs en temps réel — commandes, taux de livraison, CA, top produits, top villes. Graphiques sur 7j / 30j / 12 mois.",
  },
  {
    icon: "💰",
    title: "Finances & ROAS",
    desc: "Coût par lead, seuil de rentabilité, CA livré vs investi. Suivi des virements Eagle Express. Rapports Telegram automatiques.",
  },
  {
    icon: "👥",
    title: "Équipe & Agents",
    desc: "Gérez vos agents de confirmation avec des rôles (Admin, Agent, Viewer). Suivi des paiements et commissions par agent.",
  },
  {
    icon: "🤖",
    title: "Notifications Telegram",
    desc: "Alertes instantanées pour chaque nouvelle commande. Rapports quotidiens automatisés directement dans votre groupe Telegram.",
  },
  {
    icon: "🛍️",
    title: "Multi-boutiques",
    desc: "Connectez Lightfunnels, Shopify et vos boutiques COD. Toutes vos commandes centralisées dans un seul tableau de bord.",
  },
  {
    icon: "📈",
    title: "Ads Manager intégré",
    desc: "CPP, CPD, ROAS par campagne Facebook & TikTok. Comparez vos performances publicitaires avec votre CA réel livré.",
  },
  {
    icon: "🚀",
    title: "Funnels & Abandons",
    desc: "Récupérez les paniers abandonnés de vos landing pages. Relancez par téléphone, suivez les taux de conversion.",
  },
];

const STATS = [
  { value: "500+", label: "Vendeurs COD actifs" },
  { value: "50K+", label: "Commandes gérées / mois" },
  { value: "98%", label: "Taux de satisfaction" },
  { value: "0 MAD", label: "Pour commencer" },
];

const INTEGRATIONS = [
  { name: "Eagle Express", color: "bg-amber-50 text-amber-700 border-amber-200", icon: "🦅" },
  { name: "Ameex", color: "bg-blue-50 text-blue-700 border-blue-200", icon: "🚚" },
  { name: "Lightfunnels", color: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: "⚡" },
  { name: "Shopify", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "🛒" },
  { name: "Facebook Ads", color: "bg-blue-50 text-blue-800 border-blue-200", icon: "📘" },
  { name: "TikTok Ads", color: "bg-slate-50 text-slate-700 border-slate-200", icon: "🎵" },
  { name: "Telegram", color: "bg-sky-50 text-sky-700 border-sky-200", icon: "✈️" },
  { name: "WhatsApp", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "💬" },
];

const STEPS = [
  {
    step: "01",
    title: "Créez votre compte",
    desc: "Inscription gratuite en 30 secondes. Aucune carte bancaire requise.",
  },
  {
    step: "02",
    title: "Connectez vos boutiques",
    desc: "Lightfunnels, Shopify, Eagle Express — toutes vos sources en quelques clics.",
  },
  {
    step: "03",
    title: "Gérez & encaissez",
    desc: "Confirmez, expédiez, analysez. Votre business COD enfin sous contrôle.",
  },
];

export default function LandingPage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => {
      if (r.ok) {
        setAuthed(true);
        window.location.href = "/dashboard";
      }
    }).catch(() => {});
  }, []);

  if (authed) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <CodCrmLogo size={32} />
          <span className="text-lg font-extrabold text-slate-900 tracking-tight">COD CRM</span>
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
          <a href="#features" className="hover:text-slate-900 transition-colors">Fonctionnalités</a>
          <a href="#integrations" className="hover:text-slate-900 transition-colors">Intégrations</a>
          <a href="#how" className="hover:text-slate-900 transition-colors">Comment ça marche</a>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-xl transition-colors hidden sm:block">
            Se connecter
          </Link>
          <Link href="/login" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-md shadow-blue-200 whitespace-nowrap">
            Démarrer gratuitement →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white overflow-hidden">
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-80px] left-[-80px] w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 rounded-full px-4 py-1.5 text-blue-300 text-sm font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Plateforme COD · Maroc
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6 tracking-tight">
            Votre business COD,<br />
            <span className="text-blue-400">enfin sous contrôle.</span>
          </h1>

          <p className="text-slate-300 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            La plateforme tout-en-un pour les e-commerçants marocains — commandes, livraisons, équipe et finances. Tout au même endroit.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/login"
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-xl shadow-blue-900/50 text-lg">
              Démarrer gratuitement →
            </Link>
            <Link href="/login"
              className="w-full sm:w-auto bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-8 py-4 rounded-2xl transition-all text-lg">
              Se connecter
            </Link>
          </div>

          {/* Dashboard preview card */}
          <div className="relative mx-auto max-w-4xl">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-3 sm:p-4 backdrop-blur-sm shadow-2xl">
              <div className="bg-[#F0F4FF] rounded-2xl p-4 sm:p-6">
                {/* Mini dashboard mockup */}
                <div className="flex items-center justify-between mb-4">
                  <div className="h-3 bg-slate-300/50 rounded-full w-28" />
                  <div className="h-8 bg-blue-600 rounded-xl w-28 opacity-80" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
                  {["bg-blue-100", "bg-emerald-100", "bg-red-100", "bg-violet-100"].map((bg, i) => (
                    <div key={i} className={`${bg} rounded-2xl p-4`}>
                      <div className="h-2 bg-current rounded opacity-30 mb-2 w-16" />
                      <div className="h-5 bg-current rounded opacity-40 w-10" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white rounded-2xl p-4 h-24 flex flex-col gap-2">
                    <div className="h-2 bg-slate-200 rounded-full w-20" />
                    <div className="flex items-end gap-1 flex-1">
                      {[60, 80, 45, 90, 70, 85, 55].map((h, i) => (
                        <div key={i} className="flex-1 bg-blue-500 rounded-t opacity-70" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 h-24 flex flex-col gap-2">
                    <div className="h-2 bg-slate-200 rounded-full w-20" />
                    <div className="flex flex-col gap-1 mt-auto">
                      {[{ w: "75%", c: "bg-blue-500" }, { w: "55%", c: "bg-emerald-400" }, { w: "30%", c: "bg-red-400" }].map((b, i) => (
                        <div key={i} className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${b.c} rounded-full`} style={{ width: b.w }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Glow */}
            <div className="absolute inset-0 -z-10 blur-3xl opacity-20 bg-blue-500 rounded-full" />
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="bg-white py-12 border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 text-center">
            {STATS.map(s => (
              <div key={s.label}>
                <p className="text-3xl sm:text-4xl font-extrabold text-blue-600 mb-1">{s.value}</p>
                <p className="text-sm text-slate-500 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 bg-[#F8FAFF]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="text-center mb-14">
            <span className="text-blue-600 font-bold text-sm uppercase tracking-widest">Fonctionnalités</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2 mb-4">Tout ce dont vous avez besoin</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">Une seule plateforme pour gérer votre activité COD de A à Z.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group">
                <span className="text-3xl mb-4 block">{f.icon}</span>
                <h3 className="text-base font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-8">
          <div className="text-center mb-14">
            <span className="text-blue-600 font-bold text-sm uppercase tracking-widest">Démarrage rapide</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2 mb-4">Opérationnel en 5 minutes</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.step} className="text-center relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden sm:block absolute top-8 left-[calc(50%+2.5rem)] w-[calc(100%-5rem)] h-px bg-blue-100" />
                )}
                <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white text-xl font-extrabold flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-200">
                  {s.step}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integrations ── */}
      <section id="integrations" className="py-20 bg-[#F8FAFF]">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 text-center">
          <span className="text-blue-600 font-bold text-sm uppercase tracking-widest">Intégrations</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2 mb-4">Compatible avec votre stack</h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto mb-12">Tous les outils des e-commerçants COD marocains, connectés en quelques clics.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {INTEGRATIONS.map(integ => (
              <div key={integ.name} className={`flex items-center gap-2 px-5 py-3 rounded-2xl border font-semibold text-sm ${integ.color}`}>
                <span className="text-lg">{integ.icon}</span>
                {integ.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-indigo-700">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Prêt à passer à la vitesse supérieure ?
          </h2>
          <p className="text-blue-100 text-lg mb-10 max-w-xl mx-auto">
            Rejoignez des centaines de vendeurs COD marocains qui gèrent leur business avec COD CRM.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login"
              className="w-full sm:w-auto bg-white hover:bg-blue-50 text-blue-700 font-bold px-8 py-4 rounded-2xl transition-all shadow-xl text-lg">
              Créer mon compte gratuitement →
            </Link>
            <Link href="/login"
              className="w-full sm:w-auto bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold px-8 py-4 rounded-2xl transition-all text-lg">
              Se connecter
            </Link>
          </div>
          <p className="text-blue-200 text-sm mt-6">Gratuit pour commencer · Aucune carte bancaire</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 text-slate-400 py-10 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <CodCrmLogo size={28} />
            <span className="text-white font-bold text-base">COD CRM</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
            <a href="#integrations" className="hover:text-white transition-colors">Intégrations</a>
            <Link href="/privacy" className="hover:text-white transition-colors">Confidentialité</Link>
            <Link href="/login" className="hover:text-white transition-colors">Connexion</Link>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} COD CRM. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
