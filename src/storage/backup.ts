import type { Baby } from "../domain/types.ts";
import { migrate } from "./migrate.ts";
import { SCHEMA_VERSION } from "./repo.ts";

/**
 * Local-only data dies with a cleared browser, so the backup file is the safety
 * net. Tombstones are included: dropping them would resurrect deleted babies on
 * the next import.
 */
export function toBackup(babies: Baby[], now: Date): string {
  return JSON.stringify(
    {
      app: "stork",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: now.toISOString(),
      babies,
    },
    null,
    2,
  );
}

/** Accepts anything `migrate` can make sense of, including a hand-edited list. */
export function readBackup(text: string): Baby[] {
  return migrate(text).babies;
}

export function backupFilename(now: Date): string {
  const day = now.toISOString().slice(0, 10);
  return `stork-backup-${day}.json`;
}
