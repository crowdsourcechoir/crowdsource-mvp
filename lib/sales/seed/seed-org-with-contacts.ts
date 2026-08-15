import {
  createContact,
  findExistingContact,
  listContactsForOrganization,
  updateContact,
} from "@/lib/sales/db/contacts";
import {
  createOrganization,
  findExistingOrganization,
  updateOrganization,
} from "@/lib/sales/db/organizations";
import { findOrganizationTypeByKey } from "@/lib/sales/db/lookups";
import { runPipelineForOrganization } from "@/lib/sales/pipeline/run-pipeline";
import type { Contact, Organization } from "@/lib/sales/types";

export type SeedContactInput = {
  fullName: string;
  email: string;
  roleTitle: string;
  roleCategory?: string | null;
};

export type SeedOrgWithContactsInput = {
  name: string;
  websiteUrl: string;
  locationCity?: string | null;
  locationRegion?: string | null;
  locationCountry?: string | null;
  organizationTypeKey?: string;
  contacts: SeedContactInput[];
  /** Run full pipeline so opportunity + queue row are created. Default true. */
  runPipeline?: boolean;
};

export type SeedOrgWithContactsResult = {
  organization: Organization;
  created: boolean;
  contacts: Contact[];
  contactsCreated: number;
  contactsUpdated: number;
  pipeline: Awaited<ReturnType<typeof runPipelineForOrganization>> | null;
};

/**
 * Upsert a manual organization + named contacts with verified-format emails, then optionally
 * run the pipeline so a pending approval_queue_items row appears.
 */
export async function seedOrgWithContacts(input: SeedOrgWithContactsInput): Promise<SeedOrgWithContactsResult> {
  if (!input.name?.trim()) throw new Error("name is required");
  if (!input.websiteUrl?.trim()) throw new Error("websiteUrl is required");
  if (!Array.isArray(input.contacts) || input.contacts.length === 0) {
    throw new Error("contacts[] is required");
  }

  const typeKey = input.organizationTypeKey ?? "sports_team";
  const orgType = await findOrganizationTypeByKey(typeKey);

  let created = false;
  let organization = await findExistingOrganization(input.name, input.websiteUrl);
  if (!organization) {
    organization = await createOrganization({
      name: input.name.trim(),
      websiteUrl: input.websiteUrl.trim(),
      locationCity: input.locationCity ?? null,
      locationRegion: input.locationRegion ?? null,
      locationCountry: input.locationCountry ?? "US",
      organizationTypeId: orgType?.id ?? null,
      source: "manual",
      isExistingClient: false,
      importMetadata: { seededWithContacts: true },
    });
    created = true;
  } else {
    organization = await updateOrganization(organization.id, {
      name: input.name.trim(),
      websiteUrl: input.websiteUrl.trim(),
      locationCity: input.locationCity ?? organization.locationCity,
      locationRegion: input.locationRegion ?? organization.locationRegion,
      locationCountry: input.locationCountry ?? organization.locationCountry ?? "US",
      organizationTypeId: orgType?.id ?? organization.organizationTypeId,
    });
  }

  let contactsCreated = 0;
  let contactsUpdated = 0;

  for (const c of input.contacts) {
    const email = c.email.trim().toLowerCase();
    const fullName = c.fullName.trim();
    if (!fullName || !email || !c.roleTitle?.trim()) {
      throw new Error(`Each contact needs fullName, email, and roleTitle (bad: ${JSON.stringify(c)})`);
    }
    const existing = await findExistingContact(organization.id, email, fullName);
    if (existing) {
      await updateContact(existing.id, {
        fullName,
        roleTitle: c.roleTitle.trim(),
        roleCategory: c.roleCategory ?? existing.roleCategory,
        email,
        emailVerificationStatus: "valid_format",
      });
      contactsUpdated += 1;
    } else {
      await createContact({
        organizationId: organization.id,
        fullName,
        roleTitle: c.roleTitle.trim(),
        roleCategory: c.roleCategory ?? null,
        email,
        source: "manual",
        emailVerificationStatus: "valid_format",
        importMetadata: { seededManually: true },
      });
      contactsCreated += 1;
    }
  }

  const runPipeline = input.runPipeline !== false;
  const pipeline = runPipeline
    ? await runPipelineForOrganization(organization.id, created ? "manual" : "reprocess_request")
    : null;

  return {
    organization,
    created,
    contacts: await listContactsForOrganization(organization.id),
    contactsCreated,
    contactsUpdated,
    pipeline,
  };
}

/** Seattle Seahawks doorway contacts from Hunter Email Finder (2026-08-15). */
export const SEAHAWKS_SEED: SeedOrgWithContactsInput = {
  name: "Seattle Seahawks",
  websiteUrl: "https://www.seahawks.com",
  locationCity: "Seattle",
  locationRegion: "WA",
  locationCountry: "US",
  organizationTypeKey: "sports_team",
  contacts: [
    { fullName: "David Young", email: "davidy@seahawks.com", roleTitle: "Chief Operating Officer", roleCategory: "executive" },
    { fullName: "Ryan Flandreau", email: "ryanf@seahawks.com", roleTitle: "Reports to COO / Operations", roleCategory: "operations" },
    { fullName: "Mario Bailey", email: "mariob@seahawks.com", roleTitle: "Front office contact", roleCategory: "operations" },
    { fullName: "Becca Stout", email: "beccas@seahawks.com", roleTitle: "Front office contact", roleCategory: "operations" },
    {
      fullName: "Tyler Cofer",
      email: "tylerc@seahawks.com",
      roleTitle: "Director of Game Entertainment & Special Events",
      roleCategory: "events",
    },
    {
      fullName: "Lee Herteg",
      email: "leeh@seahawks.com",
      roleTitle: "Manager, Entertainment Experience & Programming",
      roleCategory: "events",
    },
    {
      fullName: "Allison Hoover",
      email: "allisonh@seahawks.com",
      roleTitle: "Managing Director of Marketing",
      roleCategory: "marketing",
    },
    {
      fullName: "Dan Stropes",
      email: "dstropes@seahawks.com",
      roleTitle: "Director of Marketing",
      roleCategory: "marketing",
    },
  ],
};
