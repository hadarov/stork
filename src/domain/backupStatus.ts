import type { Catalog } from "../i18n/en.ts";
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

export function describeBackup(
  input: {
    /** ISO timestamp of the last successful backup, if there has ever been one. */
    lastAt?: string;
    /** ISO timestamp of the most recent change to any baby. */
    changedAt?: string;
    count: number;
    now: Date;
  },
  t: Catalog,
): BackupStatus {
  const words = t.settings.backup;
  if (input.count === 0) return { line: words.nothingYet, stale: false };

  const book = words.babies(input.count);
  if (!input.lastAt) return { line: words.never(book), stale: true };

  const days = daysBetween(new Date(input.lastAt), input.now);
  const when =
    days <= 0 ? words.today(book) : days === 1 ? words.yesterday(book) : words.daysAgo(book, days);

  // A backup written after the last change is current however old it is: a book
  // nobody has touched for a year does not need saving again.
  const stale = input.changedAt !== undefined && input.changedAt > input.lastAt;

  return { line: stale ? words.outOfDate(when) : when, stale };
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
export function nudgeAboutBackup(
  input: {
    count: number;
    lastAt?: string;
    changedAt?: string;
    /** When the nudge was last waved away, if it ever has been. */
    hushedAt?: string;
    /** Whether the file is supposed to be rewriting itself. */
    keeping: boolean;
    now: Date;
  },
  t: Catalog,
): BackupNudge {
  const words = t.settings.backup;
  if (input.count === 0) return { kind: "none" };
  if (!describeBackup(input, t).stale) return { kind: "none" };

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
    return { kind: "warn", title: words.stoppedTitle, line: words.stoppedLine };
  }

  if (!input.lastAt) {
    return { kind: "warn", title: words.noneTitle, line: words.noneLine };
  }

  return { kind: "warn", title: words.staleTitle, line: words.staleLine };
}
