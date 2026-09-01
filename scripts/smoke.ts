/*
 * Every number this app shows is derived from a date, and dates are where this
 * kind of app quietly goes wrong: leap years, month ends, timezone rollover and
 * a zodiac that turns over on a moving date. The derivations are pure functions
 * that take "now" as an argument, so all of it can be checked without a browser.
 *
 * Usage: npm run smoke
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { chineseSign, starSign } from "../src/domain/almanac.ts";
import {
  addMonths,
  daysBetween,
  describeAge,
  describeLength,
  describeWeight,
  displayName,
  dueCountdown,
  milestones,
  monthsBetween,
  nextBirthday,
  nextEvent,
  ordinal,
  sortByNextEvent,
} from "../src/domain/derive.ts";
import { areSiblings, relation, siblingsOf } from "../src/domain/family.ts";
import { toICalendar } from "../src/domain/ics.ts";
import type { Baby } from "../src/domain/types.ts";
import { migrate } from "../src/storage/migrate.ts";
import { mergeRecords } from "../src/storage/repo.ts";
import { readBackup, toBackup } from "../src/storage/backup.ts";

/** Local-time constructor, matching how the app parses stored dates. */
const day = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const baby = (over: Partial<Baby> = {}): Baby => ({
  id: "test-id",
  parents: ["Sarah"],
  status: "born",
  birthDate: "2024-06-15",
  updatedAt: "2024-06-15T00:00:00.000Z",
  ...over,
});

describe("age", () => {
  test("a baby born today reads as born today, not as zero months", () => {
    assert.equal(describeAge("2026-09-01", day("2026-09-01")).label, "born today");
  });

  test("counts in days for the first fortnight", () => {
    assert.equal(describeAge("2026-09-01", day("2026-09-02")).label, "1 day old");
    assert.equal(describeAge("2026-09-01", day("2026-09-13")).label, "12 days old");
  });

  test("switches to weeks, then months, then years", () => {
    assert.equal(describeAge("2026-09-01", day("2026-09-15")).label, "2 weeks old");
    assert.equal(describeAge("2026-09-01", day("2026-12-01")).label, "3 months old");
    assert.equal(describeAge("2026-09-01", day("2028-08-01")).label, "23 months old");
    assert.equal(describeAge("2026-09-01", day("2028-09-01")).label, "2 years old");
    assert.equal(describeAge("2026-09-01", day("2029-03-01")).label, "2 years, 6 months old");
  });

  test("a month is not complete until the day of the month comes round", () => {
    assert.equal(monthsBetween(day("2026-01-15"), day("2026-02-14")), 0);
    assert.equal(monthsBetween(day("2026-01-15"), day("2026-02-15")), 1);
  });

  test("day counts survive a daylight saving change", () => {
    // Late March and late October are when a naive millisecond division slips.
    assert.equal(daysBetween(day("2026-03-28"), day("2026-03-30")), 2);
    assert.equal(daysBetween(day("2026-10-24"), day("2026-10-26")), 2);
  });
});

describe("birthdays", () => {
  test("a 29 February baby is celebrated on the 28th in common years", () => {
    const next = nextBirthday("2024-02-29", day("2025-01-01"));
    assert.equal(next.date.getMonth(), 1);
    assert.equal(next.date.getDate(), 28);
    assert.equal(next.turning, 1);
  });

  test("and on the 29th when there is one", () => {
    const next = nextBirthday("2024-02-29", day("2028-01-01"));
    assert.equal(next.date.getDate(), 29);
    assert.equal(next.turning, 4);
  });

  test("the day they were born is not a birthday", () => {
    const next = nextBirthday("2026-09-01", day("2026-09-01"));
    assert.equal(next.isToday, false);
    assert.equal(next.turning, 1);
    assert.equal(next.date.getFullYear(), 2027);
  });

  test("an actual birthday reads as today", () => {
    const next = nextBirthday("2024-09-01", day("2026-09-01"));
    assert.equal(next.isToday, true);
    assert.equal(next.turning, 2);
  });

  test("ordinals read correctly, including the teens", () => {
    assert.equal(ordinal(1), "1st");
    assert.equal(ordinal(2), "2nd");
    assert.equal(ordinal(3), "3rd");
    assert.equal(ordinal(4), "4th");
    assert.equal(ordinal(11), "11th");
    assert.equal(ordinal(21), "21st");
  });
});

