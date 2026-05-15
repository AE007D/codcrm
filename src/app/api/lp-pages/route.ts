import { NextRequest, NextResponse } from "next/server";
import { getPages, getPageBySlug, savePage, deletePage, LandingPage } from "@/lib/supabasePageStore";
import { getRequestUser } from "@/lib/getRequestUser";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");

  // Public slug lookup (no auth needed — for landing page visitors)
  if (slug) {
    const page = await getPageBySlug(slug);
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // If authed user is requesting, check ownership
    const user = await getRequestUser().catch(() => null);
    if (user && page.ownerId !== user.workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(page);
  }

  // List pages — auth required
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const pages = await getPages(user.workspaceId);
  return NextResponse.json({ pages });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  let body: Partial<LandingPage>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const slug = body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") || `page-${Date.now().toString().slice(-6)}`;

  // Conflict check
  const existing = await getPageBySlug(slug);
  if (existing && existing.ownerId !== user.workspaceId) {
    return NextResponse.json({ error: "Ce slug existe déjà." }, { status: 409 });
  }

  try {
    const page = await savePage({
      slug,
      ownerId: user.workspaceId,
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
    });
    return NextResponse.json({ ok: true, page });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  let body: Partial<LandingPage> & { id: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const pages = await getPages(user.workspaceId);
  const existing = pages.find(p => p.id === body.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const updated = await savePage({ ...existing, ...body, ownerId: user.workspaceId });
    return NextResponse.json({ ok: true, page: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await deletePage(id, user.workspaceId);
  return NextResponse.json({ ok: true });
}
