import { NextRequest, NextResponse } from "next/server";

const GRAPH = "https://graph.facebook.com/v19.0";

export async function POST(request: NextRequest) {
  const { accessToken, adAccountId, datePreset = "last_30d" } = await request.json();
  if (!accessToken || !adAccountId) {
    return NextResponse.json({ error: "accessToken and adAccountId required" }, { status: 400 });
  }

  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const fields = [
    "id", "name", "status",
    "insights.date_preset(" + datePreset + "){spend,impressions,clicks,actions,purchase_roas,action_values}",
  ].join(",");

  const url = `${GRAPH}/${accountId}/campaigns?fields=${encodeURIComponent(fields)}&limit=50&access_token=${encodeURIComponent(accessToken)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    const campaigns = (data.data ?? []).map((c: Record<string, unknown>) => {
      const ins = (c.insights as { data?: Record<string, unknown>[] } | undefined)?.data?.[0] ?? {};
      const actions = (ins.actions as { action_type: string; value: string }[]) ?? [];
      const purchases = actions.find(a => a.action_type === "purchase")?.value ?? "0";
      const actionValues = (ins.action_values as { action_type: string; value: string }[]) ?? [];
      const revenue = actionValues.find(a => a.action_type === "purchase")?.value ?? "0";

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        spend: parseFloat(String(ins.spend ?? "0")),
        impressions: parseInt(String(ins.impressions ?? "0"), 10),
        clicks: parseInt(String(ins.clicks ?? "0"), 10),
        orders: parseInt(purchases, 10),
        revenue: parseFloat(revenue),
        platform: "Facebook",
      };
    });

    return NextResponse.json({ campaigns });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
