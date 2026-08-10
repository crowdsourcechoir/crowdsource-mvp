import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function keyBytes(): Buffer {
  const raw = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!raw || raw.trim().length < 16) {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY is not set (need a long random secret, e.g. openssl rand -hex 32).");
  }
  // Derive a stable 32-byte key from whatever string the operator stored.
  return createHash("sha256").update(raw.trim()).digest();
}

/** Encrypt a refresh token for storage in gmail_connections.refresh_token_encrypted. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Unrecognized encrypted token format.");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]);
  return decrypted.toString("utf8");
}
