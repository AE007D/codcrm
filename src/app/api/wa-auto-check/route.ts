import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const WA_TOKEN = process.env.WA_INTERNAL_TOKEN ?? "";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-wa-token");
  if (token !== WA_TOKEN) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all workspaces with auto-confirm enabled
  const { data: allSettings } = await supabase
    .from("crm_settings")
    .select("workspace_id, settings");

  if (!allSettings?.length) return NextResponse.json({ orders: [] });

  const result: {
    workspaceId: string;
    lang: string;
    templates: Record<string, Record<string, string>>;
    orders: {
      id: string; phone: string; customer: string; product: string;
      amount: number; currency: string; city: string;
    }[];
  }[] = [];

  for (const row of allSettings) {
    const wa = row.settings?.whatsapp ?? {};
    if (!wa.autoConfirmEnabled) continue;

    const delayMinutes = Number(wa.autoConfirmDelayMinutes ?? 30);
    const cutoff = new Date(Date.now() - delayMinutes * 60 * 1000).toISOString();

    const { data: orders } = await supabase
      .from("crm_orders")
      .select("id, customer_phone, customer_name, product, total_price, currency, city, received_at")
      .eq("workspace_id", row.workspace_id)
      .eq("status", "nouveau")
      .lt("received_at", cutoff)
      .not("customer_phone", "is", null)
      .limit(20);

    if (!orders?.length) continue;

    result.push({
      workspaceId: row.workspace_id,
      lang: wa.defaultLang ?? "ar",
      templates: wa.templates ?? {},
      orders: orders.map(o => ({
        id: o.id,
        phone: o.customer_phone ?? "",
        customer: o.customer_name ?? "",
        product: o.product ?? "",
        amount: o.total_price ?? 0,
        currency: o.currency ?? "MAD",
        city: o.city ?? "",
      })),
    });
  }

  return NextResponse.json({ workspaces: result });
}
