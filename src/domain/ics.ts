import type { Catalog } from "../i18n/en.ts";
import {
  addDays,
  describeParents,
  displayName,
  formatDate,
  nextBirthday,
  parseDate,
  toISODate,
} from "./derive.ts";
import { hebrewBirthday, hebrewDateText } from "./hebrew.ts";
import type { Baby } from "./types.ts";

/**
 * Web push on a home-screen web app is too unreliable to hang reminders on, so
 * the app hands the dates to the calendar the phone already nags you with.
 */

function stamp(date: Date): string {
  return toISODate(date).replaceAll("-", "");
}

/** iCalendar all-day events end on the morning after they finish. */
function dayAfter(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * RFC 5545 caps a line at 75 octets and continues it with a leading space.
 * Emoji push lines over that limit quickly, so this folds on byte length and
 * never splits a multi-byte character.
 */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  let limit = 75;

  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (currentBytes + size > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
      limit = 74; // the continuation space costs one octet
    }
    current += char;
    currentBytes += size;
  }
  if (current) parts.push(current);

  return parts.join("\r\n ");
}

type Event = {
  uid: string;
  start: Date;
  summary: string;
  description: string;
  yearly: boolean;
};

function renderEvent(event: Event, now: Date): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(now)}T000000Z`,
    `DTSTART;VALUE=DATE:${stamp(event.start)}`,
    `DTEND;VALUE=DATE:${stamp(dayAfter(event.start))}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    "TRANSP:TRANSPARENT",
  ];
  if (event.yearly) lines.push("RRULE:FREQ=YEARLY");
  lines.push(
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    // Two days of warning is enough to actually buy something.
    "TRIGGER:-P2D",
    `DESCRIPTION:${escapeText(event.summary)}`,
    "END:VALARM",
    "END:VEVENT",
  );
  return lines;
}

/**
 * How many Hebrew birthdays to write out. A Hebrew birthday is not a fixed
 * Gregorian date - the two calendars slide past each other by a couple of weeks
 * a year - so there is no yearly rule that would find it and each one has to be
 * spelled out. Five is far enough ahead to be useful and short enough that the
 * file stays a file rather than a database; the app writes a fresh one whenever
 * it is asked.
 */
const HEBREW_YEARS = 5;

function hebrewEvents(baby: Baby, now: Date, t: Catalog, who: string): Event[] {
  if (!baby.birthDate) return [];

  const events: Event[] = [];
  let from = now;
  let last = 0;

  // Twice round for every year wanted, because some laps find nothing new: asked
  // again from the day after a 30th of Kislev, the calendar offers the first of
  // Tevet in the same Hebrew year, which is where that birthday goes in the years
  // there is no 30th. The first answer for a year is the right one, so a second
  // one for the same age is walked past rather than written down twice.
  for (let step = 0; step < HEBREW_YEARS * 2 && events.length < HEBREW_YEARS; step += 1) {
    const birthday = hebrewBirthday(baby.birthDate, from);
    // The day after this one, so the next lap looks past it.
    from = addDays(birthday.date, 1);
    if (birthday.turning <= last) continue;
    last = birthday.turning;

    const description = t.share.ics.hebrewDescription(
      hebrewDateText(birthday.date, t),
      t.ordinal(birthday.turning),
    );

    events.push({
      // Keyed on the age rather than the date, so re-exporting after the
      // calendar has already swallowed one updates it instead of doubling it.
      uid: `stork-hebrew-${baby.id}-${birthday.turning}`,
      start: birthday.date,
      summary: t.share.ics.hebrewSummary(who),
      // A year without a 30th of that month puts the day somewhere that needs
      // explaining, and a calendar entry is read long after the app is closed.
      description: birthday.moved ? `${description} ${t.hebrew.moved}` : description,
      yearly: false,
    });
  }

  return events;
}

function eventsFor(baby: Baby, now: Date, t: Catalog, jewish: boolean): Event[] {
  const who = displayName(baby, t);

  if (baby.status === "expecting") {
    if (!baby.dueDate) return [];
    return [
      {
        uid: `stork-due-${baby.id}`,
        start: parseDate(baby.dueDate),
        summary: t.share.ics.dueSummary(who),
        description:
          baby.parents.length > 0
            ? t.share.ics.dueDescription(describeParents(baby.parents, t))
            : t.share.ics.dueDescriptionPlain,
        yearly: false,
      },
    ];
  }

  if (!baby.birthDate) return [];
  const birth = parseDate(baby.birthDate);
  const turning = nextBirthday(baby.birthDate, now).turning;

  const events: Event[] = [
    {
      uid: `stork-birthday-${baby.id}`,
      start: birth,
      summary: t.share.ics.birthdaySummary(who),
      description: t.share.ics.birthdayDescription(
        formatDate(birth, t),
        t.ordinal(turning),
        baby.sex,
      ),
      yearly: true,
    },
  ];

  if (jewish) events.push(...hebrewEvents(baby, now, t, who));
  return events;
}

/**
 * Recurring birthdays start on the actual birth date, so a calendar that shows
 * past occurrences also shows the day they were born.
 *
 * `jewish` follows the language unless a caller says otherwise, which is the
 * same default the app itself uses: reading the app in Hebrew is a fair guess
 * at wanting the Hebrew dates, and the switch in Settings is the real answer.
 */
export function toICalendar(
  babies: Baby[],
  now: Date,
  t: Catalog,
  jewish = t.code === "he",
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stork//Baby Book//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(t.share.ics.calendarName)}`,
  ];

  for (const baby of babies) {
    for (const event of eventsFor(baby, now, t, jewish)) {
      lines.push(...renderEvent(event, now));
    }
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
