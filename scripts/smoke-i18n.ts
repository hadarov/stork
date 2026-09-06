import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { starSign, chineseSign, birthstone, birthFlower, dayOfWeekRhyme } from "../src/domain/almanac.ts";
import { describeAge, describeParents, displayName, dueCountdown, formatDate } from "../src/domain/derive.ts";
import { lifeStage } from "../src/domain/stage.ts";
import type { Baby } from "../src/domain/types.ts";
import { en } from "../src/i18n/en.ts";
import { he } from "../src/i18n/he.ts";
import { CATALOGS, LANGS, preferredLang } from "../src/i18n/index.ts";
import { resolveLang } from "../src/ui/lang.ts";

/**
 * Nothing type-checks the catalogues - the build strips types rather than
 * compiling them - so this is what actually stops a Hebrew screen coming out
 * half in English.
 */
describe("the catalogues agree on their shape", () => {
  /** Every leaf, as a dotted path, so a missing key names itself. */
  function shape(value: unknown, path = ""): string[] {
    if (typeof value === "function") return [`${path}()`];
    if (Array.isArray(value)) return [`${path}[]`];
    if (value && typeof value === "object") {
      return Object.keys(value)
        .sort()
        .flatMap((key) => shape((value as Record<string, unknown>)[key], path ? `${path}.${key}` : key));
    }
    return [`${path}:${typeof value}`];
  }

  test("Hebrew has every key English has, and no extras", () => {
    assert.deepEqual(shape(he), shape(en));
  });

  test("nothing in Hebrew was left in English", () => {
    /*
     * Every exception is a deliberate one. Machinery - the language code, the
     * locale tag, the direction - is Latin by definition. Pounds and ounces are
     * shown as the foreign units they are, because nobody says them in Hebrew.
     * And the rest are proper nouns that a Hebrew speaker also writes in Latin:
     * translating "Safari" or "iCloud Drive" would mean naming a button that
     * the reader cannot then find on their phone.
     */
    const allowed = new Set([
      "code",
      "dateLocale",
      "dir",
      "name",
      "size.lbOz()",
      // The file you are about to get. "ייצוא ליומן" would need no exception
      // but would stop saying what lands in the downloads folder.
      "settings.settings.exportIcs",
      "settings.backup.syncFolder",
      "settings.backup.saveToFiles",
      "settings.storage.sweepsInstalled",
      "settings.storage.sweepsInTab",
    ]);
    const latin = /[A-Za-z]/;

    const walk = (value: unknown, path = ""): void => {
      if (typeof value === "string") {
        if (allowed.has(path) || !latin.test(value)) return;
        assert.fail(`${path} is still in English: ${value}`);
      }
      if (Array.isArray(value)) return value.forEach((item, index) => walk(item, `${path}[${index}]`));
      if (value && typeof value === "object") {
        for (const [key, inner] of Object.entries(value)) {
          walk(inner, path ? `${path}.${key}` : key);
        }
      }
    };

    walk(he);
  });

  test("both languages are offered, and both resolve", () => {
    assert.deepEqual(LANGS, ["en", "he"]);
    for (const lang of LANGS) assert.equal(CATALOGS[lang].code, lang);
  });
});

describe("picking a language from the phone", () => {
  test("anything Hebrew gets Hebrew, whatever the region", () => {
    assert.equal(preferredLang(["he-IL"]), "he");
    assert.equal(preferredLang(["he"]), "he");
    // Some devices still send the retired code.
    assert.equal(preferredLang(["iw-IL"]), "he");
  });

  test("anything else falls to English rather than to the first tag", () => {
    assert.equal(preferredLang(["fr-FR", "en-GB"]), "en");
    assert.equal(preferredLang(["ru-RU"]), "en");
    assert.equal(preferredLang([]), "en");
  });

  test("the first of the two that appears wins", () => {
    assert.equal(preferredLang(["en-US", "he-IL"]), "en");
    assert.equal(preferredLang(["he-IL", "en-US"]), "he");
  });

  test("an explicit choice beats the phone", () => {
    assert.equal(resolveLang("he", ["en-US"]), "he");
    assert.equal(resolveLang("en", ["he-IL"]), "en");
    assert.equal(resolveLang("system", ["he-IL"]), "he");
  });
});

/* ------------------------------------------------------------ the grammar */

const NOW = new Date("2026-09-01T12:00:00");

