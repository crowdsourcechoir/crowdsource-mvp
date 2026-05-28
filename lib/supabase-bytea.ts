/** Decode Postgres bytea values returned by Supabase/PostgREST. */
export function decodeSupabaseBytea(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return Buffer.from(value);

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("\\x") || trimmed.startsWith("0x")) {
      return Buffer.from(trimmed.replace(/^\\x|^0x/i, ""), "hex");
    }
    return Buffer.from(trimmed, "base64");
  }

  if (
    value &&
    typeof value === "object" &&
    "type" in value &&
    (value as { type: string }).type === "Buffer" &&
    "data" in value &&
    Array.isArray((value as { data: unknown }).data)
  ) {
    return Buffer.from((value as { data: number[] }).data);
  }

  throw new Error("Invalid bytea payload");
}
