// Funnel leads (purchases + abandoned checkouts) persisted in Supabase
import { supabase } from "./supabase";

export type FunnelLead = {
  id: string;
  workspaceId: string;
  type: "purchase" | "abandoned";
  customer: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  product: string;
  amount: number;
  currency: string;
  funnel: string;
  funnelUrl: string;
  quantity: number;
  createdAt: string;
  receivedAt: string;
  callAttempts: number;
  recovered: boolean;
  notes: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToLead(row: any): FunnelLead {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type ?? "abandoned",
    customer: row.customer ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    city: row.city ?? "",
    address: row.address ?? "",
    product: row.product ?? "",
    amount: parseFloat(row.amount ?? "0"),
    currency: row.currency ?? "MAD",
    funnel: row.funnel ?? "",
    funnelUrl: row.funnel_url ?? "",
    quantity: row.quantity ?? 1,
    createdAt: row.created_at,
    receivedAt: row.received_at,
    callAttempts: row.call_attempts ?? 0,
    recovered: row.recovered ?? false,
    notes: row.notes ?? "",
  };
}

export async function getLeadsByWorkspace(workspaceId: string): Promise<FunnelLead[]> {
  const { data, error } = await supabase
    .from("crm_leads")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("received_at", { ascending: false });
  if (error) { console.error("getLeadsByWorkspace:", error.message); return []; }
  return (data ?? []).map(rowToLead);
}

export async function upsertLead(lead: FunnelLead): Promise<void> {
  const { error } = await supabase.from("crm_leads").upsert({
    id: lead.id,
    workspace_id: lead.workspaceId,
    type: lead.type,
    customer: lead.customer,
    phone: lead.phone,
    email: lead.email,
    city: lead.city,
    address: lead.address,
    product: lead.product,
    amount: lead.amount,
    currency: lead.currency,
    funnel: lead.funnel,
    funnel_url: lead.funnelUrl,
    quantity: lead.quantity,
    created_at: lead.createdAt,
    received_at: lead.receivedAt,
    call_attempts: lead.callAttempts,
    recovered: lead.recovered,
    notes: lead.notes,
  }, { onConflict: "id" });
  if (error) console.error("upsertLead:", error.message);
}

export async function updateLead(id: string, workspaceId: string, patch: Partial<Pick<FunnelLead, "callAttempts" | "recovered" | "notes">>): Promise<FunnelLead | null> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.callAttempts !== undefined) dbPatch.call_attempts = patch.callAttempts;
  if (patch.recovered !== undefined) dbPatch.recovered = patch.recovered;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;

  const { data, error } = await supabase
    .from("crm_leads")
    .update(dbPatch)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select()
    .maybeSingle();
  if (error) { console.error("updateLead:", error.message); return null; }
  return data ? rowToLead(data) : null;
}
