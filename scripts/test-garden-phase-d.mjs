/**
 * Phase D smoke: zones + zone_up mutations + ready shelf + snapshot zones.
 * Run: npx tsx scripts/test-garden-phase-d.mjs
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const prevCwd = process.cwd();
const tmp = mkdtempSync(path.join(tmpdir(), "garden-d-"));

async function load(rel) {
  return import(pathToFileURL(path.join(prevCwd, rel)).href);
}

async function main() {
  process.chdir(tmp);
  const local = await load("lib/song-garden-v2/garden/local-garden-store.ts");
  const { applyMutation } = await load("lib/song-garden-v2/garden/apply-mutation.ts");
  const { buildGardenSnapshot } = await load("lib/song-garden-v2/garden/snapshot.ts");
  const { defaultBrandKit } = await load("lib/song-garden-v2/garden/types.ts");

  const brand = defaultBrandKit({
    title: "City FC Garden",
    accentColor: "#CFFF81",
    zones: [
      {
        key: "North End!",
        label: "North End",
        x: 0.3,
        y: 0.25,
        sponsorKey: "acme",
        blurb: "Home roar",
      },
      { key: "south-end", label: "South End", x: 0.7, y: 0.75 },
    ],
    sponsors: [
      { key: "acme", name: "Acme Bank", credit: "Enabled by Acme Bank" },
    ],
  });

  assert.equal(brand.zones[0].key, "north-end");
  assert.equal(brand.zones[0].sponsorKey, "acme");
  assert.equal(brand.sponsors[0].key, "acme");

  const garden = local.localCreateGarden({
    slug: "fans-d",
    title: "Fans D",
    kind: "season",
    status: "live",
    brandKit: brand,
  });
  assert.equal(garden.brandKit.zones.length, 2);
  assert.ok(garden.worldState.zones);
  assert.deepEqual(garden.worldState.zones, {});

  const mut = applyMutation(
    garden.worldState,
    {
      gardenId: garden.id,
      chapterId: null,
      kind: "percussion",
      sourceType: "pulse",
      sourceId: "pulse_north_1",
      deviceId: "dev_abcdefghij",
      chapterWeight: 0.5,
      zoneKey: "north-end",
    },
    garden.mutationPolicy
  );

  assert.ok(mut.effects.some((e) => e.type === "zone_up" && e.zoneKey === "north-end"));
  assert.ok(mut.nextState.zones["north-end"]);
  assert.equal(mut.nextState.zones["north-end"].contributions, 1);
  assert.ok(mut.nextState.field.nodes[0].zoneKey === "north-end");
  assert.ok(mut.delta.zoneKey === "north-end");

  const persisted = local.localPersistMutation({
    gardenId: garden.id,
    chapterId: null,
    deviceId: "dev_abcdefghij",
    kind: "percussion",
    sourceType: "pulse",
    sourceId: "pulse_north_1",
    delta: mut.delta,
    effects: mut.effects,
    nextState: mut.nextState,
    markIndex: mut.markIndex,
  });

  const snap = buildGardenSnapshot({ garden: persisted.garden });
  assert.equal(snap.zones.length, 2);
  const north = snap.zones.find((z) => z.key === "north-end");
  assert.ok(north);
  assert.equal(north.sponsor?.name, "Acme Bank");
  assert.ok(north.runtime?.energy > 0);
  assert.equal(north.runtime?.contributions, 1);

  const queued = local.localCreateReadyItem({
    gardenId: garden.id,
    title: "North End kickoff swell",
    momentType: "kickoff",
    zoneKey: "north-end",
    sponsorKey: "acme",
    sourceType: "manual",
    sourceId: null,
    note: null,
    payload: {},
    status: "ready",
    sortIndex: 0,
  });
  assert.equal(queued.status, "ready");

  const promoted = local.localCreateReadyItem({
    gardenId: garden.id,
    title: "Goal roar — North End",
    momentType: "goal",
    zoneKey: "north-end",
    sponsorKey: "acme",
    sourceType: "pulse",
    sourceId: null,
    note: "promoted",
    payload: {
      worldVersion: persisted.garden.worldVersion,
      energy: persisted.garden.worldState.energy,
      zoneEnergy: persisted.garden.worldState.zones["north-end"].energy,
    },
    status: "ready",
    sortIndex: 1,
  });
  assert.ok(promoted.payload.worldVersion >= 1);

  const listed = local.localListReadyShelf(garden.id);
  assert.equal(listed.length, 2);

  const played = local.localUpdateReadyItem(queued.id, { status: "played" });
  assert.equal(played?.status, "played");

  // Replay must keep zoneKey on nodes.
  const { replayMutationsToState } = await load(
    "lib/song-garden-v2/garden/apply-mutation.ts"
  );
  const mutations = local.localListMutations(garden.id);
  assert.ok(mutations.length >= 1);
  const replayed = replayMutationsToState({
    gardenId: garden.id,
    renderSeed: garden.worldState.renderSeed,
    policy: persisted.garden.mutationPolicy,
    mutations,
  });
  assert.ok(replayed.zones["north-end"]?.contributions >= 1);
  assert.ok(replayed.field.nodes.some((n) => n.zoneKey === "north-end"));

  console.log("Phase D smoke OK", {
    zones: snap.zones.map((z) => z.key),
    worldVersion: persisted.garden.worldVersion,
    shelf: listed.map((i) => i.title),
  });

  process.chdir(prevCwd);
  rmSync(tmp, { recursive: true, force: true });
}

main().catch((err) => {
  process.chdir(prevCwd);
  rmSync(tmp, { recursive: true, force: true });
  console.error(err);
  process.exit(1);
});
