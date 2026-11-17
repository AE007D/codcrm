"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CodCrmWordmark } from "@/components/CodCrmLogo";
import { Package, Bird, BarChart3, DollarSign, Users, Bot, ShoppingBag, TrendingUp, Rocket, Zap, ShoppingCart, Megaphone, Music2, Send, MessageCircle, type LucideIcon } from "lucide-react";

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Package,
    title: "Gestion des commandes",
    desc: "Pipeline Kanban complet — confirmez, expédiez et suivez chaque commande en temps réel. Statuts automatiques, notes, historique.",
  },
  {
    icon: Bird,
    title: "Intégration Eagle Express",
    desc: "Expédiez en 1 clic via Eagle Express. Numéro de suivi automatique, sync des statuts livrés/retournés toutes les heures.",
  },
  {
    icon: BarChart3,
    title: "Dashboard & Analytics",
    desc: "KPIs en temps réel — commandes, taux de livraison, CA, top produits, top villes. Graphiques sur 7j / 30j / 12 mois.",
  },
  {
    icon: DollarSign,
    title: "Finances & ROAS",
    desc: "Coût par lead, seuil de rentabilité, CA livré vs investi. Suivi des virements Eagle Express. Rapports Telegram automatiques.",
  },
  {
    icon: Users,
    title: "Équipe & Agents",
    desc: "Gérez vos agents de confirmation avec des rôles (Admin, Agent, Viewer). Suivi des paiements et commissions par agent.",
  },
  {
    icon: Bot,
    title: "Notifications Telegram",
    desc: "Alertes instantanées pour chaque nouvelle commande. Rapports quotidiens automatisés directement dans votre groupe Telegram.",
  },
  {
    icon: ShoppingBag,
    title: "Multi-boutiques",
    desc: "Connectez Lightfunnels, Shopify et vos boutiques COD. Toutes vos commandes centralisées dans un seul tableau de bord.",
  },
  {
    icon: TrendingUp,
    title: "Ads Manager intégré",
    desc: "CPP, CPD, ROAS par campagne Facebook & TikTok. Comparez vos performances publicitaires avec votre CA réel livré.",
  },
  {
    icon: Rocket,
    title: "Funnels & Abandons",
    desc: "Récupérez les paniers abandonnés de vos landing pages. Relancez par téléphone, suivez les taux de conversion.",
  },
];

