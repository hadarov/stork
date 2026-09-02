/*
 * A single keyed box in IndexedDB, shared by everything that needs to keep
 * something localStorage cannot hold: a live file handle, or a list the service
 * worker has to be able to read while the app is closed.
 *
 * The service worker keeps its own copy of the opener, since it cannot import
 * from here. The names below are the contract between the two - change them and
 * change web/sw.js in the same breath.
 */

export const DB_NAME = "stork";
export const STORE = "vault";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No IndexedDB."));
  });
}

async function inStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB refused."));
    });
  } finally {
    db.close();
  }
}

/* Private browsing turns IndexedDB off entirely, so none of this may refuse
 * loudly: every caller has something reasonable to do without it. */

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    return (await inStore<T>("readonly", (store) => store.get(key))) ?? null;
  } catch {
    return null;
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    await inStore("readwrite", (store) => store.put(value, key));
  } catch {
    // Then it lasts as long as the tab does.
  }
}

export async function idbDelete(key: string): Promise<void> {
  try {
    await inStore("readwrite", (store) => store.delete(key));
  } catch {
    // Nothing to forget.
  }
}
