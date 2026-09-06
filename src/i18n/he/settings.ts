import type { enSettings } from "../en/settings.ts";

/*
 * The Hebrew wording for Settings.
 *
 * The dual turns up here more than anywhere else in the app, because these
 * lines count days: a backup written the day before yesterday is "לפני יומיים",
 * never "לפני 2 ימים", and one written the day before that says "לפני 3 ימים".
 *
 * Two other things are not translations. The app calls itself סטורק rather than
 * being left in Latin in the middle of a Hebrew sentence, because "ב-Stork" is
 * not something anybody writes. The platform names do stay exactly as they are
 * - iCloud Drive, Dropbox, Safari - which is also how a Hebrew speaker writes
 * them.
 *
 * The backup status lines are noun phrases rather than sentences: "3 תינוקות,
 * גיבוי לפני יומיים" says what the English verb says, and avoids having to
 * agree a verb with a number that keeps changing.
 */

/** One, two, many. The dual already means two, so a 2 in front says it twice. */
function count(n: number, one: string, two: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${many}`;
}

const days = (n: number) => count(n, "יום", "יומיים", "ימים");

export const heSettings: typeof enSettings = {
  /* ------------------------------------------------------- the sheet itself */

  settings: {
    title: "הגדרות",
    notNow: "לא עכשיו",

    langSection: "שפה",
    langLabel: "שפה",
    langSystem: "לפי המכשיר",
    langNote: "כברירת מחדל לפי הגדרות המכשיר. עברית מביאה איתה גם את הפריסה, מימין לשמאל.",

    jewishSection: "לוח עברי",
    jewishNote:
      "התאריך העברי, יום ההולדת העברי, הברית והחג שהתינוק נולד בו, בעמוד שלו. בעברית מוצג, באנגלית לא, אלא אם תכריעו כאן.",
    jewishLabel: "לוח עברי",
    jewishAuto: "אוטומטי",
    jewishOn: "מוצג",
    jewishOff: "מוסתר",

    lookSection: "מראה",
    lookNote:
      "כהה כברירת מחדל. התינוקות שומרים על הצבעים שלהם כך או כך — הם החלק היחיד שאמור לצעוק.",
    themeLabel: "מראה",
    themeAuto: "אוטומטי",
    themeDark: "כהה",
    themeLight: "בהיר",

    remindersSection: "תזכורות",
    turnOnNudges: "הפעלת תזכורות",

    calendarSection: "התאריכים שלכם, במקומות אחרים",
    calendarTitle: "כל התאריכים ליומן שלכם",
    calendarBody:
      "ימי הולדת חוזרים כל שנה, תאריכי לידה משוערים מופיעים פעם אחת, ושניהם מזכירים יומיים מראש.",
    exportIcs: "ייצוא ICS",
    nothingToExport: "אין עוד תאריכים לייצא",
    exported: "קובץ היומן נשמר — פתחו אותו כדי להוסיף את כל התאריכים",

    aboutSection: "אודות",
    aboutWhat:
      "סטורק עוקב אחרי התינוקות של החברים שלכם כדי שאתם לא תצטרכו: מי מצפה ומתי, מי בדיוק נולד, למי יום הולדת בקרוב, ואם באמת שלחתם את המתנה ההיא.",
    aboutSigns:
      "תאריכי המזלות זזים ביום בין שנה לשנה, ולכן יום הולדת שנופל על הגבול מסומן ולא מנוחש. המזל הסיני מתחלף בראש השנה הסיני, לא ב-1 בינואר.",
  },

  /* --------------------------------------------------------------- backups */

  backup: {
    section: "גיבוי",
    onDevice:
      "כל מה שאתם מוסיפים נמצא על המכשיר הזה בלבד. שום דבר לא נשלח לשום מקום ואף אחד אחר לא רואה את זה — ומאותה סיבה, מחיקה של נתוני הדפדפן תמחק גם אותו.",
    syncFolder:
      "שמרו את הגיבוי במקום שהטלפון שלכם מסנכרן בכל מקרה — iCloud Drive, Google Drive, Dropbox — והוא יגיע איתכם לטלפון הבא בלי שאף אחד יריץ שרת בשבילכם.",

    nowTitle: "גיבוי עכשיו",
    nowBodyAuto: "נכתב מעצמו בכל פעם שמשהו משתנה.",
    nowBodyManual: "בוחרים תיקייה פעם אחת, ומשם זו הקשה אחת.",
    nowAction: "גיבוי",

    autoTitle: "עדכון אוטומטי",
    autoBodyOn: "מופעל. אותו קובץ נכתב מחדש שתי שניות אחרי כל שינוי.",
    autoBodyOff: "שהקובץ הזה יתעדכן מעצמו, כדי שלא תצטרכו לזכור.",
    turnOn: "הפעלה",
    turnOff: "כיבוי",

    restoreTitle: "שחזור מגיבוי",
    restoreBody: "ממזג ולא דורס: הגרסה החדשה יותר של כל תינוק היא זו שנשארת.",
    restoreAction: "ייבוא",

    /* ------------------------------------------------------ what came of it */

    savedTo: (file) => `נשמר בקובץ ${file}`,
    saveToFiles: "בחרו ״שמירה בקבצים״ כדי שהגיבוי יישמר ב-iCloud Drive",
    toDownloads: "הגיבוי נשמר בתיקיית ההורדות",
    shareTitle: "גיבוי של סטורק",
    autoNowOff: "מעכשיו הגיבוי בידיים שלכם",
    autoNowOn: (file) => `מעכשיו ${file} יתעדכן מעצמו`,
    // A number in front of a verb would have to agree with it, so the counts
    // come after the word instead and every case reads the same.
    merged: (added, updated, skipped) =>
      `נוספו: ${added}, עודכנו: ${updated}, ללא שינוי: ${skipped}`,
    nothingReadable: "אין בקובץ הזה שום דבר קריא",
    unreadable: "אי אפשר לקרוא את הקובץ הזה",
    writeFailed: "הגיבוי לא נכתב",

    /* --------------------------------------- the one line about where it is */

    nothingYet: "אין עוד מה לגבות",
    // Babies are counted like people and not like days: two of them is שני
    // תינוקות, and one of them keeps a numeral of its own.
    babies: (n) => count(n, "תינוק אחד", "שני תינוקות", "תינוקות"),
    never: (book) => `${book}, אין גיבוי בכלל`,
    today: (book) => `${book}, גיבוי היום`,
    yesterday: (book) => `${book}, גיבוי אתמול`,
    daysAgo: (book, n) => `${book}, גיבוי לפני ${days(n)}`,
    outOfDate: (line) => `${line} — כבר לא מעודכן`,

    /* ------------------------------------------------ bringing it up unasked */

    stoppedTitle: "הגיבוי האוטומטי נעצר",
    stoppedLine: "אין יותר אפשרות לכתוב לתיקייה שבחרתם. גיבוי אחד ביד מחזיר את זה לפעולה.",
    noneTitle: "עוד אין גיבוי",
    noneLine: "הכול נמצא על המכשיר הזה בלבד. מחיקה של נתוני הדפדפן תמחק גם את זה.",
    staleTitle: "הגיבוי לא מעודכן",
    staleLine: "משהו השתנה מאז שהגיבוי האחרון נכתב.",
    nudgeAction: "גיבוי עכשיו",
  },

  /* -------------------------------------------- whether the device holds on */

  storage: {
    askTitle: "בקשה מהדפדפן לא למחוק",
    askBody:
      "מוציא את סטורק מרשימת הדברים שנמחקים כשנגמר המקום. זה לא ימנע מחיקה של נתוני הגלישה ביד, ושום דבר לא ימנע אותה.",
    askAction: "לבקש",

    silent: "הדפדפן הזה לא מגלה אם הוא שומר את הנתונים של סטורק או מוחק אותם כשנגמר לו המקום.",
    persisted:
      "הדפדפן הסכים לא למחוק את הנתונים של סטורק מעצמו. מחיקה של נתוני הגלישה ביד עדיין תמחק אותם.",
    sweepsInstalled:
      "Safari מוחק את הנתונים של אתר אחרי שבעה ימים שלא נפתח. במסך הבית סטורק נספר בנפרד, ולכן די להיכנס אליו מדי פעם.",
    sweepsInTab:
      "Safari מוחק את הנתונים של אתר אחרי שבעה ימים שלא נפתח. הוספה של סטורק למסך הבית נותנת לו ספירה נפרדת משל עצמו.",
    mayClear: "הדפדפן עשוי למחוק את הנתונים של סטורק אם ייגמר לו המקום.",

    wontAnswer: "הדפדפן הזה לא עונה על זה.",
    agreed: "הדפדפן הסכים לשמור.",
    refused: "הדפדפן לא הבטיח כלום. הגיבוי הוא התשובה ממילא.",
  },

  /* ------------------------------------------------------------- reminders */

  nudges: {
    cannot: "הדפדפן הזה לא יציג תזכורות בכלל.",
    refused: "דחיתם את הבקשה לתזכורות. לבטל את זה אפשר רק בהגדרות הדפדפן לאתר הזה.",
    offer: "תזכורת שבוע לפני, ועוד אחת בבוקר עצמו.",
    onProperly: "מופעל. שבוע לפני ובבוקר עצמו, גם כשסטורק סגור.",
    onlyOpen: "מופעל, אבל רק כשסטורק פתוח. הוסיפו אותו למסך הבית והתזכורות יגיעו כמו שצריך.",
    onlyOnLaunch:
      "מופעל, אבל הדפדפן הזה בודק רק כשפותחים את סטורק, ולכן תזכורת יכולה להגיע באיחור. הייצוא ליומן הוא זה שאפשר לסמוך עליו.",
  },

  /* ------------------------------------------------------------ installing */

  install: {
    title: "סטורק במסך הבית",
    line: "מקבל אייקון משלו, נפתח בלי שורת הכתובת, וממשיך לעבוד גם בלי רשת.",
    action: "התקנת סטורק",
    // Named the way the Hebrew share sheet on iOS names them, so they can be
    // found by reading rather than by guessing.
    steps: ["הקישו על כפתור השיתוף", "גללו עד ״הוספה למסך הבית״", "הקישו על ״הוסף״"],

    ownMenu: "הדפדפן הזה מתקין מהתפריט שלו.",
    installing: "מתקין – חפשו את סטורק במסך הבית.",
    declined: "אין בעיה. הכפתור נשאר בהגדרות.",
  },
};
