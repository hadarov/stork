import type { BabySex } from "../../domain/types.ts";

/*
 * The grid, the search, the week strip and the household brief.
 *
 * One area of the catalogue per group of screens, so the two languages can be
 * read side by side a screen at a time rather than as one enormous file, and
 * so nothing has to be merged when several of them are being written at once.
 */
export const enBook = {
  /* ------------------------------------------------------------------ home */

  home: {
    /* The name over the book. Translated rather than transliterated: the bird
     * is the joke, and a language that has its own word for it should use it. */
    title: "Stork",
    settings: "Settings",
    /* The button in the corner and the one in the empty state, which say the
     * same thing in both places. */
    add: "Add a baby",
    searchLabel: "Search",
    searchPlaceholder: "Search a name or a friend",
    thisWeek: "This week",
    expecting: "On the way",
    born: "Little ones",
    /* The corner of a tile, for a baby who has arrived with no date on them.
     * Everything else there comes from `age` and `due` in the core. */
    shortHere: "here",
    noMatchTitle: "Nobody by that name",
    noMatchBody: "Try a parent's name instead.",
    emptyTitle: "No babies yet",
    emptyBody: "Add the first one and Stork will keep track of the dates for you.",
  },

  /* ----------------------------------------------------------------- brief */

  brief: {
    giftSent: "\u2713 You sent something",
    giftNone: "Nothing sent yet",
    /** `age` is a whole phrase - "3 weeks old" - not a number. */
    giftLate: (age: string) => `\u2717 Nothing sent, and they are ${age}`,
    born: (date: string, _sex?: BabySex) => `Born ${date}`,
    calmTitle: "Nothing imminent",
    calmBody: "Which is its own kind of good news.",
    noNotes:
      "You have written nothing down about any of them. Whatever you learn tonight, put it in their notes before you forget it.",
  },

  /* ---------------------------------------------------------------- family */

  family: {
    bigSister: "big sister",
    littleSister: "little sister",
    bigBrother: "big brother",
    littleBrother: "little brother",
    olderSibling: "older sibling",
    youngerSibling: "younger sibling",
  },
};
