import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { AMPLIFY_CONFERENCES_2027_SEEDS } from "@/lib/sales/seed/amplify-conferences-2027";
import { BOOKING_AGENTS_SEEDS } from "@/lib/sales/seed/booking-agents";
import { ENTERTAINMENT_BOOKING_AGENCIES_SEEDS } from "@/lib/sales/seed/entertainment-booking-agencies";
import { ELEVATE_VIBE_CREATE_PROSPECTS } from "@/lib/sales/seed/elevate-vibe-create-prospects";
import { SEATTLE_FUNDRAISERS_2027_SEEDS } from "@/lib/sales/seed/seattle-fundraisers-2027";
import { seedAmplifyConferences2027 } from "@/lib/sales/seed/seed-amplify-conferences-2027";
import { seedBallardFcConversation } from "@/lib/sales/seed/ballard-fc-conversation";
import { seedBookingAgents } from "@/lib/sales/seed/seed-booking-agents";
import { seedEntertainmentBookingAgencies } from "@/lib/sales/seed/seed-entertainment-booking-agencies";
import { seedElevateVibeCreateProspects } from "@/lib/sales/seed/seed-elevate-vibe-create-prospects";
import { RESEND_FORWARD_SEED, seedResendForward } from "@/lib/sales/seed/resend-forward";
import { seedSeattleFundraisers2027 } from "@/lib/sales/seed/seed-seattle-fundraisers-2027";
import { WFEA_MEMBERS } from "@/lib/sales/seed/wfea-members";
import { seedWfeaMembers } from "@/lib/sales/seed/seed-wfea-members";
import {
  SEAHAWKS_SEED,
  seedOrgWithContacts,
  type SeedOrgWithContactsInput,
} from "@/lib/sales/seed/seed-org-with-contacts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Upsert org + contacts (verified-format emails) and run pipeline into the approval queue.
 *
 * Body: full SeedOrgWithContactsInput, `{ preset: "seahawks" }`, `{ preset: "amplify-2027" }`,
 * `{ preset: "elevate-vibe-create" }`, `{ preset: "seattle-fundraisers-2027" }`,
 * `{ preset: "ballard-fc" }`, `{ preset: "resend-forward" }`, `{ preset: "wfea-members" }`,
 * `{ preset: "booking-agents" }`, or `{ preset: "entertainment-booking-agencies" }`.
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
      force?: boolean;
    };

    if (body?.preset === "amplify-2027") {
      const result = await seedAmplifyConferences2027({ force: Boolean(body.force) });
      return NextResponse.json({
        preset: "amplify-2027",
        seedCount: AMPLIFY_CONFERENCES_2027_SEEDS.length,
        ...result,
      });
    }

    if (body?.preset === "elevate-vibe-create") {
      const result = await seedElevateVibeCreateProspects({ force: Boolean(body.force) });
      return NextResponse.json({
        preset: "elevate-vibe-create",
        seedCount: ELEVATE_VIBE_CREATE_PROSPECTS.length,
        ...result,
      });
    }

    if (body?.preset === "seattle-fundraisers-2027") {
      const result = await seedSeattleFundraisers2027({ force: Boolean(body.force) });
      return NextResponse.json({
        preset: "seattle-fundraisers-2027",
        seedCount: SEATTLE_FUNDRAISERS_2027_SEEDS.length,
        ...result,
      });
    }

    if (body?.preset === "ballard-fc") {
      const result = await seedBallardFcConversation({ force: Boolean(body.force) });
      return NextResponse.json({
        preset: "ballard-fc",
        ...result,
      });
    }

    if (body?.preset === "resend-forward") {
      const result = await seedResendForward({ force: Boolean(body.force) });
      return NextResponse.json({
        preset: "resend-forward",
        seedCount: 1,
        seed: RESEND_FORWARD_SEED.name,
        ...result,
      });
    }

    if (body?.preset === "wfea-members") {
      const result = await seedWfeaMembers({ force: Boolean(body.force) });
      return NextResponse.json({
        preset: "wfea-members",
        seedCount: WFEA_MEMBERS.length,
        ...result,
      });
    }

    if (body?.preset === "booking-agents") {
      const result = await seedBookingAgents({ force: Boolean(body.force) });
      return NextResponse.json({
        preset: "booking-agents",
        seedCount: BOOKING_AGENTS_SEEDS.length,
        ...result,
      });
    }

    if (body?.preset === "entertainment-booking-agencies") {
      const result = await seedEntertainmentBookingAgencies({ force: Boolean(body.force) });
      return NextResponse.json({
        preset: "entertainment-booking-agencies",
        seedCount: ENTERTAINMENT_BOOKING_AGENCIES_SEEDS.length,
        ...result,
      });
    }

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
        : body;

    if (!input?.name || !input?.websiteUrl || !Array.isArray(input.contacts)) {
      return NextResponse.json(
        {
          error:
            "Provide { preset: 'seahawks' }, { preset: 'amplify-2027' }, { preset: 'elevate-vibe-create' }, { preset: 'seattle-fundraisers-2027' }, { preset: 'ballard-fc' }, { preset: 'resend-forward' }, { preset: 'wfea-members' }, { preset: 'booking-agents' }, { preset: 'entertainment-booking-agencies' }, or { name, websiteUrl, contacts[] }",
        },
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
