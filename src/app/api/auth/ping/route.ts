import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { supabase } from "@/lib/supabase";

export async function POST() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  await supabase
    .from("crm_users")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
