import type { Catalog } from "../i18n/en.ts";
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

const egg = (t: Catalog): Stage => ({ glyph: "\u{1F95A}", label: t.stage.egg });

const LADDER: { from: number; glyph: string; read: (t: Catalog) => Omit<Stage, "glyph"> }[] = [
  {
    from: 40,
    glyph: "\u{1F983}",
    read: (t) => ({ label: t.stage.turkey, aside: t.stage.asideTurkey }),
  },
  {
    from: 18,
    glyph: "\u{1F413}",
    read: (t) => ({ label: t.stage.rooster, aside: t.stage.asideRooster }),
  },
  {
    from: 13,
    glyph: "\u{1F414}",
    read: (t) => ({ label: t.stage.chicken, aside: t.stage.asideChicken }),
  },
  { from: 1, glyph: "\u{1F424}", read: (t) => ({ label: t.stage.chick }) },
  { from: 0, glyph: "\u{1F423}", read: (t) => ({ label: t.stage.hatched }) },
];

/** Whole years, counted the way a birthday is: it turns over on the day. */
function yearsBetween(birth: Date, now: Date): number {
  const years = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  return beforeBirthday ? years - 1 : years;
}

export function lifeStage(baby: Baby, now: Date, t: Catalog): Stage {
  if (baby.status === "expecting" || !baby.birthDate) return egg(t);

  const years = yearsBetween(parseDate(baby.birthDate), now);

  // A birthday typed a month out is still an egg, not a turkey.
  if (years < 0) return egg(t);

  const rung = LADDER.find((step) => years >= step.from) ?? LADDER[LADDER.length - 1]!;
  return { glyph: rung.glyph, ...rung.read(t) };
}
