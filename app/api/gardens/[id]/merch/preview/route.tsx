import { ImageResponse } from "next/og";
import { resolveMerchPreviewInput } from "@/lib/song-garden-v2/garden/store";
import {
  layerMixLabel,
  merchDecorNodes,
  merchDimensions,
} from "@/lib/song-garden-v2/garden/merch-render";
import { isMerchFormat } from "@/lib/song-garden-v2/garden/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: { id: string } };

/**
 * Deterministic merch art preview (PNG via next/og).
 * Query: format, edition?, living=1, deviceId?, at?, version?
 */
export async function GET(request: Request, context: Ctx) {
  try {
    const { searchParams } = new URL(request.url);
    const formatRaw = searchParams.get("format") || "square_print";
    if (!isMerchFormat(formatRaw)) {
      return new Response("Invalid format", { status: 400 });
    }
    const living = searchParams.get("living") === "1" || searchParams.get("living") === "true";
    const edition = searchParams.get("edition");
    const deviceId = searchParams.get("deviceId");
    const at = searchParams.get("at");
    const versionRaw = searchParams.get("version");
    const version =
      versionRaw != null && versionRaw !== "" && Number.isFinite(Number(versionRaw))
        ? Number(versionRaw)
        : null;

    const { input } = await resolveMerchPreviewInput({
      gardenIdOrSlug: context.params.id,
      format: formatRaw,
      editionIdOrSlug: edition,
      living,
      deviceId,
      at,
      version,
    });

    const { width, height } = merchDimensions(input.format);
    const nodes = merchDecorNodes(input, input.format === "hoodie_allover" ? 36 : 24);
    const accent = input.brand.accentColor || "#CFFF81";
    const primary = input.brand.primaryColor || "#1a0f2d";
    const energyPct = Math.round(Math.max(0, Math.min(1, input.state.energy)) * 100);
    const landmarks = input.state.landmarks.slice(-3);
    const mix = layerMixLabel(input.state.layers);
    const uniqueTag = input.personal
      ? `one-of-one · ${input.personal.count} marks`
      : edition && !living
        ? `edition`
        : "living world";

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: `linear-gradient(160deg, ${primary} 0%, #0a0810 55%, ${primary} 100%)`,
            color: "white",
            fontFamily: "Georgia, serif",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              opacity: 0.35 + input.state.energy * 0.45,
            }}
          >
            {nodes.map((n, i) => (
              <div
                key={`${n.kind}-${i}`}
                style={{
                  position: "absolute",
                  left: `${n.x * 100}%`,
                  top: `${n.y * 100}%`,
                  width: Math.max(8, n.r * width),
                  height: Math.max(8, n.r * width),
                  marginLeft: -Math.max(4, (n.r * width) / 2),
                  marginTop: -Math.max(4, (n.r * width) / 2),
                  borderRadius: n.kind === "percussion" ? "20%" : "50%",
                  background: accent,
                  boxShadow: `0 0 ${10 + energyPct / 8}px ${accent}`,
                }}
              />
            ))}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: input.format === "hoodie_front" ? "64px 56px" : "48px",
              height: "100%",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  fontSize: 18,
                  letterSpacing: 6,
                  textTransform: "uppercase",
                  color: accent,
                  fontFamily: "monospace",
                }}
              >
                Song Garden
              </div>
              <div style={{ fontSize: input.format === "square_print" ? 48 : 56, lineHeight: 1.1 }}>
                {input.brand.title}
              </div>
              <div style={{ fontSize: 20, color: "rgba(255,255,255,0.7)" }}>{uniqueTag}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 22, color: accent }}>energy {energyPct}%</div>
              <div style={{ fontSize: 18, color: "rgba(255,255,255,0.75)" }}>{mix}</div>
              {landmarks.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                  {landmarks.map((lm) => (
                    <div key={lm.key} style={{ fontSize: 16, color: "rgba(255,255,255,0.65)" }}>
                      · {lm.label}
                    </div>
                  ))}
                </div>
              ) : null}
              <div
                style={{
                  marginTop: 16,
                  fontSize: 14,
                  fontFamily: "monospace",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                {input.state.renderSeed.slice(0, 42)}
                {input.state.version != null ? ` · v${input.state.version}` : ""}
              </div>
            </div>
          </div>
        </div>
      ),
      { width, height }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preview failed";
    const status = /not found/i.test(message) ? 404 : 500;
    return new Response(message, { status });
  }
}
