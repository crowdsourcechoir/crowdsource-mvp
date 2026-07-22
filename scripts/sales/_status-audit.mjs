// Read-only audit: lists every organization with its current organization_type key/label, sorted
// alphabetically. Purpose-built for manually reviewing which orgs are genuinely education-sector
// before writing an explicit, auditable backfill list (see
// supabase/sales-platform-add-industry-segment-override.sql) — deliberately not a keyword-regex
// classifier, since naive matching misfires on names like "American College of Healthcare
// Executives" (contains "College", is healthcare) vs. "Council of Independent Colleges" (is
// genuinely higher-ed). Usage: `node scripts/sales/_status-audit.mjs`.
import { loadEnvLocal, getSupabaseAdmin } from "./_shared.mjs";

loadEnvLocal();
const db = getSupabaseAdmin();

const { data: types, error: typesError } = await db.from("organization_types").select("id, key, label");
if (typesError) throw new Error(typesError.message);
const typeById = new Map((types ?? []).map((t) => [t.id, t]));

const { data: orgs, error: orgsError } = await db
  .from("organizations")
  .select("id, name, normalized_name, organization_type_id")
  .order("name", { ascending: true });
if (orgsError) throw new Error(orgsError.message);

console.log(`Total organizations: ${orgs.length}\n`);
for (const org of orgs) {
  const type = typeById.get(org.organization_type_id);
  console.log(`${org.name}  |  type=${type?.key ?? "none"}  |  id=${org.id}  |  normalized_name=${org.normalized_name}`);
}
