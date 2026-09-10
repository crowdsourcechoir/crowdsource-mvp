import { getQueueItemByOpportunity } from "../db/queue";
import { getDraft, updateDraftEdits } from "../db/outreach";
import { coalesceDraftBody, coalesceDraftSubject } from "../outreach/email-body-format";
import { markPitchShared, pitchShareUrl } from "./service";
import type { SalesPitch } from "./types";

/**
 * Insert the protected pitch URL into the opportunity's pending queue draft body.
 * Does not send mail — Joel still approves in the queue.
 */
export async function attachPitchLinkToQueueDraft(
  pitch: SalesPitch
): Promise<{ ok: true; queueItemId: string; shareUrl: string } | { ok: false; error: string }> {
  const item = await getQueueItemByOpportunity(pitch.opportunityId);
  if (!item) {
    return { ok: false, error: "No queue item for this opportunity yet. Generate or open the draft in the queue first." };
  }
  if (!item.outreachDraftId) {
    return { ok: false, error: "Queue item has no outreach draft." };
  }
  const draft = await getDraft(item.outreachDraftId);
  if (!draft) return { ok: false, error: "Draft not found." };

  const shareUrl = pitchShareUrl(pitch);
  const subject = coalesceDraftSubject(draft.editedSubject, draft.aiSubject);
  let body = coalesceDraftBody(draft.editedBody, draft.aiBody);
  const marker = "I've put together a short pitch for you here:";
  if (!body.includes(shareUrl)) {
    const block = `\n\n${marker}\n${shareUrl}\n`;
    if (body.includes("I've included a bit more about the experience here:")) {
      body = `${body.trimEnd()}${block}`;
    } else {
      body = `${body.trimEnd()}${block}`;
    }
  }

  await updateDraftEdits(item.outreachDraftId, {
    editedSubject: subject,
    editedBody: body,
  });
  await markPitchShared(pitch.id);
  return { ok: true, queueItemId: item.id, shareUrl };
}
