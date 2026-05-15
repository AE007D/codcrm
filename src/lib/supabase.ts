import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "[COD CRM] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. " +
    "Add these env vars in Vercel → Settings → Environment Variables."
  );
}

// Server-side client with service role — bypasses RLS
export const supabase = createClient(url ?? "https://placeholder.supabase.co", key ?? "placeholder", {
  auth: { persistSession: false },
});
