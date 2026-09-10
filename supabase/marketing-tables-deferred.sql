-- Optional future SQL tables for Marketing (not required for v1).
--
-- Marketing v1 persists in Supabase Storage at marketing/v1.json
-- (same pattern as workspace settings / calendar) so shipping does not
-- require a SQL migration and never touches Gardens or Blooms tables.
--
-- Keep this file as a placeholder if/when we graduate to Postgres.
-- people / marketing_profiles / segments / campaigns / emails / recipients
-- intentionally deferred for v1.

select 1;
