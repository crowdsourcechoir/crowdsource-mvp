import { getOrganization, listOrganizations } from "./db/organizations";
import { listOrganizationTypes } from "./db/lookups";
import { runDiscoveryRun } from "./discovery/run-discovery";
import { fillQueueFromAwaitingContact } from "./pipeline/fill-queue";
import { runPipelineForOrganization } from "./pipeline/run-pipeline";
import { parseFindIntent, similarFocusForOrg, type FindLeadsAction } from "./find-leads";

export type FindLeadsRequest = {
  action?: FindLeadsAction;
  intent?: string;
  organizationId?: string | null;
  organizationName?: string | null;
  roleHint?: string | null;
  count?: number;
  focus?: string | null;
};

export type FindLeadsResult = {
  action: FindLeadsAction;
  message: string;
  organizationId?: string;
  organizationName?: string;
  roleHint?: string | null;
  discovery?: Awaited<ReturnType<typeof runDiscoveryRun>>;
  pipeline?: Awaited<ReturnType<typeof runPipelineForOrganization>>;
  fillQueue?: Awaited<ReturnType<typeof fillQueueFromAwaitingContact>>;
};

function clampCount(n: number | undefined, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 1) return fallback;
  return Math.min(25, Math.floor(n));
}

async function resolveOrganization(input: {
  organizationId?: string | null;
  organizationName?: string | null;
}) {
  if (input.organizationId) {
    const org = await getOrganization(input.organizationId);
    if (org) return org;
  }
  const name = input.organizationName?.trim();
  if (!name) return null;
  const matches = await listOrganizations({ search: name, limit: 8 });
  const exact = matches.find((org) => org.name.toLowerCase() === name.toLowerCase());
  return exact ?? matches[0] ?? null;
}

export async function executeFindLeads(raw: FindLeadsRequest): Promise<FindLeadsResult> {
  const parsed = raw.intent?.trim() ? parseFindIntent(raw.intent) : null;
  const action: FindLeadsAction = raw.action ?? parsed?.action ?? "discover";
  const count = clampCount(raw.count ?? parsed?.count, action === "similar" ? 10 : action === "fill_queue" ? 10 : 15);
  const roleHint = raw.roleHint?.trim() || parsed?.roleHint || null;
  const focus = raw.focus?.trim() || parsed?.focus || null;

  if (action === "fill_queue") {
    const fillQueue = await fillQueueFromAwaitingContact(count);
    return {
      action,
      fillQueue,
      message: `Reprocessed ${fillQueue.attempted} blocked lead${fillQueue.attempted === 1 ? "" : "s"}. New verified contacts land in the send queue.`,
    };
  }

  if (action === "contact") {
    const org = await resolveOrganization({
      organizationId: raw.organizationId,
      organizationName: raw.organizationName ?? parsed?.organizationName,
    });
    if (!org) {
      throw new Error("Pick an organization (search above) so I know whose fan-engagement person to find.");
    }
    const pipeline = await runPipelineForOrganization(org.id, "manual", { contactRoleHint: roleHint });
    return {
      action,
      organizationId: org.id,
      organizationName: org.name,
      roleHint,
      pipeline,
      message:
        pipeline.status === "skipped_existing_client"
          ? `${org.name} is marked as an existing client — skipped.`
          : `Ran pipeline on ${org.name}${roleHint ? ` looking for ${roleHint}` : ""}. Check the send queue.`,
    };
  }

  if (action === "similar") {
    const org = await resolveOrganization({
      organizationId: raw.organizationId,
      organizationName: raw.organizationName ?? parsed?.organizationName,
    });
    if (!org) {
      throw new Error("Pick an organization to copy — search, then ask for 10 more like it.");
    }
    const types = await listOrganizationTypes();
    const typeLabel = types.find((t) => t.id === org.organizationTypeId)?.label ?? null;
    const similarFocus = similarFocusForOrg({
      name: org.name,
      typeLabel,
      city: org.locationCity,
      region: org.locationRegion,
      roleHint,
    });
    const discovery = await runDiscoveryRun("manual", {
      mode: "custom",
      focus: similarFocus,
      maxNewOrganizations: count,
      maxQueries: 6,
    });
    return {
      action,
      organizationId: org.id,
      organizationName: org.name,
      discovery,
      message: discovery.provider
        ? `Looked for orgs like ${org.name}: ${discovery.candidatesNew} new, ${discovery.candidatesDuplicate} already known. Run pipeline on the new ones from Organizations when you want drafts.`
        : "No search provider configured (Tavily/Serper) — discovery was a no-op.",
    };
  }

  const discovery = await runDiscoveryRun("manual", {
    mode: focus ? "custom" : "default",
    focus: focus ?? undefined,
    maxNewOrganizations: count,
    maxQueries: 6,
  });
  return {
    action: "discover",
    discovery,
    message: discovery.provider
      ? `Discovery finished — ${discovery.candidatesNew} new org${discovery.candidatesNew === 1 ? "" : "s"}, ${discovery.candidatesDuplicate} already known.`
      : "No search provider configured (Tavily/Serper) — discovery was a no-op.",
  };
}
