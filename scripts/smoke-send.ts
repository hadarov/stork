/*
 * Sending one baby to somebody else who keeps the app, and receiving one.
 *
 * The file is the only part of this app that arrives from another person, so
 * the things worth checking are the ones that would be quiet if they broke: a
 * fact lost on the way through, a second copy of a baby already in the book, a
 * baby you removed walking back in, your own notes written over by somebody
 * else's copy, and a hand-edited file getting past the validation.
 *
 * Usage: npm run smoke
 */
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

import { byClass, installDom, textOf } from "./dom-stub.mjs";

import type { Baby } from "../src/domain/types.ts";
import { en } from "../src/i18n/en.ts";
import { MAX_PICTURE_BYTES } from "../src/storage/repo.ts";
import {
  likelyMatch,
  readOneBaby,
  toMerge,
  toOneBaby,
  weighOneBaby,
} from "../src/storage/oneBaby.ts";
import { isLive, mergeRecords, type BabyRepo, type MergeResult } from "../src/storage/repo.ts";
import type { AppContext } from "../src/ui/context.ts";

// Installed before the screens are imported, the same way the UI suite does it.
const teardown = installDom();
after(() => teardown());

const { renderReceiveBaby, renderSendBaby, sendBaby } = await import("../src/ui/sendBaby.ts");

/* --------------------------------------------------------------- the rig */

class MemoryRepo implements BabyRepo {
  public babies: Baby[] = [];

  async list(): Promise<Baby[]> {
    return this.babies.filter(isLive);
  }

  async listAll(): Promise<Baby[]> {
    return [...this.babies];
  }

  async save(baby: Baby): Promise<void> {
    this.babies = [...this.babies.filter((existing) => existing.id !== baby.id), baby];
  }

  async remove(id: string): Promise<void> {
    const now = new Date().toISOString();
    this.babies = this.babies.map((baby) =>
      baby.id === id ? { ...baby, deletedAt: now, updatedAt: now } : baby,
    );
  }

  /** The real fold, since half of what is under test is what it does. */
  async merge(incoming: Baby[]): Promise<MergeResult> {
    const { babies, result } = mergeRecords(this.babies, incoming);
    this.babies = babies;
    return result;
  }
}

const NOW = new Date(2026, 8, 1);
const LATER = new Date(2026, 8, 2);

const baby = (over: Partial<Baby> = {}): Baby => ({
  id: "mila",
  name: "Mila",
  parents: ["Sarah", "Tom"],
  status: "born",
  birthDate: "2024-06-15",
  sex: "girl",
  updatedAt: "2024-06-15T00:00:00.000Z",
  ...over,
});

const picture = (id: string, kilobytes = 40): { id: string; data: string; date: string } => ({
  id,
  data: `data:image/jpeg;base64,${"A".repeat(kilobytes * 1024)}`,
  date: "2024-06-16",
});

type Rig = {
  ctx: AppContext;
  repo: MemoryRepo;
  toasts: string[];
  routes: string[];
};

function makeRig(babies: Baby[] = []): Rig {
  const repo = new MemoryRepo();
  repo.babies = babies;
  const toasts: string[] = [];
  const routes: string[] = [];

  const ctx: AppContext = {
    repo,
    babies: babies.filter(isLive),
    now: NOW,
    // English, because that is the language these assertions can be read in.
    t: en,
    jewish: false,
    navigate: (path) => routes.push(path),
    back: () => routes.push("back"),
    finish: (path) => routes.push(`finish ${path}`),
    refresh: async () => {
      ctx.babies = await repo.list();
    },
    redraw: () => {},
    toast: (message) => toasts.push(message),
  };

  return { ctx, repo, toasts, routes };
}

/** The file handed to the picker, the way a browser hands one over. */
function pick(screen: any, text: string): Promise<unknown> {
  const input = screen.querySelector("input");
  return input.dispatch("change", { target: { files: [{ text: async () => text }] } });
}

const settings = (screen: any) => byClass(screen, "setting").map((node: any) => textOf(node));

/* ---------------------------------------------------------- the round trip */

