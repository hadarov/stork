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
import { britMilah, hebrewBirthday, hebrewDateText } from "./hebrew.ts";
import type { Baby } from "./types.ts";

/**
 * Web push on a home-screen web app is too unreliable to hang reminders on, so
 * the app hands the dates to the calendar the phone already nags you with.
 *
 * This is the only route that reaches every phone. Stork's own reminders need
 * the browser to wake a service worker on a schedule, which Chromium does and
 * Safari does not, so on an iPhone they arrive when the app is next opened or
 * not at all. A calendar subscription is handled by the operating system, so
 * the alarms below are the ones that actually go off.
 */

function stamp(date: Date): string {
  return toISODate(date).replaceAll("-", "");
}

/** DTSTAMP is when the file was written, and RFC 5545 defines it in UTC. */
function utcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
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

/* ----------------------------------------------------------- the alarms */

/** Nine: past the school run, and inside the hours a shop is open. */
const MORNING = 9;

/**
 * A brit is held in the morning, generally straight after shacharit, so nine
 * o'clock on the day would land during it rather than in time for it.
 */
const EARLY = 7;

type Alarm = { daysBefore: number; hour: number };

/**
 * Every event here is all-day, so it starts at midnight, so a trigger written
 * in whole days goes off at midnight too: `-P2D` is the top of the day before
 * last, which nobody is awake for and which the phone has swept away by
 * breakfast. Triggers are therefore counted in hours, which is the only way to
 * name an hour at all against a date with no time in it.
 *
 * An alarm `daysBefore` days early at `hour` sits `daysBefore * 24 - hour`
 * hours before that midnight. The count goes negative for the morning of the
 * day itself, which is after the event starts rather than before it.
 */
function triggerFor(alarm: Alarm): string {
  const hours = alarm.daysBefore * 24 - alarm.hour;
  if (hours <= 0) return `PT${-hours}H`;

  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return `-P${days > 0 ? `${days}D` : ""}${rest > 0 ? `T${rest}H` : ""}`;
}

type EventKind = "due" | "birthday" | "hebrew" | "brit";

/**
 * How much warning each occasion is worth, which is not the same answer four
 * times over.
 *
 * A **birthday** is known a year in advance and the only real question is
 * whether there is still time to send something. A fortnight covers ordering
 * and posting it; two days is the point at which the answer becomes a card
 * from a shop rather than a parcel, and catches anyone who ignored the first;
 * the morning itself is for saying it.
 *
 * A **due date** is a prediction rather than an appointment, so it is warned
 * about earlier and more gently. Forty weeks is the middle of a window, not
 * the end of one: a baby is full term at thirty-seven weeks, which is three
 * weeks before the date, and from that morning on it could genuinely be any
 * day. A week before and the date itself follow, and the date itself is worth
 * having precisely because it so often passes with nothing having happened.
 *
 * A **Hebrew birthday** is a thing to mention rather than a thing to shop for
 * - the shopping was done for the Gregorian one, some weeks either side - so
 * it takes the short notice the app's own reminders give it.
 *
 * A **brit** is the eighth day. A fortnight's warning would have had to be
 * given before the baby was born, so it gets the day before and an early
 * start on the morning.
 */
const ALARMS: Record<EventKind, Alarm[]> = {
  due: [
    { daysBefore: 21, hour: MORNING },
    { daysBefore: 7, hour: MORNING },
    { daysBefore: 0, hour: MORNING },
  ],
  birthday: [
    { daysBefore: 14, hour: MORNING },
    { daysBefore: 2, hour: MORNING },
    { daysBefore: 0, hour: MORNING },
  ],
  hebrew: [
    { daysBefore: 2, hour: MORNING },
    { daysBefore: 0, hour: MORNING },
  ],
  brit: [
    { daysBefore: 1, hour: MORNING },
    { daysBefore: 0, hour: EARLY },
  ],
};

/* ----------------------------------------------------------- the events */

type Event = {
  kind: EventKind;
  uid: string;
  start: Date;
  summary: string;
  description: string;
  /** The body of an RRULE, for the occasions that come round on their own. */
  repeat?: string;
};

