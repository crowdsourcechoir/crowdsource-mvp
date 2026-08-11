/**
 * Thin client for Runway's API (https://docs.dev.runwayml.com) — used to turn a single
 * admin-uploaded photo (venue / city / org) into short looping videos for the world
 * storyboard (see world-config.ts WorldStoryboardFrame). Deliberately minimal: we only need
 * image_to_video + task polling + an account/credit check, so this avoids pulling in Runway's
 * full SDK for three endpoints.
 */

const RUNWAY_API_BASE = "https://api.dev.runwayml.com";
const RUNWAY_VERSION = "2024-11-06";

export type RunwayErrorCode =
  | "not_configured"
  | "invalid_key"
  | "insufficient_credits"
  | "rate_limited"
  | "api_error";

export class RunwayError extends Error {
  code: RunwayErrorCode;
  constructor(code: RunwayErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "RunwayError";
  }
}

export function isRunwayConfigured(): boolean {
  return Boolean(process.env.RUNWAYML_API_SECRET?.trim());
}

function apiKey(): string {
  const key = process.env.RUNWAYML_API_SECRET?.trim();
  if (!key) {
    throw new RunwayError(
      "not_configured",
      "Runway is not configured. Add RUNWAYML_API_SECRET to .env.local (or your Vercel project env vars)."
    );
  }
  return key;
}

async function runwayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${RUNWAY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "X-Runway-Version": RUNWAY_VERSION,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    let bodyText = "";
    let parsed: { error?: string; message?: string; issues?: unknown } | null = null;
    try {
      bodyText = await res.text();
      parsed = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      // non-JSON error body — fall through with raw text
    }
    // eslint-disable-next-line no-console
    console.error(`[runway] ${res.status} ${path} ->`, bodyText);
    const message =
      parsed?.error ||
      parsed?.message ||
      bodyText ||
      `Runway request failed (${res.status}).`;
    const lower = message.toLowerCase();

    if (res.status === 401 || res.status === 403) {
      throw new RunwayError("invalid_key", "Runway rejected the API key — double-check RUNWAYML_API_SECRET.");
    }
    if (res.status === 402 || lower.includes("credit") || lower.includes("insufficient funds")) {
      throw new RunwayError(
        "insufficient_credits",
        "Runway account is out of credits. Add credits at https://dev.runwayml.com (Billing) and try again."
      );
    }
    if (res.status === 429) {
      throw new RunwayError("rate_limited", "Runway rate-limited this request — wait a moment and try again.");
    }
    const detail =
      parsed?.issues != null
        ? ` ${typeof parsed.issues === "string" ? parsed.issues : JSON.stringify(parsed.issues)}`
        : bodyText && bodyText !== message
          ? ` ${bodyText.slice(0, 400)}`
          : "";
    throw new RunwayError("api_error", `${message}${detail}`.trim());
  }

  return res;
}

export type RunwayAccountStatus = {
  tier?: string;
  creditBalance?: number;
};

/** GET /v1/organization — free to call, does not spend credits. Good for "do I have credits yet?" checks. */
export async function getRunwayAccountStatus(): Promise<RunwayAccountStatus> {
  const res = await runwayFetch("/v1/organization", { method: "GET" });
  const data = await res.json();
  return {
    tier: data?.tier ?? data?.usageTier ?? undefined,
    creditBalance:
      typeof data?.creditBalance === "number"
        ? data.creditBalance
        : typeof data?.credits === "number"
          ? data.credits
          : undefined,
  };
}

export type ImageToVideoOptions = {
  /** HTTPS URL or data: URI of the source image. */
  promptImage: string;
  promptText: string;
  ratio?: string;
  duration?: number;
  model?: "gen4_turbo" | "gen4.5";
};

export type RunwayReferenceImage = {
  /** HTTPS URL, data: URI, or runway:// URI. */
  uri: string;
  /** Tag referenced in promptText as @Tag (e.g. tag "ref" → "@ref"). */
  tag: string;
};

export type TextToImageOptions = {
  promptText: string;
  ratio?: string;
  model?: "gen4_image" | "gen4_image_turbo";
  /** Optional reference photo(s) — guides composition/place without recycling the photo as the world itself. */
  referenceImages?: RunwayReferenceImage[];
};

async function startTextToImage(opts: TextToImageOptions): Promise<string> {
  const body: Record<string, unknown> = {
    model: opts.model ?? "gen4_image",
    promptText: opts.promptText,
    ratio: opts.ratio ?? "1920:1080",
  };
  if (opts.referenceImages?.length) {
    body.referenceImages = opts.referenceImages;
  }
  const res = await runwayFetch("/v1/text_to_image", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data?.id) throw new RunwayError("api_error", "Runway did not return a task id for text_to_image.");
  return data.id as string;
}

async function startImageToVideo(opts: ImageToVideoOptions): Promise<string> {
  const res = await runwayFetch("/v1/image_to_video", {
    method: "POST",
    body: JSON.stringify({
      model: opts.model ?? "gen4_turbo",
      promptImage: opts.promptImage,
      promptText: opts.promptText,
      // gen4_turbo (API 2024-11-06) accepts pixel ratios like 1280:768, not 1920:1080.
      ratio: opts.ratio ?? "1280:768",
      duration: opts.duration ?? 10,
    }),
  });
  const data = await res.json();
  if (!data?.id) throw new RunwayError("api_error", "Runway did not return a task id.");
  return data.id as string;
}

async function waitForTask(
  taskId: string,
  { timeoutMs = 8 * 60 * 1000, intervalMs = 4000 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await runwayFetch(`/v1/tasks/${taskId}`, { method: "GET" });
    const task = await res.json();
    if (task.status === "SUCCEEDED") {
      const output = Array.isArray(task.output) ? task.output[0] : task.output;
      if (!output) throw new RunwayError("api_error", "Runway task succeeded but returned no output.");
      return output as string;
    }
    if (task.status === "FAILED" || task.status === "CANCELLED") {
      const reason = task.failure || task.failureCode || task.status;
      const lower = String(reason).toLowerCase();
      if (lower.includes("credit")) {
        throw new RunwayError("insufficient_credits", "Runway account is out of credits mid-generation.");
      }
      throw new RunwayError("api_error", `Runway task ${task.status.toLowerCase()}: ${reason}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new RunwayError("api_error", "Timed out waiting for Runway to finish generating this frame.");
}

/**
 * Submits one image_to_video job and waits for it to finish. Returns Runway's hosted output
 * URL — NOTE: that URL expires in 24-48h, so callers must download + re-persist it (see
 * app/api/events/[id]/generate-storyboard/route.ts) before saving it into worldConfig.
 */
export async function generateVideoFromImage(opts: ImageToVideoOptions): Promise<string> {
  const taskId = await startImageToVideo(opts);
  return waitForTask(taskId);
}

/**
 * Generates a brand-new still from a text prompt (no source photo). Used as the base
 * "world plate" for each storyboard frame before animating it — so the garden is invented
 * from the vibe brief rather than recycling the event hero image.
 */
export async function generateImageFromText(opts: TextToImageOptions): Promise<string> {
  const taskId = await startTextToImage(opts);
  return waitForTask(taskId);
}
