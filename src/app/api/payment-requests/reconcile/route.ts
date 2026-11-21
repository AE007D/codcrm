import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { supabase } from "@/lib/supabase";
import { planCommissionReconciliation } from "@/lib/orderCommissions";
import type { OrderAssignments } from "@/lib/orderAssignment";

export const dynamic = "force-dynamic";

async function inspect(workspaceId: string) {
  const [settingsResult, orderResult, paymentResult, productResult, userResult] = await Promise.all([
    supabase.from("crm_settings").select("settings").eq("workspace_id", workspaceId).single(),
    supabase.from("crm_orders").select("id,order_number,product,status,received_at").eq("workspace_id", workspaceId).eq("status", "livré"),
    supabase.from("crm_payment_requests").select("id,message,amount,status,agent_id,agent_name,created_at").eq("workspace_id", workspaceId),
    supabase.from("crm_products").select("id,name").eq("owner_id", workspaceId),
    supabase.from("crm_users").select("id,name,active,role").eq("workspace_id", workspaceId),
  ]);
  if ([settingsResult, orderResult, paymentResult, productResult, userResult].some(result => result.error)) {
    throw new Error("Impossible de lire les commissions. Réessayez.");
  }
  // Supabase's default row limit must never silently produce a partial repair.
  if ([orderResult.data, paymentResult.data, productResult.data, userResult.data].some(rows => (rows?.length ?? 0) >= 1000)) {
    throw new Error("Trop de données pour cette correction. Une vérification complète est nécessaire.");
  }
  if (!settingsResult.data) throw new Error("Paramètres de l’équipe introuvables.");
  const settings = settingsResult.data.settings ?? {};
  const defaults: Record<string, { agentId: string; agentName: string }> = {};
  for (const product of productResult.data ?? []) {
    const commission = settings.productCommissions?.[product.id];
    if (commission?.agentId) {
      if (defaults[product.name.trim()]) throw new Error("Plusieurs produits portent le même nom. Vérifiez leurs affectations.");
      defaults[product.name.trim()] = commission;
    }
  }
  const orders = (orderResult.data ?? []).map(row => ({ id: row.id, orderNumber: row.order_number,
    product: row.product ?? "", status: row.status, receivedAt: row.received_at ?? "" }));
  const requests = paymentResult.data ?? [];
  const plan = planCommissionReconciliation(workspaceId, orders, requests,
    (settings.orderAssignments ?? {}) as OrderAssignments, settings.orderCommissionRequests ?? {}, defaults);
  for (const update of plan.updates) {
    const member = userResult.data?.find(row => row.id === update.agentId && row.active && row.role !== "viewer");
    if (!member) throw new Error("Un agent affecté est introuvable ou inactif.");
    update.agentName = member.name;
  }
  const fingerprint = createHash("sha256").update(JSON.stringify({ workspaceId, settings, plan })).digest("hex");
  return { plan, requests, fingerprint };
}

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]!);

function document(body: string, status = 200) {
  return new NextResponse(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Correction des commissions · COD CRM</title><style>body{font:16px system-ui;background:#f4f6fa;color:#172033;margin:0;padding:24px}main{max-width:900px;margin:32px auto;background:white;padding:28px;border-radius:18px}h1{font-size:25px}table{border-collapse:collapse;width:100%;margin:24px 0}th,td{text-align:left;padding:10px;border-bottom:1px solid #e5e7eb}button,a{display:inline-block;padding:12px 18px;border-radius:9px}button{background:#2459c4;color:white;border:0;font:inherit;cursor:pointer}p{line-height:1.6}.notice{padding:14px;background:#eef4ff;border-radius:10px}.scroll{overflow-x:auto}</style><main>${body}</main></html>`, {
    status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" },
  });
}

