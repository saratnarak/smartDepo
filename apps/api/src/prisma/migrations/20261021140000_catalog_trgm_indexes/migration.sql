-- Trigram indexes for the case-insensitive contains searches used by the catalog list endpoints.
-- A btree index on (depot_id, name) helps sorting and equality, but not `ILIKE '%term%'`.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "categories_name_trgm_idx" ON "categories" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "products_name_trgm_idx" ON "products" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "products_sku_trgm_idx" ON "products" USING GIN ("sku" gin_trgm_ops);
