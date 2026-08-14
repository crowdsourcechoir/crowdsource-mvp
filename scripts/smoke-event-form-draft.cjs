const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const tmp = path.join("/workspace", "scripts", "_event-form-draft-smoke.mts");
fs.writeFileSync(
  tmp,
  `
import {
  draftMatchesBloom,
  draftToRestorePayload,
  isStockDefaultJourney,
  journeyStepsHaveContent,
  shouldPersistDraft,
} from "../lib/event-form-draft.ts";
import {
  defaultJourneySteps,
  createJourneyPromptStep,
  createJourneyNameStep,
} from "../lib/songgarden/journey-steps.ts";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(journeyStepsHaveContent(defaultJourneySteps()), "defaults have content");
assert(isStockDefaultJourney(defaultJourneySteps()), "defaults are stock");
assert(
  !shouldPersistDraft({ title: "", slug: "", journeySteps: defaultJourneySteps() }),
  "do not persist stock blank"
);
assert(
  shouldPersistDraft({ title: "Bloom", slug: "", journeySteps: defaultJourneySteps() }),
  "persist when titled"
);

const custom = [createJourneyNameStep(), createJourneyPromptStep("Custom prompt about summer")];
assert(shouldPersistDraft({ title: "", slug: "", journeySteps: custom }), "persist custom prompts");
assert(!isStockDefaultJourney(custom), "custom is not stock");

const draft = {
  version: 1 as const,
  savedAt: Date.now(),
  slug: "csc-aug14",
  title: "Test",
  description: "",
  date: "",
  time: "",
  venue: "",
  address: "",
  prompt: "",
  landingHeadline: "",
  landingCopy: "",
  ctaText: "",
  anthemCompletionMessage: "",
  agentThemeId: null,
  agentBrief: null,
  songGardenConfig: null,
  journeySteps: custom,
};
assert(draftMatchesBloom(draft, { slug: "csc-aug14" }), "slug match");
const payload = draftToRestorePayload(draft);
assert(Array.isArray(payload.journeySteps) && payload.journeySteps.length === 2, "restore payload has steps");
assert(payload.songGardenConfig!.journeySteps!.length === 2, "garden embeds steps");
console.log("event-form-draft smoke OK");
`
);

const r = spawnSync("npx", ["--yes", "tsx", tmp], {
  cwd: "/workspace",
  encoding: "utf8",
  timeout: 120000,
});
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
try {
  fs.unlinkSync(tmp);
} catch {
  /* ignore */
}
process.exit(r.status || 0);
