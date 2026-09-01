import type { Baby } from "../domain/types.ts";

/**
 * Everything in the app reads and writes babies through this, so that swapping
 * localStorage for a server later is a new implementation rather than a rewrite
 * of every screen.
 */
export interface BabyRepo {
  /** Live records, tombstones filtered out. */
  list(): Promise<Baby[]>;
  /** Everything including tombstones - what a backup or a sync push needs. */
  listAll(): Promise<Baby[]>;
  save(baby: Baby): Promise<void>;
  /** Soft delete, so the deletion itself can be synced. */
  remove(id: string): Promise<void>;
  /** Last-write-wins fold of foreign records into the store. */
  merge(incoming: Baby[]): Promise<MergeResult>;
}

export type MergeResult = { added: number; updated: number; skipped: number };

export const SCHEMA_VERSION = 1;

export type StoreFile = {
  schemaVersion: number;
  babies: Baby[];
};

/**
 * crypto.randomUUID is only defined in a secure context, and this app is very
 * likely to be opened over plain http from a phone on the same Wi-Fi.
 */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isLive(baby: Baby): boolean {
  return baby.deletedAt == null;
}

/**
 * Newest `updatedAt` wins. Pure so it can be tested and reused unchanged by a
 * future CloudRepo pulling records down from a server.
 */
export function mergeRecords(
  existing: Baby[],
  incoming: Baby[],
): { babies: Baby[]; result: MergeResult } {
  const byId = new Map(existing.map((baby) => [baby.id, baby]));
  const result: MergeResult = { added: 0, updated: 0, skipped: 0 };

  for (const candidate of incoming) {
    const current = byId.get(candidate.id);
    if (!current) {
      byId.set(candidate.id, candidate);
      result.added += 1;
    } else if (candidate.updatedAt > current.updatedAt) {
      byId.set(candidate.id, candidate);
      result.updated += 1;
    } else {
      result.skipped += 1;
    }
  }

  return { babies: [...byId.values()], result };
}
