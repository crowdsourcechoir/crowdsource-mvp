import assert from "node:assert/strict";
import {
  COUPLING_SWEEP,
  SUBJECT_ID,
  WORLD_B_ORDER,
  closerThanStranger,
  compareOrders,
  permuteField,
  subjectRow,
} from "./compare";
import { foldLog } from "./fold";
import { publishedField } from "./genomes";
import { ribbonHash } from "./hash";
import { defaultLaws } from "./laws";

function main() {
  const field = publishedField();
  const worldB = permuteField(field, WORLD_B_ORDER);
  assert.deepEqual(
    worldB.map((entry) => entry.id),
    ["h08", "h02", "h11", "h01", "h05", "h12", "h03", "h07", "h09", "h04", "h06", "h10"]
  );
  assert.equal(worldB[9].id, SUBJECT_ID);
  assert.deepEqual([...COUPLING_SWEEP], [0, 0.25, 0.5, 0.75, 1]);

  const still = compareOrders(field, worldB, defaultLaws({ coupling: 0 }));
  assert.equal(still.rows.length, 12);
  assert.ok(still.maxPlacement < 0.08, `coupling 0 still shifts the ground by ${still.maxPlacement}`);
  for (const row of still.rows) {
    assert.ok(row.cross < 1e-9, `${row.id} changed shape at coupling 0`);
    assert.equal(row.armA, row.armB);
  }
  const hashesA = foldLog(field, defaultLaws({ coupling: 0 }));
  const hashesB = foldLog(worldB, defaultLaws({ coupling: 0 }));
  for (const organism of hashesA.organisms) {
    const other = hashesB.organisms.find((item) => item.id === organism.id);
    assert.equal(ribbonHash(organism.ribbon), ribbonHash(other!.ribbon));
  }
  assert.ok(still.finalsDiffer, "the published orders finish on different conditions");
  assert.ok(Math.abs(still.finalA.tension - still.finalB.tension) > 0.005);
  const born = subjectRow(still)!;
  assert.ok(Math.abs(born.birthA.tension - born.birthB.tension) > 0.2, "h04 is born into different tension");
  assert.equal(born.placeA, 4);
  assert.equal(born.placeB, 10);

  const fullLaws = defaultLaws({ coupling: 1, branchFromTension: false });
  const full = compareOrders(field, worldB, fullLaws);
  const fullA = foldLog(field, fullLaws);
  const fullB = foldLog(worldB, fullLaws);
  const subject = subjectRow(full)!;
  assert.notEqual(
    ribbonHash(fullA.organisms.find((item) => item.id === SUBJECT_ID)!.ribbon),
    ribbonHash(fullB.organisms.find((item) => item.id === SUBJECT_ID)!.ribbon)
  );
  assert.ok(subject.bendB > subject.bendA, "World B bends h04 further");
  assert.equal(full.armMismatches, 0, "the arm stays genomic unless the boundary law is on");
  assert.equal(closerThanStranger(full), true);

  const boundary = compareOrders(field, worldB, defaultLaws({ coupling: 0.5, branchFromTension: true }));
  assert.ok(boundary.armMismatches >= 0);
  const officialMid = compareOrders(field, worldB, defaultLaws({ coupling: 0.5, branchFromTension: false }));
  assert.equal(officialMid.armMismatches, 0);

  console.log("song-garden-lab compare tests: ok");
  console.log(
    JSON.stringify({
      coupling0Placement: Number(still.maxPlacement.toFixed(4)),
      tensionA: Number(still.finalA.tension.toFixed(3)),
      tensionB: Number(still.finalB.tension.toFixed(3)),
      h04bend: [Number(subject.bendA.toFixed(3)), Number(subject.bendB.toFixed(3))],
      h04cross: Number(subject.cross.toFixed(3)),
      medianWithin: Number(full.medianWithinA.toFixed(3)),
      armsAtBoundary: boundary.armMismatches,
    })
  );
}

main();
