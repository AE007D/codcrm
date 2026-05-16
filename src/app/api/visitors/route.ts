import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // last 5 min

  const { data, error } = await supabase
    .from("crm_visitors")
    .select("*")
    .eq("workspace_id", user.workspaceId)
    .gte("last_seen", since)
    .order("last_seen", { ascending: false });

  if (error?.code === "42P01") {
    // Table doesn't exist yet
    return NextResponse.json({ visitors: [], tableExists: false });
  }
  if (error) {
    return NextResponse.json({ visitors: [], tableExists: true, error: error.message });
  }

  // Clean up visitors older than 2 hours (fire and forget)
  const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  void supabase.from("crm_visitors").delete().lt("last_seen", old).eq("workspace_id", user.workspaceId);

  return NextResponse.json({ visitors: data ?? [], tableExists: true });
}
