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
import { enqueueOrgManually, type ManualEnqueueResult } from "@/lib/sales/seed/enqueue-manual";
import type { Contact, Organization } from "@/lib/sales/types";

export type SeedContactInput = {
  fullName: string;
  email: string;
  roleTitle: string;
  roleCategory?: string | null;
  /** Short “what they do” blurb for queue copy tweaking. */
  roleDescription?: string | null;
};

export type SeedOrgWithContactsInput = {
  name: string;
  websiteUrl: string;
  locationCity?: string | null;
  locationRegion?: string | null;
  locationCountry?: string | null;
  organizationTypeKey?: string;
  contacts: SeedContactInput[];
  runPipeline?: boolean;
  forceManualQueue?: boolean;
  /** Reopen a rejected/deferred queue row when force-manual enqueue runs. */
  reopenDecided?: boolean;
  /** Mint fresh open drafts for these emails even if already approved/sent. */
  remintApprovedEmails?: string[];
  manualQueueTitle?: string;
  manualQueueDescription?: string;
  manualEventName?: string;
  /** Opportunity type for manual enqueue (default fan_engagement_initiative). */
  opportunityTypeKey?: string;
};

export type SeedOrgWithContactsResult = {
  organization: Organization;
  created: boolean;
  contacts: Contact[];
  contactsCreated: number;
  contactsUpdated: number;
  pipeline: Awaited<ReturnType<typeof runPipelineForOrganization>> | null;
  manualEnqueue: ManualEnqueueResult | null;
};

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
    const meta = {
      seededManually: true,
      ...(c.roleDescription?.trim() ? { roleDescription: c.roleDescription.trim() } : {}),
    };
    const existing = await findExistingContact(organization.id, email, fullName);
    if (existing) {
      await updateContact(existing.id, {
        fullName,
        roleTitle: c.roleTitle.trim(),
        roleCategory: c.roleCategory ?? existing.roleCategory,
        email,
        emailVerificationStatus: "valid_format",
        importMetadata: { ...(existing.importMetadata ?? {}), ...meta },
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
        importMetadata: meta,
      });
      contactsCreated += 1;
    }
  }

  const runPipeline =
    input.runPipeline !== false && !input.reopenDecided && !(input.remintApprovedEmails?.length);
  let pipeline: Awaited<ReturnType<typeof runPipelineForOrganization>> | null = null;
  if (runPipeline && !input.forceManualQueue) {
    pipeline = await runPipelineForOrganization(organization.id, created ? "manual" : "reprocess_request");
  }

  const pipelineFailed =
    !pipeline ||
    pipeline.status === "failed" ||
    pipeline.opportunityIds.length === 0 ||
    !(pipeline.stagesRun ?? []).some((s) => s.stage === "queue" && s.status === "succeeded");

  let manualEnqueue: ManualEnqueueResult | null = null;
  if (
    input.forceManualQueue ||
    input.reopenDecided ||
    Boolean(input.remintApprovedEmails?.length) ||
    (runPipeline && pipelineFailed)
  ) {
    manualEnqueue = await enqueueOrgManually({
      organization,
      title:
        input.manualQueueTitle ??
        `${organization.name} — Song Garden / shared-creation anthem (training camp & game ritual)`,
      description:
        input.manualQueueDescription ??
        "Participatory anthem / belonging ritual for training camp and in-stadium moments. Doorway contacts (COO, game entertainment, marketing) verified via Hunter Email Finder.",
      eventOrInitiativeName: input.manualEventName ?? "Training camp / game entertainment ritual",
      opportunityTypeKey: input.opportunityTypeKey ?? "fan_engagement_initiative",
      totalScoreHint: 82,
      reopenDecided: Boolean(input.reopenDecided),
      remintApprovedEmails: input.remintApprovedEmails,
    });
  }

  return {
    organization,
    created,
    contacts: await listContactsForOrganization(organization.id),
    contactsCreated,
    contactsUpdated,
    pipeline,
    manualEnqueue,
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
    {
      fullName: "David Young",
      email: "davidy@seahawks.com",
      roleTitle: "Chief Operating Officer",
      roleCategory: "executive",
      roleDescription:
        "Top business operator for the club — owns cross-department priorities and can green-light or route a training-camp / stadium belonging initiative that spans entertainment and marketing.",
    },
    {
      fullName: "Ryan Flandreau",
      email: "ryanf@seahawks.com",
      roleTitle: "Reports to COO / Operations",
      roleCategory: "operations",
      roleDescription:
        "In the COO’s operations orbit — useful internal champion/router who can move a proposal to the right entertainment or marketing owners without owning game-day creative themselves.",
    },
    {
      fullName: "Mario Bailey",
      email: "mariob@seahawks.com",
      roleTitle: "Front office contact",
      roleCategory: "operations",
      roleDescription:
        "Front-office contact — treat as a doorway to confirm ownership; angle lightly until you know whether they sit closer to ops, community, or entertainment.",
    },
    {
      fullName: "Becca Stout",
      email: "beccas@seahawks.com",
      roleTitle: "Front office contact",
      roleCategory: "operations",
      roleDescription:
        "Front-office contact — useful for routing; keep the ask short and ask who owns game entertainment / fan experience for training camp.",
    },
    {
      fullName: "Tyler Cofer",
      email: "tylerc@seahawks.com",
      roleTitle: "Director of Game Entertainment & Special Events",
      roleCategory: "events",
      roleDescription:
        "Owns in-stadium entertainment and special events — primary buyer for a live participatory anthem, training-camp moment, or special-event ritual fans help create.",
    },
    {
      fullName: "Lee Herteg",
      email: "leeh@seahawks.com",
      roleTitle: "Manager, Entertainment Experience & Programming",
      roleCategory: "events",
      roleDescription:
        "Builds entertainment experience and programming — cares how moments feel for fans in the building; strong collaborator/owner for Song Garden-style shared creation.",
    },
    {
      fullName: "Allison Hoover",
      email: "allisonh@seahawks.com",
      roleTitle: "Managing Director of Marketing",
      roleCategory: "marketing",
      roleDescription:
        "Leads marketing at the club — strong fit for belonging/identity narrative that scales beyond one game into brand and season-long fan story.",
    },
    {
      fullName: "Dan Stropes",
      email: "dstropes@seahawks.com",
      roleTitle: "Director of Marketing",
      roleCategory: "marketing",
      roleDescription:
        "Marketing director — campaigns and fan-facing story; pitch shared-creation as something fans author with the team, not a one-off promo.",
    },
  ],
};