function baby(over: Partial<Baby> = {}): Baby {
  return {
    id: "b",
    name: "מילה",
    parents: ["שרה"],
    status: "born",
    birthDate: "2025-06-15",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("Hebrew says how old somebody is properly", () => {
  const age = (birthDate: string, sex?: Baby["sex"]) =>
    describeAge(birthDate, NOW, he, sex).label;

  test("a boy is בן and a girl is בת", () => {
    assert.equal(age("2024-09-01", "boy"), "בן שנתיים");
    assert.equal(age("2024-09-01", "girl"), "בת שנתיים");
  });

  test("and when the surprise was kept it just gives the duration", () => {
    assert.equal(age("2024-09-01", "surprise"), "שנתיים");
    assert.equal(age("2024-09-01"), "שנתיים");
  });

  test("two of anything is the dual, not the plural with a 2 in front", () => {
    assert.equal(age("2026-08-30", "boy"), "בן יומיים");
    assert.equal(age("2026-08-18", "boy"), "בן שבועיים");
    assert.equal(age("2024-09-01", "boy"), "בן שנתיים");
    // Two months only ever comes up as the tail of an age in years, because
    // anything under three months is counted in weeks.
    assert.equal(age("2023-07-01", "boy"), "בן 3 שנים וחודשיים");
  });

  test("one of anything drops the numeral entirely", () => {
    assert.equal(age("2026-08-31", "girl"), "בת יום");
    // A first birthday is still counted in months, in both languages, because
    // "12 months" is what people say at that age and "1 year" is not.
    assert.equal(age("2025-09-01", "girl"), "בת 12 חודשים");
  });

  test("and three or more counts normally", () => {
    assert.equal(age("2026-08-29", "boy"), "בן 3 ימים");
    assert.equal(age("2023-09-01", "boy"), "בן 3 שנים");
  });

  test("years and months are joined the Hebrew way", () => {
    assert.equal(age("2023-07-01", "girl"), "בת 3 שנים וחודשיים");
  });
});

describe("Hebrew counts down to a due date", () => {
  const due = (date: string) => dueCountdown(date, NOW, he).label;

  test("the dual turns up here too", () => {
    assert.equal(due("2026-09-03"), "עוד יומיים");
    // Weeks only start at three, so the count switches over before two weeks.
    assert.equal(due("2026-09-22"), "עוד 3 שבועות");
  });

  test("today, tomorrow and late", () => {
    assert.equal(due("2026-09-01"), "התאריך הוא היום");
    assert.equal(due("2026-09-02"), "התאריך הוא מחר");
    assert.equal(due("2026-08-30"), "יומיים באיחור");
  });
});

describe("the rest of the wording follows the language", () => {
  test("names fall back in the right language", () => {
    assert.equal(displayName(baby({ name: undefined }), he), "התינוק של שרה");
    assert.equal(displayName(baby({ name: undefined, parents: [] }), he), "תינוק בדרך");
    assert.equal(displayName(baby({ name: undefined, parents: ["Sarah"] }), en), "Sarah's baby");
  });

  test("parents are joined with a vav rather than an and", () => {
    assert.equal(describeParents(["שרה", "תום"], he), "שרה ותום");
    assert.equal(describeParents(["Sarah", "Tom"], en), "Sarah and Tom");
  });

  test("and under a tile, where English shortens, Hebrew has nothing to shorten", () => {
    assert.equal(en.label.shortList(["Sarah", "Tom"]), "Sarah & Tom");
    assert.equal(he.label.shortList(["שרה", "תום"]), "שרה ותום");

    // One parent is just the one name, and three still read as a list.
    assert.equal(he.label.shortList(["שרה"]), "שרה");
    assert.equal(he.label.shortList(["שרה", "תום", "דנה"]), "שרה, תום ודנה");
  });

  test("dates come out in the language's own locale", () => {
    const date = new Date(2024, 5, 15);
    assert.equal(formatDate(date, en), "15 June 2024");
    assert.match(formatDate(date, he), /יוני/);
  });

  test("the almanac is translated, keys and all", () => {
    const born = new Date(2024, 5, 15);
    assert.equal(starSign(born, en).name, "Gemini");
    assert.equal(starSign(born, he).name, "תאומים");
    assert.equal(starSign(born, he).element, "אוויר");
    assert.equal(chineseSign(born, he).animal, "דרקון");
    assert.equal(birthstone(born, he), "פנינה");
    assert.equal(birthFlower(born, he), "ורד");
  });

  test("the nursery rhyme is English only, and says so by being absent", () => {
    const born = new Date(2024, 5, 17);
    assert.equal(dayOfWeekRhyme(born, en)?.day, "Monday");
    assert.equal(dayOfWeekRhyme(born, he), null);
  });

  test("the Hebrew calendar section is translated too", () => {
    assert.equal(he.hebrew.chag.pesach, "פסח");
    assert.equal(en.hebrew.chag.pesach, "Pesach");
  });

  test("the life stages are translated", () => {
    assert.equal(lifeStage(baby(), NOW, he).glyph, "\u{1F424}");
    assert.equal(lifeStage(baby(), NOW, he).label, "אפרוח");
    assert.equal(lifeStage(baby({ status: "expecting" }), NOW, he).label, "בדרך");
  });
});
