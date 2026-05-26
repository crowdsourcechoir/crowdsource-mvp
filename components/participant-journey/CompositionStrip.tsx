"use client";

import type { BeatSlotId, ChoirSlotId, GardenSlotId } from "@/lib/songgarden/garden-slots";

type CompositionStripProps = {
  doneSlots: Set<GardenSlotId>;
  activeSlotId?: GardenSlotId | null;
  beatSlotIds: BeatSlotId[];
  choirSlotIds: ChoirSlotId[];
};

function LayerRow({
  label,
  slotIds,
  doneSlots,
  activeSlotId,
}: {
  label: string;
  slotIds: GardenSlotId[];
  doneSlots: Set<GardenSlotId>;
  activeSlotId?: GardenSlotId | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-11 shrink-0 text-left text-[10px] font-medium tracking-[0.12em] text-[var(--crowdsource-accent)]">
        {label}
      </span>
      <div className="flex flex-1 gap-1.5">
        {slotIds.map((id) => {
          const done = doneSlots.has(id);
          const active = activeSlotId === id;
          return (
            <span
              key={id}
              className={`h-2 flex-1 rounded-sm transition-all duration-300 ${
                done
                  ? "bg-[var(--crowdsource-accent)] shadow-[0_0_8px_rgba(207,255,129,0.45)]"
                  : active
                    ? "animate-pulse bg-[var(--crowdsource-accent)]/50 ring-1 ring-[var(--crowdsource-accent)]"
                    : "bg-white/10"
              }`}
              title={id}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function CompositionStrip({
  doneSlots,
  activeSlotId,
  beatSlotIds,
  choirSlotIds,
}: CompositionStripProps) {
  const hasAny = doneSlots.size > 0 || activeSlotId;

  if (!hasAny && !activeSlotId) {
    return (
      <div className="space-y-1.5 opacity-40">
        <LayerRow label="BEAT" slotIds={beatSlotIds} doneSlots={doneSlots} />
        <LayerRow label="VOICE" slotIds={choirSlotIds} doneSlots={doneSlots} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <LayerRow label="BEAT" slotIds={beatSlotIds} doneSlots={doneSlots} activeSlotId={activeSlotId} />
      <LayerRow label="VOICE" slotIds={choirSlotIds} doneSlots={doneSlots} activeSlotId={activeSlotId} />
    </div>
  );
}
