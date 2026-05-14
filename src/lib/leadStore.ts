// In-memory store for funnel leads (purchases + abandoned checkouts)
// Persists across HMR via globalThis

export type LeadType = "purchase" | "abandoned";

export type FunnelLead = {
  id: string;
  type: LeadType;
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
  created_at: string;
  received_at: string;
  /* recovery tracking */
  callAttempts: number;
  recovered: boolean;   // abandoned lead later called and converted
  notes: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __lfLeads: FunnelLead[] | undefined;
}

export function getLeads(): FunnelLead[] {
  if (!globalThis.__lfLeads) globalThis.__lfLeads = [];
  return globalThis.__lfLeads;
}

export function addLead(lead: FunnelLead) {
  if (!globalThis.__lfLeads) globalThis.__lfLeads = [];
  const idx = globalThis.__lfLeads.findIndex(l => l.id === lead.id);
  if (idx >= 0) {
    globalThis.__lfLeads[idx] = lead;
  } else {
    globalThis.__lfLeads.unshift(lead);
  }
}

export function updateLead(id: string, patch: Partial<FunnelLead>) {
  if (!globalThis.__lfLeads) return;
  const idx = globalThis.__lfLeads.findIndex(l => l.id === id);
  if (idx >= 0) globalThis.__lfLeads[idx] = { ...globalThis.__lfLeads[idx], ...patch };
}
