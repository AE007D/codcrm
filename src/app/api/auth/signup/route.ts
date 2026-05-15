import { NextRequest, NextResponse } from "next/server";
import {
  getUserByEmail,
  createUser,
  hashPassword,
} from "@/lib/authStore";

export async function POST(request: NextRequest) {
  let body: { name?: string; email?: string; password?: string; role?: string; workspaceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, password, role, workspaceId } = body;
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Nom, email et mot de passe requis." }, { status: 400 });
  }

  try {
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
    }

    const validRoles = ["admin", "agent", "viewer"];
    const assignedRole = validRoles.includes(role ?? "") ? (role as "admin" | "agent" | "viewer") : "agent";

    // Fresh signup (no workspaceId passed) → admin of their own new workspace
    // Invited by admin (workspaceId passed) → member of that workspace
    const user = await createUser({
      name,
      email,
      passwordHash: hashPassword(password),
      role: workspaceId ? assignedRole : "admin", // fresh = always admin
      active: true,
      ...(workspaceId ? { workspaceId } : {}), // omit = own workspace (set in createUser)
    });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    console.error("[signup]", message);
    if (message.includes("placeholder") || message.includes("Invalid URL") || message.includes("SUPABASE")) {
      return NextResponse.json(
        { error: "Configuration Supabase manquante. Ajoutez les variables d'environnement sur Vercel." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Erreur serveur: " + message }, { status: 500 });
  }
}
