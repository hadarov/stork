import type { BabySex } from "../../domain/types.ts";
import type { enBaby } from "../en/baby.ts";

/*
 * Hebrew for a baby's own page and the album on it.
 *
 * Gender. A birthday is a verb here, and a verb has a gender: a boy נכנס לגיל
 * שנתיים and a girl נכנסת. When the surprise has been kept there is no third
 * form to reach for, so the line is rebuilt around the noun - יום הולדת שנתיים
 * היום - which says the same thing and does not guess. Nothing here ever
 * prints a slash between the two.
 *
 * The dual. Two days is יומיים, one word, and putting a 2 in front of the
 * plural is the clearest sign of a Hebrew screen that was translated rather
 * than written. One drops the numeral altogether: יום, not "1 יום". It shows
 * up in an age as well as in a countdown: גיל שנתיים, never גיל 2.
 *
 * The rhyme. "Monday's child is fair of face" has no Hebrew counterpart, so
 * the page leaves the line out rather than printing a flat sentence where a
 * verse was. The quoting function below is kept only to match the shape.
 */

/** One, two, many. The dual already means two, so it stands without a numeral. */
function count(n: number, one: string, two: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${many}`;
}

const days = (n: number) => count(n, "יום", "יומיים", "ימים");

/**
 * The age a birthday brings. Nobody says "גיל 2": the first two years have
 * words of their own, and from three on the numeral does the work.
 */
function ageWord(n: number): string {
  if (n === 1) return "שנה";
  if (n === 2) return "שנתיים";
  return String(n);
}

/**
 * A birthday, in the three forms Hebrew actually has. With no sex to go on the
 * verb is dropped and the noun carries the sentence instead.
 */
function turns(turning: number, sex: BabySex | undefined, when: string): string {
  const age = ageWord(turning);
  if (sex === "girl") return `נכנסת לגיל ${age} ${when}`;
  if (sex === "boy") return `נכנס לגיל ${age} ${when}`;
  return `יום הולדת ${age} ${when}`;
}

const DOT = " \u00b7 ";

export const heBaby: typeof enBaby = {
  detail: {
    /* --------------------------------------------------------------- the top */

    edit: "עריכה",
    girl: "בת",
    boy: "בן",

    /* ---------------------------------------------------------- a born baby */

    birthdayToday: (turning, sex) => `\u{1F382} ${turns(turning, sex, "היום")}`,
    birthdayIn: (turning, n, sex) => turns(turning, sex, `בעוד ${days(n)}`),

    stars: "כתוב בכוכבים",
    signMeta: (element, range) => `${element}${DOT}${range}`,
    // The noun comes first and the element describes it: דרקון עץ, not עץ דרקון.
    chineseName: (element, animal) => `${animal} ${element}`,
    chineseYear: (animal, year) => `שנת ה${animal}, ${year}`,
    trait: (name, trait) => `${name}: ${trait}.`,
    cusp: (neighbour) =>
      `בדיוק על הגבול עם ${neighbour} – הגבול זז ביום בין שנה לשנה, ולכן שני המזלות אפשריים.`,

    bornSection: "הלידה",
    factDay: "תאריך",
    atTime: (time) => `בשעה ${time}`,
    factWeight: "משקל",
    factLength: "אורך",
    factBirthstone: "אבן החודש",
    factFlower: "פרח החודש",
    factWeekday: "יום בשבוע",
    // Never reached: there is no Hebrew rhyme to quote, so the page omits the
    // line entirely rather than calling this.
    rhyme: (line) => `\u201C${line}.\u201D`,

    milestonesSection: "אבני דרך",
    milestoneWhen: (date, n) => `${date}${DOT}בעוד ${days(n)}`,

    /* ---------------------------------------------------------------- a bump */

    justBorn: (sex) => {
      if (sex === "girl") return "\u{1F389} נולדה!";
      if (sex === "boy") return "\u{1F389} נולד!";
      return "\u{1F389} הגיע הרגע!";
    },
    onTheWay: "בדרך",
    noDueDate: "הוסיפו תאריך משוער, והספירה תתחיל.",
    dueLine: (week, trimester, date) => `${week}${DOT}${trimester}${DOT}${date}`,
    starsIfOnTime: "אם יגיעו בזמן",
    signMayChange: "תינוקות לא מסתכלים בלוח השנה, ולכן המזל עוד עשוי להתחלף ביום עצמו.",

    /* ------------------------------------------------------ Hebrew calendar */

    hebrewDue: "תאריך משוער עברי",
    hebrewBirthdayMeta: (n, turning) => `בעוד ${days(n)}${DOT}${turning}`,

    /* --------------------------------------------------------------- family */

    familySection: "משפחה",
    siblingMeta: (relation, status) => `${relation}${DOT}${status}`,
    anotherOne: "\uFF0B עוד אחד",
    addSibling: "\uFF0B הוספת אח או אחות",

    /* ---------------------------------------------------------------- notes */

    notesSection: "הערות",

    /* ----------------------------------------------------------- keeping up */

    keepingUpSection: "לא לפספס",
    giftSent: "\u2713 המתנה נשלחה",
    markGift: "סימון שהמתנה נשלחה",
    giftMarked: "המתנה סומנה כנשלחה",
    giftUnmarked: "הסימון הוסר",
    shareCard: "\u{1F48C} שליחת כרטיס",
    cardFailed: "לא הצלחנו להכין כרטיס.",
    addToCalendar: "\u{1F4C5} הוספה ליומן",
    calendarSaved: "קובץ היומן נשמר – פתחו אותו כדי להוסיף את התאריך",
    remove: "הסרה",
  },

  album: {
    section: "אלבום",
    empty: "תמונות שתוסיפו כאן יישמרו לפי הסדר, מהראשונה לאחרונה.",
    add: "\u{1F4F7} הוספת תמונה",
    added: "התמונה נוספה",
    full: (max) => `עד ${max} תמונות לכל תינוק, כדי שיישאר מקום לכולם.`,

    caption: "כותרת",
    captionHint: "החיוך הראשון",
    taken: "תאריך הצילום",
    useAsPicture: "קביעה כתמונה שלהם",
    nowTheirPicture: "מעכשיו זו התמונה שלהם",
    delete: "מחיקה",
    removed: "התמונה הוסרה",
  },
};
