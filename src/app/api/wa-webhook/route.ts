import { NextRequest, NextResponse } from "next/server";
import { updateOrderFields } from "@/lib/supabaseOrderStore";
import { supabase } from "@/lib/supabase";

// OpenWA calls this endpoint when a client sends a message
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // OpenWA webhook payload: { event, session, data: { from, body, ... } }
    const event = body.event ?? body.type;
    if (event !== "message.received" && event !== "message") return NextResponse.json({ ok: true });

    const data = body.data ?? body;
    const from: string = data.from ?? data.chatId ?? "";
    const text: string = (data.body ?? data.text ?? "").trim();

    if (!from || !text) return NextResponse.json({ ok: true });

    // Normalize phone: remove @c.us suffix, normalize to 212XXXXXXXX
    const norm = from.replace("@c.us", "").replace("@s.whatsapp.net", "")
      .replace(/^00/, "").replace(/^0/, "212");

    // Check pending confirmations
    const g = globalThis as Record<string, unknown>;
    const pending = g.__waPending as Record<string, { orderId: string; crmUrl: string; apiToken: string }> | undefined;
    if (!pending?.[norm]) return NextResponse.json({ ok: true });

    const { orderId } = pending[norm];

    const isConfirm = /^(1|👍|نعم|yes|oui|confirm|تأكيد|ok|موافق)$/i.test(text);
    const isCancel  = /^(2|👎|لا|no|non|annul|إلغاء|cancel)$/i.test(text);

    if (!isConfirm && !isCancel) return NextResponse.json({ ok: true });

    delete pending[norm];

    const newStatus = isConfirm ? "confirmé" : "annulé";

    // Find workspace and update order
    const { data: row } = await supabase
      .from("orders")
      .select("workspace_id")
      .eq("id", orderId)
      .single();

    if (row) {
      await updateOrderFields(orderId, row.workspace_id, { status: newStatus });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[wa-webhook]", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
