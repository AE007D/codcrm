import { getSettings, saveSettings } from "./supabaseSettingsStore";

export type AiMemory = {
  goals?: string;       // user's stated business targets
  context?: string;     // key facts about their business
  decisions?: string;   // past decisions / strategies discussed
  struggles?: string;   // recurring problems or pain points
  updatedAt?: string;
};

export async function getAiMemory(workspaceId: string): Promise<AiMemory> {
  const settings = await getSettings(workspaceId);
  return (settings.aiMemory as AiMemory) ?? {};
}

export async function saveAiMemory(workspaceId: string, memory: AiMemory): Promise<void> {
  await saveSettings(workspaceId, {
    aiMemory: { ...memory, updatedAt: new Date().toISOString() },
  });
}
