import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  // Try updating last_seen column directly — no race condition with product settings
  const { error } = await supabase
    .from("crm_users")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", user.id);

  // If column doesn't exist yet, fail silently (users show offline until migration runs)
  if (error) console.warn("[ping] last_seen update failed:", error.message);

  return NextResponse.json({ ok: true });
}
