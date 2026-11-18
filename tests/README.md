Stock regression checks:

```sh
node --experimental-strip-types --test tests/stockCorrection.test.mjs
```

`stock.sql` runs in an isolated PostgreSQL database with minimal `crm_products`
and `crm_orders` fixtures, after the two inventory migrations. It checks shipment
quantities, retry safety, workspace isolation, the 83 → 72 correction, unchanged
63 MAD acquisition cost, audit logging and rejection of stale corrections.
Do not run fixtures against production.

Release sequence:

1. Apply `20261117_eagle_shipment_stock.sql`, then `20261118_stock_correction.sql`.
2. Deploy the application. New product-page orders no longer deduct inventory;
   accepted Eagle shipments deduct their quantity once. Legacy page orders are
   excluded from an additional deduction because checkout already deducted them.
3. On Stock, select the car heater and use **Corriger le stock actuel** with
   **100** purchased and **28** sent. The saved balance becomes **72**. This is a
   correction, not another purchase; the original receipt and unit cost remain.

Existing balances are not rewritten automatically: purchase receipts alone do
not identify which historical orders actually left the warehouse. The correction
is administrator-only and rejects changes if stock moved since the page loaded.