describe("due dates", () => {
  test("counts down, then counts up once overdue", () => {
    assert.equal(dueCountdown("2026-09-01", day("2026-09-01")).label, "due today");
    assert.equal(dueCountdown("2026-09-02", day("2026-09-01")).label, "due tomorrow");
    assert.equal(dueCountdown("2026-09-08", day("2026-09-01")).label, "due in 7 days");
    assert.equal(dueCountdown("2026-10-01", day("2026-09-01")).label, "due in 4 weeks");
    assert.equal(dueCountdown("2026-08-29", day("2026-09-01")).label, "3 days overdue");
  });

  test("the due date itself is week 40", () => {
    const due = dueCountdown("2026-09-01", day("2026-09-01"));
    assert.equal(due.week, 40);
    assert.equal(due.trimester, 3);
    assert.equal(due.overdue, false);
  });

  test("trimesters land where a midwife would put them", () => {
    // 210 days to go is 10 completed weeks.
    assert.equal(dueCountdown("2026-09-01", day("2026-02-03")).trimester, 1);
    assert.equal(dueCountdown("2026-09-01", day("2026-05-01")).trimester, 2);
    assert.equal(dueCountdown("2026-09-01", day("2026-08-01")).trimester, 3);
  });

  test("a long overdue date never runs past the end of the scale", () => {
    assert.equal(dueCountdown("2020-01-01", day("2026-09-01")).week, 42);
  });
});

describe("star signs", () => {
  test("the usual ranges", () => {
    assert.equal(starSign(day("2024-07-25")).name, "Leo");
    assert.equal(starSign(day("2024-03-15")).name, "Pisces");
    assert.equal(starSign(day("2024-11-05")).name, "Scorpio");
  });

  test("Capricorn wraps the new year in one piece", () => {
    assert.equal(starSign(day("2024-12-25")).name, "Capricorn");
    assert.equal(starSign(day("2024-01-05")).name, "Capricorn");
  });

  test("the first and last day of a sign are flagged as a cusp", () => {
    assert.equal(starSign(day("2024-01-20")).cuspWith?.name, "Capricorn");
    assert.equal(starSign(day("2024-01-19")).cuspWith?.name, "Aquarius");
    assert.equal(starSign(day("2024-12-22")).cuspWith?.name, "Sagittarius");
  });

  test("the turn of the year is not a cusp, because Capricorn is on both sides", () => {
    assert.equal(starSign(day("2024-12-31")).cuspWith, undefined);
    assert.equal(starSign(day("2024-01-01")).cuspWith, undefined);
    assert.equal(starSign(day("2024-07-25")).cuspWith, undefined);
  });
});

describe("chinese zodiac", () => {
  test("the animal turns over at Lunar New Year, not on 1 January", () => {
    // 2024 was the Wood Dragon, but not until 10 February.
    assert.equal(chineseSign(day("2024-02-09")).animal, "Rabbit");
    assert.equal(chineseSign(day("2024-02-10")).animal, "Dragon");
    assert.equal(chineseSign(day("2024-01-15")).animal, "Rabbit");
  });

  test("elements follow the ten year stem cycle", () => {
    assert.deepEqual(
      { ...chineseSign(day("2024-06-15")) },
      { animal: "Dragon", emoji: "\u{1F409}", element: "Wood", year: 2024, trait: chineseSign(day("2024-06-15")).trait },
    );
    assert.equal(chineseSign(day("2020-06-15")).element, "Metal");
    assert.equal(chineseSign(day("2019-06-15")).element, "Earth");
    assert.equal(chineseSign(day("2026-06-15")).element, "Fire");
  });

  test("more new year boundaries", () => {
    assert.equal(chineseSign(day("2025-01-28")).animal, "Dragon");
    assert.equal(chineseSign(day("2025-01-29")).animal, "Snake");
    assert.equal(chineseSign(day("2020-01-24")).animal, "Pig");
    assert.equal(chineseSign(day("2020-01-25")).animal, "Rat");
    assert.equal(chineseSign(day("2026-02-17")).animal, "Horse");
  });
});

