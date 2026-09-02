import { NextResponse } from "next/server";
import { listQueueSidebarItems, getQueueItem } from "@/lib/sales/db/queue";
import { assembleQueueItemDetailFromQueueItem } from "@/lib/sales/db/assemble";
import { updateDraftEdits } from "@/lib/sales/db/outreach";
import { listRecentSentPlainEmails, formatSentEmailsForPrompt } from "@/lib/sales/gmail/recent-sent";
import { learnFromSentOutreach } from "@/lib/sales/learning/from-sent";
import {
  customizeOutreachDraft,
  looksLikeGenericTemplateDraft,
  draftNamesWrongOrganization,
  draftNeedsTemplateRedraft,
} from "@/lib/sales/outreach/customize-draft";
import { buildCustomizedTemplateDraft } from "@/lib/sales/outreach/custom-template";
import { coalesceDraftBody, coalesceDraftSubject } from "@/lib/sales/outreach/email-body-format";
import { parseQueueCategory, matchesQueueCategory, type QueueCategoryFilter } from "@/lib/sales/queue/category";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 290;

/**
 * Rewrite pending queue drafts in Joel's sent-Gmail voice, customized per org/contact.
 * Saves edited copy only. Never sends.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(12, Math.max(1, Number(body?.limit) || 6));
    const offset = Math.max(0, Number(body?.offset) || 0);
    const learn = body?.learn !== false;
    const preferTemplate = body?.preferTemplate === true;
    const category = parseQueueCategory(typeof body?.category === "string" ? body.category : "all") as QueueCategoryFilter;

    if (learn && offset === 0 && !preferTemplate) {
      await learnFromSentOutreach(40).catch(() => undefined);
    }

    const sent = preferTemplate ? [] : await listRecentSentPlainEmails(10);
    const sentExamples = formatSentEmailsForPrompt(sent);

    const sidebar = (await listQueueSidebarItems("pending")).filter(
      (row) => row.queueItem.kind === "initial" && matchesQueueCategory(row, category)
    );
    const slice = sidebar.slice(offset, offset + limit);

    const rewritten: { queueItemId: string; organizationName: string; subject: string }[] = [];
    const skipped: { queueItemId: string; organizationName: string; reason: string }[] = [];
    const errors: { queueItemId: string; organizationName: string; error: string }[] = [];

    for (const row of slice) {
      const item = await getQueueItem(row.queueItem.id);
      if (!item?.outreachDraftId) {
        skipped.push({ queueItemId: row.queueItem.id, organizationName: row.organizationName, reason: "no draft" });
        continue;
      }
      const detail = await assembleQueueItemDetailFromQueueItem(item);
      if (!detail?.draft || !detail.contact) {
        skipped.push({ queueItemId: row.queueItem.id, organizationName: row.organizationName, reason: "missing detail" });
        continue;
      }
      const currentBody = coalesceDraftBody(detail.draft.editedBody, detail.draft.aiBody);
      const currentSubject = coalesceDraftSubject(detail.draft.editedSubject, detail.draft.aiSubject);
      const generic = looksLikeGenericTemplateDraft(currentBody);
      const wrongOrg = draftNamesWrongOrganization(currentBody, detail.organization.name);
      const weak = draftNeedsTemplateRedraft(currentBody, currentSubject);
      const alreadyNamed =
        !generic &&
        !wrongOrg &&
        !weak &&
        currentBody.length > 850 &&
        new RegExp(detail.organization.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(currentBody);
      if (alreadyNamed) {
        skipped.push({ queueItemId: row.queueItem.id, organizationName: row.organizationName, reason: "already customized" });
        continue;
      }

      try {
        let customized: { subject: string; body: string };
        if (preferTemplate) {
          customized = buildCustomizedTemplateDraft({
            firstName: (detail.contact.fullName ?? "there").split(/\s+/)[0] || "there",
            roleTitle: detail.contact.roleTitle,
            organizationName: detail.organization.name,
            opportunityTitle: detail.opportunity.title,
            category: row.category,
          });
        } else {
          try {
            customized = await customizeOutreachDraft({ detail, sentExamples });
          } catch (err) {
            const message = err instanceof Error ? err.message : "";
            if (!/429|credits remaining/i.test(message)) throw err;
            customized = buildCustomizedTemplateDraft({
              firstName: (detail.contact.fullName ?? "there").split(/\s+/)[0] || "there",
              roleTitle: detail.contact.roleTitle,
              organizationName: detail.organization.name,
              opportunityTitle: detail.opportunity.title,
              category: row.category,
            });
          }
        }
        await updateDraftEdits(detail.draft.id, {
          editedSubject: customized.subject,
          editedBody: customized.body,
        });
        rewritten.push({
          queueItemId: row.queueItem.id,
          organizationName: row.organizationName,
          subject: customized.subject,
        });
      } catch (err) {
        errors.push({
          queueItemId: row.queueItem.id,
          organizationName: row.organizationName,
          error: err instanceof Error ? err.message : "rewrite failed",
        });
      }
    }

    const nextOffset = offset + slice.length;
    return NextResponse.json(
      {
        sentExamplesUsed: sent.length,
        rewritten: rewritten.length,
        skipped: skipped.length,
        errors: errors.length,
        offset,
        nextOffset,
        remaining: Math.max(0, sidebar.length - nextOffset),
        total: sidebar.length,
        done: nextOffset >= sidebar.length,
        samples: rewritten.slice(0, 3),
        skipSamples: skipped.slice(0, 3),
        errorSamples: errors.slice(0, 3),
        sent: false,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Redraft failed") }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sent = await listRecentSentPlainEmails(10);
    return NextResponse.json(
      {
        count: sent.length,
        emails: sent.map((email) => ({
          to: email.to,
          subject: email.subject,
          body: email.body,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Could not load sent mail") }, { status: 500 });
  }
}
