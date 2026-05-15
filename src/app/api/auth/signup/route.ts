import { NextRequest, NextResponse } from "next/server";
import {
  getUsers,
  getUserByEmail,
  createUser,
  getSession,
  hashPassword,
} from "@/lib/authStore";
import { cookies } from "next/headers";

const SESSION_COOKIE = "codcrm_session";

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

  if (!isFirstUser) {
    // Only admins can create users
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
    const requester = getSession(token);
    if (!requester || requester.role !== "admin") {
      return NextResponse.json({ error: "Seul un admin peut inviter des utilisateurs." }, { status: 403 });
    }
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
