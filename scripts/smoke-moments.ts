/*
 * The moments somebody writes down themselves: the sorting and the checks as
 * pure functions, and the section on the baby's page against the stub DOM in
 * dom-stub.mjs.
 *
 * The computed milestones are arithmetic and are covered in smoke.ts. Nothing
 * here can be worked out, so what is worth checking instead is that a typed
 * line survives the round trip through storage and comes back in order.
 *
 * Usage: node --test scripts/smoke-moments.ts
    10| */
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";

import { byClass, installDom, textOf } from "./dom-stub.mjs";

import {
  momentProblem,
  momentsOf,
  tidyLabel,
  unusedSuggestions,
} from "../src/domain/moments.ts";
import type { Baby, Moment } from "../src/domain/types.ts";
import { en } from "../src/i18n/en.ts";
import {
  MAX_MOMENTS,
  MAX_MOMENT_LABEL,
  type BabyRepo,
  type MergeResult,
} from "../src/storage/repo.ts";
import type { AppContext } from "../src/ui/context.ts";

// Installed before the section is imported, so anything it touches at module
// scope finds a DOM waiting for it.
const teardown = installDom();
after(() => teardown());

const { momentsSection } = await import("../src/ui/moments.ts");

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
  redraws: number;
};

let rig: Rig;

function makeRig(babies: Baby[] = []): Rig {
  const repo = new MemoryRepo();
  repo.babies = babies;
  const rig: Rig = { ctx: null as unknown as AppContext, repo, toasts: [], redraws: 0 };

  const ctx: AppContext = {
    repo,
    babies: babies.filter((baby) => baby.deletedAt == null),
    now: NOW,
    // Asserted in English, which is the language the wording was written in.
    // The Hebrew side is the catalogue suite's business.
    t: en,
    jewish: false,
    navigate: () => {},
    back: () => {},
    finish: () => {},
    refresh: async () => {
      ctx.babies = await repo.list();
    },
    redraw: () => {
      rig.redraws += 1;
    },
    toast: (message) => rig.toasts.push(message),
  };

  rig.ctx = ctx;
  return rig;
}

const ADDED_AT = "2024-06-15T00:00:00.000Z";

const baby = (over: Partial<Baby> = {}): Baby => ({
  id: "mila",
  name: "Mila",
  parents: ["Sarah", "Tom"],
  status: "born",
  birthDate: "2024-06-15",
  updatedAt: ADDED_AT,
  ...over,
});

const moment = (id: string, label: string, date: string): Moment => ({ id, label, date });

const words = en.baby.moments;

/** A form control's group, found by the label above it rather than by order. */
function findField(screen: any, label: string): any {
  const field = byClass(screen, "field").find(
    (candidate: any) => textOf(candidate.querySelector(".field-label")) === label,
  );
  assert.ok(field, `no field labelled "${label}"`);
  return field;
}

/** The three dropdowns behind a date, set the way a person would set them. */
function pickDate(screen: any, label: string, iso: string): void {
  const [day, month, year] = findField(screen, label).querySelectorAll("select");
  const [y, m, d] = iso.split("-").map(Number);

  // Year first, since it decides which months and then which days are offered.
  for (const [control, value] of [
    [year, y],
    [month, m],
    [day, d],
  ] as const) {
    control.value = String(value);
    control.dispatch("change");
  }
}

const open = (screen: any): unknown => byClass(screen, "secondary")[0]!.click();

const type = (screen: any, text: string): void => {
  findField(screen, words.what)
    .querySelector(".input")
    .dispatch("input", { target: { value: text } });
};

const save = (screen: any): unknown => byClass(screen, "primary")[0]!.click();

beforeEach(() => {
  rig = makeRig();
});

/* ------------------------------------------------------- sorting, checks */

describe("moments in order", () => {
  test("they read oldest first, whatever order they were written in", () => {
    const noted = baby({
      moments: [
        moment("steps", "First steps", "2025-08-02"),
        moment("tooth", "First tooth", "2024-12-20"),
        moment("word", "First word", "2026-01-11"),
      ],
    });
    assert.deepEqual(
      momentsOf(noted).map((one) => one.id),
      ["tooth", "steps", "word"],
    );
  });

  test("a baby with none has an empty list rather than nothing at all", () => {
    assert.deepEqual(momentsOf(baby()), []);
  });

  test("sorting leaves the record alone, so nothing is written by reading", () => {
    const noted = baby({
      moments: [moment("b", "Sat up", "2025-01-02"), moment("a", "First smile", "2024-08-01")],
    });
    momentsOf(noted);
    assert.deepEqual(
      noted.moments!.map((one) => one.id),
      ["b", "a"],
    );
  });
});

describe("what gets kept of what was typed", () => {
  test("a label is trimmed and folded onto one line", () => {
    assert.equal(tidyLabel("  First   tooth \n"), "First tooth");
  });

  test("a label of nothing but space is nothing", () => {
    assert.equal(tidyLabel("   \n  "), "");
  });

  test("a long one is cut to what storage will keep", () => {
    const long = tidyLabel("a".repeat(MAX_MOMENT_LABEL + 40));
    assert.equal(long.length, MAX_MOMENT_LABEL);
  });
});

