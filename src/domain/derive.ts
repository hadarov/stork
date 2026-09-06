import type { Catalog } from "../i18n/en.ts";
import type { Baby, BabySex } from "./types.ts";

export {
  birthFlower,
  birthstone,
  chineseSign,
  dayOfWeekRhyme,
  starSign,
  type ChineseSign,
  type StarSign,
  type StarSignReading,
} from "./almanac.ts";

/** A pregnancy is counted as 40 weeks from the last period. */
export const GESTATION_DAYS = 280;

/* ------------------------------------------------------------------ dates */

/**
 * Dates are stored as plain yyyy-mm-dd and mean a calendar day, not an instant,
 * so they are built in local time. Parsing the string with `new Date()` would
 * read it as UTC midnight and land on the previous day west of Greenwich.
 */
export function parseDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toISODate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Whole days between two calendar days, immune to daylight saving shifts. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Calendar months elapsed, so 15 Jan to 14 Feb is still 0 months. */
export function monthsBetween(from: Date, to: Date): number {
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return months;
}

/** Clamps to the last day of a shorter month: 31 Aug plus 6 months is 28 Feb. */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}

/*
 * Every date is written in the language's own locale, but pinned to that
 * rather than to the phone's. The app draws dates into a shareable picture, so
 * leaving it to the device would mean a card saying "June 15" when one friend
 * makes it and "15 June" when another does, from the same baby and the same
 * button, both of them reading the app in English.
 *
 * It also makes the tests mean something. They were written on a machine that
 * reports en-IL and asserted "15 June 2024"; the same suite on a runner that
 * defaults to en-US read "June 15, 2024" and failed, having found nothing
 * wrong with the app at all.
 */

