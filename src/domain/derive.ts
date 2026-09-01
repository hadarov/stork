import type { Baby } from "./types.ts";

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

export function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
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
export function describeAge(birthDate: string, now: Date): Age {
  const birth = parseDate(birthDate);
  const days = daysBetween(birth, now);

  if (days < 0) return { days, label: "not here yet", short: "soon" };
  if (days === 0) return { days, label: "born today", short: "new" };
  if (days < 14) return { days, label: `${plural(days, "day")} old`, short: `${days}d` };

  const months = monthsBetween(birth, now);
  if (months < 3) {
    const weeks = Math.floor(days / 7);
    return { days, label: `${plural(weeks, "week")} old`, short: `${weeks}w` };
  }
  if (months < 24) {
    return { days, label: `${plural(months, "month")} old`, short: `${months}m` };
  }

  const years = Math.floor(months / 12);
  const extraMonths = months % 12;
  const label =
    extraMonths === 0
      ? `${plural(years, "year")} old`
      : `${plural(years, "year")}, ${plural(extraMonths, "month")} old`;
  return { days, label, short: `${years}y` };
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

export function dueCountdown(dueDate: string, now: Date): DueInfo {
  const date = parseDate(dueDate);
  const daysUntil = daysBetween(now, date);
  const week = Math.max(0, Math.min(42, Math.floor((GESTATION_DAYS - daysUntil) / 7)));
  const trimester = week <= 13 ? 1 : week <= 27 ? 2 : 3;

  let label: string;
  let short: string;
  if (daysUntil === 0) {
    label = "due today";
    short = "today";
  } else if (daysUntil < 0) {
    label = `${plural(-daysUntil, "day")} overdue`;
    short = `+${-daysUntil}d`;
  } else if (daysUntil === 1) {
    label = "due tomorrow";
    short = "1d";
  } else if (daysUntil < 21) {
    label = `due in ${plural(daysUntil, "day")}`;
    short = `${daysUntil}d`;
  } else {
    const weeks = Math.round(daysUntil / 7);
    label = `due in ${plural(weeks, "week")}`;
    short = `${weeks}w`;
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

export function milestones(birthDate: string, now: Date): Milestone[] {
  const birth = parseDate(birthDate);
  const points: { key: string; label: string; date: Date }[] = [
    { key: "born", label: "Arrived", date: birth },
    { key: "d100", label: "100 days", date: addDays(birth, 100) },
    { key: "m6", label: "Half a year", date: addMonths(birth, 6) },
    { key: "y1", label: "First birthday", date: addMonths(birth, 12) },
    { key: "y2", label: "Second birthday", date: addMonths(birth, 24) },
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
export function nextEvent(baby: Baby, now: Date): Upcoming | null {
  if (baby.status === "expecting") {
    if (!baby.dueDate) return null;
    const due = dueCountdown(baby.dueDate, now);
    return {
      kind: "due",
      date: due.date,
      daysUntil: due.daysUntil,
      label: due.label,
      emoji: "\u{1F423}",
    };
  }

  if (!baby.birthDate) return null;

  const age = describeAge(baby.birthDate, now);
  if (age.days === 0) {
    return {
      kind: "arrival",
      date: parseDate(baby.birthDate),
      daysUntil: 0,
      label: "arrived today",
      emoji: "\u{1F389}",
    };
  }

  const birthday = nextBirthday(baby.birthDate, now);
  const soonestMilestone = milestones(baby.birthDate, now)
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
      label: `${soonestMilestone.label} in ${plural(soonestMilestone.daysUntil, "day")}`,
      emoji: "\u{2B50}",
    };
  }

  const when =
    birthday.daysUntil === 0
      ? "today"
      : birthday.daysUntil === 1
        ? "tomorrow"
        : `in ${plural(birthday.daysUntil, "day")}`;
  return {
    kind: "birthday",
    date: birthday.date,
    daysUntil: birthday.daysUntil,
    label: `turns ${ordinal(birthday.turning)} ${when}`,
    emoji: "\u{1F382}",
  };
}

/** Sort key: soonest first, with anything undated pushed to the end. */
export function sortByNextEvent(babies: Baby[], now: Date): Baby[] {
  return [...babies].sort((a, b) => {
    const left = nextEvent(a, now);
    const right = nextEvent(b, now);
    if (!left && !right) return displayName(a).localeCompare(displayName(b));
    if (!left) return 1;
    if (!right) return -1;
    // Overdue and just-happened events stay pinned at the top.
    return Math.abs(left.daysUntil) - Math.abs(right.daysUntil);
  });
}

/* -------------------------------------------------------------- labelling */

export function displayName(baby: Baby): string {
  if (baby.name) return baby.name;
  if (baby.parents.length > 0) return `${baby.parents[0]}'s baby`;
  return "Baby on the way";
}

export function describeParents(parents: string[]): string {
  if (parents.length === 0) return "";
  if (parents.length === 1) return parents[0];
  if (parents.length === 2) return `${parents[0]} and ${parents[1]}`;
  return `${parents.slice(0, -1).join(", ")} and ${parents[parents.length - 1]}`;
}