describe("what stops a moment being kept", () => {
  test("nothing, when it has words and a day", () => {
    assert.equal(momentProblem(baby(), "First tooth", "2025-03-01"), null);
  });

  test("words made only of spaces are no words", () => {
    assert.equal(momentProblem(baby(), "   ", "2025-03-01"), "needLabel");
  });

  test("a half-answered date is no date", () => {
    assert.equal(momentProblem(baby(), "First tooth", ""), "needDate");
  });

  test("a full book says so first, because typing cannot fix it", () => {
    const full = baby({
      moments: Array.from({ length: MAX_MOMENTS }, (_, index) =>
        moment(String(index), `Moment ${index}`, "2025-01-01"),
      ),
    });
    assert.equal(momentProblem(full, "First tooth", "2025-03-01"), "full");
    assert.equal(momentProblem(full, "", ""), "full");
  });

  test("one short of full is still fine", () => {
    const nearly = baby({
      moments: Array.from({ length: MAX_MOMENTS - 1 }, (_, index) =>
        moment(String(index), `Moment ${index}`, "2025-01-01"),
      ),
    });
    assert.equal(momentProblem(nearly, "First tooth", "2025-03-01"), null);
  });
});

describe("the suggestions", () => {
  test("a baby with nothing written down is offered all of them, in order", () => {
    assert.deepEqual(unusedSuggestions(baby(), words.common), [...words.common]);
  });

  test("one already written down is not suggested again", () => {
    const noted = baby({ moments: [moment("t", "First tooth", "2025-01-01")] });
    const left = unusedSuggestions(noted, words.common);

    assert.ok(!left.includes("First tooth"));
    assert.ok(left.includes("First smile"));
    assert.equal(left.length, words.common.length - 1);
  });

  test("and neither is one written in another case, or with stray spaces", () => {
    const noted = baby({ moments: [moment("t", "  first   TOOTH ", "2025-01-01")] });
    assert.ok(!unusedSuggestions(noted, words.common).includes("First tooth"));
  });

  test("something of your own leaves the list exactly as it was", () => {
    const noted = baby({ moments: [moment("h", "Slept through", "2025-01-01")] });
    assert.deepEqual(unusedSuggestions(noted, words.common), [...words.common]);
  });

  test("when every one has been used there is nothing left to offer", () => {
    const noted = baby({
      moments: words.common.map((label, index) => moment(String(index), label, "2025-01-01")),
    });
    assert.deepEqual(unusedSuggestions(noted, words.common), []);
  });
});

/* ------------------------------------------------------------- the section */

