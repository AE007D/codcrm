BEGIN;

-- Corrections are separate from purchases: they never change acquisition costs.
CREATE TABLE IF NOT EXISTS public.crm_stock_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  product_id text NOT NULL,
  stock_before integer NOT NULL,
  stock_after integer NOT NULL CHECK (stock_after >= 0),
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_stock_corrections ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.correct_product_stock(
  p_workspace_id text, p_product_id text, p_expected_stock integer,
  p_stock integer, p_note text
) RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE current_stock integer;
BEGIN
  IF p_stock < 0 OR p_stock IS NULL OR nullif(btrim(p_note), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid stock correction' USING ERRCODE = '22023';
  END IF;
  SELECT stock INTO current_stock FROM public.crm_products
  WHERE owner_id::text = p_workspace_id AND id::text = p_product_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found' USING ERRCODE = 'P0002';
  END IF;
  IF current_stock IS DISTINCT FROM p_expected_stock THEN
    RAISE EXCEPTION 'Stock changed; reload before correcting' USING ERRCODE = '40001';
  END IF;
  UPDATE public.crm_products SET stock = p_stock
  WHERE owner_id::text = p_workspace_id AND id::text = p_product_id;
  -- The physical count excludes pending orders. Once corrected, legacy page
  -- orders must deduct on their future shipment rather than reuse the old
  -- checkout deduction. Already-shipped orders remain excluded.
  UPDATE public.crm_orders AS pending
  SET inventory_product_id = p_product_id
  WHERE pending.workspace_id::text = p_workspace_id
    AND pending.source = 'page' AND pending.inventory_product_id IS NULL
    AND pending.eagle_shipped_at IS NULL
    AND pending.status NOT IN ('expédié', 'livré', 'retourné')
    AND lower(btrim(pending.product)) = (
      SELECT lower(btrim(product.name)) FROM public.crm_products AS product
      WHERE product.owner_id::text = p_workspace_id AND product.id::text = p_product_id
    )
    AND 1 = (
      SELECT count(*) FROM public.crm_products AS candidate
      WHERE candidate.owner_id::text = p_workspace_id
        AND lower(btrim(candidate.name)) = lower(btrim(pending.product))
    );
  INSERT INTO public.crm_stock_corrections
    (workspace_id, product_id, stock_before, stock_after, note)
  VALUES (p_workspace_id, p_product_id, current_stock, p_stock, btrim(p_note));
  RETURN p_stock;
END;
$$;
REVOKE ALL ON FUNCTION public.correct_product_stock(text, text, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.correct_product_stock(text, text, integer, integer, text) TO service_role;

COMMIT;
