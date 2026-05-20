import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { getSettings } from "@/lib/supabaseSettingsStore";

const GRAPH = "https://graph.facebook.com/v19.0";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const settings = await getSettings(user.workspaceId);
  const fb = settings.facebook as { accessToken?: string; adAccountId?: string } | undefined;

  if (!fb?.accessToken || !fb?.adAccountId) {
    return NextResponse.json({ error: "Facebook Ads non configuré." }, { status: 400 });
  }

  const accountId = fb.adAccountId.startsWith("act_") ? fb.adAccountId : `act_${fb.adAccountId}`;
  const url = `${GRAPH}/${accountId}/adspixels?fields=id,name&access_token=${encodeURIComponent(fb.accessToken)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });

    const pixels = (data.data ?? []).map((p: { id: string; name: string }) => ({
      id: p.id,
      name: p.name,
    }));

    return NextResponse.json({ pixels });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
