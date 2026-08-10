/**
 * Local smoke: upsert Ballard FC demo garden (USE_LOCAL_EVENTS=true).
 * Usage: USE_LOCAL_EVENTS=true npx tsx scripts/seed-ballard-fc-demo.mjs
 */
import {
  BALLARD_FC_GARDEN_SLUG,
  ballardFcBrandKit,
} from "../lib/song-garden-v2/garden/demos/ballard-fc.ts";
import {
  createGarden,
  getGardenByIdOrSlug,
  updateGarden,
} from "../lib/song-garden-v2/garden/store.ts";

async function main() {
  const brandKit = ballardFcBrandKit();
  const existing = await getGardenByIdOrSlug(BALLARD_FC_GARDEN_SLUG);
  const garden = existing
    ? await updateGarden(existing.id, {
        title: "Ballard FC Song Garden",
        kind: "season",
        status: "live",
        brandKit,
      })
    : await createGarden({
        slug: BALLARD_FC_GARDEN_SLUG,
        title: "Ballard FC Song Garden",
        kind: "season",
        status: "live",
        brandKit,
      });

  if (!garden) throw new Error("Failed to upsert Ballard garden");
  console.log("ok: ballard-fc demo", {
    slug: garden.slug,
    zones: garden.brandKit.zones.map((z) => z.key),
    map: garden.brandKit.heroArtworkUrl,
    sponsors: garden.brandKit.sponsors.map((s) => s.key),
    created: !existing,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
