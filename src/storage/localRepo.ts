import type { Baby } from "../domain/types.ts";
import { migrate } from "./migrate.ts";
import {
  SCHEMA_VERSION,
  isLive,
  mergeRecords,
  type BabyRepo,
  type MergeResult,
  type StoreFile,
} from "./repo.ts";

export const STORAGE_KEY = "stork.store.v1";

/**
 * Private mode, a full disk and a locked-down browser all make localStorage
 * throw rather than return null, so every access is guarded and the app falls
 * back to memory instead of refusing to start.
 */
function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export class LocalRepo implements BabyRepo {
  private cache: StoreFile | null = null;
  /** Set once a write fails, so the UI can warn that nothing is being saved. */
  public persistenceFailed = false;

  private read(): StoreFile {
    if (!this.cache) this.cache = migrate(readRaw());
    return this.cache;
  }

  private write(babies: Baby[]): void {
    const store: StoreFile = { schemaVersion: SCHEMA_VERSION, babies };
    this.cache = store;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      this.persistenceFailed = false;
    } catch {
      this.persistenceFailed = true;
    }
  }

  async list(): Promise<Baby[]> {
    return this.read().babies.filter(isLive);
  }

  async listAll(): Promise<Baby[]> {
    return [...this.read().babies];
  }

  async save(baby: Baby): Promise<void> {
    const babies = this.read().babies.filter((existing) => existing.id !== baby.id);
    babies.push({ ...baby, updatedAt: new Date().toISOString() });
    this.write(babies);
  }

  async remove(id: string): Promise<void> {
    const now = new Date().toISOString();
    this.write(
      this.read().babies.map((baby) =>
        baby.id === id ? { ...baby, deletedAt: now, updatedAt: now } : baby,
      ),
    );
  }

  async merge(incoming: Baby[]): Promise<MergeResult> {
    const { babies, result } = mergeRecords(this.read().babies, incoming);
    this.write(babies);
    return result;
  }
}

export const localRepo = new LocalRepo();
