import { NextResponse } from "next/server";
import { readAutoSendState } from "@/lib/sales/autosend/store";
import { buildAutoSendQueueView } from "@/lib/sales/autosend/view";
import {
  dismissAutoSendSlot,
  refreshAutoSendPlan,
  setAutoSendEnabled,
  tickAutoSend,
} from "@/lib/sales/autosend/tick";
import { fillQueueFromAwaitingContact } from "@/lib/sales/pipeline/fill-queue";
import { runPipelineBatch } from "@/lib/sales/pipeline/run-pipeline-batch";
import { drainAnthemPricing } from "@/lib/sales/pricing/evaluate";
import { seedNationalKeynoteTargets } from "@/lib/sales/prospecting/seed-national-targets";
import {
  getKey2027ProspectsSeedStatus,
  seedKey2027Prospects,
} from "@/lib/sales/seed/seed-key-2027-prospects";
import { ensureBookLinks } from "@/lib/sales/outreach/ensureBookLinks";
import { updateDraftEdits } from "@/lib/sales/db/outreach";
import { getQueueItem } from "@/lib/sales/db/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REFRESH_AFTER_MS = 2 * 60 * 1000;
let linksEnsuredInInstance = false;

export async function GET() {
  try {
    if (!linksEnsuredInInstance) {
      linksEnsuredInInstance = true;
      await ensureBookLinks().catch(() => null);
    }
    const seedStatus = await getKey2027ProspectsSeedStatus().catch(() => ({ done: true }));
    if (!seedStatus.done) {
      await seedKey2027Prospects().catch(() => null);
    }
    const current = await readAutoSendState();
    const age = current.state.updatedAt ? Date.now() - Date.parse(current.state.updatedAt) : Number.POSITIVE_INFINITY;
    const loaded = !seedStatus.done || current.error || age > REFRESH_AFTER_MS ? await refreshAutoSendPlan() : current;
    const view = await buildAutoSendQueueView(loaded.state, loaded.error);
    return NextResponse.json(view);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      enabled?: boolean;
      queueItemId?: string;
      day?: string;
      maxToDraft?: number;
      batchLimit?: number;
      editedSubject?: string;
      editedBody?: string;
    };

    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "dismiss") {
      const queueItemId = typeof body?.queueItemId === "string" ? body.queueItemId.trim() : "";
      if (!queueItemId) {
        return NextResponse.json({ error: "queueItemId is required." }, { status: 400 });
      }
      const dismissed = await dismissAutoSendSlot({
        queueItemId,
        day: typeof body?.day === "string" ? body.day : null,
      });
      if (dismissed.error) return NextResponse.json({ error: dismissed.error }, { status: 503 });
      const view = await buildAutoSendQueueView(dismissed.state, null);
      return NextResponse.json({ ...view, deletedGmailDraft: dismissed.deletedGmailDraft });
    }

    if (action === "save_draft") {
      const queueItemId = typeof body?.queueItemId === "string" ? body.queueItemId.trim() : "";
      const editedSubject = typeof body?.editedSubject === "string" ? body.editedSubject : null;
      const editedBody = typeof body?.editedBody === "string" ? body.editedBody : null;
      if (!queueItemId || editedSubject === null || editedBody === null) {
        return NextResponse.json({ error: "queueItemId, editedSubject, and editedBody are required." }, { status: 400 });
      }
      const item = await getQueueItem(queueItemId);
      if (!item?.outreachDraftId) {
        return NextResponse.json({ error: "Draft not found for this slot." }, { status: 404 });
      }
      await updateDraftEdits(item.outreachDraftId, { editedSubject, editedBody });
      const refreshed = await refreshAutoSendPlan();
      const view = await buildAutoSendQueueView(refreshed.state, refreshed.error);
      return NextResponse.json(view);
    }

    if (action === "draft_now") {
      const maxToDraft = typeof body?.maxToDraft === "number" ? body.maxToDraft : 12;
      const tick = await tickAutoSend(new Date(), { maxToDraft, forceWhenPaused: false });
      const latest = await readAutoSendState();
      const view = await buildAutoSendQueueView(latest.state, tick.error ?? latest.error);
      return NextResponse.json({ ...view, tick });
    }

    if (action === "load_more") {
      const batchLimit = Math.max(1, Math.min(8, typeof body?.batchLimit === "number" ? body.batchLimit : 4));
      const key2027 = await seedKey2027Prospects().catch(() => null);
      await seedNationalKeynoteTargets({ runPipeline: false }).catch(() => null);
      const batch = await runPipelineBatch(batchLimit);
      let awaiting = null;
      if (batch.attempted < batchLimit) {
        awaiting = await fillQueueFromAwaitingContact(Math.max(1, batchLimit - batch.attempted)).catch(() => null);
      }
      await drainAnthemPricing({ limit: 50, budgetMs: 20_000 }).catch(() => null);
      const tick = await tickAutoSend(new Date(), { maxToDraft: 8, forceWhenPaused: false });
      const latest = await readAutoSendState();
      const view = await buildAutoSendQueueView(latest.state, tick.error ?? latest.error);
      return NextResponse.json({
        ...view,
        loadedSummary: {
          newSeededOrgs: key2027?.createdOrgs ?? 0,
          pipelineAttempted: batch.attempted,
          pipelineSucceeded: batch.succeeded + batch.partiallyFailed,
          awaitingQueued: awaiting?.queuedOrAdvanced ?? 0,
          draftedToGmail: tick.drafted,
        },
      });
    }

    if (action === "refresh") {
      await drainAnthemPricing({ limit: 80, budgetMs: 15_000 }).catch(() => null);
      const refreshed = await refreshAutoSendPlan();
      const view = await buildAutoSendQueueView(refreshed.state, refreshed.error);
      return NextResponse.json(view);
    }

    if (typeof body?.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be true or false." }, { status: 400 });
    }
    const { state, error } = await setAutoSendEnabled(body.enabled);
    if (error) return NextResponse.json({ error }, { status: 503 });
    const view = await buildAutoSendQueueView(state, null);
    return NextResponse.json(view);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
