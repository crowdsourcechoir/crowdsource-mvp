export const EMAIL_ASSET_MAX_BYTES = 5 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export function emailAssetExtension(contentType: string): string | null {
  return EXTENSIONS[contentType.trim().toLowerCase()] ?? null;
}

export function newEmailAssetPath(ext: string): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `library/${stamp}-${rand}.${ext}`;
}

export function isLibraryAssetPath(path: string): boolean {
  return /^library\/[a-z0-9]+-[a-z0-9]+\.(jpg|png|gif|webp)$/.test(path);
}
