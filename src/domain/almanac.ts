import { zodiacYearFor } from "./lunarNewYear.ts";

export type StarSign = {
  name: string;
  emoji: string;
  element: "Fire" | "Earth" | "Air" | "Water";
  range: string;
  trait: string;
};

export type StarSignReading = StarSign & {
  /** Set when the birthday sits on the first or last day of the sign. */
  cuspWith?: StarSign;
};

export type ChineseSign = {
  animal: string;
  emoji: string;
  element: "Wood" | "Fire" | "Earth" | "Metal" | "Water";
  year: number;
  trait: string;
};

/** Ordered by the day the sign starts; `from` and `to` are inclusive MMDD. */
const STAR_SIGNS: (StarSign & { from: number; to: number })[] = [
  { from: 120, to: 218, name: "Aquarius", emoji: "\u{2652}", element: "Air", range: "20 Jan - 18 Feb", trait: "a delightfully odd original" },
  { from: 219, to: 320, name: "Pisces", emoji: "\u{2653}", element: "Water", range: "19 Feb - 20 Mar", trait: "a dreamer with an enormous heart" },
  { from: 321, to: 419, name: "Aries", emoji: "\u{2648}", element: "Fire", range: "21 Mar - 19 Apr", trait: "a small firecracker, first through every door" },
  { from: 420, to: 520, name: "Taurus", emoji: "\u{2649}", element: "Earth", range: "20 Apr - 20 May", trait: "cosy, steady and gloriously stubborn" },
  { from: 521, to: 620, name: "Gemini", emoji: "\u{264A}", element: "Air", range: "21 May - 20 Jun", trait: "a curious chatterbox with two of every idea" },
  { from: 621, to: 722, name: "Cancer", emoji: "\u{264B}", element: "Water", range: "21 Jun - 22 Jul", trait: "a soft-hearted homebody who feels everything" },
  { from: 723, to: 822, name: "Leo", emoji: "\u{264C}", element: "Fire", range: "23 Jul - 22 Aug", trait: "born for the spotlight and already aware of it" },
  { from: 823, to: 922, name: "Virgo", emoji: "\u{264D}", element: "Earth", range: "23 Aug - 22 Sep", trait: "a tiny perfectionist who notices everything" },
  { from: 923, to: 1022, name: "Libra", emoji: "\u{264E}", element: "Air", range: "23 Sep - 22 Oct", trait: "a charmer who wants everyone to get along" },
  { from: 1023, to: 1121, name: "Scorpio", emoji: "\u{264F}", element: "Water", range: "23 Oct - 21 Nov", trait: "intense, fearless and impossible to fool" },
  { from: 1122, to: 1221, name: "Sagittarius", emoji: "\u{2650}", element: "Fire", range: "22 Nov - 21 Dec", trait: "an adventurer already planning the escape" },
  // Capricorn wraps the new year, so it is stored as its two halves.
  { from: 1222, to: 1231, name: "Capricorn", emoji: "\u{2651}", element: "Earth", range: "22 Dec - 19 Jan", trait: "an old soul who arrived with a plan" },
  { from: 101, to: 119, name: "Capricorn", emoji: "\u{2651}", element: "Earth", range: "22 Dec - 19 Jan", trait: "an old soul who arrived with a plan" },
];

