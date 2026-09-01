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