describe("one baby in a file", () => {
  test("every fact about them survives the trip", () => {
    const sent = baby({
      birthTime: "21:40",
      birthWeightGrams: 3400,
      birthLengthCm: 51,
      photo: picture("face").data,
      moments: [{ id: "tooth", label: "First tooth", date: "2025-02-01" }],
    });

    const [arrived] = readOneBaby(toOneBaby(sent, NOW, "withAlbum"), []).arrivals;

    assert.deepEqual(arrived?.baby, sent);
    assert.equal(arrived?.effect, "new");
  });

  test("it goes through the same validation as anything else stored", () => {
    // A hand-edited file, with a status that contradicts the dates and a weight
    // no baby has ever had. coerceBaby is what catches both.
    const text = JSON.stringify({
      babies: [{ id: "x", name: "Nobody", status: "born", dueDate: "2026-11-01", birthWeightGrams: 34000 }],
    });
    const [arrived] = readOneBaby(text, []).arrivals;

    assert.equal(arrived?.baby.status, "expecting");
    assert.equal(arrived?.baby.birthWeightGrams, undefined);
  });

  test("what is yours about their baby stays with you", () => {
    const mine = baby({ notes: "Sarah is exhausted", giftSent: true });
    const [arrived] = readOneBaby(toOneBaby(mine, NOW, "withAlbum"), []).arrivals;

    assert.equal(arrived?.baby.notes, undefined);
    assert.equal(arrived?.baby.giftSent, undefined);
  });

  test("a baby you have removed is not sent as a removal", () => {
    const gone = baby({ deletedAt: "2026-01-01T00:00:00.000Z" });
    assert.equal(readOneBaby(toOneBaby(gone, NOW, "withAlbum"), []).arrivals.length, 1);
    assert.equal(readOneBaby(toOneBaby(gone, NOW, "withAlbum"), []).arrivals[0]?.baby.deletedAt, undefined);
  });

  test("and a removal in the file is read as nothing to do", () => {
    const text = JSON.stringify({ babies: [baby({ deletedAt: "2026-08-01T00:00:00.000Z" })] });
    const delivery = readOneBaby(text, [baby()]);

    assert.deepEqual(delivery.arrivals, []);
    assert.equal(delivery.ignored, 1);
  });
});

/* ------------------------------------------------------------------ photos */

describe("the photos", () => {
  test("their picture goes either way; the album only when asked", () => {
    const withAlbum = baby({ photo: picture("face").data, photos: [picture("a"), picture("b")] });

    const light = readOneBaby(toOneBaby(withAlbum, NOW, "pictureOnly"), []).arrivals[0]!.baby;
    assert.equal(light.photo, withAlbum.photo);
    assert.equal(light.photos, undefined);

    const full = readOneBaby(toOneBaby(withAlbum, NOW, "withAlbum"), []).arrivals[0]!.baby;
    assert.equal(full.photos?.length, 2);
  });

  test("both files are weighed, so the album can be offered with its cost on it", () => {
    const plain = weighOneBaby(baby(), NOW);
    assert.equal(plain.albumPhotos, 0);
    assert.equal(plain.album, 0);
    assert.ok(plain.withoutAlbum < 2048, "a baby without pictures is a couple of lines");

    const album = weighOneBaby(baby({ photos: [picture("a"), picture("b")] }), NOW);
    assert.equal(album.albumPhotos, 2);
    assert.ok(album.album > 80 * 1024, "two photos weigh what two photos weigh");
    assert.equal(album.albumFits, true);
  });

  test("an album too big for a share sheet says so rather than being sent", () => {
    const hoarder = baby({
      photos: Array.from({ length: 12 }, (_, index) => picture(`p${index}`, 200)),
    });
    assert.equal(weighOneBaby(hoarder, NOW).albumFits, false);
  });

  test("a picture far larger than this app makes is dropped, not stored", () => {
    // The cap is in coerceBaby, so it holds here, on a restored backup, and on
    // whatever is already in storage, rather than only on the way in from a
    // share. Dropped quietly, like every other thing coerceBaby throws away.
    const huge = `data:image/jpeg;base64,${"A".repeat(MAX_PICTURE_BYTES + 1)}`;
    const text = JSON.stringify({
      babies: [baby({ photo: huge, photos: [{ ...picture("ok") }, { ...picture("vast"), data: huge }] })],
    });

    const [arrived] = readOneBaby(text, []).arrivals;
    assert.equal(arrived?.baby.photo, undefined);
    assert.deepEqual(arrived?.baby.photos?.map((photo) => photo.id), ["ok"]);
  });
});

