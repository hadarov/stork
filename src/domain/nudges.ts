import type { Catalog } from "../i18n/en.ts";
import { displayName, nextEvent } from "./derive.ts";
import { britMilah, hebrewBirthday } from "./hebrew.ts";
import type { Baby } from "./types.ts";

/*
 * What to say and when to say it, worked out here rather than in the service
 * worker. The worker wakes up rarely, at a time the browser chooses, with no
 * access to any of this logic - so it gets handed a finished list of lines and
 * timestamps and has nothing to do but read the clock.
 *
 * Which also settles the language question: a reminder is worded now and read
 * days later, by a worker that cannot look anything up. Whichever language the
 * app was in when the list was written is the language on the lock screen.
 */

export type Nudge = {
  /** Stable for a given baby and occasion, so a repeat is easy to spot. */
  id: string;
  /** When to say it, in epoch milliseconds. */
  at: number;
  title: string;
  body: string;
};

/** A week's warning is enough to actually buy something and post it. */
const LEAD_DAYS = 7;

/**
 * The Hebrew birthday is a thing to mention rather than a thing to shop for,
 * and it is the second birthday in the year, so it asks for less notice.
 */
const HEBREW_LEAD_DAYS = 2;

/**
 * A brit is on the eighth day, counting the birth as the first. A week's
 * warning would want to have been given before the baby was born, so this one
 * gets a day.
 */
const BRIT_LEAD_DAYS = 1;

/** Nine in the morning, not the middle of the night. */
const HOUR = 9;

/** Far enough ahead to survive a browser that only wakes up once a fortnight. */
const HORIZON_DAYS = 90;

const DAY = 24 * 60 * 60 * 1000;

type Words = { title: string; body: string };

function morningOf(date: Date, daysEarlier: number): number {
  const when = new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysEarlier);
  when.setHours(HOUR, 0, 0, 0);
  return when.getTime();
}

function lines(baby: Baby, kind: string, daysEarlier: number, t: Catalog): Words {
  const name = displayName(baby, t);
  const say = t.share.nudge;

  if (kind === "due") {
    return daysEarlier === 0
      ? { title: say.dueTodayTitle(name), body: say.dueTodayBody }
      : { title: say.dueSoonTitle(name), body: say.dueSoonBody };
  }

  if (kind === "birthday") {
    return daysEarlier === 0
      ? { title: say.birthdayTodayTitle(name), body: say.birthdayTodayBody }
      : { title: say.birthdaySoonTitle(name), body: say.birthdaySoonBody };
  }

  return daysEarlier === 0
    ? { title: say.bigDayTodayTitle(name), body: say.bigDayTodayBody }
    : { title: say.bigDaySoonTitle(name), body: say.bigDaySoonBody };
}

/**
 * One occasion, warned about `lead` days ahead and again on the morning itself.
 * Anything whose moment has already gone is dropped rather than fired late.
 */
function occasion(
  baby: Baby,
  date: Date,
  now: Date,
  lead: number,
  kind: string,
  words: (daysEarlier: number) => Words,
): Nudge[] {
  const found: Nudge[] = [];

  for (const daysEarlier of [lead, 0]) {
    const at = morningOf(date, daysEarlier);
    if (at <= now.getTime()) continue;

    const { title, body } = words(daysEarlier);
    found.push({
      id: `${baby.id}:${kind}${date.toISOString().slice(0, 10)}:${daysEarlier}`,
      at,
      title,
      body,
    });
  }

  return found;
}

/**
 * Every reminder due between now and the horizon: a warning, and one on the
 * morning itself. Anything already in the past is left out, so a phone that has
 * been asleep for a month does not wake up and fire off ten stale nudges.
 *
 * `jewish` adds the two dates the Hebrew calendar has and the Gregorian one has
 * not. They are left out entirely rather than shown to everybody, because a
 * reminder nobody asked for is worse than no reminder at all.
 */
export function nudgesFor(babies: Baby[], now: Date, t: Catalog, jewish: boolean): Nudge[] {
  const found: Nudge[] = [];
  const say = t.share.nudge;

  for (const baby of babies) {
    const event = nextEvent(baby, now, t);

    // "Arrived today" is news you already have; there is nothing to warn about.
    if (event && event.kind !== "arrival" && event.daysUntil <= HORIZON_DAYS) {
      found.push(
        ...occasion(baby, event.date, now, LEAD_DAYS, "", (daysEarlier) =>
          lines(baby, event.kind, daysEarlier, t),
        ),
      );
    }

    if (!jewish || baby.status !== "born" || !baby.birthDate) continue;
    const name = displayName(baby, t);

    // A genuinely different day from the Gregorian birthday, and one that walks
    // around the year, so it is never the same reminder twice over.
    const birthday = hebrewBirthday(baby.birthDate, now);
    if (birthday.daysUntil <= HORIZON_DAYS) {
      found.push(
        ...occasion(baby, birthday.date, now, HEBREW_LEAD_DAYS, "hebrew:", (daysEarlier) =>
          daysEarlier === 0
            ? { title: say.hebrewTodayTitle(name), body: say.hebrewTodayBody }
            : { title: say.hebrewSoonTitle(name, daysEarlier), body: say.hebrewSoonBody },
        ),
      );
    }

    // Only a boy has one, and only in the week after the birth.
    if (baby.sex !== "boy") continue;
    const brit = britMilah(baby.birthDate, now);
    if (!brit.done) {
      found.push(
        ...occasion(baby, brit.date, now, BRIT_LEAD_DAYS, "brit:", (daysEarlier) =>
          daysEarlier === 0
            ? { title: say.britTodayTitle(name), body: say.britTodayBody }
            : { title: say.britSoonTitle(name, daysEarlier), body: say.britSoonBody },
        ),
      );
    }
  }

  return found.sort((a, b) => a.at - b.at);
}

/** Reminders that have come and gone, so the stored list does not grow forever. */
export function pruneNudges(nudges: Nudge[], now: Date): Nudge[] {
  return nudges.filter((nudge) => nudge.at > now.getTime() - DAY);
}
