// Per-user settings (API credentials) stored in memory per user
// Persists across HMR via globalThis

export type UserSettings = {
  ameex?: { apiId: string; apiKey: string };
  eagle?: { tk: string; sk: string };
  shopify?: { store: string; apiKey: string };
  facebook?: { accessToken: string };
  tiktok?: { accessToken: string };
};

declare global {
  // eslint-disable-next-line no-var
  var __crmSettings: Map<string, UserSettings> | undefined;
}

function getMap(): Map<string, UserSettings> {
  if (!globalThis.__crmSettings) globalThis.__crmSettings = new Map();
  return globalThis.__crmSettings;
}

export function getSettings(userId: string): UserSettings {
  return getMap().get(userId) ?? {};
}

export function saveSettings(userId: string, patch: Partial<UserSettings>): UserSettings {
  const current = getSettings(userId);
  const next = { ...current, ...patch };
  getMap().set(userId, next);
  return next;
}