export function formatDate(date: Date, t: Catalog): string {
  return date.toLocaleDateString(t.dateLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatShortDate(date: Date, t: Catalog): string {
  return date.toLocaleDateString(t.dateLocale, { day: "numeric", month: "short" });
}

/* ------------------------------------------------------------ how big */

/** "3.40" reads as a measurement; "3.4" reads as a number people say. */
function trim(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

const GRAMS_PER_OUNCE = 28.349523125;

/**
 * Birth weight both ways round. Whoever announced it said one of the two, and
 * whoever reads this page is probably thinking in the other.
 */
export function describeWeight(grams: number, t: Catalog): { metric: string; imperial: string } {
  const ounces = Math.round(grams / GRAMS_PER_OUNCE);
  const pounds = Math.floor(ounces / 16);
  return {
    metric: t.size.kg(trim((grams / 1000).toFixed(2))),
    imperial: t.size.lbOz(pounds, ounces % 16),
  };
}

export function describeLength(cm: number, t: Catalog): { metric: string; imperial: string } {
  return {
    metric: t.size.cm(trim(cm.toFixed(1))),
    imperial: t.size.inches(trim((cm / 2.54).toFixed(1))),
  };
}

/* -------------------------------------------------------------------- age */

export type Age = {
  days: number;
  /** "3 weeks old" - the unit people actually use at that stage. */
  label: string;
  /** "3w" - for the corner of a card. */
  short: string;
};

/**
 * Newborns are counted in days, then weeks, then months, then years, because
 * "0 years old" is useless and nobody says "82 weeks".
 */
export function describeAge(birthDate: string, now: Date, t: Catalog, sex?: BabySex): Age {
  const birth = parseDate(birthDate);
  const days = daysBetween(birth, now);

  if (days < 0) return { days, label: t.age.notYet, short: t.age.shortSoon };
  if (days === 0) return { days, label: t.age.bornToday, short: t.age.shortNew };
  if (days < 14) return { days, label: t.age.days(days, sex), short: t.age.shortDays(days) };

  const months = monthsBetween(birth, now);
  if (months < 3) {
    const weeks = Math.floor(days / 7);
    return { days, label: t.age.weeks(weeks, sex), short: t.age.shortWeeks(weeks) };
  }
  if (months < 24) {
    return { days, label: t.age.months(months, sex), short: t.age.shortMonths(months) };
  }

  const years = Math.floor(months / 12);
  const extraMonths = months % 12;
  const label =
    extraMonths === 0 ? t.age.years(years, sex) : t.age.yearsMonths(years, extraMonths, sex);
  return { days, label, short: t.age.shortYears(years) };
}

/* --------------------------------------------------------------- birthday */

export type BirthdayInfo = {
  date: Date;
  daysUntil: number;
  /** The age they will be on that day. */
  turning: number;
  isToday: boolean;
};

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** 29 February babies are celebrated on the 28th in the years without one. */
function birthdayInYear(birth: Date, year: number): Date {
  if (birth.getMonth() === 1 && birth.getDate() === 29 && !isLeapYear(year)) {
    return new Date(year, 1, 28);
  }
  return new Date(year, birth.getMonth(), birth.getDate());
}

export function nextBirthday(birthDate: string, now: Date): BirthdayInfo {
  const birth = parseDate(birthDate);
  let year = now.getFullYear();
  let date = birthdayInYear(birth, year);

  // The day they were born is not a birthday, so a baby born today waits a year.
  if (daysBetween(now, date) < 0 || year === birth.getFullYear()) {
    year += 1;
    date = birthdayInYear(birth, year);
  }

  const daysUntil = daysBetween(now, date);
  return { date, daysUntil, turning: year - birth.getFullYear(), isToday: daysUntil === 0 };
}

/* -------------------------------------------------------------- due dates */

export type DueInfo = {
  date: Date;
  daysUntil: number;
  /** Completed weeks of pregnancy, the number a midwife would say. */
  week: number;
  trimester: 1 | 2 | 3;
  overdue: boolean;
  label: string;
  /** "3w" - for the corner of a tile. */
  short: string;
};

export function dueCountdown(dueDate: string, now: Date, t: Catalog): DueInfo {
  const date = parseDate(dueDate);
  const daysUntil = daysBetween(now, date);
  const week = Math.max(0, Math.min(42, Math.floor((GESTATION_DAYS - daysUntil) / 7)));
  const trimester = week <= 13 ? 1 : week <= 27 ? 2 : 3;

  let label: string;
  let short: string;
  if (daysUntil === 0) {
    label = t.due.today;
    short = t.due.shortToday;
  } else if (daysUntil < 0) {
    label = t.due.overdue(-daysUntil);
    short = t.due.shortOverdue(-daysUntil);
  } else if (daysUntil === 1) {
    label = t.due.tomorrow;
    short = t.due.shortDays(1);
  } else if (daysUntil < 21) {
    label = t.due.inDays(daysUntil);
    short = t.due.shortDays(daysUntil);
  } else {
    const weeks = Math.round(daysUntil / 7);
    label = t.due.inWeeks(weeks);
    short = t.due.shortWeeks(weeks);
  }

  return { date, daysUntil, week, trimester, overdue: daysUntil < 0, label, short };
}

/* ------------------------------------------------------------- milestones */

export type Milestone = {
  key: string;
  label: string;
  date: Date;
  daysUntil: number;
  done: boolean;
};

export function milestones(birthDate: string, now: Date, t: Catalog): Milestone[] {
  const birth = parseDate(birthDate);
  const points: { key: string; label: string; date: Date }[] = [
    { key: "born", label: t.milestone.born, date: birth },
    { key: "d100", label: t.milestone.d100, date: addDays(birth, 100) },
    { key: "m6", label: t.milestone.m6, date: addMonths(birth, 6) },
    { key: "y1", label: t.milestone.y1, date: addMonths(birth, 12) },
    { key: "y2", label: t.milestone.y2, date: addMonths(birth, 24) },
  ];

  return points.map((point) => {
    const daysUntil = daysBetween(now, point.date);
    return { ...point, daysUntil, done: daysUntil <= 0 };
  });
}

/* ------------------------------------------------------- upcoming events */

export type UpcomingKind = "due" | "birthday" | "milestone" | "arrival";

export type Upcoming = {
  kind: UpcomingKind;
  date: Date;
  daysUntil: number;
  label: string;
  emoji: string;
};

/**
 * The single next thing worth knowing about a baby. Drives the order of the
 * home list and the "this week" strip, which is the whole point of the app.
 */
export function nextEvent(baby: Baby, now: Date, t: Catalog): Upcoming | null {
  if (baby.status === "expecting") {
    if (!baby.dueDate) return null;
    const due = dueCountdown(baby.dueDate, now, t);
    return {
      kind: "due",
      date: due.date,
      daysUntil: due.daysUntil,
      label: due.label,
      emoji: "\u{1F423}",
    };
  }

  if (!baby.birthDate) return null;

  const age = describeAge(baby.birthDate, now, t, baby.sex);
  if (age.days === 0) {
    return {
      kind: "arrival",
      date: parseDate(baby.birthDate),
      daysUntil: 0,
      label: t.next.arrivedToday,
      emoji: "\u{1F389}",
    };
  }

  const birthday = nextBirthday(baby.birthDate, now);
  const soonestMilestone = milestones(baby.birthDate, now, t)
    .filter((point) => point.daysUntil > 0 && point.key !== "born")
    .sort((a, b) => a.daysUntil - b.daysUntil)[0];

  // A milestone only outranks the birthday when it lands first, and the first
  // and second birthdays are already covered by the birthday entry itself.
  if (
    soonestMilestone &&
    soonestMilestone.daysUntil < birthday.daysUntil &&
    !soonestMilestone.key.startsWith("y")
  ) {
    return {
      kind: "milestone",
      date: soonestMilestone.date,
      daysUntil: soonestMilestone.daysUntil,
      label: t.milestone.inDays(soonestMilestone.label, soonestMilestone.daysUntil),
      emoji: "\u{2B50}",
    };
  }

  const label =
    birthday.daysUntil === 0
      ? t.next.birthdayToday(birthday.turning, baby.sex)
      : birthday.daysUntil === 1
        ? t.next.birthdayTomorrow(birthday.turning, baby.sex)
        : t.next.birthdayInDays(birthday.turning, birthday.daysUntil, baby.sex);
  return {
    kind: "birthday",
    date: birthday.date,
    daysUntil: birthday.daysUntil,
    label,
    emoji: "\u{1F382}",
  };
}

/** Sort key: soonest first, with anything undated pushed to the end. */
export function sortByNextEvent(babies: Baby[], now: Date, t: Catalog): Baby[] {
  return [...babies].sort((a, b) => {
    const left = nextEvent(a, now, t);
    const right = nextEvent(b, now, t);
    if (!left && !right) return displayName(a, t).localeCompare(displayName(b, t), t.dateLocale);
    if (!left) return 1;
    if (!right) return -1;
    // Overdue and just-happened events stay pinned at the top.
    return Math.abs(left.daysUntil) - Math.abs(right.daysUntil);
  });
}

/* -------------------------------------------------------------- labelling */

export function displayName(baby: Baby, t: Catalog): string {
  if (baby.name) return baby.name;
  if (baby.parents.length > 0) return t.label.parentsBaby(baby.parents[0]);
  return t.label.unnamed;
}

export function describeParents(parents: string[], t: Catalog): string {
  if (parents.length === 0) return "";
  if (parents.length === 1) return parents[0];
  if (parents.length === 2) return t.label.and(parents[0], parents[1]);
  return t.label.list(parents.slice(0, -1), parents[parents.length - 1]);
}
