/**
 * IndexedDB storage for submissions. Much larger quota than localStorage (~5–10 MB),
 * so "Storage full" is far less likely for typical use.
 */

const DB_NAME = "csc_submissions_db";
const STORE_NAME = "events";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "slug" });
    };
  });
}

export function idbAvailable(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

export async function idbGetSubmissions(slug: string): Promise<unknown[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(slug);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const row = req.result;
      resolve(Array.isArray(row?.list) ? row.list : []);
    };
    tx.oncomplete = () => db.close();
  });
}

export async function idbSetSubmissions(slug: string, list: unknown[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({ slug, list });
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}
