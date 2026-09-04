"use client";

import Link from "next/link";
import type { Event } from "@/data/mockEvents";
import { listExperienceArcs, PARTICIPATION_MODE_LABELS } from "@/lib/experience/arc-catalog";
import {
  canUseParticipationBeat,
  isParticipationBudgetExceeded,
  isSignalAllowed,
  participationBeatsUsed,
  participationBudgetRemaining,
} from "@/lib/experience/pacing";
import type { ExperienceArcId, ExperienceStageId, ResolvedExperiencePlan } from "@/lib/experience/types";

type ConductorViewProps = {
  event: Event;
  plan: ResolvedExperiencePlan;
  currentStageIndex: number;
  participationBeatsByStageId: Partial<Record<ExperienceStageId, number>>;
  restBeatActive: boolean;
  onStageIndexChange: (index: number) => void;
  onArcChange: (arcId: ExperienceArcId) => void;
  onParticipationBeat: () => void;
  onResetStageBeats: () => void;
  onRestBeatToggle: (active: boolean) => void;
};

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "amber" | "emerald" | "rose";
}) {
  const tones = {
    neutral: "border-gray-600 bg-gray-800/80 text-gray-300",
    amber: "border-amber-700/60 bg-amber-950/40 text-amber-100",
    emerald: "border-emerald-700/60 bg-emerald-950/40 text-emerald-100",
    rose: "border-rose-700/60 bg-rose-950/40 text-rose-100",
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default function ConductorView({
  event,
  plan,
  currentStageIndex,
  participationBeatsByStageId,
  restBeatActive,
  onStageIndexChange,
  onArcChange,
  onParticipationBeat,
  onResetStageBeats,
  onRestBeatToggle,
}: ConductorViewProps) {
  const stages = plan.stages;
  const currentStage = stages[currentStageIndex];
  const beatsUsed = currentStage
    ? participationBeatsUsed(currentStage.id, participationBeatsByStageId)
    : 0;
  const budgetRemaining = currentStage
    ? participationBudgetRemaining(currentStage, participationBeatsByStageId)
    : 0;
  const budgetExceeded = currentStage
    ? isParticipationBudgetExceeded(currentStage, participationBeatsByStageId)
    : false;
  const canBeat = currentStage
    ? canUseParticipationBeat(currentStage, participationBeatsByStageId, restBeatActive)
    : false;
  const signalOk = currentStage ? isSignalAllowed(currentStage, restBeatActive) : false;

  if (!currentStage) {
    return <p className="text-gray-400">No stages in this arc.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-gray-700/60 bg-transparent p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Experience arc</p>
          <p className="mt-1 text-lg font-semibold text-white">{plan.arcName}</p>
          <p className="mt-1 max-w-xl text-sm text-gray-400">{plan.arcDescription}</p>
          {plan.eventEmotionalArc && (
            <p className="mt-2 text-sm text-gray-500">
              Event tone: <span className="text-gray-300">{plan.eventEmotionalArc}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Arc preset</label>
          <select
            value={plan.arcId}
            onChange={(e) => onArcChange(e.target.value as ExperienceArcId)}
            className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"
          >
            {listExperienceArcs().map((arc) => (
              <option key={arc.id} value={arc.id}>
                {arc.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">~{plan.totalDefaultMinutes} min default</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 rounded-xl border border-gray-700/60 bg-transparent p-4 lg:w-56">
          <h3 className="text-sm font-semibold text-gray-400">Stages</h3>
          <ul className="mt-3 space-y-1">
            {stages.map((stage, i) => (
              <li key={stage.id}>
                <button
                  type="button"
                  onClick={() => onStageIndexChange(i)}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                    i === currentStageIndex
                      ? "bg-gray-700 text-white"
                      : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                  }`}
                >
                  <span className="font-mono text-xs text-gray-500">{stage.id}</span>
                  <span className="ml-1.5">{stage.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          <section className="rounded-xl border border-gray-700/60 bg-transparent p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">{event.title}</p>
                <p className="mt-1 font-mono text-xs text-gray-500">{currentStage.id}</p>
                <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{currentStage.title}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>~{currentStage.defaultMinutes} min</Badge>
                {currentStage.expandable && <Badge tone="neutral">Expandable</Badge>}
                {currentStage.restBeat && <Badge tone="amber">Rest beat</Badge>}
                {signalOk && <Badge tone="emerald">Signal OK</Badge>}
                {budgetExceeded && <Badge tone="rose">Budget full</Badge>}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Purpose</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-200">{currentStage.purpose}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Emotional target</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-200">{currentStage.emotionalTarget}</p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Transition cue</h3>
              <p className="mt-2 rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4 text-sm italic text-gray-200">
                {currentStage.transitionCue}
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Allowed participation</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {currentStage.participationModes.map((mode) => (
                  <li key={mode}>
                    <Badge tone="neutral">{PARTICIPATION_MODE_LABELS[mode]}</Badge>
                  </li>
                ))}
              </ul>
            </div>

            {currentStage.compositionOutputs.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Composition outputs</h3>
                <p className="mt-2 text-sm text-gray-300">{currentStage.compositionOutputs.join(" · ")}</p>
              </div>
            )}

            <div className="mt-6 rounded-lg border border-rose-900/40 bg-rose-950/20 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-300/80">Recovery move</h3>
              <p className="mt-2 text-sm text-rose-100/90">{currentStage.recoveryMove}</p>
            </div>
          </section>

          <section className="rounded-xl border border-gray-700/60 bg-transparent p-6">
            <h3 className="text-sm font-semibold text-gray-300">Pacing</h3>
            <p className="mt-1 text-sm text-gray-500">
              Manual participation budget — advisory only; Live tools are unchanged.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs text-gray-500">Beats used</p>
                <p className="text-2xl font-semibold text-white">
                  {beatsUsed}
                  <span className="text-base font-normal text-gray-500">
                    {" "}
                    / {currentStage.maxParticipationBeats}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Remaining</p>
                <p className="text-2xl font-semibold text-white">{budgetRemaining}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onParticipationBeat}
                  disabled={!canBeat}
                  className="rounded-lg bg-[#CFFF81] px-4 py-2 text-sm font-semibold text-black hover:bg-[#bdf25e] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  + Participation beat
                </button>
                <button
                  type="button"
                  onClick={onResetStageBeats}
                  className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700"
                >
                  Reset stage beats
                </button>
                <button
                  type="button"
                  onClick={() => onRestBeatToggle(!restBeatActive)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                    restBeatActive
                      ? "border-amber-500/60 bg-amber-950/40 text-amber-100"
                      : "border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700"
                  }`}
                >
                  {restBeatActive ? "Rest beat ON" : "Rest beat OFF"}
                </button>
              </div>
            </div>

            {restBeatActive && (
              <p className="mt-4 text-sm text-amber-200/90">
                Rest beat active — hold silence; no new participation prompts recommended.
              </p>
            )}
            {budgetExceeded && !restBeatActive && (
              <p className="mt-4 text-sm text-rose-200/90">
                Participation budget reached — consider recovery move or advance stage.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-gray-700/60 bg-transparent p-6">
            <h3 className="text-sm font-semibold text-gray-300">Live tools</h3>
            <p className="mt-1 text-sm text-gray-500">
              Open Host Control Room or Composition when this stage needs them.
              {!signalOk && " Signal rounds are not recommended in this stage."}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/admin/live?eventId=${encodeURIComponent(event.id)}`}
                className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Open Live →
              </Link>
              <Link
                href={`/admin/composition/brief?eventId=${encodeURIComponent(event.id)}`}
                className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Composition brief →
              </Link>
            </div>
          </section>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onStageIndexChange(Math.max(0, currentStageIndex - 1))}
              disabled={currentStageIndex === 0}
              className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => onStageIndexChange(Math.min(stages.length - 1, currentStageIndex + 1))}
              disabled={currentStageIndex === stages.length - 1}
              className="rounded-lg bg-[#CFFF81] px-4 py-2 text-sm font-semibold text-black hover:bg-[#bdf25e] disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