describe("the moments section", () => {
  const noted = () =>
    baby({
      moments: [
        moment("steps", "First steps", "2025-08-02"),
        moment("tooth", "First tooth", "2024-12-20"),
      ],
    });

  test("an empty list invites a first one rather than showing nothing", () => {
    const screen = momentsSection(baby(), rig.ctx);
    assert.match(textOf(screen), /The firsts nothing can work out for you/);
    assert.match(textOf(screen), /Note a moment/);
    assert.equal(byClass(screen, "timeline-item").length, 0);
  });

  test("they are listed oldest first, with the day written out in full", () => {
    const screen = momentsSection(noted(), rig.ctx);
    const items = byClass(screen, "timeline-item");

    assert.equal(items.length, 2);
    assert.match(textOf(items[0]), /First tooth/);
    assert.match(textOf(items[0]), /20 December 2024/);
    assert.match(textOf(items[1]), /First steps/);
  });

  test("every one of them is behind the baby, so every dot is lit", () => {
    const items = byClass(momentsSection(noted(), rig.ctx), "timeline-item");
    assert.ok(items.every((item: any) => item.classList.contains("done")));
  });

  test("what somebody typed reads in its own direction", () => {
    const screen = momentsSection(noted(), rig.ctx);
    const label = byClass(screen, "timeline-label")[0]!;
    assert.equal(label.getAttribute("dir"), "auto");
  });

  test("the form is folded away until it is asked for", () => {
    const screen = momentsSection(baby(), rig.ctx);
    const form = byClass(screen, "field-group")[0]!;

    assert.equal(form.hidden, true);
    open(screen);
    assert.equal(form.hidden, false);
    assert.equal(byClass(screen, "secondary")[0]!.hidden, true, "and the opener steps aside");
  });

  test("the day is picked with the app's own dropdowns, never a native one", () => {
    const screen = momentsSection(baby(), rig.ctx);
    const field = findField(screen, words.when);

    assert.equal(field.querySelectorAll("select").length, 3);
    assert.equal(
      screen.querySelectorAll("input").filter((one: any) => one.getAttribute("type") === "date")
        .length,
      0,
    );
  });

  test("a typed moment is saved, dated, and the page told to redraw", async () => {
    const local = makeRig([baby()]);
    const screen = momentsSection(baby(), local.ctx);

    open(screen);
    type(screen, "  Waved   goodbye ");
    pickDate(screen, words.when, "2026-05-10");
    await save(screen);

    const saved = local.repo.babies[0]!.moments!;
    assert.equal(saved.length, 1);
    assert.equal(saved[0]!.label, "Waved goodbye", "folded onto one line on the way in");
    assert.equal(saved[0]!.date, "2026-05-10");
    assert.deepEqual(local.toasts, ["Moment saved"]);
    assert.equal(local.redraws, 1, "the list has to be told to grow");
  });

  test("a save bumps updatedAt, so a backup and a merge both notice", async () => {
    const local = makeRig([baby()]);
    const screen = momentsSection(baby(), local.ctx);

    open(screen);
    type(screen, "First word");
    pickDate(screen, words.when, "2026-05-10");
    await save(screen);

    assert.ok(local.repo.babies[0]!.updatedAt > ADDED_AT);
  });

  test("an added moment joins the ones already there", async () => {
    const local = makeRig([noted()]);
    const screen = momentsSection(noted(), local.ctx);

    open(screen);
    type(screen, "First word");
    pickDate(screen, words.when, "2025-02-14");
    await save(screen);

    assert.deepEqual(
      momentsOf(local.repo.babies[0]!).map((one) => one.label),
      ["First tooth", "First word", "First steps"],
    );
  });

  test("a suggestion fills the box rather than saving on the spot", async () => {
    const local = makeRig([baby()]);
    const screen = momentsSection(baby(), local.ctx);

    open(screen);
    const chip = byClass(screen, "suggestion").find(
      (one: any) => textOf(one) === "First tooth",
    );
    assert.ok(chip, "First tooth should be on offer");
    await chip.click();

    assert.equal(findField(screen, words.what).querySelector(".input").value, "First tooth");
    assert.equal(local.repo.babies[0]!.moments, undefined, "nothing saved by the tap alone");

    pickDate(screen, words.when, "2025-04-01");
    await save(screen);
    assert.equal(local.repo.babies[0]!.moments![0]!.label, "First tooth");
  });

  test("a suggestion already used is not offered a second time", () => {
    const screen = momentsSection(baby({ moments: [moment("t", "First tooth", "2025-01-01")] }), rig.ctx);
    const offered = byClass(screen, "suggestion").map((one: any) => textOf(one));

    assert.ok(!offered.includes("First tooth"));
    assert.ok(offered.includes("First word"));
  });

  test("nothing is saved without words, and the reason is said out loud", async () => {
    const local = makeRig([baby()]);
    const screen = momentsSection(baby(), local.ctx);

    open(screen);
    pickDate(screen, words.when, "2026-05-10");
    await save(screen);

    assert.equal(local.repo.babies[0]!.moments, undefined);
    assert.deepEqual(local.toasts, ["Say what happened, in a word or two."]);
    assert.equal(local.redraws, 0, "and the half-filled form is left standing");
  });

  test("nor without a day", async () => {
    const local = makeRig([baby()]);
    const screen = momentsSection(baby(), local.ctx);

    open(screen);
    type(screen, "First tooth");
    await save(screen);

    assert.equal(local.repo.babies[0]!.moments, undefined);
    assert.deepEqual(local.toasts, ["Pick the day it happened."]);
  });

  test("a book at its limit says so rather than quietly dropping the last one", async () => {
    const full = baby({
      moments: Array.from({ length: MAX_MOMENTS }, (_, index) =>
        moment(String(index), `Moment ${index}`, "2025-01-01"),
      ),
    });
    const local = makeRig([full]);
    const screen = momentsSection(full, local.ctx);

    open(screen);
    type(screen, "One too many");
    pickDate(screen, words.when, "2026-05-10");
    await save(screen);

    assert.equal(local.repo.babies[0]!.moments!.length, MAX_MOMENTS);
    assert.deepEqual(local.toasts, [words.full(MAX_MOMENTS)]);
  });

  test("removing takes only that one, and says which way it went", async () => {
    const local = makeRig([noted()]);
    const screen = momentsSection(noted(), local.ctx);

    await byClass(screen, "moment-remove")[0]!.click();

    assert.deepEqual(
      local.repo.babies[0]!.moments!.map((one: Moment) => one.id),
      ["steps"],
    );
    assert.deepEqual(local.toasts, ["Moment removed"]);
    assert.equal(local.redraws, 1);
  });

  test("the cross says what it takes away, for anyone who cannot see it", () => {
    const screen = momentsSection(noted(), rig.ctx);
    const cross = byClass(screen, "moment-remove")[0]!;
    assert.equal(cross.getAttribute("aria-label"), "Remove First tooth");
  });

  test("cancelling folds the form away again and changes nothing", async () => {
    const local = makeRig([baby()]);
    const screen = momentsSection(baby(), local.ctx);

    open(screen);
    type(screen, "First tooth");
    await byClass(screen, "quiet")[0]!.click();

    assert.equal(byClass(screen, "field-group")[0]!.hidden, true);
    assert.equal(byClass(screen, "secondary")[0]!.hidden, false);
    assert.equal(local.repo.babies[0]!.moments, undefined);
    assert.deepEqual(local.toasts, []);
  });
});
