import type { BabySex } from "../../domain/types.ts";
import type { enShare } from "../en/share.ts";

/*
 * The Hebrew wording for the card, the calendar file and the reminders.
 *
 * The dual does most of the work here. Reminders count days for a living, and
 * "2 ימים" instead of "יומיים" is the clearest sign in any Hebrew interface that
 * nobody wrote it, they only translated it. One drops the numeral as well: the
 * brit is often a day away, and that is "בעוד יום", not "בעוד 1 יום".
 *
 * Gender comes up wherever something has to be said to have happened. Hebrew
 * cannot say "born" without picking one, so the sex is asked for and, when the
 * surprise has been kept, the date is given as a plain label instead of a
 * sentence about a boy or a girl.
 *
 * Nothing takes a name with a ל attached to it. Half the names in this app are
 * fallbacks like "התינוק של שרה", and "להתינוק" is not Hebrew - so the name
 * always sits in a של, where any name is safe.
 */

/** One, two, many. The dual stands alone: יומיים already contains the two. */
function count(n: number, one: string, two: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${many}`;
}

const days = (n: number) => count(n, "יום", "יומיים", "ימים");

/** Born, said properly, or not said at all when the sex is not known. */
function born(date: string, sex?: BabySex): string {
  if (sex === "girl") return `נולדה ב-${date}`;
  if (sex === "boy") return `נולד ב-${date}`;
  return `תאריך הלידה: ${date}`;
}

export const heShare: typeof enShare = {
  card: {
    onTheWay: "בדרך",
    watchThisSpace: "עוד לא יודעים מתי",
    bornOn: (date, sex) => born(date, sex),
    dueOn: (date) => `תאריך משוער: ${date}`,
    chip: (emoji, label) => `${emoji} ${label}`,
    perhaps: (label) => `${label}?`,
    brand: "\u{1F423} סטורק",
    noCanvas: "הדפדפן הזה לא יודע לצייר כרטיס.",
    failed: "לא הצלחנו להכין כרטיס.",
    shared: "נשלח",
    saved: "הכרטיס נשמר בהורדות",
  },

  ics: {
    calendarName: "סטורק – תינוקות",
    dueSummary: (name) => `\u{1F423} תאריך הלידה של ${name}`,
    dueDescription: (parents) => `תאריך הלידה המשוער של ${parents}.`,
    dueDescriptionPlain: "תאריך לידה משוער.",
    birthdaySummary: (name) => `\u{1F382} יום ההולדת של ${name}`,
    // "יום הולדת" is masculine whoever is having it, so the ordinal agrees with
    // the birthday rather than with the baby and needs no gender of its own.
    birthdayDescription: (date, turning, sex) =>
      `${born(date, sex)}. הבא: יום הולדת ${turning}.`,
    hebrewSummary: (name) => `\u2721\uFE0F יום ההולדת העברי של ${name}`,
    hebrewDescription: (hebrewDate, turning) => `${hebrewDate}. יום הולדת ${turning}.`,
  },

  nudge: {
    dueTodayTitle: (name) => `היום התאריך של ${name}`,
    dueTodayBody: "יום טוב לשלוח הודעה.",
    dueSoonTitle: (name) => `התאריך של ${name} בעוד שבוע`,
    dueSoonBody: "שבוע להתארגן, אין תירוצים.",
    birthdayTodayTitle: (name) => `יום ההולדת של ${name} היום`,
    birthdayTodayBody: "כדאי להגיד משהו לפני שהיום נגמר.",
    birthdaySoonTitle: (name) => `יום ההולדת של ${name} בעוד שבוע`,
    birthdaySoonBody: "מספיק זמן להזמין מתנה.",
    bigDayTodayTitle: (name) => `היום יום גדול של ${name}`,
    bigDayTodayBody: "שווה הודעה.",
    bigDaySoonTitle: (name) => `בעוד שבוע יום גדול של ${name}`,
    bigDaySoonBody: "אז שלא תגידו שלא ידעתם.",

    hebrewTodayTitle: (name) => `יום ההולדת העברי של ${name} היום`,
    hebrewTodayBody: "לא הלועזי. העברי זז כל שנה.",
    hebrewSoonTitle: (name, n) => `יום ההולדת העברי של ${name} בעוד ${days(n)}`,
    hebrewSoonBody: "שווה להזכיר בשיחה הבאה.",
    britTodayTitle: (name) => `הברית של ${name} היום`,
    britTodayBody: "היום השמיני. זמן טוב לשלוח משהו.",
    britSoonTitle: (name, n) => `הברית של ${name} בעוד ${days(n)}`,
    britSoonBody: "שמונה ימים מהלידה, זה מגיע מהר.",

    cannot: "הדפדפן הזה לא יודע להציג תזכורות.",
    declined: "אז בלי תזכורות.",
    on: "התזכורות פועלות.",
  },
};
