import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { addDays, toISODate } from "../src/domain/derive.ts";
import {
  britMilah,
  chagOn,
  hebrewBirthday,
  hebrewDateText,
  hebrewParts,
} from "../src/domain/hebrew.ts";
import { en } from "../src/i18n/en.ts";
import { he } from "../src/i18n/he.ts";

/** A civil date at midday, which is the only time of day the app deals in. */
const on = (iso: string) => new Date(`${iso}T12:00:00`);

describe("reading a Hebrew date", () => {
  test("it converts a plain day", () => {
    assert.deepEqual(hebrewParts(on("2024-06-15")), { year: 5784, month: "sivan", day: 9 });
  });

  test("it knows the first of Tishri", () => {
    assert.deepEqual(hebrewParts(on("2024-10-03")), { year: 5785, month: "tishri", day: 1 });
  });

  test("it tells the two Adars apart in a leap year", () => {
    assert.equal(hebrewParts(on("2027-02-22")).month, "adar1");
    assert.equal(hebrewParts(on("2027-03-23")).month, "adar2");
  });

  test("and a year with one Adar just has Adar", () => {
    assert.equal(hebrewParts(on("2025-03-14")).month, "adar");
  });

  test("it writes itself out in the language being read", () => {
    // Latin numerals rather than gematria: no engine offers ט״ו reliably, and
    // an app that prints "י״ז" on one phone and "17" on another is worse than
    // one that prints "17" on both.
    assert.equal(hebrewDateText(on("2024-06-15"), he), "9 בסיוון 5784");
    assert.equal(hebrewDateText(on("2024-06-15"), en), "9 Sivan 5784");
  });
});

describe("the chagim", () => {
  const cases: [string, string | null][] = [
    ["2024-10-03", "roshHashana"],
    ["2024-10-12", "yomKippur"],
    ["2024-10-17", "sukkot"],
    ["2024-10-24", "simchatTorah"],
    ["2024-12-26", "chanukah"],
    ["2025-01-01", "chanukah"],
    ["2025-02-13", "tuBiShvat"],
    ["2025-03-14", "purim"],
    ["2025-04-13", "pesach"],
    ["2025-05-03", "yomHaatzmaut"],
    ["2025-05-16", "lagBaomer"],
    ["2025-06-02", "shavuot"],
    ["2025-08-03", "tishaBav"],
    ["2025-08-09", "tuBav"],
    // An ordinary Tuesday in Cheshvan.
    ["2024-11-12", null],
  ];

  for (const [iso, expected] of cases) {
    test(`${iso} is ${expected ?? "an ordinary day"}`, () => {
      assert.equal(chagOn(on(iso)), expected);
    });
  }

  test("Chanukah ends when it ends, whatever length Kislev was", () => {
    // 5785 has a 30-day Kislev, so the eighth night is 2 Tevet and 3 Tevet is not.
    assert.equal(hebrewParts(on("2025-01-02")).day, 2);
    assert.equal(chagOn(on("2025-01-02")), "chanukah");
    assert.equal(chagOn(on("2025-01-03")), null);
  });

  test("a leap year gets Purim Katan as well as Purim", () => {
    assert.equal(chagOn(on("2027-02-21")), "purimKatan");
    assert.equal(chagOn(on("2027-03-23")), "purim");
  });
});

