import { createOutreachActivity, findActivityByGmailMessageId } from "@/lib/sales/db/activities";
import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import {
  getOpportunity,
  updateOpportunityRelationshipStage,
  updateOpportunityStatus,
  updateOpportunityTouchTimestamps,
} from "@/lib/sales/db/opportunities";
import { findExistingOrganization, updateOrganization } from "@/lib/sales/db/organizations";
import { createOutreachDraft, listDraftsForOpportunity, updateDraftDecision } from "@/lib/sales/db/outreach";
import { followUpFromDateInput } from "@/lib/sales/follow-up/calendar";
import { getGmailClient } from "@/lib/sales/gmail/client";
import { EXTERNAL_SENT_BODY, EXTERNAL_SENT_SUBJECT } from "@/lib/sales/outreach/external-sent";
import {
  seedOrgWithContacts,
  type SeedOrgWithContactsInput,
} from "@/lib/sales/seed/seed-org-with-contacts";

/** Pasted thread bodies (Joel ↔ Sam) — used when Gmail API import is unavailable. */
export const BALLARD_FC_THREAD_MESSAGES = [
  {
    id: "manual-ballard-fc-2026-10-08-out-1",
    direction: "outbound" as const,
    occurredAt: "2026-10-08T17:10:00.000Z", // Thu Oct 8, 10:10 AM PT
    subject: "Fan-sourced chants for Ballard FC / Salmon Bay FC",
    fromEmail: "crowdsourcechoir@gmail.com",
    fromName: "Crowdsource Choir",
    toEmails: ["sam@goballardfc.com", "camden@goballardfc.com"],
    body: `Hi Sam,
I'm Joel DeJong, founder of Crowdsource Choir here in Seattle. We awaken, harness, and amplify creative crowd potential. I'd love to explore how we could cultivate fan culture for Ballard FC and Salmon Bay FC by creating fan-sourced chants and anthems that we bring to life during participatory in-game musical experiences throughout the season.

Would you be up for connecting sometime in the next few weeks? Happy to jump on Zoom or grab coffee in person.

Cheers,
Joel`,
  },
  {
    id: "manual-ballard-fc-2026-10-08-in-1",
    direction: "inbound" as const,
    occurredAt: "2026-10-08T23:08:00.000Z", // Thu Oct 8, 4:08 PM PT
    subject: "Re: Fan-sourced chants for Ballard FC / Salmon Bay FC",
    fromEmail: "sam@goballardfc.com",
    fromName: "Sam Zisette",
    toEmails: ["crowdsourcechoir@gmail.com", "tiffany@goballardfc.com"],
    body: `Hi Joel - thanks for reaching out. Could we plan to connect later this fall? Now is quite a busy time and we'd be better served meeting later on in the year. In the meantime, can you send a little more detail of how you envision we would work together?

Best,
Sam`,
  },
  {
    id: "manual-ballard-fc-2026-10-09-out-2",
    direction: "outbound" as const,
    occurredAt: "2026-10-09T18:35:00.000Z", // Oct 9, 11:35 AM PT
    subject: "Re: Fan-sourced chants for Ballard FC / Salmon Bay FC",
    fromEmail: "crowdsourcechoir@gmail.com",
    fromName: "Crowdsource Choir",
    toEmails: ["sam@goballardfc.com"],
    body: `Hi Sam,
Here's how I envision working together: We crowdsource chants from Ballard FC fans and bring them to life on gameday, building a living fan culture throughout the season.

I'd love to develop this as a season-long creative partnership with Ballard FC, your fans, and sponsors.

Ballard FC helps shape the themes and connects the experience with your existing marketing, gameday programming, and sponsors.

Crowdsource Choir handles the creative process, from inviting fans into our online Chant Garden and gathering their ideas to producing the chants and leading the stadium on gameday in bringing them to life.

Together, we celebrate fan creators and build a culture of participation that amplifies the gameday atmosphere and grows into lasting traditions.

Here's an example:

Pagliacci Pizza could sponsor a chant for a rivalry game. Fans submit ideas, we create the chant and lead the stadium in singing it, and the winning fan gets recognized and rewarded with free pizza. Pagliacci becomes part of a memorable moment, and Ballard FC gains a new tradition.

I see a lot of potential to grow this together over a season, with fans helping shape the experience along the way. I'm also curious what your current stadium sound capabilities looks like and what's possible for live music during games.

Happy to answer any immediate questions, and looking forward to connecting later this fall!

Joel`,
  },
  {
    id: "manual-ballard-fc-2026-10-12-in-2",
    direction: "inbound" as const,
    occurredAt: "2026-10-12T15:38:00.000Z", // Oct 12, 8:38 AM PT
    subject: "Re: Fan-sourced chants for Ballard FC / Salmon Bay FC",
    fromEmail: "sam@goballardfc.com",
    fromName: "Sam Zisette",
    toEmails: ["crowdsourcechoir@gmail.com"],
    body: `Hi Joel,

Thank you for this detailed description as it is super helpful. Let me sit with this for a bit and chat with out team internally and then we can connect later this fall.

Thanks again!
Sam`,
  },
  {
    id: "manual-ballard-fc-2026-10-12-out-3",
    direction: "outbound" as const,
    occurredAt: "2026-10-12T17:28:00.000Z", // Oct 12, 10:28 AM PT
    subject: "Re: Fan-sourced chants for Ballard FC / Salmon Bay FC",
    fromEmail: "crowdsourcechoir@gmail.com",
    fromName: "Crowdsource Choir",
    toEmails: ["sam@goballardfc.com"],
    body: `Sounds good Sam!`,
  },
] as const;

