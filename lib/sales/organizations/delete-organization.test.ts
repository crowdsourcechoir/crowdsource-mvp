import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Regression: Delete organization must soft-hide + close pending queue rows. */
function main() {
  const src = readFileSync(join(import.meta.dirname, "delete-organization.ts"), "utf8");
  assert.match(src, /withDoNotProspect/, "must mark do-not-prospect");
  assert.match(src, /DO_NOT_PROSPECT_REASON_OPERATOR_DELETED/, "must use operator_deleted reason");
  assert.match(src, /decideQueueItem/, "must close pending queue items");
  assert.match(src, /status:\s*["']rejected["']/, "pending queue items close as rejected");

  const route = readFileSync(
    join(process.cwd(), "app/api/sales/organizations/[orgId]/route.ts"),
    "utf8"
  );
  assert.match(route, /export async function DELETE/, "org API must expose DELETE");
  assert.match(route, /deleteOrganizationFromQueue/, "DELETE must call delete helper");

  const client = readFileSync(join(process.cwd(), "components/sales/ApprovalQueueClient.tsx"), "utf8");
  assert.match(client, /Delete organization/, "queue footer must show Delete organization");
  assert.match(client, /confirmRareDelete\(\s*["']organization["']/, "must use rare-delete confirm");
  assert.match(client, /text-red-300\/90 underline/, "delete control must match garden/bloom style");

  console.log("delete-organization tests passed");
}

main();
