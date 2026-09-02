/*
 * Where a backup goes, and remembering the answer.
 *
 * The whole point of picking a place once is that the place can be a cloud
 * folder - iCloud Drive, Google Drive, Dropbox - which then carries the book to
 * a new phone without any server of ours in the middle. Browsers offer three
 * different ways to get a file there, so this picks the best one available and
 * hides the difference from the settings screen.
 */

import { idbDelete, idbGet, idbSet } from "./idb.ts";

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

const HANDLE_KEY = "backup";

/**
 * A file handle survives a reload but cannot go in localStorage, since it is a
 * live object rather than a string. IndexedDB will structured-clone it, which is
 * the only reason this app touches IndexedDB at all.
 */
export function rememberedHandle(): Promise<FileSystemFileHandle | null> {
  return idbGet<FileSystemFileHandle>(HANDLE_KEY);
}

export function rememberHandle(handle: FileSystemFileHandle): Promise<void> {
  return idbSet(HANDLE_KEY, handle);
}

export function forgetHandle(): Promise<void> {
  return idbDelete(HANDLE_KEY);
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
