// Syncs CRM users to Supabase Auth (Authentication → Users)
// This makes users visible in the Supabase dashboard without changing the CRM login system.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface SupabaseAuthUser {
  email: string;
  password?: string;
  email_confirm?: boolean;
  user_metadata?: Record<string, unknown>;
}

/** Create or update a user in Supabase Auth */
export async function syncToSupabaseAuth(opts: {
  email: string;
  password?: string;       // optional — if omitted, user has no password in Supabase Auth
  name: string;
  role: string;
}): Promise<void> {
  const headers = {
    "apikey": SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };

  // Check if user already exists in Supabase Auth
  const listRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(opts.email)}`,
    { headers }
  );
  const listData = await listRes.json().catch(() => ({}));
  const existing = (listData.users ?? []).find(
    (u: { email: string }) => u.email?.toLowerCase() === opts.email.toLowerCase()
  );

  const payload: SupabaseAuthUser = {
    email: opts.email,
    email_confirm: true,
    user_metadata: { name: opts.name, role: opts.role, crm: true },
  };
  if (opts.password) payload.password = opts.password;

  if (existing) {
    // Update existing
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
  } else {
    // Create new
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  }
}
