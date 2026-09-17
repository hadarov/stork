import type { BabySex } from "../../domain/types.ts";

/*
 * A baby's own page, the photo album and the moments on it.
 *
 * Two small helpers are copied rather than imported. The core catalogue is
 * what imports this file, so reaching back into it would close a circle, and
 * keeping each area standing on its own is what lets two of them be written at
 * the same time without either one waiting.
 */

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** The separator between two facts on one line, kept in one place. */
const DOT = " \u00b7 ";

export const enBaby = {
  detail: {
    /* --------------------------------------------------------------- the top */

    edit: "Edit",
    girl: "Girl",
    boy: "Boy",

    /* ---------------------------------------------------------- a born baby */

    birthdayToday: (turning: number, _sex?: BabySex) =>
      `\u{1F382} Turns ${ordinal(turning)} today`,
    birthdayIn: (turning: number, days: number, _sex?: BabySex) =>
      `Turns ${ordinal(turning)} in ${plural(days, "day")}`,

    stars: "Written in the stars",
    signMeta: (element: string, range: string) => `${element}${DOT}${range}`,
    /** "Wood Dragon". The element leads in English and follows in Hebrew. */
    chineseName: (element: string, animal: string) => `${element} ${animal}`,
    chineseYear: (animal: string, year: number) => `Year of the ${animal}, ${year}`,
    trait: (name: string, trait: string) => `${name}: ${trait}.`,
    cusp: (neighbour: string) =>
      `Right on the cusp with ${neighbour} - the boundary shifts by a day from year to year, so either could be fair.`,

    bornSection: "Born",
    factDay: "Day",
    atTime: (time: string) => `at ${time}`,
    factWeight: "Weight",
    factLength: "Length",
    factBirthstone: "Birthstone",
    factFlower: "Flower",
    factWeekday: "Weekday",
    /** The nursery rhyme, quoted. Never reached in a language without one. */
    rhyme: (line: string) => `\u201C${line}.\u201D`,

    milestonesSection: "Milestones",
    milestoneWhen: (date: string, days: number) => `${date}${DOT}in ${plural(days, "day")}`,

    /* ---------------------------------------------------------------- a bump */

    justBorn: (_sex?: BabySex) => "\u{1F389} Just born!",
    onTheWay: "On the way",
    noDueDate: "Add a due date to start the countdown.",
    dueLine: (week: string, trimester: string, date: string) =>
      `${week}${DOT}${trimester}${DOT}${date}`,
    starsIfOnTime: "If they arrive on time",
    signMayChange: "Babies rarely read the calendar, so the sign may well change on the day.",

    /* ------------------------------------------------------ Hebrew calendar */

    hebrewDue: "Hebrew due date",
    /** Under the date itself: how far off it is, and the age it brings. */
    hebrewBirthdayMeta: (days: number, turning: string) =>
      `in ${plural(days, "day")}${DOT}${turning}`,

    /* --------------------------------------------------------------- family */

    familySection: "Family",
    siblingMeta: (relation: string, status: string) => `${relation}${DOT}${status}`,
    anotherOne: "\uFF0B Another one",
    addSibling: "\uFF0B Add a sibling",

    /* ---------------------------------------------------------------- notes */

    notesSection: "Notes",

    /* ----------------------------------------------------------- keeping up */

    keepingUpSection: "Keeping up",
    giftSent: "\u2713 Gift sent",
    markGift: "Mark gift as sent",
    giftMarked: "Gift marked as sent",
    giftUnmarked: "Marked as not sent",
    shareCard: "\u{1F48C} Share a card",
    cardFailed: "Could not make a card.",
    addToCalendar: "\u{1F4C5} Add to my calendar",
    calendarSaved: "Calendar file saved - open it to add the date",
    remove: "Remove",
  },

  album: {
    section: "Album",
    empty: "Photos you add here stay in order, oldest first.",
    add: "\u{1F4F7} Add a photo",
    added: "Photo added",
    full: (max: number) => `${max} photos each, so there is room for everyone.`,

    caption: "Caption",
    captionHint: "First smile",
    taken: "Taken",
    useAsPicture: "Use as their picture",
    nowTheirPicture: "That is their picture now",
    delete: "Delete",
    removed: "Photo removed",
  },

  moments: {
    section: "Moments",
    empty: "The firsts nothing can work out for you: a tooth, a word, the walk across the room.",
    add: "\uFF0B Note a moment",

    what: "What happened",
    whatHint: "First tooth",
    when: "When",
    /** Over the suggestions, which sit under the box you could type it into. */
    orOneOfThese: "Or one of these",
    /**
     * The ones nearly every baby gets, roughly in the order they arrive. Free
     * text is still the point; these only save the typing on the usual ones.
     */
    common: [
      "First smile",
      "First tooth",
      "Rolled over",
      "Sat up",
      "Crawled",
      "First steps",
      "First word",
    ],

    save: "Save",
    cancel: "Cancel",
    needLabel: "Say what happened, in a word or two.",
    needDate: "Pick the day it happened.",
    full: (max: number) => `${max} moments each, which is a great many firsts.`,
    added: "Moment saved",
    /** Reaches a screen reader only, where a bare cross says nothing at all. */
    remove: (label: string) => `Remove ${label}`,
    removed: "Moment removed",
  },
};
