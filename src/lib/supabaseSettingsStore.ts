// Per-workspace settings (API credentials) persisted in Supabase
import { supabase } from "./supabase";

export type UserSettings = {
  eagle?: { tk: string; sk: string };
  shopify?: { store: string; apiKey: string };
  facebook?: { accessToken: string };
  tiktok?: { accessToken: string };
  productPixels?: Record<string, string>;
  pagePixels?: Record<string, string>;
  productCommissions?: Record<string, { boutiqueNom: string; agentId: string; agentName: string; commissionAmount: number }>;
  boutiques?: string[];
  storeName?: string;
  shippingCompanies?: string[];
  [key: string]: unknown;
};

export async function getSettings(workspaceId: string): Promise<UserSettings> {
  const { data, error } = await supabase
    .from("crm_settings")
    .select("settings")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) { console.error("getSettings:", error.message); return {}; }
  return (data?.settings as UserSettings) ?? {};
}

export async function saveSettings(workspaceId: string, patch: Partial<UserSettings>): Promise<UserSettings> {
  // Get current settings first
  const current = await getSettings(workspaceId);
  const next = { ...current, ...patch };

  const { error } = await supabase
    .from("crm_settings")
    .upsert({ workspace_id: workspaceId, settings: next }, { onConflict: "workspace_id" });

  if (error) { console.error("saveSettings:", error.message); }
  return next;
}
