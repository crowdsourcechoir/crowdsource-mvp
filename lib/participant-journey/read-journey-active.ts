import type { Event } from "@/data/mockEvents";
import { eventInterviewVersion, journeyPositionKey } from "@/lib/participant-journey/interview-helpers";

export function readJourneyActiveFromStorage(event: Event, startAtGarden: boolean): boolean {
  if (startAtGarden) return true;
  if (typeof window === "undefined") return false;
  try {
    const version = eventInterviewVersion(event);
    const raw = localStorage.getItem(journeyPositionKey(event.id));
    if (!raw) return false;
    const saved = JSON.parse(raw) as { phase?: string; interviewVersion?: string };
    return saved.interviewVersion === version && saved.phase !== "landing" && saved.phase != null;
  } catch {
    return false;
  }
}
