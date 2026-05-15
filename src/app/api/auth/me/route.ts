import { NextRequest, NextResponse } from "next/server";
import { getSession, updateUser, hashPassword } from "@/lib/authStore";
import { cookies } from "next/headers";

const SESSION_COOKIE = "codcrm_session";

async function getAuthedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSession(token);
}

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar ?? null,
    workspaceId: user.workspaceId,
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  let body: { name?: string; avatar?: string; currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updateUser>[1] = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Le nom ne peut pas être vide." }, { status: 400 });
    patch.name = name;
  }

  if (body.avatar !== undefined) {
    patch.avatar = body.avatar; // data URL or external URL
  }

  if (body.newPassword) {
    if (!body.currentPassword) {
      return NextResponse.json({ error: "Mot de passe actuel requis." }, { status: 400 });
    }
    const { hashPassword: hp } = await import("@/lib/authStore");
    if (hp(body.currentPassword) !== user.passwordHash) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 400 });
    }
    if (body.newPassword.length < 6) {
      return NextResponse.json({ error: "Le nouveau mot de passe doit faire au moins 6 caractères." }, { status: 400 });
    }
    patch.passwordHash = hashPassword(body.newPassword);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Aucune modification." }, { status: 400 });
  }

  const updated = await updateUser(user.id, patch);
  if (!updated) return NextResponse.json({ error: "Erreur lors de la mise à jour." }, { status: 500 });

  return NextResponse.json({
    ok: true,
    user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, avatar: updated.avatar ?? null },
  });
}
