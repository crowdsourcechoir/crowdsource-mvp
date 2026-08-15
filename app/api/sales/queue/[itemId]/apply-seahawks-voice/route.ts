import { NextResponse } from "next/server";
import { getQueueItem, setQueueItemOutreachDraft } from "@/lib/sales/db/queue";
import { getOpportunity } from "@/lib/sales/db/opportunities";
import { getOrganization, updateOrganization } from "@/lib/sales/db/organizations";
import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { listDraftsForOpportunity, updateDraftEdits, createOutreachDraft } from "@/lib/sales/db/outreach";
import { buildSeahawksEmail } from "@/lib/sales/outreach/sports-voice";
import { isOutboundEmailBlocked } from "@/lib/sales/outreach/send-blocklist";
import { withSalesInitiative } from "@/lib/sales/initiatives";
import { stripEmailSignature } from "@/lib/sales/outreach/signature";

export const dynamic = "force-dynamic";

const JOEL_FINALS: Record<string, { subject: string; body: string }> = {
  "davidy@seahawks.com": {
    subject: "Crowdsourcing a Seahawks Choir",
    body: `Hi David,

I’m Joel DeJong, founder of Crowdsource Choir here in Seattle. I’ve been a 12 for many years, and I’ve been thinking about how our work could create a new kind of connection between the team and the 12s.

We design and deliver participatory music experiences, custom anthems, and crowdsourced chants to create energy, resonance, and cohesion within groups. With the Seahawks, I see a few connected possibilities:

A participatory music experience with the team at training camp to create energy and cohesion before a practice
An original anthem created with the 12s and brought to life in the stadium as a game-day moment
A season-long pipeline of crowdsourced chants and sounds that gives fans new ways to contribute throughout the season
The throughline is simple: there’s enormous collective energy and creative potential already present in the Seahawks community. We help harness it into super fun, engaging musical experiences.

I’d love to connect, share what we’re building, and see whether there’s a place to explore this with the Seahawks. If someone else on the team is the right person to talk with about this, I’d really appreciate being pointed in their direction.

There’s a little more about Crowdsource Choir here: www.crowdsourcechoir.com/book

Best,
Joel`,
  },
  "leeh@seahawks.com": {
    subject: "Crowdsourcing a Seahawks Choir",
    body: `Hi Lee,

I’m Joel DeJong, founder of Crowdsource Choir here in Seattle. I’ve been a 12 for many years, and I’ve been thinking about how our work could create a new kind of connection between the team and the 12s.

We design and deliver participatory music experiences, custom anthems, and crowdsourced chants to create energy, resonance, and cohesion within groups.

With the Seahawks, I see a few connected possibilities:

A participatory music experience with the team at training camp to create energy and cohesion before a practice
An original anthem created with the 12s and brought to life in the stadium as a game-day moment
A season-long pipeline of crowdsourced chants and sounds that gives fans new ways to contribute throughout the season

The throughline is simple: there’s enormous collective energy and creative potential already present in the Seahawks community. We help harness it into super fun, engaging musical experiences.

Given your work in entertainment experience and programming, I’d love to connect and explore how this kind of participation could become part of the Seahawks experience—not just something fans watch, but something they help create.

There’s a little more about Crowdsource Choir here: www.crowdsourcechoir.com/book

Best,
Joel`,
  },
  "allisonh@seahawks.com": {
    subject: "Crowdsourcing a Seahawks Choir",
    body: `Hi Allison,

I’m Joel DeJong, founder of Crowdsource Choir here in Seattle. I’ve been a 12 for many years, and I’ve been thinking about how our work could create a new kind of connection between the team and the 12s.

We design and deliver participatory music experiences, custom anthems, and crowdsourced chants to create energy, resonance, and cohesion within groups.

With the Seahawks, I see a few connected possibilities:

A participatory music experience with the team at training camp to create energy and cohesion before a practice
An original anthem created with the 12s and brought to life in the stadium as a game-day moment
A season-long pipeline of crowdsourced chants and sounds that gives fans new ways to contribute throughout the season

The throughline is simple: there’s enormous collective energy and creative potential already present in the Seahawks community. We help harness it into super fun, engaging musical experiences.

Given your work leading marketing, I’m especially interested in the potential for this to extend beyond a single game-day moment into something the 12s help create and build throughout the season. I’d love to connect, share what we’re building, and explore whether there’s a fit with the Seahawks.

There’s a little more about Crowdsource Choir here: www.crowdsourcechoir.com/book

Best,
Joel`,
  },
  "dstropes@seahawks.com": {
    subject: "Crowdsourcing a Seahawks Choir",
    body: `Hi Dan,

I’m Joel DeJong, founder of Crowdsource Choir here in Seattle. I’ve been a 12 for many years, and I’ve been thinking about how our work could create a new kind of connection between the team and the 12s.

We design and deliver participatory music experiences, custom anthems, and crowdsourced chants to create energy, resonance, and cohesion within groups.

With the Seahawks, I see a few connected possibilities:

A participatory music experience with the team at training camp to create energy and cohesion before a practice
An original anthem created with the 12s and brought to life in the stadium as a game-day moment
A season-long pipeline of crowdsourced chants and sounds that gives fans new ways to contribute throughout the season

The throughline is simple: there’s enormous collective energy and creative potential already present in the Seahawks community. We help harness it into super fun, engaging musical experiences.

Given your work in marketing, I’m especially interested in how this could become a season-long fan participation story—something the 12s actively help create with the team, rather than another campaign directed at them.

I’d love to connect, share what we’re building, and explore whether there’s a fit with the Seahawks.

There’s a little more about Crowdsource Choir here: www.crowdsourcechoir.com/book

Best,
Joel`,
  },
};

