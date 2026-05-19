-- Add carrier_status to store detailed carrier sub-status (e.g. "Ramassé", "En cours")
-- This is populated by the Ameex webhook and shown in the commandes UI
ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS carrier_status TEXT;
ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS carrier_name TEXT;
