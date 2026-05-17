// Auth store — users AND sessions persisted in Supabase
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
  avatar?: string;
  workspaceId: string; // = own id for fresh signups; = admin's id for team members
};

const SALT = "CODCRM_SALT_";
const SESSION_TTL_DAYS = 30;

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(SALT + password).digest("hex");
}

// ── User helpers ────────────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from("crm_users")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) { console.error("getUsers:", error.message); return []; }
  return (data ?? []).map(rowToUser);
}

/** Returns only users in the same workspace */
export async function getUsersByWorkspace(workspaceId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from("crm_users")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) { console.error("getUsersByWorkspace:", error.message); return []; }
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
  user: Omit<User, "id" | "createdAt" | "workspaceId"> & { workspaceId?: string }
): Promise<User> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  // Fresh signup: workspaceId = own id. Invited user: workspaceId = passed in
  const workspaceId = user.workspaceId ?? id;

  const { data, error } = await supabase
    .from("crm_users")
    .insert({
      id,
      name: user.name,
      email: user.email,
      password_hash: user.passwordHash,
      role: user.role ?? "agent",
      active: user.active ?? true,
      created_at: now,
      workspace_id: workspaceId,
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
  return true;
}

// ── Session helpers (Supabase-backed) ───────────────────────────────────────

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await supabase.from("crm_sessions").insert({
    token,
    user_id: userId,
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
  });

  if (error) throw new Error("createSession: " + error.message);
  return token;
}

// ── Session cache (in-memory, per serverless instance) ───────────────────
// Avoids 2 Supabase roundtrips per API call for the same token.
// TTL: 60s — short enough to reflect logouts/role changes quickly.
const SESSION_CACHE = new Map<string, { user: User; cachedAt: number }>();
const SESSION_CACHE_TTL_MS = 60_000;

export async function getSession(token: string): Promise<User | null> {
  // Check in-memory cache first
  const cached = SESSION_CACHE.get(token);
  if (cached && Date.now() - cached.cachedAt < SESSION_CACHE_TTL_MS) {
    return cached.user;
  }

  const { data, error } = await supabase
    .from("crm_sessions")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) { SESSION_CACHE.delete(token); return null; }

  if (new Date(data.expires_at) < new Date()) {
    await supabase.from("crm_sessions").delete().eq("token", token);
    SESSION_CACHE.delete(token);
    return null;
  }

  const user = (await getUserById(data.user_id)) ?? null;
  if (user) SESSION_CACHE.set(token, { user, cachedAt: Date.now() });
  return user;
}

export async function deleteSession(token: string): Promise<void> {
  SESSION_CACHE.delete(token); // evict immediately on logout
  await supabase.from("crm_sessions").delete().eq("token", token);
}

// ── Row mapper ──────────────────────────────────────────────────────────────

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
    workspaceId: row.workspace_id ?? row.id,
  };
}
