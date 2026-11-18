import assert from "node:assert/strict";
import { defaultBrandKit } from "./types";
import { worldConfigFromBrand } from "./snapshot";
import { resolveWorldConfig, type WorldConfig } from "../world-config";

function baseWorld(overrides: Partial<WorldConfig> = {}): WorldConfig {
  return resolveWorldConfig({
    title: "WFEA Song Garden",
    heroImage: "",
    worldConfig: {
      title: "Crowdsource Choir",
      heroArtworkUrl: null,
      logoUrl: null,
      primaryColor: "#1a0f2d",
      accentColor: "#CFFF81",
      animationPreset: "particles",
      ambientSoundtrackUrl: null,
      aiArtworkPrompt: null,
      worldSceneStages: [],
      worldStoryboard: [],
      presenceSimulationEnabled: true,
      ...overrides,
    },
  });
}

function main() {
  const eventWorld = baseWorld();
  assert.equal(eventWorld.title, "Crowdsource Choir");

  const gardenBrand = defaultBrandKit({ title: "WFEA Song Garden" });

  const gardenPage = worldConfigFromBrand(gardenBrand, eventWorld);
  assert.equal(
    gardenPage.title,
    "WFEA Song Garden",
    "/g chrome may use the garden brand title"
  );

  const bloomJourney = worldConfigFromBrand(gardenBrand, eventWorld, {
    persistFallbackTitle: true,
  });
  assert.equal(
    bloomJourney.title,
    "Crowdsource Choir",
    "bloom journey keeps the world title after garden snapshot / permissions"
  );
  assert.equal(bloomJourney.primaryColor, gardenBrand.primaryColor);

  const blankWorldTitle = resolveWorldConfig({
    title: "WFEA Song Garden",
    heroImage: "",
    worldConfig: { ...eventWorld, title: "" },
  });
  const bloomFallsBack = worldConfigFromBrand(gardenBrand, blankWorldTitle, {
    persistFallbackTitle: true,
  });
  assert.equal(
    bloomFallsBack.title,
    "WFEA Song Garden",
    "blank world title still falls back to event title, then garden brand"
  );

  console.log("snapshot-title.test.ts: ok");
}

main();