describe("the Hebrew birthday", () => {
  test("it lands on the same Hebrew day, not the same Gregorian one", () => {
    // 9 Sivan 5784 was 15 June 2024; 9 Sivan 5785 was 5 June 2025.
    const next = hebrewBirthday("2024-06-15", on("2025-01-01"));
    assert.equal(toISODate(next.date), "2025-06-05");
    assert.equal(next.turning, 1);
  });

  test("it walks around the year, as a lunisolar calendar does", () => {
    const first = hebrewBirthday("2024-06-15", on("2025-01-01"));
    const second = hebrewBirthday("2024-06-15", on("2025-07-01"));
    assert.equal(toISODate(second.date), "2026-05-25");
    assert.equal(second.turning, 2);
    // Two Hebrew years apart, and nowhere near 365 days apart.
    assert.notEqual(first.date.getMonth(), second.date.getMonth());
  });

  test("the day they were born is not a birthday", () => {
    const next = hebrewBirthday("2024-06-15", on("2024-06-15"));
    assert.equal(next.turning, 1);
    assert.ok(next.daysUntil > 300, "should be waiting for next year, not today");
  });

  test("it notices when today is the day", () => {
    const next = hebrewBirthday("2024-06-15", on("2025-06-05"));
    assert.equal(next.isToday, true);
    assert.equal(next.daysUntil, 0);
  });

  test("somebody born in plain Adar keeps to Adar II in a leap year", () => {
    // 14 Adar 5785 was 14 March 2025. 5787 is a leap year.
    const next = hebrewBirthday("2025-03-14", on("2027-01-01"));
    assert.equal(hebrewParts(next.date).month, "adar2");
    assert.equal(hebrewParts(next.date).day, 14);
  });

  test("and somebody born in Adar I gets the one Adar in a plain year", () => {
    // 15 Adar I 5787 was 22 February 2027. 5788 has a single Adar.
    const next = hebrewBirthday("2027-02-22", on("2028-01-01"));
    assert.equal(hebrewParts(next.date).month, "adar");
    assert.equal(hebrewParts(next.date).day, 15);
  });

  test("walking past a real 30th does not hand back a birthday that has gone", () => {
    // 30 Kislev 5786 fell on 20 December 2025 and really existed, so asking on
    // the 21st must reach forward a year rather than offering the first of
    // Tevet as a date that had to move. It did not have to move: it happened.
    const birth = "2024-12-31";
    assert.equal(toISODate(hebrewBirthday(birth, on("2025-12-20")).date), "2025-12-20");

    const after = hebrewBirthday(birth, on("2025-12-21"));
    assert.equal(after.turning, 2, "should be looking at the year after, not the one just missed");
    assert.equal(after.moved, false);
    assert.ok(after.daysUntil > 300, "the next one is a Hebrew year away");
  });

  test("but a year that really has no 30th still moves to the first", () => {
    // Hebrew 5790 has a 29-day Kislev, so a 30 Kislev birthday has nowhere to
    // land and keeps to 1 Tevet.
    let landed = hebrewBirthday("2024-12-31", on("2029-06-01"));
    while (hebrewParts(landed.date).year < 5790) {
      landed = hebrewBirthday("2024-12-31", addDays(landed.date, 1));
    }
    assert.equal(hebrewParts(landed.date).year, 5790);
    assert.deepEqual(
      { month: hebrewParts(landed.date).month, day: hebrewParts(landed.date).day },
      { month: "tevet", day: 1 },
    );
    assert.equal(landed.moved, true);
  });

  test("a 30 Kislev baby keeps the first of Tevet in a year without one", () => {
    // 30 Kislev 5785 was 31 December 2024. 5786 has a 29-day Kislev.
    assert.deepEqual(hebrewParts(on("2024-12-31")), { year: 5785, month: "kislev", day: 30 });
    const next = hebrewBirthday("2024-12-31", on("2025-10-01"));
    const landed = hebrewParts(next.date);
    assert.ok(
      (landed.month === "kislev" && landed.day === 30) ||
        (landed.month === "tevet" && landed.day === 1),
      `landed on ${landed.day} ${landed.month}, which is neither`,
    );
    assert.equal(next.moved, landed.month === "tevet");
  });
});

describe("the brit", () => {
  test("it is the eighth day, counting the birth as the first", () => {
    const brit = britMilah("2026-09-01", on("2026-09-01"));
    assert.equal(toISODate(brit.date), "2026-09-08");
    assert.equal(brit.daysUntil, 7);
    assert.equal(brit.done, false);
  });

  test("it falls on the same weekday they were born", () => {
    const born = on("2026-09-01");
    const brit = britMilah("2026-09-01", born);
    assert.equal(brit.date.getDay(), born.getDay());
  });

  test("and it is behind you once it has passed", () => {
    assert.equal(britMilah("2026-09-01", on("2026-09-20")).done, true);
    assert.equal(britMilah("2026-09-01", on("2026-09-08")).done, true);
  });
});
