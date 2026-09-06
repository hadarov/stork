import type { Catalog } from "../i18n/en.ts";
import { zodiacYearFor } from "./lunarNewYear.ts";

/*
 * The lookup tables. What is kept here is the part that is the same in every
 * language - which days a sign covers, which emoji it has, which animal a year
 * belongs to - and the words come from the catalogue, keyed by the same names.
 * Splitting it that way means a translation cannot quietly move Capricorn.
 */

export type ElementKey = "fire" | "earth" | "air" | "water" | "wood" | "metal";

export type StarSignKey =
  | "aquarius" | "pisces" | "aries" | "taurus" | "gemini" | "cancer"
  | "leo" | "virgo" | "libra" | "scorpio" | "sagittarius" | "capricorn";

export type ChineseKey =
  | "rat" | "ox" | "tiger" | "rabbit" | "dragon" | "snake"
  | "horse" | "goat" | "monkey" | "rooster" | "dog" | "pig";

export type StarSign = {
  key: StarSignKey;
  name: string;
  emoji: string;
  element: string;
  range: string;
  trait: string;
};

export type StarSignReading = StarSign & {
  /** Set when the birthday sits on the first or last day of the sign. */
  cuspWith?: StarSign;
};

export type ChineseSign = {
  key: ChineseKey;
  animal: string;
  emoji: string;
  element: string;
  year: number;
  trait: string;
};

/** Ordered by the day the sign starts; `from` and `to` are inclusive MMDD. */
const STAR_SIGNS: { key: StarSignKey; from: number; to: number; emoji: string; element: ElementKey }[] = [
  { key: "aquarius", from: 120, to: 218, emoji: "\u{2652}", element: "air" },
  { key: "pisces", from: 219, to: 320, emoji: "\u{2653}", element: "water" },
  { key: "aries", from: 321, to: 419, emoji: "\u{2648}", element: "fire" },
  { key: "taurus", from: 420, to: 520, emoji: "\u{2649}", element: "earth" },
  { key: "gemini", from: 521, to: 620, emoji: "\u{264A}", element: "air" },
  { key: "cancer", from: 621, to: 722, emoji: "\u{264B}", element: "water" },
  { key: "leo", from: 723, to: 822, emoji: "\u{264C}", element: "fire" },
  { key: "virgo", from: 823, to: 922, emoji: "\u{264D}", element: "earth" },
  { key: "libra", from: 923, to: 1022, emoji: "\u{264E}", element: "air" },
  { key: "scorpio", from: 1023, to: 1121, emoji: "\u{264F}", element: "water" },
  { key: "sagittarius", from: 1122, to: 1221, emoji: "\u{2650}", element: "fire" },
  // Capricorn wraps the new year, so it is stored as its two halves.
  { key: "capricorn", from: 1222, to: 1231, emoji: "\u{2651}", element: "earth" },
  { key: "capricorn", from: 101, to: 119, emoji: "\u{2651}", element: "earth" },
];

const CHINESE_ANIMALS: { key: ChineseKey; emoji: string }[] = [
  { key: "rat", emoji: "\u{1F401}" },
  { key: "ox", emoji: "\u{1F402}" },
  { key: "tiger", emoji: "\u{1F405}" },
  { key: "rabbit", emoji: "\u{1F407}" },
  { key: "dragon", emoji: "\u{1F409}" },
  { key: "snake", emoji: "\u{1F40D}" },
  { key: "horse", emoji: "\u{1F40E}" },
  { key: "goat", emoji: "\u{1F410}" },
  { key: "monkey", emoji: "\u{1F412}" },
  { key: "rooster", emoji: "\u{1F413}" },
  { key: "dog", emoji: "\u{1F415}" },
  { key: "pig", emoji: "\u{1F416}" },
];

/** Heavenly-stem elements, two years each, anchored on 1900 being Metal. */
const CHINESE_ELEMENTS: ElementKey[] = [
  "metal", "metal", "water", "water", "wood", "wood", "fire", "fire", "earth", "earth",
];

function mmdd(date: Date): number {
  return (date.getMonth() + 1) * 100 + date.getDate();
}

function readStarSign(
  entry: { key: StarSignKey; emoji: string; element: ElementKey },
  t: Catalog,
): StarSign {
  const words = t.zodiac[entry.key];
  return {
    key: entry.key,
    name: words.name,
    emoji: entry.emoji,
    element: t.element[entry.element],
    range: words.range,
    trait: words.trait,
  };
}

export function starSign(date: Date, t: Catalog): StarSignReading {
  const key = mmdd(date);
  const index = STAR_SIGNS.findIndex((sign) => key >= sign.from && key <= sign.to);
  const entry = STAR_SIGNS[index];
  const reading: StarSignReading = readStarSign(entry, t);

  // Sun-sign boundaries drift by a day between years, so a birthday landing on
  // the very edge is worth flagging rather than stating flatly.
  const neighbour =
    key === entry.from
      ? STAR_SIGNS[(index - 1 + STAR_SIGNS.length) % STAR_SIGNS.length]
      : key === entry.to
        ? STAR_SIGNS[(index + 1) % STAR_SIGNS.length]
        : undefined;
  if (neighbour && neighbour.key !== entry.key) {
    reading.cuspWith = readStarSign(neighbour, t);
  }

  return reading;
}

export function chineseSign(date: Date, t: Catalog): ChineseSign {
  const year = zodiacYearFor(date);
  const offset = ((year - 1900) % 12 + 12) % 12;
  const animal = CHINESE_ANIMALS[offset];
  return {
    key: animal.key,
    animal: t.chinese[animal.key].name,
    emoji: animal.emoji,
    element: t.element[CHINESE_ELEMENTS[((year - 1900) % 10 + 10) % 10]],
    year,
    trait: t.chinese[animal.key].trait,
  };
}

export function birthstone(date: Date, t: Catalog): string {
  return t.birthstones[date.getMonth()];
}

export function birthFlower(date: Date, t: Catalog): string {
  return t.birthFlowers[date.getMonth()];
}

/**
 * The old nursery rhyme. It only exists in English, and a flat translation of
 * a rhyme is not a rhyme, so a language that has not got one says nothing at
 * all rather than printing a line that has lost the only thing it had.
 */
export function dayOfWeekRhyme(date: Date, t: Catalog): { day: string; line: string } | null {
  return t.dayRhyme[date.getDay()] ?? null;
}
