import type { Baby } from "../domain/types.ts";
import type { BabyRepo, MergeResult } from "./repo.ts";

/**
 * The same repo, but it says so whenever something is written. The automatic
 * backup hangs off this rather than off a convention that every caller
 * remembers to refresh afterwards, so a write can never slip past unrecorded.
 */
export function watchRepo(inner: BabyRepo, onWrite: () => void): BabyRepo {
  return {
    list: () => inner.list(),
    listAll: () => inner.listAll(),
    save: async (baby: Baby) => {
      await inner.save(baby);
      onWrite();
    },
    remove: async (id: string) => {
      await inner.remove(id);
      onWrite();
    },
    merge: async (incoming: Baby[]): Promise<MergeResult> => {
      const result = await inner.merge(incoming);
      onWrite();
      return result;
    },
  };
}

/** The most recent change to any baby, which is what makes a backup stale. */
export function lastChangedAt(babies: Baby[]): string | undefined {
  let latest: string | undefined;
  for (const baby of babies) {
    if (latest === undefined || baby.updatedAt > latest) latest = baby.updatedAt;
  }
  return latest;
}
