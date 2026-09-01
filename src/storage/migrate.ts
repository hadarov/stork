import type { Baby, BabySex, BabyStatus } from "../domain/types.ts";
import { SCHEMA_VERSION, newId, type StoreFile } from "./repo.ts";

const STATUSES: BabyStatus[] = ["expecting", "born"];
const SEXES: BabySex[] = ["girl", "boy", "surprise"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function isoDate(value: unknown): string | undefined {
  const text = str(value);
  if (!text || !ISO_DATE.test(text)) return undefined;
  return Number.isNaN(Date.parse(`${text}T00:00:00`)) ? undefined : text;
}

function timestamp(value: unknown): string | undefined {
  const text = str(value);
  if (!text || Number.isNaN(Date.parse(text))) return undefined;
  return new Date(text).toISOString();
}

/**
 * Turns one untrusted object into a Baby, or null if there is nothing usable in
 * it. Import reads files a person may have hand-edited, so nothing is assumed.
 */
export function coerceBaby(value: unknown): Baby | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  const birthDate = isoDate(raw.birthDate);
  const dueDate = isoDate(raw.dueDate);
  const name = str(raw.name);

  // A record with no name and no dates is an empty shell, not a baby.
  if (!name && !birthDate && !dueDate) return null;

  const declared = str(raw.status);
  const status: BabyStatus =
    declared && (STATUSES as string[]).includes(declared)
      ? (declared as BabyStatus)
      : birthDate
        ? "born"
        : "expecting";

  const parents = Array.isArray(raw.parents)
    ? raw.parents.map(str).filter((p): p is string => p !== undefined)
    : [];

  const sexValue = str(raw.sex);
  const photo = typeof raw.photo === "string" && raw.photo.startsWith("data:image/")
    ? raw.photo
    : undefined;

  const baby: Baby = {
    id: str(raw.id) ?? newId(),
    parents,
    // "born" without a birth date would break every age readout downstream.
    status: status === "born" && !birthDate ? "expecting" : status,
    updatedAt: timestamp(raw.updatedAt) ?? new Date(0).toISOString(),
  };

  if (name) baby.name = name;
  if (birthDate) baby.birthDate = birthDate;
  if (dueDate) baby.dueDate = dueDate;
  if (CLOCK_TIME.test(str(raw.birthTime) ?? "")) baby.birthTime = str(raw.birthTime);
  if (sexValue && (SEXES as string[]).includes(sexValue)) baby.sex = sexValue as BabySex;
  if (photo) baby.photo = photo;
  if (str(raw.notes)) baby.notes = str(raw.notes);
  if (raw.giftSent === true) baby.giftSent = true;
  if (timestamp(raw.deletedAt)) baby.deletedAt = timestamp(raw.deletedAt);

  return baby;
}

/**
 * Reads whatever is in storage or in an imported file and returns a store that
 * the rest of the app can trust. Unreadable data yields an empty store rather
 * than an exception, because a crash-on-boot is the worst possible outcome here.
 */
export function migrate(raw: unknown): StoreFile {
  const parsed = typeof raw === "string" ? tryParse(raw) : raw;

  // A bare array is accepted so a hand-written list of babies imports cleanly.
  const babiesInput = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as StoreFile).babies)
      ? (parsed as StoreFile).babies
      : [];

  const babies: Baby[] = [];
  const seen = new Set<string>();
  for (const candidate of babiesInput) {
    const baby = coerceBaby(candidate);
    if (!baby || seen.has(baby.id)) continue;
    seen.add(baby.id);
    babies.push(baby);
  }

  return { schemaVersion: SCHEMA_VERSION, babies };
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
