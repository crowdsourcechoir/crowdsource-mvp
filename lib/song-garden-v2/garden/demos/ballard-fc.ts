import type { BrandKit } from "@/lib/song-garden-v2/garden/types";

/** Public demo slug for the Ballard FC Interbay Song Garden. */
export const BALLARD_FC_GARDEN_SLUG = "ballard-fc";

/**
 * Mock Crowdsource Fans garden for Ballard FC @ Interbay Stadium.
 * Map art: team's published stadium map (sponsored / social zones, not seats).
 */
export function ballardFcBrandKit(): Partial<BrandKit> {
  return {
    title: "Ballard FC",
    logoUrl: "/fans/ballard-fc/logo.png",
    primaryColor: "#0B1F3A",
    accentColor: "#CFFF81",
    heroArtworkUrl: "/fans/ballard-fc/interbay-stadium-map.jpg",
    animationPreset: "particles",
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
      {
        key: "supporters",
        label: "Supporters",
        x: 0.7,
        y: 0.2,
        blurb: "Loudest end — leave a mark with the ultras.",
        sponsorKey: null,
      },
      {
        key: "beer-garden",
        label: "Beer Garden",
        x: 0.88,
        y: 0.3,
        blurb: "Service Station #1 — Stoup sideline energy.",
        sponsorKey: "stoup",
      },
      {
        key: "tequila-zone",
        label: "Tequila Zone",
        x: 0.88,
        y: 0.55,
        blurb: "21+ corner — Orgullo Ajeno.",
        sponsorKey: "orgullo-ajeno",
      },
      {
        key: "standing-room",
        label: "Standing Room",
        x: 0.3,
        y: 0.22,
        blurb: "On your feet along the north stand.",
        sponsorKey: null,
      },
      {
        key: "family",
        label: "Family Section",
        x: 0.42,
        y: 0.22,
        blurb: "Alcohol-free GA — bring the kids.",
        sponsorKey: null,
      },
      {
        key: "merch-tent",
        label: "Merch Tent",
        x: 0.22,
        y: 0.17,
        blurb: "Kits, scarves, and matchday gear.",
        sponsorKey: null,
      },
      {
        key: "pagliacci-pitch",
        label: "Pagliacci Pitch",
        x: 0.48,
        y: 0.52,
        blurb: "Center circle — the shared Song Garden heart.",
        sponsorKey: "pagliacci",
      },
      {
        key: "south-new",
        label: "South Stand",
        x: 0.55,
        y: 0.86,
        blurb: "New / coming seating — claim the south roar.",
        sponsorKey: null,
      },
      {
        key: "bike-parking",
        label: "Bike Parking",
        x: 0.18,
        y: 0.12,
        blurb: "Roll up with Wombi.",
        sponsorKey: "wombi",
      },
    ],
  };
}
