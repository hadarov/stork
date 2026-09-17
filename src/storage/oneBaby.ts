import type { Baby } from "../domain/types.ts";
import { migrate } from "./migrate.ts";
import { MAX_MOMENTS, MAX_PHOTOS, SCHEMA_VERSION, isLive, mergeRecords } from "./repo.ts";

/*
 * One baby in a file, for somebody else who uses the app: two uncles keeping
 * the same record of the same child.
 *
 * The whole-book backup is a different thing - your own data on its way to your
 * own next phone - and three rules follow from that.
 *
 * A file is an offer, never an instruction. Tombstones are left out on the way
 * out and ignored on the way in, so a file can add a baby or bring one up to
 * date and can never take one away.
 *
 * What is yours about somebody else's baby stays with you. Your notes and
 * whether you sent a gift are your side of the friendship rather than facts
 * about the child, and a record-level merge would both hand them over and write
 * over theirs.
 *
 * Because the file deliberately leaves things out, receiving cannot be a plain
 * overwrite of a record already in the book: that would take the notes and the
 * album with it. `foldOnto` is the one place in the app that merges field by
 * field rather than record by record, and it exists only for that reason.
 */

/** Album, or their picture on its own. */
export type PhotoChoice = "withAlbum" | "pictureOnly";

/**
 * What a share sheet or a messaging app can be trusted with. Every picture in
 * the book is a data URL, so a full album is a file of megabytes rather than of
 * kilobytes, and the failure at that size is silence rather than an error.
 */
export const MAX_SHARE_BYTES = 2 * 1024 * 1024;

function bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/* ----------------------------------------------------------------- sending */

/** The baby as they travel: no tombstone, and nothing that is yours. */
function sendable(baby: Baby, photos: PhotoChoice): Baby {
  const travelling: Baby = { ...baby };
  delete travelling.deletedAt;
  delete travelling.notes;
  delete travelling.giftSent;
  if (photos === "pictureOnly") delete travelling.photos;
  return travelling;
}

/**
 * The same envelope a backup has, so the restore in Settings reads one of these
 * too, plus a word saying which of the two it is for anyone who opens the file.
 */
export function toOneBaby(baby: Baby, now: Date, photos: PhotoChoice): string {
  return JSON.stringify(
    {
      app: "stork",
      kind: "baby",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: now.toISOString(),
      babies: [sendable(baby, photos)],
    },
    null,
    2,
  );
}

export type ShareSize = {
  /** Photos in the album, which is the part there is a choice about. */
  albumPhotos: number;
  /** What the album itself adds. */
  album: number;
  withAlbum: number;
  withoutAlbum: number;
  /** False when the album would take the file past what a share will carry. */
  albumFits: boolean;
};

/** Both files, weighed, so the choice can be offered with the cost on it. */
export function weighOneBaby(baby: Baby, now: Date): ShareSize {
  const withAlbum = bytes(toOneBaby(baby, now, "withAlbum"));
  const withoutAlbum = bytes(toOneBaby(baby, now, "pictureOnly"));

  return {
    albumPhotos: baby.photos?.length ?? 0,
    album: withAlbum - withoutAlbum,
    withAlbum,
    withoutAlbum,
    albumFits: withAlbum <= MAX_SHARE_BYTES,
  };
}

/* --------------------------------------------------------------- receiving */

export type Effect =
  /** Not in the book at all. */
  | "new"
  /** Already there under this id, and the file has the newer of the two. */
  | "update"
  /** Already there, and what you have is no older. */
  | "current"
  /** You removed this baby. Taking it puts them back. */
  | "restore";

export type Arrival = {
  /** The record as it arrived, through the same validation storage goes through. */
  baby: Baby;
  effect: Effect;
  /** The record it would land on, where the book already has that id. */
  mine?: Baby;
  /** A baby under a different id who looks like the same child. */
  looksLike?: Baby;
};

export type Delivery = {
  arrivals: Arrival[];
  /** Removals in the file, which a share has no business carrying out. */
  ignored: number;
};

