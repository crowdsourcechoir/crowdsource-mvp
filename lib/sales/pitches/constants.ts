/** Google Slides pitches — scopes and helpers. */

export const GOOGLE_PRESENTATIONS_SCOPE = "https://www.googleapis.com/auth/presentations";

/** Least-privilege Drive access for files Octo creates/opens. */
export const GOOGLE_DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export const SLIDES_SCOPES = [GOOGLE_PRESENTATIONS_SCOPE, GOOGLE_DRIVE_FILE_SCOPE] as const;

export function hasSlidesScopes(scopes: string[] | null | undefined): boolean {
  if (!Array.isArray(scopes)) return false;
  return (
    scopes.includes(GOOGLE_PRESENTATIONS_SCOPE) &&
    (scopes.includes(GOOGLE_DRIVE_FILE_SCOPE) ||
      scopes.includes("https://www.googleapis.com/auth/drive") ||
      scopes.includes("https://www.googleapis.com/auth/drive.file"))
  );
}

export const PITCH_PLACEHOLDERS = [
  "{{org_name}}",
  "{{opportunity_title}}",
  "{{contact_name}}",
  "{{contact_role}}",
  "{{fit_blurb}}",
  "{{event_or_initiative}}",
] as const;