describe("milestones", () => {
  test("half birthdays clamp to the end of a shorter month", () => {
    const halfway = addMonths(day("2024-08-31"), 6);
    assert.equal(halfway.getMonth(), 1);
    assert.equal(halfway.getDate(), 28);
  });

  test("past milestones are marked done and future ones are not", () => {
    const points = milestones("2026-01-01", day("2026-05-01"));
    const byKey = Object.fromEntries(points.map((point) => [point.key, point]));
    assert.equal(byKey.d100?.done, true);
    assert.equal(byKey.m6?.done, false);
    assert.equal(byKey.y1?.done, false);
  });
});

describe("what happens next", () => {
  test("an expecting baby shows its due date", () => {
    const event = nextEvent(
      baby({ status: "expecting", birthDate: undefined, dueDate: "2026-09-20" }),
      day("2026-09-01"),
    );
    assert.equal(event?.kind, "due");
    assert.equal(event?.label, "due in 19 days");
  });

  test("a baby born today is celebrated rather than counted down", () => {
    const event = nextEvent(baby({ birthDate: "2026-09-01" }), day("2026-09-01"));
    assert.equal(event?.kind, "arrival");
  });

  test("a milestone only wins when it lands before the birthday", () => {
    const event = nextEvent(baby({ birthDate: "2026-06-01" }), day("2026-09-01"));
    assert.equal(event?.kind, "milestone");
    assert.equal(event?.label, "100 days in 8 days");
  });

  test("otherwise the birthday wins", () => {
    const event = nextEvent(baby({ birthDate: "2024-09-20" }), day("2026-09-01"));
    assert.equal(event?.kind, "birthday");
    assert.equal(event?.label, "turns 2nd in 19 days");
  });

  test("babies with no dates at all sort to the end instead of throwing", () => {
    const undated = baby({ id: "b", status: "expecting", birthDate: undefined, dueDate: undefined });
    const soon = baby({ id: "a", status: "expecting", birthDate: undefined, dueDate: "2026-09-03" });
    const order = sortByNextEvent([undated, soon], day("2026-09-01")).map((b) => b.id);
    assert.deepEqual(order, ["a", "b"]);
  });

  test("an unnamed baby is described by its parents", () => {
    assert.equal(displayName(baby({ name: undefined })), "Sarah's baby");
    assert.equal(displayName(baby({ name: "Mila" })), "Mila");
  });
});

describe("families", () => {
  const of = (id: string, parents: string[], over: Partial<Baby> = {}): Baby => ({
    id,
    name: id,
    parents,
    status: "born",
    birthDate: "2022-01-01",
    updatedAt: "2022-01-01T00:00:00.000Z",
    ...over,
  });

  test("sharing a parent makes two babies siblings, whatever the spelling", () => {
    assert.equal(areSiblings(of("a", ["Sarah", "Tom"]), of("b", [" sarah "])), true);
  });

  test("different parents are different families", () => {
    assert.equal(areSiblings(of("a", ["Sarah"]), of("b", ["Dana"])), false);
  });

  test("a baby is not their own sibling", () => {
    assert.equal(areSiblings(of("a", ["Sarah"]), of("a", ["Sarah"])), false);
  });

  test("a blank parent name does not marry two families together", () => {
    assert.equal(areSiblings(of("a", ["Sarah", "  "]), of("b", ["", "Dana"])), false);
  });

  test("siblings come back oldest first, with anyone on the way last", () => {
    const all = [
      of("bump", ["Sarah"], { status: "expecting", birthDate: undefined, dueDate: "2026-11-01" }),
      of("younger", ["Sarah"], { birthDate: "2024-03-04" }),
      of("eldest", ["Sarah"], { birthDate: "2019-07-02" }),
    ];
    assert.deepEqual(
      siblingsOf(of("me", ["Sarah"], { birthDate: "2021-01-01" }), all).map((baby) => baby.id),
      ["eldest", "younger", "bump"],
    );
  });

  test("an older girl is a big sister and a younger boy a little brother", () => {
    const me = of("me", ["Sarah"], { birthDate: "2022-01-01" });
    assert.equal(relation(me, of("a", ["Sarah"], { birthDate: "2019-01-01", sex: "girl" })), "big sister");
    assert.equal(relation(me, of("b", ["Sarah"], { birthDate: "2024-01-01", sex: "boy" })), "little brother");
  });

  test("without a sex it is just an older or younger sibling", () => {
    const me = of("me", ["Sarah"], { birthDate: "2022-01-01" });
    assert.equal(relation(me, of("a", ["Sarah"], { birthDate: "2019-01-01" })), "older sibling");
    assert.equal(
      relation(me, of("b", ["Sarah"], { birthDate: "2024-01-01", sex: "surprise" })),
      "younger sibling",
    );
  });

  test("a bump is younger than a baby who is already here", () => {
    const me = of("me", ["Sarah"], { birthDate: "2022-01-01" });
    const bump = of("b", ["Sarah"], {
      status: "expecting",
      birthDate: undefined,
      dueDate: "2019-01-01",
      sex: "girl",
    });
    assert.equal(relation(me, bump), "little sister");
  });
});

