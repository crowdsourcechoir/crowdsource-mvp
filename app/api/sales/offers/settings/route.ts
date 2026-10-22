import { NextResponse } from "next/server";
import { resolveSalesOffersSettings } from "@/lib/sales/offers/settings";
import { writeWorkspaceSettings } from "@/lib/settings/store";

export const dynamic = "force-dynamic";

function coerceOptionalAmount(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
    throw new Error("Package amounts must be between 0 and 1,000,000");
  }
  return Math.round(n * 100) / 100;
}

export async function GET() {
  try {
    const resolved = await resolveSalesOffersSettings();
    return NextResponse.json(resolved);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load offers settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const patch: {
      anthemExperienceAmount?: number | null;
      partnershipMonthlyAmount?: number | null;
      songGardenAmount?: number | null;
    } = {};

    if ("anthemExperienceAmount" in body) {
      patch.anthemExperienceAmount = coerceOptionalAmount(body.anthemExperienceAmount);
    }
    if ("partnershipMonthlyAmount" in body) {
      patch.partnershipMonthlyAmount = coerceOptionalAmount(body.partnershipMonthlyAmount);
    }
    if ("songGardenAmount" in body) {
      patch.songGardenAmount = coerceOptionalAmount(body.songGardenAmount);
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No salesOffers fields to update" }, { status: 400 });
    }

    const written = await writeWorkspaceSettings({ salesOffers: patch });
    if (written.error && !written.persisted) {
      return NextResponse.json({ error: written.error }, { status: 500 });
    }

    const resolved = await resolveSalesOffersSettings();
    return NextResponse.json(resolved);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save offers settings" },
      { status: 500 }
    );
  }
}
