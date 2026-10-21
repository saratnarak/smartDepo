-- Keep the history table name plural, matching the repository's snake_case plural table convention.
ALTER TABLE "price_history" RENAME TO "price_histories";

ALTER TABLE "price_histories" RENAME CONSTRAINT "price_history_pkey" TO "price_histories_pkey";
ALTER TABLE "price_histories" RENAME CONSTRAINT "price_history_depot_id_fkey" TO "price_histories_depot_id_fkey";
ALTER TABLE "price_histories" RENAME CONSTRAINT "price_history_price_id_fkey" TO "price_histories_price_id_fkey";
ALTER TABLE "price_histories" RENAME CONSTRAINT "price_history_product_id_fkey" TO "price_histories_product_id_fkey";
ALTER TABLE "price_histories" RENAME CONSTRAINT "price_history_product_unit_id_fkey" TO "price_histories_product_unit_id_fkey";
ALTER TABLE "price_histories" RENAME CONSTRAINT "price_history_changed_by_id_fkey" TO "price_histories_changed_by_id_fkey";
ALTER TABLE "price_histories" RENAME CONSTRAINT "price_history_amount_nonnegative" TO "price_histories_amount_nonnegative";

ALTER INDEX "price_history_depot_id_idx" RENAME TO "price_histories_depot_id_idx";
ALTER INDEX "price_history_depot_id_product_unit_id_created_at_idx" RENAME TO "price_histories_depot_id_product_unit_id_created_at_idx";
ALTER INDEX "price_history_depot_id_product_id_created_at_idx" RENAME TO "price_histories_depot_id_product_id_created_at_idx";
ALTER INDEX "price_history_price_id_idx" RENAME TO "price_histories_price_id_idx";
ALTER INDEX "price_history_changed_by_id_idx" RENAME TO "price_histories_changed_by_id_idx";
