/*
 * Renders every screen against the stub DOM in dom-stub.mjs.
 *
 * There is no browser to click through here, so these check the thing a browser
 * would show: that each screen builds without throwing, and that the numbers
 * and labels a person reads are the ones the domain functions worked out.
 *
 * Usage: npm run smoke
 */
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";

import { byClass, installDom, textOf } from "./dom-stub.mjs";

import { toISODate } from "../src/domain/derive.ts";
import type { Baby } from "../src/domain/types.ts";
import type { BabyRepo, MergeResult } from "../src/storage/repo.ts";
import type { AppContext } from "../src/ui/context.ts";

// Installed before the screens are imported, and before any hook could run, so
// that anything they touch at module scope finds a DOM waiting for it.
const teardown = installDom();
after(() => teardown());

const { renderHome } = await import("../src/ui/home.ts");
const { renderDetail } = await import("../src/ui/detail.ts");
const { renderEdit } = await import("../src/ui/edit.ts");
const { renderSettings } = await import("../src/ui/settings.ts");
const { albumOf, renderPhotoViewer } = await import("../src/ui/album.ts");
const { renderArrival, renderRemoveConfirm } = await import("../src/ui/prompts.ts");
const { startApp } = await import("../src/ui/app.ts");

/* ------------------------------------------------------------- test rig */

class MemoryRepo implements BabyRepo {
  public babies: Baby[] = [];

