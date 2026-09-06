import type { BabySex } from "../domain/types.ts";
import type { Catalog } from "./en.ts";
import { heBaby } from "./he/baby.ts";
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
    bornToday: "נולד היום",
    days: (n, sex) => `${child(sex)}${days(n)}`,
    weeks: (n, sex) => `${child(sex)}${weeks(n)}`,
    months: (n, sex) => `${child(sex)}${months(n)}`,
    years: (n, sex) => `${child(sex)}${years(n)}`,
    yearsMonths: (y, m, sex) => `${child(sex)}${years(y)} ו${months(m)}`,
    shortSoon: "בקרוב",
    shortNew: "חדש",
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
    born: "הגיע",
    d100: "100 ימים",
    m6: "חצי שנה",
    y1: "יום הולדת ראשון",
    y2: "יום הולדת שני",
    brit: "ברית מילה",
    inDays: (label, n) => `${label} בעוד ${days(n)}`,
  },

  /* --------------------------------------------------------- what is next */

  next: {
    arrivedToday: "הגיע היום",
    birthdayToday: (turning) => `חוגג ${ordinal(turning)} היום`,
    birthdayTomorrow: (turning) => `חוגג ${ordinal(turning)} מחר`,
    birthdayInDays: (turning, n) => `חוגג ${ordinal(turning)} בעוד ${days(n)}`,
  },

  /* ------------------------------------------------------------- labelling */

  label: {
    parentsBaby: (parent) => `התינוק של ${parent}`,
    unnamed: "תינוק בדרך",
    and: (a, b) => `${a} ו${b}`,
    list: (most, last) => `${most.join(", ")} ו${last}`,
    // No shorter than the full form, so it is the full form. An ampersand
    // between two Hebrew names reads as something borrowed.
    shortList: (parents) =>
      parents.length < 2
        ? parents.join("")
        : `${parents.slice(0, -1).join(", ")} ו${parents[parents.length - 1]}`,
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

  zodiac: {
    aquarius: { name: "דלי", range: "20 בינואר – 18 בפברואר", trait: "מקורי, קצת מוזר, ובדיוק במידה הנכונה" },
    pisces: { name: "דגים", range: "19 בפברואר – 20 במרץ", trait: "חולם עם לב ענק" },
    aries: { name: "טלה", range: "21 במרץ – 19 באפריל", trait: "זיקוק קטן, ראשון בכל דלת" },
    taurus: { name: "שור", range: "20 באפריל – 20 במאי", trait: "רגוע, יציב ועקשן להפליא" },
    gemini: { name: "תאומים", range: "21 במאי – 20 ביוני", trait: "פטפטן סקרן עם שני רעיונות לכל דבר" },
    cancer: { name: "סרטן", range: "21 ביוני – 22 ביולי", trait: "ביתי ורגיש, ומרגיש הכול" },
    leo: { name: "אריה", range: "23 ביולי – 22 באוגוסט", trait: "נולד לאור הזרקורים, וכבר יודע את זה" },
    virgo: { name: "בתולה", range: "23 באוגוסט – 22 בספטמבר", trait: "פרפקציוניסט קטן ששם לב לכל פרט" },
    libra: { name: "מאזניים", range: "23 בספטמבר – 22 באוקטובר", trait: "מקסים, ורוצה שכולם יסתדרו" },
    scorpio: { name: "עקרב", range: "23 באוקטובר – 21 בנובמבר", trait: "עוצמתי, חסר פחד, ובלתי אפשרי לרמות" },
    sagittarius: { name: "קשת", range: "22 בנובמבר – 21 בדצמבר", trait: "הרפתקן שכבר מתכנן את הבריחה" },
    capricorn: { name: "גדי", range: "22 בדצמבר – 19 בינואר", trait: "נשמה זקנה שהגיעה עם תוכנית" },
  },

  chinese: {
    rat: { name: "עכבר", trait: "זריז, מקסים ותמיד צעד אחד לפנים" },
    ox: { name: "שור", trait: "סבלני, וכשהחליט – אי אפשר להזיז אותו" },
    tiger: { name: "נמר", trait: "אמיץ, דרמטי ומלא חוצפה" },
    rabbit: { name: "ארנב", trait: "עדין, בר מזל וחכם בשקט" },
    dragon: { name: "דרקון", trait: "נולד עם מזל, ובכלל לא מתרגש מזה" },
    snake: { name: "נחש", trait: "חכם, מתבונן ומסתורי" },
    horse: { name: "סוס", trait: "חופשי ברוחו ותמיד בתנועה" },
    goat: { name: "עז", trait: "טוב לב, אמנותי וקצת חולמני" },
    monkey: { name: "קוף", trait: "שובב וחכם בהרבה מדי" },
    rooster: { name: "תרנגול", trait: "בטוח בעצמו, מסודר, ושמח לספר לך על זה" },
    dog: { name: "כלב", trait: "נאמן, ישר והוגן עד הסוף" },
    pig: { name: "חזיר", trait: "נדיב, שמח ואוהב ארוחה טובה" },
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
    bornOn: (chag) => `נולד ב${chag}`,
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
    hatched: "בדיוק בקע",
    chick: "אפרוח",
    chicken: "תרנגולת",
    rooster: "תרנגול",
    turkey: "תרנגול הודו",
    asideChicken: "כבר לא בדיוק תינוק.",
    asideRooster: "מבוגר לגמרי, באפליקציה על תינוקות.",
    asideTurkey: "בשלב הזה זו סתם תזכורת ליום הולדת, וזה בסדר גמור.",
  },
};
