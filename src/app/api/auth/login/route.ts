import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, hashPassword, createSession } from "@/lib/authStore";
import { cookies } from "next/headers";

const SESSION_COOKIE = "codcrm_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });
  }

  try {
    const user = await getUserByEmail(email);
    if (!user || !user.active) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    const hash = hashPassword(password);
    if (hash !== user.passwordHash) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    const token = createSession(user.id);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    console.error("[login]", message);
    return NextResponse.json({ error: "Erreur serveur: " + message }, { status: 500 });
  }
}
