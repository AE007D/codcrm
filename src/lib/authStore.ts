// In-memory auth store — persists across HMR via globalThis
import crypto from "crypto";

export type UserRole = "admin" | "agent" | "viewer";

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
  active: boolean;
};

export type Session = {
  token: string;
  userId: string;
  createdAt: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __crmUsers: User[] | undefined;
  // eslint-disable-next-line no-var
  var __crmSessions: Session[] | undefined;
}

const SALT = "CODCRM_SALT_";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(SALT + password).digest("hex");
}

export function getUsers(): User[] {
  if (!globalThis.__crmUsers) globalThis.__crmUsers = [];
  return globalThis.__crmUsers;
}

export function getUserById(id: string): User | undefined {
  return getUsers().find(u => u.id === id);
}

export function getUserByEmail(email: string): User | undefined {
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
}

export function createUser(user: Omit<User, "id" | "createdAt" | "role"> & { role?: UserRole }): User {
  const users = getUsers();
  // First user ever becomes admin
  const role: UserRole = users.length === 0 ? "admin" : (user.role ?? "agent");
  const newUser: User = {
    id: crypto.randomUUID(),
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    role,
    createdAt: new Date().toISOString(),
    active: true,
  };
  users.push(newUser);
  return newUser;
}

export function updateUser(id: string, patch: Partial<Pick<User, "name" | "role" | "active">>): User | null {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...patch };
  return users[idx];
}

export function deleteUser(id: string): boolean {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return false;
  users.splice(idx, 1);
  // Also remove sessions for this user
  if (globalThis.__crmSessions) {
    globalThis.__crmSessions = globalThis.__crmSessions.filter(s => s.userId !== id);
  }
  return true;
}

function getSessions(): Session[] {
  if (!globalThis.__crmSessions) globalThis.__crmSessions = [];
  return globalThis.__crmSessions;
}

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  getSessions().push({ token, userId, createdAt: new Date().toISOString() });
  return token;
}

export function getSession(token: string): User | null {
  const session = getSessions().find(s => s.token === token);
  if (!session) return null;
  return getUserById(session.userId) ?? null;
}

export function deleteSession(token: string): void {
  if (!globalThis.__crmSessions) return;
  globalThis.__crmSessions = globalThis.__crmSessions.filter(s => s.token !== token);
}
