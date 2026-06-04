import { NextRequest, NextResponse } from "next/server";
import { updateOrderFields } from "@/lib/supabaseOrderStore";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-wa-token") ?? req.nextUrl.searchParams.get("token");
  if (token !== process.env.WA_INTERNAL_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

  const { data: row } = await supabase
    .from("crm_orders")
    .select("workspace_id, status")
    .eq("id", id)
    .single();

  if (!row) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // If already shipped, block cancellation and return shipped flag
  if (row.status === "expédié" && status === "annulé") {
    return NextResponse.json({ ok: true, shipped: true });
  }

  const updated = await updateOrderFields(id, row.workspace_id, { status });
  if (!updated) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
