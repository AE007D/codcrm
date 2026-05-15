import { NextRequest, NextResponse } from "next/server";
import { getUsers, getSession, updateUser, deleteUser } from "@/lib/authStore";
import { cookies } from "next/headers";

const SESSION_COOKIE = "codcrm_session";

async function requireAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSession(token);
}

async function requireAdmin() {
  const user = await requireAuth();
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET() {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const users = (await getUsers()).map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt,
  }));

  return NextResponse.json({ users });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin requis." }, { status: 403 });
  }

  let body: { id?: string; name?: string; role?: string; active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, name, role, active } = body;
  if (!id) {
    return NextResponse.json({ error: "ID utilisateur requis." }, { status: 400 });
  }

  const patch: { name?: string; role?: "admin" | "agent" | "viewer"; active?: boolean } = {};
  if (name !== undefined) patch.name = name;
  if (active !== undefined) patch.active = active;
  if (role !== undefined) {
    const validRoles = ["admin", "agent", "viewer"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
    }
    patch.role = role as "admin" | "agent" | "viewer";
  }

  const updated = await updateUser(id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, active: updated.active },
  });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin requis." }, { status: 403 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "ID utilisateur requis." }, { status: 400 });
  }

  if (id === admin.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte." }, { status: 400 });
  }

  const deleted = await deleteUser(id);
  if (!deleted) {
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
