"use client";

import { useState, useEffect, useCallback } from "react";
import { resolveCity, resolveAmeexCityId, AMEEX_CITIES_FALLBACK } from "@/lib/moroccanCities";
import { cachedFetch, invalidateCache } from "@/lib/clientCache";
import Sidebar from "@/components/Sidebar";

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
  source: "lightfunnels" | "shopify" | "manuel";
  notes: string;
  attempts: number;
  noAnswer: number;
};


const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  nouveau:     { label: "Nouveau",          color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200",   dot: "bg-blue-500" },
  confirmé:    { label: "Confirmé",         color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200",dot: "bg-emerald-500" },
  annulé:      { label: "Annulé",           color: "text-red-600",     bg: "bg-red-50",      border: "border-red-200",    dot: "bg-red-500" },
  injoignable: { label: "Injoignable",      color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",  dot: "bg-amber-500" },
  fausse:      { label: "Fausse commande",  color: "text-purple-700",  bg: "bg-purple-50",   border: "border-purple-200", dot: "bg-purple-500" },
  expédié:     { label: "Expédié",          color: "text-indigo-700",  bg: "bg-indigo-50",   border: "border-indigo-200", dot: "bg-indigo-500" },
  livré:       { label: "Livré",            color: "text-teal-700",    bg: "bg-teal-50",     border: "border-teal-200",   dot: "bg-teal-500" },
  retourné:    { label: "Retourné",         color: "text-orange-700",  bg: "bg-orange-50",   border: "border-orange-200", dot: "bg-orange-500" },
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

type ShipCarrier = "ameex" | "eagle";

type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  image: string;
  sellPrice: number;
  stock: number;
};

export default function CommandesPage() {
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
  const [shipCarrier, setShipCarrier] = useState<ShipCarrier>("ameex");
  const [shipping, setShipping] = useState(false);
  const [shipResults, setShipResults] = useState<{ id: string; ok: boolean; msg: string }[]>([]);
  const [ameexCities, setAmeexCities] = useState<{ id: string; name: string }[]>([]);
  const [cityOverrides, setCityOverrides] = useState<Record<string, string>>({}); // orderId → cityId (Ameex) or city name (Eagle)
  const [eagleAddressOverrides, setEagleAddressOverrides] = useState<Record<string, string>>({}); // orderId → address override for Eagle
  const [ameexShipType, setAmeexShipType] = useState<"SIMPLE"|"STOCK">("SIMPLE");
  const [ameexDepots, setAmeexDepots] = useState<{ id: string; name: string }[]>([]);
  const [ameexDepot, setAmeexDepot] = useState<string>("");
  const [ameexProductIds, setAmeexProductIds] = useState<Record<string, string>>({}); // orderId → ameex product id
  const [ameexStockProducts, setAmeexStockProducts] = useState<{ id: string; ref: string; name: string }[]>([]); // Ameex warehouse products

  // Edit mode for drawer
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<{ customer: string; phone: string; city: string; address: string; product: string; amount: string }>({ customer: "", phone: "", city: "", address: "", product: "", amount: "" });
  const [citySearch, setCitySearch] = useState("");
  const [editCitySearch, setEditCitySearch] = useState("");
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
        source: (o.source ?? "manuel") as Order["source"],
        notes: String(o.notes ?? ""),
        attempts: Number(o.attempts ?? 0),
        noAnswer: Number(o.noAnswer ?? o.no_answer ?? 0),
      })));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchOrders();
    const t = setInterval(fetchOrders, 30_000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  // Listen for new orders from sidebar polling
  useEffect(() => {
    const handler = () => fetchOrders();
    window.addEventListener("new-orders", handler);
    return () => window.removeEventListener("new-orders", handler);
  }, [fetchOrders]);

  // ── Load Ameex cities once on mount ──────────────────────────────────────
  useEffect(() => {
    // 1. Start with hardcoded fallback so dropdown is always populated
    setAmeexCities(AMEEX_CITIES_FALLBACK);
    // 2. Load from localStorage cache (overrides fallback if fresher data)
    try {
      const cached = localStorage.getItem("codcrm_ameex_cities");
      if (cached) { const parsed = JSON.parse(cached); if (parsed?.length) setAmeexCities(parsed); }
    } catch { /* ignore */ }
    // 3. Load preferences + refresh from API
    fetch("/api/settings").then(r => r.json()).then(async d => {
      // Restore ship type + depot from Ameex config OR from ameexShipPref
      const ameexCfg = d.settings?.ameex ?? {};
      const pref = d.settings?.ameexShipPref ?? {};
      const savedType = ameexCfg.defaultType ?? pref.type;
      const savedDepot = ameexCfg.depotId ?? pref.depot;
      if (savedType) setAmeexShipType(savedType);
      if (savedDepot) setAmeexDepot(savedDepot);

      const creds = d.settings?.ameex ?? {};
      if (!creds.apiId) return;
      const cd = await fetch("/api/ameex", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cities", apiId: creds.apiId, apiKey: creds.apiKey }),
      }).then(r => r.json());
      const raw = Array.isArray(cd) ? cd
        : Array.isArray(cd?.api?.data) ? cd.api.data
        : Array.isArray(cd?.data) ? cd.data
        : Array.isArray(cd?.cities) ? cd.cities
        : Array.isArray(cd?.result) ? cd.result
        : [];
      const list = raw.map((c: Record<string,unknown>) => ({ id: String(c.id ?? c.city_id ?? ""), name: String(c.name ?? c.city_name ?? c.ville ?? "") })).filter((c: {id:string;name:string}) => c.id && c.name);
      if (list.length) { setAmeexCities(list); try { localStorage.setItem("codcrm_ameex_cities", JSON.stringify(list)); } catch { /* ignore */ } }
    }).catch(() => {});
  }, []);

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
    setAmeexProductIds({});
    if (ids) setSelected(new Set(ids));
    setShipModal(true);
    // Pre-load Ameex cities + depots (fallback already loaded on mount; try API refresh)
    try {
      const settingsData = await fetch("/api/settings").then(r => r.json());
      const creds = settingsData.settings?.ameex ?? {};
      // Apply saved default type + depot from Ameex config
      if (creds.defaultType) setAmeexShipType(creds.defaultType);
      if (creds.depotId) setAmeexDepot(creds.depotId);
      if (creds.apiId) {
        // Cities
        const cd = await fetch("/api/ameex", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cities", apiId: creds.apiId, apiKey: creds.apiKey }),
        }).then(r => r.json());
        const rawC = Array.isArray(cd) ? cd : Array.isArray(cd?.api?.data) ? cd.api.data : Array.isArray(cd?.data) ? cd.data : Array.isArray(cd?.cities) ? cd.cities : Array.isArray(cd?.result) ? cd.result : [];
        const cityList = rawC.map((c: Record<string,unknown>) => ({ id: String(c.id ?? c.city_id ?? ""), name: String(c.name ?? c.city_name ?? c.ville ?? "") })).filter((c: {id:string;name:string}) => c.id && c.name);
        if (cityList.length) { setAmeexCities(cityList); try { localStorage.setItem("codcrm_ameex_cities", JSON.stringify(cityList)); } catch { /* */ } }

        // Load stock depots via /Stock/Depots (GET) — gives us hub IDs for this account
        let resolvedDepotId = creds.depotId ?? ameexDepot ?? "";
        try {
          const sd = await fetch("/api/ameex", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "stocks", apiId: creds.apiId, apiKey: creds.apiKey }),
          }).then(r => r.json());
          // Also try /Delivery/Depots if stocks empty
          const rawSD: unknown[] = Array.isArray(sd) ? sd
            : Array.isArray(sd?.api?.data) ? sd.api.data
            : Array.isArray(sd?.data) ? sd.data
            : Array.isArray(sd?.result) ? sd.result
            : [];
          const depotList = rawSD.map((h: unknown) => {
            const hub = h as Record<string,unknown>;
            return {
              id: String(hub.id ?? hub.depot_id ?? hub.ID ?? hub.HUB_ID ?? ""),
              name: String(hub.name ?? hub.depot_name ?? hub.Name ?? hub.HUB_NAME ?? hub.label ?? ""),
            };
          }).filter(h => h.id && h.name);
          if (depotList.length) {
            setAmeexDepots(depotList);
            if (!resolvedDepotId) {
              resolvedDepotId = depotList[0].id;
              setAmeexDepot(depotList[0].id);
            }
          }
        } catch { /* silent */ }

        // If /Stock/Depots returned nothing, try /Delivery/Depots
        if (!ameexDepots.length) {
          try {
            const dd = await fetch("/api/ameex", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "depots", apiId: creds.apiId, apiKey: creds.apiKey }),
            }).then(r => r.json());
            const rawDD: unknown[] = Array.isArray(dd) ? dd
              : Array.isArray(dd?.api?.data) ? dd.api.data
              : Array.isArray(dd?.data) ? dd.data
              : [];
            const depList = rawDD.map((h: unknown) => {
              const hub = h as Record<string,unknown>;
              return {
                id: String(hub.id ?? hub.depot_id ?? hub.ID ?? ""),
                name: String(hub.name ?? hub.depot_name ?? hub.Name ?? hub.label ?? ""),
              };
            }).filter(h => h.id && h.name);
            if (depList.length) {
              setAmeexDepots(depList);
              if (!resolvedDepotId) { resolvedDepotId = depList[0].id; setAmeexDepot(depList[0].id); }
            }
          } catch { /* silent */ }
        }

        // Load stock products — pass depot ID so Ameex can filter by hub
        const hubForProducts = resolvedDepotId || "34";
        try {
          const sp = await fetch("/api/ameex", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "stockProducts",
              apiId: creds.apiId,
              apiKey: creds.apiKey,
              depot: hubForProducts,
              hub: hubForProducts,
              p_hub: hubForProducts,
            }),
          }).then(r => r.json());
          // Response shape: {api:{data:[{id,ref,name,...}]}} or [{id,ref,...}]
          const rawSP: unknown[] = Array.isArray(sp) ? sp
            : Array.isArray(sp?.api?.data) ? sp.api.data
            : Array.isArray(sp?.data) ? sp.data
            : Array.isArray(sp?.result) ? sp.result
            : [];
          const spList = rawSP.map((p: unknown) => {
            const pr = p as Record<string,unknown>;
            return {
              id:   String(pr.id   ?? pr.product_id ?? pr.ID ?? ""),
              ref:  String(pr.ref  ?? pr.Ref ?? pr.sku ?? pr.SKU ?? pr.reference ?? pr.REF ?? ""),
              name: String(pr.name ?? pr.Name ?? pr.label ?? pr.product_name ?? pr.NAME ?? ""),
            };
          }).filter(p => p.id);
          if (spList.length) setAmeexStockProducts(spList);
        } catch { /* silent */ }

      }
    } catch { /* silent */ }
  }

  // Send selected orders to carrier
  async function sendToCarrier() {
    setShipping(true);
    setShipResults([]);
    const selectedOrders = orders.filter(o => selected.has(o.id));

    // Load credentials from server settings, with localStorage fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let creds: Record<string, any> = {};
    try {
      const settingsData = await fetch("/api/settings").then(r => r.json());
      const s = settingsData.settings ?? {};
      creds = shipCarrier === "ameex" ? (s.ameex ?? {}) : (s.eagle ?? {});
    } catch { /* no creds */ }
    // Fallback: Eagle creds may have been saved in standalone /eagle page (localStorage)
    if (shipCarrier === "eagle" && !creds.tk) {
      try {
        const stored = localStorage.getItem("eagle_creds");
        if (stored) { const parsed = JSON.parse(stored); if (parsed?.tk) creds = parsed; }
      } catch { /* ignore */ }
    }

    // Resolve ship type + depot: prefer fresh settings > UI state
    const shipType: string = creds.defaultType ?? ameexShipType ?? "SIMPLE";
    const depotId: string  = creds.depotId     ?? ameexDepot    ?? "";

    const results: { id: string; ok: boolean; msg: string }[] = [];

    for (const order of selectedOrders) {
      try {
        let res: Response;
        if (shipCarrier === "ameex") {
          // City: override from ship modal > smart multi-strategy resolver > raw value
          const cityRaw   = (order.city ?? "").trim();
          const overrideVal = cityOverrides[order.id] ?? "";
          const cityId    = overrideVal
                          || resolveAmeexCityId(cityRaw, ameexCities)
                          || cityRaw;
          res = await fetch("/api/ameex", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "addParcel",
              apiId: creds.apiId ?? "",
              apiKey: creds.apiKey ?? "",
              // Correct Ameex field names (confirmed by API test)
              receiver: order.customer,
              phone: order.phone,
              city: cityId,
              address: order.address || order.city,
              cod: order.amount,
              product: order.product,
              order_num: order.orderNumber || order.id.slice(-8),
              comment: "",
              type: shipType,
              ...(shipType === "STOCK" ? (() => {
                const hub = depotId || "34";
                // Resolve product: manual input (orderId key) > auto-match from catalog SKU/Ref
                const manualVal = ameexProductIds[order.id]?.trim() ?? "";
                // Auto-match SKU from CRM catalog by order product name
                const autoSku = (() => {
                  const m = catalog.find(p =>
                    p.name.toLowerCase() === (order.product ?? "").toLowerCase() ||
                    (order.product ?? "").toLowerCase().includes(p.name.toLowerCase()) ||
                    p.name.toLowerCase().includes((order.product ?? "").toLowerCase())
                  );
                  return m?.sku ?? "";
                })();
                const resolvedRef = manualVal || autoSku;
                // Try to resolve numeric Ameex product ID from the fetched stock products list
                // matching by Réf (= CRM SKU) — Ameex needs the numeric ID, not the Réf string
                const numericId = (() => {
                  if (!resolvedRef || !ameexStockProducts.length) return "";
                  const found = ameexStockProducts.find(p =>
                    p.ref.toLowerCase() === resolvedRef.toLowerCase() ||
                    p.name.toLowerCase() === (order.product ?? "").toLowerCase() ||
                    (order.product ?? "").toLowerCase().includes(p.name.toLowerCase())
                  );
                  return found?.id ?? "";
                })();
                // Use numeric ID if found, otherwise fall back to Réf string
                const productId = numericId || resolvedRef;
                return {
                  p_hub: hub,
                  ...(productId ? { p_product: productId } : {}),
                };
              })() : {}),
              open: "NO",
              try: "NO",
              fragile: "0",
              replace: "false",
            }),
          });
        } else {
          const eagleCity = cityOverrides[order.id] || order.city || "";
          const eagleAddress = eagleAddressOverrides[order.id] || order.address || eagleCity;
          res = await fetch("/api/eagle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "add",
              tk: creds.tk ?? "",
              sk: creds.sk ?? "",
              fullname: order.customer || "—",
              phone: order.phone || "",
              city: eagleCity || "Casablanca",
              address: eagleAddress || eagleCity || "—",
              price: String(order.amount ?? ""),
              product: order.product || "Produit",
              qty: "1",
              note: order.orderNumber || order.id.slice(-8),
              change: "0",
              openpackage: "0",
            }),
          });
        }
        const data = await res.json();
        // Ameex wraps response: {login:"success", api:{type:"success", msg:"...", data:{id:..., code:"..."}}}
        const nested = data?.api?.data ?? data?.data ?? null;
        const trackingCode = nested?.code ?? nested?.id ?? data.code ?? data.CODE ?? data.tracking ?? data.barcode ?? data.id ?? data.parcel_id ?? null;
        // Eagle returns {message:"success"} or similar on success
        const eagleOk = data?.message?.toLowerCase?.()?.includes("success") || data?.status?.toLowerCase?.()?.includes("success");
        const ok = res.ok && (trackingCode != null || data?.api?.type === "success" || eagleOk);
        if (ok) {
          setStatus(order.id, "expédié");
          // Save the carrier tracking code so webhooks can auto-update this order
          if (trackingCode) {
            fetch("/api/orders", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: order.id, carrierTracking: String(trackingCode) }),
            }).catch(() => {});
          }
        }
        // Show full response detail for debugging
        const apiMsg = data?.api?.msg ?? data?.message ?? data?.error ?? "";
        const msgDetail = ok
          ? `Envoyé ✓ ${trackingCode ?? ""}`
          : `${apiMsg || JSON.stringify(data).slice(0, 100)}`;
        results.push({ id: order.id, ok, msg: msgDetail });
      } catch (e) {
        results.push({ id: order.id, ok: false, msg: String(e) });
      }
    }

    setShipResults(results);
    setShipping(false);
    if (results.every(r => r.ok)) {
      setSelected(new Set());
    }
  }

  const counts = PIPELINE.reduce((acc, s) => { acc[s] = orders.filter(o => o.status === s).length; return acc; }, {} as Record<OrderStatus, number>);
  const needsCall = counts["nouveau"];
  const confirmedCount = counts["confirmé"];

  // Repeat customer detection: count orders per phone number
  const phoneCounts = orders.reduce((acc, o) => {
    if (o.phone) acc[o.phone] = (acc[o.phone] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      {toast && (
        <div className={`fixed top-5 right-5 z-[200] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-semibold transition-all ${toast.ok ? "bg-emerald-500" : "bg-red-500"}`}>
          <span>{toast.ok ? "✓" : "✕"}</span>{toast.msg}
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Commandes</h1>
            <p className="text-sm text-slate-400 hidden sm:block">{orders.length} commandes · {needsCall > 0 ? <span className="text-blue-600 font-semibold">{needsCall} appel(s) à faire</span> : "aucun appel en attente"}</p>
          </div>
          <div className="flex items-center gap-2">
            {confirmedCount > 0 && (
              <button onClick={() => { openShipModal(orders.filter(o => o.status === "confirmé").map(o => o.id)); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-3 lg:px-4 py-2.5 rounded-xl shadow-md shadow-indigo-200 transition-colors whitespace-nowrap flex items-center gap-2">
                <span>📦</span>
                <span className="hidden sm:inline">Expédier ({confirmedCount})</span>
              </button>
            )}
            <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 lg:px-5 py-2.5 rounded-xl shadow-md shadow-blue-200 transition-colors whitespace-nowrap">
              + Nouvelle commande
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

          {/* Search + filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input type="text" placeholder="Rechercher client, téléphone, produit…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white" />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value as OrderStatus | "tous")}
              className="text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none text-slate-600 bg-white focus:border-blue-400">
              <option value="tous">Tous les statuts</option>
              {PIPELINE.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label} ({counts[s]})</option>)}
            </select>
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="bg-slate-900 text-white rounded-2xl px-5 py-3 mb-4 flex items-center gap-4 flex-wrap">
              <span className="text-sm font-semibold">{selected.size} sélectionné(s)</span>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => { openShipModal(); }}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5">
                  📦 Envoyer au transporteur
                </button>
                <button onClick={() => { selected.forEach(id => setStatus(id, "confirmé")); setSelected(new Set()); }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
                  ✓ Confirmer tout
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
              </div>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-slate-400 hover:text-white text-xs">✕ Désélectionner</button>
            </div>
          )}

          {/* Mobile card layout */}
          <div className="sm:hidden space-y-3">
            {displayed.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center text-slate-400 text-sm">Aucune commande trouvée</div>
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
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border shrink-0 ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
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
                      </div>
                      <a href={`tel:${o.phone}`} onClick={e => { e.stopPropagation(); incrementAttempt(o.id); }}
                        className="flex items-center gap-1 text-blue-600 text-sm font-medium mt-0.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 shrink-0"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                        {o.phone}
                      </a>
                      {o.noAnswer > 0 && (
                        <span className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg ${o.noAnswer >= 3 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                          📵 {o.noAnswer}× sans réponse
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
                    {o.status === "confirmé" && (
                      <button onClick={() => { openShipModal([o.id]); }}
                        className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors shadow-sm shadow-indigo-200">
                        📦 Expédier
                      </button>
                    )}
                    {o.status === "expédié" && (
                      <>
                        <button onClick={() => setStatus(o.id, "livré")} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors">Livré</button>
                        <button onClick={() => setStatus(o.id, "retourné")} className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors">Retour</button>
                      </>
                    )}
                    <button onClick={() => setDrawer(o)}
                      className="ml-auto text-slate-400 hover:text-slate-600 border border-slate-200 hover:bg-slate-50 p-1.5 rounded-xl transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
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
                    <tr><td colSpan={10} className="text-center py-16 text-slate-400 text-sm">Aucune commande trouvée</td></tr>
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
                        <td className="px-4 py-3.5" onClick={e => { e.stopPropagation(); toggleSelect(o.id); }}>
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
                            {o.status === "confirmé" && (
                              <button onClick={() => { openShipModal([o.id]); }}
                                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors shadow-sm shadow-indigo-200 whitespace-nowrap">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
                                Expédier
                              </button>
                            )}
                            {o.status === "expédié" && (
                              <>
                                <button onClick={() => setStatus(o.id, "livré")} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors whitespace-nowrap">Livré</button>
                                <button onClick={() => setStatus(o.id, "retourné")} className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors whitespace-nowrap">Retour</button>
                              </>
                            )}
                            <button onClick={() => { setNotesModal(o); setNoteText(o.notes); }}
                              className="text-slate-400 hover:text-slate-600 border border-slate-200 hover:bg-slate-50 p-1.5 rounded-xl transition-colors">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
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
              {/* City — searchable Ameex dropdown */}
              <div className="relative">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Ville</label>
                <input type="text" placeholder="Rechercher ville…"
                  value={citySearch}
                  onChange={e => { setCitySearch(e.target.value); setForm(f => ({ ...f, city: e.target.value })); setShowCityDrop(true); }}
                  onFocus={() => setShowCityDrop(true)}
                  onBlur={() => setTimeout(() => setShowCityDrop(false), 150)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                {showCityDrop && ameexCities.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase())).length > 0 && (
                  <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-44 overflow-y-auto">
                    {ameexCities.filter(c => !citySearch || c.name.toLowerCase().includes(citySearch.toLowerCase())).slice(0, 10).map(c => (
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
              <div>
                <p className="text-sm text-slate-500 mb-3">{selected.size} commande(s) sélectionnée(s) seront envoyées et passées en <strong>Expédié</strong>.</p>
                <div className="grid grid-cols-2 gap-3">
                  {([["ameex", "Ameex", "🟠"], ["eagle", "Eagle Express", "🦅"]] as [ShipCarrier, string, string][]).map(([key, label, icon]) => (
                    <button key={key} onClick={() => setShipCarrier(key)}
                      className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all ${shipCarrier === key ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300"}`}>
                      <span className="text-2xl">{icon}</span>
                      <span className={`text-sm font-bold ${shipCarrier === key ? "text-indigo-700" : "text-slate-700"}`}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ameex — type envoi : Ramassage vs Stock */}
              {shipCarrier === "ameex" && !shipResults.length && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">📦 Type d&apos;envoi :</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([["SIMPLE","🚚 Ramassage","Le transporteur vient récupérer"],["STOCK","🏭 Stock / Hub","Depuis votre dépôt Ameex"]] as const).map(([val, label, desc]) => (
                      <button key={val} onClick={() => { setAmeexShipType(val); fetch("/api/settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({ameexShipPref:{type:val,depot:ameexDepot}})}); }}
                        className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${ameexShipType === val ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}>
                        <span className={`text-xs font-bold ${ameexShipType === val ? "text-blue-700" : "text-slate-700"}`}>{label}</span>
                        <span className="text-[10px] text-slate-400 leading-tight">{desc}</span>
                      </button>
                    ))}
                  </div>
                  {ameexShipType === "STOCK" && (
                    <div className="mt-2 space-y-2">
                      {/* Hub selector */}
                      {ameexDepots.length > 0 ? (
                        <select
                          value={ameexDepot}
                          onChange={e => { setAmeexDepot(e.target.value); fetch("/api/settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({ameexShipPref:{type:ameexShipType,depot:e.target.value}})}); }}
                          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 bg-white font-medium"
                        >
                          {ameexDepots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="ID du dépôt (ex: 34 = Casablanca Hub Principal)"
                            value={ameexDepot}
                            onChange={e => setAmeexDepot(e.target.value)}
                            className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400"
                          />
                          <span className="text-xs text-slate-400 self-center shrink-0">🏭 Hub</span>
                        </div>
                      )}
                      {/* Product ID per order (auto-matched from Ameex stock + manual override) */}
                      {ameexShipType === "STOCK" && (() => {
                        const selectedOrders = orders.filter(o => selected.has(o.id));
                        return (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Produit Ameex {ameexStockProducts.length > 0 ? `(${ameexStockProducts.length} chargés)` : "(non chargés)"} :
                              </p>
                              {ameexStockProducts.length === 0 && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const sd = await fetch("/api/settings").then(r => r.json());
                                      const cr = sd.settings?.ameex ?? {};
                                      if (!cr.apiId) return;
                                      const hub = cr.depotId ?? ameexDepot ?? "34";
                                      const sp = await fetch("/api/ameex", {
                                        method: "POST", headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ action: "stockProducts", apiId: cr.apiId, apiKey: cr.apiKey, depot: hub, hub, p_hub: hub }),
                                      }).then(r => r.json());
                                      // Try every known response shape
                                      const rawSP: unknown[] = Array.isArray(sp) ? sp
                                        : Array.isArray(sp?.api?.data) ? sp.api.data
                                        : Array.isArray(sp?.data) ? sp.data
                                        : Array.isArray(sp?.result) ? sp.result
                                        : typeof sp === "object" && sp !== null ? Object.values(sp as object).find(v => Array.isArray(v)) ?? []
                                        : [];
                                      const spList = rawSP.map((p: unknown) => {
                                        const pr = p as Record<string,unknown>;
                                        return {
                                          id:   String(pr.id ?? pr.product_id ?? pr.ID ?? ""),
                                          ref:  String(pr.ref ?? pr.Ref ?? pr.sku ?? pr.SKU ?? pr.reference ?? pr.REF ?? ""),
                                          name: String(pr.name ?? pr.Name ?? pr.label ?? pr.product_name ?? pr.NAME ?? ""),
                                        };
                                      }).filter(p => p.id);
                                      if (spList.length) setAmeexStockProducts(spList);
                                      else alert("Réponse Ameex:\n" + JSON.stringify(sp, null, 2).slice(0, 800));
                                    } catch (e) { alert(String(e)); }
                                  }}
                                  className="text-[10px] text-blue-600 underline"
                                >
                                  Recharger
                                </button>
                              )}
                            </div>
                            {selectedOrders.map(o => {
                              // Match CRM catalog to get SKU/Réf
                              const catalogMatch = catalog.find(p =>
                                p.name.toLowerCase() === (o.product ?? "").toLowerCase() ||
                                (o.product ?? "").toLowerCase().includes(p.name.toLowerCase()) ||
                                p.name.toLowerCase().includes((o.product ?? "").toLowerCase())
                              );
                              const autoSku = catalogMatch?.sku ?? "";
                              // Match Ameex stock products by Réf or name to get numeric ID
                              const ameexMatch = ameexStockProducts.find(p =>
                                (autoSku && p.ref.toLowerCase() === autoSku.toLowerCase()) ||
                                p.name.toLowerCase() === (o.product ?? "").toLowerCase() ||
                                (o.product ?? "").toLowerCase().includes(p.name.toLowerCase())
                              );
                              const autoId = ameexMatch?.id ?? "";
                              // Display value: manual override > resolved numeric ID > SKU ref
                              const current = ameexProductIds[o.id] ?? autoId ?? autoSku;
                              const isResolved = !!(ameexMatch || current);
                              return (
                                <div key={o.id} className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-600 w-16 truncate shrink-0">{o.customer}</span>
                                    <input
                                      type="text"
                                      placeholder="ID produit Ameex…"
                                      value={current}
                                      onChange={e => setAmeexProductIds(prev => ({ ...prev, [o.id]: e.target.value }))}
                                      className={`flex-1 text-xs font-mono border rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 ${isResolved ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}
                                    />
                                    {isResolved && <span className="text-emerald-600 text-xs shrink-0">✓</span>}
                                  </div>
                                  {ameexMatch && (
                                    <p className="text-[10px] text-emerald-600 pl-[4.5rem]">
                                      ✓ {ameexMatch.name} — ID Ameex: {ameexMatch.id}
                                    </p>
                                  )}
                                  {!ameexMatch && autoSku && ameexStockProducts.length > 0 && (
                                    <p className="text-[10px] text-amber-500 pl-[4.5rem]">
                                      ⚠ Réf {autoSku} introuvable dans les {ameexStockProducts.length} produits Ameex
                                    </p>
                                  )}
                                  {!ameexMatch && autoSku && ameexStockProducts.length === 0 && (
                                    <p className="text-[10px] text-amber-500 pl-[4.5rem]">
                                      Réf CRM: {autoSku} — cliquer &quot;Recharger&quot; pour obtenir l&apos;ID Ameex
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

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

              {/* Ameex — city selector for ALL orders, pre-filled, always editable */}
              {!shipResults.length && shipCarrier === "ameex" && (() => {
                const cityNameMap: Record<string,string> = {};
                for (const c of ameexCities) { cityNameMap[c.id] = c.name; }
                const selectedOrders = orders.filter(o => selected.has(o.id));
                return (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500">🏙 Vérifiez la ville de chaque commande avant d&apos;envoyer :</p>
                    {selectedOrders.map(o => {
                      const autoId = resolveAmeexCityId(o.city ?? "", ameexCities) ?? undefined;
                      const currentVal = cityOverrides[o.id] ?? autoId ?? "";
                      const currentName = currentVal ? (cityNameMap[currentVal] ?? currentVal) : "";
                      return (
                        <div key={o.id} className={`flex items-center gap-2 p-2 rounded-xl border ${currentVal ? "border-slate-200 bg-slate-50" : "border-amber-300 bg-amber-50"}`}>
                          <span className="text-xs font-semibold text-slate-700 w-20 truncate shrink-0">{o.customer}</span>
                          <div className="flex-1 relative">
                            <input
                              list={`cities-${o.id}`}
                              placeholder="Tapez ou choisissez une ville…"
                              value={currentName}
                              onChange={e => {
                                const typed = e.target.value;
                                // Try to match typed value to a city name → store the ID
                                const matched = ameexCities.find(c => c.name.toLowerCase() === typed.toLowerCase());
                                if (matched) {
                                  setCityOverrides(prev => ({ ...prev, [o.id]: matched.id }));
                                } else {
                                  // Store as-is (search mode); if the user selects from datalist it will match
                                  setCityOverrides(prev => ({ ...prev, [o.id]: typed }));
                                }
                              }}
                              onBlur={e => {
                                // On blur, resolve typed value to a city ID if possible
                                const typed = e.target.value.trim();
                                if (!typed) { setCityOverrides(prev => ({ ...prev, [o.id]: "" })); return; }
                                const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
                                const matched = ameexCities.find(c =>
                                  c.name.toLowerCase() === typed.toLowerCase() ||
                                  norm(c.name) === norm(typed)
                                );
                                if (matched) setCityOverrides(prev => ({ ...prev, [o.id]: matched.id }));
                              }}
                              className={`w-full text-xs border rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 bg-white ${currentVal && !ameexCities.find(c=>c.id===currentVal) ? "border-amber-300" : "border-slate-200"}`}
                            />
                            <datalist id={`cities-${o.id}`}>
                              {ameexCities.map(c => <option key={c.id} value={c.name} />)}
                            </datalist>
                            {currentVal && ameexCities.find(c=>c.id===currentVal) && (
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">#{currentVal}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {/* Eagle Express — city + address editor per order */}
              {!shipResults.length && shipCarrier === "eagle" && (() => {
                const selectedOrders = orders.filter(o => selected.has(o.id));
                return (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500">🏙 Vérifiez ville et adresse avant d&apos;envoyer :</p>
                    {selectedOrders.map(o => (
                      <div key={o.id} className="p-2 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                        <p className="text-xs font-semibold text-slate-700 truncate">{o.customer}</p>
                        <input
                          type="text"
                          placeholder="Ville (ex: Casablanca)"
                          value={cityOverrides[o.id] ?? o.city ?? ""}
                          onChange={e => setCityOverrides(prev => ({ ...prev, [o.id]: e.target.value }))}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-amber-400 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Adresse"
                          value={eagleAddressOverrides[o.id] ?? o.address ?? ""}
                          onChange={e => setEagleAddressOverrides(prev => ({ ...prev, [o.id]: e.target.value }))}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-amber-400 bg-white"
                        />
                      </div>
                    ))}
                  </div>
                );
              })()}
              {!shipResults.length && (
                <p className="text-xs text-slate-400">
                  Les identifiants API de {shipCarrier === "ameex" ? "Ameex" : "Eagle Express"} doivent être configurés dans la page Intégrations.
                </p>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setShipModal(false); setShipResults([]); }}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Fermer
              </button>
              {!shipResults.length && (() => {
                const hasUnresolved = shipCarrier === "ameex" && orders.filter(o => selected.has(o.id)).some(o => {
                  const autoId = resolveAmeexCityId(o.city ?? "", ameexCities);
                  const val = cityOverrides[o.id] ?? autoId ?? "";
                  return !val;
                });
                return (
                  <button onClick={sendToCarrier} disabled={shipping || selected.size === 0 || hasUnresolved}
                    title={hasUnresolved ? "Sélectionnez la ville pour chaque commande" : ""}
                    className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-indigo-200 transition-colors">
                    {shipping ? "Envoi en cours…" : `Envoyer ${selected.size} colis →`}
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
                  {/* City — searchable Ameex dropdown */}
                  <div className="relative">
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Ville</label>
                    <input type="text" placeholder="Rechercher ville…"
                      value={editCitySearch || editForm.city}
                      onChange={e => { setEditCitySearch(e.target.value); setEditForm(f => ({ ...f, city: e.target.value })); setShowEditCityDrop(true); }}
                      onFocus={() => { setEditCitySearch(editForm.city); setShowEditCityDrop(true); }}
                      onBlur={() => setTimeout(() => setShowEditCityDrop(false), 150)}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white" />
                    {showEditCityDrop && ameexCities.filter(c => !editCitySearch || c.name.toLowerCase().includes(editCitySearch.toLowerCase())).length > 0 && (
                      <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                        {ameexCities.filter(c => !editCitySearch || c.name.toLowerCase().includes(editCitySearch.toLowerCase())).slice(0, 10).map(c => (
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
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Statut</h3>
                <div className="grid grid-cols-2 gap-2">
                  {PIPELINE.map(s => {
                    const cfg = STATUS_CONFIG[s];
                    const active = drawer.status === s;
                    return (
                      <button key={s} onClick={() => setStatus(drawer.id, s)}
                        className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${active ? `${cfg.bg} ${cfg.border} ${cfg.color}` : "bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-white"}`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${active ? cfg.dot : "bg-slate-300"}`} />
                        {cfg.label}
                        {active && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5 ml-auto"><polyline points="20 6 9 17 4 12"/></svg>}
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
              {drawer.status === "confirmé" && (
                <button onClick={() => { openShipModal([drawer.id]); setDrawer(null); }}
                  className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-200 transition-colors flex items-center justify-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
                  Envoyer au transporteur
                </button>
              )}
              {drawer.status === "expédié" && (
                <div className="flex gap-2">
                  <button onClick={() => setStatus(drawer.id, "livré")} className="flex-1 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow-md shadow-teal-200">✓ Livré</button>
                  <button onClick={() => setStatus(drawer.id, "retourné")} className="flex-1 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold shadow-md shadow-orange-200">↩ Retourné</button>
                </div>
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
