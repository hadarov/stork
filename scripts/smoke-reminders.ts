/*
 * The calendar export, which is the only reminder in this app that reaches an
 * iPhone. Everything else needs a browser willing to wake a service worker on
 * a schedule; a subscribed calendar is the phone's own business, so if the
 * file is right the alerts arrive.
 *
 * Which makes the file worth checking properly. A calendar app will not tell
 * you it skipped a malformed line, or that an alarm it did read goes off at
 * midnight - it will simply say nothing on the morning you wanted it to.
 *
 * Usage: node --experimental-strip-types --test scripts/smoke-reminders.ts
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { toICalendar } from "../src/domain/ics.ts";
import type { Baby } from "../src/domain/types.ts";
import { en } from "../src/i18n/en.ts";
import { he } from "../src/i18n/he.ts";

/** Local-time constructor, matching how the app parses stored dates. */
const day = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const NOW = day("2026-09-01");

const baby = (over: Partial<Baby> = {}): Baby => ({
  id: "b1",
  name: "Mila",
  parents: ["Sarah"],
  status: "born",
  birthDate: "2024-06-15",
  updatedAt: "2024-06-15T00:00:00.000Z",
  ...over,
});

/* ------------------------------------------------------------- reading it */

/**
 * Folded lines put back together, which is the form a calendar app works on.
 * Asserting against the raw text would mean every test knowing where the
 * folder happened to break a line, which is not what any of them are about.
 */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n[ \t]/g, "").split("\r\n").filter(Boolean);
}

/** Each VEVENT as its own lines, without the BEGIN and END around it. */
function events(ics: string): string[][] {
  const found: string[][] = [];
  let current: string[] | null = null;

  for (const line of unfold(ics)) {
    if (line === "BEGIN:VEVENT") current = [];
    else if (line === "END:VEVENT") {
      if (current) found.push(current);
      current = null;
    } else current?.push(line);
  }

  return found;
}

/** The one event whose summary mentions `needle`, which is how a person finds it. */
function eventSaying(ics: string, needle: string): string[] {
  const match = events(ics).filter((lines) =>
    lines.some((line) => line.startsWith("SUMMARY:") && line.includes(needle)),
  );
  assert.equal(match.length, 1, `expected one event mentioning ${needle}, got ${match.length}`);
  return match[0];
}

/** A property's value. Parameters are left on the name, as they are in the file. */
function value(lines: string[], name: string): string {
  const line = lines.find((entry) => entry.split(":")[0].split(";")[0] === name);
  return line ? line.slice(line.indexOf(":") + 1) : "";
}

function triggers(lines: string[]): string[] {
  return lines
    .filter((line) => line.startsWith("TRIGGER"))
    .map((line) => line.slice(line.indexOf(":") + 1));
}

/* ------------------------------------------------------- what goes in it */

