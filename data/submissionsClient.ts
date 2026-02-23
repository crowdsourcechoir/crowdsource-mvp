import {
  idbAvailable,
  idbGetSubmissions,
  idbSetSubmissions,
} from "./submissionsStorage";

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

/** Get submissions (async). Uses IndexedDB when available for much larger storage. */
export async function getSubmissionsForEvent(slug: string): Promise<StoredSubmission[]> {
  if (typeof window === "undefined") return [];

  if (idbAvailable()) {
    try {
      let list = await idbGetSubmissions(slug);
      if (list.length === 0) {
        const raw = localStorage.getItem(storageKey(slug));
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>[];
            if (Array.isArray(parsed)) {
              list = parsed;
              await idbSetSubmissions(slug, list);
              localStorage.removeItem(storageKey(slug));
            }
          } catch {
            // ignore migration parse error
          }
        }
      }
      return list.map((s) => normalizeSubmission(s as Record<string, unknown>));
    } catch {
      return getSubmissionsSync(slug);
    }
  }

  return getSubmissionsSync(slug);
}

function getSubmissionsSync(slug: string): StoredSubmission[] {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    return Array.isArray(parsed) ? parsed.map(normalizeSubmission) : [];
  } catch {
    return [];
  }
}

/** Add a submission (async). Uses IndexedDB when available to avoid "Storage full". */
export async function addSubmission(
  slug: string,
  data: {
    name?: string | null;
    audioDataUrl?: string | null;
    videoDataUrl?: string | null;
  }
): Promise<StoredSubmission> {
  const withVideo: StoredSubmission = {
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: data.name ?? null,
    audioDataUrl: data.audioDataUrl ?? null,
    videoDataUrl: data.videoDataUrl ?? null,
    transcript: null,
    submittedAt: new Date().toISOString(),
  };

  if (idbAvailable()) {
    try {
      const list = await getSubmissionsForEvent(slug);
      list.push(withVideo);
      await idbSetSubmissions(slug, list);
      return withVideo;
    } catch (e) {
      if (data.videoDataUrl) {
        const withoutVideo: StoredSubmission = { ...withVideo, videoDataUrl: null };
        const list = await getSubmissionsForEvent(slug);
        list.push(withoutVideo);
        try {
          await idbSetSubmissions(slug, list);
          console.warn("Video omitted (storage quota); audio saved.");
          return withoutVideo;
        } catch {
          throw e;
        }
      }
      throw e;
    }
  }

  const list = getSubmissionsSync(slug);
  list.push(withVideo);
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(list));
    return withVideo;
  } catch (e) {
    if (data.videoDataUrl) {
      const withoutVideo: StoredSubmission = { ...withVideo, videoDataUrl: null };
      list[list.length - 1] = withoutVideo;
      try {
        localStorage.setItem(storageKey(slug), JSON.stringify(list));
        console.warn("Video omitted (storage quota); audio saved.");
        return withoutVideo;
      } catch {
        list.pop();
        throw e;
      }
    }
    throw e;
  }
}

/** Update a submission's transcript (async). */
export async function updateSubmissionTranscript(
  slug: string,
  submissionId: string,
  transcript: string
): Promise<void> {
  if (idbAvailable()) {
    try {
      const list = await getSubmissionsForEvent(slug);
      const index = list.findIndex((s) => s.id === submissionId);
      if (index < 0) return;
      list[index] = { ...list[index], transcript };
      await idbSetSubmissions(slug, list);
      return;
    } catch {
      // fall through to sync
    }
  }

  const list = getSubmissionsSync(slug);
  const index = list.findIndex((s) => s.id === submissionId);
  if (index < 0) return;
  list[index] = { ...list[index], transcript };
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(list));
  } catch {
    // ignore
  }
}
