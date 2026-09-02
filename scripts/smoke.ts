/*
 * Every number this app shows is derived from a date, and dates are where this
 * kind of app quietly goes wrong: leap years, month ends, timezone rollover and
 * a zodiac that turns over on a moving date. The derivations are pure functions
 * that take "now" as an argument, so all of it can be checked without a browser.
 *
 * Usage: npm run smoke
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { chineseSign, starSign } from "../src/domain/almanac.ts";
import { describeBackup } from "../src/domain/backupStatus.ts";
import { cardContent } from "../src/domain/card.ts";
import {
  addMonths,
  daysBetween,
  describeAge,
  describeLength,
  describeWeight,
  displayName,
  dueCountdown,
  formatDate,
  formatShortDate,
  milestones,
  monthsBetween,
  nextBirthday,
  nextEvent,
  ordinal,
  sortByNextEvent,
} from "../src/domain/derive.ts";
import { areSiblings, families, familyOf, relation, siblingsOf } from "../src/domain/family.ts";
import { toICalendar } from "../src/domain/ics.ts";
import type { Baby } from "../src/domain/types.ts";
import { migrate } from "../src/storage/migrate.ts";
import { mergeRecords, type BabyRepo } from "../src/storage/repo.ts";
import { lastChangedAt, watchRepo } from "../src/storage/watchRepo.ts";
import {
  daysFor,
  daysInMonth,
  joinISO,
  monthsFor,
  splitISO,
  yearsFor,
} from "../src/domain/calendar.ts";
import { lifeStage } from "../src/domain/stage.ts";
import { describeInstall, offerOnHome } from "../src/domain/install.ts";
import { describeNudges } from "../src/domain/nudgeStatus.ts";
import { nudgesFor, pruneNudges } from "../src/domain/nudges.ts";
import { resolveTheme } from "../src/ui/theme.ts";
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

describe("dates read the same everywhere", () => {
  /*
   * These two caught nothing for weeks, because the machine writing them
   * reported en-IL and quietly agreed with itself. The first runner that
   * defaulted to en-US disagreed with all of it.
   */
  test("a date is written the same way wherever it is read", () => {
    assert.equal(formatDate(new Date(2024, 5, 15)), "15 June 2024");
    assert.equal(formatShortDate(new Date(2024, 5, 15)), "15 Jun");
  });

  test("nothing in the app leaves the format to the device", () => {
    for (const file of ["derive.ts", "almanac.ts", "ics.ts", "card.ts", "stage.ts"]) {
      const source = readFileSync(new URL(`../src/domain/${file}`, import.meta.url), "utf8");
      assert.doesNotMatch(
        source,
        /toLocale\w*\(\s*undefined/,
        `${file} asks the device how to write a date, so a shared card would not match`,
      );
    }
  });
});

describe("the stylesheet", () => {
  const css = readFileSync(new URL("../web/styles.css", import.meta.url), "utf8");

  /*
   * This one is a scar. Half the groups in the app are display:flex, and an
   * author rule beats the user agent's [hidden] { display: none } - so setting
   * hidden on the due date group did nothing, and a baby who was already here
   * was asked when they were due. The property was right and the tests passed.
   */
  test("hidden beats display, or hiding a flex group does nothing at all", () => {
    assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
  });
});

