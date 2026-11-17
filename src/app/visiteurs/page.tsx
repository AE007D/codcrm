"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Globe, Maximize, Minimize, Monitor, Package, RefreshCw, Search, Users } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { MOROCCO_PATHS } from "./moroccoPathsData";
import { useLang } from "@/lib/i18n";

type Visitor = {
  id: string;
  visitor_id: string;
  page: string;
  page_title: string | null;
  device: string | null;
  referrer: string | null;
  last_seen: string;
};

type Order = {
  city?: string;
  customerCity?: string;
  receivedAt?: string;
  received_at?: string;
  createdAt?: string;
  created_at?: string;
};

const CITIES = [
  { name: "Casablanca", x: 11435, y: 4921,  r: 150 },
  { name: "Rabat",      x: 12035, y: 4561,  r: 120 },
  { name: "Marrakech",  x: 11146, y: 6648,  r: 120 },
  { name: "Fès",        x: 13425, y: 4570,  r: 110 },
  { name: "Agadir",     x: 9916,  y: 7708,  r: 100 },
  { name: "Tanger",     x: 12817, y: 3010,  r: 100 },
  { name: "Meknès",     x: 13007, y: 4667,  r: 90  },
  { name: "Oujda",      x: 15779, y: 3974,  r: 90  },
  { name: "Béni Mellal",x: 12392, y: 6025,  r: 80  },
  { name: "El Jadida",  x: 10759, y: 5236,  r: 80  },
  { name: "Nador",      x: 14997, y: 3545,  r: 80  },
  { name: "Kénitra",    x: 12217, y: 4342,  r: 80  },
  { name: "Settat",     x: 11435, y: 5447,  r: 70  },
  { name: "Laayoune",   x: 7196,  y: 10557, r: 70  },
  { name: "Ouarzazate", x: 11989, y: 7261,  r: 70  },
  { name: "Tétouan",    x: 13144, y: 3194,  r: 70  },
];

const SETUP_SQL = `-- Run once in Supabase Dashboard → SQL Editor
CREATE TABLE IF NOT EXISTS crm_visitors (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id text NOT NULL,
  visitor_id   text NOT NULL,
  page         text NOT NULL,
  page_title   text,
  product_id   text,
  referrer     text,
  device       text,
  last_seen    timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_visitors_workspace_visitor_page
  ON crm_visitors(workspace_id, visitor_id, page);
CREATE INDEX IF NOT EXISTS crm_visitors_workspace_last_seen
  ON crm_visitors(workspace_id, last_seen DESC);`;