/* ------------------------------------------------------------- the merging */

describe("receiving a baby you already have", () => {
  const newer = () => baby({ name: "Mila Rose", updatedAt: "2026-06-01T00:00:00.000Z" });

  test("merges rather than making a second record", async () => {
    const repo = new MemoryRepo();
    repo.babies = [baby()];

    const delivery = readOneBaby(toOneBaby(newer(), NOW, "withAlbum"), await repo.listAll());
    assert.equal(delivery.arrivals[0]?.effect, "update");

    const result = await repo.merge(toMerge(delivery.arrivals, LATER));
    assert.deepEqual(result, { added: 0, updated: 1, skipped: 0 });
    assert.equal(repo.babies.length, 1);
    assert.equal(repo.babies[0]?.name, "Mila Rose");
  });

  test("an older copy of them is already accounted for", async () => {
    const repo = new MemoryRepo();
    repo.babies = [newer()];

    const delivery = readOneBaby(toOneBaby(baby(), NOW, "withAlbum"), await repo.listAll());
    assert.equal(delivery.arrivals[0]?.effect, "current");
  });

  test("an update does not cost you what the file does not carry", async () => {
    const repo = new MemoryRepo();
    repo.babies = [
      baby({
        notes: "Loves diggers",
        giftSent: true,
        photo: picture("mine").data,
        photos: [picture("mine")],
        moments: [{ id: "tooth", label: "First tooth", date: "2025-02-01" }],
      }),
    ];

    const theirs = newer();
    theirs.photos = [picture("theirs")];
    theirs.moments = [{ id: "steps", label: "First steps", date: "2025-06-01" }];

    const delivery = readOneBaby(toOneBaby(theirs, NOW, "withAlbum"), await repo.listAll());
    await repo.merge(toMerge(delivery.arrivals, LATER));

    const kept = repo.babies[0]!;
    assert.equal(kept.name, "Mila Rose", "their copy is the newer one on the facts");
    assert.equal(kept.notes, "Loves diggers");
    assert.equal(kept.giftSent, true);
    assert.equal(kept.photo, picture("mine").data, "their file carried no picture of their own");
    assert.deepEqual(kept.photos?.map((photo) => photo.id).sort(), ["mine", "theirs"]);
    assert.deepEqual(kept.moments?.map((moment) => moment.id), ["tooth", "steps"]);
  });

  test("the corrections you made to who is family are yours, not theirs", async () => {
    const repo = new MemoryRepo();
    repo.babies = [baby({ notFamily: ["otto"] })];

    const theirs = newer();
    theirs.sameFamily = ["somebody-in-their-book"];

    const delivery = readOneBaby(toOneBaby(theirs, NOW, "withAlbum"), await repo.listAll());
    await repo.merge(toMerge(delivery.arrivals, LATER));

    assert.deepEqual(repo.babies[0]?.notFamily, ["otto"]);
    assert.equal(repo.babies[0]?.sameFamily, undefined);
  });
});

/* ------------------------------------------------------------- tombstones */

