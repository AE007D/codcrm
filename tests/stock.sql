-- Run against an isolated database after both inventory migrations.
BEGIN;
INSERT INTO public.crm_products (id, owner_id, name, stock, purchase_price)
VALUES ('heater', 'workspace-a', 'Heater', 100, 63), ('other', 'workspace-b', 'Heater', 100, 63);
INSERT INTO public.crm_orders (id, workspace_id, product, quantity, source, status, carrier_name, inventory_product_id)
VALUES ('shipment', 'workspace-a', 'Heater', 28, 'page', 'nouveau', 'eagle', 'heater');
UPDATE public.crm_orders SET status = 'expédié', eagle_shipped_at = now() WHERE id = 'shipment';
DO $$ BEGIN
  ASSERT (SELECT stock = 72 FROM public.crm_products WHERE id = 'heater'), '100 - 28 must equal 72';
  ASSERT (SELECT stock = 100 FROM public.crm_products WHERE id = 'other'), 'workspace isolation';
END $$;
UPDATE public.crm_orders SET eagle_shipped_at = now() WHERE id = 'shipment';
DO $$ BEGIN
  ASSERT (SELECT stock = 72 FROM public.crm_products WHERE id = 'heater'), 'repeat shipment must not deduct again';
END $$;
UPDATE public.crm_products SET stock = 83 WHERE id = 'heater';
SELECT public.correct_product_stock('workspace-a', 'heater', 83, 72, '100 purchased, 28 shipped');
DO $$ BEGIN
  ASSERT (SELECT stock = 72 AND purchase_price = 63 FROM public.crm_products WHERE id = 'heater'), 'correction preserves costs';
  ASSERT (SELECT count(*) = 1 FROM public.crm_stock_corrections WHERE stock_before = 83 AND stock_after = 72), 'audit trail';
  BEGIN
    PERFORM public.correct_product_stock('workspace-a', 'heater', 83, 72, 'Stale correction');
    RAISE EXCEPTION 'stale correction accepted';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
  BEGIN
    PERFORM public.correct_product_stock('workspace-b', 'heater', 72, 0, 'Wrong workspace');
    RAISE EXCEPTION 'cross-workspace correction accepted';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  ASSERT (SELECT count(*) = 1 FROM public.crm_stock_corrections), 'failed corrections must not log';
END $$;
ROLLBACK;
