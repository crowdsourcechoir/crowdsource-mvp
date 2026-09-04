import { createContact, findExistingContact, listContactsForOrganization } from "../../db/contacts";
import { discoverEventContactsForOrganization } from "../../enrichment/event-contacts";
import { hasVerifiedEmail, isSendableContact, looksLikePersonName } from "../../dedupe";
import type { Organization } from "../../types";
import type { ResearchStageOutput } from "./research";

export type DiscoverContactsStageOutput = {
  existingContactCount: number;
  createdFromResearchCount: number;
  createdFromHunterEventSearch: number;
};

/**
 * No separate LLM call: named-people extraction already happened during the research stage
 * (stage 2), which has tool-free, read-only model access. This stage is the deterministic
 * step that turns "people mentioned in fetched pages" into contact rows — it never invents a
 * person that wasn't actually mentioned in a fetched source.
 *
 * Only skips fresh discovery once a contact with a genuinely verified email already exists.
 * Having *some* contact is not "done" — a re-run (e.g. after a research-quality improvement, or
 * once nothing else changed but the org just hadn't been looked at with the current logic yet)
 * must keep trying to find a better one until the verified-contact bar the queue gate requires is
 * actually met, otherwise an org can get permanently stuck on a weak first-pass contact forever.
 */
export async function runDiscoverContactsStage(
  org: Organization,
  namedPeopleMentioned: ResearchStageOutput["namedPeopleMentioned"]
): Promise<{ output: DiscoverContactsStageOutput }> {
  const existing = await listContactsForOrganization(org.id);
  if (existing.some((c) => hasVerifiedEmail(c))) {
    return {
      output: { existingContactCount: existing.length, createdFromResearchCount: 0, createdFromHunterEventSearch: 0 },
    };
  }

  let created = 0;
  for (const person of namedPeopleMentioned) {
    // Named humans from research only — general inboxes come from Hunter below, not the LLM.
    if (!looksLikePersonName(person.fullName)) continue;
    const alreadyExists = await findExistingContact(org.id, person.email, person.fullName);
    if (alreadyExists) continue;
    await createContact({
      organizationId: org.id,
      fullName: person.fullName,
      roleTitle: person.roleTitle,
      email: person.email,
      source: "ai_discovered",
      importMetadata: { discoveredFromUrl: person.sourceUrl },
    });
    created += 1;
  }

  let hunterCreated = 0;
  const afterNamed = created > 0 ? await listContactsForOrganization(org.id) : existing;
  if (!afterNamed.some((c) => isSendableContact(c))) {
    const hunted = await discoverEventContactsForOrganization(org);
    hunterCreated = hunted.created;
  }

  return {
    output: {
      existingContactCount: existing.length,
      createdFromResearchCount: created,
      createdFromHunterEventSearch: hunterCreated,
    },
  };
}
