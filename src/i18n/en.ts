import type { BabySex } from "../domain/types.ts";
import { enBaby } from "./en/baby.ts";
import { enBook } from "./en/book.ts";
import { enForm } from "./en/form.ts";
import { enSettings } from "./en/settings.ts";
import { enShare } from "./en/share.ts";

/*
 * The English wording, and the shape every other language has to match. It is
 * the source of truth for the catalogue type, so a key added here and nowhere
 * else fails the parity test rather than showing up as a blank on screen.
 *
 * Anything with a value in it is a function rather than a template with holes
 * punched in it, because word order is not a constant. "3 days old" and "turns
 * 4th in a week" both come out in a different order in Hebrew, and a language
 * that only got to fill in blanks could not say them properly.
 */

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export const en = {
  /* --------------------------------------------------------- by area */

  book: enBook,
  baby: enBaby,
  form: enForm,
  settings: enSettings,
  share: enShare,

  /* ------------------------------------------------------------- the basics */

  code: "en",
  name: "English",
  dir: "ltr",
  /*
   * Pinned rather than left to the phone. The app draws dates into a shareable
   * picture, so the device deciding would mean a card saying "June 15" from one
   * friend and "15 June" from another, for the same baby and the same button.
   */
  dateLocale: "en-GB",

  ordinal,

  /* ------------------------------------------------------- the app itself */

  app: {
    name: "Stork",
    back: "Back",
    close: "Close",
    /** Shown when a picture will not open, whatever the reason turned out to be. */
    badPhoto: "That picture would not open.",
    notAPhoto: "That file is not a picture.",
    /** Private browsing and a full disk both look like this from in here. */
    noStorage: "This browser will not let Stork save anything, so nothing you add here will survive closing the tab.",
  },

  /* ------------------------------------------------------------------- age */

  age: {
    notYet: "not here yet",
    bornToday: "born today",
    days: (n: number, _sex?: BabySex) => `${plural(n, "day")} old`,
    weeks: (n: number, _sex?: BabySex) => `${plural(n, "week")} old`,
    months: (n: number, _sex?: BabySex) => `${plural(n, "month")} old`,
    years: (n: number, _sex?: BabySex) => `${plural(n, "year")} old`,
    yearsMonths: (years: number, months: number, _sex?: BabySex) =>
      `${plural(years, "year")}, ${plural(months, "month")} old`,
    // The corner of a tile, where there is room for two characters.
    shortSoon: "soon",
    shortNew: "new",
    shortDays: (n: number) => `${n}d`,
    shortWeeks: (n: number) => `${n}w`,
    shortMonths: (n: number) => `${n}m`,
    shortYears: (n: number) => `${n}y`,
  },

  /* -------------------------------------------------------------- due date */

  due: {
    today: "due today",
    tomorrow: "due tomorrow",
    inDays: (n: number) => `due in ${plural(n, "day")}`,
    inWeeks: (n: number) => `due in ${plural(n, "week")}`,
    overdue: (n: number) => `${plural(n, "day")} overdue`,
    shortToday: "today",
    shortDays: (n: number) => `${n}d`,
    shortWeeks: (n: number) => `${n}w`,
    shortOverdue: (n: number) => `+${n}d`,
    week: (n: number) => `Week ${n}`,
    trimester: (n: number) => `${ordinal(n)} trimester`,
  },

  /* ------------------------------------------------------------ milestones */

  milestone: {
    born: "Arrived",
    d100: "100 days",
    m6: "Half a year",
    y1: "First birthday",
    y2: "Second birthday",
    brit: "Brit milah",
    inDays: (label: string, n: number) => `${label} in ${plural(n, "day")}`,
  },

  /* --------------------------------------------------------- what is next */

  next: {
    arrivedToday: "arrived today",
    birthdayToday: (turning: number, _sex?: BabySex) => `turns ${ordinal(turning)} today`,
    birthdayTomorrow: (turning: number, _sex?: BabySex) => `turns ${ordinal(turning)} tomorrow`,
    birthdayInDays: (turning: number, days: number, _sex?: BabySex) =>
      `turns ${ordinal(turning)} in ${plural(days, "day")}`,
  },

  /* ------------------------------------------------------------- labelling */

  label: {
    parentsBaby: (parent: string) => `${parent}'s baby`,
    unnamed: "Baby on the way",
    and: (a: string, b: string) => `${a} and ${b}`,
    list: (most: string[], last: string) => `${most.join(", ")} and ${last}`,
    /**
     * The same names with barely a line to put them on, as under a tile. The
     * ampersand buys the room here; in Hebrew nothing is saved by it, since
     * the "and" is a letter on the front of the next name either way.
     */
    shortList: (parents: string[]) => parents.join(" & "),
  },

  /* ----------------------------------------------------------- how big */

  size: {
    kg: (value: string) => `${value} kg`,
    lbOz: (pounds: number, ounces: number) => `${pounds} lb ${ounces} oz`,
    cm: (value: string) => `${value} cm`,
    inches: (value: string) => `${value} in`,
  },

  /* --------------------------------------------------------------- almanac */

  element: {
    fire: "Fire",
    earth: "Earth",
    air: "Air",
    water: "Water",
    wood: "Wood",
    metal: "Metal",
  },

  zodiac: {
    aquarius: { name: "Aquarius", range: "20 Jan - 18 Feb", trait: "a delightfully odd original" },
    pisces: { name: "Pisces", range: "19 Feb - 20 Mar", trait: "a dreamer with an enormous heart" },
    aries: { name: "Aries", range: "21 Mar - 19 Apr", trait: "a small firecracker, first through every door" },
    taurus: { name: "Taurus", range: "20 Apr - 20 May", trait: "cosy, steady and gloriously stubborn" },
    gemini: { name: "Gemini", range: "21 May - 20 Jun", trait: "a curious chatterbox with two of every idea" },
    cancer: { name: "Cancer", range: "21 Jun - 22 Jul", trait: "a soft-hearted homebody who feels everything" },
    leo: { name: "Leo", range: "23 Jul - 22 Aug", trait: "born for the spotlight and already aware of it" },
    virgo: { name: "Virgo", range: "23 Aug - 22 Sep", trait: "a tiny perfectionist who notices everything" },
    libra: { name: "Libra", range: "23 Sep - 22 Oct", trait: "a charmer who wants everyone to get along" },
    scorpio: { name: "Scorpio", range: "23 Oct - 21 Nov", trait: "intense, fearless and impossible to fool" },
    sagittarius: { name: "Sagittarius", range: "22 Nov - 21 Dec", trait: "an adventurer already planning the escape" },
    capricorn: { name: "Capricorn", range: "22 Dec - 19 Jan", trait: "an old soul who arrived with a plan" },
  },

  chinese: {
    rat: { name: "Rat", trait: "quick, charming and always one step ahead" },
    ox: { name: "Ox", trait: "patient and unshakeable once decided" },
    tiger: { name: "Tiger", trait: "brave, dramatic and full of nerve" },
    rabbit: { name: "Rabbit", trait: "gentle, lucky and quietly clever" },
    dragon: { name: "Dragon", trait: "born lucky and entirely unbothered by it" },
    snake: { name: "Snake", trait: "wise, watchful and mysterious" },
    horse: { name: "Horse", trait: "free-spirited and permanently in motion" },
    goat: { name: "Goat", trait: "kind, artistic and a little dreamy" },
    monkey: { name: "Monkey", trait: "mischievous and far too smart" },
    rooster: { name: "Rooster", trait: "confident, tidy and happy to tell you so" },
    dog: { name: "Dog", trait: "loyal, honest and endlessly fair" },
    pig: { name: "Pig", trait: "generous, cheerful and fond of a good meal" },
  },

  birthstones: [
    "Garnet", "Amethyst", "Aquamarine", "Diamond", "Emerald", "Pearl",
    "Ruby", "Peridot", "Sapphire", "Opal", "Topaz", "Turquoise",
  ],

  birthFlowers: [
    "Carnation", "Violet", "Daffodil", "Daisy", "Lily of the valley", "Rose",
    "Larkspur", "Gladiolus", "Aster", "Marigold", "Chrysanthemum", "Narcissus",
  ],

  /** The old rhyme, word for word. Empty in any language that has not got one. */
  dayRhyme: [
    { day: "Sunday", line: "Sunday's child is bonny and blithe and good and gay" },
    { day: "Monday", line: "Monday's child is fair of face" },
    { day: "Tuesday", line: "Tuesday's child is full of grace" },
    { day: "Wednesday", line: "Wednesday's child is full of woe" },
    { day: "Thursday", line: "Thursday's child has far to go" },
    { day: "Friday", line: "Friday's child is loving and giving" },
    { day: "Saturday", line: "Saturday's child works hard for a living" },
  ] as { day: string; line: string }[],

  /* -------------------------------------------------- the Hebrew calendar */

  hebrew: {
    section: "Hebrew calendar",
    born: "Hebrew date of birth",
    birthday: "Hebrew birthday",
    birthdayToday: "Hebrew birthday today",
    birthdayIn: (n: number) => `Hebrew birthday in ${plural(n, "day")}`,
    // The age itself, not the ordinal: "Turning 1st" is not what anyone says.
    turning: (n: number) => `Turning ${n}`,
    // Said once, on the page, rather than left as a thing to notice later.
    moved: "The 30th of that month does not come round every year, so it keeps to the first of the next.",
    sunset: "Taken from the civil date. A Hebrew day starts at sunset, so an evening birth belongs to the day after.",
    brit: "Brit milah",
    britOn: (date: string) => `Eighth day, ${date}`,
    britIn: (n: number) => `Brit milah in ${plural(n, "day")}`,
    britToday: "Brit milah today",
    britPassed: "Brit milah",
    bornOn: (chag: string) => `Born on ${chag}`,
    dueOn: (chag: string) => `Due on ${chag}`,
    chag: {
      roshHashana: "Rosh Hashana",
      yomKippur: "Yom Kippur",
      sukkot: "Sukkot",
      simchatTorah: "Simchat Torah",
      chanukah: "Chanukah",
      tuBiShvat: "Tu BiShvat",
      purim: "Purim",
      purimKatan: "Purim Katan",
      pesach: "Pesach",
      yomHaatzmaut: "Yom Ha'atzmaut",
      lagBaomer: "Lag BaOmer",
      shavuot: "Shavuot",
      tishaBav: "Tisha B'Av",
      tuBav: "Tu B'Av",
    },
  },

  /* ------------------------------------------------------------ life stage */

  stage: {
    egg: "on the way",
    hatched: "just hatched",
    chick: "a chick",
    chicken: "a chicken",
    rooster: "a rooster",
    turkey: "a turkey",
    asideChicken: "Not strictly a baby any more.",
    asideRooster: "A fully grown adult, in an app about babies.",
    asideTurkey: "At this point it is just a birthday reminder, which is fine.",
  },
};

/**
 * The shape every language has to fill in. Nothing type-checks it at build
 * time - the build only strips types, it does not run a compiler - so the
 * guarantee that Hebrew is complete comes from the parity test instead.
 */
export type Catalog = typeof en;
