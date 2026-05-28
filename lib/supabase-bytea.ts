function bufferFromJsonBufferText(text: string): Buffer | null {
  try {
    const parsed = JSON.parse(text) as { type?: string; data?: number[] };
    if (parsed?.type === "Buffer" && Array.isArray(parsed.data)) {
      return Buffer.from(parsed.data);
    }
  } catch {
    // not JSON
  }
  return null;
}

function isLikelyAudio(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  const header = buffer.subarray(0, 4).toString("ascii");
  return header === "RIFF" || header === "OggS" || header === "fLaC" || header.startsWith("ID3");
}

function decodeHexByteaString(value: string): Buffer {
  const trimmed = value.trim();
  const hex = trimmed.replace(/^\\x|^0x/i, "");
  return Buffer.from(hex, "hex");
}

/** Decode Postgres bytea values returned by Supabase/PostgREST. */
export function decodeSupabaseBytea(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return Buffer.from(value);

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

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed.startsWith("{")) {
      const fromJson = bufferFromJsonBufferText(trimmed);
      if (fromJson) return fromJson;
    }

    if (trimmed.startsWith("\\x") || trimmed.startsWith("0x")) {
      const raw = decodeHexByteaString(trimmed);
      if (isLikelyAudio(raw)) return raw;

      const fromNestedJson = bufferFromJsonBufferText(raw.toString("utf8"));
      if (fromNestedJson) return fromNestedJson;

      return raw;
    }

    const fromJson = bufferFromJsonBufferText(trimmed);
    if (fromJson) return fromJson;

    const fromBase64 = Buffer.from(trimmed, "base64");
    if (isLikelyAudio(fromBase64)) return fromBase64;

    return fromBase64;
  }

  throw new Error("Invalid bytea payload");
}

/** Encode bytes for Supabase bytea columns (avoids JSON-serialized Buffer blobs). */
export function encodeSupabaseBytea(buffer: Buffer): string {
  return `\\x${buffer.toString("hex")}`;
}
