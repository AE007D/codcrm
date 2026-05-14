import { NextRequest, NextResponse } from "next/server";

const BASE = "https://business-api.tiktok.com/open_api/v1.3";

export async function POST(request: NextRequest) {
  const { accessToken, advertiserId } = await request.json();
  if (!accessToken || !advertiserId) {
    return NextResponse.json({ error: "accessToken and advertiserId required" }, { status: 400 });
  }

  const now = new Date();
  const endDate = now.toISOString().split("T")[0];
  now.setDate(now.getDate() - 30);
  const startDate = now.toISOString().split("T")[0];

  try {
    /* 1 — fetch campaign list */
    const listRes = await fetch(`${BASE}/campaign/get/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": accessToken },
      body: JSON.stringify({ advertiser_id: advertiserId, page_size: 50, fields: ["campaign_id", "campaign_name", "status"] }),
    });
    const listData = await listRes.json();

    if (listData.code !== 0) {
      return NextResponse.json({ error: listData.message ?? "TikTok API error" }, { status: 400 });
    }

    const campaignList: { campaign_id: string; campaign_name: string }[] = listData.data?.list ?? [];

    /* 2 — fetch insights for those campaigns */
    const insightRes = await fetch(`${BASE}/report/integrated/get/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": accessToken },
      body: JSON.stringify({
        advertiser_id: advertiserId,
        report_type: "BASIC",
        dimensions: ["campaign_id"],
        metrics: ["spend", "impressions", "clicks", "purchase", "total_purchase_value"],
        start_date: startDate,
        end_date: endDate,
        page_size: 50,
      }),
    });
    const insightData = await insightRes.json();
    const insightRows: Record<string, Record<string, string>>[] = insightData.data?.list ?? [];

    const insightMap: Record<string, Record<string, string>> = {};
    for (const row of insightRows) {
      insightMap[row.dimensions?.campaign_id] = row.metrics ?? {};
    }

    const campaigns = campaignList.map(c => {
      const m = insightMap[c.campaign_id] ?? {};
      return {
        id: c.campaign_id,
        name: c.campaign_name,
        spend: parseFloat(m.spend ?? "0"),
        impressions: parseInt(m.impressions ?? "0", 10),
        clicks: parseInt(m.clicks ?? "0", 10),
        orders: parseInt(m.purchase ?? "0", 10),
        revenue: parseFloat(m.total_purchase_value ?? "0"),
        platform: "TikTok",
      };
    });

    return NextResponse.json({ campaigns });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