const INTEGRATIONS: { name: string; color: string; icon: LucideIcon }[] = [
  { name: "Eagle Express", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Bird },

  { name: "Lightfunnels", color: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: Zap },
  { name: "Shopify", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: ShoppingCart },
  { name: "Facebook Ads", color: "bg-blue-50 text-blue-800 border-blue-200", icon: Megaphone },
  { name: "TikTok Ads", color: "bg-slate-50 text-slate-700 border-slate-200", icon: Music2 },
  { name: "Telegram", color: "bg-sky-50 text-sky-700 border-sky-200", icon: Send },
  { name: "WhatsApp", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: MessageCircle },
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
    <div className="min-h-screen bg-[#080B2C] text-white overflow-x-hidden">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#080B2C]/95 backdrop-blur px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <CodCrmWordmark width={148} onDark />
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#features" className="hover:text-[#F08061] transition-colors">Fonctionnalités</a>
          <a href="#pricing" className="hover:text-[#F08061] transition-colors">Tarifs</a>
          <a href="#integrations" className="hover:text-[#F08061] transition-colors">Partenaires</a>
        </div>
        <Link href="/login" className="rounded-xl bg-[#E97858] hover:bg-[#F28B6C] text-white text-sm font-bold px-5 py-3 shadow-lg shadow-[#E97858]/20 transition-colors whitespace-nowrap">
          Démarrer gratuitement
        </Link>
      </nav>

      <section className="relative overflow-hidden bg-[#080B2C]">
        <div className="pointer-events-none absolute -top-24 right-0 h-[34rem] w-[34rem] rounded-full bg-[#E97858]/10 blur-[110px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-16 sm:px-8 lg:min-h-[610px] lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:pt-20">
          <div className="relative z-10 max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E97858]/30 bg-[#E97858]/10 px-4 py-2 text-sm font-semibold text-[#F49A7E]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#E97858]" /> Plateforme COD · Maroc
            </div>
            <h1 className="mb-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[4.25rem]">
              Gérez votre<br /><span className="text-[#E97858]">E-commerce COD</span><br />au Maroc
            </h1>
            <p className="mb-9 max-w-lg text-lg leading-relaxed text-slate-300 sm:text-xl">
              Automatisez vos confirmations, suivez vos livraisons et maximisez vos revenus.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="rounded-xl bg-[#E97858] px-7 py-4 text-center text-lg font-bold text-white shadow-xl shadow-[#E97858]/20 transition hover:bg-[#F28B6C]">
                Essai Gratuit
              </Link>
              <a href="#preview" className="rounded-xl border border-white/50 px-7 py-4 text-center text-lg font-semibold text-white transition hover:border-[#E97858] hover:text-[#F49A7E]">
                Voir la Démo
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-400">Gratuit pour commencer · Aucune carte bancaire</p>
          </div>

          <div id="preview" className="relative lg:-mr-36">
            <div className="absolute -inset-5 rounded-[2rem] bg-[#E97858]/15 blur-3xl" />
            <div className="relative overflow-hidden rounded-[1.5rem] border-[3px] border-[#D87558] bg-[#101535] p-2 shadow-[0_0_55px_rgba(233,120,88,0.24)] sm:p-3">
              <div className="flex min-h-[340px] overflow-hidden rounded-xl border border-white/10 bg-[#0B1030]">
                <aside className="hidden w-32 shrink-0 border-r border-white/10 bg-[#090E2B] p-4 sm:block">
                  <div className="mb-8 flex items-center gap-2 text-[10px] font-bold text-white"><span className="h-5 w-5 rounded bg-[#E97858]"/> COD CRM</div>
                  {["Tableau de bord", "Commandes", "Livraisons", "Produits", "Finances"].map((item, i) => (
                    <div key={item} className={`mb-2 rounded-lg px-2 py-2 text-[9px] ${i === 0 ? "bg-[#E97858]/15 text-[#F49A7E]" : "text-slate-400"}`}>{item}</div>
                  ))}
                </aside>
                <div className="min-w-0 flex-1 p-3 sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div><p className="text-[9px] text-slate-400">Boutique · Admin</p><p className="text-sm font-bold">Tableau de bord</p></div>
                    <div className="rounded-lg border border-white/10 px-2 py-1 text-[9px] text-slate-400">Aujourd&apos;hui⌄</div>
                  </div>
                  <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {[
                      { label: "Commandes livrées", value: "128", color: "bg-[#E97858]" },
                      { label: "CA encaissé", value: "24 850 MAD", color: "bg-[#172044]" },
                      { label: "Taux livraison", value: "87,4%", color: "bg-[#172044]" },
                      { label: "Bénéfice net", value: "8 450 MAD", color: "bg-[#172044]" },
                    ].map(card => <div key={card.label} className={`${card.color} rounded-xl p-3`}><p className="mb-2 text-[8px] text-white/70">{card.label}</p><p className="text-xs font-extrabold sm:text-sm">{card.value}</p></div>)}
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-[#111936] p-3">
                      <div className="mb-3 flex justify-between text-[9px]"><span className="font-semibold">Commandes & revenus</span><span className="text-slate-500">7 derniers jours</span></div>
                      <div className="flex h-28 items-end gap-2 border-b border-white/10 px-1">
                        {[36, 55, 43, 74, 59, 88, 68, 96, 70, 82, 57, 91].map((h, i) => <div key={i} className={`flex-1 rounded-t-sm ${i % 3 === 0 ? "bg-[#E97858]" : "bg-[#4B5A85]"}`} style={{height:`${h}%`}} />)}
                      </div>
                      <div className="mt-2 flex justify-between text-[8px] text-slate-500"><span>Lun</span><span>Mer</span><span>Ven</span><span>Dim</span></div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#111936] p-3">
                      <div className="mb-3 text-[9px] font-semibold">Performance par ville</div>
                      <div className="flex h-28 items-center justify-center">
                        <div className="relative flex h-24 w-28 items-center justify-center">
                          <div className="absolute h-14 w-14 rotate-45 rounded-[40%_15%_40%_15%] bg-[#E97858]" />
                          <div className="absolute ml-7 mt-6 h-10 w-10 rotate-45 rounded-[40%_15%_40%_15%] bg-[#F5B49E]" />
                          <div className="absolute -bottom-1 left-0 text-[8px] text-slate-400">Maroc · commandes livrées</div>
                        </div>
                        <div className="ml-3 space-y-2 text-[8px] text-slate-400"><p><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#E97858]"/>Casablanca</p><p><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#F5B49E]"/>Rabat</p></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="integrations" className="border-y border-white/10 bg-[#0B0F31] py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-8">
          <h2 className="mb-8 text-3xl font-bold sm:text-4xl">Partenaires & intégrations</h2>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
            {INTEGRATIONS.map(integ => (
              <div key={integ.name} className="flex items-center gap-2 text-sm font-bold text-slate-300 sm:text-base">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-[#F49A7E]"><integ.icon size={18} /></span>{integ.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-[#080B2C] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-[#F08061]">Fonctionnalités</p>
            <h2 className="text-3xl font-extrabold sm:text-4xl">Tout votre COD au même endroit</h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-400">Commandes, stock, équipe et finances : gardez une vue claire sur votre activité.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.slice(0, 6).map(f => <div key={f.title} className="rounded-2xl border border-white/10 bg-[#101535] p-6 transition hover:border-[#E97858]/50">
              <f.icon size={26} className="mb-4 text-[#E97858]" /><h3 className="mb-2 font-bold">{f.title}</h3><p className="text-sm leading-relaxed text-slate-400">{f.desc}</p>
            </div>)}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-y border-white/10 bg-[#0B0F31] py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <h2 className="mb-8 text-center text-3xl font-extrabold sm:text-4xl">Tarifs</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { name: "Essentiel", price: 99, features: ["Gestion des commandes et des clients", "Tableau de bord des ventes", "Catalogue produits et suivi du stock", "Expédition et suivi Eagle Express"] },
              { name: "Pro", price: 250, features: ["Tout le plan Essentiel", "Réceptions et historique des achats de stock", "Finances, marges et suivi des virements", "Pages produits et formulaires de commande", "Suivi des visiteurs en direct"] },
              { name: "Équipe", price: 499, features: ["Tout le plan Pro", "Gestion des agents et des rôles", "Commissions et demandes de paiement", "Suivi des campagnes publicitaires", "Alertes et rapports Telegram"] },
            ].map(plan => (
              <article key={plan.name} className={`flex flex-col rounded-2xl border bg-[#101535] p-6 ${plan.name === "Pro" ? "border-[#E97858]/65" : "border-white/10"}`}>
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="mt-3 text-4xl font-extrabold">{plan.price} <span className="text-base text-[#F5B49E]">DH</span></p>
                <ul className="mb-7 mt-6 flex-1 space-y-3 text-sm text-slate-300">
                  {plan.features.map(feature => (
                    <li key={feature} className="flex items-start gap-2">
                      <span aria-hidden className="font-bold text-[#F5B49E]">✓</span>{feature}
                    </li>
                  ))}
                </ul>
                <a href={`https://wa.me/212644587812?text=${encodeURIComponent(`Bonjour, je souhaite activer le plan ${plan.name} à ${plan.price} DH pour COD CRM.`)}`}
                  className="rounded-xl bg-[#B64532] px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-[#963725]">
                  Choisir {plan.name}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#070A24] px-4 py-8 text-slate-400 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 sm:flex-row">
          <Link href="/" className="flex items-center gap-2"><CodCrmWordmark width={132} onDark /></Link>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <a href="#features" className="transition hover:text-[#F08061]">Fonctionnalités</a><a href="#pricing" className="transition hover:text-[#F08061]">Tarifs</a>
            <Link href="/privacy" className="transition hover:text-[#F08061]">Confidentialité</Link><Link href="/login" className="transition hover:text-[#F08061]">Connexion</Link>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} COD CRM. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
