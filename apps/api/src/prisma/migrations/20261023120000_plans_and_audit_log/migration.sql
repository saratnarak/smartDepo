-- Subscription plans and the audit log (FR-4, FR-50, FR-51).
--
-- The plans of the platform. The price is only shown in the interface: the billing is simulated,
-- so nothing is ever charged and no payment provider is involved.
--
-- The limits of a plan:
--   FREE_TRIAL  5 users,  10 products  (the plan every new depot starts with)
--   BASIC      15 users, 100 products
--   PRO        50 users, 1000 products
--
-- Every depot that has no active subscription gets the Free Trial, so the limits are enforced for
-- the depots that exist already.

INSERT INTO "plans" (
  "id",
  "code",
  "name",
  "price_monthly",
  "max_users",
  "max_products",
  "is_active",
  "created_at",
  "updated_at"
)
VALUES
  (gen_random_uuid(), 'FREE_TRIAL', 'Free Trial', 0.00, 5, 10, true, now(), now()),
  (gen_random_uuid(), 'BASIC', 'Basic', 19.00, 15, 100, true, now(), now()),
  (gen_random_uuid(), 'PRO', 'Pro', 49.00, 50, 1000, true, now(), now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "subscriptions" (
  "id",
  "depot_id",
  "plan_id",
  "status",
  "started_at",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  depot."id",
  plan."id",
  'ACTIVE',
  now(),
  now(),
  now()
FROM "depots" AS depot
CROSS JOIN "plans" AS plan
WHERE plan."code" = 'FREE_TRIAL'
  AND NOT EXISTS (
    SELECT 1
    FROM "subscriptions" AS subscription
    WHERE subscription."depot_id" = depot."id"
      AND subscription."status" = 'ACTIVE'
  );
