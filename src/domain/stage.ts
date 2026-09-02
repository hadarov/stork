import { parseDate } from "./derive.ts";
import type { Baby } from "./types.ts";

/*
 * An egg, then a hatchling, then a chick. Which is the whole story for anyone
 * this app is actually for.
 *
 * The rungs above that exist because somebody will eventually put a grown adult
 * in here to stop forgetting their birthday, and the app noticing is funnier and
 * kinder than the app pretending they are a chick.
 */

export type Stage = {
  glyph: string;
  /** For a screen reader, and for the card. */
  label: string;
  /** Only on the rungs where a baby app has clearly been repurposed. */
  aside?: string;
};

const EGG: Stage = { glyph: "\u{1F95A}", label: "on the way" };

const LADDER: (Stage & { from: number })[] = [
  {
    from: 40,
    glyph: "\u{1F983}",
    label: "a turkey",
    aside: "At this point it is just a birthday reminder, which is fine.",
  },
  {
    from: 18,
    glyph: "\u{1F413}",
    label: "a rooster",
    aside: "A fully grown adult, in an app about babies.",
  },
  {
    from: 13,
    glyph: "\u{1F414}",
    label: "a chicken",
    aside: "Not strictly a baby any more.",
  },
  { from: 1, glyph: "\u{1F424}", label: "a chick" },
  { from: 0, glyph: "\u{1F423}", label: "just hatched" },
];

/** Whole years, counted the way a birthday is: it turns over on the day. */
function yearsBetween(birth: Date, now: Date): number {
  const years = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  return beforeBirthday ? years - 1 : years;
}

export function lifeStage(baby: Baby, now: Date): Stage {
  if (baby.status === "expecting" || !baby.birthDate) return EGG;

  const years = yearsBetween(parseDate(baby.birthDate), now);

  // A birthday typed a month out is still an egg, not a turkey.
  if (years < 0) return EGG;

  return LADDER.find((rung) => years >= rung.from) ?? LADDER[LADDER.length - 1]!;
}
