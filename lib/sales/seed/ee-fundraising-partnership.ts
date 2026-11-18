import type { Contact } from "@/lib/sales/types";
import {
  withBusinessCategory,
  withDealType,
  withProductExperience,
} from "@/lib/sales/business-model";
import { withFlagshipOffer, withRevenueEngine } from "@/lib/sales/engines";
import { withSalesInitiative } from "@/lib/sales/initiatives";

export const EE_FUNDRAISING_SEEDED_FLAG = "eeFundraisingPartnershipSeeded";
export const EE_FUNDRAISING_NAME = "E + E Fundraising & Events";
export const EE_FUNDRAISING_WEBSITE = "https://eefundraising.com/";
export const EE_FUNDRAISING_EVENT_NAME = "WFEA 2026 Annual Conference";
export const EE_FUNDRAISING_OPPORTUNITY_TITLE =
  "E + E Fundraising & Events — nonprofit gala & event partnership";
export const EE_FUNDRAISING_OPPORTUNITY_DESCRIPTION =
  "Met Liz DeBord (Event Production & Management) at the Washington Festivals & Events Association (WFEA) 2026 Annual Conference (badge scan). E + E Fundraising & Events plans and produces 60+ nonprofit galas, auctions, and fundraising campaigns across Washington ($14M+ raised). Strategic partnership to bring Crowdsource Choir's participatory Anthem experience into client galas and fundraising events. liz@eefundraising.com and (206) 658-3229 are published on the Nov 2, 2026 St. Vincent de Paul Bremerton PRWeb release; julianne@eefundraising.com is published in the WFEA member directory. Neither address is SMTP-verified yet (Hunter monthly quota at 50/50).";

/** OCR bleed in the printed WFEA sheet belonged to Eastern Washington State Historical Society in Spokane. */
export const WFEA_OCR_BLEED_PHONE = "(509)363-5340";

export type EeFundraisingContactSpec = {
  fullName: string;
  email: string;
  phone: string | null;
  roleTitle: string;
  roleCategory: string;
  emailVerificationStatus: Contact["emailVerificationStatus"];
  primary: boolean;
  roleDescription: string;
};

export const EE_FUNDRAISING_CONTACTS: EeFundraisingContactSpec[] = [
  {
    fullName: "Liz DeBord",
    email: "liz@eefundraising.com",
    phone: "(206) 658-3229",
    roleTitle: "Event Production & Management",
    roleCategory: "events",
    emailVerificationStatus: "valid_format",
    primary: true,
    roleDescription:
      "Met at the WFEA 2026 Annual Conference (badge scan). Leads Event Production & Management at E + E Fundraising & Events with 25+ years in PR and communications, shaping nonprofit galas and mission-driven campaigns. liz@eefundraising.com and (206) 658-3229 are published on the Nov 2, 2026 St. Vincent de Paul Bremerton PRWeb release (not yet SMTP-verified — Hunter monthly quota at 50/50).",
  },
  {
    fullName: "Julianne Read",
    email: "julianne@eefundraising.com",
    phone: null,
    roleTitle: "Founder, Strategist & Event Planner",
    roleCategory: "executive",
    emailVerificationStatus: "valid_format",
    primary: false,
    roleDescription:
      "Founder, Strategist & Event Planner at E + E Fundraising & Events (published WFEA directory contact). Leads fundraising event strategy, auctions, and nonprofit partner engagements across Puget Sound.",
  },
];

/**
 * Stamps strategic partnership + commissioned Anthem metadata on org/opportunity JSONB so
 * E + E surfaces in Partnership workstream, Strategic Partners saved view, and Partnership send lane.
 */
export function buildEeFundraisingPartnershipMetadata(
  existing?: Record<string, unknown> | null,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  let meta: Record<string, unknown> = {
    ...(existing ?? {}),
    source: "business_card_scan",
    addedFromCardScan: true,
    eventName: EE_FUNDRAISING_EVENT_NAME,
    searchTags: Array.from(
      new Set([
        ...(Array.isArray(existing?.searchTags) ? (existing.searchTags as string[]) : []),
        "wfea",
        "partnership",
        "fundraisers",
      ])
    ),
  };
  meta = withSalesInitiative(meta, "wfea_network");
  meta = withProductExperience(meta, "anthem");
  meta = withBusinessCategory(meta, "commissioned");
  meta = withFlagshipOffer(meta, "crowdsource_partnership");
  meta = withRevenueEngine(meta, "partnership");
  meta = withDealType(meta, "strategic_partnership");
  if (extra) {
    meta = { ...meta, ...extra };
  }
  return meta;
}

export function buildEeFundraisingDraftCopy(contactFullName: string): {
  subject: string;
  body: string;
} {
  const isLiz = /^liz\b/i.test(contactFullName.trim());
  if (isLiz) {
    return {
      subject: "Great meeting you at WFEA — Crowdsource Choir + E + E",
      body: [
        "Hi Liz,",
        "",
        "Great meeting you at the WFEA conference!",
        "",
        "I’m Joel DeJong, founder of Crowdsource Choir — a participatory musical experience where the audience becomes the choir. With the fundraising galas, auctions, and mission-driven events you and E + E produce across the region, I’d love to explore how we might partner together.",
        "",
        "For a room gathered around a cause, we turn guests from spectators into collaborators — gathering voices and story threads around the nonprofit’s mission and shaping them into an original anthem that the whole room performs live. It works well as an energized opener, a centerpiece before the paddle raise, or a closing moment donors carry home.",
        "",
        "Here’s a quick look at the experience:",
        "www.crowdsourcechoir.com",
        "",
        "I’d love to grab a quick coffee or call to hear what client events you’re building for the coming season and see where a creative partnership could amplify those rooms.",
        "",
        "Thanks, Liz!",
        "",
        "Best,",
        "Joel",
      ].join("\n"),
    };
  }

  const firstName = contactFullName.trim().split(/\s+/)[0] || "there";
  return {
    subject: "Crowdsource Choir + E + E Fundraising & Events",
    body: [
      `Hi ${firstName},`,
      "",
      "I connected with Liz DeBord at the WFEA conference and wanted to reach out to you as well!",
      "",
      "I’m Joel DeJong, founder of Crowdsource Choir — a participatory musical experience where the audience becomes the choir. Given the nonprofit galas, auctions, and campaigns E + E leads across Washington, I think there could be a strong creative partnership between our teams.",
      "",
      "We help fundraising rooms move from watching a program to creating something together — turning donor and community voices around a nonprofit’s mission into an original anthem that the whole room performs live.",
      "",
      "Here’s a quick look at the experience:",
      "www.crowdsourcechoir.com",
      "",
      "If it feels aligned, I’d love to connect with you and Liz to explore how Crowdsource Choir could plug into upcoming E + E client events.",
      "",
      `Thanks, ${firstName}!`,
      "",
      "Best,",
      "Joel",
    ].join("\n"),
  };
}
