import type { BabySex } from "../domain/types.ts";
import type { Catalog } from "./en.ts";
import { heBaby, turns } from "./he/baby.ts";
import { heBook } from "./he/book.ts";
import { heForm } from "./he/form.ts";
import { heSettings } from "./he/settings.ts";
import { heShare } from "./he/share.ts";

/*
 * The Hebrew wording.
 *
 * Three things make this more than a lookup table.
 *
 * Gender. Hebrew has no genderless way to say how old somebody is: a boy is
 * "בן שנתיים" and a girl is "בת שנתיים". The app already knows, because sex is
 * a field, so it says it properly. When it does not know - a bump whose parents
 * wanted the surprise - it drops the בן/בת and gives the duration on its own,
 * which reads perfectly well and beats guessing or printing "בן/בת".
 *
 * The dual. Two of anything has its own word, and using the plural instead is
 * the single clearest sign that a Hebrew interface was translated rather than
 * written: יומיים, not "2 ימים". Every duration here handles one, two and many.
 *
 * The rhyme. "Monday's child is fair of face" is an English nursery rhyme, and
 * a literal Hebrew version is neither a rhyme nor a thing anyone has heard of.
 * It is left out of Hebrew entirely rather than translated flat, so `rhyme` is
 * the one field allowed to be empty.
 */

/** בן or בת, and nothing at all when the surprise has been kept. */
function child(sex: BabySex | undefined): string {
  if (sex === "girl") return "בת ";
  if (sex === "boy") return "בן ";
  return "";
}

/**
 * A line said three ways: to a girl, to a boy, and rebuilt without a gender at
 * all for a surprise, rather than guessing or printing a slash.
 */
function bySex(girl: string, boy: string, neither: string) {
  return (sex?: BabySex) => (sex === "girl" ? girl : sex === "boy" ? boy : neither);
}

/**
 * One, two, many. The dual form stands alone - "יומיים" already means two days,
 * so putting a 2 in front of it would be saying it twice.
 */
