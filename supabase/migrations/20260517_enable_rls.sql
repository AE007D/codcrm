-- ============================================================
-- Enable Row Level Security on all CRM tables
-- Safe to run: the app uses SUPABASE_SERVICE_ROLE_KEY which
-- bypasses RLS entirely, so server-side code is unaffected.
-- This only blocks direct anon/public access to raw tables.
-- ============================================================

-- Core tables
ALTER TABLE IF EXISTS public.crm_users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_leads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_pages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_commissions     ENABLE ROW LEVEL SECURITY;

-- Any other tables that may exist
ALTER TABLE IF EXISTS public.crm_visitors        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_workspaces      ENABLE ROW LEVEL SECURITY;

-- Deny all public/anon access (service_role bypasses these automatically)
-- No policies needed — empty policy set = no anon access

-- Verify
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
