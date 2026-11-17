import assert from "node:assert/strict";
import { resolveBusinessModelFromMetadata } from "@/lib/sales/business-model";
import { contactRoleDescription } from "@/lib/sales/contacts/role-description";
import {
  isGenericMailboxEmail,
  isPlausibleEmail,
  isSendableContact,
  looksLikePersonName,
} from "@/lib/sales/dedupe";
import { readSalesInitiative } from "@/lib/sales/initiatives";
import { classifyOutreachPersona } from "@/lib/sales/outreach/persona";
import { hasEmailSignature } from "@/lib/sales/outreach/signature";
import { classifyQueueCategory } from "@/lib/sales/queue/category";
import { classifyWorkstream } from "@/lib/sales/strategy/playbook";
import type { Contact } from "@/lib/sales/types";
import {
  WFEA_BUSINESS_CARDS,
  buildCardOpportunityMetadata,
  buildCardOrganizationMetadata,
} from "./wfea-business-cards";

function makeMockContact(spec: (typeof WFEA_BUSINESS_CARDS)[number]): Contact {
  return {
    id: `c-${spec.key}`,
    organizationId: `org-${spec.key}`,
    fullName: spec.contact.fullName,
    roleTitle: spec.contact.roleTitle,
    roleCategory: spec.contact.roleCategory,
    outreachPersona: classifyOutreachPersona(spec.contact.roleTitle),
    email: spec.contact.email,
    normalizedEmail: spec.contact.email.toLowerCase(),
    phone: spec.contact.phone,
    emailVerificationStatus: "valid_format",
    linkedinUrl: null,
    source: "manual",
    duplicateOfContactId: null,
    importMetadata: {
      roleDescription: spec.contact.roleDescription,
    },
    enrichmentAttemptedAt: null,
    enrichmentProvider: null,
    enrichmentStatus: null,
    createdAt: "2026-11-17T22:35:00.000Z",
    updatedAt: "2026-11-17T22:35:00.000Z",
  };
}