export async function GET() {
  const user = await getRequestUser();
  if (!user || user.role !== "admin") return document("<h1>Connexion administrateur requise</h1><a href='/login'>Se connecter</a>", 403);
  try {
    const { plan, requests, fingerprint } = await inspect(user.workspaceId);
    const totals = new Map<string, { name: string; before: number; after: number; amount: number }>();
    for (const request of requests.filter(row => row.status === "pending")) {
      const update = plan.updates.find(row => row.requestId === request.id);
      if (!totals.has(request.agent_id)) totals.set(request.agent_id, { name: request.agent_name, before: 0, after: 0, amount: 0 });
      totals.get(request.agent_id)!.before++;
      const agentId = update?.agentId ?? request.agent_id;
      if (!totals.has(agentId)) totals.set(agentId, { name: update?.agentName ?? request.agent_name, before: 0, after: 0, amount: 0 });
      const total = totals.get(agentId)!;
      total.after++; total.amount += Number(request.amount);
    }
    return document(`<h1>Correction des commissions</h1><p>Les affectations individuelles des commandes sont prioritaires. Les autres commandes utilisent l’agent du produit.</p><div class="notice">${plan.updates.length} commission(s) à réaffecter. Les montants et les paiements déjà effectués sont conservés.</div><div class="scroll"><table><tr><th>Agent</th><th>Avant</th><th>Après</th><th>Solde après</th></tr>${Array.from(totals.values()).map(row => `<tr><td>${escape(row.name)}</td><td>${row.before}</td><td>${row.after}</td><td>${row.amount} MAD</td></tr>`).join("")}</table><table><tr><th>Commande</th><th>Agent actuel</th><th>Agent correct</th><th>Montant</th></tr>${plan.updates.map(row => `<tr><td>${escape(row.orderNumber)}</td><td>${escape(row.previousAgentName)}</td><td>${escape(row.agentName)}</td><td>${row.amount} MAD</td></tr>`).join("")}</table></div>${plan.unresolved.length ? `<p>${plan.unresolved.length} commande(s) nécessitent une vérification manuelle : ${plan.unresolved.map(escape).join(", ")}.</p>` : ""}${plan.updates.length ? `<form method="post"><input type="hidden" name="fingerprint" value="${fingerprint}"><button type="submit">Corriger les ${plan.updates.length} commissions</button></form>` : "<p>Aucune correction nécessaire pour les commissions reliées aux commandes.</p>"}<a href="/paiements">Retour aux paiements</a>`);
  } catch (error) { return document(`<h1>Correction indisponible</h1><p>${escape(error instanceof Error ? error.message : "Erreur de lecture")}</p>`, 503); }
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!user || user.role !== "admin") return document("<h1>Administrateur requis</h1>", 403);
  if (request.headers.get("origin") !== new URL(request.url).origin) return document("<h1>Origine invalide</h1>", 403);
  try {
    const form = await request.formData();
    const { plan, fingerprint } = await inspect(user.workspaceId);
    if (form.get("fingerprint") !== fingerprint) return document("<h1>Les données ont changé</h1><a href='/api/payment-requests/reconcile'>Vérifier à nouveau</a>", 409);
    let moved = 0;
    for (const update of plan.updates) {
      const result = await supabase.from("crm_payment_requests")
        .update({ agent_id: update.agentId, agent_name: update.agentName })
        .eq("workspace_id", user.workspaceId).eq("id", update.requestId).eq("status", "pending")
        .eq("agent_id", update.previousAgentId).eq("amount", update.amount).select("id");
      if (result.error || result.data?.length !== 1) return document(`<h1>Correction interrompue</h1><p>${moved} commission(s) corrigée(s). Une commission a changé ou n’a pas pu être enregistrée.</p><a href='/api/payment-requests/reconcile'>Vérifier les commissions restantes</a>`, 409);
      moved++;
    }
    const verified = await inspect(user.workspaceId);
    return document(`<h1>${verified.plan.updates.length ? "Vérification nécessaire" : "Commissions corrigées"}</h1><p>${moved} commission(s) réaffectée(s). Les montants sont conservés.</p><p>${verified.plan.updates.length} correction(s) restante(s) · ${verified.plan.unresolved.length} commande(s) à vérifier manuellement.</p><a href='/paiements'>Voir les paiements</a><a href='/api/payment-requests/reconcile'>Vérifier à nouveau</a>`);
  } catch (error) { return document(`<h1>Correction interrompue</h1><p>${escape(error instanceof Error ? error.message : "Erreur d’enregistrement")}</p><a href='/api/payment-requests/reconcile'>Vérifier à nouveau</a>`, 503); }
}
