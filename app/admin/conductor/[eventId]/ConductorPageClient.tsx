"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getEventById } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import {
  defaultConductorState,
  loadConductorState,
  saveConductorState,
} from "@/lib/experience/conductor-state";
import { resolveExperiencePlan } from "@/lib/experience/resolve-plan";
import type { ConductorPersistedState, ExperienceArcId, ExperienceStageId } from "@/lib/experience/types";
import ConductorView from "./ConductorView";

export default function ConductorPageClient() {
  const params = useParams();
  const eventId = typeof params?.eventId === "string" ? params.eventId : "";
  const [event, setEvent] = useState<Event | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [conductorState, setConductorState] = useState<ConductorPersistedState>(() =>
    defaultConductorState()
  );
  const [stateHydrated, setStateHydrated] = useState(false);

  useEffect(() => {
    getEventById(eventId)
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setLoaded(true));
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    const saved = loadConductorState(eventId);
    if (saved) setConductorState(saved);
    setStateHydrated(true);
  }, [eventId]);

  const plan = useMemo(
    () =>
      resolveExperiencePlan({
        arcId: conductorState.arcId,
        emotionalArc: event?.agentBrief?.emotionalArc,
      }),
    [conductorState.arcId, event?.agentBrief?.emotionalArc]
  );

  useEffect(() => {
    if (!stateHydrated || !eventId) return;
    const maxIndex = Math.max(0, plan.stages.length - 1);
    if (conductorState.currentStageIndex > maxIndex) {
      setConductorState((prev) => {
        const next = { ...prev, currentStageIndex: maxIndex };
        saveConductorState(eventId, next);
        return next;
      });
    }
  }, [plan.stages.length, conductorState.currentStageIndex, eventId, stateHydrated]);

  const persist = useCallback(
    (next: ConductorPersistedState) => {
      setConductorState(next);
      if (eventId) saveConductorState(eventId, next);
    },
    [eventId]
  );

  const handleArcChange = useCallback(
    (arcId: ExperienceArcId) => {
      persist({
        ...defaultConductorState(arcId),
        participationBeatsByStageId: {},
      });
    },
    [persist]
  );

  const handleStageIndexChange = useCallback(
    (index: number) => {
      persist({
        ...conductorState,
        currentStageIndex: index,
        restBeatActive: false,
      });
    },
    [conductorState, persist]
  );

  const handleParticipationBeat = useCallback(() => {
    const stage = plan.stages[conductorState.currentStageIndex];
    if (!stage) return;
    const current = conductorState.participationBeatsByStageId[stage.id] ?? 0;
    persist({
      ...conductorState,
      participationBeatsByStageId: {
        ...conductorState.participationBeatsByStageId,
        [stage.id]: current + 1,
      },
    });
  }, [conductorState, plan.stages, persist]);

  const handleResetStageBeats = useCallback(() => {
    const stage = plan.stages[conductorState.currentStageIndex];
    if (!stage) return;
    const nextBeats = { ...conductorState.participationBeatsByStageId };
    delete nextBeats[stage.id as ExperienceStageId];
    persist({
      ...conductorState,
      participationBeatsByStageId: nextBeats,
    });
  }, [conductorState, plan.stages, persist]);

  const handleRestBeatToggle = useCallback(
    (active: boolean) => {
      persist({ ...conductorState, restBeatActive: active });
    },
    [conductorState, persist]
  );

  if (!loaded) {
    return <p className="text-gray-400">Loading…</p>;
  }
  if (!event) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-gray-600">Event not found.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Conductor</h1>
        <p className="mt-1 text-sm text-gray-500">
          Layer 5 — Experience Architecture · live guide for show arc and pacing
        </p>
      </div>
      <ConductorView
        event={event}
        plan={plan}
        currentStageIndex={conductorState.currentStageIndex}
        participationBeatsByStageId={conductorState.participationBeatsByStageId}
        restBeatActive={conductorState.restBeatActive}
        onStageIndexChange={handleStageIndexChange}
        onArcChange={handleArcChange}
        onParticipationBeat={handleParticipationBeat}
        onResetStageBeats={handleResetStageBeats}
        onRestBeatToggle={handleRestBeatToggle}
      />
    </div>
  );
}