export const BALLARD_FC_FOLLOW_UP_DATE = "2026-11-12";
export const BALLARD_FC_THREAD_KEY = "manual-ballard-fc-sam-zisette-2026-10";

export const BALLARD_FC_SEED: SeedOrgWithContactsInput = {
  name: "Ballard FC",
  websiteUrl: "https://www.goballardfc.com/",
  locationCity: "Seattle",
  locationRegion: "WA",
  locationCountry: "US",
  organizationTypeKey: "sports_team",
  salesInitiative: "sports_fan_culture",
  opportunityTypeKey: "fan_engagement_initiative",
  forceManualQueue: true,
  runPipeline: false,
  manualEventName: "Ballard FC season fan chants",
  manualQueueTitle: "Ballard FC — Sam Zisette (Interest) follow-up Nov 12",
  manualQueueDescription:
    "Live Gmail thread with Co-Founder/President Sam Zisette. He asked to reconnect later this fall after internal review. Follow up Nov 12.",
  eventDateEstimate: null,
  eventDateConfidence: "unknown",
  contacts: [
    {
      fullName: "Sam Zisette",
      email: "sam@goballardfc.com",
      roleTitle: "Co-Founder & President",
      roleCategory: "executive",
      emailVerificationStatus: "verified_deliverable",
      roleDescription:
        "Co-founder and president of Ballard FC (and Salmon Bay FC) — green-lights fan-culture partnerships and season-long programming.",
    },
    {
      fullName: "Tiffany Mallick",
      email: "tiffany@goballardfc.com",
      roleTitle: "Vice President & Athletic Trainer",
      roleCategory: "executive",
      emailVerificationStatus: "verified_deliverable",
      roleDescription: "VP on the Ballard / Salmon Bay leadership team — was on the Gmail thread with Sam.",
    },
    {
      fullName: "Camden Francis",
      email: "camden@goballardfc.com",
      roleTitle: "Vice President / Executive Director",
      roleCategory: "executive",
      emailVerificationStatus: "verified_deliverable",
      roleDescription: "VP / Executive Director — on the original outreach thread with Sam.",
    },
  ],
};

function headerValue(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  name: string
): string | null {
  const hit = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return hit?.value ?? null;
}