  async list(): Promise<Baby[]> {
    return this.babies.filter((baby) => baby.deletedAt == null);
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

  async merge(incoming: Baby[]): Promise<MergeResult> {
    for (const baby of incoming) await this.save(baby);
    return { added: incoming.length, updated: 0, skipped: 0 };
  }
}

const NOW = new Date(2026, 8, 1);

type Rig = {
  ctx: AppContext;
  repo: MemoryRepo;
  toasts: string[];
  routes: string[];
  /** Counted rather than acted on: a rig has no screen to draw again. */
  redraws: number;
};

let rig: Rig;

function makeRig(babies: Baby[] = []): Rig {
  const repo = new MemoryRepo();
  repo.babies = babies;
  const toasts: string[] = [];
  const routes: string[] = [];

  const rig: Rig = {
    ctx: null as unknown as AppContext,
    repo,
    toasts,
    routes,
    redraws: 0,
  };

  const ctx: AppContext = {
    repo,
    babies: babies.filter((baby) => baby.deletedAt == null),
    now: NOW,
    navigate: (path) => routes.push(path),
    back: () => routes.push("back"),
    refresh: async () => {
      ctx.babies = await repo.list();
    },
    redraw: () => {
      rig.redraws += 1;
    },
    toast: (message) => toasts.push(message),
  };

  rig.ctx = ctx;
  return rig;
}

const baby = (over: Partial<Baby> = {}): Baby => ({
  id: "mila",
  name: "Mila",
  parents: ["Sarah", "Tom"],
  status: "born",
  birthDate: "2024-06-15",
  updatedAt: "2024-06-15T00:00:00.000Z",
  ...over,
});

/** Finds a form control by the label above it, rather than by its position. */
function findField(screen: any, label: string): any {
  const field = byClass(screen, "field").find(
    (candidate: any) => textOf(candidate.querySelector(".field-label")) === label,
  );
  assert.ok(field, `no field labelled "${label}"`);
  return field.querySelector(".input");
}

function fill(screen: any, label: string, value: string): any {
  const input = findField(screen, label);
  input.dispatch("input", { target: { value } });
  return input;
}

/** True when the field's whole group is hidden, as the two date fields are. */
function fieldHidden(screen: any, label: string): boolean {
  const field = byClass(screen, "field").find(
    (candidate: any) => textOf(candidate.querySelector(".field-label")) === label,
  );
  assert.ok(field, `no field labelled "${label}"`);
  return field.parentNode?.hidden === true;
}

beforeEach(() => {
  rig = makeRig();
});

/* ------------------------------------------------------------------ home */

describe("home screen", () => {
  test("an empty book invites you to add the first baby", () => {
    const screen = renderHome(rig.ctx);
    const text = textOf(screen);
    assert.match(text, /No babies yet/);
    assert.equal(byClass(screen, "tile").length, 0);
  });

  test("babies fill a grid under the right heading, with a short status", () => {
    const local = makeRig([
      baby(),
      baby({ id: "bump", name: undefined, status: "expecting", birthDate: undefined, dueDate: "2026-11-20" }),
    ]);
    const screen = renderHome(local.ctx);
    const text = textOf(screen);

    assert.match(text, /On the way/);
    assert.match(text, /Little ones/);
    assert.match(text, /Mila/);
    // Unnamed bumps fall back to whose baby it is.
    assert.match(text, /Sarah's baby/);
    assert.equal(byClass(screen, "tile").length, 2);

    // A tile has room for "2y", not for "2 years, 2 months old".
    const subs = byClass(screen, "tile-sub").map((node: any) => textOf(node));
    assert.deepEqual(subs.sort(), ["11w", "2y"]);
  });

  test("each baby keeps its own colour, and a photo replaces the glyph", () => {
    const local = makeRig([
      baby(),
      baby({ id: "theo", name: "Theo", photo: "data:image/jpeg;base64,abc" }),
    ]);
    const tiles = byClass(renderHome(local.ctx), "tile");

    const tints = tiles.map(
      (node: any) => node.className.split(" ").find((name: string) => name.startsWith("tint-")),
    );
    assert.ok(tints.every(Boolean), "every tile should carry a tint class");

    assert.equal(tiles[0]!.querySelectorAll("img").length, 0, "no photo means a glyph");
    assert.equal(tiles[1]!.querySelectorAll("img").length, 1, "a photo should be shown");
  });

  test("only imminent events reach the this-week strip", () => {
    const soon = makeRig([baby({ id: "soon", name: "Ada", birthDate: "2024-09-04" })]);
    assert.match(textOf(renderHome(soon.ctx)), /This week/);

    const later = makeRig([baby({ id: "later", name: "Ada", birthDate: "2024-12-04" })]);
    assert.doesNotMatch(textOf(renderHome(later.ctx)), /This week/);
  });

  test("tapping a tile opens that baby", async () => {
    const local = makeRig([baby()]);
    const screen = renderHome(local.ctx);
    await byClass(screen, "tile")[0]!.click();
    assert.deepEqual(local.routes, ["#/baby/mila"]);
  });

  test("searching narrows the list, by parent as well as by name", () => {
    const local = makeRig([baby(), baby({ id: "theo", name: "Theo", parents: ["Dana"] })]);
    const screen = renderHome(local.ctx);
    const search = byClass(screen, "search")[0]!;

    search.dispatch("input", { target: { value: "dana" } });
    const text = textOf(screen);
    assert.match(text, /Theo/);
    assert.doesNotMatch(text, /Mila/);

    search.dispatch("input", { target: { value: "nobody" } });
    assert.match(textOf(screen), /Nobody by that name/);
  });
});

/* ---------------------------------------------------------------- detail */

describe("detail screen", () => {
  test("a born baby shows age, both zodiacs and the almanac facts", () => {
    const screen = renderDetail(rig.ctx, baby());
    const text = textOf(screen);

    assert.match(text, /2 years, 2 months old/);
    assert.match(text, /Gemini/);
    assert.match(text, /Wood Dragon/);
    assert.match(text, /Pearl/); // June birthstone
    assert.match(text, /Rose/); // June flower
    assert.match(text, /Saturday/); // 15 June 2024
    assert.match(text, /Turns 3rd in/);
  });

  test("milestones already passed are marked done, and the rest are not", () => {
    // Three months old at NOW, so only the arrival is behind them.
    const screen = renderDetail(rig.ctx, baby({ birthDate: "2026-06-01" }));
    const items = byClass(screen, "timeline-item");

    assert.equal(items.length, 5);
    assert.ok(items[0]!.classList.contains("done"), "arrival should be done");
    assert.ok(!items[1]!.classList.contains("done"), "100 days is still ahead");
    assert.ok(!items.at(-1)!.classList.contains("done"), "first birthday is still ahead");

    // A two year old has everything on the timeline behind them.
    const older = byClass(renderDetail(rig.ctx, baby()), "timeline-item");
    assert.ok(older.every((item) => item.classList.contains("done")));
  });

  test("an expecting baby counts down instead, and guesses the sign", () => {
    const screen = renderDetail(
      rig.ctx,
      baby({ status: "expecting", birthDate: undefined, dueDate: "2026-10-01" }),
    );
    const text = textOf(screen);

    assert.match(text, /due in 4 weeks/);
    assert.match(text, /Week 35/);
    assert.match(text, /If they arrive on time/);
    assert.match(text, /Libra/);
    assert.match(text, /rarely read the calendar/);
  });

  test("a cusp birthday is flagged rather than stated flatly", () => {
    const screen = renderDetail(rig.ctx, baby({ birthDate: "2024-01-20" }));
    assert.match(textOf(screen), /Right on the cusp with Capricorn/);
  });

  test("the gift toggle writes through and survives a reload", async () => {
    const local = makeRig([baby()]);
    const screen = renderDetail(local.ctx, baby());

    await byClass(screen, "gift-toggle")[0]!.click();
    assert.equal((await local.repo.list())[0]?.giftSent, true);
    assert.deepEqual(local.toasts, ["Gift marked as sent"]);

    assert.match(textOf(renderDetail(local.ctx, baby({ giftSent: true }))), /Gift sent/);
  });

  test("removing asks first rather than deleting on the spot", async () => {
    const local = makeRig([baby()]);
    const screen = renderDetail(local.ctx, baby());

    await byClass(screen, "danger")[0]!.click();
    assert.equal((await local.repo.list()).length, 1, "nothing should be gone yet");
    assert.deepEqual(local.routes, ["#/remove/mila"]);
  });

  test("a weight and a length are shown both ways, and skipped when unknown", () => {
    const weighed = baby({ birthWeightGrams: 3400, birthLengthCm: 51 });
    const text = textOf(renderDetail(rig.ctx, weighed));
    assert.match(text, /3\.4 kg/);
    assert.match(text, /7 lb 8 oz/);
    assert.match(text, /51 cm/);

    assert.doesNotMatch(textOf(renderDetail(rig.ctx, baby())), /kg/);
  });

  test("a bump gets a just-born button, and a baby who is here does not", () => {
    const bump = baby({ status: "expecting", birthDate: undefined, dueDate: "2026-10-01" });
    assert.match(textOf(renderDetail(rig.ctx, bump)), /Just born/);
    assert.doesNotMatch(textOf(renderDetail(rig.ctx, baby())), /Just born/);
  });

  test("even a bump with no due date can be marked as arrived", () => {
    const bump = baby({ status: "expecting", birthDate: undefined, dueDate: undefined });
    assert.match(textOf(renderDetail(rig.ctx, bump)), /Just born/);
  });
});

/* -------------------------------------------------------------- family */

describe("family", () => {
  const sibling = baby({
    id: "otto",
    name: "Otto",
    parents: ["Sarah", "Tom"],
    birthDate: "2021-02-03",
    sex: "boy",
  });

  test("a sibling is named, placed and reachable", async () => {
    const local = makeRig([baby(), sibling]);
    const screen = renderDetail(local.ctx, baby());

    const rows = byClass(screen, "sibling");
    assert.equal(rows.length, 1);
    assert.match(textOf(rows[0]), /Otto/);
    assert.match(textOf(rows[0]), /big brother/);

    await rows[0]!.click();
    assert.deepEqual(local.routes, ["#/baby/otto"]);
  });

  test("someone else's baby is not family", () => {
    const stranger = baby({ id: "nina", name: "Nina", parents: ["Dana"] });
    const local = makeRig([baby(), stranger]);
    assert.equal(byClass(renderDetail(local.ctx, baby()), "sibling").length, 0);
  });

  test("an only child is offered a sibling rather than an empty list", async () => {
    const local = makeRig([baby()]);
    const screen = renderDetail(local.ctx, baby());

    assert.match(textOf(screen), /Add a sibling/);
    const add = byClass(screen, "secondary").find((node: any) =>
      textOf(node).includes("Add a sibling"),
    );
    await add.click();
    assert.deepEqual(local.routes, ["#/sibling/mila"]);
  });

  test("a baby with no parents named is not asked about family at all", () => {
    const local = makeRig([baby({ parents: [] })]);
    assert.doesNotMatch(textOf(renderDetail(local.ctx, baby({ parents: [] }))), /Add a sibling/);
  });

  test("adding a sibling arrives with the parents already filled in", () => {
    const screen = renderEdit(rig.ctx, null, ["Sarah", "Tom"]);
    assert.equal(findField(screen, "Parent").value, "Sarah");
    assert.equal(findField(screen, "Second parent").value, "Tom");
  });

});

/* --------------------------------------------------------------- album */

describe("the album", () => {
  const shot = (id: string, date: string, caption?: string) => ({
    id,
    data: `data:image/jpeg;base64,${id}`,
    date,
    ...(caption ? { caption } : {}),
  });

  const withPhotos = () =>
    baby({ photos: [shot("later", "2025-01-08"), shot("first", "2024-06-16", "Day one")] });

  test("photos read oldest first, whatever order they were added in", () => {
    assert.deepEqual(
      albumOf(withPhotos()).map((photo) => photo.id),
      ["first", "later"],
    );
  });

  test("an empty album invites a first photo rather than showing nothing", () => {
    const screen = renderDetail(rig.ctx, baby());
    assert.match(textOf(screen), /Add a photo/);
    assert.equal(byClass(screen, "album-item").length, 0);
  });

  test("each photo is a button through to its own page", async () => {
    const local = makeRig([withPhotos()]);
    const screen = renderDetail(local.ctx, withPhotos());

    const items = byClass(screen, "album-item");
    assert.equal(items.length, 2);
    await items[0]!.click();
    assert.deepEqual(local.routes, ["#/photo/mila/first"]);
  });

  test("the viewer shows the caption and the day it was taken", () => {
    const screen = renderPhotoViewer(rig.ctx, withPhotos(), shot("first", "2024-06-16", "Day one"));
    assert.match(textOf(screen), /16 June 2024/);
    assert.equal(findField(screen, "Caption").value, "Day one");
  });

  test("a new caption is saved without leaving the picture", async () => {
    const local = makeRig([withPhotos()]);
    const screen = renderPhotoViewer(local.ctx, withPhotos(), shot("first", "2024-06-16"));

    const caption = findField(screen, "Caption");
    caption.value = "First bath";
    await caption.dispatch("change");

    const saved = local.repo.babies[0]!.photos!.find((photo: any) => photo.id === "first");
    assert.equal(saved?.caption, "First bath");
    assert.equal(local.redraws, 1, "the strip behind is in date order and must be redrawn");
    assert.deepEqual(local.routes, [], "and you stay on the picture");
  });

  test("changing the date reorders the album", async () => {
    const local = makeRig([withPhotos()]);
    const screen = renderPhotoViewer(local.ctx, withPhotos(), shot("first", "2024-06-16"));

    const taken = findField(screen, "Taken");
    taken.value = "2026-01-01";
    await taken.dispatch("change");

    assert.deepEqual(
      albumOf(local.repo.babies[0]!).map((photo) => photo.id),
      ["later", "first"],
    );
  });

  test("deleting takes only that photo, and lands back on the baby", async () => {
    const local = makeRig([withPhotos()]);
    const screen = renderPhotoViewer(local.ctx, withPhotos(), shot("first", "2024-06-16"));

    await byClass(screen, "danger")[0]!.click();

    assert.deepEqual(
      local.repo.babies[0]!.photos!.map((photo: any) => photo.id),
      ["later"],
    );
    assert.deepEqual(local.toasts, ["Photo removed"]);
    assert.deepEqual(local.routes, ["back"]);
  });

  test("a photo can be promoted to the picture on their tile", async () => {
    const local = makeRig([withPhotos()]);
    const photo = shot("first", "2024-06-16");
    const screen = renderPhotoViewer(local.ctx, withPhotos(), photo);

    await byClass(screen, "secondary")[0]!.click();

    assert.equal(local.repo.babies[0]!.photo, photo.data);
    // Promoting copies it across; the album is left exactly as it was.
    assert.equal(local.repo.babies[0]!.photos!.length, 2);
    assert.deepEqual(local.routes, ["back"]);
  });
});

/* ------------------------------------------------------- confirmations */

describe("confirmations", () => {
  const bump = (): Baby =>
    baby({ id: "bump", name: "Poppy", status: "expecting", birthDate: undefined, dueDate: "2026-10-01" });

  test("removing names the baby and warns there is no undo", () => {
    const text = textOf(renderRemoveConfirm(rig.ctx, baby()));
    assert.match(text, /Mila will be taken out of your book/);
    assert.match(text, /no undo/);
  });

  test("confirming soft deletes and returns to the book", async () => {
    const local = makeRig([baby()]);
    const screen = renderRemoveConfirm(local.ctx, baby());

    await byClass(screen, "danger-fill")[0]!.click();
    assert.equal((await local.repo.list()).length, 0);
    assert.ok((await local.repo.listAll())[0]?.deletedAt, "should be a tombstone, not a hole");
    assert.deepEqual(local.routes, ["#/"]);
    assert.deepEqual(local.toasts, ["Mila removed"]);
  });

  test("keeping backs out and changes nothing", async () => {
    const local = makeRig([baby()]);
    const screen = renderRemoveConfirm(local.ctx, baby());

    await byClass(screen, "quiet")[0]!.click();
    assert.equal((await local.repo.list()).length, 1);
    assert.deepEqual(local.routes, ["back"]);
  });

  test("the arrival popup offers today, and says so in words", () => {
    const screen = renderArrival(rig.ctx, bump());
    assert.equal(findField(screen, "Birthday").value, "2026-09-01");
    assert.match(textOf(screen), /Born 1 September 2026/);
  });

  test("confirming turns the bump into a baby and drops the due date", async () => {
    const local = makeRig([bump()]);
    const screen = renderArrival(local.ctx, bump());

    await byClass(screen, "primary")[0]!.click();

    const saved = (await local.repo.list())[0]!;
    assert.equal(saved.status, "born");
    assert.equal(saved.birthDate, "2026-09-01");
    assert.equal(saved.dueDate, undefined);
    assert.deepEqual(local.toasts, ["\u{1F389} Welcome, Poppy!"]);
    assert.deepEqual(local.routes, ["#/baby/bump"]);
  });

  test("an earlier arrival date can be picked instead", async () => {
    const local = makeRig([bump()]);
    const screen = renderArrival(local.ctx, bump());

    fill(screen, "Birthday", "2026-08-27");
    await byClass(screen, "primary")[0]!.click();

    assert.equal((await local.repo.list())[0]?.birthDate, "2026-08-27");
  });

  test("not yet backs out without touching the record", async () => {
    const local = makeRig([bump()]);
    const screen = renderArrival(local.ctx, bump());

    await byClass(screen, "quiet")[0]!.click();
    assert.equal((await local.repo.list())[0]?.status, "expecting");
    assert.deepEqual(local.routes, ["back"]);
  });
});

/* ------------------------------------------------------------------ form */

describe("add and edit", () => {
  test("a bump is offered a due date and no birthday", () => {
    const screen = renderEdit(rig.ctx, null);
    const [expecting, born] = byClass(screen, "segmented")[0]!.querySelectorAll("button");

    assert.ok(expecting!.classList.contains("active"));
    assert.ok(!born!.classList.contains("active"));
    assert.equal(fieldHidden(screen, "Due date"), false);
    assert.equal(fieldHidden(screen, "Birthday"), true);
  });

  test("and a baby who is here gets a birthday and no due date", () => {
    const screen = renderEdit(rig.ctx, null);
    const born = byClass(screen, "segmented")[0]!.querySelectorAll("button")[1]!;

    born.click();
    assert.ok(born.classList.contains("active"));
    assert.equal(fieldHidden(screen, "Due date"), true);
    assert.equal(fieldHidden(screen, "Birthday"), false);
  });

  test("a born baby with no birthday is refused, with a reason", async () => {
    const screen = renderEdit(rig.ctx, null);
    byClass(screen, "segmented")[0]!.querySelectorAll("button")[1]!.click();

    await screen.querySelector(".form")!.dispatch("submit");

    const error = byClass(screen, "form-error")[0]!;
    assert.equal(error.hidden, false);
    assert.match(textOf(error), /birthday is needed/);
    assert.equal(rig.repo.babies.length, 0);
  });

  test("a baby with neither a name nor a parent is refused", async () => {
    const screen = renderEdit(rig.ctx, null);
    fill(screen, "Due date", "2026-11-01");

    await screen.querySelector(".form")!.dispatch("submit");
    assert.match(textOf(byClass(screen, "form-error")[0]!), /whose baby this is/);
  });

  test("a valid bump saves and opens its page", async () => {
    const screen = renderEdit(rig.ctx, null);
    fill(screen, "Name", "Poppy");
    fill(screen, "Parent", "Dana");
    fill(screen, "Second parent", "Alex");
    fill(screen, "Due date", "2026-11-01");

    await screen.querySelector(".form")!.dispatch("submit");

    const saved = rig.repo.babies[0]!;
    assert.equal(saved.name, "Poppy");
    assert.deepEqual(saved.parents, ["Dana", "Alex"]);
    assert.equal(saved.dueDate, "2026-11-01");
    assert.equal(saved.status, "expecting");
    assert.deepEqual(rig.toasts, ["Added"]);
    assert.equal(rig.routes[0], `#/baby/${saved.id}`);
  });

  test("the second parent really is optional", async () => {
    const screen = renderEdit(rig.ctx, null);
    fill(screen, "Parent", "Dana");
    fill(screen, "Due date", "2026-11-01");

    await screen.querySelector(".form")!.dispatch("submit");
    assert.deepEqual(rig.repo.babies[0]?.parents, ["Dana"]);
  });

  test("arriving clears the due date, so the two can never contradict", async () => {
    const screen = renderEdit(rig.ctx, null);
    fill(screen, "Name", "Poppy");
    fill(screen, "Parent", "Dana");
    fill(screen, "Due date", "2026-11-01");

    byClass(screen, "segmented")[0]!.querySelectorAll("button")[1]!.click();
    fill(screen, "Birthday", "2026-08-28");
    await screen.querySelector(".form")!.dispatch("submit");

    const saved = rig.repo.babies[0]!;
    assert.equal(saved.status, "born");
    assert.equal(saved.birthDate, "2026-08-28");
    assert.equal(saved.dueDate, undefined);
  });

  test("a weight in kilograms is stored as grams", async () => {
    const screen = renderEdit(rig.ctx, null);
    byClass(screen, "segmented")[0]!.querySelectorAll("button")[1]!.click();
    fill(screen, "Name", "Poppy");
    fill(screen, "Birthday", "2026-08-28");
    fill(screen, "Weight", "3.42");
    fill(screen, "Length", "51.5");
    await screen.querySelector(".form")!.dispatch("submit");

    assert.equal(rig.repo.babies[0]?.birthWeightGrams, 3420);
    assert.equal(rig.repo.babies[0]?.birthLengthCm, 51.5);
  });

  test("an implausible weight is refused rather than quietly dropped", async () => {
    const screen = renderEdit(rig.ctx, null);
    byClass(screen, "segmented")[0]!.querySelectorAll("button")[1]!.click();
    fill(screen, "Name", "Poppy");
    fill(screen, "Birthday", "2026-08-28");
    fill(screen, "Weight", "34");
    await screen.querySelector(".form")!.dispatch("submit");

    assert.equal(rig.repo.babies.length, 0);
    assert.match(textOf(screen.querySelector(".form-error")), /between 0\.2 and 8 kg/);
  });

  test("leaving the measurements blank is fine", async () => {
    const screen = renderEdit(rig.ctx, null);
    byClass(screen, "segmented")[0]!.querySelectorAll("button")[1]!.click();
    fill(screen, "Name", "Poppy");
    fill(screen, "Birthday", "2026-08-28");
    await screen.querySelector(".form")!.dispatch("submit");

    assert.equal(rig.repo.babies[0]?.birthWeightGrams, undefined);
  });

  test("an existing weight comes back into the form in kilograms", () => {
    const screen = renderEdit(rig.ctx, baby({ birthWeightGrams: 3400 }));
    assert.equal(findField(screen, "Weight").value, "3.4");
  });

  test("editing keeps the same record rather than making a second one", async () => {
    const local = makeRig([baby()]);
    const screen = renderEdit(local.ctx, baby());

    fill(screen, "Name", "Mila Rose");
    await screen.querySelector(".form")!.dispatch("submit");

    assert.equal(local.repo.babies.length, 1);
    assert.equal(local.repo.babies[0]?.id, "mila");
    assert.equal(local.repo.babies[0]?.name, "Mila Rose");
  });

  test("an existing pair of parents comes back into its two fields", () => {
    const screen = renderEdit(rig.ctx, baby());
    assert.equal(findField(screen, "Parent").value, "Sarah");
    assert.equal(findField(screen, "Second parent").value, "Tom");
  });

  test("a gift already sent is not forgotten by an edit", async () => {
    const local = makeRig([baby({ giftSent: true })]);
    const screen = renderEdit(local.ctx, baby({ giftSent: true }));
    await screen.querySelector(".form")!.dispatch("submit");
    assert.equal(local.repo.babies[0]?.giftSent, true);
  });
});

/* -------------------------------------------------------------- popups */

describe("popups", () => {
  test("every screen other than the book opens as one", () => {
    for (const screen of [
      renderEdit(rig.ctx, null),
      renderDetail(rig.ctx, baby()),
      renderSettings(rig.ctx),
    ]) {
      assert.ok(screen.classList.contains("overlay"), "should be an overlay");
      assert.equal(screen.getAttribute("aria-modal"), "true");
      assert.equal(byClass(screen, "sheet").length, 1);
    }
  });

  test("the close button and the backdrop both dismiss it", async () => {
    const closed = renderSettings(rig.ctx);
    await byClass(closed, "sheet-bar")[0]!.querySelectorAll("button").at(-1)!.click();
    assert.deepEqual(rig.routes, ["back"]);

    const dismissed = renderSettings(rig.ctx);
    await dismissed.dispatch("click", { target: dismissed, currentTarget: dismissed });
    assert.deepEqual(rig.routes, ["back", "back"]);
  });

  test("but a tap inside the sheet does not", async () => {
    const screen = renderSettings(rig.ctx);
    const sheet = byClass(screen, "sheet")[0]!;
    await screen.dispatch("click", { target: sheet, currentTarget: screen });
    assert.deepEqual(rig.routes, []);
  });
});

/* -------------------------------------------------------------- settings */

describe("settings screen", () => {
  test("it says plainly where the data lives", () => {
    const text = textOf(renderSettings(rig.ctx));
    assert.match(text, /lives on this device only/);
    assert.match(text, /Export \.ics/);
    assert.match(text, /Import/);
  });

  test("the count is worded for one baby and for several", () => {
    assert.match(textOf(renderSettings(makeRig([baby()]).ctx)), /1 baby, never backed up/);
    assert.match(
      textOf(renderSettings(makeRig([baby(), baby({ id: "b" })]).ctx)),
      /2 babies, never backed up/,
    );
  });

  test("it points at a folder the phone already syncs, not at a server", () => {
    const text = textOf(renderSettings(makeRig([baby()]).ctx));
    assert.match(text, /iCloud Drive/);
    assert.match(text, /without anyone running a server/);
    assert.match(text, /Back up/);
  });

  test("an empty book is not nagged about backing up", () => {
    assert.match(textOf(renderSettings(makeRig([]).ctx)), /Nothing to back up yet/);
  });

  test("the theme can be chosen, and dark is where it starts", () => {
    const screen = renderSettings(rig.ctx);
    const picker = byClass(screen, "segmented")[0]!;
    const labels = picker.querySelectorAll("button").map((node: any) => textOf(node));
    assert.deepEqual(labels, ["Auto", "Dark", "Light"]);

    // Nothing stored, so it follows the system rather than forcing either.
    assert.equal(picker.querySelectorAll("button")[0]!.getAttribute("aria-pressed"), "true");
  });

  test("choosing a theme redraws, so the buttons agree with the screen", () => {
    const local = makeRig([baby()]);
    const screen = renderSettings(local.ctx);
    byClass(screen, "segmented")[0]!.querySelectorAll("button")[1]!.click();

    assert.equal(document.documentElement.dataset.theme, "dark");
    assert.equal(local.redraws, 1);
  });

  test("exporting a calendar with nothing in it says so instead of downloading", () => {
    const screen = renderSettings(rig.ctx);
    byClass(screen, "secondary")[0]!.click();
    assert.deepEqual(rig.toasts, ["No dates to export yet"]);
  });
});

/* --------------------------------------------------------------- routing */

describe("the app shell", () => {
  /** A fresh window each time, so one test's navigation cannot leak into another. */
  async function withApp(
    babies: Baby[],
    run: (root: any, repo: MemoryRepo) => Promise<void> | void,
  ): Promise<void> {
    const restore = installDom();
    try {
      const repo = new MemoryRepo();
      repo.babies = babies;
      const root = document.createElement("div");
      await startApp(root as never, repo);
      await run(root, repo);
    } finally {
      restore();
    }
  }

  test("it opens on the book itself, with no popup over it", async () => {
    await withApp([baby()], (root) => {
      assert.match(textOf(root), /Little ones/);
      assert.match(textOf(root), /Mila/);
      assert.equal(byClass(root, "overlay").length, 0);
    });
  });

  test("every route opens a popup, and the book stays behind it", async () => {
    await withApp([baby()], (root) => {
      for (const [hash, expected] of [
        ["#/settings", /Backup/],
        ["#/add", /New baby/],
        ["#/baby/mila", /Written in the stars/],
        ["#/edit/mila", /Edit/],
      ] as const) {
        location.hash = hash;
        assert.match(textOf(root), expected);
        assert.equal(byClass(root, "overlay").length, 1, `${hash} should open one popup`);
        // The grid is still rendered underneath, not torn down and rebuilt.
        assert.ok(byClass(root, "tile").length > 0, `${hash} should keep the book behind`);
      }

      history.back();
      assert.match(textOf(root), /Written in the stars/);
    });
  });

  test("closing the last popup leaves just the book", async () => {
    await withApp([baby()], (root) => {
      location.hash = "#/settings";
      assert.equal(byClass(root, "overlay").length, 1);

      history.back();
      assert.equal(byClass(root, "overlay").length, 0);
      assert.match(textOf(root), /Little ones/);
    });
  });

  test("Escape closes a popup, and does nothing on the book", async () => {
    await withApp([baby()], (root) => {
      const press = (key: string) =>
        (document as never as { dispatchEvent: (e: object) => void }).dispatchEvent({
          type: "keydown",
          key,
        });

      location.hash = "#/settings";
      press("Escape");
      assert.equal(byClass(root, "overlay").length, 0);

      // Already on the book: nothing to close, and nothing should break.
      press("Escape");
      assert.equal(byClass(root, "overlay").length, 0);
      assert.match(textOf(root), /Little ones/);
    });
  });

  test("an unknown route falls back to the book rather than a blank screen", async () => {
    await withApp([baby()], (root) => {
      location.hash = "#/nonsense";
      assert.match(textOf(root), /Little ones/);
      assert.equal(byClass(root, "overlay").length, 0);
    });
  });

  test("a link to a baby that is gone explains itself", async () => {
    await withApp([baby()], (root) => {
      location.hash = "#/baby/someone-else";
      assert.match(textOf(root), /Not here any more/);
    });
  });

  test("coming back to the app redraws the book, so countdowns stay honest", async () => {
    await withApp([baby()], (root) => {
      const before = byClass(root, "tile")[0];
      (window as never as { dispatchEvent: (e: { type: string }) => void }).dispatchEvent({
        type: "visibilitychange",
      });
      assert.notEqual(byClass(root, "tile")[0], before, "the book should have redrawn");
    });
  });

  test("but it never redraws over a half-filled form", async () => {
    await withApp([], (root) => {
      location.hash = "#/add";
      const input = findField(root, "Name");
      input.dispatch("input", { target: { value: "Poppy" } });

      (window as never as { dispatchEvent: (e: { type: string }) => void }).dispatchEvent({
        type: "visibilitychange",
      });

      assert.match(textOf(root), /New baby/);
      assert.equal(
        findField(root, "Name"),
        input,
        "the form was rebuilt, losing whatever was typed into it",
      );
    });
  });

  test("a confirmation stacks over the baby's page instead of replacing it", async () => {
    await withApp([baby()], async (root) => {
      location.hash = "#/baby/mila";
      await byClass(root, "danger")[0]!.click();

      assert.equal(byClass(root, "overlay").length, 2, "the question sits over the page");
      // The page underneath is still the one you were reading.
      assert.match(textOf(root), /Written in the stars/);
      assert.match(textOf(root), /taken out of your book/);

      history.back();
      assert.equal(byClass(root, "overlay").length, 1);
      assert.match(textOf(root), /Written in the stars/);
    });
  });

  test("seeing it through removes the baby and leaves a book that still renders", async () => {
    await withApp([baby()], async (root, repo) => {
      location.hash = "#/baby/mila";
      await byClass(root, "danger")[0]!.click();
      await byClass(root, "danger-fill")[0]!.click();

      assert.equal((await repo.list()).length, 0);
      assert.equal(byClass(root, "overlay").length, 0);
      assert.match(textOf(root), /No babies yet/);
    });
  });

  test("a photo opens over the baby, and a stale link just shows the baby", async () => {
    const shot = { id: "p1", data: "data:image/jpeg;base64,aaa", date: "2024-06-16" };
    await withApp([baby({ photos: [shot] })], async (root) => {
      location.hash = "#/photo/mila/p1";
      assert.equal(byClass(root, "overlay").length, 2);

      location.hash = "#/photo/mila/deleted-yesterday";
      assert.equal(byClass(root, "overlay").length, 1);
      assert.match(textOf(root), /Written in the stars/);
    });
  });

  test("a sibling is added with the parents already filled in", async () => {
    await withApp([baby()], async (root, repo) => {
      location.hash = "#/sibling/mila";
      fill(root, "Name", "Otto");
      fill(root, "Due date", "2026-12-01");
      await root.querySelector(".form")!.dispatch("submit");

      const otto = (await repo.list()).find((candidate: any) => candidate.name === "Otto");
      assert.deepEqual(otto?.parents, ["Sarah", "Tom"]);
    });
  });

  test("ticking the gift redraws it, rather than leaving a stale label", async () => {
    await withApp([baby()], async (root, repo) => {
      location.hash = "#/baby/mila";
      await byClass(root, "gift-toggle")[0]!.click();

      assert.equal((await repo.list())[0]?.giftSent, true);
      assert.match(textOf(byClass(root, "gift-toggle")[0]), /Gift sent/);
    });
  });

  test("a bump can be marked as born without leaving its page", async () => {
    const bump = baby({
      id: "bump",
      name: "Poppy",
      status: "expecting",
      birthDate: undefined,
      dueDate: "2026-10-01",
    });

    await withApp([bump], async (root, repo) => {
      location.hash = "#/baby/bump";
      const justBorn = byClass(root, "primary").find((node: any) =>
        textOf(node).includes("Just born"),
      );
      assert.ok(justBorn, "a bump should offer a just-born button");
      await justBorn.click();

      assert.equal(byClass(root, "overlay").length, 2);
      const yes = byClass(root, "primary").find((node: any) => textOf(node).includes("Yes"));
      assert.ok(yes, "the arrival popup should offer a confirmation");
      await yes.click();

      const saved = (await repo.list())[0]!;
      assert.equal(saved.status, "born");
      assert.equal(saved.dueDate, undefined);
      // Defaulted to today, whenever the test happens to run.
      assert.equal(saved.birthDate, toISODate(new Date()));
      assert.equal(byClass(root, "overlay").length, 1, "back on the baby's own page");
    });
  });
});
