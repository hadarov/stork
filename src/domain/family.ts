import type { Catalog } from "../i18n/en.ts";
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

export type Family = {
  /** Every parent named across the household, in the order you first typed them. */
  parents: string[];
  /** Oldest first, anyone still on the way last. */
  babies: Baby[];
};

function parentNames(babies: Baby[]): string[] {
  const seen = new Map<string, string>();
  for (const baby of babies) {
    for (const name of baby.parents) {
      const id = key(name);
      if (id && !seen.has(id)) seen.set(id, name.trim());
    }
  }
  return [...seen.values()];
}

/**
 * Whole households, found by following shared parent names from baby to baby.
 * Transitive on purpose: a baby naming two parents is what joins those two
 * people's lists together, which is usually exactly right and occasionally
 * merges a family it should not have. The fix for that is a fuller name.
 *
 * Babies with nobody named are left out, since a household with no name to it
 * is not something you can be about to go and see.
 */
export function families(all: Baby[]): Family[] {
  const groups: { keys: Set<string>; babies: Baby[] }[] = [];

  for (const baby of all) {
    const keys = baby.parents.map(key).filter(Boolean);
    if (keys.length === 0) continue;

    const touching = groups.filter((group) => keys.some((id) => group.keys.has(id)));
    const target = touching[0] ?? { keys: new Set<string>(), babies: [] };
    if (touching.length === 0) groups.push(target);

    // This baby is the evidence that those separate groups are one household.
    for (const other of touching.slice(1)) {
      for (const id of other.keys) target.keys.add(id);
      target.babies.push(...other.babies);
      groups.splice(groups.indexOf(other), 1);
    }

    for (const id of keys) target.keys.add(id);
    target.babies.push(baby);
  }

  return groups.map((group) => ({
    parents: parentNames(group.babies),
    babies: [...group.babies].sort((a, b) => arrival(a).localeCompare(arrival(b))),
  }));
}

/** The household this baby belongs to, themselves included. */
export function familyOf(baby: Baby, all: Baby[]): Family {
  const found = families(all).find((family) =>
    family.babies.some((candidate) => candidate.id === baby.id),
  );
  return found ?? { parents: baby.parents, babies: [baby] };
}

/**
 * How the sibling stands to this baby: "big sister", "little brother". Both
 * halves of it are gendered in Hebrew, so the wording is left to the
 * catalogue rather than assembled from an order and a noun here.
 */
export function relation(baby: Baby, sibling: Baby, t: Catalog): string {
  const older = arrival(sibling) < arrival(baby);
  const { family } = t.book;
  if (sibling.sex === "girl") return older ? family.bigSister : family.littleSister;
  if (sibling.sex === "boy") return older ? family.bigBrother : family.littleBrother;
  return older ? family.olderSibling : family.youngerSibling;
}
