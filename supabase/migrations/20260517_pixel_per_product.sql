-- Add facebook_pixel_id to products and landing pages
-- Allows merchants to set a pixel ID per product/page directly

ALTER TABLE IF EXISTS public.crm_products
  ADD COLUMN IF NOT EXISTS facebook_pixel_id TEXT DEFAULT '';

ALTER TABLE IF EXISTS public.crm_pages
  ADD COLUMN IF NOT EXISTS facebook_pixel_id TEXT DEFAULT '';
