import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUsers } from "@/lib/authStore";
import { getOrdersByWorkspace } from "@/lib/supabaseOrderStore";
import { getSettings } from "@/lib/supabaseSettingsStore";
import { getProducts } from "@/lib/supabaseProductStore";
import { getAiMemory } from "@/lib/supabaseAiMemoryStore";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const INTERNAL_TOKEN = process.env.WA_INTERNAL_TOKEN ?? "codcrm-wa-secret-2024";

export async function POST(request: NextRequest) {
  // Secured by internal token — only called by cron script
  const auth = request.headers.get("x-internal-token");
  if (auth !== INTERNAL_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await getUsers();
  // One admin per workspace (avoid duplicate reports for same workspace)
  const workspacesSeen = new Set<string>();
  const admins = users.filter((u) => {
    if (u.role !== "admin" || workspacesSeen.has(u.workspaceId)) return false;
    workspacesSeen.add(u.workspaceId);
    return true;
  });

  const results: { workspace: string; ok: boolean; error?: string }[] = [];

  for (const admin of admins) {
    try {
      await analyzeAndSend(admin.workspaceId);
      results.push({ workspace: admin.workspaceId, ok: true });
    } catch (e) {
      results.push({ workspace: admin.workspaceId, ok: false, error: String(e) });
    }
  }

  return NextResponse.json({ results });
}

async function analyzeAndSend(workspaceId: string) {
  const [settings, ordersData, productsData, memory] = await Promise.all([
    getSettings(workspaceId).catch(() => null),
    getOrdersByWorkspace(workspaceId).catch(() => []),
    getProducts(workspaceId).catch(() => []),
    getAiMemory(workspaceId).catch(() => ({})),
  ]);

  const tg = (settings as Record<string, unknown>)?.telegram as { botToken?: string; chatId?: string } | undefined;
  if (!tg?.botToken || !tg?.chatId) return; // No Telegram configured, skip

  const orders = Array.isArray(ordersData) ? ordersData : [];
  const campaigns: Record<string, unknown>[] = Array.isArray(settings?.adCampaigns) ? settings.adCampaigns as Record<string, unknown>[] : [];

  // Today's stats
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => {
    const d = String((o as Record<string, unknown>).createdAt ?? (o as Record<string, unknown>).created_at ?? "");
    return d.startsWith(today);
  });
  const todayRevenue = todayOrders.reduce((s, o) => s + (Number((o as Record<string, unknown>).amount) || 0), 0);
  const todayDelivered = todayOrders.filter((o) => {
    const s = String((o as Record<string, unknown>).status ?? "").toLowerCase();
    return s.includes("livr") || s.includes("deliver");
  }).length;

  // Total stats
  const totalOrders = orders.length;
  const deliveredOrders = orders.filter((o) => {
    const s = String((o as Record<string, unknown>).status ?? "").toLowerCase();
    return s.includes("livr") || s.includes("deliver");
  });
  const deliveryRate = totalOrders > 0 ? ((deliveredOrders.length / totalOrders) * 100).toFixed(1) : "0";

  const totalAdSpend = campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0);
  const totalAdRevenue = campaigns.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
  const roas = totalAdSpend > 0 ? (totalAdRevenue / totalAdSpend).toFixed(2) : "N/A";
  const cpo = campaigns.reduce((s, c) => s + (Number(c.orders) || 0), 0);
  const cpoVal = cpo > 0 ? (totalAdSpend / cpo).toFixed(0) : "N/A";

  const campaignSummary = campaigns.slice(0, 10).map((c) => {
    const r = Number(c.spend) > 0 ? (Number(c.revenue) / Number(c.spend)).toFixed(2) : "?";
    return `- [${c.platform}] ${c.name}: ${c.spend} MAD dépensé, ROAS ${r}`;
  }).join("\n");

  const storeName = String(settings?.storeName ?? "votre boutique");
  const goals = memory.goals ? `\nObjectifs déclarés: ${memory.goals}` : "";

  const analysisPrompt = `Tu es un conseiller COD expert au Maroc. Génère un rapport journalier CONCIS pour ${storeName}.

DONNÉES DU JOUR (${today}):
- Commandes aujourd'hui: ${todayOrders.length}
- CA aujourd'hui: ${todayRevenue.toLocaleString()} MAD
- Livrées aujourd'hui: ${todayDelivered}

STATS GLOBALES:
- Total commandes: ${totalOrders}
- Taux livraison: ${deliveryRate}%
- Budget pub total: ${totalAdSpend.toLocaleString()} MAD
- ROAS global: ${roas}x
- CPO: ${cpoVal} MAD
${goals}

CAMPAGNES:
${campaignSummary || "Aucune campagne"}

PRODUITS: ${productsData.length} produits au catalogue

Génère un rapport Telegram en français avec:
1. 📊 Résumé du jour (2-3 lignes max)
2. ✅ Ce qui marche bien
3. ⚠️ Ce qu'il faut corriger
4. 💡 1 action concrète à faire maintenant

Sois très court et direct. Utilise des emojis. Format Telegram (HTML simple).`;

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 600,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: analysisPrompt }],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  if (!text) return;

  const dateStr = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const fullMessage = `🤖 <b>Rapport IA — ${dateStr}</b>\n\n${text}`;

  await fetch(`https://api.telegram.org/bot${tg.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: tg.chatId, text: fullMessage, parse_mode: "HTML" }),
  });
}
