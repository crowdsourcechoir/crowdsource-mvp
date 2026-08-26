/**
 * Platform V2 community spine smoke — identity gate, graph, recognition, react, credit pack, Index.
 * Run: USE_LOCAL_EVENTS=true node --import tsx scripts/test-platform-v2-community.mjs
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const prevCwd = process.cwd();
const tmp = mkdtempSync(path.join(tmpdir(), "platform-v2-"));
process.env.USE_LOCAL_EVENTS = "true";

function ok(label) {
  console.log(`  ✓ ${label}`);
}

async function main() {
  process.chdir(tmp);
  mkdirSync(path.join(tmp, ".data"), { recursive: true });
  writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "tmp" }));

  const types = await import(
    pathToFileURL(path.join(prevCwd, "lib/platform-v2/types.ts")).href
  );
  const store = await import(
    pathToFileURL(path.join(prevCwd, "lib/platform-v2/store.ts")).href
  );

  const gardenId = "garden-populus-test";
  const garden = {
    id: gardenId,
    slug: "populus-thresholds",
    title: "Populus Thresholds R&D",
  };

  // --- Identity helpers ---
  const open = types.normalizeCommunitySettings({ identityMode: "open" });
  assert.equal(types.canParticipate(open, null).ok, true);
  ok("open mode allows anonymous");

  const required = types.normalizeCommunitySettings({ identityMode: "account_required" });
  assert.equal(types.canParticipate(required, null).ok, false);
  assert.equal(
    types.canParticipate(required, {
      id: "1",
      gardenId,
      deviceId: "d1",
      displayName: "Ada",
      email: "ada@example.com",
      claimed: true,
      createdAt: "",
      updatedAt: "",
    }).ok,
    true
  );
  ok("account_required requires claimed identity");

  // --- Settings + Populus audience ---
  await store.patchCommunitySettings(gardenId, {
    identityMode: "account_required",
    reachableAudience: 400,
    campaignLabel: "Populus Thresholds R&D",
    populusPilot: true,
  });
  const settings = await store.getCommunitySettings(gardenId);
  assert.equal(settings.identityMode, "account_required");
  assert.equal(settings.reachableAudience, 400);
  assert.equal(settings.populusPilot, true);
  ok("community settings persist (local)");

  // --- Gate: react blocked before claim ---
  let blocked = false;
  try {
    await store.addReact({
      gardenId,
      sourceType: "turn",
      sourceId: "turn-1",
      deviceId: "dev_unclaimed",
    });
  } catch (err) {
    blocked = String(err.message).includes("claimed identity");
  }
  assert.equal(blocked, true);
  ok("react blocked under account_required without claim");

  // --- Claim ---
  const identity = await store.claimIdentity({
    gardenId,
    deviceId: "dev_ada",
    displayName: "Ada Lovelace",
    email: "ada@populus.test",
  });
  assert.equal(identity.claimed, true);
  ok("claim binds display name + email to device");

  // --- Upsert contribution with rights ---
  const node = await store.upsertContributionNode({
    gardenId,
    deviceId: "dev_ada",
    sourceType: "turn",
    sourceId: "turn-1",
    kind: "lyric",
    creditName: "Ada Lovelace",
    excerpt: "We rise at the threshold",
    rights: { publicDisplay: true, showUse: true, socialPosting: true, sponsorUse: true },
  });
  assert.equal(node.rights.publicDisplay, true);
  assert.equal(node.selected, false);
  ok("contribution node upserted with rights");

  // Second contributor
  await store.claimIdentity({
    gardenId,
    deviceId: "dev_bob",
    displayName: "Bob",
    email: "bob@populus.test",
  });
  await store.upsertContributionNode({
    gardenId,
    deviceId: "dev_bob",
    sourceType: "clip",
    sourceId: "clip-1",
    kind: "percussion",
    creditName: "Bob",
    excerpt: "kick",
  });

  // --- Select → recognition ---
  const selected = await store.markContributionSelected({
    gardenId,
    sourceType: "turn",
    sourceId: "turn-1",
    actorDeviceId: "composer",
  });
  assert.equal(selected.selected, true);
  ok("select marks node + emits recognition");

  const discoverable = await store.listDiscoverableContributions(gardenId, {
    selectedOnly: true,
  });
  assert.equal(discoverable.length, 1);
  assert.equal(discoverable[0].sourceId, "turn-1");
  ok("selected contributions are discoverable");

  // --- React → amplify ---
  const reactResult = await store.addReact({
    gardenId,
    sourceType: "turn",
    sourceId: "turn-1",
    deviceId: "dev_bob",
  });
  assert.equal(reactResult.created, true);
  assert.ok((reactResult.node?.reactCount ?? 0) >= 1);
  ok("react creates amplify recognition");

  const dup = await store.addReact({
    gardenId,
    sourceType: "turn",
    sourceId: "turn-1",
    deviceId: "dev_bob",
  });
  assert.equal(dup.created, false);
  ok("duplicate react is idempotent");

  // --- Perform → activation reach seam ---
  await store.markContributionPerformed({
    gardenId,
    sourceType: "turn",
    sourceId: "turn-1",
    actorDeviceId: "live",
  });
  ok("perform marks Live seam + recognition");

  // --- In-Garden credit ---
  const credits = await store.listInGardenCredits(gardenId);
  assert.ok(credits.some((c) => c.creditName === "Ada Lovelace"));
  ok("in-Garden credit lists credited names");

  // --- Credit pack ---
  const pack = await store.buildCreditPack(garden);
  assert.equal(pack.gardenSlug, "populus-thresholds");
  assert.ok(pack.entries.length >= 1);
  const adaEntry = pack.entries.find((e) => e.sourceId === "turn-1");
  assert.ok(adaEntry);
  assert.ok(adaEntry.recognition.includes("selected"));
  assert.ok(adaEntry.recognition.includes("performed"));
  assert.ok(adaEntry.recognition.includes("amplified"));
  ok("credit pack export includes dual recognition kinds");

  // --- Participation Index ---
  const index = await store.computeParticipationIndex(garden);
  assert.equal(index.contributors, 2);
  assert.equal(index.reachableAudience, 400);
  assert.equal(index.participationRate, 2 / 400);
  assert.equal(index.contributionsInWindow, 2);
  assert.equal(index.reactsInWindow, 1);
  assert.equal(index.sponsoredParticipationVolume, 3);
  assert.ok(index.activationReach >= 1);
  assert.equal(index.campaignLabel, "Populus Thresholds R&D");
  ok("Index: participation rate, sponsored volume, activation reach");

  // --- Switch to open mode and anonymous react ---
  await store.patchCommunitySettings(gardenId, { identityMode: "open" });
  const anonReact = await store.addReact({
    gardenId,
    sourceType: "clip",
    sourceId: "clip-1",
    deviceId: "dev_anon",
  });
  assert.equal(anonReact.created, true);
  ok("open mode allows anonymous react");

  console.log("\nAll Platform V2 community spine checks passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    process.chdir(prevCwd);
    rmSync(tmp, { recursive: true, force: true });
  });
