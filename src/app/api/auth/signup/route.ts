import { NextRequest, NextResponse } from "next/server";
import {
  getUserByEmail,
  createUser,
  hashPassword,
} from "@/lib/authStore";
import { syncToSupabaseAuth } from "@/lib/supabaseAuthSync";
import { saveSettings } from "@/lib/supabaseSettingsStore";

export async function POST(request: NextRequest) {
  let body: { name?: string; email?: string; password?: string; storeName?: string; shippingCompanies?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, password, storeName, shippingCompanies } = body;
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Nom, email et mot de passe requis." }, { status: 400 });
  }

  try {
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
    }

    // Public signup always creates a fresh admin with their own isolated workspace.
    // Team member creation goes through POST /api/auth/users (requires admin auth).
    const user = await createUser({
      name,
      email,
      passwordHash: hashPassword(password),
      role: "admin",
      active: true,
    });

    // Save store name and shipping companies in workspace settings
    if (storeName || shippingCompanies) {
      saveSettings(user.workspaceId, {
        ...(storeName ? { storeName } : {}),
        ...(shippingCompanies?.length ? { shippingCompanies } : {}),
      }).catch(() => {});
    }

    // Sync to Supabase Auth so user appears in Authentication → Users
    syncToSupabaseAuth({ email: user.email, password, name: user.name, role: user.role })
      .catch(e => console.warn("[supabaseAuthSync]", e));

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
