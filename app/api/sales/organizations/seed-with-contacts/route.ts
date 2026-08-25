import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import {
  LEARFIELD_SEED,
  SEAHAWKS_SEED,
  seedOrgWithContacts,
  type SeedOrgWithContactsInput,
} from "@/lib/sales/seed/seed-org-with-contacts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Upsert org + contacts (verified-format emails) and run pipeline into the approval queue.
 *
 * Body: full SeedOrgWithContactsInput, or `{ preset: "seahawks" | "learfield" }`.
 */
export async function POST(request: Request) {
  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Database not configured." }, { status: 503 });
  }

  try {
    const body = (await request.json()) as SeedOrgWithContactsInput & {
      preset?: string;
      remintTyler?: boolean;
    };
    const input: SeedOrgWithContactsInput =
      body?.preset === "seahawks"
        ? {
            ...SEAHAWKS_SEED,
            runPipeline: body.runPipeline !== false,
            forceManualQueue: Boolean(body.forceManualQueue),
            reopenDecided: Boolean(body.reopenDecided),
            remintApprovedEmails: Array.isArray(body.remintApprovedEmails)
              ? body.remintApprovedEmails
              : body.remintTyler
                ? ["tylerc@seahawks.com"]
                : undefined,
            manualQueueTitle: body.manualQueueTitle,
            manualQueueDescription: body.manualQueueDescription,
            manualEventName: body.manualEventName,
          }
        : body?.preset === "learfield"
          ? {
              ...LEARFIELD_SEED,
              runPipeline: body.runPipeline !== false,
              forceManualQueue: body.forceManualQueue !== false,
              reopenDecided: Boolean(body.reopenDecided),
            }
          : body;

    if (!input?.name || !input?.websiteUrl || !Array.isArray(input.contacts)) {
      return NextResponse.json(
        { error: "Provide { preset: 'seahawks' | 'learfield' } or { name, websiteUrl, contacts[] }" },
        { status: 400 }
      );
    }

    const result = await seedOrgWithContacts(input);
    const stages = result.pipeline?.stagesRun ?? [];
    const queueStage = stages.find((s) => s.stage === "queue");

    return NextResponse.json({
      organizationId: result.organization.id,
      organizationName: result.organization.name,
      created: result.created,
      contactsCreated: result.contactsCreated,
      contactsUpdated: result.contactsUpdated,
      contactCount: result.contacts.length,
      contacts: result.contacts.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        roleTitle: c.roleTitle,
        email: c.email,
        emailVerificationStatus: c.emailVerificationStatus,
      })),
      pipeline: result.pipeline
        ? {
            status: result.pipeline.status,
            opportunityIds: result.pipeline.opportunityIds,
            queueStage,
            stagesRun: result.pipeline.stagesRun,
          }
        : null,
      manualEnqueue: result.manualEnqueue,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
