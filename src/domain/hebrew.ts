import type { Catalog } from "../i18n/en.ts";
import { addDays, daysBetween, parseDate, toISODate } from "./derive.ts";

/*
 * The Hebrew calendar, built on Intl rather than on a table of dates or a
 * library, so it stays right for as long as the browser does and costs nothing
 * to ship.
 *
 * Three things make this more than a format call.
 *
 * The year is lunisolar, so a Hebrew birthday walks around the Gregorian one by
 * a couple of weeks each year and there is no arithmetic that finds it. It is
 * found by looking.
 *
 * A leap year has two Adars. Somebody born in plain Adar has their birthday in
 * Adar II when the year has both, which is the usual practice for a birthday;
 * somebody born in either Adar of a leap year has it in plain Adar otherwise.
 *
 * Heshvan and Kislev are 29 days in some years and 30 in others, so a baby born
 * on the 30th of either has years with no such date. The custom is to keep it on
 * the first of the month that follows, which is what happens here.
 *
 * One thing it deliberately does not do is move the day at sunset. A Hebrew day
 * begins in the evening, so a baby born at nine at night was already born on the
 * next Hebrew day - but the app is given a date, usually second hand, and often
 * no time at all. Guessing would be worse than being honest about the civil day,
 * so the screens say where the date came from rather than pretending.
 */

export type HebrewMonth =
  | "tishri" | "heshvan" | "kislev" | "tevet" | "shevat"
  | "adar" | "adar1" | "adar2"
  | "nisan" | "iyar" | "sivan" | "tamuz" | "av" | "elul";

export type HebrewParts = { year: number; month: HebrewMonth; day: number };

/** What ICU calls each month, which is the only name we get to key on. */
const MONTH_KEYS: Record<string, HebrewMonth> = {
  Tishri: "tishri",
  Heshvan: "heshvan",
  Kislev: "kislev",
  Tevet: "tevet",
  Shevat: "shevat",
  Adar: "adar",
  "Adar I": "adar1",
  "Adar II": "adar2",
  Nisan: "nisan",
  Iyar: "iyar",
  Sivan: "sivan",
  Tamuz: "tamuz",
  Av: "av",
  Elul: "elul",
};

