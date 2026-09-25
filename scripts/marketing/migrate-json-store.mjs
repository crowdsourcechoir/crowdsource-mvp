/**
 * Copy marketing/v1.json into Postgres. Safe to re-run.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/marketing/migrate-json-store.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and the
 * email-marketing SQL files already applied in the Supabase SQL Editor.
 */
import { migrateJsonMarketingStore } from "../../lib/marketing/migrate-json-store.ts";

const result = await migrateJsonMarketingStore();
console.log(JSON.stringify(result, null, 2));
