import { NextRequest, NextResponse } from "next/server";
import {
  getUsers,
  getUserByEmail,
  createUser,
  hashPassword,
} from "@/lib/authStore";

function clearAllStores() {
  // Wipe all in-memory data so the first admin starts with a clean slate
  globalThis.__lfOrders = [];
  globalThis.__lfEvents = 0;
  globalThis.__lfLeads = [];
  globalThis.__lpPages = [];
  globalThis.__webhookDebugLog = [];
}

export async function POST(request: NextRequest) {
  let body: { name?: string; email?: string; password?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, password, role } = body;
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Nom, email et mot de passe requis." }, { status: 400 });
  }

  const users = getUsers();
  const isFirstUser = users.length === 0;

  // First user (admin) always gets a fresh empty workspace
  if (isFirstUser) {
    clearAllStores();
  }

  const existing = getUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
  }

  const validRoles = ["admin", "agent", "viewer"];
  const assignedRole = validRoles.includes(role ?? "") ? (role as "admin" | "agent" | "viewer") : "agent";

  const user = createUser({
    name,
    email,
    passwordHash: hashPassword(password),
    role: isFirstUser ? "admin" : assignedRole,
    active: true,
  });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
