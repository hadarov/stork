import type { BabySex } from "../../domain/types.ts";

/*
 * The shareable card, the calendar export and the reminders.
 *
 * Everything with a value in it is a function rather than a template with holes
 * punched in it, because word order is not a constant: "Mila's birthday is in 3
 * days" puts the name, the occasion and the count in an order Hebrew does not.
 *
 * A reminder is read in a second on a lock screen, so the titles carry the who
 * and the when and the bodies carry the nudge, and neither goes on longer than
 * it has to.
 */

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export const enShare = {
  card: {
    onTheWay: "On the way",
    watchThisSpace: "Watch this space",
    /*
     * Sex is here because Hebrew has no genderless way to say somebody was
     * born, and English has no use for it. Both languages take it so the card
     * does not have to know which one is reading it.
     */
    bornOn: (date: string, _sex?: BabySex) => `Born ${date}`,
    dueOn: (date: string) => `Due ${date}`,
    /** A badge: an emoji and a word. Which side the emoji goes on is a language's business. */
    chip: (emoji: string, label: string) => `${emoji} ${label}`,
    /** A star sign worked out from a due date, which is a guess and says so. */
    perhaps: (label: string) => `${label}?`,
    brand: "\u{1F423} Stork",
    noCanvas: "This browser cannot draw a card.",
    failed: "Could not make a card.",
    shared: "Shared",
    saved: "Card saved to your downloads",
  },

  ics: {
    /** What the calendar app calls the file once it has swallowed it. */
    calendarName: "Stork - babies",
    dueSummary: (name: string) => `\u{1F423} ${name} is due`,
    dueDescription: (parents: string) => `Due date for ${parents}.`,
    dueDescriptionPlain: "Due date.",
    birthdaySummary: (name: string) => `\u{1F382} ${name}'s birthday`,
    birthdayDescription: (date: string, turning: string, _sex?: BabySex) =>
      `Born ${date}. Turning ${turning} at the next one.`,
    hebrewSummary: (name: string) => `\u2721\uFE0F ${name}'s Hebrew birthday`,
    hebrewDescription: (hebrewDate: string, turning: string) =>
      `${hebrewDate}. Turning ${turning}.`,
  },

  nudge: {
    dueTodayTitle: (name: string) => `${name} is due today`,
    dueTodayBody: "Today would be a good day to check in.",
    dueSoonTitle: (name: string) => `${name} is due next week`,
    dueSoonBody: "A week's warning, so you have no excuse.",
    birthdayTodayTitle: (name: string) => `${name}'s birthday is today`,
    birthdayTodayBody: "Say something before the day runs out.",
    birthdaySoonTitle: (name: string) => `${name}'s birthday is in a week`,
    birthdaySoonBody: "Long enough to order something.",
    bigDayTodayTitle: (name: string) => `${name} has a big day`,
    bigDayTodayBody: "Worth a message.",
    bigDaySoonTitle: (name: string) => `${name} has a big day next week`,
    bigDaySoonBody: "Consider yourself warned.",

    /* The Hebrew birthday walks around the year, so it never coincides with the
     * other one and is worth its own reminder. */
    hebrewTodayTitle: (name: string) => `${name}'s Hebrew birthday is today`,
    hebrewTodayBody: "Not the Gregorian one. That one moves about.",
    hebrewSoonTitle: (name: string, days: number) =>
      `${name}'s Hebrew birthday is in ${plural(days, "day")}`,
    hebrewSoonBody: "Worth a mention next time you speak.",
    britTodayTitle: (name: string) => `${name}'s brit is today`,
    britTodayBody: "The eighth day. A good morning to send something.",
    britSoonTitle: (name: string, days: number) => `${name}'s brit is in ${plural(days, "day")}`,
    britSoonBody: "Eight days after the birth, so it comes round fast.",

    /* Said in a toast, when the button in Settings has been pressed. */
    cannot: "This browser cannot show reminders.",
    declined: "No reminders, then.",
    on: "Reminders on.",
  },
};
