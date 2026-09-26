import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { getDefaultDesignSystem } from "@/lib/marketing/db/design";
import { applyEmailTemplate, createEmailTemplate, listEmailTemplates } from "@/lib/marketing/db/templates";
import type { EmailSection } from "@/lib/marketing/document/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return withMarketingAuth(async () => {
    const templates = await listEmailTemplates();
    return NextResponse.json({ templates });
  });
}

export async function POST(request: Request) {
  return withMarketingAuth(async () => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    if (body.action === "apply") {
      const templateId = typeof body.templateId === "string" ? body.templateId : "";
      const campaignId = typeof body.campaignId === "string" ? body.campaignId : "";
      if (!templateId || !campaignId) return NextResponse.json({ error: "templateId and campaignId required" }, { status: 400 });
      const document = await applyEmailTemplate(templateId, campaignId);
      if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ document });
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
    if (!Array.isArray(body.sections)) return NextResponse.json({ error: "sections required" }, { status: 400 });
    const design = await getDefaultDesignSystem();
    const designSystemId = typeof body.designSystemId === "string" && body.designSystemId ? body.designSystemId : design.id;
    const template = await createEmailTemplate({
      name,
      description: typeof body.description === "string" ? body.description : "",
      sections: body.sections as EmailSection[],
      designSystemId,
    });
    return NextResponse.json({ template });
  });
}
