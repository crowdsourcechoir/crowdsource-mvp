import type { BrandKit, ZoneDef } from "@/lib/song-garden-v2/garden/types";

/** Public demo slug for the Ballard FC Interbay Song Garden. */
export const BALLARD_FC_GARDEN_SLUG = "ballard-fc";

function zone(partial: ZoneDef): ZoneDef {
  return {
    ...partial,
    hit: partial.hit ?? { type: "circle", r: 0.08 },
  };
}

/**
 * Mock Crowdsource Fans garden for Ballard FC @ Interbay Stadium.
 * Seed art is the team's published stadium map until an AI season plate is generated + pinned.
 * Each zone carries its own prompt + CTA so engagement happens on the map.
 */
export function ballardFcBrandKit(): Partial<BrandKit> {
  return {
    title: "Ballard FC",
    logoUrl: "/fans/ballard-fc/logo.png",
    primaryColor: "#0B1F3A",
    accentColor: "#CFFF81",
    heroArtworkUrl: "/fans/ballard-fc/interbay-stadium-map.jpg",
    animationPreset: "particles",
    mapPlate: {
      referenceUrls: ["/fans/ballard-fc/interbay-stadium-map.jpg"],
      vibePrompt:
        "Ballard FC Interbay Stadium matchday night, deep navy Pacific Northwest pitch, chartreuse accents, stylized fan participation zones around the field, cinematic schematic map energy",
      draftUrl: null,
      draftGeneratedAt: null,
      pinnedAt: null,
      seasonLabel: "2026 season",
      layoutGuided: true,
      layoutSchematicUrl: null,
      ambientVideoUrl: null,
      ambientVideoGeneratedAt: null,
      variants: [],
      activeVariantKey: null,
    },
    sponsors: [
      {
        key: "pagliacci",
        name: "Pagliacci Pizza",
        credit: "Pagliacci Pitch",
      },
      {
        key: "stoup",
        name: "Stoup Brewing",
        credit: "Enabled by Stoup Brewing",
      },
      {
        key: "orgullo-ajeno",
        name: "Orgullo Ajeno",
        credit: "Orgullo Ajeno Tequila",
      },
      {
        key: "bridges-united",
        name: "Bridges United Foundation",
        credit: "Bridges United Foundation",
      },
      {
        key: "wombi",
        name: "Wombi",
        credit: "Wombi Bike Parking",
      },
    ],
    zones: [
      // Coordinates tuned to Interbay stadium map (1600×1102). Drag in admin to fine-tune.
      zone({
        key: "supporters",
        label: "Supporters",
        x: 0.78,
        y: 0.24,
        blurb: "Loudest end — leave a mark with the ultras.",
        sponsorKey: null,
        prompt: "What's your chant idea for the next game?",
        ctaLabel: "Share your chant",
        inputPlaceholder: "Type a chant line…",
      }),
      zone({
        key: "beer-garden",
        label: "Beer Garden",
        x: 0.9,
        y: 0.38,
        blurb: "Service Station #1 — Stoup sideline energy.",
        sponsorKey: "stoup",
        prompt: "What song should blast at the Stoup stand?",
        ctaLabel: "Leave a mark",
        inputPlaceholder: "Song, vibe, or shout…",
      }),
      zone({
        key: "tequila-zone",
        label: "Tequila Zone",
        x: 0.86,
        y: 0.58,
        blurb: "21+ corner — Orgullo Ajeno.",
        sponsorKey: "orgullo-ajeno",
        prompt: "Drop a toast for the 21+ corner.",
        ctaLabel: "Leave a mark",
        inputPlaceholder: "Your toast…",
      }),
      zone({
        key: "standing-room",
        label: "Standing Room",
        x: 0.32,
        y: 0.3,
        blurb: "On your feet along the north stand.",
        sponsorKey: null,
        prompt: "Who are you standing with tonight?",
        ctaLabel: "Check in",
        inputPlaceholder: "Crew, friends, solo…",
      }),
      zone({
        key: "family",
        label: "Family Section",
        x: 0.44,
        y: 0.3,
        blurb: "Alcohol-free GA — bring the kids.",
        sponsorKey: null,
        prompt: "What's your family's matchday ritual?",
        ctaLabel: "Leave a mark",
        inputPlaceholder: "A small ritual…",
      }),
      zone({
        key: "merch-tent",
        label: "Merch Tent",
        x: 0.2,
        y: 0.26,
        blurb: "Kits, scarves, and matchday gear.",
        sponsorKey: null,
        prompt: "What kit piece should Ballard drop next?",
        ctaLabel: "Leave a mark",
        inputPlaceholder: "Scarf, kit, colorway…",
      }),
      zone({
        key: "pagliacci-pitch",
        label: "Pagliacci Pitch",
        x: 0.5,
        y: 0.56,
        blurb: "Center circle — the shared Song Garden heart.",
        sponsorKey: "pagliacci",
        prompt: "What's your chant idea for the next game?",
        ctaLabel: "Share your chant",
        inputPlaceholder: "Type a chant line…",
        hit: { type: "circle", r: 0.12 },
      }),
      zone({
        key: "south-new",
        label: "South Stand",
        x: 0.52,
        y: 0.9,
        blurb: "New / coming seating — claim the south roar.",
        sponsorKey: null,
        prompt: "Claim the south roar — what should it sound like?",
        ctaLabel: "Leave a mark",
        inputPlaceholder: "A roar, a phrase…",
      }),
      zone({
        key: "bike-parking",
        label: "Bike Parking",
        x: 0.12,
        y: 0.16,
        blurb: "Roll up with Wombi.",
        sponsorKey: "wombi",
        prompt: "How did you roll into Interbay?",
        ctaLabel: "Check in",
        inputPlaceholder: "Bike, bus, walk…",
      }),
    ],
  };
}