describe("how big", () => {
  test("a birth weight reads in kilograms and in pounds and ounces", () => {
    assert.deepEqual(describeWeight(3400), { metric: "3.4 kg", imperial: "7 lb 8 oz" });
  });

  test("a round weight drops its decimals rather than showing 3.00 kg", () => {
    assert.equal(describeWeight(3000).metric, "3 kg");
  });

  test("sixteen ounces carry into a pound instead of reading 9 lb 16 oz", () => {
    assert.equal(describeWeight(4536).imperial, "10 lb 0 oz");
  });

  test("a length reads in centimetres and in inches", () => {
    assert.deepEqual(describeLength(51), { metric: "51 cm", imperial: "20.1 in" });
  });
});

describe("stored data", () => {
  test("unreadable storage yields an empty book rather than a crash", () => {
    assert.deepEqual(migrate("not json at all").babies, []);
    assert.deepEqual(migrate(null).babies, []);
    assert.deepEqual(migrate(42).babies, []);
  });

  test("a bare array of babies imports cleanly", () => {
    const store = migrate([{ name: "Mila", birthDate: "2024-06-15" }]);
    assert.equal(store.babies.length, 1);
    assert.equal(store.babies[0]?.status, "born");
  });

  test("a born baby with no birth date is demoted rather than left broken", () => {
    const store = migrate([{ name: "Mila", status: "born", dueDate: "2026-10-01" }]);
    assert.equal(store.babies[0]?.status, "expecting");
    assert.equal(store.babies[0]?.dueDate, "2026-10-01");
  });

  test("plausible birth measurements are kept and silly ones are dropped", () => {
    const store = migrate([
      {
        name: "Mila",
        status: "born",
        birthDate: "2024-06-15",
        birthWeightGrams: 3400,
        birthLengthCm: 51,
      },
      {
        name: "Titan",
        status: "born",
        birthDate: "2024-06-15",
        birthWeightGrams: 90000,
        birthLengthCm: 4,
      },
    ]);
    assert.equal(store.babies[0]?.birthWeightGrams, 3400);
    assert.equal(store.babies[0]?.birthLengthCm, 51);
    assert.equal(store.babies[1]?.birthWeightGrams, undefined);
    assert.equal(store.babies[1]?.birthLengthCm, undefined);
  });

  test("album entries without a picture are dropped and the rest survive", () => {
    const store = migrate([
      {
        name: "Mila",
        status: "born",
        birthDate: "2024-06-15",
        photos: [
          { id: "a", data: "data:image/jpeg;base64,aaa", date: "2024-06-16", caption: "Day one" },
          { id: "b", data: "not-an-image", date: "2024-07-01" },
          { id: "c", data: "data:image/png;base64,ccc" },
        ],
      },
    ]);

    const photos = store.babies[0]?.photos ?? [];
    assert.deepEqual(
      photos.map((photo) => photo.id),
      ["a", "c"],
    );
    assert.equal(photos[0]?.caption, "Day one");
    // Undated, so it falls back to the birthday rather than being thrown away.
    assert.equal(photos[1]?.date, "2024-06-15");
  });

  test("an import cannot smuggle in more photos than the app allows", () => {
    const photos = Array.from({ length: 40 }, (_unused, index) => ({
      id: `p${index}`,
      data: "data:image/jpeg;base64,aaa",
      date: "2024-06-16",
    }));
    const store = migrate([{ name: "Mila", status: "born", birthDate: "2024-06-15", photos }]);
    assert.equal(store.babies[0]?.photos?.length, 12);
  });

  test("a baby who has not arrived cannot have been weighed", () => {
    const store = migrate([
      { name: "Poppy", status: "expecting", dueDate: "2026-10-01", birthWeightGrams: 3400 },
    ]);
    assert.equal(store.babies[0]?.birthWeightGrams, undefined);
  });

  test("a baby who is here keeps a birthday and loses any due date", () => {
    const store = migrate([
      { name: "Mila", status: "born", birthDate: "2024-06-15", dueDate: "2024-06-20" },
    ]);
    assert.equal(store.babies[0]?.birthDate, "2024-06-15");
    assert.equal(store.babies[0]?.dueDate, undefined);
  });

  test("empty shells and duplicate ids are dropped", () => {
    const store = migrate([
      { notes: "no name, no dates" },
      { id: "x", name: "Mila", birthDate: "2024-06-15" },
      { id: "x", name: "Copy", birthDate: "2024-06-15" },
    ]);
    assert.equal(store.babies.length, 1);
    assert.equal(store.babies[0]?.name, "Mila");
  });

  test("bad dates and foreign photo payloads are rejected", () => {
    const store = migrate([
      { name: "Mila", birthDate: "15/06/2024", dueDate: "2026-10-01", photo: "javascript:alert(1)" },
    ]);
    assert.equal(store.babies[0]?.birthDate, undefined);
    assert.equal(store.babies[0]?.photo, undefined);
  });
});

