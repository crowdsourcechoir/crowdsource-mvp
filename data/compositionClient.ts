import type { CompositionBrief } from "@/lib/composition/types";

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

export type CompositionBriefScope = {
  eventId?: string | null;
  sessionId?: string | null;
};

function scopeQuery(scope: CompositionBriefScope): string {
  const params = new URLSearchParams();
  if (scope.eventId) params.set("eventId", scope.eventId);
  if (scope.sessionId) params.set("sessionId", scope.sessionId);
  const q = params.toString();
  return q ? `?${q}` : "";
}

export function compositionBriefAdminUrl(scope: CompositionBriefScope): string {
  return `/admin/composition/brief${scopeQuery(scope)}`;
}

export async function getCompositionBrief(scope: CompositionBriefScope): Promise<CompositionBrief | null> {
  if (!scope.eventId && !scope.sessionId) return null;
  try {
    return await api<CompositionBrief>(`/api/composition/brief${scopeQuery(scope)}`);
  } catch {
    return null;
  }
}

export async function generateCompositionBrief(scope: CompositionBriefScope): Promise<CompositionBrief> {
  return api<CompositionBrief>("/api/composition/brief", {
    method: "POST",
    body: JSON.stringify({
      eventId: scope.eventId ?? null,
      sessionId: scope.sessionId ?? null,
    }),
  });
}

export type { CompositionBrief };
