// In-memory store for COD landing pages
// Persists across HMR via globalThis

export type LandingPage = {
  id: string;
  slug: string;
  title: string;           // product name (French/Arabic)
  subtitle: string;        // short tagline
  price: number;
  originalPrice: number;   // struck-through price
  currency: string;        // MAD
  images: string[];        // product image URLs
  bullets: string[];       // selling point bullets
  urgencyText: string;
  ctaText: string;
  primaryColor: string;    // hex e.g. "#0ea5e9"
  theme: "light" | "dark";
  showTrustBadges: boolean;
  showStickyBar: boolean;
  requireAddress: boolean;
  active: boolean;
  views: number;
  orders: number;
  created_at: string;
  ownerId: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __lpPages: LandingPage[] | undefined;
}

export function getPages(ownerId: string): LandingPage[] {
  if (!globalThis.__lpPages) globalThis.__lpPages = [];
  return globalThis.__lpPages.filter(p => p.ownerId === ownerId);
}

export function getPageBySlug(slug: string): LandingPage | undefined {
  if (!globalThis.__lpPages) return undefined;
  return globalThis.__lpPages.find(p => p.slug === slug);
}

export function savePage(page: LandingPage) {
  if (!globalThis.__lpPages) globalThis.__lpPages = [];
  const idx = globalThis.__lpPages.findIndex(p => p.id === page.id);
  if (idx >= 0) globalThis.__lpPages[idx] = page;
  else globalThis.__lpPages.unshift(page);
}

export function deletePage(id: string, ownerId: string) {
  if (!globalThis.__lpPages) return;
  globalThis.__lpPages = globalThis.__lpPages.filter(p => !(p.id === id && p.ownerId === ownerId));
}

export function incrementViews(slug: string) {
  const p = getPageBySlug(slug);
  if (p) p.views = (p.views || 0) + 1;
}

export function incrementOrders(slug: string) {
  const p = getPageBySlug(slug);
  if (p) p.orders = (p.orders || 0) + 1;
}
