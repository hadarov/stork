import type { enBook } from "../en/book.ts";

/*
 * The grid, the search, the week strip and the household brief, in Hebrew.
 *
 * Two things needed care here.
 *
 * Gender. "Born 15 June" has no genderless form: a boy נולד and a girl נולדה.
 * When the sex is known it is said properly, and when it is not the verb is
 * dropped for a plain label with the date on it, which is what a form would
 * say anyway and beats guessing.
 *
 * Idiom. Two lines lean on English to do their work. "Nothing imminent" is
 * flat in Hebrew, so the calm is said as an empty horizon, and "Add the first
 * one and Stork will keep track of the dates for you" keeps the app as the one
 * doing the remembering rather than promising anything to the reader.
 */
export const heBook: typeof enBook = {
  /* ------------------------------------------------------------------ home */

  home: {
    title: "סטורק",
    settings: "הגדרות",
    add: "הוספת תינוק",
    searchLabel: "חיפוש",
    searchPlaceholder: "חיפוש לפי שם של תינוק או של חבר",
    thisWeek: "השבוע",
    expecting: "בדרך",
    born: "הקטנטנים",
    shortHere: "כאן",
    noMatchTitle: "אין אף אחד בשם הזה",
    noMatchBody: "אפשר לנסות את שם ההורים.",
    emptyTitle: "עוד אין תינוקות",
    emptyBody: "מוסיפים את הראשון, וסטורק יזכור את התאריכים.",
  },

  /* ----------------------------------------------------------------- brief */

  brief: {
    // "שלחת" is written the same for a man and for a woman, so the line works
    // without asking who is reading it.
    giftSent: "\u2713 שלחת משהו",
    giftNone: "עוד לא נשלח כלום",
    // The age arrives as a phrase - "בן שנתיים" - and וכבר leads into it
    // without needing a pronoun, so nothing here has to guess a gender.
    giftLate: (age) => `\u2717 עוד לא נשלח כלום, וכבר ${age}`,
    born: (date, sex) => {
      if (sex === "girl") return `נולדה ב-${date}`;
      if (sex === "boy") return `נולד ב-${date}`;
      return `תאריך לידה: ${date}`;
    },
    calmTitle: "אין כלום באופק",
    calmBody: "וגם זה סוג של חדשות טובות.",
    noNotes:
      "אין כאן שום הערה על אף אחד מהם. מה שתגלו הערב, שווה לרשום בהערות לפני שזה נשכח.",
  },

  /* ---------------------------------------------------------------- family */

  family: {
    bigSister: "אחות גדולה",
    littleSister: "אחות קטנה",
    bigBrother: "אח גדול",
    littleBrother: "אח קטן",
    // Hebrew has no everyday word for a sibling of unknown sex, and "אחאי" is
    // something out of a form. "אח או אחות" is what people actually say about
    // a bump, so the pair is spelled out rather than cut with a slash.
    olderSibling: "אח או אחות גדולים",
    youngerSibling: "אח או אחות קטנים",
    twinSister: "אחות תאומה",
    twinBrother: "אח תאום",
    // Same reason as the siblings above: no everyday neutral, so the pair is
    // spelled out rather than cut with a slash.
    twin: "אח או אחות תאומים",
  },

  /* ------------------------------------------------- correcting a family */

  fixFamily: {
    openLabel: "לא נכון?",
    title: "מי במשפחה הזאת?",
    intro:
      "המשפחות מזוהות לפי שמות ההורים, וזה יוצא לא נכון כששני חברים חולקים שם, או כשאותו זוג נרשם בשתי צורות שונות.",
    inThisFamily: "במשפחה הזאת",
    // Heads a list of girls as well as boys, which "מישהו אחר" does not.
    somebodyElse: "שאר הספר",
    becauseOf: (relation, why) => `${relation} \u00B7 ${why}`,
    fromTheNames: "לפי השמות",
    youSaidSo: "לפי מה שאמרתם",
    notRelated: "לא קרובים",
    sameFamily: "אותה משפחה",
    // No verb in either line, which is what keeps them free of gender: the
    // name may belong to a boy, a girl or a bump nobody has met yet.
    nowApart: (name) => `${name} כבר לא במשפחה הזאת`,
    nowTogether: (name) => `${name} במשפחה הזאת`,
    noParents: "בלי שם הורה",
    nobodyElse: "אין עדיין אף אחד אחר בפנקס.",
    noMatch: "אין אף אחד בשם הזה.",
    searchLabel: "חיפוש תינוק",
    searchPlaceholder: "שם של תינוק או של הורה",
  },
};
