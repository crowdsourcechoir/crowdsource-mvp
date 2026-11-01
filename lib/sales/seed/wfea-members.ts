/**
 * Cleaned WFEA (Western Festival & Event Association) member directory.
 * Source: OCR of printed membership list → data/wfea-members.json.
 *
 * salesTarget: festivals / arts / chambers / parks-events buyers.
 * Non-targets (vendors, insurers, etc.) are still imported as orgs.
 * followUp: salesTarget with at least one usable email.
 */

import raw from "@/data/wfea-members.json";

export type WfeaMember = {
  name: string;
  contactFullName: string | null;
  emails: string[];
  phone: string | null;
  websiteUrl: string | null;
  locationCity: string | null;
  locationRegion: string | null;
  locationCountry: string | null;
  directoryPage: number | null;
  notes: string;
  salesTarget: boolean;
  followUp: boolean;
  organizationTypeKey: string;
};

export const WFEA_MEMBERS: WfeaMember[] = raw as WfeaMember[];

export function wfeaOpportunityTypeKey(organizationTypeKey: string): string {
  switch (organizationTypeKey) {
    case "festival":
      return "community_festival";
    case "association":
      return "association_convention";
    case "nonprofit":
      return "community_festival";
    default:
      return "other";
  }
}

export function wfeaOperatorNotes(member: WfeaMember): string {
  const listing = (member.notes || "").trim();
  const base = "WFEA member directory.";
  if (!listing) return base;
  return `${base} ${listing}`.slice(0, 1800);
}
