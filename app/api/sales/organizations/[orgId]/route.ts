import { NextResponse } from "next/server";
import { getOrganization, updateOrganization } from "@/lib/sales/db/organizations";
import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { listOpportunitiesForOrganization } from "@/lib/sales/db/opportunities";
import { listPipelineRunsForOrganization, listAgentRuns } from "@/lib/sales/db/pipeline";
import { listFindingsForOrganization, getSource } from "@/lib/sales/db/research";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const organization = await getOrganization(orgId);
    if (!organization) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [contacts, opportunities, pipelineRuns, findings] = await Promise.all([
      listContactsForOrganization(orgId),
      listOpportunitiesForOrganization(orgId),
      listPipelineRunsForOrganization(orgId),
      listFindingsForOrganization(orgId),
    ]);

    const agentRunsByPipeline = await Promise.all(pipelineRuns.map((run) => listAgentRuns(run.id)));
    const pipelineRunsWithStages = pipelineRuns.map((run, i) => ({ ...run, agentRuns: agentRunsByPipeline[i] }));

    const sourceIds = Array.from(new Set(findings.map((f) => f.sourceId)));
    const sources = await Promise.all(sourceIds.map((id) => getSource(id)));
    const sourceUrlById = new Map(sources.filter(Boolean).map((s) => [s!.id, s!.url]));
    const findingsWithUrl = findings.map((f) => ({ ...f, sourceUrl: sourceUrlById.get(f.sourceId) ?? "" }));

    return NextResponse.json(
      { organization, contacts, opportunities, pipelineRuns: pipelineRunsWithStages, findings: findingsWithUrl },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const existing = await getOrganization(orgId);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const patch: Parameters<typeof updateOrganization>[1] = {};

    const name = optionalString(body?.name);
    if (name !== undefined) {
      if (!name) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
      patch.name = name;
    }

    const websiteUrl = optionalString(body?.websiteUrl);
    if (websiteUrl !== undefined) patch.websiteUrl = websiteUrl;

    const locationCity = optionalString(body?.locationCity);
    if (locationCity !== undefined) patch.locationCity = locationCity;

    const locationRegion = optionalString(body?.locationRegion);
    if (locationRegion !== undefined) patch.locationRegion = locationRegion;

    const locationCountry = optionalString(body?.locationCountry);
    if (locationCountry !== undefined) patch.locationCountry = locationCountry;

    if (typeof body?.isExistingClient === "boolean") {
      patch.isExistingClient = body.isExistingClient;
    }

    const operatorNotes = optionalString(body?.operatorNotes);
    if (operatorNotes !== undefined) {
      patch.importMetadata = {
        ...(existing.importMetadata ?? {}),
        operatorNotes: operatorNotes ?? null,
        operatorNotesUpdatedAt: new Date().toISOString(),
      };
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Provide at least one of: name, websiteUrl, locationCity, locationRegion, locationCountry, isExistingClient, operatorNotes" },
        { status: 400 }
      );
    }

    const organization = await updateOrganization(orgId, patch);
    return NextResponse.json({ organization });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
