/*
 * Where a backup goes, and remembering the answer.
 *
 * The whole point of picking a place once is that the place can be a cloud
 * folder - iCloud Drive, Google Drive, Dropbox - which then carries the book to
 * a new phone without any server of ours in the middle. Browsers offer three
 * different ways to get a file there, so this picks the best one available and
 * hides the difference from the settings screen.
 */

export type VaultKind =
  /** A folder the browser will let us write to again without asking. */
  | "file"
  /** The phone's share sheet, where "Save to Files" reaches iCloud Drive. */
  | "share"
  /** Straight to Downloads, and it is up to you where it goes next. */
  | "download";

type Picker = (options: unknown) => Promise<FileSystemFileHandle>;

function picker(): Picker | undefined {
  if (typeof window === "undefined") return undefined;
  const candidate = (window as unknown as { showSaveFilePicker?: Picker }).showSaveFilePicker;
  return typeof candidate === "function" ? candidate : undefined;
}

export function vaultKind(): VaultKind {
  if (picker()) return "file";
  const share = typeof navigator === "undefined" ? undefined : navigator.canShare;
  return typeof share === "function" ? "share" : "download";
}

/* ------------------------------------------------- remembering the place */

const DB_NAME = "stork";
const STORE = "vault";
const HANDLE_KEY = "backup";

/**
 * A file handle survives a reload but cannot go in localStorage, since it is a
 * live object rather than a string. IndexedDB will structured-clone it, which is
 * the only reason this app touches IndexedDB at all.
 */
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

export async function rememberedHandle(): Promise<FileSystemFileHandle | null> {
  try {
    return (await inStore("readonly", (store) => store.get(HANDLE_KEY))) ?? null;
  } catch {
    // Private browsing turns IndexedDB off. Backing up by hand still works.
    return null;
  }
}

export async function rememberHandle(handle: FileSystemFileHandle): Promise<void> {
  try {
    await inStore("readwrite", (store) => store.put(handle, HANDLE_KEY));
  } catch {
    // Then the place is only remembered until the tab closes.
  }
}

export async function forgetHandle(): Promise<void> {
  try {
    await inStore("readwrite", (store) => store.delete(HANDLE_KEY));
  } catch {
    // Nothing to forget.
  }
}

/* --------------------------------------------------------------- writing */

type Permission = { queryPermission?: (o: unknown) => Promise<PermissionState> };

/**
 * Whether the handle can be written to right now. Only ever queried, never
 * requested: requesting needs a user gesture, and an automatic backup does not
 * have one, so it declines rather than throwing.
 */
export async function writable(handle: FileSystemFileHandle): Promise<boolean> {
  const query = (handle as unknown as Permission).queryPermission;
  if (typeof query !== "function") return true;
  try {
    return (await query.call(handle, { mode: "readwrite" })) === "granted";
  } catch {
    return false;
  }
}

export async function chooseFile(suggestedName: string): Promise<FileSystemFileHandle> {
  const show = picker();
  if (!show) throw new Error("This browser cannot pick a folder.");

  const handle = await show({
    suggestedName,
    types: [{ description: "Stork backup", accept: { "application/json": [".json"] } }],
  });
  await rememberHandle(handle);
  return handle;
}

export async function writeTo(handle: FileSystemFileHandle, text: string): Promise<void> {
  const stream = await handle.createWritable();
  try {
    await stream.write(text);
  } finally {
    await stream.close();
  }
}