describe("everything worth being reminded of gets exported", () => {
  test("a due date, a birthday, and both at once across a book", () => {
    const ics = toICalendar(
      [
        baby({ id: "a", name: "Mila" }),
        baby({ id: "b", name: "Noa", status: "expecting", birthDate: undefined, dueDate: "2026-10-01" }),
      ],
      NOW,
      en,
    );

    assert.equal(events(ics).length, 2);
    assert.match(eventSaying(ics, "Mila").join("\n"), /DTSTART;VALUE=DATE:20240615/);
    assert.match(eventSaying(ics, "Noa").join("\n"), /DTSTART;VALUE=DATE:20261001/);
  });

  test("the Hebrew dates are written out only when the Hebrew calendar is on", () => {
    const off = toICalendar([baby()], NOW, en, false);
    const on = toICalendar([baby()], NOW, en, true);

    assert.equal(events(off).length, 1, "the Gregorian birthday and nothing else");
    assert.equal(events(on).length, 6, "five Hebrew birthdays as well, one per year");
  });

  test("a brit goes in for a boy still inside his first week", () => {
    const ics = toICalendar(
      [baby({ sex: "boy", birthDate: "2026-08-28" })],
      NOW,
      en,
      true,
    );
    const brit = eventSaying(ics, "brit");

    // The eighth day, counting the birth as the first.
    assert.equal(value(brit, "DTSTART"), "20260904");
    assert.match(value(brit, "DESCRIPTION"), /eighth day/);
  });

  test("and not for a girl, nor for a boy whose eighth day has been and gone", () => {
    const girl = toICalendar([baby({ sex: "girl", birthDate: "2026-08-28" })], NOW, en, true);
    const grown = toICalendar([baby({ sex: "boy", birthDate: "2024-06-15" })], NOW, en, true);

    for (const ics of [girl, grown]) {
      assert.ok(!unfold(ics).some((line) => line.includes("brit")), "no brit to remember");
    }
  });

  test("the brit is a Hebrew-calendar date, so it follows that switch too", () => {
    const ics = toICalendar([baby({ sex: "boy", birthDate: "2026-08-28" })], NOW, en, false);
    assert.ok(!unfold(ics).some((line) => line.includes("brit")));
  });

  test("a baby with no date at all is not invented one", () => {
    const undated = [
      baby({ id: "c", birthDate: undefined }),
      baby({ id: "d", status: "expecting", birthDate: undefined, dueDate: undefined }),
    ];
    assert.equal(events(toICalendar(undated, NOW, en, true)).length, 0);
  });

  test("an entry keeps its name between exports, so a second one corrects rather than doubles", () => {
    const babies = [
      baby({ sex: "boy", birthDate: "2026-08-28" }),
      baby({ id: "b", status: "expecting", birthDate: undefined, dueDate: "2026-10-01" }),
    ];
    const uids = (now: Date) =>
      events(toICalendar(babies, now, en, true))
        .map((lines) => value(lines, "UID"))
        .filter((uid) => !uid.includes("hebrew"))
        .sort();

    assert.deepEqual(uids(NOW), uids(day("2026-09-02")));
  });
});

/* --------------------------------------------------------- when it alerts */

describe("the alarms go off at an hour somebody is awake for", () => {
  /*
   * An all-day event starts at midnight, so these are counted from there: a
   * quarter to the day earlier than a whole number of days puts the alert at
   * nine, and the morning of the event is nine hours after it started.
   */
  const NINE_THE_DAY_BEFORE = "-PT15H";
  const NINE_ON_THE_DAY = "PT9H";

  test("a birthday warns a fortnight out, two days before, and on the morning", () => {
    const ics = toICalendar([baby()], NOW, en);
    assert.deepEqual(triggers(eventSaying(ics, "Mila")), [
      "-P13DT15H",
      "-P1DT15H",
      NINE_ON_THE_DAY,
    ]);
  });

  test("a due date starts three weeks out, when it stops being a prediction", () => {
    const ics = toICalendar(
      [baby({ status: "expecting", birthDate: undefined, dueDate: "2026-10-01" })],
      NOW,
      en,
    );
    assert.deepEqual(triggers(eventSaying(ics, "Mila")), [
      "-P20DT15H",
      "-P6DT15H",
      NINE_ON_THE_DAY,
    ]);
  });

  test("a Hebrew birthday takes the shorter notice it is worth", () => {
    const ics = toICalendar([baby()], NOW, en, true);
    const hebrew = events(ics).filter((lines) => value(lines, "UID").includes("hebrew"));

    assert.equal(hebrew.length, 5);
    for (const entry of hebrew) {
      assert.deepEqual(triggers(entry), ["-P1DT15H", NINE_ON_THE_DAY]);
    }
  });

  test("a brit gets the day before and an early start on the day", () => {
    const ics = toICalendar([baby({ sex: "boy", birthDate: "2026-08-28" })], NOW, en, true);
    // Seven rather than nine: a brit is generally over by nine o'clock.
    assert.deepEqual(triggers(eventSaying(ics, "brit")), [NINE_THE_DAY_BEFORE, "PT7H"]);
  });

  test("nothing is left to fire at midnight", () => {
    const ics = toICalendar(
      [
        baby({ sex: "boy", birthDate: "2026-08-28" }),
        baby({ id: "b", status: "expecting", birthDate: undefined, dueDate: "2026-10-01" }),
      ],
      NOW,
      en,
      true,
    );

    for (const trigger of events(ics).flatMap(triggers)) {
      assert.doesNotMatch(
        trigger,
        /^-?P\d*[DW]$/,
        `${trigger} is a whole number of days from midnight, which is midnight`,
      );
    }
  });

  test("every alarm says who and when, so a lock screen is enough on its own", () => {
    const ics = toICalendar([baby()], NOW, en);
    const alarms = unfold(ics);

    assert.equal(alarms.filter((line) => line === "ACTION:DISPLAY").length, 3);
    assert.ok(alarms.includes("DESCRIPTION:14 days to go: \u{1F382} Mila's birthday"));
    assert.ok(alarms.includes("DESCRIPTION:2 days to go: \u{1F382} Mila's birthday"));
    assert.ok(alarms.includes("DESCRIPTION:Today: \u{1F382} Mila's birthday"));
  });

  test("an alarm is explicit about what it hangs off", () => {
    const ics = toICalendar([baby()], NOW, en);
    for (const line of unfold(ics).filter((entry) => entry.startsWith("TRIGGER"))) {
      assert.match(line, /^TRIGGER;RELATED=START:/);
    }
  });
});

