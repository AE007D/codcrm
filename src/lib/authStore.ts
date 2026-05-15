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
  avatar?: string; // URL or base64 data URL
};

const SALT = "CODCRM_SALT_";
const SESSION_TTL_DAYS = 30;

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
  // Sessions cascade-delete via FK
  const { error } = await supabase.from("crm_users").delete().eq("id", id);
  if (error) { console.error("deleteUser:", error.message); return false; }
  return true;
}

// ── Session helpers (Supabase-backed, survives serverless restarts) ─────────

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

export async function getSession(token: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("crm_sessions")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;

  // Check expiry
  if (new Date(data.expires_at) < new Date()) {
    // Expired — clean up
    await supabase.from("crm_sessions").delete().eq("token", token);
    return null;
  }

  return (await getUserById(data.user_id)) ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await supabase.from("crm_sessions").delete().eq("token", token);
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