const CHINESE_ANIMALS: { animal: string; emoji: string; trait: string }[] = [
  { animal: "Rat", emoji: "\u{1F401}", trait: "quick, charming and always one step ahead" },
  { animal: "Ox", emoji: "\u{1F402}", trait: "patient and unshakeable once decided" },
  { animal: "Tiger", emoji: "\u{1F405}", trait: "brave, dramatic and full of nerve" },
  { animal: "Rabbit", emoji: "\u{1F407}", trait: "gentle, lucky and quietly clever" },
  { animal: "Dragon", emoji: "\u{1F409}", trait: "born lucky and entirely unbothered by it" },
  { animal: "Snake", emoji: "\u{1F40D}", trait: "wise, watchful and mysterious" },
  { animal: "Horse", emoji: "\u{1F40E}", trait: "free-spirited and permanently in motion" },
  { animal: "Goat", emoji: "\u{1F410}", trait: "kind, artistic and a little dreamy" },
  { animal: "Monkey", emoji: "\u{1F412}", trait: "mischievous and far too smart" },
  { animal: "Rooster", emoji: "\u{1F413}", trait: "confident, tidy and happy to tell you so" },
  { animal: "Dog", emoji: "\u{1F415}", trait: "loyal, honest and endlessly fair" },
  { animal: "Pig", emoji: "\u{1F416}", trait: "generous, cheerful and fond of a good meal" },
];

/** Heavenly-stem elements, two years each, anchored on 1900 being Metal. */
const CHINESE_ELEMENTS: ChineseSign["element"][] = [
  "Metal", "Metal", "Water", "Water", "Wood", "Wood", "Fire", "Fire", "Earth", "Earth",
];

const BIRTHSTONES = [
  "Garnet", "Amethyst", "Aquamarine", "Diamond", "Emerald", "Pearl",
  "Ruby", "Peridot", "Sapphire", "Opal", "Topaz", "Turquoise",
];

const BIRTH_FLOWERS = [
  "Carnation", "Violet", "Daffodil", "Daisy", "Lily of the valley", "Rose",
  "Larkspur", "Gladiolus", "Aster", "Marigold", "Chrysanthemum", "Narcissus",
];

/** The old nursery rhyme, kept word for word. */
const DAY_RHYME = [
  "Sunday's child is bonny and blithe and good and gay",
  "Monday's child is fair of face",
  "Tuesday's child is full of grace",
  "Wednesday's child is full of woe",
  "Thursday's child has far to go",
  "Friday's child is loving and giving",
  "Saturday's child works hard for a living",
];

function mmdd(date: Date): number {
  return (date.getMonth() + 1) * 100 + date.getDate();
}

export function starSign(date: Date): StarSignReading {
  const key = mmdd(date);
  const index = STAR_SIGNS.findIndex((sign) => key >= sign.from && key <= sign.to);
  const sign = STAR_SIGNS[index];
  const reading: StarSignReading = {
    name: sign.name,
    emoji: sign.emoji,
    element: sign.element,
    range: sign.range,
    trait: sign.trait,
  };

  // Sun-sign boundaries drift by a day between years, so a birthday landing on
  // the very edge is worth flagging rather than stating flatly.
  const neighbour =
    key === sign.from
      ? STAR_SIGNS[(index - 1 + STAR_SIGNS.length) % STAR_SIGNS.length]
      : key === sign.to
        ? STAR_SIGNS[(index + 1) % STAR_SIGNS.length]
        : undefined;
  if (neighbour && neighbour.name !== sign.name) {
    reading.cuspWith = {
      name: neighbour.name,
      emoji: neighbour.emoji,
      element: neighbour.element,
      range: neighbour.range,
      trait: neighbour.trait,
    };
  }

  return reading;
}

export function chineseSign(date: Date): ChineseSign {
  const year = zodiacYearFor(date);
  const offset = ((year - 1900) % 12 + 12) % 12;
  const animal = CHINESE_ANIMALS[offset];
  return {
    animal: animal.animal,
    emoji: animal.emoji,
    element: CHINESE_ELEMENTS[((year - 1900) % 10 + 10) % 10],
    year,
    trait: animal.trait,
  };
}

export function birthstone(date: Date): string {
  return BIRTHSTONES[date.getMonth()];
}

export function birthFlower(date: Date): string {
  return BIRTH_FLOWERS[date.getMonth()];
}

export function dayOfWeekRhyme(date: Date): { day: string; line: string } {
  return {
    day: date.toLocaleDateString(undefined, { weekday: "long" }),
    line: DAY_RHYME[date.getDay()],
  };
}
