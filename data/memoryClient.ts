import type { EventMemoryRecord } from "@/lib/memory/types";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Request failed");
  }
  return res.json();
}

export async function getEventMemory(eventId: string): Promise<EventMemoryRecord | null> {
  if (!eventId) return null;
  try {
    return await api<EventMemoryRecord>(`/api/memory/records?eventId=${encodeURIComponent(eventId)}`);
  } catch {
    return null;
  }
}

export async function finalizeEventMemory(eventId: string): Promise<EventMemoryRecord> {
  return api<EventMemoryRecord>("/api/memory/finalize", {
    method: "POST",
    body: JSON.stringify({ eventId, finalizedBy: "joel" }),
  });
}

export async function listEventMemoryRecords(options?: {
  venue?: string;
  limit?: number;
}): Promise<EventMemoryRecord[]> {
  const params = new URLSearchParams();
  if (options?.venue) params.set("venue", options.venue);
  if (options?.limit) params.set("limit", String(options.limit));
  const q = params.toString();
  const data = await api<{ records: EventMemoryRecord[] }>(`/api/memory/records${q ? `?${q}` : ""}`);
  return data.records ?? [];
}

export type { EventMemoryRecord };
