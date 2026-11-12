const LAYERS = [
  {
    id: "participatory",
    label: "Participatory",
    verb: "Co-create",
    line: "Because of you, together.",
    r: 46,
    fill: "rgba(207,255,129,0.12)",
    stroke: "rgba(207,255,129,0.95)",
  },
  {
    id: "interactive",
    label: "Interactive",
    verb: "Influence",
    line: "Responds to you.",
    r: 34.5,
    fill: "rgba(207,255,129,0.08)",
    stroke: "rgba(207,255,129,0.72)",
  },
  {
    id: "immersive",
    label: "Immersive",
    verb: "Enter",
    line: "Around you.",
    r: 23,
    fill: "rgba(207,255,129,0.05)",
    stroke: "rgba(207,255,129,0.5)",
  },
  {
    id: "traditional",
    label: "Traditional",
    verb: "Observe",
    line: "In front of you.",
    r: 12,
    fill: "rgba(207,255,129,0.04)",
    stroke: "rgba(207,255,129,0.38)",
  },
] as const;

/** Nested engagement layers — lime rings with short labels. */
export default function ParticipationLayersGraphic() {
  return (
    <figure
      className="mt-6 grid w-full max-w-4xl items-center gap-6 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-8 lg:mt-2 lg:max-w-none"
      aria-label="Participation layers from traditional to participatory"
    >
      <svg viewBox="0 0 100 100" className="mx-auto h-auto w-full max-w-md drop-shadow-[0_0_28px_rgba(207,255,129,0.16)]" role="img">
        <title>Participation layers</title>
        {LAYERS.map((layer) => (
          <circle
            key={`${layer.id}-ring`}
            cx="50"
            cy="50"
            r={layer.r}
            fill={layer.fill}
            stroke={layer.stroke}
            strokeWidth="0.7"
          />
        ))}
        <circle cx="50" cy="50" r="3.4" fill="#CFFF81" />
      </svg>
      <ol className="space-y-4 sm:space-y-5">
        {LAYERS.map((layer) => (
          <li key={layer.id} className="border-l-2 border-[#CFFF81] pl-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#CFFF81] sm:text-xs">
              {layer.label}
              <span className="text-[#CFFF81]/45"> · </span>
              <span className="text-white">{layer.verb}</span>
            </p>
            <p className="mt-1 text-sm leading-snug text-white/90 sm:text-base">{layer.line}</p>
          </li>
        ))}
      </ol>
    </figure>
  );
}
