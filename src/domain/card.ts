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

export function cardContent(baby: Baby, now: Date): CardContent {
  const name = displayName(baby);
  const parents = describeParents(baby.parents);

  if (baby.status === "born" && baby.birthDate) {
    const birth = parseDate(baby.birthDate);
    const sun = starSign(birth);
    const chinese = chineseSign(birth);
    const weight = baby.birthWeightGrams ? describeWeight(baby.birthWeightGrams) : null;

    return {
      name,
      parents,
      headline: describeAge(baby.birthDate, now).label,
      chips: [
        `${sun.emoji} ${sun.name}`,
        `${chinese.emoji} ${chinese.animal}`,
        ...(weight ? [`\u2696\uFE0F ${weight.metric}`] : []),
      ],
      footer: `Born ${formatDate(birth)}`,
    };
  }

  if (!baby.dueDate) {
    return { name, parents, headline: "On the way", chips: [], footer: "Watch this space" };
  }

  const due = dueCountdown(baby.dueDate, now);
  const sun = starSign(due.date);

  return {
    name,
    parents,
    headline: due.label,
    // Only if they are punctual, which is why the sign is hedged here.
    chips: [`${sun.emoji} ${sun.name}?`, `\u{1F423} Week ${due.week}`],
    footer: `Due ${formatDate(due.date)}`,
  };
}
