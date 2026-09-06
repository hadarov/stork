import type { BabySex } from "../../domain/types.ts";

/**
 * Adding and editing a baby, the date dropdowns, and the two confirmations.
 *
 * Anything with a value in it is a function rather than a template with holes,
 * for the reason the core catalogue gives: word order is not a constant. Two of
 * them take the baby's sex as well, because Hebrew cannot welcome somebody or
 * ask when they arrived without knowing whether it is talking to a בן or a בת.
 *
 * The month names of the date picker are deliberately not here. They are asked
 * of `Intl.DateTimeFormat(t.dateLocale)` in the picker itself, so the month in
 * the dropdown is always the same word as the month in the dates the app writes
 * out, in whichever language is on.
 */
export const enForm = {
  /* ---------------------------------------------------- adding and editing */

  edit: {
    title: "Edit",
    titleNew: "New baby",

    /* on the way, or here yet */
    statusLabel: "Has the baby arrived?",
    statusExpecting: "On the way",
    statusBorn: "Here",

    /* the photo */
    addPhoto: "Add a photo",
    changePhoto: "Change photo",
    removePhoto: "Remove",
    photoFailed: "Could not read that image.",

    /* who they are */
    name: "Name",
    namePlaceholder: "Still deciding?",
    parent: "Parent",
    parentPlaceholder: "Sarah",
    secondParent: "Second parent",
    optional: "Optional",
    notes: "Notes",
    notesPlaceholder: "Gift ideas, hospital, anything",

    /* the dates and the numbers */
    dueDate: "Due date",
    birthday: "Birthday",
    birthTime: "Time of birth",
    birthTimeHint: "Optional, but it settles a star sign born on a cusp.",
    weight: "Weight",
    kg: "kg",
    length: "Length",
    cm: "cm",

    sex: "Girl or boy",
    sexUnsaid: "Rather not say",
    sexGirl: "Girl",
    sexBoy: "Boy",
    sexSurprise: "A surprise",

    /* what is wrong with the form */
    needBirthday: "A birthday is needed once the baby is here.",
    badWeight: (min: number, max: number) =>
      `A birth weight between ${min} and ${max} kg, please.`,
    badLength: (min: number, max: number) =>
      `A birth length between ${min} and ${max} cm, please.`,
    needDueOrName: "Add a due date, or at least a name to remember them by.",
    needNameOrParent: "Add a name, or whose baby this is.",

    save: "Save",
    add: "Add baby",
    cancel: "Cancel",
    savedToast: "Saved",
    addedToast: "Added",
  },

  /* ------------------------------------------------------ the confirmations */

  prompt: {
    removeTitle: "Remove?",
    removeBody: (name: string) =>
      `${name} will be taken out of your book, along with the dates and the photo.`,
    removeNote: "There is no undo, but a backup you have already exported still has them.",
    removeConfirm: "Remove",
    removeCancel: "Keep",
    removed: (name: string) => `${name} removed`,

    arrivedTitle: "They're here!",
    arrivedAsk: (name: string, _sex?: BabySex) => `When did ${name} arrive?`,
    born: (date: string) => `Born ${date}.`,
    pickDay: "Pick the day they arrived.",
    arrivedConfirm: "Yes, they're here",
    arrivedCancel: "Not yet",
    welcome: (name: string, _sex?: BabySex) => `\u{1F389} Welcome, ${name}!`,
  },

  /* ------------------------------------------------------- the date picker */

  date: {
    // Both the empty option and the label read to a screen reader.
    day: "Day",
    month: "Month",
    year: "Year",
    partLabel: (part: string, field: string) => `${part} of ${field}`,
  },
};