/**
 * A plain yearly rule on somebody born on 29 February only comes round in leap
 * years, and the rest of the app celebrates them on the 28th in between. The
 * last day of February is that same rule in a form a calendar can follow.
 */
function yearlyRule(birth: Date): string {
  const leapling = birth.getMonth() === 1 && birth.getDate() === 29;
  return leapling ? "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1" : "FREQ=YEARLY";
}

function renderEvent(event: Event, now: Date, t: Catalog): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART;VALUE=DATE:${stamp(event.start)}`,
    `DTEND;VALUE=DATE:${stamp(dayAfter(event.start))}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    "TRANSP:TRANSPARENT",
  ];
  if (event.repeat) lines.push(`RRULE:${event.repeat}`);

  for (const alarm of ALARMS[event.kind]) {
    // An alert is read off a lock screen without the event around it, so it
    // carries the occasion as well as how far off it is.
    const words =
      alarm.daysBefore === 0
        ? t.share.ics.alarmToday(event.summary)
        : t.share.ics.alarmAhead(event.summary, alarm.daysBefore);

    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      // RELATED=START is the default, and is spelled out because the whole
      // scheme above depends on it being start and not end.
      `TRIGGER;RELATED=START:${triggerFor(alarm)}`,
      `DESCRIPTION:${escapeText(words)}`,
      "END:VALARM",
    );
  }

  lines.push("END:VEVENT");
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
      kind: "hebrew",
      // Keyed on the age rather than the date, so re-exporting after the
      // calendar has already swallowed one updates it instead of doubling it.
      uid: `stork-hebrew-${baby.id}-${birthday.turning}`,
      start: birthday.date,
      summary: t.share.ics.hebrewSummary(who),
      // A year without a 30th of that month puts the day somewhere that needs
      // explaining, and a calendar entry is read long after the app is closed.
      description: birthday.moved ? `${description} ${t.hebrew.moved}` : description,
    });
  }

  return events;
}

/**
 * The eighth day, which is the one date in this file that is over within a
 * week of being written. A brit that has already happened is not a date for
 * anybody's calendar, so an older baby contributes nothing here.
 */
function britEvent(baby: Baby, now: Date, t: Catalog, who: string): Event[] {
  if (baby.sex !== "boy" || !baby.birthDate) return [];

  const brit = britMilah(baby.birthDate, now);
  if (brit.done) return [];

  return [
    {
      kind: "brit",
      uid: `stork-brit-${baby.id}`,
      start: brit.date,
      summary: t.share.ics.britSummary(who),
      description: t.share.ics.britDescription(formatDate(brit.date, t)),
    },
  ];
}

function eventsFor(baby: Baby, now: Date, t: Catalog, jewish: boolean): Event[] {
  const who = displayName(baby, t);

  if (baby.status === "expecting") {
    if (!baby.dueDate) return [];
    return [
      {
        kind: "due",
        uid: `stork-due-${baby.id}`,
        start: parseDate(baby.dueDate),
        summary: t.share.ics.dueSummary(who),
        description:
          baby.parents.length > 0
            ? t.share.ics.dueDescription(describeParents(baby.parents, t))
            : t.share.ics.dueDescriptionPlain,
      },
    ];
  }

  if (!baby.birthDate) return [];
  const birth = parseDate(baby.birthDate);
  const turning = nextBirthday(baby.birthDate, now).turning;

  const events: Event[] = [
    {
      kind: "birthday",
      uid: `stork-birthday-${baby.id}`,
      start: birth,
      summary: t.share.ics.birthdaySummary(who),
      description: t.share.ics.birthdayDescription(
        formatDate(birth, t),
        t.ordinal(turning),
        baby.sex,
      ),
      repeat: yearlyRule(birth),
    },
  ];

  if (jewish) {
    events.push(...hebrewEvents(baby, now, t, who), ...britEvent(baby, now, t, who));
  }
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
      lines.push(...renderEvent(event, now, t));
    }
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