/* ----------------------------------------------------------- the file itself */

describe("the file is one a calendar will actually swallow", () => {
  const busy = () =>
    toICalendar(
      [
        baby({ sex: "boy", birthDate: "2026-08-28", name: "Genevieve Alexandra Wonderfully Long" }),
        baby({ id: "b", status: "expecting", birthDate: undefined, dueDate: "2026-10-01" }),
      ],
      NOW,
      he,
      true,
    );

  test("it is wrapped, and every block it opens it closes", () => {
    const lines = unfold(busy());

    assert.equal(lines[0], "BEGIN:VCALENDAR");
    assert.equal(lines.at(-1), "END:VCALENDAR");
    for (const block of ["VEVENT", "VALARM"]) {
      assert.equal(
        lines.filter((line) => line === `BEGIN:${block}`).length,
        lines.filter((line) => line === `END:${block}`).length,
      );
    }
  });

  test("every line ends CRLF, including the last", () => {
    const ics = busy();
    assert.ok(ics.endsWith("\r\n"));
    assert.doesNotMatch(ics.replace(/\r\n/g, ""), /[\r\n]/, "no stray bare newline");
  });

  test("no line runs past 75 octets, counted as octets rather than characters", () => {
    for (const line of busy().split("\r\n")) {
      assert.ok(
        new TextEncoder().encode(line).length <= 75,
        `line too long: ${JSON.stringify(line)}`,
      );
    }
  });

  test("and folding it is reversible, which is the only thing folding has to be", () => {
    const name = `\u{1F423} ${"ארוך".repeat(30)} \u{1F423}`;
    const ics = toICalendar([baby({ name })], NOW, he, false);

    assert.ok(
      unfold(ics).some((line) => line === `SUMMARY:\u{1F382} יום ההולדת של ${name}`),
      "the summary comes back exactly as it went in",
    );
  });

  test("a continuation never splits a character in half", () => {
    const ics = toICalendar([baby({ name: "\u{1F423}".repeat(40) })], NOW, en);
    for (const line of ics.split("\r\n")) {
      assert.ok(!line.includes("\uFFFD"));
      assert.equal([...line].every((char) => char.codePointAt(0) !== 0xfffd), true);
    }
  });

  test("punctuation in a name is escaped rather than read as syntax", () => {
    const ics = toICalendar([baby({ name: "Mila; the second, of two\\" })], NOW, en);
    assert.match(unfold(ics).join("\n"), /Mila\\; the second\\, of two\\\\/);
  });

  test("DTSTAMP is written in UTC, which is the only thing it may be written in", () => {
    const ics = toICalendar([baby()], day("2026-09-01"), en);
    const stamp = value(events(ics)[0], "DTSTAMP");

    assert.match(stamp, /^\d{8}T\d{6}Z$/);
    assert.equal(stamp, `${new Date(2026, 8, 1).toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`);
  });

  test("an all-day event ends on the following morning", () => {
    const birthday = eventSaying(toICalendar([baby()], NOW, en), "Mila");
    assert.equal(value(birthday, "DTSTART"), "20240615");
    assert.equal(value(birthday, "DTEND"), "20240616");
  });
});

/* ------------------------------------------------------------ recurrence */

