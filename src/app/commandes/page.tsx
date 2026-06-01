"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AMEEX_CITIES_FALLBACK } from "@/lib/moroccanCities";
import { cachedFetch, invalidateCache } from "@/lib/clientCache";
import Sidebar from "@/components/Sidebar";
import { useLang } from "@/lib/i18n";

type OrderStatus = "nouveau" | "confirmé" | "annulé" | "injoignable" | "fausse" | "expédié" | "livré" | "retourné";

type Order = {
  id: string;
  orderNumber: string;
  customer: string;
  city: string;
  phone: string;
  address: string;
  product: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  date: string;
  receivedAt: string; // ISO string for date calculations
  source: "lightfunnels" | "shopify" | "manuel";
  notes: string;
  attempts: number;
  noAnswer: number;
  carrierTracking?: string;
  carrierName?: string;
  carrierStatus?: string;
};


const STATUS_CONFIG_COLORS: Record<OrderStatus, { color: string; bg: string; border: string; dot: string }> = {
  nouveau:     { color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200",   dot: "bg-blue-500" },
  confirmé:    { color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200",dot: "bg-emerald-500" },
  annulé:      { color: "text-red-600",     bg: "bg-red-50",      border: "border-red-200",    dot: "bg-red-500" },
  injoignable: { color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",  dot: "bg-amber-500" },
  fausse:      { color: "text-purple-700",  bg: "bg-purple-50",   border: "border-purple-200", dot: "bg-purple-500" },
  expédié:     { color: "text-indigo-700",  bg: "bg-indigo-50",   border: "border-indigo-200", dot: "bg-indigo-500" },
  livré:       { color: "text-teal-700",    bg: "bg-teal-50",     border: "border-teal-200",   dot: "bg-teal-500" },
  retourné:    { color: "text-orange-700",  bg: "bg-orange-50",   border: "border-orange-200", dot: "bg-orange-500" },
};

const PIPELINE: OrderStatus[] = ["nouveau", "confirmé", "annulé", "injoignable", "fausse", "expédié", "livré", "retourné"];
const emptyForm = { customer: "", city: "", phone: "", address: "", product: "", amount: "", notes: "", source: "manuel" as Order["source"] };

function LightfunnelsIcon() {
  return (
    <svg viewBox="0 0 100 100" className="w-4 h-4 shrink-0" fill="none">
      {/* Blue pill - top diagonal */}
      <rect x="8" y="18" width="52" height="22" rx="11" fill="#4A90E2" transform="rotate(-38 34 29)"/>
      {/* Yellow semicircle - middle right */}
      <circle cx="63" cy="47" r="16" fill="#F5C518"/>
      {/* Pink pill - bottom diagonal */}
      <rect x="22" y="58" width="55" height="22" rx="11" fill="#E8185A" transform="rotate(-38 49 69)"/>
    </svg>
  );
}

function SourceBadge({ source }: { source: Order["source"] }) {
  if (source === "lightfunnels") return (
    <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg">
      <LightfunnelsIcon />
      Lightfunnels
    </span>
  );
  if (source === "shopify") return (
    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-lg">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
        <path d="M15.337 3.47c-.015-.08-.083-.13-.162-.13-.08 0-1.494-.03-1.494-.03s-1.19-1.156-1.306-1.272a.37.37 0 00-.22-.1L11 18l5.4-1.166S15.352 3.55 15.337 3.47zM12.5 4.2l-.7 2.1c-.4-.2-.9-.3-1.4-.3-1.1 0-1.2.7-1.2 1 0 1.1 2.9 1.5 2.9 4 0 2-1.2 3.2-2.9 3.2-.7 0-2-.4-2-.4l.5-1.7s.9.5 1.6.5c.5 0 .7-.4.7-.7 0-1.4-2.4-1.5-2.4-3.8 0-1.9 1.4-3.8 4.1-3.8.4.1.7.2.8.2z"/>
      </svg>
      Shopify
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-lg">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
      Manuel
    </span>
  );
}

type ShipCarrier = "eagle";

type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  image: string;
  sellPrice: number;
  stock: number;
};

export default function CommandesPage() {
  const { t } = useLang();
  const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
    nouveau:     { label: t("status_nouveau"),    ...STATUS_CONFIG_COLORS.nouveau },
    confirmé:    { label: t("status_confirme"),   ...STATUS_CONFIG_COLORS.confirmé },
    annulé:      { label: t("status_annule"),     ...STATUS_CONFIG_COLORS.annulé },
    injoignable: { label: t("status_injoignable"),...STATUS_CONFIG_COLORS.injoignable },
    fausse:      { label: t("status_fausse"),     ...STATUS_CONFIG_COLORS.fausse },
    expédié:     { label: t("status_expedie"),    ...STATUS_CONFIG_COLORS.expédié },
    livré:       { label: t("status_livre"),      ...STATUS_CONFIG_COLORS.livré },
    retourné:    { label: t("status_retourne"),   ...STATUS_CONFIG_COLORS.retourné },
  };
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "tous">("tous");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [notesModal, setNotesModal] = useState<Order | null>(null);
  const [noteText, setNoteText] = useState("");
  const [drawer, setDrawer] = useState<Order | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); }

  // Catalog
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [showCatalogDrop, setShowCatalogDrop] = useState(false);

  useEffect(() => {
    fetch("/api/products").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.products) setCatalog(d.products);
    }).catch(() => {});
  }, []);

  function applyCatalogProduct(p: CatalogProduct) {
    setForm(f => ({ ...f, product: p.name, amount: String(p.sellPrice) }));
    setCatalogSearch(p.name);
    setShowCatalogDrop(false);
  }

  const filteredCatalog = catalog.filter(p =>
    !catalogSearch || p.name.toLowerCase().includes(catalogSearch.toLowerCase()) || p.sku.toLowerCase().includes(catalogSearch.toLowerCase())
  ).slice(0, 6);

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Shipping modal
  const [shipModal, setShipModal] = useState(false);
  const shipCarrier: ShipCarrier = "eagle";
  const [shipping, setShipping] = useState(false);
  const [shipResults, setShipResults] = useState<{ id: string; ok: boolean; msg: string }[]>([]);
  const [syncingEagle, setSyncingEagle] = useState(false);
  const [cityOverrides, setCityOverrides] = useState<Record<string, string>>({}); // orderId → city name (Eagle)
  const [eagleAddressOverrides, setEagleAddressOverrides] = useState<Record<string, string>>({}); // orderId → address override for Eagle
  const [eagleCities, setEagleCities] = useState<{ id: string; name: string }[]>(AMEEX_CITIES_FALLBACK); // seeded with Moroccan cities; replaced by Eagle API data on load
  const [eagleCitySearch, setEagleCitySearch] = useState<Record<string, string>>({}); // orderId → search text
  const [carrierStatus, setCarrierStatus] = useState<{ loading: boolean; text: string | null; ok: boolean }>({ loading: false, text: null, ok: true });


  // Current user role — null while loading, so isAdmin is never wrong before fetch completes
  const [userRole, setUserRole] = useState<"admin" | "agent" | "viewer" | null>(null);
  const isAdmin = userRole === "admin";
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => {
      setUserRole(d?.role ?? "agent");
    }).catch(() => { setUserRole("agent"); });
  }, []);

  // Edit mode for drawer
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<{ customer: string; phone: string; city: string; address: string; product: string; amount: string }>({ customer: "", phone: "", city: "", address: "", product: "", amount: "" });
  const [citySearch, setCitySearch] = useState("");
  const [editCitySearch, setEditCitySearch] = useState("");
  // Inline tracking editor in drawer
  const [trackEditOpen, setTrackEditOpen] = useState(false);
  const [trackEditCode, setTrackEditCode] = useState("");
  const [trackEditCarrier, setTrackEditCarrier] = useState("eagle");
  const [showCityDrop, setShowCityDrop] = useState(false);
  const [showEditCityDrop, setShowEditCityDrop] = useState(false);

  // ── Fetch all orders from Supabase ────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      const res = await cachedFetch("/api/orders", 20_000);
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) return;
      const data = await res.json();
      const rows: Record<string, unknown>[] = data.orders ?? [];
      setOrders(rows.map(o => ({
        id: String(o.id),
        orderNumber: String(o.orderNumber ?? o.order_number ?? ""),
        customer: String(o.customerName ?? o.customer_name ?? ""),
        city: String(o.city ?? ""),
        phone: String(o.customerPhone ?? o.customer_phone ?? ""),
        address: String(o.address ?? ""),
        product: String(o.product ?? ""),
        amount: parseFloat(String(o.totalPrice ?? o.total_price ?? "0")),
        currency: String(o.currency ?? "MAD"),
        status: (o.status ?? "nouveau") as OrderStatus,
        date: new Date(String(o.receivedAt ?? o.received_at ?? Date.now())).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" }),
        receivedAt: String(o.receivedAt ?? o.received_at ?? new Date().toISOString()),
        source: (o.source ?? "manuel") as Order["source"],
        notes: String(o.notes ?? ""),
        attempts: Number(o.attempts ?? 0),
        noAnswer: Number(o.noAnswer ?? o.no_answer ?? 0),
        carrierTracking: o.carrierTracking ? String(o.carrierTracking) : undefined,
        carrierName: o.carrierName ? String(o.carrierName) : undefined,
        carrierStatus: o.carrierStatus ? String(o.carrierStatus) : undefined,
      })));
    } catch { /* silent */ }
  }, []);

  const autoSyncDoneRef = useRef<boolean>(false);

  useEffect(() => {
    fetchOrders();
    const t = setInterval(fetchOrders, 30_000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  // Clear carrier status when drawer changes order
  useEffect(() => { setCarrierStatus({ loading: false, text: null, ok: true }); }, [drawer?.id]);

  // Listen for new orders from sidebar polling
  useEffect(() => {
    const handler = () => fetchOrders();
    window.addEventListener("new-orders", handler);
    return () => window.removeEventListener("new-orders", handler);
  }, [fetchOrders]);



  function setStatus(id: string, status: OrderStatus) {
    // Block confirmation if city is missing
    if (status === "confirmé") {
      const order = orders.find(o => o.id === id);
      if (order && !order.city?.trim()) {
        // Open drawer in edit mode focused on city
        setDrawer(order);
        setEditMode(true);
        setEditForm({ customer: order.customer, phone: order.phone, city: "", address: order.address, product: order.product, amount: String(order.amount) });
        setEditCitySearch("");
        showToast("Veuillez ajouter la ville avant de confirmer.", false);
        return;
      }
    }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    setDrawer(prev => prev?.id === id ? { ...prev, status } : prev);
    invalidateCache("/api/orders");
    fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }).catch(() => {});
  }

  function deleteOrder(id: string) {
    if (!window.confirm("Supprimer cette commande ? Cette action est irréversible.")) return;
    setOrders(prev => prev.filter(o => o.id !== id));
    if (drawer?.id === id) setDrawer(null);
    invalidateCache("/api/orders");
    fetch("/api/orders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
      .then(r => r.ok ? showToast("Commande supprimée.") : showToast("Erreur lors de la suppression.", false))
      .catch(() => showToast("Erreur réseau.", false));
  }

  function incrementAttempt(id: string) {
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o;
      const updated = { ...o, attempts: o.attempts + 1 };
      fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, attempts: updated.attempts }) }).catch(() => {});
      return updated;
    }));
    setDrawer(prev => prev?.id === id ? { ...prev, attempts: prev.attempts + 1 } : prev);
  }

  function markNoAnswer(id: string) {
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o;
      const updated = { ...o, noAnswer: o.noAnswer + 1, attempts: o.attempts + 1 };
      fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, attempts: updated.attempts, noAnswer: updated.noAnswer }) }).catch(() => {});
      return updated;
    }));
    setDrawer(prev => prev?.id === id ? { ...prev, noAnswer: prev.noAnswer + 1, attempts: prev.attempts + 1 } : prev);
  }

  function saveNoteInline(id: string, note: string) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, notes: note } : o));
    setDrawer(prev => prev?.id === id ? { ...prev, notes: note } : prev);
    fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, notes: note }) }).catch(() => {});
  }

  function saveTrackingInline(id: string, carrierTracking: string, carrierName: string) {
    const trimmed = carrierTracking.trim();
    if (!trimmed) return;
    const patch = { id, carrierTracking: trimmed, carrierName, status: "expédié" as OrderStatus };
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
    setDrawer(prev => prev?.id === id ? { ...prev, ...patch } : prev);
    fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => {});
    setTrackEditOpen(false);
    setTrackEditCode("");
    showToast(`Suivi ${trimmed} enregistré ✓`);
  }

  async function saveEditForm() {
    if (!drawer) return;
    const patch = {
      customerName: editForm.customer,
      customerPhone: editForm.phone,
      city: editForm.city,
      address: editForm.address,
      product: editForm.product,
      totalPrice: parseFloat(editForm.amount) || 0,
    };
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: drawer.id, ...patch }),
    });
    if (res.ok) {
      const updated = { ...drawer, customer: editForm.customer, phone: editForm.phone, city: editForm.city, address: editForm.address, product: editForm.product, amount: parseFloat(editForm.amount) || 0 };
      setOrders(prev => prev.map(o => o.id === drawer.id ? updated : o));
      setDrawer(updated);
      setEditMode(false);
      showToast("Commande modifiée ✓");
    } else {
      showToast("Erreur lors de la modification.", false);
    }
  }

  async function addOrder() {
    if (!form.customer || !form.phone || !form.product || !form.amount) {
      showToast("Remplissez : nom, téléphone, produit et montant.", false);
      return;
    }
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form.customer,
          phone: form.phone,
          city: form.city,
          address: form.address,
          product: form.product,
          amount: form.amount,
          notes: form.notes,
          source: form.source,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Erreur lors de la création.", false); return; }
      const o = data.order;
      const mapped: Order = {
        id: String(o.id),
        orderNumber: String(o.orderNumber ?? ""),
        customer: String(o.customerName ?? ""),
        city: String(o.city ?? ""),
        phone: String(o.customerPhone ?? ""),
        address: String(o.address ?? ""),
        product: String(o.product ?? ""),
        amount: parseFloat(String(o.totalPrice ?? "0")),
        currency: "MAD",
        status: "nouveau",
        date: new Date(o.receivedAt ?? Date.now()).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" }),
        receivedAt: String(o.receivedAt ?? new Date().toISOString()),
        source: (o.source ?? "manuel") as Order["source"],
        notes: String(o.notes ?? ""),
        attempts: 0,
        noAnswer: 0,
      };
      setOrders(prev => [mapped, ...prev]);
      setForm(emptyForm);
      setCatalogSearch("");
      setShowModal(false);
      showToast("Commande ajoutée ✓");
    } catch (e) { console.error("addOrder failed:", e); showToast("Erreur réseau.", false); }
  }

  function saveNote(id: string, note: string) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, notes: note } : o));
    fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, notes: note }) }).catch(() => {});
    setNotesModal(null);
  }

  // Selection helpers
  const displayed = orders.filter(o => {
    const matchStatus = filter === "tous" || o.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || o.customer.toLowerCase().includes(q) || o.phone.includes(q) || o.product.toLowerCase().includes(q) || o.orderNumber.includes(q) || o.city.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === displayed.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayed.map(o => o.id)));
    }
  }

  async function openShipModal(ids?: string[]) {
    setShipResults([]);
    setCityOverrides({});
    setEagleCitySearch({});
    if (ids) setSelected(new Set(ids));
    setShipModal(true);
    // Load Eagle Express cities if not yet loaded
    // Always try to load Eagle cities from API (overwrites fallback with Eagle's exact names)
    try {
      const s = await fetch("/api/settings").then(r => r.json());
      const creds = s.settings?.eagle ?? {};
      if (creds.tk) {
        const raw = await fetch("/api/eagle", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cities", tk: creds.tk, sk: creds.sk }),
        }).then(r => r.json());
        // Eagle cities.php may return: array, {data:[...]}, {cities:[...]}, {result:[...]}
        const list: unknown[] = Array.isArray(raw) ? raw
          : Array.isArray(raw?.data) ? raw.data
          : Array.isArray(raw?.cities) ? raw.cities
          : Array.isArray(raw?.result) ? raw.result
          : [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cities = list.map((c: any) => ({
          id: String(c.id ?? c.city_id ?? c.ID ?? ""),
          name: String(c.name ?? c.city_name ?? c.ville ?? c.City ?? c.city ?? ""),
        })).filter((c: { id: string; name: string }) => c.name);
        if (cities.length) setEagleCities(cities);
      }
    } catch { /* keep fallback */ }
  }

  async function checkCarrierStatus(order: Order) {
    if (!order.carrierTracking) return;
    setCarrierStatus({ loading: true, text: null, ok: true });
    try {
      const settingsData = await fetch("/api/settings").then(r => r.json());
      const s = settingsData.settings ?? {};
      let statusText = "";
      const creds = s.eagle ?? {};
      const d = await fetch("/api/eagle", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "track", tk: creds.tk, sk: creds.sk, code: order.carrierTracking }),
      }).then(r => r.json());
      const entry = Array.isArray(d) ? d[0] : d;
      statusText = entry?.status ?? entry?.statut ?? entry?.message ?? JSON.stringify(d).slice(0, 100);
      setCarrierStatus({ loading: false, text: statusText || "Aucun statut retourné", ok: true });
    } catch (e) {
      setCarrierStatus({ loading: false, text: `Erreur: ${String(e).slice(0, 60)}`, ok: false });
    }
  }

  // Shared Eagle sync core — silent=true suppresses toast unless ≥1 update
  const runEagleSync = useCallback(async (silent: boolean) => {
    setSyncingEagle(true);
    try {
      const s = await fetch("/api/settings").then(r => r.json()).then(d => d.settings ?? {}).catch(() => ({}));
      const creds = s.eagle;
      if (!creds?.tk || !creds?.sk) {
        if (!silent) showToast("Identifiants Eagle Express non configurés", false);
        setSyncingEagle(false);
        return;
      }

      // Eagle track.php returns French status strings — map to CRM statuses
      // Match is done lowercase + keyword check to handle accent variations
      function eagleToCrm(etat: string): OrderStatus | null {
        const e = etat.toLowerCase().trim();
        if (e.includes("livr") && (e.includes("effect") || e === "livré" || e === "livre" || e.includes("livraison effect"))) return "livré";
        if (e === "livré" || e === "livre" || e.startsWith("livré")) return "livré";
        if (e.includes("retour") || e.includes("hors zone") || e.includes("hors_zone")) return "retourné";
        if (e.includes("annul")) return "annulé";
        return null; // no CRM status change — just update carrierStatus
      }

      // Capture current orders snapshot for the sync (avoids stale closure)
      let currentOrders: Order[] = [];
      setOrders(prev => { currentOrders = prev; return prev; });
      const expOrders = currentOrders.filter(o => o.status === "expédié" && (o.carrierName === "eagle" || (!o.carrierName && o.carrierTracking)));
      if (!expOrders.length) {
        if (!silent) showToast("Aucune commande Eagle expédiée à synchroniser");
        setSyncingEagle(false);
        return;
      }

      let updated = 0;
      const patchPromises: Promise<void>[] = [];

      for (const order of expOrders) {
        if (!order.carrierTracking) continue;
        try {
          const d = await fetch("/api/eagle", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "track", tk: creds.tk, sk: creds.sk, code: order.carrierTracking }),
          }).then(r => r.json()).catch(() => null);

          if (!d || !Array.isArray(d) || !d.length) continue;

          // Eagle returns statuses newest-first; d[0].Etat is the latest
          const latestEtat = String(d[0]?.Etat ?? "").trim();
          if (!latestEtat) continue;

          const crmStatus = eagleToCrm(latestEtat);
          const newCarrierStatus = latestEtat;

          const targetStatus = (crmStatus ?? order.status) as OrderStatus;
          if (targetStatus === order.status && newCarrierStatus === order.carrierStatus) continue;

          updated++;
          setOrders(prev => prev.map(o => o.id === order.id
            ? { ...o, status: targetStatus, carrierStatus: newCarrierStatus, carrierName: "eagle" }
            : o));
          patchPromises.push(
            fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: order.id, status: targetStatus, carrierStatus: newCarrierStatus, carrierName: "eagle" }),
            }).then(() => {}).catch(() => {})
          );
        } catch { /* skip this order */ }
      }

      await Promise.all(patchPromises);
      if (!silent) {
        showToast(updated > 0 ? `${updated} commande(s) Eagle mise(s) à jour ✓` : "Statuts Eagle déjà à jour");
      } else if (updated > 0) {
        showToast(`${updated} commande(s) mise(s) à jour ✓`);
      }
    } catch (e) {
      if (!silent) showToast(`Erreur sync Eagle: ${String(e).slice(0, 60)}`, false);
    }
    setSyncingEagle(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pull current statuses from Eagle Express and update matching CRM orders
  async function syncEagleStatuses() {
    await runEagleSync(false);
  }

  // Auto Eagle sync once after initial orders load (placed after runEagleSync declaration)
  useEffect(() => {
    if (autoSyncDoneRef.current) return;
    if (orders.length === 0) return;
    const hasEagleExpédié = orders.some(o => o.status === "expédié" && o.carrierTracking && (o.carrierName === "eagle" || !o.carrierName));
    if (!hasEagleExpédié) return;
    autoSyncDoneRef.current = true;
    runEagleSync(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.length]);

  // Send selected orders to carrier
  async function sendToCarrier(overrideIds?: Set<string>) {
    setShipping(true);
    setShipResults([]);
    const selectedOrders = orders.filter(o => (overrideIds ?? selected).has(o.id));

    // Load credentials from server settings, with localStorage fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let creds: Record<string, any> = {};
    try {
      const settingsData = await fetch("/api/settings").then(r => r.json());
      const s = settingsData.settings ?? {};
      creds = s.eagle ?? {};
    } catch { /* no creds */ }
    // Fallback: Eagle creds may have been saved in standalone /eagle page (localStorage)
    if (!creds.tk) {
      try {
        const stored = localStorage.getItem("eagle_creds");
        if (stored) { const parsed = JSON.parse(stored); if (parsed?.tk) creds = parsed; }
      } catch { /* ignore */ }
    }

    // Guard: Eagle Express requires tk + sk
    if (!creds.tk || !creds.sk) {
      setShipResults([{ id: "error", ok: false, msg: "Identifiants Eagle Express manquants — configurez tk et sk dans Intégrations → Eagle Express." }]);
      setShipping(false);
      return;
    }

    const results: { id: string; ok: boolean; msg: string }[] = [];

    for (const order of selectedOrders) {
      try {
        let res: Response;
        {
          const eagleCity = cityOverrides[order.id] || order.city || "";
          const eagleAddress = eagleAddressOverrides[order.id] || order.address || eagleCity;
          res = await fetch("/api/eagle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "add",
              tk: creds.tk ?? "",
              sk: creds.sk ?? "",
              code: order.orderNumber || order.id.slice(-8),
              fullname: order.customer || "Client",
              phone: (order.phone || "0600000000").replace(/\s+/g, ""),
              city: eagleCity || "Casablanca",
              address: eagleAddress || eagleCity || "Casablanca",
              price: String(order.amount ?? "0"),
              product: (order.product || "Produit").slice(0, 100),
              qty: "1",
              note: order.orderNumber || order.id.slice(-8),
              change: "0",
              openpackage: "0",
              stock: "1",
            }),
          });
        }
        const data = await res.json();
        const trackingCode = data.code ?? data.CODE ?? data.tracking ?? data.barcode ?? data.id ?? data.parcel_id ?? null;
        // Eagle returns {message:"success"} or similar on success
        const eagleOk = data?.message?.toLowerCase?.()?.includes("success") || data?.status?.toLowerCase?.()?.includes("success");
        const ok = res.ok && (trackingCode != null || eagleOk);
        if (ok) {
          // Single atomic PATCH: status + tracking + carrierName together
          const patchBody: Record<string, unknown> = { id: order.id, status: "expédié", carrierName: "eagle" };
          if (trackingCode) patchBody.carrierTracking = String(trackingCode);
          fetch("/api/orders", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patchBody),
          }).catch(() => {});
          setOrders(prev => prev.map(o => o.id === order.id
            ? { ...o, status: "expédié", carrierName: "eagle", ...(trackingCode ? { carrierTracking: String(trackingCode) } : {}) }
            : o));
          setDrawer(prev => prev?.id === order.id
            ? { ...prev, status: "expédié", carrierName: "eagle", ...(trackingCode ? { carrierTracking: String(trackingCode) } : {}) }
            : prev);
        }
        // Show full response detail for debugging
        const apiMsg = data?.api?.msg ?? data?.message ?? data?.error ?? "";
        // Translate common Eagle Express API errors to actionable French messages
        const friendlyEagleMsg = (() => {
          if (!apiMsg || ok) return apiMsg;
          const m = apiMsg.toLowerCase();
          if (m.includes("some parameter") || m.includes("parameter are missing") || m.includes("parameter missing") || m.includes("parameter") && m.includes("empty")) {
            const d2 = data as Record<string,unknown>;
            const keys = d2._sentKeys ?? "?";
            const raw = d2._rawBody ? ` | réponse: ${String(d2._rawBody).slice(0,200)}` : "";
            return `Eagle: ${apiMsg} | clés envoyées: ${keys}${raw}`;
          }
          if (m.includes("permission") || m.includes("403")) {
            return "Accès refusé par Eagle Express — vérifiez vos identifiants API (tk/sk) dans Intégrations";
          }
          if (m.includes("account") && m.includes("exist")) {
            return "Compte Eagle Express non reconnu — vérifiez votre token API dans Intégrations";
          }
          return `${apiMsg} — ${JSON.stringify(data).slice(0, 100)}`;
        })();
        const msgDetail = ok
          ? `Envoyé ✓ ${trackingCode ?? ""}`
          : `${friendlyEagleMsg || JSON.stringify(data).slice(0, 100)}`;
        results.push({ id: order.id, ok, msg: msgDetail });
      } catch (e) {
        results.push({ id: order.id, ok: false, msg: String(e) });
      }
    }

    setShipResults(results);
    setShipping(false);
    if (results.every(r => r.ok)) {
      setSelected(new Set());
      // Auto-close modal and switch to expédié view so orders don't appear to "disappear"
      setTimeout(() => {
        setShipModal(false);
        setShipResults([]);
        setFilter("expédié");
      }, 1200);
    }
  }

  const counts = PIPELINE.reduce((acc, s) => { acc[s] = orders.filter(o => o.status === s).length; return acc; }, {} as Record<OrderStatus, number>);
  const needsCall = counts["nouveau"];
  const confirmedCount = counts["confirmé"];
  const eagleExpédiéCount = orders.filter(o => o.status === "expédié" && (o.carrierName === "eagle" || (!o.carrierName && o.carrierTracking))).length;

  // Repeat customer detection: count orders per phone number
  const phoneCounts = orders.reduce((acc, o) => {
    if (o.phone) acc[o.phone] = (acc[o.phone] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Phones that have at least one retourné order — for duplicate warning
  const returnedPhones = useMemo(() => {
    const s = new Set<string>();
    for (const o of orders) {
      if (o.status === "retourné" && o.phone) s.add(o.phone.replace(/\s+/g, ""));
    }
    return s;
  }, [orders]);

  // Days since order received — for expédié aging alert
  function daysAgo(o: Order): number {
    const d = new Date(o.receivedAt);
    if (isNaN(d.getTime())) return 0;
    return Math.floor((Date.now() - d.getTime()) / 86_400_000);
  }

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      {toast && (
        <div className={`fixed top-5 right-5 z-[200] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-semibold transition-all ${toast.ok ? "bg-emerald-500" : "bg-red-500"}`}>
          <span>{toast.ok ? "✓" : "✕"}</span>{toast.msg}
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="sidebar-header-pl bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t("orders_title")}</h1>
            <p className="text-sm text-slate-400 hidden sm:block">{orders.length} commandes · {needsCall > 0 ? <span className="text-blue-600 font-semibold">{needsCall} appel(s) à faire</span> : "aucun appel en attente"}</p>
          </div>
          <div className="flex items-center gap-2">
            {eagleExpédiéCount > 0 && (
              <button onClick={syncEagleStatuses} disabled={syncingEagle}
                className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors whitespace-nowrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={`w-4 h-4 ${syncingEagle ? "animate-spin" : ""}`}><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
                <span className="hidden sm:inline">{syncingEagle ? t("loading") : `${t("sync_eagle")} (${eagleExpédiéCount})`}</span>
              </button>
            )}
            {confirmedCount > 0 && (
              <button onClick={() => { openShipModal(orders.filter(o => o.status === "confirmé").map(o => o.id)); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-3 lg:px-4 py-2.5 rounded-xl shadow-md shadow-indigo-200 transition-colors whitespace-nowrap flex items-center gap-2">
                <span>📦</span>
                <span className="hidden sm:inline">{t("ship_order")} ({confirmedCount})</span>
              </button>
            )}
            <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 lg:px-5 py-2.5 rounded-xl shadow-md shadow-blue-200 transition-colors whitespace-nowrap">
              {t("new_order")}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {/* Pipeline counters */}
          <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-2 lg:gap-3 mb-5">
            {PIPELINE.map(s => {
              const cfg = STATUS_CONFIG[s];
              const active = filter === s;
              return (
                <button key={s} onClick={() => setFilter(active ? "tous" : s)}
                  className={`rounded-2xl p-3 lg:p-4 border-2 text-left transition-all ${active ? `${cfg.bg} ${cfg.border} shadow-sm` : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />
                    <span className={`text-xs font-semibold truncate ${active ? cfg.color : "text-slate-400"}`}>{cfg.label}</span>
                  </div>
                  <p className={`text-2xl font-black leading-none ${active ? cfg.color : "text-slate-900"}`}>{counts[s]}</p>
                </button>
              );
            })}
          </div>

          {/* Alert banners */}
          {needsCall > 0 && (filter === "tous" || filter === "nouveau") && (
            <div className="bg-blue-600 rounded-2xl px-5 py-3 mb-3 flex items-center gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-5 h-5 shrink-0"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              <p className="text-white text-sm font-semibold flex-1">{needsCall} commande(s) en attente d&apos;appel</p>
              <button onClick={() => setFilter("nouveau")} className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-4 py-2 rounded-xl shrink-0">Voir →</button>
            </div>
          )}
          {counts["injoignable"] > 0 && (
            <div className="bg-amber-500 rounded-2xl px-5 py-3 mb-3 flex items-center gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-5 h-5 shrink-0"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 5a10.94 10.94 0 012.55 3.06M10.9 4.07C11.25 4.02 11.62 4 12 4a10 10 0 0110 10c0 .38-.02.75-.07 1.1M9.88 9.88a3 3 0 104.24 4.24"/></svg>
              <p className="text-white text-sm font-semibold flex-1">{counts["injoignable"]} client(s) injoignable(s)</p>
              <button onClick={() => setFilter("injoignable")} className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-4 py-2 rounded-xl shrink-0">Voir →</button>
            </div>
          )}
          {confirmedCount > 0 && (filter === "tous" || filter === "confirmé") && (
            <div className="bg-indigo-600 rounded-2xl px-5 py-3 mb-3 flex items-center gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-5 h-5 shrink-0"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
              <p className="text-white text-sm font-semibold flex-1">{confirmedCount} commande(s) prêtes à expédier</p>
              <button onClick={() => { openShipModal(orders.filter(o => o.status === "confirmé").map(o => o.id)); }}
                className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-4 py-2 rounded-xl whitespace-nowrap shrink-0">
                Expédier →
              </button>
            </div>
          )}

          {/* Expédié carrier status summary bar */}
          {counts["expédié"] > 0 && (() => {
            const expOrders = orders.filter(o => o.status === "expédié");
            const statuses = expOrders.map(o => (o.carrierStatus ?? "").toLowerCase());
            const livré    = statuses.filter(s => s.includes("livr")).length;
            const retourné = statuses.filter(s => s.includes("retour")).length;
            const ramassé  = statuses.filter(s => s.includes("ramassé") || s.includes("picked") || s.includes("collecté")).length;
            const enCours  = statuses.filter(s => s.includes("voyage") || s.includes("livraison") || s.includes("cours")).length;
            if (!livré && !retourné && !ramassé && !enCours) return null;
            return (
              <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 shadow-sm">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide shrink-0">Expédié · {expOrders.length}</span>
                {ramassé  > 0 && <span className="flex items-center gap-1.5 text-sm font-bold text-indigo-700"><span className="w-2 h-2 rounded-full bg-indigo-400" />Ramassé <span className="text-indigo-500 font-black">{ramassé}</span></span>}
                {enCours  > 0 && <span className="flex items-center gap-1.5 text-sm font-bold text-blue-700"><span className="w-2 h-2 rounded-full bg-blue-400" />En cours <span className="text-blue-500 font-black">{enCours}</span></span>}
                {livré    > 0 && <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-400" />Livré <span className="text-emerald-600 font-black">{livré}</span></span>}
                {retourné > 0 && <span className="flex items-center gap-1.5 text-sm font-bold text-red-600"><span className="w-2 h-2 rounded-full bg-red-400" />Retourné <span className="text-red-500 font-black">{retourné}</span></span>}
              </div>
            );
          })()}

          {/* Search + filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input type="text" placeholder={t("search_orders")} value={search} onChange={e => setSearch(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white" />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value as OrderStatus | "tous")}
              className="text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none text-slate-600 bg-white focus:border-blue-400">
              <option value="tous">{t("filter_all")}</option>
              {PIPELINE.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label} ({counts[s]})</option>)}
            </select>
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="bg-slate-900 text-white rounded-2xl px-5 py-3 mb-4 flex items-center gap-4 flex-wrap">
              <span className="text-sm font-semibold">{selected.size} sélectionné(s)</span>
              <div className="flex gap-2 flex-wrap">
                {/* Ship — admin only */}
                {isAdmin && (
                  <button onClick={() => { openShipModal(); }}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5">
                    📦 Envoyer au transporteur
                  </button>
                )}
                {/* Agent + admin */}
                <button onClick={() => { selected.forEach(id => setStatus(id, "confirmé")); setSelected(new Set()); }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
                  ✓ Confirmer
                </button>
                <button onClick={() => { selected.forEach(id => setStatus(id, "annulé")); setSelected(new Set()); }}
                  className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
                  ✗ Annuler
                </button>
                <button onClick={() => { selected.forEach(id => setStatus(id, "injoignable")); setSelected(new Set()); }}
                  className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
                  Injoignable
                </button>
                <button onClick={() => { selected.forEach(id => setStatus(id, "fausse")); setSelected(new Set()); }}
                  className="bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
                  Fausse
                </button>
                {/* Delete — admin only */}
                {isAdmin && (
                  <button onClick={() => {
                    if (!window.confirm(`Supprimer ${selected.size} commande(s) ? Action irréversible.`)) return;
                    selected.forEach(id => {
                      setOrders(prev => prev.filter(o => o.id !== id));
                      invalidateCache("/api/orders");
                      fetch("/api/orders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
                    });
                    setSelected(new Set());
                    showToast(`${selected.size} commande(s) supprimée(s).`);
                  }}
                    className="bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
                    🗑 Supprimer
                  </button>
                )}
              </div>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-slate-400 hover:text-white text-xs">✕ Désélectionner</button>
            </div>
          )}

          {/* Mobile card layout */}
          <div className="sm:hidden space-y-3">
            {displayed.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center text-slate-400 text-sm">{t("no_orders")}</div>
            )}
            {displayed.map(o => {
              const cfg = STATUS_CONFIG[o.status];
              const isSelected = selected.has(o.id);
              const repeatCount = phoneCounts[o.phone] ?? 1;
              const cardBg = isSelected ? "bg-blue-50 border-blue-200"
                : o.status === "injoignable" ? "bg-amber-50/60 border-amber-200"
                : o.status === "fausse" ? "bg-purple-50/60 border-purple-200"
                : o.status === "annulé" ? "bg-red-50/40 border-red-100"
                : "bg-white border-slate-100";
              return (
                <div key={o.id} className={`rounded-2xl border shadow-sm p-4 ${cardBg}`}>
                  {/* Top row: order number + status + date */}
                  <div className="flex items-center gap-2 mb-3">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(o.id)}
                      className="w-4 h-4 rounded accent-blue-600 cursor-pointer shrink-0" />
                    <span className="font-mono text-xs text-slate-400 flex-1 truncate">{o.orderNumber}</span>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                      {o.carrierStatus && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${
                          o.carrierStatus.toLowerCase().includes("livr") ? "bg-emerald-50 text-emerald-700" :
                          o.carrierStatus.toLowerCase().includes("retour") ? "bg-red-50 text-red-600" :
                          o.carrierStatus.toLowerCase().includes("ramassé") || o.carrierStatus.toLowerCase().includes("picked") ? "bg-indigo-50 text-indigo-700" :
                          "bg-blue-50 text-blue-700"
                        }`}>
                          📦 {o.carrierStatus.split(/[\n,]+/)[0].trim().slice(0, 20)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{o.date}</span>
                  </div>

                  {/* Customer + phone + repeat badge */}
                  <div className="flex items-start gap-2 mb-2" onClick={() => setDrawer(o)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-900">{o.customer}</p>
                        {repeatCount > 1 && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                            🔁 {repeatCount} commandes
                          </span>
                        )}
                        {o.status !== "retourné" && returnedPhones.has((o.phone ?? "").replace(/\s+/g, "")) && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded-lg">⚠️ Retour passé</span>
                        )}
                      </div>
                      <a href={`tel:${o.phone}`} onClick={e => { e.stopPropagation(); incrementAttempt(o.id); }}
                        className="flex items-center gap-1 text-blue-600 text-sm font-medium mt-0.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 shrink-0"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                        {o.phone}
                      </a>
                      {o.noAnswer > 0 && (
                        <span className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg ${o.noAnswer >= 3 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                          📵 {o.noAnswer}× sans réponse
                          {o.noAnswer >= 3 && o.status !== "annulé" && o.status !== "livré" && (
                            <button onClick={e => { e.stopPropagation(); setStatus(o.id, "annulé"); }}
                              className="ml-1 text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200">
                              Annuler?
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* City, product, amount */}
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-2 flex-wrap" onClick={() => setDrawer(o)}>
                    {o.city && <span className="text-slate-400">{o.city}</span>}
                    {o.city && <span className="text-slate-200">·</span>}
                    <span className="truncate flex-1">{o.product}</span>
                    <span className="font-black text-slate-900 shrink-0">{o.amount} {o.currency}</span>
                  </div>

                  {/* Source + action buttons */}
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <SourceBadge source={o.source} />
                    {o.status === "nouveau" && (
                      <>
                        <button onClick={() => setStatus(o.id, "confirmé")}
                          className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors shadow-sm shadow-emerald-200">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3"><polyline points="20 6 9 17 4 12"/></svg>
                          Confirmer
                        </button>
                        <button onClick={() => setStatus(o.id, "annulé")}
                          className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors shadow-sm shadow-red-200">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          Annuler
                        </button>
                        <button onClick={() => setStatus(o.id, "injoignable")}
                          className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors shadow-sm shadow-amber-200">
                          Injoignable
                        </button>
                        <button onClick={() => setStatus(o.id, "fausse")}
                          className="flex items-center gap-1 bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors shadow-sm shadow-purple-200">
                          Fausse
                        </button>
                      </>
                    )}
                    {o.status === "injoignable" && (
                      <button onClick={() => setStatus(o.id, "nouveau")}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
                        ↩ Rappeler
                      </button>
                    )}
                    {o.status === "confirmé" && isAdmin && (
                      <button onClick={() => { openShipModal([o.id]); }}
                        className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors shadow-sm shadow-indigo-200">
                        📦 Expédier
                      </button>
                    )}
                    {o.status === "expédié" && (
                      <>
                        {o.carrierTracking && (
                          <span className="text-[10px] font-mono bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-1 rounded-lg truncate max-w-[90px]" title={o.carrierTracking}>
                            📦 {o.carrierTracking}
                          </span>
                        )}
                        {daysAgo(o) > 7 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-lg">⏰ {daysAgo(o)}j</span>
                        )}
                        {isAdmin && <>
                          <button onClick={() => setStatus(o.id, "livré")} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors">Livré</button>
                          <button onClick={() => setStatus(o.id, "retourné")} className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors">Retour</button>
                        </>}
                      </>
                    )}
                    {o.status === "retourné" && isAdmin && (
                      <button onClick={() => openShipModal([o.id])}
                        className="flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors">
                        🔄 Ré-expédier
                      </button>
                    )}
                    <button onClick={() => setDrawer(o)}
                      className="ml-auto text-slate-400 hover:text-slate-600 border border-slate-200 hover:bg-slate-50 p-1.5 rounded-xl transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                    {isAdmin && (
                      <button onClick={() => deleteOrder(o.id)}
                        className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-xl transition-colors border border-transparent hover:border-rose-100"
                        title="Supprimer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3">
                      <input type="checkbox"
                        checked={displayed.length > 0 && selected.size === displayed.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                    </th>
                    {["#", "Client", "Ville", "Téléphone", "Produit", "Montant", "Source", "Statut", "Actions"].map(h => (
                      <th key={h} className="text-left px-5 py-3 font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-16 text-slate-400 text-sm">Aucune commande trouvée</td></tr>
                  )}
                  {displayed.map(o => {
                    const cfg = STATUS_CONFIG[o.status];
                    const isSelected = selected.has(o.id);
                    const repeatCount = phoneCounts[o.phone] ?? 1;
                    const rowBg = isSelected ? "bg-blue-50 border-blue-100"
                      : o.status === "injoignable" ? "bg-amber-50/40 hover:bg-amber-50/60 border-amber-100"
                      : o.status === "fausse" ? "bg-purple-50/40 hover:bg-purple-50/60 border-purple-100"
                      : o.status === "annulé" ? "bg-red-50/30 hover:bg-red-50/50 border-slate-50"
                      : "border-slate-50 hover:bg-slate-50/60";
                    return (
                      <tr key={o.id} className={`border-b transition-colors cursor-pointer ${rowBg}`}>
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(o.id)}
                            className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-400 whitespace-nowrap" onClick={() => setDrawer(o)}>{o.orderNumber}</td>
                        <td className="px-5 py-3.5" onClick={() => setDrawer(o)}>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-800">{o.customer}</p>
                            {repeatCount > 1 && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                                🔁 {repeatCount}
                              </span>
                            )}
                          </div>
                          {o.notes && <p className="text-xs text-slate-400 truncate max-w-[140px]">{o.notes}</p>}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap" onClick={() => setDrawer(o)}>{o.city}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <a href={`tel:${o.phone}`} onClick={e => { e.stopPropagation(); incrementAttempt(o.id); }}
                            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium transition-colors group">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                            {o.phone}
                          </a>
                          {o.noAnswer > 0 && (
                            <span className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg ${o.noAnswer >= 3 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                              📵 {o.noAnswer}× sans réponse
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 max-w-[130px] truncate" onClick={() => setDrawer(o)}>{o.product}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-800 whitespace-nowrap" onClick={() => setDrawer(o)}>{o.amount} {o.currency}</td>
                        <td className="px-5 py-3.5" onClick={() => setDrawer(o)}>
                          <SourceBadge source={o.source} />
                        </td>
                        <td className="px-5 py-3.5" onClick={() => setDrawer(o)}>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                          {o.status === "expédié" && (() => {
                            if (!o.carrierStatus) return (
                              <span className="mt-1 flex text-xs text-slate-300 font-medium">— en attente</span>
                            );
                            const s = o.carrierStatus.toLowerCase();
                            const isLivr   = s.includes("livr");
                            const isRetour = s.includes("retour");
                            const isRam    = s.includes("ramassé") || s.includes("collecté") || s.includes("picked");
                            const isCours  = s.includes("cours") || s.includes("voyage") || s.includes("livraison");
                            const style = isLivr   ? "bg-emerald-100 text-emerald-700" :
                                          isRetour  ? "bg-red-100 text-red-600" :
                                          isRam     ? "bg-indigo-100 text-indigo-700" :
                                          isCours   ? "bg-blue-100 text-blue-700" :
                                                      "bg-slate-100 text-slate-600";
                            const icon = isLivr ? "✓" : isRetour ? "↩" : isRam ? "📦" : "🚚";
                            return (
                              <span className={`mt-1 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg ${style}`}>
                                {icon} {o.carrierStatus.split(/[\n,]+/)[0].trim().slice(0, 20)}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            {/* Call-center action buttons for new orders */}
                            {o.status === "nouveau" && (
                              <>
                                <button onClick={() => setStatus(o.id, "confirmé")}
                                  title="Confirmer"
                                  className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors shadow-sm shadow-emerald-200 whitespace-nowrap">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg>
                                  Confirmer
                                </button>
                                <button onClick={() => setStatus(o.id, "annulé")}
                                  title="Annuler"
                                  className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors shadow-sm shadow-red-200 whitespace-nowrap">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  Annuler
                                </button>
                                <button onClick={() => setStatus(o.id, "injoignable")}
                                  title="Injoignable"
                                  className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors shadow-sm shadow-amber-200 whitespace-nowrap">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 5a10.94 10.94 0 012.55 3.06M10.9 4.07C11.25 4.02 11.62 4 12 4a10 10 0 0110 10c0 .38-.02.75-.07 1.1M9.88 9.88a3 3 0 104.24 4.24"/></svg>
                                  Injoignable
                                </button>
                                <button onClick={() => setStatus(o.id, "fausse")}
                                  title="Fausse commande"
                                  className="flex items-center gap-1 bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors shadow-sm shadow-purple-200 whitespace-nowrap">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                  Fausse
                                </button>
                              </>
                            )}
                            {o.status === "injoignable" && (
                              <button onClick={() => setStatus(o.id, "nouveau")}
                                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 whitespace-nowrap">
                                ↩ Rappeler
                              </button>
                            )}
                            {o.status === "confirmé" && isAdmin && (
                              <button onClick={() => { openShipModal([o.id]); }}
                                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors shadow-sm shadow-indigo-200 whitespace-nowrap">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
                                Expédier
                              </button>
                            )}
                            {o.status === "expédié" && isAdmin && (
                              <>
                                <button onClick={() => setStatus(o.id, "livré")} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors whitespace-nowrap">Livré</button>
                                <button onClick={() => setStatus(o.id, "retourné")} className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors whitespace-nowrap">Retour</button>
                              </>
                            )}
                            <button onClick={() => { setNotesModal(o); setNoteText(o.notes); }}
                              className="text-slate-400 hover:text-slate-600 border border-slate-200 hover:bg-slate-50 p-1.5 rounded-xl transition-colors">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            {isAdmin && (
                              <button onClick={() => deleteOrder(o.id)}
                                title="Supprimer"
                                className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-xl transition-colors border border-transparent hover:border-rose-100">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Add order modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Nouvelle commande</h2>
              <button onClick={() => { setShowModal(false); setForm(emptyForm); setCatalogSearch(""); setCitySearch(""); }} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "customer", label: "Nom client *", ph: "Ex: Youssef Alami", full: true },
                { key: "phone", label: "Téléphone *", ph: "0612345678" },
              ].map(({ key, label, ph, full }) => (
                <div key={key} className={full ? "col-span-2" : ""}>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
                  <input type="text" placeholder={ph} value={form[key as keyof typeof emptyForm] as string}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                </div>
              ))}
              {/* City — searchable dropdown */}
              <div className="relative">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Ville</label>
                <input type="text" placeholder="Rechercher ville…"
                  value={citySearch}
                  onChange={e => { setCitySearch(e.target.value); setForm(f => ({ ...f, city: e.target.value })); setShowCityDrop(true); }}
                  onFocus={() => setShowCityDrop(true)}
                  onBlur={() => setTimeout(() => setShowCityDrop(false), 150)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                {showCityDrop && eagleCities.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase())).length > 0 && (
                  <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-44 overflow-y-auto">
                    {eagleCities.filter(c => !citySearch || c.name.toLowerCase().includes(citySearch.toLowerCase())).map(c => (
                      <button key={c.id} type="button" onMouseDown={() => { setForm(f => ({ ...f, city: c.name })); setCitySearch(c.name); setShowCityDrop(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between">
                        <span>{c.name}</span><span className="text-xs text-slate-400">#{c.id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Adresse</label>
                <input type="text" placeholder="Rue, quartier…" value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
              </div>

              {/* Product — catalog search */}
              <div className="col-span-2 relative">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Produit *</label>
                <input
                  type="text"
                  placeholder="Rechercher dans le catalogue…"
                  value={catalogSearch}
                  onChange={e => {
                    setCatalogSearch(e.target.value);
                    setForm(f => ({ ...f, product: e.target.value }));
                    setShowCatalogDrop(true);
                  }}
                  onFocus={() => setShowCatalogDrop(true)}
                  onBlur={() => setTimeout(() => setShowCatalogDrop(false), 150)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                />
                {showCatalogDrop && filteredCatalog.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    {filteredCatalog.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => applyCatalogProduct(p)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 transition-colors text-left"
                      >
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="w-9 h-9 rounded-lg object-cover border border-slate-100 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-slate-400">
                              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.sku && `SKU: ${p.sku} · `}{p.sellPrice} MAD · Stock: {p.stock}</p>
                        </div>
                        <span className="text-xs font-bold text-blue-600 shrink-0">{p.sellPrice} MAD</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {[
                { key: "amount", label: "Montant COD (MAD) *", ph: "350" },
                { key: "notes", label: "Notes", ph: "Optionnel" },
              ].map(({ key, label, ph }) => (
                <div key={key} className={key === "notes" ? "col-span-2" : ""}>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
                  <input type="text" placeholder={ph} value={form[key as keyof typeof emptyForm] as string}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Source</label>
                <div className="flex gap-2">
                  {(["manuel", "lightfunnels", "shopify"] as Order["source"][]).map(s => (
                    <button key={s} onClick={() => setForm(f => ({ ...f, source: s }))}
                      className={`flex-1 py-2 rounded-xl border-2 text-xs font-semibold capitalize transition-all ${form.source === s ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-500"}`}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowModal(false); setForm(emptyForm); setCatalogSearch(""); setCitySearch(""); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
              <button onClick={addOrder} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-200">Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* Notes modal */}
      {notesModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-slate-900 mb-1">Notes — {notesModal.customer}</h2>
            <p className="text-xs text-slate-400 mb-4">{notesModal.orderNumber} · {notesModal.product}</p>
            <textarea rows={4} value={noteText} onChange={e => setNoteText(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-400 resize-none" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setNotesModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
              <button onClick={() => saveNote(notesModal.id, noteText)} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping modal */}
      {shipModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Envoyer au transporteur</h2>
              <button onClick={() => { setShipModal(false); setShipResults([]); }} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
                <span className="text-2xl">🦅</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-800">Eagle Express</p>
                  <p className="text-xs text-amber-600">{selected.size} colis → Expédié</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-amber-500 font-medium">38 MAD / colis</p>
                  <p className="text-sm font-black text-amber-800">{selected.size * 38} MAD</p>
                </div>
              </div>

              {/* Depuis stock badge */}
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-emerald-600 text-base">✅</span>
                <span className="text-xs font-semibold text-emerald-700">Depuis stock activé</span>
              </div>

              {/* Results */}
              {shipResults.length > 0 && (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {shipResults.map(r => {
                    const o = orders.find(x => x.id === r.id);
                    return (
                      <div key={r.id} className={`px-3 py-2.5 rounded-xl text-sm ${r.ok ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{r.ok ? "✓" : "✗"}</span>
                          <span className={`font-semibold ${r.ok ? "text-emerald-700" : "text-red-700"}`}>{o?.customer ?? r.id}</span>
                        </div>
                        <p className={`text-xs mt-0.5 ${r.ok ? "text-emerald-600" : "text-red-500"}`}>{r.msg}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Eagle Express — city select + address per order */}
              {shipCarrier === "eagle" && !shipResults.length && (() => {
                const selectedOrders = orders.filter(o => selected.has(o.id));
                return (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500">🏙 Ville et adresse :</p>
                    {selectedOrders.map(o => {
                      const currentCity = cityOverrides[o.id] ?? o.city ?? "";
                      return (
                        <div key={o.id} className="p-2 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                          <p className="text-xs font-semibold text-slate-700 truncate">{o.customer}</p>
                          {o.city && (
                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span className="font-medium text-slate-500">Client a écrit :</span>
                              <span className="font-semibold text-slate-600 bg-yellow-50 border border-yellow-200 rounded px-1">{o.city}</span>
                            </p>
                          )}
                          <select
                            value={currentCity}
                            onChange={e => setCityOverrides(prev => ({ ...prev, [o.id]: e.target.value }))}
                            className={`w-full text-xs border rounded-lg px-2 py-1.5 outline-none focus:border-amber-400 bg-white ${currentCity ? "border-emerald-400 text-slate-800" : "border-red-300 text-slate-400"}`}
                          >
                            <option value="">— Choisissez une ville —</option>
                            {eagleCities.map(c => (
                              <option key={c.id || c.name} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Adresse"
                            value={eagleAddressOverrides[o.id] ?? o.address ?? ""}
                            onChange={e => setEagleAddressOverrides(prev => ({ ...prev, [o.id]: e.target.value }))}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-amber-400 bg-white"
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <p className="text-xs text-slate-400">
                Les identifiants API de Eagle Express doivent être configurés dans la page Intégrations.
              </p>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setShipModal(false); setShipResults([]); }}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Fermer
              </button>
              {(() => {
                const failedIds = new Set(shipResults.filter(r => !r.ok).map(r => r.id));
                if (shipResults.length > 0 && failedIds.size === 0) return null;
                return (
                  <button
                    onClick={() => shipResults.length > 0 ? sendToCarrier(failedIds) : sendToCarrier()}
                    disabled={shipping || (shipResults.length === 0 && selected.size === 0)}
                    className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-indigo-200 transition-colors">
                    {shipping ? "Envoi en cours…" : shipResults.length > 0 ? `Réessayer ${failedIds.size} échoué(s) →` : `Envoyer ${selected.size} colis →`}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Order detail drawer */}
      {drawer && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setDrawer(null)} />
          <div className="fixed right-0 top-0 h-full w-full sm:w-[440px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-slate-400">{drawer.orderNumber}</span>
                <SourceBadge source={drawer.source} />
                <span className="text-xs text-slate-400">{drawer.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditMode(!editMode); setEditForm({ customer: drawer.customer, phone: drawer.phone, city: drawer.city, address: drawer.address, product: drawer.product, amount: String(drawer.amount) }); }}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${editMode ? "bg-blue-100 text-blue-600" : "hover:bg-slate-100 text-slate-400"}`} title="Modifier">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={() => { setDrawer(null); setEditMode(false); }} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {editMode ? (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
                  <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Modifier la commande</h3>
                  {[
                    { key: "customer", label: "Nom client", ph: "Nom complet" },
                    { key: "phone",    label: "Téléphone",  ph: "0612345678" },
                    { key: "address",  label: "Adresse",    ph: "Rue, quartier…" },
                    { key: "product",  label: "Produit",    ph: "Nom du produit" },
                    { key: "amount",   label: "COD (MAD)",  ph: "350" },
                  ].map(({ key, label, ph }) => (
                    <div key={key}>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">{label}</label>
                      <input type={key === "amount" ? "number" : "text"} placeholder={ph}
                        value={editForm[key as keyof typeof editForm]}
                        onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white" />
                    </div>
                  ))}
                  {/* City — searchable dropdown */}
                  <div className="relative">
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Ville</label>
                    <input type="text" placeholder="Rechercher ville…"
                      value={editCitySearch || editForm.city}
                      onChange={e => { setEditCitySearch(e.target.value); setEditForm(f => ({ ...f, city: e.target.value })); setShowEditCityDrop(true); }}
                      onFocus={() => { setEditCitySearch(editForm.city); setShowEditCityDrop(true); }}
                      onBlur={() => setTimeout(() => setShowEditCityDrop(false), 150)}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white" />
                    {showEditCityDrop && eagleCities.filter(c => !editCitySearch || c.name.toLowerCase().includes(editCitySearch.toLowerCase())).length > 0 && (
                      <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                        {eagleCities.filter(c => !editCitySearch || c.name.toLowerCase().includes(editCitySearch.toLowerCase())).map(c => (
                          <button key={c.id} type="button" onMouseDown={() => { setEditForm(f => ({ ...f, city: c.name })); setEditCitySearch(c.name); setShowEditCityDrop(false); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between">
                            <span>{c.name}</span><span className="text-xs text-slate-400">#{c.id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditMode(false)} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
                    <button onClick={saveEditForm} className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-200">Sauvegarder</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Client</h3>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg shrink-0">
                        {drawer.customer.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{drawer.customer}</p>
                        <p className="text-sm text-slate-500">{drawer.city || "Ville inconnue"}{drawer.address ? ` · ${drawer.address}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`tel:${drawer.phone}`} onClick={() => incrementAttempt(drawer.id)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-md shadow-blue-200">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                        {drawer.phone}
                      </a>
                      <button onClick={() => markNoAnswer(drawer.id)}
                        className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${drawer.noAnswer >= 3 ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-slate-200 hover:bg-slate-300 text-slate-700"}`}>
                        📵 Pas dispo
                      </button>
                    </div>
                    {drawer.noAnswer > 0 && (
                      <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl ${drawer.noAnswer >= 3 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                        📵 {drawer.noAnswer} sans réponse · {drawer.attempts} appel(s)
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Commande</h3>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-800">{drawer.product}</p>
                      <p className="text-lg font-black text-slate-900">{drawer.amount} {drawer.currency}</p>
                    </div>
                  </div>
                </>
              )}

              {/* Status changer */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Statut</h3>
                  {/* Agent badge */}
                  {!isAdmin && (
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      Agent — statuts limités
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PIPELINE.map(s => {
                    const cfg = STATUS_CONFIG[s];
                    const active = drawer.status === s;
                    // Statuses only admin can set
                    const adminOnly = (["expédié", "livré", "retourné"] as OrderStatus[]).includes(s);
                    const disabled = !isAdmin && adminOnly;
                    return (
                      <button key={s}
                        disabled={disabled}
                        onClick={() => !disabled && setStatus(drawer.id, s)}
                        title={disabled ? "Réservé à l'admin" : undefined}
                        className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl border-2 text-sm font-semibold transition-all
                          ${disabled ? "opacity-30 cursor-not-allowed bg-slate-50 border-slate-100 text-slate-400" :
                            active ? `${cfg.bg} ${cfg.border} ${cfg.color}` :
                            "bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-white"}`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${active ? cfg.dot : "bg-slate-300"}`} />
                        {cfg.label}
                        {active && !disabled && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5 ml-auto"><polyline points="20 6 9 17 4 12"/></svg>}
                        {disabled && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 ml-auto opacity-50"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick action buttons */}
              {drawer.status === "nouveau" && (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setStatus(drawer.id, "confirmé")} className="py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold shadow-md shadow-emerald-200 transition-colors flex items-center justify-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><polyline points="20 6 9 17 4 12"/></svg>
                    Confirmer
                  </button>
                  <button onClick={() => setStatus(drawer.id, "annulé")} className="py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold shadow-md shadow-red-200 transition-colors flex items-center justify-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    Annuler
                  </button>
                  <button onClick={() => setStatus(drawer.id, "injoignable")} className="py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow-md shadow-amber-200 transition-colors flex items-center justify-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 5a10.94 10.94 0 012.55 3.06"/></svg>
                    Injoignable
                  </button>
                  <button onClick={() => setStatus(drawer.id, "fausse")} className="py-3 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold shadow-md shadow-purple-200 transition-colors flex items-center justify-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Fausse commande
                  </button>
                </div>
              )}
              {drawer.status === "confirmé" && isAdmin && (
                <button onClick={() => { openShipModal([drawer.id]); setDrawer(null); }}
                  className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-200 transition-colors flex items-center justify-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
                  Envoyer au transporteur
                </button>
              )}
              {drawer.status === "expédié" && (
                <div className="space-y-3">
                  {drawer.carrierTracking && (() => {
                    const cs = drawer.carrierStatus ?? "";
                    const sl = cs.toLowerCase();
                    const isLivr   = sl.includes("livr");
                    const isRetour = sl.includes("retour") || sl.includes("hors") || sl.includes("zone");
                    const isRam    = sl.includes("ramassé") || sl.includes("collecté") || sl.includes("picked");
                    const isPasRep = sl.includes("pas de réponse") || sl.includes("pas reponse") || sl.includes("absent");
                    const isReport = sl.includes("reporté") || sl.includes("reporte");
                    const bgColor  = cs
                      ? isLivr    ? "bg-emerald-50 border-emerald-200"
                      : isRetour  ? "bg-red-50 border-red-200"
                      : isRam     ? "bg-indigo-50 border-indigo-200"
                      : isPasRep  ? "bg-amber-50 border-amber-200"
                      : isReport  ? "bg-orange-50 border-orange-200"
                      :             "bg-blue-50 border-blue-200"
                      : "bg-slate-50 border-slate-200";
                    const textColor = cs
                      ? isLivr   ? "text-emerald-700"
                      : isRetour ? "text-red-600"
                      : isRam    ? "text-indigo-700"
                      : isPasRep ? "text-amber-700"
                      : isReport ? "text-orange-700"
                      :            "text-blue-700"
                      : "text-slate-400";
                    return (
                      <div className={`border rounded-2xl p-4 space-y-2 ${bgColor}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Suivi transporteur</p>
                            <p className="font-mono text-xs font-bold text-slate-500 mt-0.5">{drawer.carrierTracking}</p>
                          </div>
                          {cs && (
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-xl ${bgColor} ${textColor} border`}>
                              {isLivr ? "✓" : isRetour ? "↩" : isPasRep ? "📵" : isReport ? "📅" : "📦"} {cs.split(/[\n,]+/)[0].trim().slice(0, 22)}
                            </span>
                          )}
                        </div>
                        {cs ? (
                          <p className={`text-xs font-semibold ${textColor}`}>{cs}</p>
                        ) : (
                          <p className="text-xs text-slate-400">Pas encore reçu — le statut s'affichera automatiquement au prochain changement de statut.</p>
                        )}
                      </div>
                    );
                  })()}
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button onClick={() => setStatus(drawer.id, "livré")} className="flex-1 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow-md shadow-teal-200">✓ Livré</button>
                      <button onClick={() => setStatus(drawer.id, "retourné")} className="flex-1 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold shadow-md shadow-orange-200">↩ Retourné</button>
                    </div>
                  )}
                </div>
              )}
              {/* Carrier tracking — show/edit for admins */}
              {isAdmin && (() => {
                const hasTracking = !!drawer.carrierTracking;
                const carrierLabel = drawer.carrierName === "eagle" ? "Eagle Express" : drawer.carrierName ?? "";
                const cs = drawer.carrierStatus ?? "";
                const sl = cs.toLowerCase();
                const bgColor = sl.includes("livr") ? "bg-teal-50 border-teal-200"
                  : sl.includes("retour") || sl.includes("hors") || sl.includes("zone") ? "bg-orange-50 border-orange-200"
                  : sl.includes("annul") || sl.includes("cancel") || sl.includes("perdu") ? "bg-red-50 border-red-200"
                  : sl.includes("expéd") || sl.includes("distribut") || sl.includes("transit") ? "bg-indigo-50 border-indigo-200"
                  : "bg-slate-50 border-slate-200";
                const textColor = sl.includes("livr") ? "text-teal-700"
                  : sl.includes("retour") || sl.includes("hors") ? "text-orange-700"
                  : sl.includes("annul") || sl.includes("perdu") ? "text-red-700"
                  : "text-slate-600";
                return (
                  <div className={`border rounded-2xl p-4 space-y-2 ${hasTracking ? bgColor : "bg-slate-50 border-slate-200"}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        Suivi {carrierLabel || "transporteur"}
                      </p>
                      <button onClick={() => { setTrackEditOpen(o => !o); setTrackEditCode(drawer.carrierTracking ?? ""); setTrackEditCarrier(drawer.carrierName ?? "eagle"); }}
                        className="text-xs text-indigo-500 font-semibold hover:underline">
                        {hasTracking ? "Modifier" : "+ Ajouter code"}
                      </button>
                    </div>
                    {hasTracking && !trackEditOpen && (
                      <>
                        <p className="font-mono text-xs font-bold text-slate-700">{drawer.carrierTracking}</p>
                        {cs ? <p className={`text-xs font-semibold ${textColor}`}>{cs}</p>
                            : <p className="text-xs text-slate-400">En attente du premier statut transporteur.</p>}
                      </>
                    )}
                    {!hasTracking && !trackEditOpen && (
                      <p className="text-xs text-slate-400">Aucun code de suivi — cliquez &quot;+ Ajouter code&quot; pour lier manuellement.</p>
                    )}
                    {trackEditOpen && (
                      <div className="space-y-2 pt-1">
                        <div className="flex gap-2">
                          <select value={trackEditCarrier} onChange={e => setTrackEditCarrier(e.target.value)}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400 bg-white shrink-0">
                            <option value="eagle">Eagle Express</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Code suivi (ex: EGL123456)"
                            value={trackEditCode}
                            onChange={e => setTrackEditCode(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && saveTrackingInline(drawer.id, trackEditCode, trackEditCarrier)}
                            autoFocus
                            className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400 bg-white font-mono"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveTrackingInline(drawer.id, trackEditCode, trackEditCarrier)}
                            disabled={!trackEditCode.trim()}
                            className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold">
                            Enregistrer
                          </button>
                          <button onClick={() => { setTrackEditOpen(false); setTrackEditCode(""); }}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50">
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Delete — admin only */}
              {isAdmin && (
                <button onClick={() => deleteOrder(drawer.id)}
                  className="w-full py-2.5 rounded-2xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                  Supprimer la commande
                </button>
              )}

              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notes</h3>
                <textarea rows={3} defaultValue={drawer.notes} onBlur={e => saveNoteInline(drawer.id, e.target.value)}
                  placeholder="Raison d'annulation, adresse précise, préférence de livraison…"
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-none bg-white" />
                <p className="text-xs text-slate-400">Sauvegardé automatiquement au clic</p>
              </div>

              {/* Order history for repeat customers */}
              {drawer.phone && (phoneCounts[drawer.phone] ?? 1) > 1 && (() => {
                const history = orders.filter(o => o.phone === drawer.phone && o.id !== drawer.id);
                if (!history.length) return null;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Historique client</h3>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        🔁 {phoneCounts[drawer.phone]} commandes
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {history.map(h => {
                        const hcfg = STATUS_CONFIG[h.status];
                        return (
                          <button key={h.id} onClick={() => setDrawer(h)}
                            className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl px-3 py-2.5 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs text-slate-400">{h.orderNumber}</span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border ${hcfg.bg} ${hcfg.color} ${hcfg.border}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${hcfg.dot}`} />
                                {hcfg.label}
                              </span>
                              <span className="text-xs font-bold text-slate-700 shrink-0">{h.amount} {h.currency}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 truncate">{h.product}</p>
                            <p className="text-xs text-slate-400">{h.date}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
