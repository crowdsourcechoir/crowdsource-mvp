import { NextResponse } from "next/server";
import {
  createStubOrder,
  getGardenByIdOrSlug,
  getOrder,
  listOrders,
} from "@/lib/song-garden-v2/garden/store";
import { isMerchFormat, type GardenOrderKind } from "@/lib/song-garden-v2/garden/types";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type Ctx = { params: { id: string } };

export async function GET(request: Request, context: Ctx) {
  try {
    const garden = await getGardenByIdOrSlug(context.params.id);
    if (!garden) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    if (orderId) {
      const order = await getOrder(orderId);
      if (!order || order.gardenId !== garden.id) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      return NextResponse.json({ order }, NO_STORE);
    }
    const orders = await listOrders(garden.id);
    return NextResponse.json({ orders }, NO_STORE);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Stub checkout — freezes ordered snapshot blob for later print fulfillment. */
export async function POST(request: Request, context: Ctx) {
  try {
    const body = (await request.json()) as {
      kind?: GardenOrderKind;
      format?: string;
      editionIdOrSlug?: string | null;
      deviceId?: string | null;
      note?: string | null;
    };
    const kind: GardenOrderKind = body.kind === "edition" ? "edition" : "living";
    if (!isMerchFormat(body.format)) {
      return NextResponse.json(
        { error: "format must be hoodie_front | hoodie_allover | square_print" },
        { status: 400 }
      );
    }
    const deviceId =
      typeof body.deviceId === "string" && /^dev_[a-zA-Z0-9_-]{8,64}$/.test(body.deviceId.trim())
        ? body.deviceId.trim()
        : null;

    const order = await createStubOrder({
      gardenIdOrSlug: context.params.id,
      kind,
      format: body.format,
      editionIdOrSlug: body.editionIdOrSlug,
      deviceId,
      note: body.note,
    });
    return NextResponse.json({ order }, { status: 201, ...NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = /not found/i.test(message) ? 404 : /required/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