describe("what comes round again by itself", () => {
  test("a birthday repeats yearly and a due date happens once", () => {
    assert.match(toICalendar([baby()], NOW, en), /RRULE:FREQ=YEARLY/);
    assert.doesNotMatch(
      toICalendar(
        [baby({ status: "expecting", birthDate: undefined, dueDate: "2026-10-01" })],
        NOW,
        en,
      ),
      /RRULE/,
    );
  });

  test("somebody born on a 29 February gets the last day of February instead", () => {
    // A plain yearly rule would skip three years in four, and the rest of the
    // app marks the day on the 28th in the years without a 29th.
    const ics = toICalendar([baby({ birthDate: "2024-02-29" })], NOW, en);
    assert.match(value(events(ics)[0], "RRULE"), /BYMONTH=2;BYMONTHDAY=-1/);
  });

  test("a Hebrew birthday is spelled out year by year, because no rule finds it", () => {
    const ics = toICalendar([baby()], NOW, en, true);
    const hebrew = events(ics).filter((lines) => value(lines, "UID").includes("hebrew"));

    for (const entry of hebrew) assert.equal(value(entry, "RRULE"), "");
    // Five different days, not the same day five times.
    assert.equal(new Set(hebrew.map((entry) => value(entry, "DTSTART"))).size, 5);
  });
});

/* --------------------------------------------------------------- Hebrew */

describe("in Hebrew", () => {
  test("the Hebrew calendar is assumed when the app is being read in Hebrew", () => {
    assert.equal(events(toICalendar([baby()], NOW, he)).length, 6);
    assert.equal(events(toICalendar([baby()], NOW, en)).length, 1);
  });

  test("the calendar names itself, and the events too, in Hebrew", () => {
    const ics = toICalendar([baby({ name: "מילה" })], NOW, he, false);
    assert.match(ics, /X-WR-CALNAME:סטורק/);
    assert.match(value(events(ics)[0], "SUMMARY"), /יום ההולדת של מילה/);
  });

  test("an alarm two days out is the dual, not a 2 in front of the plural", () => {
    const ics = toICalendar([baby({ name: "מילה" })], NOW, he, true);
    const hebrew = events(ics).filter((lines) => value(lines, "UID").includes("hebrew"))[0];
    const said = hebrew.filter((line) => line.startsWith("DESCRIPTION:"));

    assert.ok(said.some((line) => line.includes("עוד יומיים")));
    assert.ok(!said.some((line) => line.includes("2 ימים")));
  });

  test("and the day itself says so rather than counting to nothing", () => {
    const ics = toICalendar([baby({ name: "מילה" })], NOW, he);
    assert.ok(unfold(ics).some((line) => line.startsWith("DESCRIPTION:היום: ")));
  });

  test("a brit is named the way it is named", () => {
    const ics = toICalendar(
      [baby({ name: "אורי", sex: "boy", birthDate: "2026-08-28" })],
      NOW,
      he,
    );
    const brit = eventSaying(ics, "הברית");
    // The comma arrives escaped, which is the point of escaping it.
    assert.match(value(brit, "DESCRIPTION"), /^היום השמיני\\, \d/);
  });

  test("a birth date is said with the sex, because Hebrew cannot say it without", () => {
    const girl = toICalendar([baby({ name: "מילה", sex: "girl" })], NOW, he, false);
    const boy = toICalendar([baby({ name: "אורי", sex: "boy" })], NOW, he, false);
    const surprise = toICalendar([baby({ name: "מי" })], NOW, he, false);

    assert.match(value(events(girl)[0], "DESCRIPTION"), /^נולדה ב-/);
    assert.match(value(events(boy)[0], "DESCRIPTION"), /^נולד ב-/);
    assert.match(value(events(surprise)[0], "DESCRIPTION"), /^תאריך הלידה: /);
  });
});

/* ---------------------------------------------------- the Settings copy */

describe("what Settings says about all this", () => {
  test("it promises the thing that is true of every phone, and no more", () => {
    assert.match(en.share.calendar.body, /iPhone/);
    assert.match(en.share.calendar.body, /nothing is uploaded|no account/i);
  });

  test("it says the file is a snapshot rather than a live feed", () => {
    assert.match(en.share.calendar.snapshot, /export it again/i);
    assert.match(en.share.calendar.limits, /cannot/i);
  });

  test("and it is there in Hebrew too, in Hebrew", () => {
    for (const [key, line] of Object.entries(he.share.calendar)) {
      assert.equal(typeof line, "string", key);
      assert.doesNotMatch(line as string, /[A-Za-z]/, `${key} was left in English`);
    }
  });
});
