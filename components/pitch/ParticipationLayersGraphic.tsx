const LAYERS = [
  {
    id: "participatory",
    label: "Participatory",
    verb: "Co-create",
    line: "Because of you, together.",
    r: 47,
    fill: "rgba(207,255,129,0.16)",
    stroke: "rgba(207,255,129,0.95)",
    y: 14,
    titleSize: 3.2,
    lineSize: 2.55,
  },
  {
    id: "interactive",
    label: "Interactive",
    verb: "Influence",
    line: "Responds to you.",
    r: 36,
    fill: "rgba(207,255,129,0.11)",
    stroke: "rgba(207,255,129,0.78)",
    y: 28.5,
    titleSize: 2.95,
    lineSize: 2.4,
  },
  {
    id: "immersive",
    label: "Immersive",
    verb: "Enter",
    line: "Around you.",
    r: 25.5,
    fill: "rgba(207,255,129,0.08)",
    stroke: "rgba(207,255,129,0.58)",
    y: 42,
    titleSize: 2.7,
    lineSize: 2.25,
  },
  {
    id: "traditional",
    label: "Traditional",
    verb: "Observe",
    line: "In front of you.",
    r: 16.5,
    fill: "rgba(207,255,129,0.08)",
    stroke: "rgba(207,255,129,0.48)",
    y: 51.2,
    titleSize: 2.2,
    lineSize: 1.9,
    stackTitle: true,
  },
] as const;

/** Nested lime rings with each layer’s copy inside the graphic. */
export default function ParticipationLayersGraphic() {
  return (
    <figure
      className="mx-auto mt-4 w-full max-w-xl lg:mt-0 lg:max-w-none"
      aria-label="Participation layers from traditional to participatory"
    >
      <svg
        viewBox="0 0 100 100"
        className="h-auto w-full drop-shadow-[0_0_34px_rgba(207,255,129,0.22)]"
        role="img"
      >
        <title>Participation layers</title>
        <defs>
          <filter id="lime-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.05" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="lime-core" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="rgba(207,255,129,0.3)" />
            <stop offset="50%" stopColor="rgba(207,255,129,0.07)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        <circle cx="50" cy="50" r="49.2" fill="url(#lime-core)" />

        {LAYERS.map((layer) => (
          <circle
            key={`${layer.id}-ring`}
            cx="50"
            cy="50"
            r={layer.r}
            fill={layer.fill}
            stroke={layer.stroke}
            strokeWidth="1"
            filter="url(#lime-glow)"
          />
        ))}

        {LAYERS.map((layer) => {
          const stacked = "stackTitle" in layer && layer.stackTitle;
          return (
            <g key={`${layer.id}-copy`}>
              {stacked ? (
                <>
                  <text
                    x="50"
                    y={layer.y}
                    textAnchor="middle"
                    fill="#CFFF81"
                    fontSize={layer.titleSize}
                    fontWeight="700"
                    letterSpacing="0.08em"
                    style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                  >
                    {layer.label.toUpperCase()}
                  </text>
                  <text
                    x="50"
                    y={layer.y + layer.titleSize * 1.15}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize={layer.titleSize}
                    fontWeight="700"
                    letterSpacing="0.08em"
                    style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                  >
                    {layer.verb.toUpperCase()}
                  </text>
                  <text
                    x="50"
                    y={layer.y + layer.titleSize * 2.35}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.92)"
                    fontSize={layer.lineSize}
                    style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                  >
                    {layer.line}
                  </text>
                </>
              ) : (
                <>
                  <text
                    x="50"
                    y={layer.y}
                    textAnchor="middle"
                    fill="#CFFF81"
                    fontSize={layer.titleSize}
                    fontWeight="700"
                    letterSpacing="0.08em"
                    style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                  >
                    {layer.label.toUpperCase()}
                    <tspan fill="rgba(207,255,129,0.45)"> · </tspan>
                    <tspan fill="#FFFFFF">{layer.verb.toUpperCase()}</tspan>
                  </text>
                  <text
                    x="50"
                    y={layer.y + layer.titleSize * 1.3}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.92)"
                    fontSize={layer.lineSize}
                    style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                  >
                    {layer.line}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