function main() {
  assert.equal(WFEA_BUSINESS_CARDS.length, 3);

  // Cari Dixon (Washington State Fair Event Center) is already in the system and must not be re-seeded.
  for (const card of WFEA_BUSINESS_CARDS) {
    assert.notEqual(card.contact.fullName.toLowerCase(), "cari dixon");
    assert.ok(!card.contact.email.toLowerCase().includes("thefair.com"));
    assert.ok(!card.organizationName.toLowerCase().includes("washington state fair"));
  }

  const [kylie, deci, gazala] = WFEA_BUSINESS_CARDS;
  assert.ok(kylie && deci && gazala);

  // 1. Kylie Martinez — Friends of Waterfront Park
  assert.equal(kylie.organizationName, "Friends of Waterfront Park");
  assert.equal(kylie.websiteUrl, "https://waterfrontparkseattle.org");
  assert.equal(kylie.locationCity, "Seattle");
  assert.equal(kylie.locationRegion, "WA");
  assert.equal(kylie.contact.fullName, "Kylie Martinez");
  assert.equal(kylie.contact.pronouns, "She/Her");
  assert.equal(kylie.contact.roleTitle, "Events Sales Manager");
  assert.equal(kylie.contact.email, "kylie@waterfrontparkseattle.org");
  assert.equal(kylie.contact.officePhone, "(206) 445-7636");
  assert.equal(kylie.contact.cellPhone, "(801) 664-8777");
  assert.equal(kylie.contact.mailingAddress, "1201 Alaskan Way, Ste. 200, Seattle, WA 98101");
  assert.equal(classifyOutreachPersona(kylie.contact.roleTitle), "other");
  assert.match(kylie.draft.body, /^Hi Kylie,/);

  // 2. Deci Evans — Kind + Co Events
  assert.equal(deci.organizationName, "Kind + Co Events");
  assert.equal(deci.websiteUrl, "https://www.kacevents.com");
  assert.ok(deci.alternateWebsites.includes("https://kindandcompanyevents.org"));
  assert.equal(deci.contact.fullName, "Deci Evans");
  assert.equal(deci.contact.roleTitle, "Owner/CEO");
  assert.equal(deci.contact.email, "info@kindandcompanyevents.org");
  assert.equal(deci.contact.phone, "206-605-1873");
  assert.equal(deci.contact.instagramHandle, "@kindandcoevents");
  assert.equal(isGenericMailboxEmail(deci.contact.email), true);
  assert.equal(classifyOutreachPersona(deci.contact.roleTitle), "executive_director");
  // Even though her card prints info@kindandcompanyevents.org, her custom draft greets her by name.
  assert.match(deci.draft.body, /^Hi Deci,/);

  // 3. Gazala Uradnik — GFS Events
  assert.equal(gazala.organizationName, "GFS Events");
  assert.equal(gazala.websiteUrl, "https://www.gfsevents.org");
  assert.equal(gazala.contact.fullName, "Gazala Uradnik");
  assert.equal(gazala.contact.roleTitle, "Founder");
  assert.equal(gazala.contact.email, "gazala@gfsevents.org");
  assert.equal(gazala.contact.phone, "425-985-0208");
  assert.equal(classifyOutreachPersona(gazala.contact.roleTitle), "executive_director");
  assert.match(gazala.draft.body, /^Hi Gazala,/);

  // Shared contract assertions across all 3 business cards
  for (const spec of WFEA_BUSINESS_CARDS) {
    assert.ok(isPlausibleEmail(spec.contact.email), spec.contact.email);
    assert.ok(looksLikePersonName(spec.contact.fullName), spec.contact.fullName);

    const mockContact = makeMockContact(spec);
    assert.equal(isSendableContact(mockContact), true, `${spec.contact.fullName} must be sendable`);
    assert.equal(
      contactRoleDescription(mockContact),
      spec.contact.roleDescription,
      `${spec.contact.fullName} must surface custom role description`
    );

    const nowIso = "2026-11-17T22:35:00.000Z";
    const orgMeta = buildCardOrganizationMetadata(spec, { operatorQueuedAt: nowIso }, nowIso);
    assert.equal(orgMeta.operatorQueuedAt, nowIso);
    const oppMeta = buildCardOpportunityMetadata(spec, null, nowIso);

    const initiative = readSalesInitiative(orgMeta);
    assert.equal(initiative, spec.salesInitiative);

    const category = classifyQueueCategory({
      organizationName: spec.organizationName,
      opportunityTitle: spec.opportunity.title,
      opportunityTypeKey: spec.opportunity.opportunityTypeKey,
      organizationTypeKey: spec.organizationTypeKey,
      salesInitiative: initiative,
    });
    if (spec.key === "kylie_martinez") {
      assert.equal(category, "other");
    } else {
      assert.equal(category, "fundraisers");
    }

    const workstream = classifyWorkstream({
      revenueEngine: oppMeta.revenueEngine as string,
      salesInitiative: initiative,
      category,
      organizationTypeKey: spec.organizationTypeKey,
    });
    assert.equal(workstream, "premium");

    const model = resolveBusinessModelFromMetadata(oppMeta, orgMeta, {
      revenueEngine: oppMeta.revenueEngine as string,
      salesInitiative: initiative,
      category,
      organizationTypeKey: spec.organizationTypeKey,
      workstream,
      opportunityTitle: spec.opportunity.title,
    });
    assert.equal(model.businessCategory, "commissioned");
    assert.equal(model.productExperience, spec.opportunity.productExperience);
    assert.equal(model.dealType, spec.opportunity.dealType);
    assert.equal(model.editionBloom, spec.opportunity.editionBloom);

    assert.match(spec.draft.body, /https:\/\/www\.crowdsourcechoir\.com\/book/);
    assert.equal(hasEmailSignature(spec.draft.body), false);
  }

  console.log("wfea-business-cards tests passed");
}

main();
