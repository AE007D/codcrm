import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, updateUser, createSession } from "@/lib/authStore";
import { syncToSupabaseAuth } from "@/lib/supabaseAuthSync";
import { cookies } from "next/headers";

const SESSION_COOKIE = "codcrm_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: NextRequest) {
  let body: { credential?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { credential } = body;
  if (!credential) {
    return NextResponse.json({ error: "Google credential manquant." }, { status: 400 });
  }

  // Verify the Google ID token via Google's tokeninfo endpoint
  let email: string;
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    const data = await res.json();
    if (!res.ok || data.error || typeof data.email !== "string" || !data.email || (data.email_verified !== true && data.email_verified !== "true")) {
      return NextResponse.json({ error: "Token Google invalide." }, { status: 401 });
    }
    // Verify audience matches our app (if CLIENT_ID is set)
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      || "50528925336-37s476bkh1kn9qf7s1259vfqks95vvvo.apps.googleusercontent.com";
    if (clientId && data.aud !== clientId) {
      return NextResponse.json({ error: "Token Google invalide (audience)." }, { status: 401 });
    }
    email = data.email.trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Erreur vérification Google." }, { status: 500 });
  }

  let user = await getUserByEmail(email);
  if (!user) {
    return NextResponse.json(
      { error: "Les inscriptions sont fermées. Contactez-nous sur WhatsApp : +212644587812" },
      { status: 403 },
    );
  } else if (!user.active) {
    return NextResponse.json({ error: "Compte désactivé." }, { status: 403 });
  } else if (user.role !== "admin" && user.workspaceId === user.id) {
    // Self-registered user incorrectly stored as agent → promote to admin
    await updateUser(user.id, { role: "admin" });
    user = { ...user, role: "admin" };
  }

  // Sync to Supabase Auth
  syncToSupabaseAuth({ email: user.email, name: user.name, role: user.role })
    .catch(e => console.warn("[supabaseAuthSync/google]", e));

  const token = await createSession(user.id);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
