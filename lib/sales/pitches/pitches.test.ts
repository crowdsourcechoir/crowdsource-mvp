import assert from "node:assert/strict";
import { hasSlidesScopes } from "./constants";
import { normalizePitchStore } from "./store";

assert.equal(hasSlidesScopes([]), false);
assert.equal(
  hasSlidesScopes([
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/drive.file",
  ]),
  true
);
assert.equal(hasSlidesScopes(["https://www.googleapis.com/auth/presentations"]), false);

const store = normalizePitchStore({
  version: 1,
  settings: { defaultTemplateFileId: "abc" },
  templates: [
    {
      id: "tpl_1",
      name: "Brand",
      description: null,
      googleSlidesTemplateFileId: "abc",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  pitches: [
    {
      id: "pitch_1",
      opportunityId: "opp_1",
      organizationId: "org_1",
      organizationName: "Test Org",
      opportunityTitle: "Gala",
      templateId: "tpl_1",
      title: "Pitch — Test Org",
      status: "draft",
      promptText: null,
      googlePresentationId: null,
      googleSlidesUrl: null,
      protectedToken: "tok_test",
      pdfStoragePath: null,
      lastSyncedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
});
assert.equal(store.templates.length, 1);
assert.equal(store.pitches[0]?.protectedToken, "tok_test");
assert.equal(store.settings.defaultTemplateFileId, "abc");

console.log("pitches tests ok");