function key(text: string | undefined): string {
  return (text ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Two people who each added the same baby have two different ids, so nothing in
 * the records themselves says they are the same child. This is the guess, and it
 * is a deliberately narrow one: the date has to agree exactly, and then either
 * the names match or - for a bump nobody has named yet - a parent does. Two
 * names that disagree settle it the other way, which is what keeps twins apart:
 * same parents, same birthday, different children.
 */
export function likelyMatch(incoming: Baby, mine: Baby[]): Baby | undefined {
  return mine.find((candidate) => {
    if (candidate.id === incoming.id || !isLive(candidate)) return false;

    const sameDate =
      (incoming.birthDate !== undefined && incoming.birthDate === candidate.birthDate) ||
      (incoming.dueDate !== undefined && incoming.dueDate === candidate.dueDate);
    if (!sameDate) return false;

    if (incoming.name && candidate.name) return key(incoming.name) === key(candidate.name);
    return candidate.parents.some((parent) =>
      incoming.parents.some((theirs) => key(parent) === key(theirs)),
    );
  });
}

function effectOf(incoming: Baby, current: Baby | undefined): Effect {
  if (!current) return "new";
  // A removal is a decision somebody made, so it is never overruled by
  // arithmetic on a timestamp: whoever made it is asked before it is undone.
  if (!isLive(current)) return "restore";
  // Otherwise the rule the repo itself will apply, asked of the repo.
  return mergeRecords([current], [incoming]).result.updated === 1 ? "update" : "current";
}

/**
 * Reads a file and says what taking it would do, without doing any of it.
 * `mine` wants everything including tombstones, so a baby you removed is
 * recognised as removed rather than as new.
 */
export function readOneBaby(text: string, mine: Baby[]): Delivery {
  const byId = new Map(mine.map((baby) => [baby.id, baby]));
  const arrivals: Arrival[] = [];
  let ignored = 0;

  for (const candidate of migrate(text).babies) {
    if (!isLive(candidate)) {
      ignored += 1;
      continue;
    }

    // Pictures too large to have come from this app are already gone: they are
    // dropped by `coerceBaby` above, on the same path as a bad date, so storage
    // and a restored backup are covered by the one rule rather than only this.
    const baby = candidate;
    const current = byId.get(baby.id);
    const effect = effectOf(baby, current);

    arrivals.push({
      baby,
      effect,
      mine: current,
      // Only worth raising where the ids have not already settled it.
      looksLike: effect === "new" ? likelyMatch(baby, mine) : undefined,
    });
  }

  return { arrivals, ignored };
}

/** Yours first: a caption or a date you have corrected is not written back over. */
function joinById<T extends { id: string }>(mine: T[], theirs: T[]): T[] {
  const byId = new Map(mine.map((item) => [item.id, item]));
  for (const item of theirs) if (!byId.has(item.id)) byId.set(item.id, item);
  return [...byId.values()];
}

/**
 * The arriving copy wins on every fact about the baby, since it is the one
 * somebody has just looked at. What it does not carry is kept: the notes and
 * the gift are yours, the lists are joined because two people adding a photo
 * each have both added one, and the corrections to who is family are about the
 * records in this book rather than in theirs.
 */
function foldOnto(mine: Baby, incoming: Baby): Baby {
  const folded: Baby = { ...incoming };

  if (mine.notes) folded.notes = mine.notes;
  if (mine.giftSent) folded.giftSent = true;
  if (!folded.photo && mine.photo) folded.photo = mine.photo;

  const album = joinById(mine.photos ?? [], incoming.photos ?? []).slice(0, MAX_PHOTOS);
  if (album.length > 0) folded.photos = album;

  const moments = joinById(mine.moments ?? [], incoming.moments ?? [])
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, MAX_MOMENTS);
  if (moments.length > 0) folded.moments = moments;

  if (mine.sameFamily) folded.sameFamily = mine.sameFamily;
  else delete folded.sameFamily;
  if (mine.notFamily) folded.notFamily = mine.notFamily;
  else delete folded.notFamily;

  return folded;
}

/** What to hand `repo.merge`, once the reader has agreed to these and no others. */
export function toMerge(accepted: Arrival[], now: Date): Baby[] {
  return accepted.map((arrival) => {
    const folded = arrival.mine ? foldOnto(arrival.mine, arrival.baby) : arrival.baby;
    // Your removal is newer than the file, so last-write-wins would throw the
    // record straight back out. Putting them back is a thing done now, not a
    // thing the file can claim to have done last week.
    return arrival.effect === "restore"
      ? { ...folded, updatedAt: now.toISOString() }
      : folded;
  });
}
