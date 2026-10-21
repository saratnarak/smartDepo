-- Cost precision fix (FR-37, FR-38, FR-29, FR-30).
--
-- The last purchase cost per base unit and the cost stored on a stock movement are now kept with
-- four decimals. A carton of 24 bottles bought for 10.00 is 0.4167 per bottle, and two decimals
-- would round that to 0.42 and quietly break the profit numbers. Money that is displayed is still
-- rounded to two decimals at the edge.

ALTER TABLE "products"
  ALTER COLUMN "cost_price" TYPE DECIMAL(14, 4) USING "cost_price"::DECIMAL(14, 4);

ALTER TABLE "stock_movements"
  ALTER COLUMN "unit_cost" TYPE DECIMAL(14, 4) USING "unit_cost"::DECIMAL(14, 4);

ALTER TABLE "sale_items"
  ALTER COLUMN "cost_per_base_unit" TYPE DECIMAL(14, 4) USING "cost_per_base_unit"::DECIMAL(14, 4);
