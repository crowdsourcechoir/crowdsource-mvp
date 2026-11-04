import {
  createContact,
  findExistingContact,
  listContactsForOrganization,
  updateContact,
} from "@/lib/sales/db/contacts";
import { findExistingOrganization, updateOrganization } from "@/lib/sales/db/organizations";
import { ENTERTAINMENT_BOOKING_AGENCIES_SEEDS } from "@/lib/sales/seed/entertainment-booking-agencies";

const NESTE_SEED = ENTERTAINMENT_BOOKING_AGENCIES_SEEDS.find((s) => s.name === "Neste Live!");

/**
 * Replace fake @nestelive.com doorways with published Live Nation contacts
 * (Jill Kopecky + nesteinfo@livenation.com + Savannah Beals pattern).
 * Marks leftover *@nestelive.com rows invalid so they can't be selected/sent.
 */
export async function fixNesteLiveContacts(options?: { force?: boolean }): Promise<{
  ok: boolean;
  skipped: boolean;
  organizationId: string | null;
  contactsUpserted: number;
  nesteliveMarkedInvalid: number;
  contacts: Array<{ fullName: string; email: string }>;
  error: string | null;
}> {
  if (!NESTE_SEED) {
    return {
      ok: false,
      skipped: false,
      organizationId: null,
      contactsUpserted: 0,
      nesteliveMarkedInvalid: 0,
      contacts: [],
      error: "Neste Live! seed definition missing.",
    };
  }

  const org = await findExistingOrganization(NESTE_SEED.name, NESTE_SEED.websiteUrl);
  if (!org) {
    return {
      ok: false,
      skipped: false,
      organizationId: null,
      contactsUpserted: 0,
      nesteliveMarkedInvalid: 0,
      contacts: [],
      error: "Neste Live! organization not found — run entertainment booking seed first.",
    };
  }

  const meta = (org.importMetadata ?? {}) as Record<string, unknown>;
  if (!options?.force && meta.nesteLiveContactsFixed === true) {
    return {
      ok: true,
      skipped: true,
      organizationId: org.id,
      contactsUpserted: 0,
      nesteliveMarkedInvalid: 0,
      contacts: [],
      error: null,
    };
  }

  let contactsUpserted = 0;
  for (const c of NESTE_SEED.contacts) {
    const email = c.email.trim().toLowerCase();
    const existing = await findExistingContact(org.id, email, c.fullName);
    if (existing) {
      await updateContact(existing.id, {
        fullName: c.fullName.trim(),
        roleTitle: c.roleTitle.trim(),
        roleCategory: c.roleCategory ?? existing.roleCategory,
        email,
        emailVerificationStatus: c.emailVerificationStatus ?? "valid_format",
        importMetadata: {
          ...(existing.importMetadata ?? {}),
          seededManually: true,
          nesteLiveFix: true,
          ...(c.roleDescription?.trim() ? { roleDescription: c.roleDescription.trim() } : {}),
        },
      });
    } else {
      await createContact({
        organizationId: org.id,
        fullName: c.fullName.trim(),
        roleTitle: c.roleTitle.trim(),
        roleCategory: c.roleCategory ?? null,
        email,
        source: "manual",
        emailVerificationStatus: c.emailVerificationStatus ?? "valid_format",
        importMetadata: {
          seededManually: true,
          nesteLiveFix: true,
          ...(c.roleDescription?.trim() ? { roleDescription: c.roleDescription.trim() } : {}),
        },
      });
    }
    contactsUpserted += 1;
  }

  let nesteliveMarkedInvalid = 0;
  const all = await listContactsForOrganization(org.id);
  for (const contact of all) {
    const email = (contact.email ?? "").toLowerCase();
    if (!email.endsWith("@nestelive.com")) continue;
    if (contact.emailVerificationStatus === "invalid") continue;
    await updateContact(contact.id, {
      emailVerificationStatus: "invalid",
      importMetadata: {
        ...(contact.importMetadata ?? {}),
        nesteLiveRetiredFakeInbox: true,
        nesteLiveRetiredAt: new Date().toISOString(),
      },
    });
    nesteliveMarkedInvalid += 1;
  }

  await updateOrganization(org.id, {
    importMetadata: {
      ...meta,
      nesteLiveContactsFixed: true,
      nesteLiveContactsFixedAt: new Date().toISOString(),
      salesInitiative: "booking_agents",
      revenueEngine: "premium",
    },
  });

  const refreshed = await listContactsForOrganization(org.id);
  return {
    ok: true,
    skipped: false,
    organizationId: org.id,
    contactsUpserted,
    nesteliveMarkedInvalid,
    contacts: refreshed
      .filter((c) => c.email && !c.email.toLowerCase().endsWith("@nestelive.com"))
      .map((c) => ({ fullName: c.fullName ?? "", email: c.email ?? "" })),
    error: null,
  };
}
