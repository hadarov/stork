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

function names(baby: Baby, other: Baby): boolean {
  const parents = new Set(baby.parents.map(key).filter(Boolean));
  return other.parents.some((parent) => parents.has(key(parent)));
}

/** Either of them having said it is enough; they are talking about the pair. */
function says(one: Baby, other: Baby, field: "sameFamily" | "notFamily"): boolean {
  return Boolean(one[field]?.includes(other.id) || other[field]?.includes(one.id));
}

export function areSiblings(one: Baby, other: Baby): boolean {
  if (one.id === other.id) return false;
  // Both corrections outrank the names, and being told they are not related
  // outranks being told they are: it is the answer to a wrong guess, where a
  // join is only ever the answer to a missing one.
  if (says(one, other, "notFamily")) return false;
  if (says(one, other, "sameFamily")) return true;
  return names(one, other);
}

/** Whether the app worked this out for itself or was told. */
export function whySiblings(one: Baby, other: Baby): "names" | "told" | null {
  if (!areSiblings(one, other)) return null;
  return names(one, other) ? "names" : "told";
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
 * Whole households, as the groups that `areSiblings` joins up: follow it from
 * baby to baby and whoever you can reach is one family. Transitive on purpose,
 * since a baby naming two parents is the evidence that those two people's
 * lists are one list.
 *
 * Walking the relation rather than pooling the names is what lets a correction
 * count. It does leave one case the grouping cannot honour: separate two
 * babies who are each still joined to a third, and all three remain one
 * household, because there is no way to cut a ring in one place. Their own
 * pages are right about each other, which is where anybody would look.
 *
 * Babies with nobody named and nobody joined to them are left out, since a
 * household with no name to it is not one you can be about to go and see.
 */
export function families(all: Baby[]): Family[] {
  const joined = new Set<string>();
  for (const baby of all) {
    for (const id of baby.sameFamily ?? []) {
      joined.add(baby.id);
      joined.add(id);
    }
  }

  const known = all.filter(
    (baby) => baby.parents.some((name) => key(name)) || joined.has(baby.id),
  );

  const seen = new Set<string>();
  const groups: Baby[][] = [];

  for (const start of known) {
    if (seen.has(start.id)) continue;
    seen.add(start.id);

    const group: Baby[] = [];
    const queue = [start];
    while (queue.length > 0) {
      const baby = queue.pop()!;
      group.push(baby);
      for (const other of known) {
        if (seen.has(other.id) || !areSiblings(baby, other)) continue;
        seen.add(other.id);
        queue.push(other);
      }
    }
    groups.push(group);
  }

  return groups.map((babies) => ({
    parents: parentNames(babies),
    babies: [...babies].sort((a, b) => arrival(a).localeCompare(arrival(b))),
  }));
}

/** The household this baby belongs to, themselves included. */
export function familyOf(baby: Baby, all: Baby[]): Family {
  const found = families(all).find((family) =>
    family.babies.some((candidate) => candidate.id === baby.id),
  );
  return found ?? { parents: baby.parents, babies: [baby] };
}

function without(list: string[] | undefined, id: string): string[] {
  return (list ?? []).filter((each) => each !== id);
}

function with_(list: string[] | undefined, id: string): string[] {
  return [...without(list, id), id];
}

/**
 * Both halves of a correction, because it is a fact about the pair and either
 * of them may be the one a merge sees first. A field emptied by this is
 * dropped rather than left as `[]`, so a baby nobody has corrected looks the
 * same on disk as it did before any of this existed.
 */
function record(
  baby: Baby,
  otherId: string,
  join: string[],
  apart: string[],
  now: Date,
): Baby {
  const next: Baby = { ...baby, updatedAt: now.toISOString() };

  if (join.length > 0) next.sameFamily = join;
  else delete next.sameFamily;
  if (apart.length > 0) next.notFamily = apart;
  else delete next.notFamily;

  return next;
}

/** Say these two are siblings after all. Returns both, for saving. */
export function join(one: Baby, other: Baby, now: Date): [Baby, Baby] {
  return [
    record(one, other.id, with_(one.sameFamily, other.id), without(one.notFamily, other.id), now),
    record(other, one.id, with_(other.sameFamily, one.id), without(other.notFamily, one.id), now),
  ];
}

/**
 * Say these two are not related. Recorded even when only the names had
 * suggested it, because the names will suggest it again tomorrow.
 */
export function separate(one: Baby, other: Baby, now: Date): [Baby, Baby] {
  return [
    record(one, other.id, without(one.sameFamily, other.id), with_(one.notFamily, other.id), now),
    record(other, one.id, without(other.sameFamily, one.id), with_(other.notFamily, one.id), now),
  ];
}

/**
 * Two of the same parents' babies on the same date. Asked before the older and
 * younger question, which otherwise has no answer for them and quietly gives
 * the wrong one: neither date sorts before the other, so each twin ends up
 * called the younger of the two.
 *
 * A shared due date counts, since a due date is the only date a pair of bumps
 * has. It is a guess, but it is the parents' own guess about both of them at
 * once, and two bumps in one household sharing it are twins.
 */
function bornTogether(one: Baby, other: Baby): boolean {
  if (one.status === "born" && other.status === "born") {
    return Boolean(one.birthDate) && one.birthDate === other.birthDate;
  }
  if (one.status === "expecting" && other.status === "expecting") {
    return Boolean(one.dueDate) && one.dueDate === other.dueDate;
  }
  return false;
}

/**
 * How the sibling stands to this baby: "big sister", "little brother". Both
 * halves of it are gendered in Hebrew, so the wording is left to the
 * catalogue rather than assembled from an order and a noun here.
 */
export function relation(baby: Baby, sibling: Baby, t: Catalog): string {
  const { family } = t.book;

  if (bornTogether(baby, sibling)) {
    if (sibling.sex === "girl") return family.twinSister;
    if (sibling.sex === "boy") return family.twinBrother;
    return family.twin;
  }

  const older = arrival(sibling) < arrival(baby);
  if (sibling.sex === "girl") return older ? family.bigSister : family.littleSister;
  if (sibling.sex === "boy") return older ? family.bigBrother : family.littleBrother;
  return older ? family.olderSibling : family.youngerSibling;
}
