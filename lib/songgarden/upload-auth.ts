/** Shared parsers for songgarden upload routes. */

export function parseDeviceId(value: FormDataEntryValue | string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^dev_[a-zA-Z0-9_-]{8,64}$/.test(trimmed)) return null;
  return trimmed;
}

export function parseSessionToken(value: FormDataEntryValue | string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^sg_sess_[a-zA-Z0-9_-]{8,64}$/.test(trimmed)) return null;
  return trimmed;
}
