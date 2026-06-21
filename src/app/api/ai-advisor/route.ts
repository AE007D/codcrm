import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getRequestUser } from "@/lib/getRequestUser";
import { getOrdersByWorkspace } from "@/lib/supabaseOrderStore";
import { getSettings } from "@/lib/supabaseSettingsStore";
import { getProducts } from "@/lib/supabaseProductStore";
import { getAiMemory, saveAiMemory, type AiMemory } from "@/lib/supabaseAiMemoryStore";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  let body: { message: string; lang?: string; history?: { role: "user" | "assistant"; content: string }[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { message, history = [], lang = "fr" } = body;
  if (!message?.trim()) return NextResponse.json({ error: "Message vide." }, { status: 400 });

  // Gather workspace data + persistent memory in parallel
  const [settings, ordersData, productsData, memory] = await Promise.all([
    getSettings(user.workspaceId).catch(() => null),
    getOrdersByWorkspace(user.workspaceId).catch(() => [] as Awaited<ReturnType<typeof getOrdersByWorkspace>>),
    getProducts(user.workspaceId).catch(() => [] as Awaited<ReturnType<typeof getProducts>>),
    getAiMemory(user.workspaceId).catch(() => ({} as AiMemory)),
  ]);

  const orders = Array.isArray(ordersData) ? ordersData : [];
  const products = Array.isArray(productsData) ? productsData : [];
  const campaigns: Record<string, unknown>[] = Array.isArray(settings?.adCampaigns) ? settings.adCampaigns as Record<string, unknown>[] : [];
  const paymentRequests: Record<string, unknown>[] = Array.isArray(settings?.paymentRequests) ? settings.paymentRequests as Record<string, unknown>[] : [];

  // Compute business metrics
  const totalOrders = orders.length;
  const deliveredOrders = orders.filter((o) => {
    const s = String((o as Record<string, unknown>).status ?? "").toLowerCase();
    return s.includes("livr") || s.includes("deliver") || s.includes("remis");
  });
  const totalRevenue = orders.reduce((sum, o) => sum + (Number((o as Record<string, unknown>).amount) || 0), 0);
  const deliveredRevenue = deliveredOrders.reduce((sum, o) => sum + (Number((o as Record<string, unknown>).amount) || 0), 0);
  const deliveryRate = totalOrders > 0 ? ((deliveredOrders.length / totalOrders) * 100).toFixed(1) : "0";

  const totalAdSpend = campaigns.reduce((sum, c) => sum + (Number(c.spend) || 0), 0);
  const totalAdOrders = campaigns.reduce((sum, c) => sum + (Number(c.orders) || 0), 0);
  const totalAdRevenue = campaigns.reduce((sum, c) => sum + (Number(c.revenue) || 0), 0);
  const roas = totalAdSpend > 0 ? (totalAdRevenue / totalAdSpend).toFixed(2) : "N/A";
  const cpo = totalAdOrders > 0 ? (totalAdSpend / totalAdOrders).toFixed(0) : "N/A";

  const productSummary = products.slice(0, 20).map((p) => {
    const pr = p as Record<string, unknown>;
    return `- ${pr.name} (SKU: ${pr.sku}, Prix vente: ${pr.sellPrice} MAD, Prix achat: ${pr.purchasePrice ?? "?"} MAD, Stock: ${pr.stock ?? "?"})`;
  }).join("\n");

  const campaignSummary = campaigns.slice(0, 15).map((c) => {
    const roas_ = Number(c.spend) > 0 ? (Number(c.revenue) / Number(c.spend)).toFixed(2) : "?";
    return `- [${c.platform}] ${c.name}: Dépense ${c.spend} MAD, Commandes ${c.orders}, Livré ${c.delivered}, CA ${c.revenue} MAD, ROAS ${roas_}`;
  }).join("\n");

  const pendingPayments = paymentRequests.filter((p) => p.status === "pending").reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Build memory section
  const memorySection = (memory.goals || memory.context || memory.decisions || memory.struggles)
    ? `=== MÉMOIRE DE CE GÉRANT ===
${memory.goals ? `Objectifs déclarés: ${memory.goals}` : ""}
${memory.context ? `Contexte business: ${memory.context}` : ""}
${memory.decisions ? `Décisions/stratégies passées: ${memory.decisions}` : ""}
${memory.struggles ? `Problèmes récurrents: ${memory.struggles}` : ""}
(Dernière mise à jour: ${memory.updatedAt ? new Date(memory.updatedAt).toLocaleDateString("fr-FR") : "jamais"})

`
    : "";

  const systemPrompt = `Tu es un conseiller business expert en e-commerce COD (Cash On Delivery) au Maroc. Tu analyses les données réelles de la boutique et fournis des recommandations concrètes, actionnables et chiffrées. Tu te souviens de chaque conversation passée avec ce gérant et tu t'en sers pour personnaliser tes conseils.

${memorySection}=== DONNÉES BUSINESS EN TEMPS RÉEL ===

📦 COMMANDES GLOBALES:
- Total commandes: ${totalOrders}
- Commandes livrées: ${deliveredOrders.length} (${deliveryRate}% taux de livraison)
- CA total: ${totalRevenue.toLocaleString()} MAD
- CA livré (encaissé): ${deliveredRevenue.toLocaleString()} MAD

📢 PUBLICITÉ (${campaigns.length} campagnes):
- Budget total dépensé: ${totalAdSpend.toLocaleString()} MAD
- Commandes générées: ${totalAdOrders}
- CA généré: ${totalAdRevenue.toLocaleString()} MAD
- ROAS global: ${roas}x
- Coût par commande (CPO): ${cpo} MAD

${campaignSummary ? `Détail campagnes:\n${campaignSummary}` : "Aucune campagne enregistrée."}

🛍️ PRODUITS (${products.length} produits):
${productSummary || "Aucun produit enregistré."}

💰 FINANCES:
- Paiements en attente: ${pendingPayments.toLocaleString()} MAD

=== TON RÔLE ===
Analyse ces données et réponds aux questions du gérant. Sois direct, précis et oriente tes conseils vers:
- Optimisation du ROAS et du budget publicitaire
- Amélioration du taux de livraison
- Calcul de profitabilité par produit/campagne
- Identification des meilleures opportunités d'investissement
- Objectifs financiers et comment les atteindre

LANGUE DE RÉPONSE: Détecte automatiquement la langue du message de l'utilisateur et réponds TOUJOURS dans cette même langue:
- Si le message est en darija marocaine (mots comme: salam, wach, kayn, mzyan, kifash, chhal, bzaf, 3ndek, daba, bghit, khssk, walo, mashi, hadi, etc.) → réponds en darija marocaine écrite en lettres latines. Style: "wach kayn shi commande lyoum? ROAS dyalek mzyan bzaf!"
- Si le message est en arabe classique (فصحى) → réponds en arabe classique
- Si le message est en anglais → réponds en anglais
- Si le message est en français → réponds en français
- En cas de doute, utilise le français
Utilise les chiffres concrets basés sur les données ci-dessus. Si le gérant mentionne des objectifs, des problèmes récurrents ou des décisions importantes, retiens-les — ils seront sauvegardés dans ta mémoire.`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content } as Anthropic.MessageParam)),
    { role: "user", content: message },
  ];

  // Stream the response while collecting the full text
  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 2048,
          system: systemPrompt,
          messages,
          thinking: { type: "adaptive" },
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullResponse += event.delta.text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur IA";
        console.error("[ai-advisor] stream error:", msg);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.close();
        // After streaming, asynchronously update the AI memory
        updateMemoryAsync(user.workspaceId, message, fullResponse, memory, history);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function updateMemoryAsync(
  workspaceId: string,
  userMessage: string,
  assistantReply: string,
  currentMemory: AiMemory,
  history: { role: string; content: string }[]
) {
  try {
    // Only update memory every 3 turns or when user explicitly states goals/problems
    const shouldUpdate = history.length % 3 === 0 || /objectif|problème|cible|but|veux atteindre|j'ai besoin|difficile|toujours|stratégie/i.test(userMessage);
    if (!shouldUpdate) return;

    const memoryPrompt = `Tu analyses une conversation entre un gérant e-commerce COD et son conseiller IA. Extrais les informations importantes pour la mémoire persistante.

MÉMOIRE ACTUELLE:
${JSON.stringify(currentMemory, null, 2)}

DERNIER ÉCHANGE:
Gérant: ${userMessage}
Conseiller: ${assistantReply.slice(0, 500)}

Réponds UNIQUEMENT avec un JSON valide contenant ces 4 clés (string ou null):
{
  "goals": "objectifs chiffrés déclarés par le gérant (ex: 50k MAD/mois, ROAS 3x) — null si rien de nouveau",
  "context": "faits clés sur son business (produits phares, marchés, équipe) — null si rien de nouveau",
  "decisions": "stratégies ou décisions importantes prises — null si rien de nouveau",
  "struggles": "problèmes récurrents ou points de douleur mentionnés — null si rien de nouveau"
}
Si une clé n'a pas de nouvelle info, garde la valeur actuelle ou mets null. Ne réponds qu'avec le JSON.`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: memoryPrompt }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const extracted = JSON.parse(jsonMatch[0]) as Partial<AiMemory>;
    const updated: AiMemory = {
      goals: extracted.goals ?? currentMemory.goals,
      context: extracted.context ?? currentMemory.context,
      decisions: extracted.decisions ?? currentMemory.decisions,
      struggles: extracted.struggles ?? currentMemory.struggles,
    };

    // Only save if something actually changed
    const changed = (["goals", "context", "decisions", "struggles"] as (keyof AiMemory)[])
      .some((k) => updated[k] && updated[k] !== currentMemory[k]);

    if (changed) await saveAiMemory(workspaceId, updated);
  } catch {
    // Memory update is non-critical, silently ignore errors
  }
}