function count(n: number, one: string, two: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${many}`;
}

const days = (n: number) => count(n, "יום", "יומיים", "ימים");
const weeks = (n: number) => count(n, "שבוע", "שבועיים", "שבועות");
const months = (n: number) => count(n, "חודש", "חודשיים", "חודשים");
const years = (n: number) => count(n, "שנה", "שנתיים", "שנים");

/** Hebrew ordinals are words, not a suffix on a numeral. */
const ORDINALS_M = [
  "", "ראשון", "שני", "שלישי", "רביעי", "חמישי",
  "שישי", "שביעי", "שמיני", "תשיעי", "עשירי",
];

function ordinal(n: number): string {
  // Past ten Hebrew stops having a single word for it and says the number.
  return ORDINALS_M[n] ?? `ה-${n}`;
}

/**
 * "and" is a letter on the front of the next word rather than a word of its
 * own, which only works when that word is in Hebrew. A friend called Jonas
 * would come out as "וJonas", the vav welded to a Latin J. Before anything
 * that is not Hebrew it takes a hyphen instead, the same way this file already
 * writes "ה-12" for a number it has no word for.
 */
function vav(word: string): string {
  return /^[\u0590-\u05FF]/.test(word.trim()) ? `ו${word}` : `ו-${word}`;
}

export const he: Catalog = {
  /* --------------------------------------------------------- by area */

  book: heBook,
  baby: heBaby,
  form: heForm,
  settings: heSettings,
  share: heShare,

  /* ------------------------------------------------------------- the basics */

  code: "he",
  name: "עברית",
  dir: "rtl",
  dateLocale: "he-IL",

  ordinal,

  /* ------------------------------------------------------- the app itself */

  app: {
    /*
     * Transliterated rather than translated. "חסידה" would keep the joke, but
     * it is the name under the icon on the home screen that people will look
     * for, and it is a feminine noun, so every sentence about the app would
     * have to agree with it. "סטורק" behaves as a foreign name and stays out
     * of the way, which is what a name in an interface is for.
     */
    name: "סטורק",
    back: "חזרה",
    close: "סגירה",
    badPhoto: "לא הצלחנו לפתוח את התמונה.",
    notAPhoto: "הקובץ הזה הוא לא תמונה.",
    noStorage: "הדפדפן הזה לא מרשה לשמור כלום, ולכן כל מה שתוסיפו כאן ייעלם עם סגירת הלשונית.",
  },

  /* ------------------------------------------------------------------- age */

  age: {
    notYet: "עוד לא כאן",
    // "היום הראשון" and not "יום ראשון", which is a Sunday.
    bornToday: bySex("נולדה היום", "נולד היום", "היום הראשון בעולם"),
    days: (n, sex) => `${child(sex)}${days(n)}`,
    weeks: (n, sex) => `${child(sex)}${weeks(n)}`,
    months: (n, sex) => `${child(sex)}${months(n)}`,
    years: (n, sex) => `${child(sex)}${years(n)}`,
    yearsMonths: (y, m, sex) => `${child(sex)}${years(y)} ו${months(m)}`,
    shortSoon: "בקרוב",
    shortNew: bySex("חדשה", "חדש", "היום"),
    shortDays: (n) => `${n} ימ׳`,
    shortWeeks: (n) => `${n} שב׳`,
    shortMonths: (n) => `${n} חו׳`,
    shortYears: (n) => `${n} שנ׳`,
  },

  /* -------------------------------------------------------------- due date */

  due: {
    today: "התאריך הוא היום",
    tomorrow: "התאריך הוא מחר",
    inDays: (n) => `עוד ${days(n)}`,
    inWeeks: (n) => `עוד ${weeks(n)}`,
    overdue: (n) => `${days(n)} באיחור`,
    shortToday: "היום",
    shortDays: (n) => `${n} ימ׳`,
    shortWeeks: (n) => `${n} שב׳`,
    shortOverdue: (n) => `+${n} ימ׳`,
    week: (n) => `שבוע ${n}`,
    trimester: (n) => `טרימסטר ${ordinal(n)}`,
  },

  /* ------------------------------------------------------------ milestones */

  milestone: {
    // A noun, so the first row of the timeline agrees with nobody.
    born: "הלידה",
    d100: "100 ימים",
    m6: "חצי שנה",
    y1: "יום הולדת ראשון",
    y2: "יום הולדת שני",
    brit: "ברית מילה",
    inDays: (label, n) => `${label} בעוד ${days(n)}`,
  },

  /* --------------------------------------------------------- what is next */

  next: {
    arrivedToday: bySex("נולדה היום", "נולד היום", "היום הראשון בעולם"),
    // The same three forms as the baby's own page, so a tile and the page it
    // opens never disagree about how old she is turning.
    birthdayToday: (turning, sex) => turns(turning, sex, "היום"),
    birthdayTomorrow: (turning, sex) => turns(turning, sex, "מחר"),
    birthdayInDays: (turning, n, sex) => turns(turning, sex, `בעוד ${days(n)}`),
  },

  /* ------------------------------------------------------------- labelling */

  label: {
    parentsBaby: (parent, sex) =>
      sex === "girl" ? `התינוקת של ${parent}` : `התינוק של ${parent}`,
    unnamed: "תינוק בדרך",
    and: (a, b) => `${a} ${vav(b)}`,
    list: (most, last) => `${most.join(", ")} ${vav(last)}`,
    // No shorter than the full form, so it is the full form. An ampersand
    // between two Hebrew names reads as something borrowed.
    shortList: (parents) =>
      parents.length < 2
        ? parents.join("")
        : `${parents.slice(0, -1).join(", ")} ${vav(parents[parents.length - 1])}`,
  },

  /* ----------------------------------------------------------- how big */

  size: {
    kg: (value) => `${value} ק״ג`,
    lbOz: (pounds, ounces) => `${pounds} lb ${ounces} oz`,
    cm: (value) => `${value} ס״מ`,
    inches: (value) => `${value} אינץ׳`,
  },

  /* --------------------------------------------------------------- almanac */

  element: {
    fire: "אש",
    earth: "אדמה",
    air: "אוויר",
    water: "מים",
    wood: "עץ",
    metal: "מתכת",
  },

  /*
   * Every trait is an adjective about the baby, and a Hebrew adjective has a
   * gender. So each comes three ways: for a girl, for a boy, and - for a bump
   * whose sex is a surprise, which the stars panel is shown for too - as the
   * qualities themselves, nouns that describe nobody in particular.
   */
  zodiac: {
    aquarius: {
      name: "דלי",
      range: "20 בינואר – 18 בפברואר",
      trait: bySex(
        "מקורית, קצת מוזרה, ובדיוק במידה הנכונה",
        "מקורי, קצת מוזר, ובדיוק במידה הנכונה",
        "מקוריות עם קצת מוזרות, ובדיוק במידה הנכונה",
      ),
    },
    pisces: {
      name: "דגים",
      range: "19 בפברואר – 20 במרץ",
      trait: bySex("חולמת עם לב ענק", "חולם עם לב ענק", "לב ענק וראש בעננים"),
    },
    aries: {
      name: "טלה",
      range: "21 במרץ – 19 באפריל",
      trait: bySex(
        "זיקוק קטן, ראשונה בכל דלת",
        "זיקוק קטן, ראשון בכל דלת",
        "זיקוק קטן שנכנס ראשון בכל דלת",
      ),
    },
    taurus: {
      name: "שור",
      range: "20 באפריל – 20 במאי",
      trait: bySex(
        "רגועה, יציבה ועקשנית להפליא",
        "רגוע, יציב ועקשן להפליא",
        "רוגע, יציבות ועקשנות להפליא",
      ),
    },
    gemini: {
      name: "תאומים",
      range: "21 במאי – 20 ביוני",
      trait: bySex(
        "פטפטנית סקרנית עם שני רעיונות לכל דבר",
        "פטפטן סקרן עם שני רעיונות לכל דבר",
        "סקרנות, פטפוט, ושני רעיונות לכל דבר",
      ),
    },
    cancer: {
      name: "סרטן",
      range: "21 ביוני – 22 ביולי",
      trait: bySex("ביתית ורגישה, ומרגישה הכול", "ביתי ורגיש, ומרגיש הכול", "לב רך שמרגיש הכול"),
    },
    leo: {
      name: "אריה",
      range: "23 ביולי – 22 באוגוסט",
      trait: bySex(
        "נולדה לאור הזרקורים, וכבר יודעת את זה",
        "נולד לאור הזרקורים, וכבר יודע את זה",
        "כוכב של זרקורים מהיום הראשון",
      ),
    },
    virgo: {
      name: "בתולה",
      range: "23 באוגוסט – 22 בספטמבר",
      trait: bySex(
        "פרפקציוניסטית קטנה ששמה לב לכל פרט",
        "פרפקציוניסט קטן ששם לב לכל פרט",
        "עין חדה לכל פרט קטן",
      ),
    },
    libra: {
      name: "מאזניים",
      range: "23 בספטמבר – 22 באוקטובר",
      trait: bySex(
        "מקסימה, ורוצה שכולם יסתדרו",
        "מקסים, ורוצה שכולם יסתדרו",
        "המון קסם, ורצון שכולם יסתדרו",
      ),
    },
    scorpio: {
      name: "עקרב",
      range: "23 באוקטובר – 21 בנובמבר",
      trait: bySex(
        "עוצמתית, חסרת פחד, ואי אפשר לעבוד עליה",
        "עוצמתי, חסר פחד, ואי אפשר לעבוד עליו",
        "עוצמה, אומץ, ועין שאי אפשר לעבוד עליה",
      ),
    },
    sagittarius: {
      name: "קשת",
      range: "22 בנובמבר – 21 בדצמבר",
      trait: bySex(
        "הרפתקנית שכבר מתכננת את הבריחה",
        "הרפתקן שכבר מתכנן את הבריחה",
        "רוח הרפתקנית שכבר מתכננת את הבריחה",
      ),
    },
    capricorn: {
      name: "גדי",
      range: "22 בדצמבר – 19 בינואר",
      // נשמה is the subject here, so the line already agrees with nobody else.
      trait: bySex(
        "נשמה זקנה שהגיעה עם תוכנית",
        "נשמה זקנה שהגיעה עם תוכנית",
        "נשמה זקנה שהגיעה עם תוכנית",
      ),
    },
  },

  chinese: {
    rat: {
      name: "עכבר",
      trait: bySex(
        "זריזה, מקסימה ותמיד צעד אחד לפנים",
        "זריז, מקסים ותמיד צעד אחד לפנים",
        "זריזות, קסם, ותמיד צעד אחד לפנים",
      ),
    },
    ox: {
      name: "שור",
      trait: bySex(
        "סבלנית, וכשהחליטה – אי אפשר להזיז אותה",
        "סבלני, וכשהחליט – אי אפשר להזיז אותו",
        "סבלנות, וכשיש החלטה – אין מה לנסות להזיז",
      ),
    },
    tiger: {
      name: "נמר",
      trait: bySex("אמיצה, דרמטית ומלאת חוצפה", "אמיץ, דרמטי ומלא חוצפה", "אומץ, דרמה והמון חוצפה"),
    },
    rabbit: {
      name: "ארנב",
      trait: bySex("עדינה, ברת מזל וחכמה בשקט", "עדין, בר מזל וחכם בשקט", "עדינות, מזל וחוכמה שקטה"),
    },
    dragon: {
      name: "דרקון",
      trait: bySex(
        "נולדה עם מזל, ובכלל לא מתרגשת מזה",
        "נולד עם מזל, ובכלל לא מתרגש מזה",
        "מזל מהיום הראשון, ואפס התרגשות מזה",
      ),
    },
    snake: {
      name: "נחש",
      trait: bySex("חכמה, מתבוננת ומסתורית", "חכם, מתבונן ומסתורי", "חוכמה, התבוננות ומסתורין"),
    },
    horse: {
      name: "סוס",
      trait: bySex("חופשייה ברוחה ותמיד בתנועה", "חופשי ברוחו ותמיד בתנועה", "רוח חופשית שתמיד בתנועה"),
    },
    goat: {
      name: "עז",
      trait: bySex(
        "טובת לב, אמנותית וקצת חולמנית",
        "טוב לב, אמנותי וקצת חולמני",
        "לב טוב, נשמה אמנותית וקצת חולמנות",
      ),
    },
    monkey: {
      name: "קוף",
      trait: bySex("שובבה וחכמה בהרבה מדי", "שובב וחכם בהרבה מדי", "שובבות וחוכמה, בהרבה מדי"),
    },
    rooster: {
      name: "תרנגול",
      trait: bySex(
        "בטוחה בעצמה, מסודרת, ושמחה לספר לך על זה",
        "בטוח בעצמו, מסודר, ושמח לספר לך על זה",
        "ביטחון עצמי, סדר, והרבה שמחה לספר לך על זה",
      ),
    },
    dog: {
      name: "כלב",
      trait: bySex("נאמנה, ישרה והוגנת עד הסוף", "נאמן, ישר והוגן עד הסוף", "נאמנות, יושר והגינות עד הסוף"),
    },
    pig: {
      name: "חזיר",
      trait: bySex(
        "נדיבה, שמחה ואוהבת ארוחה טובה",
        "נדיב, שמח ואוהב ארוחה טובה",
        "נדיבות, שמחה ואהבה גדולה לארוחה טובה",
      ),
    },
  },

  birthstones: [
    "גרנט", "אמטיסט", "אקוומרין", "יהלום", "אזמרגד", "פנינה",
    "אודם", "פרידוט", "ספיר", "אופל", "טופז", "טורקיז",
  ],

  birthFlowers: [
    "ציפורן", "סיגלית", "נרקיס צהוב", "חיננית", "שושנת העמקים", "ורד",
    "דורבנית", "סייפן", "אסתר", "ציפורני חתול", "חרצית", "נרקיס",
  ],

  // No Hebrew nursery rhyme names the days of the week, and a translated one
  // would be a flat sentence pretending to be a rhyme. Left out on purpose.
  dayRhyme: [],

  /* -------------------------------------------------- the Hebrew calendar */

  hebrew: {
    section: "לוח עברי",
    born: "תאריך לידה עברי",
    birthday: "יום הולדת עברי",
    birthdayToday: "יום הולדת עברי היום",
    birthdayIn: (n) => `יום הולדת עברי בעוד ${days(n)}`,
    // A noun rather than a verb, which sidesteps the gender and lets the dual
    // through: "גיל שנתיים", not "נכנס לגיל 2".
    turning: (n) => `גיל ${years(n)}`,
    moved: "ה-30 בחודש הזה לא חוזר בכל שנה, ולכן היום נשמר באחד בחודש שאחריו.",
    sunset: "לפי התאריך הלועזי. יום עברי מתחיל בשקיעה, ולכן לידה בערב שייכת כבר ליום שאחריו.",
    brit: "ברית מילה",
    britOn: (date) => `ביום השמיני, ${date}`,
    britIn: (n) => `ברית בעוד ${days(n)}`,
    britToday: "הברית היום",
    britPassed: "ברית מילה",
    bornOn: (chag, sex) =>
      bySex(`נולדה ב${chag}`, `נולד ב${chag}`, `יום הלידה ב${chag}`)(sex),
    dueOn: (chag) => `התאריך הוא ב${chag}`,
    chag: {
      roshHashana: "ראש השנה",
      yomKippur: "יום כיפור",
      sukkot: "סוכות",
      simchatTorah: "שמחת תורה",
      chanukah: "חנוכה",
      tuBiShvat: "ט״ו בשבט",
      purim: "פורים",
      purimKatan: "פורים קטן",
      pesach: "פסח",
      yomHaatzmaut: "יום העצמאות",
      lagBaomer: "ל״ג בעומר",
      shavuot: "שבועות",
      tishaBav: "תשעה באב",
      tuBav: "ט״ו באב",
    },
  },

  /* ------------------------------------------------------------ life stage */

  stage: {
    egg: "בדרך",
    hatched: bySex("בדיוק בקעה", "בדיוק בקע", "רק עכשיו מהביצה"),
    // A noun every chick answers to, whichever it is.
    chick: "אפרוח",
    // The hen and the rooster are the joke in English and the whole grammar in
    // Hebrew: a teenage boy is not a תרנגולת and a grown woman is not a תרנגול.
    chicken: bySex("תרנגולת צעירה", "תרנגול צעיר", "תרנגולת צעירה"),
    rooster: bySex("תרנגולת", "תרנגול", "תרנגולת"),
    turkey: bySex("תרנגולת הודו", "תרנגול הודו", "תרנגול הודו"),
    asideChicken: "כבר לא בדיוק בגיל של תינוקות.",
    asideRooster: bySex(
      "מבוגרת לגמרי, באפליקציה על תינוקות.",
      "מבוגר לגמרי, באפליקציה על תינוקות.",
      "בגיל של מבוגרים, באפליקציה על תינוקות.",
    ),
    asideTurkey: "בשלב הזה זו סתם תזכורת ליום הולדת, וזה בסדר גמור.",
  },
};