describe("merging", () => {
  const base = baby({ id: "1", name: "Mila", updatedAt: "2026-01-01T00:00:00.000Z" });

  test("the newer record wins", () => {
    const { babies, result } = mergeRecords(
      [base],
      [{ ...base, name: "Mila Rose", updatedAt: "2026-02-01T00:00:00.000Z" }],
    );
    assert.equal(babies[0]?.name, "Mila Rose");
    assert.deepEqual(result, { added: 0, updated: 1, skipped: 0 });
  });

  test("an older record is left alone", () => {
    const { babies, result } = mergeRecords(
      [base],
      [{ ...base, name: "Stale", updatedAt: "2025-01-01T00:00:00.000Z" }],
    );
    assert.equal(babies[0]?.name, "Mila");
    assert.equal(result.skipped, 1);
  });

  test("unknown records are added", () => {
    const { babies, result } = mergeRecords([base], [baby({ id: "2", name: "Theo" })]);
    assert.equal(babies.length, 2);
    assert.equal(result.added, 1);
  });

  test("a backup round trip keeps tombstones, so deletions are not undone", () => {
    const deleted = baby({ id: "3", deletedAt: "2026-03-01T00:00:00.000Z" });
    const restored = readBackup(toBackup([deleted], new Date("2026-03-02T00:00:00.000Z")));
    assert.equal(restored[0]?.deletedAt, "2026-03-01T00:00:00.000Z");
  });
});

describe("calendar export", () => {
  const now = day("2026-09-01");

  test("birthdays recur every year and due dates do not", () => {
    const born = toICalendar([baby({ name: "Mila", birthDate: "2024-06-15" })], now);
    assert.match(born, /RRULE:FREQ=YEARLY/);

    const expecting = toICalendar(
      [baby({ status: "expecting", birthDate: undefined, dueDate: "2026-10-01" })],
      now,
    );
    assert.doesNotMatch(expecting, /RRULE/);
    assert.match(expecting, /DTSTART;VALUE=DATE:20261001/);
  });

  test("an all-day event ends on the following morning", () => {
    const ics = toICalendar([baby({ name: "Mila", birthDate: "2024-06-15" })], now);
    assert.match(ics, /DTSTART;VALUE=DATE:20240615/);
    assert.match(ics, /DTEND;VALUE=DATE:20240616/);
  });

  test("every line is CRLF terminated and folded within 75 octets", () => {
    const ics = toICalendar(
      [baby({ name: "Genevieve Alexandra Wonderfully Long Name The Third", birthDate: "2024-06-15" })],
      now,
    );
    assert.ok(ics.endsWith("\r\n"));
    for (const line of ics.split("\r\n")) {
      assert.ok(
        new TextEncoder().encode(line).length <= 75,
        `line too long: ${JSON.stringify(line)}`,
      );
    }
  });

  test("commas in a name are escaped rather than splitting the field", () => {
    const ics = toICalendar([baby({ name: "Mila, the second", birthDate: "2024-06-15" })], now);
    assert.match(ics, /Mila\\, the second/);
  });
});
