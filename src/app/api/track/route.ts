import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// POST /api/track — called by public product pages to register a live visitor
export async function POST(request: NextRequest) {
  let body: {
    visitorId?: string;
    page?: string;
    pageTitle?: string;
    productId?: string;
    workspaceId?: string;
    referrer?: string;
    device?: string;
  };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false }); }

  const { visitorId, page, pageTitle, productId, workspaceId, referrer, device } = body;
  if (!visitorId || !page) return NextResponse.json({ ok: false });

  // Resolve workspaceId from product if not passed directly
  let wsId = workspaceId ?? "";
  if (!wsId && productId) {
    const { data } = await supabase
      .from("crm_products")
      .select("owner_id")
      .eq("id", productId)
      .maybeSingle();
    wsId = data?.owner_id ?? "";
  }
  if (!wsId) return NextResponse.json({ ok: false });

  // Upsert visitor — unique on (workspace_id, visitor_id, page)
  const { error } = await supabase.from("crm_visitors").upsert(
    {
      workspace_id: wsId,
      visitor_id: visitorId,
      page,
      page_title: pageTitle ?? null,
      product_id: productId ?? null,
      referrer: referrer ?? null,
      device: device ?? "desktop",
      last_seen: new Date().toISOString(),
    },
    { onConflict: "workspace_id,visitor_id,page" }
  );

  // Table doesn't exist yet → tell client to setup
  if (error?.code === "42P01") {
    return NextResponse.json({ ok: false, setup: true });
  }

  return NextResponse.json({ ok: !error });
}

// GET /api/track?workspaceId=xxx — check if tracking table exists (used by setup check)
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ exists: false });

  const { error } = await supabase
    .from("crm_visitors")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1);

  return NextResponse.json({ exists: error?.code !== "42P01" });
}
