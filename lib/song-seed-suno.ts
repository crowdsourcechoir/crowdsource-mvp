/**
 * Redundant persistence for Suno prompts: stored in `song_seeds.suno_prompts`
 * and duplicated inside `source_mapping` so prompts survive if the dedicated column
 * is missing or not yet migrated.
 */

export const SUNO_PROMPTS_BACKUP_FIELD = "_sunoPromptsBackup";

export type SunoBackupEntry = {
  field: typeof SUNO_PROMPTS_BACKUP_FIELD;
  prompts: string[];
  version: 1;
};

export function mergeSourceMappingWithSunoBackup(sourceMapping: unknown, suno: string[]): unknown[] {
  const base = Array.isArray(sourceMapping) ? [...sourceMapping] : [];
  const filtered = base.filter((item) => {
    if (item && typeof item === "object" && "field" in item) {
      return (item as { field?: string }).field !== SUNO_PROMPTS_BACKUP_FIELD;
    }
    return true;
  });
  if (!suno.length) return filtered;
  const entry: SunoBackupEntry = {
    field: SUNO_PROMPTS_BACKUP_FIELD,
    prompts: suno.slice(0, 3),
    version: 1,
  };
  return [...filtered, entry];
}

/** Prefer `suno_prompts` column; fall back to embedded backup in `source_mapping`. */
export function extractSunoPromptsFromRow(row: Record<string, unknown>): string[] {
  const direct = row.suno_prompts;
  if (Array.isArray(direct) && direct.length > 0) {
    const strings = direct.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    if (strings.length > 0) return strings.slice(0, 3);
  }

  const sm = row.source_mapping;
  if (!Array.isArray(sm)) return [];

  for (let i = sm.length - 1; i >= 0; i--) {
    const item = sm[i];
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (rec.field === SUNO_PROMPTS_BACKUP_FIELD && Array.isArray(rec.prompts)) {
      const strings = rec.prompts.filter((x): x is string => typeof x === "string");
      if (strings.length > 0) return strings.slice(0, 3);
    }
  }
  return [];
}

/** Remove internal backup entries from the mapping we expose in the API (optional cleanup). */
export function stripSunoBackupFromSourceMapping(sourceMapping: unknown): unknown[] {
  if (!Array.isArray(sourceMapping)) return [];
  return sourceMapping.filter((item) => {
    if (item && typeof item === "object" && "field" in item) {
      return (item as { field?: string }).field !== SUNO_PROMPTS_BACKUP_FIELD;
    }
    return true;
  });
}
