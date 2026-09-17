import type { Baby, BabySex, BabyStatus, Moment, Photo } from "../domain/types.ts";
import {
  MAX_LINKS,
  MAX_MOMENTS,
  MAX_MOMENT_LABEL,
  MAX_PHOTOS,
  MAX_PICTURE_BYTES,
  SCHEMA_VERSION,
  newId,
  type StoreFile,
} from "./repo.ts";

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

/** A measurement, rejected rather than clamped when it is not plausible. */
function measure(value: unknown, min: number, max: number, places: number): number | undefined {
  const number = typeof value === "number" ? value : Number(str(value));
  if (!Number.isFinite(number)) return undefined;
  const step = 10 ** places;
  const rounded = Math.round(number * step) / step;
  return rounded >= min && rounded <= max ? rounded : undefined;
}

function timestamp(value: unknown): string | undefined {
  const text = str(value);
  if (!text || Number.isNaN(Date.parse(text))) return undefined;
  return new Date(text).toISOString();
}

/*
 * The one gate both the avatar and the album go through, which is why the size
 * cap lives here rather than at either call site. Measured in characters and
 * not encoded bytes: a data URL is base64 and so the two are the same number,
 * and this runs over every picture in the book at every boot, where encoding a
 * string only to ask how long it is would be work for nothing.
 */
function dataUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("data:image/")) return undefined;
  return value.length <= MAX_PICTURE_BYTES ? value : undefined;
}

/** The album, dropping anything without a picture and a plausible date. */
function album(value: unknown, fallbackDate: string | undefined): Photo[] {
  if (!Array.isArray(value)) return [];

  const photos: Photo[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null) continue;
    const raw = candidate as Record<string, unknown>;
    const data = dataUrl(raw.data);
    // A photo with no date still belongs in the album; it is only the ordering
    // that suffers, so it falls back to the birthday rather than being dropped.
    const date = isoDate(raw.date) ?? fallbackDate;
    if (!data || !date) continue;

    const id = str(raw.id) ?? newId();
    if (seen.has(id)) continue;
    seen.add(id);

    const photo: Photo = { id, data, date };
    if (str(raw.caption)) photo.caption = str(raw.caption);
    photos.push(photo);
    if (photos.length >= MAX_PHOTOS) break;
  }
  return photos;
}

/** Your own moments, dropping any without both a word for it and a date. */
function moments(value: unknown): Moment[] {
  if (!Array.isArray(value)) return [];

  const kept: Moment[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null) continue;
    const raw = candidate as Record<string, unknown>;
    const label = str(raw.label);
    const date = isoDate(raw.date);
    if (!label || !date) continue;

    const id = str(raw.id) ?? newId();
    if (seen.has(id)) continue;
    seen.add(id);

    kept.push({ id, label: label.slice(0, MAX_MOMENT_LABEL), date });
    if (kept.length >= MAX_MOMENTS) break;
  }
  return kept.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * A list of other babies' ids. Nothing here checks that they exist, because an
 * import arrives one baby at a time and the other half may be along in a
 * moment; a link to nobody simply never matches anything.
 */
function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const found = value.map(str).filter((id): id is string => id !== undefined);
  return [...new Set(found)].slice(0, MAX_LINKS);
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
  const photo = dataUrl(raw.photo);

  const baby: Baby = {
    id: str(raw.id) ?? newId(),
    parents,
    // "born" without a birth date would break every age readout downstream.
    status: status === "born" && !birthDate ? "expecting" : status,
    updatedAt: timestamp(raw.updatedAt) ?? new Date(0).toISOString(),
  };

  if (name) baby.name = name;
  // A bump has a due date and a baby has a birthday, never both, so an import
  // carrying both is normalised rather than left to contradict itself.
  if (baby.status === "born") {
    if (birthDate) baby.birthDate = birthDate;
    // Only a baby who has arrived can have been weighed.
    const weight = measure(raw.birthWeightGrams, 200, 8000, 0);
    const length = measure(raw.birthLengthCm, 20, 70, 1);
    if (weight !== undefined) baby.birthWeightGrams = weight;
    if (length !== undefined) baby.birthLengthCm = length;
  } else if (dueDate) {
    baby.dueDate = dueDate;
  }
  if (CLOCK_TIME.test(str(raw.birthTime) ?? "")) baby.birthTime = str(raw.birthTime);
  if (sexValue && (SEXES as string[]).includes(sexValue)) baby.sex = sexValue as BabySex;
  if (photo) baby.photo = photo;
  const photos = album(raw.photos, birthDate ?? dueDate);
  if (photos.length > 0) baby.photos = photos;
  if (str(raw.notes)) baby.notes = str(raw.notes);
  if (raw.giftSent === true) baby.giftSent = true;

  const noted = moments(raw.moments);
  if (noted.length > 0) baby.moments = noted;

  // A baby cannot be its own sibling, and cannot be both joined and separated:
  // a separation is the more deliberate of the two, so it is the one kept.
  const apart = ids(raw.notFamily).filter((id) => id !== baby.id);
  const together = ids(raw.sameFamily).filter((id) => id !== baby.id && !apart.includes(id));
  if (together.length > 0) baby.sameFamily = together;
  if (apart.length > 0) baby.notFamily = apart;

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
