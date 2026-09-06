import { readWorkspaceSettings } from "@/lib/settings/store";
import { getDigestMinScore, getDigestTargetCount } from "./config";

export const DEFAULT_DIGEST_FROM = "Crowdsource Sales <onboarding@resend.dev>";

export type ResolvedDigestSettings = {
  /** Master on/off. Stored override wins; default is on. */
  enabled: boolean;
  minScore: number;
  targetCount: number;
  /** Where the digest is delivered — stored override wins over SALES_DIGEST_TO_EMAIL. */
  recipient: string | null;
  fromEmail: string;
  /** Resend key present and a recipient resolved. */
  providerConfigured: boolean;
  envDefaults: { minScore: number; targetCount: number; recipient: string | null };
  overrides: { enabled: boolean | null; minScore: number | null; targetCount: number | null; recipient: string | null };
  /** False when the store could not be read/written (values are in-memory defaults). */
  persisted: boolean;
  storeError: string | null;
};

export async function resolveDigestSettings(): Promise<ResolvedDigestSettings> {
  const { settings, persisted, error } = await readWorkspaceSettings();
  const overrides = settings.digest;

  const envRecipient = process.env.SALES_DIGEST_TO_EMAIL?.trim() || null;
  const envDefaults = {
    minScore: getDigestMinScore(),
    targetCount: getDigestTargetCount(),
    recipient: envRecipient,
  };

  const recipient = overrides.recipient ?? envRecipient;

  return {
    enabled: overrides.enabled ?? true,
    minScore: overrides.minScore ?? envDefaults.minScore,
    targetCount: overrides.targetCount ?? envDefaults.targetCount,
    recipient,
    fromEmail: process.env.SALES_DIGEST_FROM_EMAIL || DEFAULT_DIGEST_FROM,
    providerConfigured: Boolean(process.env.RESEND_API_KEY && recipient),
    envDefaults,
    overrides,
    persisted,
    storeError: error,
  };
}
