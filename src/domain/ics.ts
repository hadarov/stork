import { displayName, nextBirthday, ordinal, parseDate, toISODate } from "./derive.ts";
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

function eventsFor(baby: Baby, now: Date): Event[] {
  const who = displayName(baby);

  if (baby.status === "expecting") {
    if (!baby.dueDate) return [];
    return [
      {
        uid: `stork-due-${baby.id}`,
        start: parseDate(baby.dueDate),
        summary: `\u{1F423} ${who} is due`,
        description:
          baby.parents.length > 0
            ? `Due date for ${baby.parents.join(" and ")}.`
            : "Due date.",
        yearly: false,
      },
    ];
  }

  if (!baby.birthDate) return [];
  const birth = parseDate(baby.birthDate);
  const turning = nextBirthday(baby.birthDate, now).turning;
  return [
    {
      uid: `stork-birthday-${baby.id}`,
      start: birth,
      summary: `\u{1F382} ${who}'s birthday`,
      description: `Born ${baby.birthDate}. Turning ${ordinal(turning)} at the next one.`,
      yearly: true,
    },
  ];
}

/**
 * Recurring birthdays start on the actual birth date, so a calendar that shows
 * past occurrences also shows the day they were born.
 */
export function toICalendar(babies: Baby[], now: Date): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stork//Baby Book//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Stork - babies",
  ];

  for (const baby of babies) {
    for (const event of eventsFor(baby, now)) {
      lines.push(...renderEvent(event, now));
    }
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
