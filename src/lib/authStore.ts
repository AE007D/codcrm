// Auth store — users persisted in Supabase, sessions in-memory
import crypto from "crypto";
import { supabase } from "./supabase";

export type UserRole = "admin" | "agent" | "viewer";

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
  active: boolean;
  avatar?: string; // URL or base64 data URL
};

export type Session = {
  token: string;
  userId: string;
  createdAt: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __crmSessions: Session[] | undefined;
}

const SALT = "CODCRM_SALT_";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(SALT + password).digest("hex");
}

// ── User helpers (async, Supabase-backed) ──────────────────────────────────

export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from("crm_users")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) { console.error("getUsers:", error.message); return []; }
  return (data ?? []).map(rowToUser);
}

export async function getUserById(id: string): Promise<User | undefined> {
  const { data, error } = await supabase
    .from("crm_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error("getUserById:", error.message); return undefined; }
  return data ? rowToUser(data) : undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const { data, error } = await supabase
    .from("crm_users")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  if (error) { console.error("getUserByEmail:", error.message); return undefined; }
  return data ? rowToUser(data) : undefined;
}

export async function getUserCount(): Promise<number> {
  const { count, error } = await supabase
    .from("crm_users")
    .select("id", { count: "exact", head: true });
  if (error) { console.error("getUserCount:", error.message); return 0; }
  return count ?? 0;
}

export async function createUser(
  user: Omit<User, "id" | "createdAt" | "role"> & { role?: UserRole }
): Promise<User> {
  const count = await getUserCount();
  const role: UserRole = count === 0 ? "admin" : (user.role ?? "agent");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("crm_users")
    .insert({
      id,
      name: user.name,
      email: user.email,
      password_hash: user.passwordHash,
      role,
      active: true,
      created_at: now,
    })
    .select()
    .single();

  if (error) throw new Error("createUser: " + error.message);
  return rowToUser(data);
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<User, "name" | "role" | "active" | "avatar" | "passwordHash">>
): Promise<User | null> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.role !== undefined) dbPatch.role = patch.role;
  if (patch.active !== undefined) dbPatch.active = patch.active;
  if (patch.avatar !== undefined) dbPatch.avatar = patch.avatar;
  if (patch.passwordHash !== undefined) dbPatch.password_hash = patch.passwordHash;

  const { data, error } = await supabase
    .from("crm_users")
    .update(dbPatch)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) { console.error("updateUser:", error.message); return null; }
  return data ? rowToUser(data) : null;
}

export async function deleteUser(id: string): Promise<boolean> {
  const { error } = await supabase.from("crm_users").delete().eq("id", id);
  if (error) { console.error("deleteUser:", error.message); return false; }
  // Also purge in-memory sessions for this user
  if (globalThis.__crmSessions) {
    globalThis.__crmSessions = globalThis.__crmSessions.filter(s => s.userId !== id);
  }
  return true;
}

// ── Session helpers (in-memory, short-lived) ──────────────────────────────

function getSessions(): Session[] {
  if (!globalThis.__crmSessions) globalThis.__crmSessions = [];
  return globalThis.__crmSessions;
}

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  getSessions().push({ token, userId, createdAt: new Date().toISOString() });
  return token;
}

/** Async version — resolves the user from Supabase via session token */
export async function getSession(token: string): Promise<User | null> {
  const session = getSessions().find(s => s.token === token);
  if (!session) return null;
  return (await getUserById(session.userId)) ?? null;
}

export function deleteSession(token: string): void {
  if (!globalThis.__crmSessions) return;
  globalThis.__crmSessions = globalThis.__crmSessions.filter(s => s.token !== token);
}

// ── Row mapper ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role as UserRole,
    createdAt: row.created_at,
    active: row.active,
    avatar: row.avatar ?? undefined,
  };
}
