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

export async function PATCH(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const body = await request.json();
    if (typeof body?.isExistingClient !== "boolean") {
      return NextResponse.json({ error: "isExistingClient (boolean) is required" }, { status: 400 });
    }
    const organization = await updateOrganization(orgId, { isExistingClient: body.isExistingClient });
    return NextResponse.json({ organization });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
