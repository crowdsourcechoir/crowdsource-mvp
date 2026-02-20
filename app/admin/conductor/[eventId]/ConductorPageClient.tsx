"use client";

import { useParams } from "next/navigation";
import { getEventById } from "@/data/eventsClient";
import ConductorView from "./ConductorView";

const STAGES = [
  "Arrival",
  "Activation",
  "Hooks",
  "Modular Song Build",
  "Genre Shift",
  "EDM Lift",
  "Return",
];

export default function ConductorPageClient() {
  const params = useParams();
  const eventId = typeof params?.eventId === "string" ? params.eventId : "";
  const event = getEventById(eventId);

  if (!event) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-gray-600">Event not found.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-white">Conductor</h1>
      <ConductorView event={event} stages={STAGES} />
    </div>
  );
}
