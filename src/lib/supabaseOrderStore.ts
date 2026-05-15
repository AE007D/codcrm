// Orders persisted in Supabase — survives Vercel restarts
import { supabase } from "./supabase";

export type CrmOrder = {
  id: string;
  workspaceId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  city: string;
  address: string;
  product: string;
  totalPrice: number;
  currency: string;
  quantity: number;
  funnel: string;
  source: string;
  status: string;
  notes: string;
  attempts: number;
  noAnswer: number;
  receivedAt: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToOrder(row: any): CrmOrder {
  return {
    id: String(row.id),
    workspaceId: row.workspace_id,
    orderNumber: row.order_number ?? "",
    customerName: row.customer_name ?? "",
    customerPhone: row.customer_phone ?? "",
    customerEmail: row.customer_email ?? "",
    city: row.city ?? "",
    address: row.address ?? "",
    product: row.product ?? "",
    totalPrice: parseFloat(row.total_price ?? "0"),
    currency: row.currency ?? "MAD",
    quantity: row.quantity ?? 1,
    funnel: row.funnel ?? "",
    source: row.source ?? "manuel",
    status: row.status ?? "nouveau",
    notes: row.notes ?? "",
    attempts: row.attempts ?? 0,
    noAnswer: row.no_answer ?? 0,
    receivedAt: row.received_at ?? new Date().toISOString(),
  };
}

export async function getOrdersByWorkspace(workspaceId: string): Promise<CrmOrder[]> {
  const { data, error } = await supabase
    .from("crm_orders")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("received_at", { ascending: false });
  if (error) { console.error("getOrdersByWorkspace:", error.message); return []; }
  return (data ?? []).map(rowToOrder);
}

export async function upsertOrder(order: Omit<CrmOrder, never>): Promise<CrmOrder | null> {
  const { data, error } = await supabase
    .from("crm_orders")
    .upsert({
      id: order.id,
      workspace_id: order.workspaceId,
      order_number: order.orderNumber,
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      customer_email: order.customerEmail,
      city: order.city,
      address: order.address,
      product: order.product,
      total_price: order.totalPrice,
      currency: order.currency,
      quantity: order.quantity,
      funnel: order.funnel,
      source: order.source,
      status: order.status,
      notes: order.notes,
      attempts: order.attempts,
      no_answer: order.noAnswer,
      received_at: order.receivedAt,
    }, { onConflict: "id", ignoreDuplicates: false })
    .select()
    .single();
  if (error) { console.error("upsertOrder:", error.message); return null; }
  return rowToOrder(data);
}

export async function updateOrderFields(
  id: string,
  workspaceId: string,
  patch: Partial<{ status: string; notes: string; attempts: number; noAnswer: number }>
): Promise<CrmOrder | null> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.attempts !== undefined) dbPatch.attempts = patch.attempts;
  if (patch.noAnswer !== undefined) dbPatch.no_answer = patch.noAnswer;

  const { data, error } = await supabase
    .from("crm_orders")
    .update(dbPatch)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select()
    .maybeSingle();
  if (error) { console.error("updateOrderFields:", error.message); return null; }
  return data ? rowToOrder(data) : null;
}

export async function deleteOrder(id: string, workspaceId: string): Promise<boolean> {
  const { error } = await supabase
    .from("crm_orders")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) { console.error("deleteOrder:", error.message); return false; }
  return true;
}