/**
 * Write Joel’s Seahawks finals + remaining drafts into open queue drafts.
 * NEVER sends. Skips hard-blocked emails (Tyler).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const item = await getQueueItem(itemId);
    if (!item) return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
    if (item.status !== "pending") {
      return NextResponse.json({ error: "Queue item not pending" }, { status: 409 });
    }

    const opportunity = await getOpportunity(item.opportunityId);
    if (!opportunity) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    const organization = await getOrganization(opportunity.organizationId);
    if (!organization) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    await updateOrganization(organization.id, {
      importMetadata: withSalesInitiative(
        (organization.importMetadata as Record<string, unknown> | null) ?? {},
        "sports_fan_culture"
      ),
    });

    const contacts = await listContactsForOrganization(organization.id);
    let drafts = await listDraftsForOpportunity(opportunity.id);
    const updated: { email: string; name: string; action: string }[] = [];
    const skipped: { email: string; reason: string }[] = [];

    for (const contact of contacts) {
      const email = (contact.email ?? "").trim().toLowerCase();
      if (!email) {
        skipped.push({ email: "", reason: "no email" });
        continue;
      }
      if (isOutboundEmailBlocked(email)) {
        skipped.push({ email, reason: "hard-blocked" });
        continue;
      }

      const firstName = (contact.fullName ?? "there").split(/\s+/)[0];
      const joel = JOEL_FINALS[email];
      const copy = joel
        ? { subject: joel.subject, body: stripEmailSignature(joel.body) }
        : buildSeahawksEmail({ firstName, roleTitle: contact.roleTitle });

      let open = drafts
        .filter((d) => d.kind === "initial" && d.contactId === contact.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .find((d) => d.status === "draft" || d.status === "qa_flagged");

      if (!open) {
        open = await createOutreachDraft({
          opportunityId: opportunity.id,
          contactId: contact.id,
          pipelineRunId: null,
          kind: "initial",
          status: "draft",
          confidenceScore: 0.9,
          aiSubject: copy.subject,
          aiBody: copy.body,
        });
        drafts = [...drafts, open];
        updated.push({ email, name: contact.fullName ?? "", action: "created-open-draft" });
      }

      await updateDraftEdits(open.id, {
        editedSubject: copy.subject,
        editedBody: copy.body,
      });
      if (!updated.some((u) => u.email === email && u.action === "created-open-draft")) {
        updated.push({ email, name: contact.fullName ?? "", action: "saved-edits" });
      }
    }

    const ryan = contacts.find((c) => (c.email ?? "").toLowerCase() === "ryanf@seahawks.com");
    if (ryan) {
      const ryanDraft = (await listDraftsForOpportunity(opportunity.id))
        .filter((d) => d.contactId === ryan.id && (d.status === "draft" || d.status === "qa_flagged"))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (ryanDraft) await setQueueItemOutreachDraft(itemId, ryanDraft.id);
    }

    return NextResponse.json({
      ok: true,
      sent: false,
      updated,
      skipped,
      message:
        "Drafts saved only — nothing emailed. Review in /admin/sales queue. Approve still requires confirm; Tyler stays blocked.",
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
