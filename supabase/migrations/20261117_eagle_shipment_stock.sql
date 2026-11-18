BEGIN;

ALTER TABLE public.crm_orders
  ADD COLUMN IF NOT EXISTS inventory_product_id text,
  ADD COLUMN IF NOT EXISTS eagle_shipped_at timestamptz;

CREATE OR REPLACE FUNCTION public.apply_eagle_shipment_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.eagle_shipped_at IS NOT NULL
    OR NEW.eagle_shipped_at IS NULL
    OR NEW.carrier_name IS DISTINCT FROM 'eagle'
    OR NEW.status IS DISTINCT FROM 'expédié' THEN
    RETURN NEW;
  END IF;

  -- Older product-page orders had stock deducted when they were created.
  IF NEW.source = 'page' AND NEW.inventory_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.crm_products AS product
  SET stock = greatest(0, product.stock - greatest(1, coalesce(NEW.quantity, 1)))
  WHERE product.owner_id = NEW.workspace_id
    AND product.id = (
      SELECT (array_agg(candidate.id))[1]
      FROM public.crm_products AS candidate
      WHERE candidate.owner_id = NEW.workspace_id
        AND (
          (NEW.inventory_product_id IS NOT NULL AND candidate.id::text = NEW.inventory_product_id)
          OR (NEW.inventory_product_id IS NULL AND lower(btrim(candidate.name)) = lower(btrim(NEW.product)))
        )
      HAVING count(*) = 1
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_eagle_shipment_stock ON public.crm_orders;
CREATE TRIGGER apply_eagle_shipment_stock
AFTER UPDATE OF eagle_shipped_at ON public.crm_orders
FOR EACH ROW EXECUTE FUNCTION public.apply_eagle_shipment_stock();

COMMIT;