// Built once: constructing a formatter is far dearer than using one, and this
// gets asked the same question a few hundred times while looking for a date.
const PARTS = new Intl.DateTimeFormat("en-u-ca-hebrew", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function hebrewParts(date: Date): HebrewParts {
  const found: Record<string, string> = {};
  for (const part of PARTS.formatToParts(date)) found[part.type] = part.value;
  return {
    year: Number(found.year.replace(/\D/g, "")),
    month: MONTH_KEYS[found.month] ?? "tishri",
    day: Number(found.day),
  };
}

/**
 * "17 באלול 5786" in Hebrew, "17 Elul 5786" in English.
 *
 * The fields are named one by one rather than asked for as a `dateStyle`,
 * because Chrome has no long Hebrew-calendar style for a Hebrew locale and
 * falls back to something unreadable: "57861217 12:00 PM", the numbers run
 * together with a time nobody asked for. Naming the fields is understood
 * everywhere and gives the same answer in every engine, which also keeps the
 * dates in the tests honest.
 */
export function hebrewDateText(date: Date, t: Catalog): string {
  return new Intl.DateTimeFormat(`${t.code}-u-ca-hebrew`, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * Whether two months are the same date in different years. The two Adars
 * collapse into one another, because a year either has both or has neither and
 * a birthday has to land somewhere.
 */
function sameMonth(target: HebrewMonth, candidate: HebrewMonth): boolean {
  if (target === candidate) return true;
  const adar = (month: HebrewMonth) => month === "adar" || month === "adar2";
  // Plain Adar and Adar II are the same slot: the one Purim falls in.
  if (adar(target) && adar(candidate)) return true;
  // Adar I only exists in a leap year, so otherwise it falls back to the one Adar.
  if (target === "adar1" && candidate === "adar") return true;
  return false;
}

/** The month a missing 30th spills into. Only these two ever vary in length. */
const SPILLS: Partial<Record<HebrewMonth, HebrewMonth>> = {
  heshvan: "kislev",
  kislev: "tevet",
};

export type HebrewBirthday = {
  date: Date;
  daysUntil: number;
  /** The age they will be, counted in Hebrew years. */
  turning: number;
  isToday: boolean;
  /** Set when the real date does not exist that year and it moved on a day. */
  moved: boolean;
};

const found = new Map<string, HebrewBirthday>();

/**
 * The next Hebrew birthday. Found by walking forward a day at a time, because
 * the Hebrew year is between 353 and 385 days long and no offset from the
 * Gregorian date would be right two years running.
 */
export function hebrewBirthday(birthDate: string, now: Date): HebrewBirthday {
  const key = `${birthDate}|${toISODate(now)}`;
  const cached = found.get(key);
  if (cached) return cached;

  const birth = parseDate(birthDate);
  const target = hebrewParts(birth);
  const spill = SPILLS[target.month];

  let answer: HebrewBirthday | undefined;
  // A Hebrew year is at most 385 days, so the next one is always inside this.
  for (let step = 0; step <= 400 && !answer; step += 1) {
    const date = addDays(now, step);
    const here = hebrewParts(date);
    // The day they were born is not a birthday, so a baby born today waits.
    if (here.year <= target.year) continue;

    const exact = sameMonth(target.month, here.month) && here.day === target.day;
    /*
     * The first of the next month, for a birthday on a 30th that this year has
     * not got. It is not enough to reach it and assume, because the walk can
     * start the day after a real 30th and land here having missed nothing: the
     * birthday was yesterday and the next one is a year off. So the day before
     * is asked whether it was the 30th, which answers how long the month ran.
     */
    const moved =
      target.day === 30 &&
      spill !== undefined &&
      here.month === spill &&
      here.day === 1 &&
      hebrewParts(addDays(date, -1)).day !== 30;

    if (exact || moved) {
      answer = {
        date,
        daysUntil: daysBetween(now, date),
        turning: here.year - target.year,
        isToday: step === 0,
        moved: !exact,
      };
    }
  }

  // Unreachable for any real date, but a screen must never be handed nothing.
  const result = answer ?? {
    date: addDays(now, 1),
    daysUntil: 1,
    turning: 0,
    isToday: false,
    moved: false,
  };
  found.set(key, result);
  return result;
}

/* ------------------------------------------------------------ brit milah */

export type Brit = { date: Date; daysUntil: number; done: boolean };

/**
 * The eighth day, counting the day of the birth as the first, which puts it a
 * week later on the same weekday.
 */
export function britMilah(birthDate: string, now: Date): Brit {
  const date = addDays(parseDate(birthDate), 7);
  const daysUntil = daysBetween(now, date);
  return { date, daysUntil, done: daysUntil <= 0 };
}

/* ---------------------------------------------------------------- chagim */

export type ChagKey =
  | "roshHashana" | "yomKippur" | "sukkot" | "simchatTorah" | "chanukah"
  | "tuBiShvat" | "purim" | "purimKatan" | "pesach" | "yomHaatzmaut"
  | "lagBaomer" | "shavuot" | "tishaBav" | "tuBav";

/** Whether Kislev ran to 30 days in the year this date sits in. */
function kislevLength(date: Date): number {
  // Walk back to the first of Tevet and look at the day before it.
  let cursor = date;
  for (let step = 0; step < 40; step += 1) {
    const here = hebrewParts(cursor);
    if (here.month === "tevet" && here.day === 1) return hebrewParts(addDays(cursor, -1)).day;
    cursor = addDays(cursor, -1);
  }
  return 30;
}

/**
 * The festival a date falls on, if any. Only the day itself: being born the
 * week before Pesach is not a story, being born on it is.
 */
export function chagOn(date: Date): ChagKey | null {
  const { month, day } = hebrewParts(date);

  if (month === "tishri") {
    if (day === 1 || day === 2) return "roshHashana";
    if (day === 10) return "yomKippur";
    if (day >= 15 && day <= 21) return "sukkot";
    if (day === 22) return "simchatTorah";
  }
  if (month === "kislev" && day >= 25) return "chanukah";
  if (month === "tevet") {
    // Chanukah runs eight days from 25 Kislev, so where it ends depends on
    // whether Kislev was long or short that year.
    const nights = day + kislevLength(date) - 24;
    if (nights <= 8) return "chanukah";
  }
  if (month === "shevat" && day === 15) return "tuBiShvat";
  if ((month === "adar" || month === "adar2") && day === 14) return "purim";
  if (month === "adar1" && day === 14) return "purimKatan";
  if (month === "nisan" && day >= 15 && day <= 21) return "pesach";
  if (month === "iyar" && day === 5) return "yomHaatzmaut";
  if (month === "iyar" && day === 18) return "lagBaomer";
  if (month === "sivan" && day === 6) return "shavuot";
  if (month === "av" && day === 9) return "tishaBav";
  if (month === "av" && day === 15) return "tuBav";

  return null;
}
