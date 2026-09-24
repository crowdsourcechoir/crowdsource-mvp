import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { readWorkspaceSettings, writeWorkspaceSettings } from "@/lib/settings/store";

export const PITCH_AUTH_COOKIE = "sobeca_pitch_auth";

export function hashPitchPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPitchPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

export function pitchAuthToken(passwordHash: string): string {
  return createHmac("sha256", passwordHash).update("sobeca-pitch").digest("hex");
}

export function passwordHashFrom(stored: unknown): string | null {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  const hash = (stored as { passwordHash?: unknown }).passwordHash;
  return typeof hash === "string" && hash.includes(":") ? hash : null;
}

export async function readPitchPasswordHash(): Promise<string | null> {
  const stored = await readWorkspaceSettings({ skipCache: true });
  return passwordHashFrom(stored.settings.songGarden);
}

export async function writePitchPassword(password: string | null): Promise<{ error: string | null }> {
  const current = await readWorkspaceSettings({ skipCache: true });
  const existing = current.settings.songGarden;
  const slides =
    existing && typeof existing === "object" && !Array.isArray(existing) && "slides" in existing
      ? (existing as { slides: unknown }).slides
      : Array.isArray(existing)
        ? existing
        : undefined;
  const passwordHash = password && password.trim() ? hashPitchPassword(password.trim()) : null;
  const songGarden =
    slides === undefined && !passwordHash
      ? null
      : {
          ...(slides !== undefined ? { slides } : {}),
          ...(passwordHash ? { passwordHash } : {}),
        };
  const written = await writeWorkspaceSettings({ songGarden });
  return { error: written.error };
}