const dayFormat = new Intl.DateTimeFormat("fr-MA", { timeZone: "Africa/Casablanca" });
const timeFormat = new Intl.DateTimeFormat("fr-MA", { timeZone: "Africa/Casablanca", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const panel = "min-w-0 rounded-2xl border border-slate-100 bg-white p-4 sm:p-5";

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

function referrerHost(value: string | null) {
  if (!value) return "Direct";
  try { return new URL(value).hostname || "Direct"; }
  catch { return value; }
}

export default function LiveViewPage() {
  const { t } = useLang();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [tableExists, setTableExists] = useState(true);
  const [visitorError, setVisitorError] = useState(false);
  const [orderError, setOrderError] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const [copied, setCopied] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    async function refresh() {
      if (inFlight) return;
      inFlight = true;
      setFetching(true);
      const options = { cache: "no-store" as const, signal: controller.signal };
      const [traffic, shipments] = await Promise.allSettled([
        fetch("/api/visitors", options).then(async response => {
          const data = await response.json();
          if (!response.ok || data.error) throw new Error();
          return data;
        }),
        fetch("/api/orders", options).then(async response => {
          if (!response.ok) throw new Error();
          return response.json();
        }),
      ]);
      if (controller.signal.aborted) return;
      if (traffic.status === "fulfilled") {
        setVisitors(traffic.value.visitors ?? []);
        setTableExists(traffic.value.tableExists !== false);
        setUpdatedAt(new Date());
      }
      if (shipments.status === "fulfilled") setOrders(shipments.value.orders ?? []);
      setVisitorError(traffic.status === "rejected");
      setOrderError(shipments.status === "rejected");
      setFetching(false);
      inFlight = false;
    }

    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [refreshKey]);

  useEffect(() => {
    setFullscreenAvailable(document.fullscreenEnabled);
    const onChange = () => setFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const uniqueVisitors = new Map<string, Visitor>();
  const activePages = new Map<string, Set<string>>();
  for (const visitor of visitors) {
    if (!uniqueVisitors.has(visitor.visitor_id)) uniqueVisitors.set(visitor.visitor_id, visitor);
    const pageVisitors = activePages.get(visitor.page) ?? new Set<string>();
    pageVisitors.add(visitor.visitor_id);
    activePages.set(visitor.page, pageVisitors);
  }

  const devices = new Map<string, number>();
  for (const visitor of uniqueVisitors.values()) {
    const device = visitor.device || "Inconnu";
    devices.set(device, (devices.get(device) ?? 0) + 1);
  }

  const now = updatedAt ?? new Date();
  const today = dayFormat.format(now);
  const todayOrders = (orders ?? []).filter(order => {
    const stamp = new Date(order.receivedAt ?? order.received_at ?? order.createdAt ?? order.created_at ?? "");
    return Number.isFinite(stamp.getTime()) && dayFormat.format(stamp) === today;
  });
  const orderCities = new Map<string, { name: string; count: number }>();
  for (const order of todayOrders) {
    const name = (order.city || order.customerCity || "").trim();
    if (!name) continue;
    const key = normalize(name);
    const existing = orderCities.get(key);
    orderCities.set(key, { name: existing?.name ?? name, count: (existing?.count ?? 0) + 1 });
  }

  const search = normalize(query);
  const matching = visitors.filter(visitor => normalize([visitor.page, visitor.page_title, referrerHost(visitor.referrer), visitor.device].join(" ")).includes(search));
  const latest = matching.slice(0, 30);
  const pageRanks = [...activePages.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 5);
  const cityRanks = [...orderCities.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  const trafficAvailable = updatedAt !== null && tableExists;

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div ref={container} className="min-w-0 flex-1 bg-[#F0F4FF] fullscreen:overflow-y-auto">
        <header className="sidebar-header-pl flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-4 lg:px-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t("live_view")}</h1>
            <p className="mt-1 text-sm text-slate-500">Activité des cinq dernières minutes</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">{updatedAt ? `Mis à jour à ${timeFormat.format(updatedAt)}` : fetching ? "Chargement…" : "En attente de données"}</span>
            <button type="button" onClick={() => setRefreshKey(value => value + 1)} disabled={fetching} aria-label="Actualiser" title="Actualiser" className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw className="size-4" aria-hidden />
            </button>
            {fullscreenAvailable && (
              <button type="button" onClick={() => {
                const action = fullscreen ? document.exitFullscreen() : container.current?.requestFullscreen();
                void action?.catch(() => {});
              }} aria-label={fullscreen ? "Quitter le plein écran" : "Plein écran"} title={fullscreen ? "Quitter le plein écran" : "Plein écran"} className="hidden size-10 place-items-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 sm:grid">
                {fullscreen ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />}
              </button>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-4 p-4 lg:p-8">
          {visitorError && <p role="status" className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">Le suivi des visites est momentanément indisponible.</p>}
          {orderError && <p role="status" className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">Les commandes n’ont pas pu être actualisées.</p>}
          {!tableExists && (
            <details className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
              <summary className="cursor-pointer font-semibold">Le suivi des visiteurs doit être configuré</summary>
              <button type="button" className="mt-2 rounded-lg border border-amber-200 px-3 py-2" onClick={() => void navigator.clipboard.writeText(SETUP_SQL).then(() => setCopied(true)).catch(() => setCopied(false))}>{copied ? "Copié" : "Copier le SQL de configuration"}</button>
            </details>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {[
              { label: "Visiteurs actifs", value: trafficAvailable ? uniqueVisitors.size : "—", Icon: Users },
              { label: "Pages actives", value: trafficAvailable ? activePages.size : "—", Icon: Globe },
              { label: "Commandes aujourd’hui", value: orders === null ? "—" : todayOrders.length, Icon: Package },
            ].map(({ label, value, Icon }) => (
              <div key={label} className={panel}>
                <Icon className="mb-2 size-5 text-blue-600" aria-hidden />
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className={panel}>
              <h2 className="mb-3 flex items-center gap-2 font-bold text-slate-900"><Activity className="size-4 text-blue-600" aria-hidden /> Pages les plus actives</h2>
              {pageRanks.length === 0 && <p className="text-sm text-slate-500">Aucune visite active à afficher.</p>}
              <ul className="space-y-3">
                {pageRanks.map(([page, ids]) => (
                  <li key={page}>
                    <div className="mb-1 flex items-start justify-between gap-3 text-sm">
                      <span className="min-w-0 break-all text-slate-600">{page}</span>
                      <span className="shrink-0 font-bold text-slate-800">{ids.size}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${ids.size / pageRanks[0][1].size * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className={panel}>
              <h2 className="mb-3 flex items-center gap-2 font-bold text-slate-900"><Monitor className="size-4 text-blue-600" aria-hidden /> Appareils</h2>
              {devices.size === 0 && <p className="text-sm text-slate-500">Aucun appareil actif à afficher.</p>}
              <ul className="divide-y divide-slate-100">
                {[...devices.entries()].sort((a, b) => b[1] - a[1]).map(([device, count]) => (
                  <li key={device} className="flex justify-between gap-3 py-2 text-sm"><span className="capitalize text-slate-600">{device}</span><b className="text-slate-900">{count}</b></li>
                ))}
              </ul>
            </section>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <section className={panel}>
              <h2 className="mb-3 font-bold text-slate-900">Activité récente</h2>
              <label className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 px-3">
                <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
                <input type="search" aria-label="Rechercher dans l’activité" placeholder="Rechercher une page, une source ou un appareil" value={query} onChange={event => setQuery(event.target.value)} className="w-full min-w-0 bg-transparent py-2 text-sm outline-none" />
              </label>
              {latest.length === 0 && <p className="py-3 text-sm text-slate-500">{search ? "Aucun résultat." : "Aucune visite récente."}</p>}
              <ul className="divide-y divide-slate-100">
                {latest.map(visitor => (
                  <li key={visitor.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-semibold text-slate-800">{visitor.page_title || visitor.page}</p>
                      <p className="break-all text-xs text-slate-500">{referrerHost(visitor.referrer)}{visitor.device ? ` · ${visitor.device}` : ""}</p>
                    </div>
                    <time dateTime={visitor.last_seen} className="shrink-0 text-xs tabular-nums text-slate-500">{timeFormat.format(new Date(visitor.last_seen))}</time>
                  </li>
                ))}
              </ul>
              {matching.length > latest.length && <p className="mt-2 text-xs text-slate-500">{latest.length} activités récentes sur {matching.length}</p>}
            </section>

            <section className={panel}>
              <h2 className="font-bold text-slate-900">Commandes par ville</h2>
              <svg viewBox="3910 2417 12953 14168" aria-label="Carte des villes de commande" role="img" className="mx-auto my-3 h-60 w-full text-blue-600">
                {MOROCCO_PATHS.map((path, index) => <path key={index} d={path.d} fill="currentColor" fillOpacity={path.ws ? 0.1 : 0.17} stroke="currentColor" strokeOpacity={0.45} strokeWidth={24} />)}
                {CITIES.map(city => {
                  const count = orderCities.get(normalize(city.name))?.count ?? 0;
                  return count > 0 && <circle key={city.name} cx={city.x} cy={city.y} r={Math.min(390, 140 + count * 28)} fill="currentColor"><title>{city.name} · {count}</title></circle>;
                })}
              </svg>
              {cityRanks.length === 0 && <p className="text-sm text-slate-500">Aucune ville enregistrée aujourd’hui.</p>}
              <ul className="divide-y divide-slate-100">
                {cityRanks.map(city => <li key={city.name} className="flex justify-between gap-3 py-1.5 text-sm"><span className="text-slate-600">{city.name}</span><b className="text-slate-900">{city.count}</b></li>)}
              </ul>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
