"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CodCrmWordmark } from "@/components/CodCrmLogo";
import { Package, Bird, BarChart3, DollarSign, Users, Bot, ShoppingBag, TrendingUp, Rocket, Zap, ShoppingCart, Megaphone, ChevronDown, X, type LucideIcon } from "lucide-react";

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

const PARTNERS = [
  { name: "Shopify", logo: "shopify", width: 360, height: 103, href: "https://www.shopify.com/" },
  { name: "WooCommerce", logo: "woo", width: 360, height: 94, href: "https://woocommerce.com/" },
  { name: "YouCan", logo: "youcan", width: 360, height: 58, href: "https://youcan.shop/" },
  { name: "Amana", logo: "amana", width: 101, height: 110, href: "https://www.albaridbank.ma/fr/nos-sites" },
];

const trialLink = "https://wa.me/212644587812?text=" + encodeURIComponent("Bonjour, je souhaite essayer COD Maroc CRM.");

export default function LandingPage() {
  const [authed, setAuthed] = useState(false);
  const demo = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => {
      if (r.ok) {
        setAuthed(true);
        window.location.href = "/dashboard";
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!main.current || typeof IntersectionObserver === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const elements = [...main.current.querySelectorAll<HTMLElement>(".landing-scroll-step")];
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-landing-motion", "shown");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12 });

    for (const element of elements) {
      if (element.getBoundingClientRect().top >= window.innerHeight) {
        element.setAttribute("data-landing-motion", "pending");
        observer.observe(element);
      }
    }
    return () => {
      observer.disconnect();
      elements.forEach(element => element.removeAttribute("data-landing-motion"));
    };
  }, []);

  if (authed) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[#0A0C2F] text-[#F4F4F7]">
      <header className="mx-auto flex min-h-[88px] max-w-[1180px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
        <Link href="/" className="block w-[132px] shrink-0 sm:w-[158px]">
          <CodCrmWordmark width={158} onDark />
        </Link>

        <nav aria-label="Navigation principale" className="order-last flex w-full items-center justify-center gap-5 text-xs font-semibold text-[#CFCDD9] sm:gap-8 sm:text-base lg:order-none lg:w-auto">
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 hover:text-white [&::-webkit-details-marker]:hidden">
              Fonctionnalités <ChevronDown size={14} aria-hidden />
            </summary>
            <div className="absolute top-full z-20 mt-3 w-48 rounded-xl border border-white/15 bg-[#101535] p-2">
              <a href="#features" className="block rounded-lg px-3 py-2 text-sm hover:bg-white/10">Toutes les fonctionnalités</a>
              <button type="button" onClick={() => demo.current?.showModal()} className="block w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-white/10">Voir la Démo</button>
            </div>
          </details>
          <a href="#pricing" className="hover:text-white">Tarifs</a>
          <a href="#integrations" className="hover:text-white">Partenaires</a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className="rounded-lg px-2.5 py-2 text-xs font-semibold text-white hover:bg-white/10 sm:text-sm">Connexion</Link>
          <a href={trialLink} className="rounded-[11px] bg-[#D47555] px-3 py-3 text-center text-xs font-bold text-[#FFFDFB] transition hover:bg-[#E38B6C] sm:px-5 sm:py-3.5 sm:text-[17px]">
            <span className="sm:hidden">Essai gratuit</span><span className="hidden sm:inline">Démarrer Gratuitement</span>
          </a>
        </div>
      </header>

      <main ref={main}>
        <section className="relative isolate">
          <div className="mx-auto grid max-w-[1180px] items-center gap-8 px-5 pb-10 pt-9 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-10 lg:pb-16 lg:pt-16">
            <div className="relative z-10 min-w-0">
              <h1 className="landing-enter text-[clamp(2.45rem,8vw,4.25rem)] font-extrabold leading-[1.11] tracking-[-0.035em] lg:text-[clamp(3rem,5.3vw,4.25rem)]">
                Gérez votre
                <span className="block text-[#D47555]">E-commerce COD</span>
                au Maroc
              </h1>
              <p className="landing-enter landing-enter-description mt-5 max-w-[505px] text-base leading-[1.4] text-[#D5D4DF] sm:text-xl lg:text-[24px]">
                Automatisez vos confirmations, suivez vos livraisons et maximisez vos revenus.
              </p>
              <div className="landing-enter landing-enter-actions mt-7 flex flex-wrap gap-3 sm:mt-10 sm:gap-5">
                <a href={trialLink} className="inline-flex min-h-12 items-center justify-center rounded-[12px] bg-[#D47555] px-5 text-sm font-bold text-[#FFFDFB] transition hover:bg-[#E38B6C] sm:min-h-[68px] sm:min-w-[194px] sm:px-7 sm:text-xl">Essai Gratuit</a>
                <button type="button" onClick={() => demo.current?.showModal()} className="inline-flex min-h-12 items-center justify-center rounded-[12px] border-2 border-[#8C8CA3] px-5 text-sm font-semibold text-white transition hover:border-white sm:min-h-[68px] sm:min-w-[194px] sm:px-7 sm:text-xl">Voir la Démo</button>
              </div>
            </div>
            <div className="landing-enter landing-enter-preview mx-auto w-full max-w-[590px] lg:mx-0">
            <Image src="/landing-reference/dashboard-hd.webp" width={1254} height={1164} sizes="(min-width: 1180px) 510px, (min-width: 1024px) 44vw, (min-width: 640px) 590px, calc(100vw - 40px)" priority alt="Aperçu du tableau de bord COD Maroc CRM avec les indicateurs et les cartes du Maroc" className="landing-preview-art h-auto w-full" />
            </div>
          </div>
        </section>

        <section id="integrations" className="relative isolate min-h-[330px] scroll-mt-4 pb-20 pt-12 lg:min-h-[380px] lg:pt-16">
          <Image src="/landing-reference/zellige.svg" width={214} height={278} alt="" className="pointer-events-none absolute -start-22 top-[108px] -z-10 w-36 opacity-55 sm:-start-16 sm:w-44 lg:-start-16 lg:top-[145px] lg:w-[214px]" />
          <Image src="/landing-reference/zellige.svg" width={214} height={278} alt="" className="pointer-events-none absolute -end-22 top-0 -z-10 w-36 -scale-x-100 opacity-55 sm:-end-16 sm:w-44 lg:-end-16 lg:w-[214px]" />
          <div className="mx-auto max-w-[1000px] px-5 sm:px-6">
            <h2 className="landing-scroll-step mb-8 text-center text-3xl font-extrabold tracking-tight sm:mb-9 lg:text-[48px]">Partenaires</h2>
            <ul className="landing-stagger flex flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:gap-x-8 lg:flex-nowrap lg:gap-x-9">
              {PARTNERS.map(partner => (
                <li key={partner.logo} className="landing-scroll-step flex min-w-0 justify-center">
                  <a href={partner.href} className="inline-flex h-14 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-[#E97858] sm:px-2">
                    <Image src={`/landing-reference/partner-${partner.logo}.webp`} width={partner.width} height={partner.height} alt={partner.name}
                      className={`h-auto max-h-12 w-auto max-w-[min(39vw,176px)] object-contain ${partner.logo === "amana" ? "rounded-md bg-white p-1" : ""}`} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <dialog ref={demo} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
          className="m-auto w-[min(92vw,680px)] rounded-2xl border border-[#D47555]/40 bg-[#101535] p-4 text-white backdrop:bg-[#080B2C]/80" aria-label="Démo du tableau de bord">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="font-bold">Démo du tableau de bord</h2>
            <button type="button" onClick={() => demo.current?.close()} aria-label="Fermer" className="grid size-10 place-items-center rounded-xl border border-white/15 hover:bg-white/10"><X size={18} aria-hidden /></button>
          </div>
          <Image src="/landing-reference/dashboard-hd.webp" width={1254} height={1164} sizes="(max-width: 720px) 90vw, 640px" alt="Aperçu du tableau de bord COD Maroc CRM" className="mx-auto h-auto max-h-[72vh] w-auto rounded-xl object-contain" />
        </dialog>

      <section id="features" className="bg-[#080B2C] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <div className="landing-scroll-step mb-12 text-center">
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-[#F08061]">Fonctionnalités</p>
            <h2 className="text-3xl font-extrabold sm:text-4xl">Tout votre COD au même endroit</h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-400">Commandes, stock, équipe et finances : gardez une vue claire sur votre activité.</p>
          </div>
          <div className="landing-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.slice(0, 6).map(f => <div key={f.title} className="landing-scroll-step rounded-2xl border border-white/10 bg-[#101535] p-6 transition hover:border-[#E97858]/50">
              <f.icon size={26} className="mb-4 text-[#E97858]" /><h3 className="mb-2 font-bold">{f.title}</h3><p className="text-sm leading-relaxed text-slate-400">{f.desc}</p>
            </div>)}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-y border-white/10 bg-[#0B0F31] py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <h2 className="landing-scroll-step mb-8 text-center text-3xl font-extrabold sm:text-4xl">Tarifs</h2>
          <div className="landing-stagger grid gap-4 md:grid-cols-3">
            {[
              { name: "Essentiel", price: 99, features: ["Gestion des commandes et des clients", "Tableau de bord des ventes", "Catalogue produits et suivi du stock", "Expédition et suivi Eagle Express"] },
              { name: "Pro", price: 250, features: ["Tout le plan Essentiel", "Réceptions et historique des achats de stock", "Finances, marges et suivi des virements", "Pages produits et formulaires de commande", "Suivi des visiteurs en direct"] },
              { name: "Équipe", price: 499, features: ["Tout le plan Pro", "Gestion des agents et des rôles", "Commissions et demandes de paiement", "Suivi des campagnes publicitaires", "Alertes et rapports Telegram"] },
            ].map(plan => (
              <article key={plan.name} className={`landing-scroll-step flex flex-col rounded-2xl border bg-[#101535] p-6 ${plan.name === "Pro" ? "border-[#E97858]/65" : "border-white/10"}`}>
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

      </main>

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
