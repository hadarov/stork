import {
  describeAge,
  displayName,
  dueCountdown,
  nextEvent,
  sortByNextEvent,
} from "../domain/derive.ts";
import type { Baby } from "../domain/types.ts";
import { offerOnHome } from "../domain/install.ts";
import type { Catalog } from "../i18n/en.ts";
import { backupCard } from "./backupCard.ts";
import { emptyState, iconButton, screenHeader, tile } from "./components.ts";
import type { AppContext } from "./context.ts";
import { el } from "./dom.ts";
import { installCard } from "./installCard.ts";
import { ability } from "./installer.ts";

/** How far ahead the strip at the top looks. */
const HORIZON_DAYS = 7;

function matches(baby: Baby, needle: string, t: Catalog): boolean {
  if (!needle) return true;
  const haystack = [displayName(baby, t), ...baby.parents, baby.notes ?? ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

/** The two or three characters that fit under a name in the grid. */
function shortStatus(baby: Baby, now: Date, t: Catalog): string {
  if (baby.status === "expecting") {
    return baby.dueDate ? dueCountdown(baby.dueDate, now, t).short : t.age.shortSoon;
  }
  return baby.birthDate
    ? describeAge(baby.birthDate, now, t, baby.sex).short
    : t.book.home.shortHere;
}

function grid(title: string, babies: Baby[], ctx: AppContext): HTMLElement | null {
  if (babies.length === 0) return null;

  return el(
    "section",
    { class: "group" },
    el("h2", { class: "section-title" }, title),
    el(
      "div",
      { class: "grid" },
      ...babies.map((baby) => {
        const event = nextEvent(baby, ctx.now, ctx.t);
        return tile(baby, ctx.now, ctx.t, {
          sub: shortStatus(baby, ctx.now, ctx.t),
          badge: event && event.daysUntil <= HORIZON_DAYS ? event.emoji : undefined,
          onOpen: () => ctx.navigate(`#/baby/${encodeURIComponent(baby.id)}`),
        });
      }),
    ),
  );
}

/**
 * The whole reason the app exists: what is happening in the next week, before
 * anything else on the screen.
 */
function thisWeek(babies: Baby[], ctx: AppContext): HTMLElement | null {
  const soon = babies
    .map((baby) => ({ baby, event: nextEvent(baby, ctx.now, ctx.t) }))
    .filter((entry) => entry.event !== null && entry.event.daysUntil <= HORIZON_DAYS)
    .sort((a, b) => a.event!.daysUntil - b.event!.daysUntil);

  if (soon.length === 0) return null;

  return el(
    "section",
    { class: "week" },
    el("h2", { class: "section-title" }, ctx.t.book.home.thisWeek),
    el(
      "div",
      { class: "week-strip" },
      ...soon.map(({ baby, event }) =>
        el(
          "button",
          {
            class: "week-item",
            type: "button",
            onclick: () => ctx.navigate(`#/baby/${encodeURIComponent(baby.id)}`),
          },
          el("span", { class: "week-emoji", "aria-hidden": "true" }, event!.emoji),
          el("span", { class: "week-name", dir: "auto" }, displayName(baby, ctx.t)),
          el("span", { class: "week-when" }, event!.label),
        ),
      ),
    ),
  );
}

export function renderHome(ctx: AppContext): HTMLElement {
  const home = ctx.t.book.home;

  const header = screenHeader(home.title, {
    mark: true,
    actions: [
      iconButton(home.settings, "\u2699", () => ctx.navigate("#/settings")),
      iconButton(home.add, "\uFF0B", () => ctx.navigate("#/add")),
    ],
  });

  const results = el("div", { class: "results" });
  // Scoped to this render, so leaving the screen clears the search rather than
  // greeting you with a filtered list the next time you open the book.
  let query = "";

  const search = el("input", {
    class: "search",
    type: "search",
    placeholder: home.searchPlaceholder,
    value: query,
    "aria-label": home.searchLabel,
    oninput: (event: Event) => {
      query = (event.target as HTMLInputElement).value.trim().toLowerCase();
      paint();
    },
  });

  function paint(): void {
    const visible = ctx.babies.filter((baby) => matches(baby, query, ctx.t));
    const expecting = sortByNextEvent(
      visible.filter((baby) => baby.status === "expecting"),
      ctx.now,
      ctx.t,
    );
    const born = sortByNextEvent(
      visible.filter((baby) => baby.status === "born"),
      ctx.now,
      ctx.t,
    );

    const children: (HTMLElement | null)[] = [];
    if (!query) children.push(thisWeek(ctx.babies, ctx));
    children.push(grid(home.expecting, expecting, ctx));
    children.push(grid(home.born, born, ctx));

    const anything = children.some((child) => child !== null);
    results.replaceChildren(
      ...(anything
        ? (children.filter(Boolean) as HTMLElement[])
        : [
            query
              ? emptyState(home.noMatchTitle, home.noMatchBody)
              : emptyState(
                  home.emptyTitle,
                  home.emptyBody,
                  el(
                    "button",
                    { class: "primary", type: "button", onclick: () => ctx.navigate("#/add") },
                    home.add,
                  ),
                ),
          ]),
    );
  }

  paint();

  return el(
    "div",
    { class: "screen" },
    header,
    el(
      "div",
      { class: "content" },
      ctx.babies.length > 0 ? search : null,
      results,
      // Under the grid rather than over it: an app you have not been sold on
      // yet should still show you the babies first. One thing asked at a time,
      // and a book nobody has a copy of is the worse of the two problems.
      backupCard(ctx) ?? installCard(ctx, offerOnHome(ability(), ctx.t), { closeable: true }),
    ),
  );
}
