import { scarcePad, resolveTake, STARTER_ID, type RoomTake } from "./room";
import { starterGenome } from "./starters";

const clap = (id: string, createdAt: number): RoomTake => ({ id, padId: "clap", createdAt });

const empty = scarcePad([]);
if (empty !== "clap") throw new Error(`empty room should ask for a clap, got ${empty}`);

const afterClap = scarcePad([clap("a", 1)]);
if (afterClap !== "tap") throw new Error(`after a clap the next ask is a tap, got ${afterClap}`);

const pinned = resolveTake({
  padId: "clap",
  takes: [clap("a", 1), clap("b", 2)],
  pinId: "a",
  refreshKey: 4,
  newestId: "b",
});
if (pinned.id !== "a" || pinned.reason !== "pin") throw new Error("a pin beats the newest take");

const starterPin = resolveTake({
  padId: "voice",
  takes: [{ id: "v", padId: "voice", createdAt: 1 }],
  pinId: STARTER_ID,
  refreshKey: 1,
  newestId: "v",
});
if (starterPin.id !== STARTER_ID || starterPin.reason !== "pin") throw new Error("a starter pin holds the house sound");

const newest = resolveTake({
  padId: "clap",
  takes: [clap("a", 1), clap("b", 2)],
  pinId: null,
  refreshKey: 9,
  newestId: "b",
});
if (newest.id !== "b" || newest.reason !== "newest") throw new Error("a take just kept plays until refresh");

const fresh = resolveTake({
  padId: "room",
  takes: [],
  pinId: null,
  refreshKey: 3,
  newestId: null,
});
if (fresh.reason !== "starter") throw new Error("an empty pad plays the starter");

const first = resolveTake({
  padId: "clap",
  takes: [clap("a", 1), clap("b", 2), clap("c", 3)],
  pinId: null,
  refreshKey: 11,
  newestId: null,
});
const second = resolveTake({
  padId: "clap",
  takes: [clap("a", 1), clap("b", 2), clap("c", 3)],
  pinId: null,
  refreshKey: 12,
  newestId: null,
});
if (first.reason !== "refresh" || second.reason !== "refresh") throw new Error("a pile picks on refresh");
if (first.id === second.id) throw new Error("two refresh keys should be able to land on different takes");

const genomes = ["clap", "tap", "voice", "room"] as const;
const keys = new Set(genomes.map((id) => JSON.stringify(starterGenome(id))));
if (keys.size !== 4) throw new Error("the four starters should not share one genome");

console.log("song-garden-lab room tests: ok");
