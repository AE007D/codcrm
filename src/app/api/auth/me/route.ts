import { NextResponse } from "next/server";
import { getSession } from "@/lib/authStore";
import { cookies } from "next/headers";

const SESSION_COOKIE = "codcrm_session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const user = getSession(token);
  if (!user) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
}
