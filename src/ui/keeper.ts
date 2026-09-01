import { backupFilename, toBackup } from "../storage/backup.ts";
import type { BabyRepo } from "../storage/repo.ts";
import {
  chooseFile,
  forgetHandle,
  rememberedHandle,
  vaultKind,
  writable,
  writeTo,
  type VaultKind,
} from "../storage/vault.ts";
import { downloadBlob } from "./dom.ts";

/*
 * Keeping the backup current, which is this app's answer to sync: pick a cloud
 * folder once and the file in it is always the latest book, so a new phone is a
 * matter of opening that file rather than of having trusted a server.
 */

const LAST_AT = "stork.backup.at";
const AUTO = "stork.backup.auto";

function read(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: string | undefined): void {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // A book that cannot remember when it was backed up still backs up.
  }
}

export function lastBackupAt(): string | undefined {
  return read(LAST_AT);
}

export function autoBackupOn(): boolean {
  return read(AUTO) === "on";
}

/** Only where the browser will let us write to the same file again. */
export function canKeepUpdated(): boolean {
  return vaultKind() === "file";
}

async function backupText(repo: BabyRepo, now: Date): Promise<string> {
  // Tombstones included, so restoring elsewhere does not undo a deletion.
  return toBackup(await repo.listAll(), now);
}

/**
 * Writes a backup, asking where to put it the first time. Must be called from a
 * tap: both the folder picker and the share sheet need a user gesture. Returns
 * the line to show, or "" when the person backed out of the share sheet, which
 * is a choice rather than a failure.
 */
export async function backUpNow(repo: BabyRepo, now: Date): Promise<string> {
  const text = await backupText(repo, now);
  const name = backupFilename(now);
  const kind: VaultKind = vaultKind();

  if (kind === "file") {
    const remembered = await rememberedHandle();
    const handle =
      remembered && (await writable(remembered)) ? remembered : await chooseFile(name);
    await writeTo(handle, text);
    write(LAST_AT, now.toISOString());
    return `Saved to ${handle.name}`;
  }

  if (kind === "share") {
    const file = new File([text], name, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Stork backup" });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return "";
        throw error;
      }
      write(LAST_AT, now.toISOString());
      return "Choose Save to Files to keep it in iCloud Drive";
    }
  }

  downloadBlob(name, new Blob([text], { type: "application/json" }));
  write(LAST_AT, now.toISOString());
  return "Backup saved to your downloads";
}

/** Turning it on has to pick a place, so this also needs a tap behind it. */
export async function setAutoBackup(on: boolean, repo: BabyRepo, now: Date): Promise<string> {
  if (!on) {
    write(AUTO, undefined);
    await forgetHandle();
    return "Backups are yours to make now";
  }

  const remembered = await rememberedHandle();
  const handle =
    remembered && (await writable(remembered)) ? remembered : await chooseFile(backupFilename(now));
  await writeTo(handle, await backupText(repo, now));
  write(LAST_AT, now.toISOString());
  write(AUTO, "on");
  return `${handle.name} will be kept up to date`;
}

/* ------------------------------------------------------- the quiet rewrite */

let pending: ReturnType<typeof setTimeout> | undefined;

/**
 * Called after every write. Silent by design: a toast on every keystroke would
 * be unbearable, and a backup that quietly fails is no worse than the manual
 * one nobody remembered to make - the settings line still says it is stale.
 */
export function scheduleAutoBackup(repo: BabyRepo): void {
  if (!autoBackupOn()) return;

  // Editing a baby is several writes in a row; only the last one matters.
  clearTimeout(pending);
  pending = setTimeout(() => {
    void (async () => {
      try {
        const handle = await rememberedHandle();
        // Permission is only ever queried, never requested, since there is no
        // gesture here. Losing it just means the next manual backup re-asks.
        if (!handle || !(await writable(handle))) return;
        const now = new Date();
        await writeTo(handle, await backupText(repo, now));
        write(LAST_AT, now.toISOString());
      } catch {
        // Left stale rather than shouted about.
      }
    })();
  }, 2000);
}
