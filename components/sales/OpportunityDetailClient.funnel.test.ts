import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FUNNEL_STAGES } from "@/lib/sales/funnel-labels";

function main() {
  const src = readFileSync(new URL("./OpportunityDetailClient.tsx", import.meta.url), "utf8");
  assert.match(src, /FUNNEL_STAGES\.map/, "opportunity detail renders funnel stage controls");
  assert.match(src, /\/api\/sales\/opportunities\/\$\{.*\}\/stage/, "posts stage changes to API");
  assert.match(src, /aria-pressed=\{active\}/, "active stage is pressed for a11y");
  assert.deepEqual(
    FUNNEL_STAGES.map((s) => s.key),
    ["awareness", "interest", "purchase", "lost"]
  );
  console.log("OpportunityDetailClient funnel controls tests passed");
}

main();
