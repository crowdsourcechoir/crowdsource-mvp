/**
 * Phase C smoke: pin edition + stub living/edition orders + merch input.
 * Run: npx tsx scripts/test-garden-phase-c.mjs
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const prevCwd = process.cwd();
const tmp = mkdtempSync(path.join(tmpdir(), "garden-c-"));

async function load(rel) {
  return import(pathToFileURL(path.join(prevCwd, rel)).href);
}

async function main() {
  process.chdir(tmp);
  const local = await load("lib/song-garden-v2/garden/local-garden-store.ts");
  const { applyMutation } = await load("lib/song-garden-v2/garden/apply-mutation.ts");
  const merch = await load("lib/song-garden-v2/garden/merch-render.ts");

  const garden = local.localCreateGarden({
    slug: "commerce-c",
    title: "Commerce Garden",
    status: "live",
    brandKit: { accentColor: "#CFFF81", primaryColor: "#1a0f2d" },
  });

  const mut = applyMutation(
    garden.worldState,
    {
      gardenId: garden.id,
      chapterId: null,
      kind: "vocal",
      sourceType: "pulse",
      sourceId: "p1",
      deviceId: "dev_abcdefghij",
      chapterWeight: 0.5,
    },
    garden.mutationPolicy
  );
  const persisted = local.localPersistMutation({
    gardenId: garden.id,
    chapterId: null,
    deviceId: "dev_abcdefghij",
    kind: "vocal",
    sourceType: "pulse",
    sourceId: "p1",
    delta: mut.delta,
    effects: mut.effects,
    nextState: mut.nextState,
    markIndex: mut.markIndex,
  });

  const pinned = merch.buildPinnedMerchSnapshot({ garden: persisted.garden });
  assert.equal(pinned.gardenSlug, "commerce-c");
  assert.ok(pinned.state.energy > 0);

  const edition = local.localCreateEdition({
    gardenId: garden.id,
    slug: "2026-08",
    label: "August 2026",
    pinnedSnapshot: pinned,
    renderSeed: `${pinned.state.renderSeed}:edition:2026-08`,
  });
  assert.equal(edition.slug, "2026-08");

  const editionInput = merch.editionToMerchInput(edition, "hoodie_front");
  assert.equal(editionInput.format, "hoodie_front");
  assert.equal(editionInput.brand.accentColor, "#CFFF81");

  const livingInput = merch.buildMerchRenderInput({
    brand: persisted.garden.brandKit,
    state: {
      energy: persisted.garden.worldState.energy,
      layers: persisted.garden.worldState.layers,
      landmarks: persisted.garden.worldState.landmarks,
      totals: persisted.garden.worldState.totals,
      renderSeed: persisted.garden.worldState.renderSeed,
      version: persisted.garden.worldState.version,
    },
    format: "square_print",
    personalMarks: local.localListMarks(garden.id, "dev_abcdefghij"),
  });
  assert.ok(livingInput.personal?.count >= 1);

  const nodesA = merch.merchDecorNodes(livingInput);
  const nodesB = merch.merchDecorNodes(livingInput);
  assert.equal(nodesA.length, nodesB.length);
  assert.equal(nodesA[0].x, nodesB[0].x);

  const livingOrder = local.localCreateOrder({
    gardenId: garden.id,
    kind: "living",
    editionId: null,
    editionSlug: null,
    format: "square_print",
    deviceId: "dev_abcdefghij",
    orderedSnapshot: merch.buildPinnedMerchSnapshot({ garden: persisted.garden }),
    merchInput: livingInput,
    status: "stub",
    note: "test living",
  });
  assert.equal(livingOrder.status, "stub");
  assert.equal(livingOrder.orderedSnapshot.worldVersion, persisted.garden.worldVersion);

  const editionOrder = local.localCreateOrder({
    gardenId: garden.id,
    kind: "edition",
    editionId: edition.id,
    editionSlug: edition.slug,
    format: "hoodie_front",
    deviceId: null,
    orderedSnapshot: edition.pinnedSnapshot,
    merchInput: editionInput,
    status: "stub",
    note: null,
  });
  assert.equal(editionOrder.editionSlug, "2026-08");

  const listed = local.localListOrders(garden.id);
  assert.ok(listed.length >= 2);

  console.log("ok: garden phase C edition + orders + merch input");
  process.chdir(prevCwd);
  rmSync(tmp, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.chdir(prevCwd);
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
});