function extractEmails(header: string | null): string[] {
  if (!header) return [];
  return (header.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map((e) => e.toLowerCase());
}

function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

function extractTextBody(payload: {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: unknown;
} | null | undefined): string {
  if (!payload) return "";
  if (payload.mimeType?.startsWith("text/plain") && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  const parts = Array.isArray(payload.parts) ? payload.parts : [];
  for (const part of parts) {
    const text = extractTextBody(part as typeof payload);
    if (text.trim()) return text;
  }
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

async function importThreadFromGmail(input: {
  opportunityId: string;
  samContactId: string;
}): Promise<{ threadId: string | null; imported: number; source: "gmail" | "none" }> {
  const bundle = await getGmailClient();
  if (!bundle) return { threadId: null, imported: 0, source: "none" };

  const list = await bundle.gmail.users.messages.list({
    userId: "me",
    q: "(to:sam@goballardfc.com OR from:sam@goballardfc.com OR \"Sam Zisette\" OR Ballard FC) newer_than:45d",
    maxResults: 25,
  });

  const stubs = list.data.messages ?? [];
  if (stubs.length === 0) return { threadId: null, imported: 0, source: "none" };

  // Prefer the thread that includes sam@goballardfc.com.
  let chosenThreadId: string | null = null;
  const messages: Array<{
    id: string;
    threadId: string;
    fromEmail: string | null;
    fromName: string | null;
    toEmails: string[];
    subject: string | null;
    body: string;
    snippet: string | null;
    occurredAt: string;
    fromUs: boolean;
  }> = [];

  for (const stub of stubs) {
    if (!stub.id) continue;
    const full = await bundle.gmail.users.messages.get({
      userId: "me",
      id: stub.id,
      format: "full",
    });
    const headers = full.data.payload?.headers;
    const from = headerValue(headers, "From");
    const to = headerValue(headers, "To");
    const subject = headerValue(headers, "Subject");
    const fromEmails = extractEmails(from);
    const toEmails = extractEmails(to);
    const fromUs = fromEmails.some((e) => e === bundle.email.toLowerCase());
    const involvesSam =
      fromEmails.includes("sam@goballardfc.com") ||
      toEmails.includes("sam@goballardfc.com") ||
      /sam\s+zisette/i.test(from ?? "") ||
      /sam\s+zisette/i.test(full.data.snippet ?? "");
    if (!involvesSam && !chosenThreadId) continue;
    const threadId = full.data.threadId;
    if (!threadId || !full.data.id) continue;
    if (!chosenThreadId && involvesSam) chosenThreadId = threadId;
    if (chosenThreadId && threadId !== chosenThreadId) continue;

    const nameMatch = from?.match(/^([^<]+)</);
    messages.push({
      id: full.data.id,
      threadId,
      fromEmail: fromEmails[0] ?? null,
      fromName: nameMatch?.[1]?.trim() ?? null,
      toEmails,
      subject,
      body: extractTextBody(full.data.payload ?? null).trim(),
      snippet: full.data.snippet ?? null,
      occurredAt: full.data.internalDate
        ? new Date(Number(full.data.internalDate)).toISOString()
        : new Date().toISOString(),
      fromUs,
    });
  }

  if (!chosenThreadId || messages.length === 0) {
    return { threadId: null, imported: 0, source: "none" };
  }

  messages.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  let imported = 0;
  for (const msg of messages) {
    const existing = await findActivityByGmailMessageId(msg.id);
    if (existing) continue;
    await createOutreachActivity({
      opportunityId: input.opportunityId,
      contactId: input.samContactId,
      activityType: msg.fromUs ? "sent" : "replied",
      occurredAt: msg.occurredAt,
      gmailMessageId: msg.id,
      gmailThreadId: msg.threadId,
      metadata: {
        via: "ballard_fc_gmail_import",
        fromEmail: msg.fromEmail,
        fromName: msg.fromName,
        toEmails: msg.toEmails,
        subject: msg.subject,
        snippet: msg.snippet,
        body: msg.body || msg.snippet,
        replyKind: msg.fromUs ? undefined : "live",
      },
    });
    imported += 1;
  }

  return { threadId: chosenThreadId, imported, source: "gmail" };
}

async function recordPastedThread(input: {
  opportunityId: string;
  samContactId: string;
  threadId: string;
}): Promise<number> {
  let imported = 0;
  for (const msg of BALLARD_FC_THREAD_MESSAGES) {
    const existing = await findActivityByGmailMessageId(msg.id);
    if (existing) continue;
    await createOutreachActivity({
      opportunityId: input.opportunityId,
      contactId: input.samContactId,
      activityType: msg.direction === "outbound" ? "sent" : "replied",
      occurredAt: msg.occurredAt,
      gmailMessageId: msg.id,
      gmailThreadId: input.threadId,
      metadata: {
        via: "ballard_fc_pasted_thread",
        fromEmail: msg.fromEmail,
        fromName: msg.fromName,
        toEmails: [...msg.toEmails],
        subject: msg.subject,
        body: msg.body,
        snippet: msg.body.slice(0, 180),
        replyKind: msg.direction === "inbound" ? "live" : undefined,
      },
    });
    imported += 1;
  }
  return imported;
}

export type SeedBallardFcResult = {
  organizationId: string;
  organizationName: string;
  created: boolean;
  opportunityId: string | null;
  queueItemId: string | null;
  samContactId: string | null;
  relationshipStage: string | null;
  nextFollowUpAt: string | null;
  gmailThreadId: string | null;
  activitiesImported: number;
  threadSource: "gmail" | "pasted" | "mixed" | "none";
  skippedAlreadySeeded: boolean;
};

/**
 * Idempotent: Ballard FC sports org + Sam thread at Interest with Nov 12 follow-up.
 */
export async function seedBallardFcConversation(options?: {
  force?: boolean;
}): Promise<SeedBallardFcResult> {
  const force = Boolean(options?.force);
  const existing = await findExistingOrganization(BALLARD_FC_SEED.name, BALLARD_FC_SEED.websiteUrl);
  const meta = (existing?.importMetadata ?? {}) as Record<string, unknown>;
  if (!force && existing && meta.ballardFcConversationSeeded === true) {
    return {
      organizationId: existing.id,
      organizationName: existing.name,
      created: false,
      opportunityId: null,
      queueItemId: null,
      samContactId: null,
      relationshipStage: "interest",
      nextFollowUpAt: followUpFromDateInput(BALLARD_FC_FOLLOW_UP_DATE),
      gmailThreadId: typeof meta.ballardFcGmailThreadId === "string" ? meta.ballardFcGmailThreadId : null,
      activitiesImported: 0,
      threadSource: "none",
      skippedAlreadySeeded: true,
    };
  }

  const seeded = await seedOrgWithContacts(BALLARD_FC_SEED);
  const opportunityId = seeded.manualEnqueue?.opportunityId ?? null;
  const queueItemId = seeded.manualEnqueue?.queueItemId ?? null;
  if (!opportunityId || !queueItemId) {
    throw new Error("Ballard FC seed did not enqueue an opportunity/queue item.");
  }

  const contacts = await listContactsForOrganization(seeded.organization.id);
  const sam =
    contacts.find((c) => (c.email ?? "").toLowerCase() === "sam@goballardfc.com") ??
    contacts.find((c) => /zisette/i.test(c.fullName ?? "")) ??
    null;
  if (!sam) throw new Error("Sam Zisette contact missing after Ballard FC seed.");

  // Approve Sam's draft as already emailed (conversation is live in Gmail).
  const drafts = await listDraftsForOpportunity(opportunityId);
  const samDraft =
    drafts.find((d) => d.contactId === sam.id && (d.status === "draft" || d.status === "qa_flagged")) ??
    drafts.find((d) => d.contactId === sam.id) ??
    null;
  if (samDraft && (samDraft.status === "draft" || samDraft.status === "qa_flagged")) {
    await updateDraftDecision(samDraft.id, {
      status: "approved",
      editedSubject: EXTERNAL_SENT_SUBJECT,
      editedBody: EXTERNAL_SENT_BODY,
    });
  } else if (!samDraft) {
    await createOutreachDraft({
      opportunityId,
      contactId: sam.id,
      kind: "initial",
      status: "approved",
      aiSubject: EXTERNAL_SENT_SUBJECT,
      aiBody: EXTERNAL_SENT_BODY,
      confidenceScore: null,
    });
  }

  const gmailImport = await importThreadFromGmail({
    opportunityId,
    samContactId: sam.id,
  });

  let threadId = gmailImport.threadId ?? BALLARD_FC_THREAD_KEY;
  let activitiesImported = gmailImport.imported;
  let threadSource: SeedBallardFcResult["threadSource"] = gmailImport.source;

  // Always persist the pasted transcript so the full bodies Joel provided are in CRM,
  // even when Gmail also linked the real thread (synthetic message ids won't collide).
  const pasted = await recordPastedThread({
    opportunityId,
    samContactId: sam.id,
    threadId,
  });
  activitiesImported += pasted;
  if (gmailImport.source === "gmail" && pasted > 0) threadSource = "mixed";
  else if (pasted > 0 && gmailImport.source === "none") threadSource = "pasted";

  const followUpAt = followUpFromDateInput(BALLARD_FC_FOLLOW_UP_DATE);
  const lastOutbound = BALLARD_FC_THREAD_MESSAGES.filter((m) => m.direction === "outbound").at(-1)!;
  const lastInbound = BALLARD_FC_THREAD_MESSAGES.filter((m) => m.direction === "inbound").at(-1)!;

  await updateOpportunityRelationshipStage(opportunityId, "interest");
  await updateOpportunityStatus(opportunityId, "approved");
  await updateOpportunityTouchTimestamps(opportunityId, {
    gmailThreadId: threadId,
    lastOutboundAt: lastOutbound.occurredAt,
    lastInboundAt: lastInbound.occurredAt,
    nextFollowUpAt: followUpAt,
  });

  // Queue row stays pending so Funnel → Interest still lists Ballard FC under To send.

  await updateOrganization(seeded.organization.id, {
    importMetadata: {
      ...(seeded.organization.importMetadata ?? {}),
      ballardFcConversationSeeded: true,
      ballardFcConversationSeededAt: new Date().toISOString(),
      ballardFcGmailThreadId: threadId,
      ballardFcFollowUpDate: BALLARD_FC_FOLLOW_UP_DATE,
    },
  });

  const opportunity = await getOpportunity(opportunityId);
  return {
    organizationId: seeded.organization.id,
    organizationName: seeded.organization.name,
    created: seeded.created,
    opportunityId,
    queueItemId,
    samContactId: sam.id,
    relationshipStage: opportunity?.relationshipStage ?? "interest",
    nextFollowUpAt: opportunity?.nextFollowUpAt ?? followUpAt,
    gmailThreadId: opportunity?.gmailThreadId ?? threadId,
    activitiesImported,
    threadSource,
    skippedAlreadySeeded: false,
  };
}

export async function getBallardFcSeedStatus(): Promise<{
  present: boolean;
  markedSeeded: boolean;
  relationshipStage: string | null;
  nextFollowUpAt: string | null;
  gmailThreadId: string | null;
  activityCount: number;
  done: boolean;
  organizationName: string;
}> {
  const existing = await findExistingOrganization(BALLARD_FC_SEED.name, BALLARD_FC_SEED.websiteUrl);
  if (!existing) {
    return {
      present: false,
      markedSeeded: false,
      relationshipStage: null,
      nextFollowUpAt: null,
      gmailThreadId: null,
      activityCount: 0,
      done: false,
      organizationName: BALLARD_FC_SEED.name,
    };
  }
  const meta = (existing.importMetadata ?? {}) as Record<string, unknown>;
  const markedSeeded = meta.ballardFcConversationSeeded === true;

  // Find latest Ballard opportunity via queue items / contacts path is heavy; use org metadata + contacts count.
  const contacts = await listContactsForOrganization(existing.id);
  const hasSam = contacts.some((c) => (c.email ?? "").toLowerCase() === "sam@goballardfc.com");

  // Pull opportunity stage from any non-lost opp for this org.
  const { requireSupabaseAdmin } = await import("@/lib/sales/db/client");
  const db = requireSupabaseAdmin();
  const { data: opps } = await db
    .from("opportunities")
    .select("id, relationship_stage, next_follow_up_at, gmail_thread_id")
    .eq("organization_id", existing.id)
    .order("updated_at", { ascending: false })
    .limit(1);
  const opp = opps?.[0] ?? null;
  let activityCount = 0;
  if (opp?.id) {
    const { count } = await db
      .from("outreach_activities")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", opp.id);
    activityCount = count ?? 0;
  }

  const relationshipStage = (opp?.relationship_stage as string | null) ?? null;
  const nextFollowUpAt = (opp?.next_follow_up_at as string | null) ?? null;
  const gmailThreadId = (opp?.gmail_thread_id as string | null) ?? null;
  const followUpOk = Boolean(nextFollowUpAt && nextFollowUpAt.startsWith("2026-11-12"));
  const done =
    markedSeeded &&
    hasSam &&
    relationshipStage === "interest" &&
    followUpOk &&
    activityCount >= 3;

  return {
    present: true,
    markedSeeded,
    relationshipStage,
    nextFollowUpAt,
    gmailThreadId,
    activityCount,
    done,
    organizationName: existing.name,
  };
}
