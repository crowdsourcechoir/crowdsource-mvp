import { createHash, createHmac, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export const ROOT_AUTH_COOKIE_NAME = "root_auth";
const PASSWORD_STORE_PATH = path.join(process.cwd(), ".data", "root-page-password.json");

type StoredPassword = {
  hash: string;
  updatedAt: string;
};

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function signToken(secretKey: string): string {
  // Keep the existing token behavior: HMAC(secret, "root")
  return createHmac("sha256", secretKey).update("root").digest("hex");
}

async function readStoredPasswordHash(): Promise<string | null> {
  try {
    const raw = await fs.readFile(PASSWORD_STORE_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const maybe = parsed as Partial<StoredPassword>;
    if (typeof maybe?.hash === "string" && typeof maybe?.updatedAt === "string") return maybe.hash;
    return null;
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

async function writeStoredPasswordHash(newPassword: string): Promise<void> {
  const stored: StoredPassword = {
    hash: sha256Hex(newPassword),
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(PASSWORD_STORE_PATH, JSON.stringify(stored, null, 2), { mode: 0o600 });
}

async function getTokenSecretKey(): Promise<string | null> {
  const storedHash = await readStoredPasswordHash();
  if (storedHash) return storedHash;

  const envPassword = process.env.ROOT_PAGE_PASSWORD;
  if (typeof envPassword === "string" && envPassword.length > 0) return envPassword;

  return null;
}

export async function verifyRootPagePassword(submittedPassword: string): Promise<boolean> {
  const storedHash = await readStoredPasswordHash();
  if (storedHash) {
    const submittedHash = sha256Hex(submittedPassword);
    // timingSafeEqual requires equal buffer sizes; sha256 hex is always 64 chars.
    return timingSafeEqual(Buffer.from(submittedHash), Buffer.from(storedHash));
  }

  const envPassword = process.env.ROOT_PAGE_PASSWORD;
  if (typeof envPassword !== "string" || envPassword.length === 0) return false;
  return submittedPassword === envPassword;
}

export async function getRootAuthExpectedToken(): Promise<string | null> {
  const secretKey = await getTokenSecretKey();
  if (!secretKey) return null;
  return signToken(secretKey);
}

export async function hasRootAuthPasswordConfigured(): Promise<boolean> {
  const storedHash = await readStoredPasswordHash();
  if (storedHash) return true;
  return typeof process.env.ROOT_PAGE_PASSWORD === "string" && process.env.ROOT_PAGE_PASSWORD.length > 0;
}

export async function resetRootPagePassword(newPassword: string): Promise<void> {
  await writeStoredPasswordHash(newPassword);
}

