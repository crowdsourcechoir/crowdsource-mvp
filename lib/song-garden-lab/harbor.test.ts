import { genomeKey, quantize01 } from "./quantize";
import {
  HARBOR_STARTER,
  genomeForHarbor,
  harborEnergy,
  nextHarborNote,
} from "./harbor";

if (HARBOR_STARTER.length !== 8) throw new Error("the harbor opens with eight contributions");
if (HARBOR_STARTER[0].label !== "Harbor whistle") throw new Error("the first voice is the harbor whistle");

const whistle = genomeForHarbor("Voice", "Harbor whistle");
const again = genomeForHarbor("Voice", "Harbor whistle");
if (genomeKey(whistle) !== genomeKey(again)) throw new Error("a phrase must keep one genome");

const hum = genomeForHarbor("Voice", "Low hum under the pier");
if (genomeKey(whistle) === genomeKey(hum)) throw new Error("two voices should not share a genome");

const stomp = genomeForHarbor("Hit", "Dock stomp");
if (!(whistle.sustain > stomp.sustain)) throw new Error("a voice should sustain longer than a hit");
if (!(stomp.articulation > whistle.articulation)) throw new Error("a hit should articulate more than a voice");

if (whistle.motionSource !== "pitch") throw new Error("a harbor voice is read as pitch");
if (stomp.motionSource !== "flux") throw new Error("a hit is read as flux");
if (stomp.register !== quantize01(0.5)) throw new Error("a hit keeps register at the middle");

for (const axis of ["force", "sustain", "stillness", "brightness", "articulation", "motion"] as const) {
  const steps = Math.round(whistle[axis] * 63);
  if (Math.abs(whistle[axis] - steps / 63) > 1e-9) throw new Error(`${axis} left the quantize grid`);
}

if (harborEnergy(0) !== 0.08) throw new Error("an empty field still has a little light");
if (harborEnergy(9) !== 0.5) throw new Error("nine living bodies are half the field");
if (harborEnergy(40) !== 1) throw new Error("the field caps at full");

const added = nextHarborNote("Voice", 8);
if (added.id !== "n8" || added.label !== "A call from the back row") {
  throw new Error(`the ninth planting should take the third spare voice, got ${added.id} ${added.label}`);
}

console.log("song-garden-lab harbor tests: ok");
