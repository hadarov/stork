import { describeParents, displayName } from "../domain/derive.ts";
import { join, relation, separate, siblingsOf, whySiblings } from "../domain/family.ts";
import type { Baby } from "../domain/types.ts";
import { avatar } from "./components.ts";
import type { AppContext } from "./context.ts";
import { el } from "./dom.ts";
import { popup } from "./modal.ts";

/*
 * The app reads families out of the parents' names, which is right almost
 * always and wrong in two directions: two different friends called Sarah come
 * out as one household, and a couple typed as Dave one time and David the next
 * come out as two. Neither is something a person can fix by trying harder to
 * remember how they typed it, so this is where they say so instead.
 */

/** Past this many to choose from, picking one out of a list stops working. */
const SEARCH_AFTER = 6;

function fits(baby: Baby, needle: string, ctx: AppContext): boolean {
  if (!needle) return true;
  return [displayName(baby, ctx.t), ...baby.parents]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export function renderFamilyFix(ctx: AppContext, baby: Baby): HTMLElement {
  const t = ctx.t;
  const words = t.book.fixFamily;

  const save = async (pair: [Baby, Baby], said: string): Promise<void> => {
    for (const record of pair) await ctx.repo.save(record);
    await ctx.refresh();
    ctx.toast(said);
    // The lists on this screen are the thing that just changed, and nothing
    // has navigated, so they have to be drawn again where they stand.
    ctx.redraw();
  };

  function row(other: Baby, meta: string, action: HTMLElement): HTMLElement {
    return el(
      "div",
      { class: "family-row" },
      avatar(other, ctx.now, t, "sm"),
      el(
        "span",
        { class: "sibling-text" },
        el("span", { class: "sibling-name", dir: "auto" }, displayName(other, t)),
        el("span", { class: "sibling-meta", dir: "auto" }, meta),
      ),
      action,
    );
  }

  const family = siblingsOf(baby, ctx.babies).map((sibling) =>
    row(
      sibling,
      words.becauseOf(
        relation(baby, sibling, t),
        whySiblings(baby, sibling) === "told" ? words.youSaidSo : words.fromTheNames,
      ),
      el(
        "button",
        {
          class: "quiet family-row-action",
          type: "button",
          onclick: () =>
            save(separate(baby, sibling, new Date()), words.nowApart(displayName(sibling, t))),
        },
        words.notRelated,
      ),
    ),
  );

  const strangers = ctx.babies.filter(
    (other) => other.id !== baby.id && !siblingsOf(baby, ctx.babies).some((s) => s.id === other.id),
  );

  const list = el("div", { class: "family-list" });
  let query = "";

  function paint(): void {
    const showing = strangers.filter((other) => fits(other, query, ctx));
    list.replaceChildren(
      ...(showing.length === 0
        ? [el("p", { class: "note" }, query ? words.noMatch : words.nobodyElse)]
        : showing.map((other) =>
            row(
              other,
              describeParents(other.parents, t) || words.noParents,
              el(
                "button",
                {
                  class: "secondary family-row-action",
                  type: "button",
                  onclick: () =>
                    save(
                      join(baby, other, new Date()),
                      words.nowTogether(displayName(other, t)),
                    ),
                },
                words.sameFamily,
              ),
            ),
          )),
    );
  }

  paint();

  return popup({
    title: words.title,
    closeLabel: t.app.close,
    onClose: () => ctx.back(),
    body: [
      el("p", { class: "note" }, words.intro),
      family.length > 0
        ? el(
            "section",
            { class: "panel" },
            el("h2", { class: "section-title" }, words.inThisFamily),
            ...family,
          )
        : null,
      el(
        "section",
        { class: "panel" },
        el("h2", { class: "section-title" }, words.somebodyElse),
        strangers.length > SEARCH_AFTER
          ? el("input", {
              class: "search",
              type: "search",
              placeholder: words.searchPlaceholder,
              "aria-label": words.searchLabel,
              oninput: (event: Event) => {
                query = (event.target as HTMLInputElement).value.trim().toLowerCase();
                paint();
              },
            })
          : null,
        list,
      ),
    ],
  });
}
