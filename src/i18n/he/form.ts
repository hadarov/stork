import type { enForm } from "../en/form.ts";

/*
 * The Hebrew form.
 *
 * Two things needed deciding rather than translating.
 *
 * Gender. Hebrew cannot welcome a baby without knowing which one it is: a boy is
 * "ברוך הבא" and a girl is "ברוכה הבאה". The app knows whenever the parents told
 * it, so it says it properly, and when they kept the surprise it says something
 * that needs no gender at all rather than printing both with a slash between
 * them. The same goes for asking when they arrived: הגיע for a boy, הגיעה for a
 * girl, and a question about the date itself when nobody knows yet.
 *
 * Register. A Hebrew form asks for things with nouns - שמירה, ביטול, הוספת
 * תמונה - so the buttons are nouns here even where the English is a verb, and
 * the two confirmations answer their own question in the infinitive, which is
 * how a Hebrew speaker would expect a yes or no to be offered.
 *
 * The placeholders are not translations. "Still deciding?" is "עוד מתלבטים?",
 * which is what somebody would actually say, and the example parent is שרה
 * rather than a transliterated Sarah.
 */
export const heForm: typeof enForm = {
  /* ---------------------------------------------------- adding and editing */

  edit: {
    title: "עריכה",
    titleNew: "תינוק חדש",

    /* on the way, or here yet */
    statusLabel: "האם התינוק כבר כאן?",
    statusExpecting: "בדרך",
    statusBorn: "כאן",

    /* the photo */
    addPhoto: "הוספת תמונה",
    changePhoto: "החלפת תמונה",
    removePhoto: "הסרה",
    photoFailed: "לא הצלחנו לקרוא את התמונה.",

    /* who they are */
    name: "שם",
    namePlaceholder: "עוד מתלבטים?",
    parent: "הורה",
    parentPlaceholder: "שרה",
    secondParent: "הורה שני",
    optional: "לא חובה",
    notes: "הערות",
    notesPlaceholder: "רעיונות למתנה, איזה בית חולים, כל דבר",

    /* the dates and the numbers */
    dueDate: "תאריך לידה משוער",
    birthday: "תאריך לידה",
    birthTime: "שעת הלידה",
    birthTimeHint: "לא חובה, אבל זה מכריע מזל שנולד על הגבול.",
    weight: "משקל",
    kg: "ק״ג",
    length: "אורך",
    cm: "ס״מ",

    sex: "בן או בת",
    sexUnsaid: "מעדיפים לא לספר",
    sexGirl: "בת",
    sexBoy: "בן",
    sexSurprise: "הפתעה",

    /* what is wrong with the form */
    needBirthday: "אם התינוק כבר כאן, צריך תאריך לידה.",
    badWeight: (min, max) => `משקל לידה בין ${min} ל-${max} ק״ג, בבקשה.`,
    badLength: (min, max) => `אורך לידה בין ${min} ל-${max} ס״מ, בבקשה.`,
    needDueOrName: "הוסיפו תאריך משוער, או לפחות שם, כדי שנדע במי מדובר.",
    needNameOrParent: "הוסיפו שם, או של מי התינוק.",

    save: "שמירה",
    add: "הוספת תינוק",
    cancel: "ביטול",
    savedToast: "נשמר",
    addedToast: "נוסף",
  },

  /* ------------------------------------------------------ the confirmations */

  prompt: {
    removeTitle: "להסיר?",
    removeBody: (name) => `הסרה של ${name} מהספר מוחקת גם את התאריכים והתמונה.`,
    removeNote: "אין דרך לבטל, אבל גיבוי שכבר ייצאתם עדיין שומר את הכול.",
    removeConfirm: "להסיר",
    removeCancel: "להשאיר",
    // "הוסר" would need to know whether it is a boy or a girl; "we removed" does
    // not, because the verb agrees with us rather than with the baby.
    removed: (name) => `הסרנו את ${name}`,

    arrivedTitle: "התינוק כאן!",
    arrivedAsk: (name, sex) => {
      if (sex === "girl") return `מתי ${name} הגיעה?`;
      if (sex === "boy") return `מתי ${name} הגיע?`;
      // Asking after the date instead of after the baby: no verb, no gender.
      return `מתי יום הלידה של ${name}?`;
    },
    born: (date) => `תאריך הלידה: ${date}.`,
    pickDay: "בחרו את היום שבו זה קרה.",
    arrivedConfirm: "כן, התינוק כאן",
    arrivedCancel: "עוד לא",
    welcome: (name, sex) => {
      if (sex === "girl") return `\u{1F389} ברוכה הבאה, ${name}!`;
      if (sex === "boy") return `\u{1F389} ברוך הבא, ${name}!`;
      return `\u{1F389} ${name} כבר כאן!`;
    },
  },

  /* ------------------------------------------------------- the date picker */

  date: {
    day: "יום",
    month: "חודש",
    year: "שנה",
    // "יום של תאריך לידה" is not a thing anybody says; read out as a pair of
    // labels it is exactly as clear and sounds like Hebrew.
    partLabel: (part, field) => `${part}, ${field}`,
  },
};
