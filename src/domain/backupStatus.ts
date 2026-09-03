import { daysBetween } from "./derive.ts";

/**
 * How the backup is doing, in the one line the settings screen shows. Kept
 * apart from the file-writing so the wording - which is the part that has to be
 * honest with someone who is about to lose their book - can be checked.
 */
export type BackupStatus = {
  line: string;
  /** True when the book has changed since the last backup was written. */
  stale: boolean;
};

function countOf(count: number): string {
  return `${count} ${count === 1 ? "baby" : "babies"}`;
}

export function describeBackup(input: {
  /** ISO timestamp of the last successful backup, if there has ever been one. */
  lastAt?: string;
  /** ISO timestamp of the most recent change to any baby. */
  changedAt?: string;
  count: number;
  now: Date;
}): BackupStatus {
  if (input.count === 0) return { line: "Nothing to back up yet", stale: false };

  const book = countOf(input.count);
  if (!input.lastAt) return { line: `${book}, never backed up`, stale: true };

  const days = daysBetween(new Date(input.lastAt), input.now);
  const when =
    days <= 0 ? "backed up today" : days === 1 ? "backed up yesterday" : `backed up ${days} days ago`;

  // A backup written after the last change is current however old it is: a book
  // nobody has touched for a year does not need saving again.
  const stale = input.changedAt !== undefined && input.changedAt > input.lastAt;

  return { line: stale ? `${book}, ${when} - out of date` : `${book}, ${when}`, stale };
}

/* ------------------------------------------------------- the quiet reminder */

export type BackupNudge = { kind: "none" } | { kind: "warn"; title: string; line: string };

/**
 * Long enough that adding a baby is not immediately answered with nagging. The
 * risk of losing something entered two minutes ago is real but small, and an
 * app that scolds on the way out of the form is one nobody opens again.
 */
const GRACE_DAYS = 2;

/**
 * Whether to say anything on the home screen about the backup.
 *
 * Silence is the default and the bar for breaking it is high: something to
 * lose, a backup that does not cover it, a couple of days to have got round to
 * it, and no recent shrug from the person being told.
 */
export function nudgeAboutBackup(input: {
  count: number;
  lastAt?: string;
  changedAt?: string;
  /** When the nudge was last waved away, if it ever has been. */
  hushedAt?: string;
  /** Whether the file is supposed to be rewriting itself. */
  keeping: boolean;
  now: Date;
}): BackupNudge {
  if (input.count === 0) return { kind: "none" };
  if (!describeBackup(input).stale) return { kind: "none" };

  // Waved away until something changes again rather than for good, because the
  // thing worth mentioning is not the backup, it is the new baby it is missing.
  if (input.hushedAt && input.changedAt && input.changedAt <= input.hushedAt) {
    return { kind: "none" };
  }

  if (input.changedAt && daysBetween(new Date(input.changedAt), input.now) < GRACE_DAYS) {
    return { kind: "none" };
  }

  // Auto-backup going quiet is its own thing and reads worse than never having
  // set one up, because the person believes it is handled.
  if (input.keeping) {
    return {
      kind: "warn",
      title: "Automatic backups have stopped",
      line: "Stork cannot write to the folder you chose any more. Backing up once by hand hooks it back on.",
    };
  }

  if (!input.lastAt) {
    return {
      kind: "warn",
      title: "Nothing is backed up yet",
      line: "All of this lives on this device. Clearing your browser data would take it with it.",
    };
  }

  return {
    kind: "warn",
    title: "Your backup is out of date",
    line: "Something has changed since the last one was written.",
  };
}
