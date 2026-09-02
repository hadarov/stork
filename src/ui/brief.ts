import {
  describeAge,
  describeParents,
  displayName,
  dueCountdown,
  formatDate,
  nextEvent,
  parseDate,
} from "../domain/derive.ts";
import { families, familyOf, type Family } from "../domain/family.ts";
import type { Baby } from "../domain/types.ts";
import { avatar } from "./components.ts";
import type { AppContext } from "./context.ts";
import { el } from "./dom.ts";
import { popup } from "./modal.ts";

/*
 * The point of the whole app, on one screen: you are about to see these people
 * and you have thirty seconds in the car to remember who is who. Everything
 * here is something you would be embarrassed not to know, and nothing here is
 * a birthstone.
 */

/** Days after which not having sent anything is worth saying out loud. */
const GRACE_DAYS = 30;

function soonest(family: Family, now: Date) {
  return family.babies
    .map((baby) => ({ baby, event: nextEvent(baby, now) }))
    .filter((entry) => entry.event !== null)
    .sort((a, b) => a.event!.daysUntil - b.event!.daysUntil)[0];
}

function howOld(baby: Baby, now: Date): string {
  if (baby.status === "born" && baby.birthDate) return describeAge(baby.birthDate, now).label;
  return baby.dueDate ? dueCountdown(baby.dueDate, now).label : "on the way";
}

/** The gift, said the way you would want to be told. */
function giftLine(baby: Baby, now: Date): string {
  if (baby.giftSent) return "\u2713 You sent something";
  if (baby.status !== "born" || !baby.birthDate) return "Nothing sent yet";

  const age = describeAge(baby.birthDate, now);
  return age.days > GRACE_DAYS
    ? `\u2717 Nothing sent, and they are ${age.label}`
    : "Nothing sent yet";
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
    avatar(baby, "sm"),
    el(
      "span",
      { class: "brief-text" },
      el("span", { class: "brief-name" }, displayName(baby)),
      el("span", { class: "brief-age" }, howOld(baby, ctx.now)),
      born
        ? el("span", { class: "brief-meta" }, `Born ${formatDate(parseDate(baby.birthDate!))}`)
        : null,
      el(
        "span",
        { class: baby.giftSent ? "brief-gift done" : "brief-gift" },
        giftLine(baby, ctx.now),
      ),
      baby.notes ? el("span", { class: "brief-note" }, baby.notes) : null,
    ),
  );
}

export function renderBrief(ctx: AppContext, baby: Baby): HTMLElement {
  const family = familyOf(baby, ctx.babies);
  const next = soonest(family, ctx.now);

  const nothingWritten = family.babies.every((one) => !one.notes);

  return popup({
    title: describeParents(family.parents) || displayName(baby),
    wide: true,
    onClose: () => ctx.back(),
    body: [
      next
        ? el(
            "div",
            { class: "hero-stat" },
            el(
              "span",
              { class: "hero-number" },
              `${next.event!.emoji} ${displayName(next.baby)}`,
            ),
            el("span", { class: "hero-sub" }, next.event!.label),
          )
        : el(
            "div",
            { class: "hero-stat" },
            el("span", { class: "hero-number" }, "Nothing imminent"),
            el("span", { class: "hero-sub" }, "Which is its own kind of good news."),
          ),
      el("section", { class: "panel" }, ...family.babies.map((one) => card(one, ctx))),
      nothingWritten
        ? el(
            "p",
            { class: "note" },
            "You have written nothing down about any of them. Whatever you learn tonight, put it in their notes before you forget it.",
          )
        : null,
    ],
  });
}

/** Everyone you might be about to see, soonest thing first. */
export function renderWho(ctx: AppContext): HTMLElement {
  const rows = families(ctx.babies)
    .map((family) => ({ family, next: soonest(family, ctx.now) }))
    .sort((a, b) => (a.next?.event?.daysUntil ?? 1e9) - (b.next?.event?.daysUntil ?? 1e9));

  return popup({
    title: "Who are you seeing?",
    onClose: () => ctx.back(),
    body:
      rows.length === 0
        ? [
            el(
              "p",
              { class: "note" },
              "Nobody yet. Add a baby and say whose it is, and they will show up here.",
            ),
          ]
        : rows.map(({ family, next }) =>
            el(
              "button",
              {
                class: "who-row",
                type: "button",
                onclick: () =>
                  ctx.navigate(`#/brief/${encodeURIComponent(family.babies[0]!.id)}`),
              },
              el(
                "span",
                { class: "who-faces" },
                ...family.babies.slice(0, 3).map((one) => avatar(one, "sm")),
              ),
              el(
                "span",
                { class: "who-text" },
                el("span", { class: "who-name" }, describeParents(family.parents)),
                el(
                  "span",
                  { class: "who-meta" },
                  next
                    ? `${next.event!.emoji} ${displayName(next.baby)} \u00b7 ${next.event!.label}`
                    : family.babies.map((one) => displayName(one)).join(", "),
                ),
              ),
            ),
          ),
  });
}
