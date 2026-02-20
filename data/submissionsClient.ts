export type StoredSubmission = {
  id: string;
  name: string | null;
  audioDataUrl: string | null;
  videoDataUrl: string | null;
  transcript: string | null;
  submittedAt: string; // ISO
};

const STORAGE_PREFIX = "csc_submissions_";

function storageKey(slug: string): string {
  return `${STORAGE_PREFIX}${slug}`;
}

function normalizeSubmission(sub: Record<string, unknown>): StoredSubmission {
  return {
    id: typeof sub.id === "string" ? sub.id : "",
    name: sub.name != null ? String(sub.name) : null,
    audioDataUrl: sub.audioDataUrl != null ? String(sub.audioDataUrl) : null,
    videoDataUrl: sub.videoDataUrl != null ? String(sub.videoDataUrl) : null,
    transcript: sub.transcript != null ? String(sub.transcript) : null,
    submittedAt: typeof sub.submittedAt === "string" ? sub.submittedAt : new Date().toISOString(),
  };
}

export function getSubmissionsForEvent(slug: string): StoredSubmission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    return Array.isArray(parsed) ? parsed.map(normalizeSubmission) : [];
  } catch {
    return [];
  }
}

export function addSubmission(
  slug: string,
  data: {
    name?: string | null;
    audioDataUrl?: string | null;
    videoDataUrl?: string | null;
  }
): StoredSubmission {
  const withVideo: StoredSubmission = {
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: data.name ?? null,
    audioDataUrl: data.audioDataUrl ?? null,
    videoDataUrl: data.videoDataUrl ?? null,
    transcript: null,
    submittedAt: new Date().toISOString(),
  };
  const list = getSubmissionsForEvent(slug);
  list.push(withVideo);
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(list));
    return withVideo;
  } catch (e) {
    if (data.videoDataUrl) {
      const withoutVideo: StoredSubmission = {
        ...withVideo,
        videoDataUrl: null,
      };
      list[list.length - 1] = withoutVideo;
      try {
        localStorage.setItem(storageKey(slug), JSON.stringify(list));
        console.warn("Video omitted (storage quota); audio saved.");
        return withoutVideo;
      } catch {
        list.pop();
        console.warn("Failed to store submission:", e);
        throw e;
      }
    }
    console.warn("Failed to store submission:", e);
    throw e;
  }
}

export function updateSubmissionTranscript(
  slug: string,
  submissionId: string,
  transcript: string
): void {
  const list = getSubmissionsForEvent(slug);
  const index = list.findIndex((s) => s.id === submissionId);
  if (index < 0) return;
  list[index] = { ...list[index], transcript };
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(list));
  } catch {
    // ignore
  }
}
