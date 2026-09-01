import type { Baby } from "./types.ts";

/**
 * Siblings are worked out from the parents rather than declared anywhere, so
 * adding a second baby for the same friends links the two without asking you
 * to do anything. The cost is that two unrelated Sarahs would be read as one
 * family, which is why names are compared whole rather than by first name.
 */
function key(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * A sort key that puts the oldest first and anyone still on the way after
 * everyone who has arrived, with the undated at the very end.
 */
function arrival(baby: Baby): string {
  if (baby.status === "born" && baby.birthDate) return `0${baby.birthDate}`;
  if (baby.dueDate) return `1${baby.dueDate}`;
  return "2";
}

export function areSiblings(one: Baby, other: Baby): boolean {
  if (one.id === other.id) return false;
  const parents = new Set(one.parents.map(key).filter(Boolean));
  return other.parents.some((parent) => parents.has(key(parent)));
}

/** Everyone else in this baby's family, oldest first. */
export function siblingsOf(baby: Baby, all: Baby[]): Baby[] {
  return all
    .filter((candidate) => areSiblings(baby, candidate))
    .sort((a, b) => arrival(a).localeCompare(arrival(b)));
}

/** How the sibling stands to this baby: "big sister", "little brother". */
export function relation(baby: Baby, sibling: Baby): string {
  const older = arrival(sibling) < arrival(baby);
  if (sibling.sex === "girl") return older ? "big sister" : "little sister";
  if (sibling.sex === "boy") return older ? "big brother" : "little brother";
  return older ? "older sibling" : "younger sibling";
}