describe("a baby you removed", () => {
  const removed = () =>
    baby({ deletedAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" });

  test("is recognised as removed rather than as new", async () => {
    const repo = new MemoryRepo();
    repo.babies = [removed()];

    const delivery = readOneBaby(toOneBaby(baby(), NOW, "withAlbum"), await repo.listAll());
    assert.equal(delivery.arrivals[0]?.effect, "restore");
  });

  test("stays removed while nobody has agreed to bring them back", async () => {
    const repo = new MemoryRepo();
    repo.babies = [removed()];

    // Nothing accepted, which is what the screen defaults a restore to.
    await repo.merge(toMerge([], LATER));
    assert.equal((await repo.list()).length, 0);
  });

  test("and a newer file does not walk them back in on its own", async () => {
    const repo = new MemoryRepo();
    repo.babies = [removed()];

    // The other person edited them yesterday, so last-write-wins alone would
    // resurrect them. The effect says what it is instead of doing it.
    const theirs = baby({ updatedAt: "2026-08-20T00:00:00.000Z" });
    const delivery = readOneBaby(toOneBaby(theirs, NOW, "withAlbum"), await repo.listAll());
    assert.equal(delivery.arrivals[0]?.effect, "restore");
  });

  test("but agreeing to it puts them back, even against a newer removal", async () => {
    const repo = new MemoryRepo();
    repo.babies = [removed()];

    const delivery = readOneBaby(toOneBaby(baby(), NOW, "withAlbum"), await repo.listAll());
    await repo.merge(toMerge(delivery.arrivals, LATER));

    const live = await repo.list();
    assert.equal(live.length, 1);
    assert.equal(live[0]?.updatedAt, LATER.toISOString(), "brought back now, not last month");
  });
});

/* ------------------------------------------------------------- junk files */

describe("a file that is not a baby", () => {
  const nothing = (text: string) => readOneBaby(text, []).arrivals;

  test("is refused rather than half-read", () => {
    assert.deepEqual(nothing("not json at all"), []);
    assert.deepEqual(nothing(""), []);
    assert.deepEqual(nothing("\u0089PNG\r\n\u001a\n"), []);
    assert.deepEqual(nothing(JSON.stringify({ app: "something-else", rows: [1, 2, 3] })), []);
    assert.deepEqual(nothing(JSON.stringify({ babies: [{ id: "shell" }] })), []);
    assert.deepEqual(nothing(JSON.stringify([null, 4, "Mila"])), []);
  });

  test("and a whole backup dropped in here is read as the babies in it", () => {
    const text = JSON.stringify({ app: "stork", babies: [baby(), baby({ id: "otto", name: "Otto" })] });
    assert.equal(readOneBaby(text, []).arrivals.length, 2);
  });
});

/* --------------------------------------------------------------- identity */

describe("the same child under two ids", () => {
  const theirs = (over: Partial<Baby> = {}) => baby({ id: "their-own-id", ...over });

  test("is recognised by the name and the date together", () => {
    assert.equal(likelyMatch(theirs(), [baby()])?.id, "mila");
  });

  test("and not by either on its own", () => {
    assert.equal(likelyMatch(theirs({ birthDate: "2023-01-01" }), [baby()]), undefined);
    assert.equal(likelyMatch(theirs({ name: "Ada" }), [baby()]), undefined);
  });

  test("twins are two children, not one child twice", () => {
    const otto = baby({ id: "otto", name: "Otto" });
    assert.equal(likelyMatch(theirs({ name: "Mila" }), [otto]), undefined);
  });

  test("a bump nobody has named yet is recognised by its parents", () => {
    const bump = baby({ name: undefined, status: "expecting", birthDate: undefined, dueDate: "2026-11-01" });
    const mine = { ...bump, id: "mine" };
    assert.equal(likelyMatch({ ...bump, id: "theirs" }, [mine])?.id, "mine");
  });

  test("a baby you removed is not offered as a match", () => {
    assert.equal(likelyMatch(theirs(), [baby({ deletedAt: "2026-01-01T00:00:00.000Z" })]), undefined);
  });

  test("the merge cannot join them, so receiving says so before it adds a second", () => {
    const delivery = readOneBaby(toOneBaby(theirs(), NOW, "withAlbum"), [baby()]);
    assert.equal(delivery.arrivals[0]?.effect, "new");
    assert.equal(delivery.arrivals[0]?.looksLike?.id, "mila");
  });

  test("and says nothing where the ids have already settled it", () => {
    const delivery = readOneBaby(toOneBaby(baby({ name: "Mila Rose", updatedAt: "2026-06-01T00:00:00.000Z" }), NOW, "withAlbum"), [baby()]);
    assert.equal(delivery.arrivals[0]?.looksLike, undefined);
  });
});

/* -------------------------------------------------------------- the screens */

describe("the send screen", () => {
  test("it says what travels and what does not", () => {
    const rig = makeRig([baby()]);
    const text = textOf(renderSendBaby(rig.ctx, baby()));

    assert.match(text, /One baby in a file/);
    assert.match(text, /Your notes and whether you sent a gift stay here/);
    assert.match(text, /joins the copy they already have/);
  });

  test("a baby with no album is not asked about one", () => {
    const rig = makeRig([baby()]);
    assert.deepEqual(settings(renderSendBaby(rig.ctx, baby())), []);
  });

  test("an album is priced, and left out until it is asked for", async () => {
    const rig = makeRig();
    const mila = baby({ photos: [picture("a"), picture("b")] });
    const screen = renderSendBaby(rig.ctx, mila);

    const row = byClass(screen, "setting")[0]!;
    assert.match(textOf(row), /2 photos/);
    assert.match(textOf(row), /kB on top/);

    const toggle = row.querySelector("button");
    assert.equal(textOf(toggle), "Left out");
    assert.equal(toggle.getAttribute("aria-pressed"), "false");

    await toggle.click();
    assert.equal(textOf(toggle), "Included");
    assert.equal(toggle.getAttribute("aria-pressed"), "true");
  });

  test("an album past what a share sheet carries is not offered at all", () => {
    const rig = makeRig();
    const hoarder = baby({ photos: Array.from({ length: 12 }, (_, i) => picture(`p${i}`, 200)) });
    const screen = renderSendBaby(rig.ctx, hoarder);

    assert.deepEqual(settings(screen), [], "no toggle to tick");
    assert.match(textOf(screen), /more than a share sheet will carry/);
  });

  test("with no share sheet it saves the file, named after the baby", async () => {
    // Node has a navigator of its own and it has no canShare, which is the
    // same position a desktop browser is in.
    const said = await sendBaby(baby(), NOW, en, "pictureOnly");
    assert.equal(said, "Saved as stork-mila.json");
  });

  test("a name in another script still makes a filename", async () => {
    const said = await sendBaby(baby({ name: "מילה" }), NOW, en, "pictureOnly");
    assert.match(said, /stork-\u05de\u05d9\u05dc\u05d4\.json$/);
  });

  test("sending lands back on the baby rather than a step further in", async () => {
    const rig = makeRig([baby()]);
    const screen = renderSendBaby(rig.ctx, baby());

    await byClass(screen, "primary")[0]!.click();
    assert.deepEqual(rig.routes, ["back"]);
    assert.match(rig.toasts[0] ?? "", /Saved as/);
  });
});

describe("the receive screen", () => {
  const theirs = (over: Partial<Baby> = {}) =>
    baby({ id: "otto", name: "Otto", birthDate: "2021-02-03", ...over });

  test("it asks for a file before it says anything about the book", () => {
    const rig = makeRig([baby()]);
    assert.match(textOf(renderReceiveBaby(rig.ctx)), /Open a file/);
  });

  test("it gives the account of what would change, and changes nothing yet", async () => {
    const rig = makeRig([baby()]);
    const screen = renderReceiveBaby(rig.ctx);

    await pick(screen, toOneBaby(theirs(), NOW, "withAlbum"));

    const text = textOf(screen);
    assert.match(text, /What this would do/);
    assert.match(text, /Otto/);
    assert.match(text, /New to your book/);
    assert.equal(rig.repo.babies.length, 1, "nothing written before it is agreed to");
    assert.deepEqual(rig.routes, []);
  });

  test("agreeing to it merges, and lands on the baby that arrived", async () => {
    const rig = makeRig([baby()]);
    const screen = renderReceiveBaby(rig.ctx);

    await pick(screen, toOneBaby(theirs(), NOW, "withAlbum"));
    await byClass(screen, "primary")[0]!.click();

    assert.equal(rig.repo.babies.length, 2);
    assert.deepEqual(rig.toasts, ["1 added, 0 updated"]);
    assert.deepEqual(rig.routes, ["finish #/baby/otto"]);
  });

  test("a baby already in the book is called an update rather than an addition", async () => {
    const rig = makeRig([baby()]);
    const screen = renderReceiveBaby(rig.ctx);

    await pick(screen, toOneBaby(baby({ name: "Mila Rose", updatedAt: "2026-06-01T00:00:00.000Z" }), NOW, "withAlbum"));
    assert.match(textOf(screen), /Newer than the copy you have/);

    await byClass(screen, "primary")[0]!.click();
    assert.equal(rig.repo.babies.length, 1);
    assert.deepEqual(rig.toasts, ["0 added, 1 updated"]);
  });

  test("one already current is stated and offers nothing to agree to", async () => {
    const rig = makeRig([baby({ name: "Mila Rose", updatedAt: "2026-06-01T00:00:00.000Z" })]);
    const screen = renderReceiveBaby(rig.ctx);

    await pick(screen, toOneBaby(baby(), NOW, "withAlbum"));
    const row = byClass(screen, "setting")[0]!;

    assert.match(textOf(row), /You have this one already/);
    assert.equal(row.querySelectorAll("button").length, 0);

    await byClass(screen, "primary")[0]!.click();
    assert.deepEqual(rig.toasts, ["Nothing chosen to take"]);
  });

  test("a baby you removed is not taken back without being asked", async () => {
    const rig = makeRig([baby({ deletedAt: "2026-08-01T00:00:00.000Z" })]);
    const screen = renderReceiveBaby(rig.ctx);

    await pick(screen, toOneBaby(baby(), NOW, "withAlbum"));
    const row = byClass(screen, "setting")[0]!;

    assert.match(textOf(row), /You removed this baby/);
    assert.equal(textOf(row.querySelector("button")), "Skipping");

    await byClass(screen, "primary")[0]!.click();
    assert.deepEqual(rig.toasts, ["Nothing chosen to take"]);
    assert.equal((await rig.repo.list()).length, 0);

    // And taking it deliberately is a different matter.
    await row.querySelector("button").click();
    await byClass(screen, "primary")[0]!.click();
    assert.equal((await rig.repo.list()).length, 1);
  });

  test("the record you already have can be skipped, and then nothing moves", async () => {
    const rig = makeRig([baby()]);
    const screen = renderReceiveBaby(rig.ctx);

    await pick(screen, toOneBaby(baby({ name: "Mila Rose", updatedAt: "2026-06-01T00:00:00.000Z" }), NOW, "withAlbum"));
    await byClass(screen, "setting")[0]!.querySelector("button").click();
    await byClass(screen, "primary")[0]!.click();

    assert.equal(rig.repo.babies[0]?.name, "Mila");
    assert.deepEqual(rig.toasts, ["Nothing chosen to take"]);
  });

  test("a likely duplicate is pointed out before a second copy is added", async () => {
    const rig = makeRig([baby()]);
    const screen = renderReceiveBaby(rig.ctx);

    await pick(screen, toOneBaby(baby({ id: "their-own-id" }), NOW, "withAlbum"));
    assert.match(textOf(screen), /already has a record that looks like Mila/);
  });

  test("a file with nothing readable in it says so and leaves the screen alone", async () => {
    const rig = makeRig([baby()]);
    const screen = renderReceiveBaby(rig.ctx);

    await pick(screen, "not json at all");
    assert.deepEqual(rig.toasts, ["No babies in that file"]);
    assert.match(textOf(screen), /Open a file/);
  });

  test("a file that is only a removal says what a file like that cannot do", async () => {
    const rig = makeRig([baby()]);
    const screen = renderReceiveBaby(rig.ctx);

    await pick(screen, JSON.stringify({ babies: [baby({ deletedAt: "2026-08-01T00:00:00.000Z" })] }));
    assert.match(rig.toasts[0] ?? "", /cannot take one away/);
    assert.equal(rig.repo.babies.length, 1);
  });

  test("a picture too absurd to have come from here does not reach the book", async () => {
    const rig = makeRig();
    const screen = renderReceiveBaby(rig.ctx);
    const huge = `data:image/jpeg;base64,${"A".repeat(MAX_PICTURE_BYTES + 1)}`;

    await pick(screen, JSON.stringify({ babies: [theirs({ photo: huge })] }));
    await byClass(screen, "primary")[0]!.click();
    assert.equal(rig.repo.babies[0]?.photo, undefined);
  });
});
