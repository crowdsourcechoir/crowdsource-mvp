type Layer = {
  id: string;
  label: string;
  verb: string;
  line: string;
  outer: number;
  inner: number;
  fill: string;
  stroke: string;
};

/**
 * Nested lime spheres. Copy is straight and centered in each crescent —
 * the same nesting as the source graphic, without text crossing ring strokes.
 */
const LAYERS: Layer[] = [
  {
    id: "participatory",
    label: "Participatory",
    verb: "Co-create",
    line: "Because of you, together.",
    outer: 48,
    inner: 33.5,
    fill: "rgba(207,255,129,0.16)",
    stroke: "rgba(207,255,129,0.95)",
  },
  {
    id: "interactive",
    label: "Interactive",
    verb: "Influence",
    line: "Responds to you.",
    outer: 33.5,
    inner: 20.5,
    fill: "rgba(207,255,129,0.12)",
    stroke: "rgba(207,255,129,0.78)",
  },
  {
    id: "immersive",
    label: "Immersive",
    verb: "Enter",
    line: "Around you.",
    outer: 20.5,
    inner: 11,
    fill: "rgba(207,255,129,0.09)",
    stroke: "rgba(207,255,129,0.58)",
  },
  {
    id: "traditional",
    label: "Traditional",
    verb: "Observe",
    line: "In front of you.",
    outer: 11,
    inner: 0,
    fill: "rgba(207,255,129,0.11)",
    stroke: "rgba(207,255,129,0.5)",
  },
];

const CX = 50;
const CY = 50;
const EDGE = 2;

function layout(layer: Layer) {
  const core = layer.inner <= 0;
  const band = core ? layer.outer * 2 : layer.outer - layer.inner;
  const yTop = core ? CY - layer.outer + EDGE * 1.2 : CY - layer.outer + EDGE;
  const yBot = core ? CY + layer.outer - EDGE * 1.2 : CY - layer.inner - EDGE;
  const room = Math.max(yBot - yTop, 3.5);

  const yMid = (yTop + yBot) / 2;
  const dy = Math.min(Math.abs(CY - yMid), layer.outer - 0.5);
  const chord = 2 * Math.sqrt(Math.max(layer.outer * layer.outer - dy * dy, 1));
  const width = Math.max(chord - EDGE * 3, 6);

  // Always stack label / verb so copy stays inside the crescent width.
  const titleChars = Math.max(layer.label.length, layer.verb.length);
  const titleSize = Math.min(room * 0.2, width / (titleChars * 0.7), core ? 2.1 : 2.2);
  const lineSize = Math.min(room * 0.14, width / (layer.line.length * 0.55), titleSize * 0.78);

  const block = titleSize * 2.2 + lineSize * 1.2;
  const startY = yTop + (room - block) / 2 + titleSize * 0.92;

  return { startY, titleSize, lineSize, yTop, yBot };
}

/** Nested lime rings with each label clipped into its crescent. */
export default function ParticipationLayersGraphic() {
  return (
    <figure
      className="mx-auto mt-4 w-full max-w-xl lg:mt-0 lg:max-w-none"
      aria-label="Participation layers from traditional to participatory"
    >
      <svg
        viewBox="0 0 100 100"
        className="h-auto w-full drop-shadow-[0_0_34px_rgba(207,255,129,0.2)]"
        role="img"
      >
        <title>Participation layers</title>
        <defs>
          <radialGradient id="lime-core" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="rgba(207,255,129,0.3)" />
            <stop offset="55%" stopColor="rgba(207,255,129,0.05)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          {LAYERS.map((layer) => (
            <mask
              key={`mask-${layer.id}`}
              id={`mask-${layer.id}`}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="100"
              height="100"
            >
              <rect width="100" height="100" fill="black" />
              <circle cx={CX} cy={CY} r={Math.max(layer.outer - EDGE, 0.5)} fill="white" />
              {layer.inner > 0 ? <circle cx={CX} cy={CY} r={layer.inner + EDGE} fill="black" /> : null}
            </mask>
          ))}
        </defs>

        <circle cx={CX} cy={CY} r="49.2" fill="url(#lime-core)" />

        {LAYERS.map((layer) => (
          <circle key={`fill-${layer.id}`} cx={CX} cy={CY} r={layer.outer} fill={layer.fill} />
        ))}

        {LAYERS.map((layer) => (
          <circle
            key={`stroke-${layer.id}`}
            cx={CX}
            cy={CY}
            r={layer.outer}
            fill="none"
            stroke={layer.stroke}
            strokeWidth="1"
          />
        ))}

        {LAYERS.map((layer) => {
          const { startY, titleSize, lineSize } = layout(layer);
          return (
            <g key={`copy-${layer.id}`} mask={`url(#mask-${layer.id})`}>
              <text
                x={CX}
                y={startY}
                textAnchor="middle"
                fill="#CFFF81"
                fontSize={titleSize}
                fontWeight="700"
                letterSpacing="0.04em"
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              >
                {layer.label.toUpperCase()}
              </text>
              <text
                x={CX}
                y={startY + titleSize * 1.15}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize={titleSize}
                fontWeight="700"
                letterSpacing="0.04em"
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              >
                {layer.verb.toUpperCase()}
              </text>
              <text
                x={CX}
                y={startY + titleSize * 2.35}
                textAnchor="middle"
                fill="rgba(255,255,255,0.92)"
                fontSize={lineSize}
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              >
                {layer.line}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