describe("the date dropdowns", () => {
  const now = new Date("2026-09-14T12:00:00");

  test("February knows about leap years", () => {
    assert.equal(daysInMonth(2024, 2), 29);
    assert.equal(daysInMonth(2026, 2), 28);
    assert.equal(daysInMonth(2026, 12), 31);
  });

  test("a date splits and rejoins unchanged", () => {
    assert.deepEqual(splitISO("2024-06-15"), { year: 2024, month: 6, day: 15 });
    assert.equal(joinISO({ year: 2024, month: 6, day: 5 }), "2024-06-05");
  });

  test("an impossible date does not split at all", () => {
    assert.equal(splitISO("2026-02-30"), null);
    assert.equal(splitISO("2026-13-01"), null);
    assert.equal(splitISO(""), null);
  });

  test("a birthday reaches back far enough to cover the turkey", () => {
    const years = yearsFor("past", now);
    assert.equal(years[0], 2026, "this year first, since most babies are recent");
    assert.ok(years.includes(1970));
    assert.ok(!years.includes(2027), "nobody was born next year");
  });

  test("a due date is this year or the next two", () => {
    assert.deepEqual(yearsFor("future", now), [2026, 2027, 2028]);
  });

  test("no birthday later this year is on offer", () => {
    assert.deepEqual(monthsFor("past", now, 2026), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(monthsFor("past", now, 2025).length, 12, "a past year is unrestricted");
    assert.equal(daysFor("past", now, 2026, 9).length, 14, "and not later this month");
  });

  test("a due date is not narrowed, since it is allowed to be either side of today", () => {
    assert.equal(monthsFor("future", now, 2026).length, 12);
    assert.equal(daysFor("future", now, 2026, 9).length, 30);
  });

  test("the 29th of February is offered in a leap year and not otherwise", () => {
    assert.equal(daysFor("past", now, 2024, 2).length, 29);
    assert.equal(daysFor("past", now, 2023, 2).length, 28);
  });
});

describe("egg, hatchling, chick", () => {
  const now = new Date("2026-09-01T12:00:00");
  const at = (birthDate: string | undefined, status: "born" | "expecting" = "born"): Baby => ({
    id: "x",
    name: "x",
    parents: [],
    status,
    birthDate,
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  test("a bump is an egg, whether or not a due date is typed", () => {
    assert.equal(lifeStage(at(undefined, "expecting"), now).glyph, "\u{1F95A}");
    assert.equal(lifeStage(at(undefined), now).glyph, "\u{1F95A}");
  });

  test("under a year they have just hatched", () => {
    assert.equal(lifeStage(at("2026-08-30"), now).glyph, "\u{1F423}");
    assert.equal(lifeStage(at("2025-09-02"), now).glyph, "\u{1F423}", "a day short of one");
  });

  test("the first birthday turns them into a chick, on the day", () => {
    assert.equal(lifeStage(at("2025-09-01"), now).glyph, "\u{1F424}");
    assert.equal(lifeStage(at("2020-01-01"), now).glyph, "\u{1F424}");
  });

  test("a birthday typed in the future is an egg, not a turkey", () => {
    assert.equal(lifeStage(at("2027-01-01"), now).glyph, "\u{1F95A}");
  });

  test("nobody who is actually a baby is ever told they are not one", () => {
    for (const year of [2026, 2025, 2020, 2015]) {
      assert.equal(lifeStage(at(`${year}-03-04`), now).aside, undefined);
    }
  });

  test("putting a grown adult in a baby app is noticed", () => {
    assert.equal(lifeStage(at("2012-01-01"), now).glyph, "\u{1F414}", "a teenager");
    assert.equal(lifeStage(at("2000-01-01"), now).glyph, "\u{1F413}", "a rooster");
    assert.equal(lifeStage(at("1970-01-01"), now).glyph, "\u{1F983}", "a turkey");

    assert.match(lifeStage(at("2000-01-01"), now).aside!, /grown adult/);
  });
});

describe("reminders", () => {
  // Two weeks out, so both the warning and the morning itself are still ahead.
  const now = new Date("2026-08-25T12:00:00");
  const mila = (over: Partial<Baby> = {}): Baby => ({
    id: "mila",
    name: "Mila",
    parents: ["Sarah"],
    status: "born",
    birthDate: "2024-09-08",
    updatedAt: "2024-09-08T00:00:00.000Z",
    ...over,
  });

  test("a birthday earns a week's warning and one on the morning", () => {
    const found = nudgesFor([mila()], now);

    assert.equal(found.length, 2);
    assert.match(found[0]!.title, /birthday is in a week/);
    assert.match(found[1]!.title, /birthday is today/);
    assert.ok(found[0]!.at < found[1]!.at, "the warning comes first");
  });

  test("reminders land at nine in the morning, not at midnight", () => {
    const [warning] = nudgesFor([mila()], now);
    const at = new Date(warning!.at);
    assert.equal(at.getHours(), 9);
    // Compared in local time, since nine in the morning is a local idea.
    assert.equal(at.getMonth(), 8);
    assert.equal(at.getDate(), 1, "seven days before the 8th");
  });

  test("a warning whose moment has already passed is not scheduled", () => {
    // Nine in the morning on the day of the warning is already behind us.
    const found = nudgesFor([mila()], new Date("2026-09-01T18:00:00"));
    assert.deepEqual(
      found.map((nudge) => nudge.title),
      ["Mila's birthday is today"],
    );
  });

  test("a due date gets its own wording", () => {
    const bump = mila({ status: "expecting", birthDate: undefined, dueDate: "2026-09-20" });
    assert.match(nudgesFor([bump], now)[1]!.title, /is due today/);
  });

  test("nothing is scheduled for a baby with no date at all", () => {
    assert.deepEqual(nudgesFor([mila({ birthDate: undefined })], now), []);
  });

  test("ids are stable, so the same occasion is never announced twice", () => {
    const first = nudgesFor([mila()], now).map((nudge) => nudge.id);
    const later = nudgesFor([mila()], new Date("2026-09-02T08:00:00")).map((nudge) => nudge.id);
    assert.ok(later.every((id) => first.includes(id)));
  });

  test("pruning drops yesterday's reminders and keeps tomorrow's", () => {
    const nudges = nudgesFor([mila()], now);
    assert.equal(pruneNudges(nudges, new Date("2026-09-20T09:00:00")).length, 0);
    assert.equal(pruneNudges(nudges, now).length, 2);
  });
});

describe("what this browser will actually do", () => {
  const able = {
    canNotify: true,
    canWake: true,
    installed: true,
    permission: "granted" as const,
  };

  test("a browser that can wake itself is promised a real reminder", () => {
    const status = describeNudges(able);
    assert.match(status.line, /whether or not Stork is open/);
    assert.equal(status.fallback, false);
  });

  test("a browser that cannot wake itself says so instead of pretending", () => {
    const status = describeNudges({ ...able, canWake: false });
    assert.match(status.line, /can arrive late/);
    assert.ok(status.fallback, "so the calendar export stays on offer");
  });

  test("in a tab it suggests the home screen rather than giving up", () => {
    assert.equal(describeNudges({ ...able, canWake: false, installed: false }).action, "install");
  });

  test("having been turned down, it does not offer the button again", () => {
    const status = describeNudges({ ...able, permission: "denied" });
    assert.equal(status.action, null);
    assert.match(status.line, /your browser's settings/);
  });

  test("not yet asked, it offers to ask", () => {
    assert.equal(describeNudges({ ...able, permission: "default" }).action, "ask");
  });
});

describe("what this browser will let you install", () => {
  const able = { installed: false, canPrompt: true, byHand: false, dismissed: false };

  test("a browser with a real prompt gets a real button", () => {
    const offer = describeInstall(able);
    assert.equal(offer.kind, "button");
    assert.match(offer.kind === "button" ? offer.label : "", /Install/);
  });

  test("an iPhone gets the share sheet spelled out, since it has no button", () => {
    const offer = describeInstall({ ...able, canPrompt: false, byHand: true });
    assert.equal(offer.kind, "steps");
    assert.deepEqual(
      offer.kind === "steps" ? offer.steps.length : 0,
      3,
      "share, scroll, add",
    );
  });

  test("a browser that can do neither is not sent hunting for a button", () => {
    assert.equal(describeInstall({ ...able, canPrompt: false }).kind, "none");
  });

  test("an app already on the home screen is not asked to install itself", () => {
    assert.equal(describeInstall({ ...able, installed: true }).kind, "none");
    assert.equal(describeInstall({ ...able, installed: true, byHand: true }).kind, "none");
  });

  test("waving the strip away silences the home screen but not Settings", () => {
    const waved = { ...able, dismissed: true };
    assert.equal(offerOnHome(waved).kind, "none");
    assert.equal(describeInstall(waved).kind, "button", "Settings keeps offering");
  });
});

describe("theme", () => {
  test("an explicit choice wins over whatever the phone prefers", () => {
    assert.equal(resolveTheme("light", false), "light");
    assert.equal(resolveTheme("dark", true), "dark");
  });

  test("left to itself it follows the system", () => {
    assert.equal(resolveTheme("system", true), "light");
    assert.equal(resolveTheme("system", false), "dark");
  });
});

describe("keeping a backup", () => {
  const NOW = new Date("2026-09-01T12:00:00.000Z");

  test("an empty book has nothing to lose and is not nagged", () => {
    const status = describeBackup({ count: 0, now: NOW });
    assert.equal(status.line, "Nothing to back up yet");
    assert.equal(status.stale, false);
  });

  test("a book that has never been backed up says so, and counts as stale", () => {
    const status = describeBackup({ count: 3, now: NOW });
    assert.equal(status.line, "3 babies, never backed up");
    assert.equal(status.stale, true);
  });

  test("a backup made after the last change is current, however old it is", () => {
    const status = describeBackup({
      lastAt: "2025-01-10T00:00:00.000Z",
      changedAt: "2025-01-09T00:00:00.000Z",
      count: 2,
      now: NOW,
    });
    assert.equal(status.stale, false, "nobody has touched the book since");
    assert.match(status.line, /2 babies, backed up \d+ days ago$/);
  });

  test("a change since the last backup makes it out of date", () => {
    const status = describeBackup({
      lastAt: "2026-08-30T00:00:00.000Z",
      changedAt: "2026-08-31T00:00:00.000Z",
      count: 2,
      now: NOW,
    });
    assert.equal(status.stale, true);
    assert.match(status.line, /out of date$/);
  });

  test("today and yesterday are named rather than counted", () => {
    assert.match(
      describeBackup({ lastAt: "2026-09-01T09:00:00.000Z", count: 1, now: NOW }).line,
      /backed up today/,
    );
    assert.match(
      describeBackup({ lastAt: "2026-08-31T09:00:00.000Z", count: 1, now: NOW }).line,
      /backed up yesterday/,
    );
  });

  test("the newest change in the book is the one that matters", () => {
    const babies: Baby[] = [
      { id: "a", parents: [], status: "expecting", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", parents: [], status: "expecting", updatedAt: "2026-06-06T00:00:00.000Z" },
      { id: "c", parents: [], status: "expecting", updatedAt: "2026-03-03T00:00:00.000Z" },
    ];
    assert.equal(lastChangedAt(babies), "2026-06-06T00:00:00.000Z");
    assert.equal(lastChangedAt([]), undefined);
  });

  test("every kind of write is announced, and reads are left alone", async () => {
    const writes: string[] = [];
    const inner: BabyRepo = {
      list: async () => [],
      listAll: async () => [],
      save: async () => {},
      remove: async () => {},
      merge: async () => ({ added: 1, updated: 0, skipped: 0 }),
    };
    const watched = watchRepo(inner, () => writes.push("write"));

    await watched.list();
    await watched.listAll();
    assert.deepEqual(writes, [], "reading changes nothing");

    await watched.save({ id: "a", parents: [], status: "expecting", updatedAt: "x" });
    await watched.remove("a");
    const result = await watched.merge([]);

    assert.deepEqual(writes, ["write", "write", "write"]);
    assert.deepEqual(result, { added: 1, updated: 0, skipped: 0 }, "and the result comes back");
  });
});

describe("a card to send", () => {
  const NOW = new Date(2026, 8, 1);
  const mila = (over: Partial<Baby> = {}): Baby => ({
    id: "mila",
    name: "Mila",
    parents: ["Sarah", "Tom"],
    status: "born",
    birthDate: "2024-06-15",
    updatedAt: "2024-06-15T00:00:00.000Z",
    ...over,
  });

  test("a baby who is here leads with their age, under both their signs", () => {
    const card = cardContent(mila(), NOW);
    assert.equal(card.name, "Mila");
    assert.equal(card.parents, "Sarah and Tom");
    assert.equal(card.headline, "2 years, 2 months old");
    assert.deepEqual(card.chips, ["\u264A Gemini", "\u{1F409} Dragon"]);
    assert.equal(card.footer, "Born 15 June 2024");
  });

  test("a known birth weight earns a third badge", () => {
    const card = cardContent(mila({ birthWeightGrams: 3400 }), NOW);
    assert.equal(card.chips.length, 3);
    assert.match(card.chips[2] ?? "", /3\.4 kg/);
  });

  test("a bump counts down, and its star sign is only a guess", () => {
    const card = cardContent(
      mila({ status: "expecting", birthDate: undefined, dueDate: "2026-11-01" }),
      NOW,
    );
    assert.equal(card.headline, "due in 9 weeks");
    assert.match(card.chips[0] ?? "", /Scorpio\?$/);
    assert.equal(card.footer, "Due 1 November 2026");
  });

  test("a bump with no due date still makes a card rather than throwing", () => {
    const card = cardContent(
      mila({ status: "expecting", birthDate: undefined, dueDate: undefined }),
      NOW,
    );
    assert.equal(card.headline, "On the way");
    assert.deepEqual(card.chips, []);
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

  test("a household gathers everyone who shares a parent, oldest first", () => {
    const all = [
      of("bump", ["Tom"], { status: "expecting", birthDate: undefined, dueDate: "2026-11-01" }),
      of("nina", ["Dana"]),
      of("mila", ["Sarah", "Tom"], { birthDate: "2019-07-02" }),
    ];
    const found = families(all);

    assert.equal(found.length, 2, "two households, not three");
    const sarahs = found.find((family) => family.parents.includes("Sarah"));
    assert.deepEqual(sarahs?.babies.map((baby) => baby.id), ["mila", "bump"]);
    assert.deepEqual(sarahs?.parents, ["Tom", "Sarah"], "in the order they were first typed");
  });

  test("one baby naming two parents is what joins their two lists together", () => {
    // Nothing links these until the middle baby says both names.
    const all = [of("a", ["Sarah"]), of("b", ["Dana"]), of("both", ["Sarah", "Dana"])];
    assert.equal(families(all).length, 1);
    assert.equal(families(all)[0]?.babies.length, 3);
  });

  test("a baby with nobody named is not a household you can go and see", () => {
    assert.deepEqual(families([of("lonely", [])]), []);
  });

  test("a baby's own household includes them, even with no parents named", () => {
    const lonely = of("lonely", []);
    assert.deepEqual(familyOf(lonely, [lonely]).babies, [lonely]);
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
