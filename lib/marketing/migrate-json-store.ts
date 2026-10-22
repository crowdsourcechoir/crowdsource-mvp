import { createCampaign, listCampaignsWithEmails, updateCampaign } from "./db/campaigns";
import { upsertPerson } from "./db/people";
import { createSegment, listSegments } from "./db/segments";
import { getMarketingSettings, updateMarketingSettings } from "./db/settings";
import { readMarketingStore } from "./store";

/**
 * One-shot copy from marketing/v1.json into Postgres.
 * Idempotent on normalized email and on segment/campaign name.
 * Does not write the JSON blob.
 */
export async function migrateJsonMarketingStore(): Promise<{
  peopleCreated: number;
  peopleUpdated: number;
  peopleSkipped: number;
  segmentsCreated: number;
  campaignsCreated: number;
  settingsCopied: boolean;
}> {
  const { store, error } = await readMarketingStore();
  if (error) throw new Error(error);

  let peopleCreated = 0;
  let peopleUpdated = 0;
  let peopleSkipped = 0;
  for (const person of store.people) {
    const result = await upsertPerson({
      email: person.email,
      displayName: person.displayName,
      city: person.city,
      region: person.region,
      country: person.country,
      status: person.status,
      marketingConsent: person.marketingConsent,
      consentSource: person.consentSource ?? person.acquisitionSource,
      acquisitionSource: person.acquisitionSource,
      acquisitionDetail: person.acquisitionDetail,
      tags: person.tags,
      mailchimpId: person.mailchimpId,
      respectSuppression: true,
    });
    if (!result.ok) {
      peopleSkipped += 1;
      continue;
    }
    if (result.skippedReason) peopleSkipped += 1;
    else if (result.created) peopleCreated += 1;
    else peopleUpdated += 1;
  }

  const existingSegments = new Set((await listSegments()).map((segment) => segment.name));
  let segmentsCreated = 0;
  for (const segment of store.segments) {
    if (existingSegments.has(segment.name)) continue;
    await createSegment({ name: segment.name, description: segment.description, rules: segment.rules });
    segmentsCreated += 1;
    existingSegments.add(segment.name);
  }

  const existingCampaigns = new Set((await listCampaignsWithEmails()).campaigns.map((campaign) => campaign.name));
  let campaignsCreated = 0;
  for (const campaign of store.campaigns) {
    if (existingCampaigns.has(campaign.name)) continue;
    const email = store.emails.find((item) => item.campaignId === campaign.id);
    const created = await createCampaign({
      name: campaign.name,
      purpose: campaign.purpose,
      subject: email?.subject,
      previewText: email?.previewText,
    });
    if (email) {
      await updateCampaign({
        id: created.campaign.id,
        emailId: created.email.id,
        subject: email.subject,
        previewText: email.previewText,
        fromName: email.fromName,
        fromEmail: email.fromEmail,
        replyTo: email.replyTo,
        segmentId: null,
        blocks: email.blocks,
      });
    }
    campaignsCreated += 1;
  }

  let settingsCopied = false;
  if (store.settings.fromEmail || store.settings.physicalAddress || store.settings.ingestSecret) {
    const current = await getMarketingSettings();
    if (!current.fromEmail && !current.physicalAddress) {
      await updateMarketingSettings(store.settings);
      settingsCopied = true;
    }
  }

  return { peopleCreated, peopleUpdated, peopleSkipped, segmentsCreated, campaignsCreated, settingsCopied };
}
