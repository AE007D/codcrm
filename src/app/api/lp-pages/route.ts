import { NextRequest, NextResponse } from "next/server";
import { getPages, getPageBySlug, savePage, deletePage, LandingPage } from "@/lib/pageStore";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (slug) {
    const page = getPageBySlug(slug);
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(page);
  }
  return NextResponse.json({ pages: getPages() });
}

export async function POST(request: NextRequest) {
  let body: Partial<LandingPage>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const id = `lp_${Date.now()}`;
  const slug = body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") || `page-${id.slice(-6)}`;

  // Conflict check
  if (getPageBySlug(slug)) return NextResponse.json({ error: "Ce slug existe déjà." }, { status: 409 });

  const page: LandingPage = {
    id,
    slug,
    title: body.title || "Mon Produit",
    subtitle: body.subtitle || "",
    price: Number(body.price) || 299,
    originalPrice: Number(body.originalPrice) || 0,
    currency: body.currency || "MAD",
    images: body.images || [],
    bullets: body.bullets || [],
    urgencyText: body.urgencyText || "هذا العرض مؤقت — لن تجده مرة أخرى !!!",
    ctaText: body.ctaText || "إستفد من العرض الآن 🛒",
    primaryColor: body.primaryColor || "#2563EB",
    theme: body.theme || "light",
    showTrustBadges: body.showTrustBadges !== false,
    showStickyBar: body.showStickyBar !== false,
    requireAddress: body.requireAddress !== false,
    active: true,
    views: 0,
    orders: 0,
    created_at: new Date().toISOString(),
  };

  savePage(page);
  return NextResponse.json({ ok: true, page });
}

export async function PATCH(request: NextRequest) {
  let body: Partial<LandingPage> & { id: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const pages = getPages();
  const idx = pages.findIndex(p => p.id === body.id);
  if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  savePage({ ...pages[idx], ...body });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  deletePage(id);
  return NextResponse.json({ ok: true });
}
