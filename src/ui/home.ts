import {
  describeAge,
  describeParents,
  displayName,
  dueCountdown,
  nextEvent,
  sortByNextEvent,
} from "../domain/derive.ts";
import type { Baby } from "../domain/types.ts";
import { avatar, emptyState, iconButton, screenHeader } from "./components.ts";
import type { AppContext } from "./context.ts";
import { el } from "./dom.ts";

/** How far ahead the strip at the top looks. */
const HORIZON_DAYS = 7;

function matches(baby: Baby, needle: string): boolean {
  if (!needle) return true;
  const haystack = [displayName(baby), ...baby.parents, baby.notes ?? ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

/** The one-line summary under a name on a card. */
function statusLine(baby: Baby, now: Date): string {
  if (baby.status === "expecting") {
    if (!baby.dueDate) return "on the way";
    const due = dueCountdown(baby.dueDate, now);
    return `${due.label} \u00b7 week ${due.week}`;
  }
  return baby.birthDate ? describeAge(baby.birthDate, now).label : "here";
}

function babyCard(baby: Baby, ctx: AppContext): HTMLElement {
  const event = nextEvent(baby, ctx.now);
  const parents = describeParents(baby.parents);

  return el(
    "button",
    {
      class: "card baby-card",
      type: "button",
      onclick: () => ctx.navigate(`#/baby/${encodeURIComponent(baby.id)}`),
    },
    avatar(baby),
    el(
      "span",
      { class: "baby-card-text" },
      el("span", { class: "baby-card-name" }, displayName(baby)),
      parents ? el("span", { class: "baby-card-parents" }, parents) : null,
      el("span", { class: "baby-card-status" }, statusLine(baby, ctx.now)),
    ),
    event && event.daysUntil <= HORIZON_DAYS
      ? el("span", { class: "baby-card-flag" }, event.emoji)
      : null,
  );
}

/**
 * The whole reason the app exists: what is happening in the next week, before
 * anything else on the screen.
 */
function thisWeek(babies: Baby[], ctx: AppContext): HTMLElement | null {
  const soon = babies
    .map((baby) => ({ baby, event: nextEvent(baby, ctx.now) }))
    .filter((entry) => entry.event !== null && entry.event.daysUntil <= HORIZON_DAYS)
    .sort((a, b) => a.event!.daysUntil - b.event!.daysUntil);

  if (soon.length === 0) return null;

  return el(
    "section",
    { class: "week" },
    el("h2", { class: "section-title" }, "This week"),
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
          el("span", { class: "week-name" }, displayName(baby)),
          el("span", { class: "week-when" }, event!.label),
        ),
      ),
    ),
  );
}

function group(title: string, babies: Baby[], ctx: AppContext): HTMLElement | null {
  if (babies.length === 0) return null;
  return el(
    "section",
    { class: "group" },
    el(
      "h2",
      { class: "section-title" },
      title,
      el("span", { class: "section-count" }, String(babies.length)),
    ),
    el("div", { class: "stack" }, ...babies.map((baby) => babyCard(baby, ctx))),
  );
}

export function renderHome(ctx: AppContext): HTMLElement {
  const header = screenHeader("Stork", {
    actions: [
      iconButton("Settings", "\u2699", () => ctx.navigate("#/settings")),
      iconButton("Add a baby", "\uFF0B", () => ctx.navigate("#/add")),
    ],
  });

  const results = el("div", { class: "results" });
  // Scoped to this render, so leaving the screen clears the search rather than
  // greeting you with a filtered list the next time you open the book.
  let query = "";

  const search = el("input", {
    class: "search",
    type: "search",
    placeholder: "Search a name or a friend",
    value: query,
    "aria-label": "Search",
    oninput: (event: Event) => {
      query = (event.target as HTMLInputElement).value.trim().toLowerCase();
      paint();
    },
  });

  function paint(): void {
    const visible = ctx.babies.filter((baby) => matches(baby, query));
    const expecting = sortByNextEvent(
      visible.filter((baby) => baby.status === "expecting"),
      ctx.now,
    );
    const born = sortByNextEvent(
      visible.filter((baby) => baby.status === "born"),
      ctx.now,
    );

    const children: (HTMLElement | null)[] = [];
    if (!query) children.push(thisWeek(ctx.babies, ctx));
    children.push(group("On the way", expecting, ctx));
    children.push(group("Little ones", born, ctx));

    const anything = children.some((child) => child !== null);
    results.replaceChildren(
      ...(anything
        ? (children.filter(Boolean) as HTMLElement[])
        : [
            query
              ? emptyState("Nobody by that name", "Try a parent's name instead.")
              : emptyState(
                  "No babies yet",
                  "Add the first one and Stork will keep track of the dates for you.",
                  el(
                    "button",
                    { class: "primary", type: "button", onclick: () => ctx.navigate("#/add") },
                    "Add a baby",
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
    el("div", { class: "content" }, ctx.babies.length > 0 ? search : null, results),
  );
}
