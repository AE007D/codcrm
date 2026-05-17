// Landing pages persisted in Supabase crm_pages table
import { supabase } from "./supabase";
import crypto from "crypto";

export type LandingPage = {
  id: string;
  slug: string;
  ownerId: string;
  title: string;
  subtitle: string;
  price: number;
  originalPrice: number;
  currency: string;
  images: string[];
  bullets: string[];
  urgencyText: string;
  ctaText: string;
  primaryColor: string;
  theme: "light" | "dark";
  showTrustBadges: boolean;
  showStickyBar: boolean;
  requireAddress: boolean;
  active: boolean;
  views: number;
  orders: number;
  created_at: string;
  facebookPixelId?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPage(row: any): LandingPage {
  return {
    id: row.id,
    slug: row.slug,
    ownerId: row.owner_id,
    title: row.title ?? "",
    subtitle: row.subtitle ?? "",
    price: parseFloat(row.price ?? "0"),
    originalPrice: parseFloat(row.original_price ?? "0"),
    currency: row.currency ?? "MAD",
    images: row.images ?? [],
    bullets: row.bullets ?? [],
    urgencyText: row.urgency_text ?? "",
    ctaText: row.cta_text ?? "",
    primaryColor: row.primary_color ?? "#2563EB",
    theme: row.theme ?? "light",
    showTrustBadges: row.show_trust_badges ?? true,
    showStickyBar: row.show_sticky_bar ?? true,
    requireAddress: row.require_address ?? true,
    active: row.active ?? true,
    views: row.views ?? 0,
    orders: row.orders ?? 0,
    created_at: row.created_at,
  };
}

export async function getPages(ownerId: string): Promise<LandingPage[]> {
  const { data, error } = await supabase
    .from("crm_pages")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) { console.error("getPages:", error.message); return []; }
  return (data ?? []).map(rowToPage);
}

export async function getPageBySlug(slug: string): Promise<LandingPage | null> {
  const { data, error } = await supabase
    .from("crm_pages")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) { console.error("getPageBySlug:", error.message); return null; }
  return data ? rowToPage(data) : null;
}

export async function savePage(page: Omit<LandingPage, "id" | "views" | "orders" | "created_at"> & Partial<Pick<LandingPage, "id" | "views" | "orders" | "created_at">>): Promise<LandingPage> {
  const id = page.id ?? crypto.randomUUID();
  const { data, error } = await supabase
    .from("crm_pages")
    .upsert({
      id,
      slug: page.slug,
      owner_id: page.ownerId,
      title: page.title,
      subtitle: page.subtitle ?? "",
      price: page.price,
      original_price: page.originalPrice ?? 0,
      currency: page.currency ?? "MAD",
      images: page.images ?? [],
      bullets: page.bullets ?? [],
      urgency_text: page.urgencyText ?? "",
      cta_text: page.ctaText ?? "",
      primary_color: page.primaryColor ?? "#2563EB",
      theme: page.theme ?? "light",
      show_trust_badges: page.showTrustBadges ?? true,
      show_sticky_bar: page.showStickyBar ?? true,
      require_address: page.requireAddress ?? true,
      active: page.active ?? true,
      views: page.views ?? 0,
      orders: page.orders ?? 0,
      created_at: page.created_at ?? new Date().toISOString(),
    }, { onConflict: "id" })
    .select()
    .single();
  if (error) throw new Error("savePage: " + error.message);
  return rowToPage(data);
}

export async function deletePage(id: string, ownerId: string): Promise<void> {
  await supabase.from("crm_pages").delete().eq("id", id).eq("owner_id", ownerId);
}

export async function incrementPageOrders(slug: string): Promise<void> {
  const { data } = await supabase.from("crm_pages").select("orders").eq("slug", slug).maybeSingle();
  if (!data) return;
  await supabase.from("crm_pages").update({ orders: (data.orders ?? 0) + 1 }).eq("slug", slug);
}

export async function incrementPageViews(slug: string): Promise<void> {
  const { data } = await supabase.from("crm_pages").select("views").eq("slug", slug).maybeSingle();
  if (!data) return;
  await supabase.from("crm_pages").update({ views: (data.views ?? 0) + 1 }).eq("slug", slug);
}
