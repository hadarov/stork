import {
  describeAge,
  describeParents,
  displayName,
  dueCountdown,
  formatDate,
  nextEvent,
  parseDate,
} from "../domain/derive.ts";
import { familyOf, type Family } from "../domain/family.ts";
import type { Baby } from "../domain/types.ts";
import type { Catalog } from "../i18n/en.ts";
import { avatar } from "./components.ts";
import type { AppContext } from "./context.ts";
import { el } from "./dom.ts";
import { popup } from "./modal.ts";

/*
 * The point of the whole app, on one screen: you are about to see these people
 * and you have thirty seconds in the car to remember who is who. Everything
 * here is something you would be embarrassed not to know, and nothing here is
 * a birthstone.
 *
 * Reached from the parents' names on a baby's page, and only from there. There
 * used to be a screen listing every household as a way in, but the grid names
 * the parents on every tile now, so that was a second door into the same room.
 */

/** Days after which not having sent anything is worth saying out loud. */
const GRACE_DAYS = 30;

function soonest(family: Family, now: Date, t: Catalog) {
  return family.babies
    .map((baby) => ({ baby, event: nextEvent(baby, now, t) }))
    .filter((entry) => entry.event !== null)
    .sort((a, b) => a.event!.daysUntil - b.event!.daysUntil)[0];
}

function howOld(baby: Baby, now: Date, t: Catalog): string {
  if (baby.status === "born" && baby.birthDate) {
    return describeAge(baby.birthDate, now, t, baby.sex).label;
  }
  // A bump with no date has nothing to count, and "on the way" is already the
  // first rung of the life stages rather than a phrase of this screen's own.
  return baby.dueDate ? dueCountdown(baby.dueDate, now, t).label : t.stage.egg;
}

/** The gift, said the way you would want to be told. */
function giftLine(baby: Baby, now: Date, t: Catalog): string {
  if (baby.giftSent) return t.book.brief.giftSent;
  if (baby.status !== "born" || !baby.birthDate) return t.book.brief.giftNone;

  const age = describeAge(baby.birthDate, now, t, baby.sex);
  return age.days > GRACE_DAYS ? t.book.brief.giftLate(age.label) : t.book.brief.giftNone;
}

function card(baby: Baby, ctx: AppContext): HTMLElement {
  const born = baby.status === "born" && baby.birthDate;

  return el(
    "button",
    {
      class: "brief-card",
      type: "button",
      onclick: () => ctx.navigate(`#/baby/${encodeURIComponent(baby.id)}`),
    },
    avatar(baby, ctx.now, ctx.t, "sm"),
    el(
      "span",
      { class: "brief-text" },
      el("span", { class: "brief-name", dir: "auto" }, displayName(baby, ctx.t)),
      el("span", { class: "brief-age" }, howOld(baby, ctx.now, ctx.t)),
      born
        ? el(
            "span",
            { class: "brief-meta" },
            ctx.t.book.brief.born(formatDate(parseDate(baby.birthDate!), ctx.t), baby.sex),
          )
        : null,
      el(
        "span",
        { class: baby.giftSent ? "brief-gift done" : "brief-gift" },
        giftLine(baby, ctx.now, ctx.t),
      ),
      baby.notes ? el("span", { class: "brief-note", dir: "auto" }, baby.notes) : null,
    ),
  );
}

export function renderBrief(ctx: AppContext, baby: Baby): HTMLElement {
  const family = familyOf(baby, ctx.babies);
  const next = soonest(family, ctx.now, ctx.t);

  const nothingWritten = family.babies.every((one) => !one.notes);

  return popup({
    title: describeParents(family.parents, ctx.t) || displayName(baby, ctx.t),
    wide: true,
    onClose: () => ctx.back(),
    body: [
      next
        ? el(
            "div",
            { class: "hero-stat" },
            el(
              "span",
              { class: "hero-number", dir: "auto" },
              `${next.event!.emoji} ${displayName(next.baby, ctx.t)}`,
            ),
            el("span", { class: "hero-sub" }, next.event!.label),
          )
        : el(
            "div",
            { class: "hero-stat" },
            el("span", { class: "hero-number" }, ctx.t.book.brief.calmTitle),
            el("span", { class: "hero-sub" }, ctx.t.book.brief.calmBody),
          ),
      el("section", { class: "panel" }, ...family.babies.map((one) => card(one, ctx))),
      nothingWritten
        ? el("p", { class: "note" }, ctx.t.book.brief.noNotes)
        : null,
    ],
  });
}

