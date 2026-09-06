import type { Catalog } from "../i18n/en.ts";
import { chineseSign, starSign } from "./almanac.ts";
import {
  describeAge,
  describeParents,
  describeWeight,
  displayName,
  dueCountdown,
  formatDate,
  parseDate,
} from "./derive.ts";
import type { Baby } from "./types.ts";

/**
 * What goes on a card, worked out apart from the drawing of it. The canvas
 * work cannot be checked without a browser; this can, and it is where all the
 * decisions actually live.
 */
export type CardContent = {
  name: string;
  parents: string;
  /** The one line worth reading from across a room. */
  headline: string;
  /** Short badges, at most three, in the order they should be laid out. */
  chips: string[];
  footer: string;
};

export function cardContent(baby: Baby, now: Date, t: Catalog): CardContent {
  const words = t.share.card;
  const name = displayName(baby, t);
  const parents = describeParents(baby.parents, t);

  if (baby.status === "born" && baby.birthDate) {
    const birth = parseDate(baby.birthDate);
    const sun = starSign(birth, t);
    const chinese = chineseSign(birth, t);
    const weight = baby.birthWeightGrams ? describeWeight(baby.birthWeightGrams, t) : null;

    return {
      name,
      parents,
      // Sex goes in because Hebrew says an age as "בן שנתיים" or "בת שנתיים",
      // and the card is the one place there is no room to hedge.
      headline: describeAge(baby.birthDate, now, t, baby.sex).label,
      chips: [
        words.chip(sun.emoji, sun.name),
        words.chip(chinese.emoji, chinese.animal),
        ...(weight ? [words.chip("\u2696\uFE0F", weight.metric)] : []),
      ],
      footer: words.bornOn(formatDate(birth, t), baby.sex),
    };
  }

  if (!baby.dueDate) {
    return { name, parents, headline: words.onTheWay, chips: [], footer: words.watchThisSpace };
  }

  const due = dueCountdown(baby.dueDate, now, t);
  const sun = starSign(due.date, t);

  return {
    name,
    parents,
    headline: due.label,
    // Only if they are punctual, which is why the sign is hedged here.
    chips: [
      words.chip(sun.emoji, words.perhaps(sun.name)),
      words.chip("\u{1F423}", t.due.week(due.week)),
    ],
    footer: words.dueOn(formatDate(due.date, t)),
  };
}
