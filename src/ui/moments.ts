import { formatDate, parseDate } from "../domain/derive.ts";
import { momentProblem, momentsOf, tidyLabel, unusedSuggestions } from "../domain/moments.ts";
import type { Baby, Moment } from "../domain/types.ts";
import { MAX_MOMENTS, newId } from "../storage/repo.ts";
import type { AppContext } from "./context.ts";
import { dateField } from "./dateField.ts";
import { el } from "./dom.ts";

async function persist(ctx: AppContext, baby: Baby): Promise<void> {
  await ctx.repo.save({ ...baby, updatedAt: new Date().toISOString() });
  await ctx.refresh();
}

/**
 * The firsts with no formula, under the milestones that have one. The form is
 * folded away until it is asked for, because the page is mostly for reading
 * and a baby gets a first tooth once.
 */
export function momentsSection(baby: Baby, ctx: AppContext): HTMLElement {
  const words = ctx.t.baby.moments;
  const noted = momentsOf(baby);
  const draft = { label: "", date: "" };

  const labelInput = el("input", {
    class: "input",
    placeholder: words.whatHint,
    // Typed, so it reads in its own direction rather than the interface's.
    dir: "auto",
    oninput: (event: Event) => {
      draft.label = (event.target as HTMLInputElement).value;
    },
  });

  const keep = async (): Promise<void> => {
    const problem = momentProblem(baby, draft.label, draft.date);
    if (problem) {
      ctx.toast(problem === "full" ? words.full(MAX_MOMENTS) : words[problem]);
      return;
    }

    const moment: Moment = { id: newId(), label: tidyLabel(draft.label), date: draft.date };
    await persist(ctx, { ...baby, moments: [...(baby.moments ?? []), moment] });
    ctx.toast(words.added);
    // Stays on the page, so the line has to be told to grow.
    ctx.redraw();
  };

  const remove = async (moment: Moment): Promise<void> => {
    const rest = (baby.moments ?? []).filter((candidate) => candidate.id !== moment.id);
    await persist(ctx, { ...baby, moments: rest });
    ctx.toast(words.removed);
    ctx.redraw();
  };

  const suggestions = unusedSuggestions(baby, words.common);

  const form = el(
    "div",
    { class: "field-group", hidden: true },
    el("label", { class: "field" }, el("span", { class: "field-label" }, words.what), labelInput),
    // Everything here can still be typed; these only save the typing on the
    // ones nearly every baby gets, and each drops out once it has been used.
    suggestions.length > 0
      ? el(
          "div",
          { class: "field" },
          el("span", { class: "field-label" }, words.orOneOfThese),
          el(
            "div",
            { class: "suggestions" },
            ...suggestions.map((text) =>
              el(
                "button",
                {
                  class: "chip suggestion",
                  type: "button",
                  onclick: () => {
                    draft.label = text;
                    labelInput.value = text;
                  },
                },
                text,
              ),
            ),
          ),
        )
      : null,
    dateField({
      label: words.when,
      range: "past",
      value: "",
      now: ctx.now,
      t: ctx.t,
      onChange: (date) => {
        draft.date = date;
      },
    }),
    el(
      "div",
      { class: "form-actions" },
      el("button", { class: "primary", type: "button", onclick: () => keep() }, words.save),
      el("button", { class: "quiet", type: "button", onclick: () => show(false) }, words.cancel),
    ),
  );

  const opener = el(
    "button",
    { class: "secondary", type: "button", onclick: () => show(true) },
    words.add,
  );

  const show = (open: boolean): void => {
    form.hidden = !open;
    opener.hidden = open;
  };

  return el(
    "section",
    { class: "panel" },
    el("h2", { class: "section-title" }, words.section),
    el(
      "div",
      { class: "moments" },
      noted.length > 0
        ? el(
            "ol",
            { class: "timeline" },
            ...noted.map((moment) =>
              el(
                "li",
                // Nothing here is a forecast: it happened, or it would not have
                // been written down.
                { class: "timeline-item done moment" },
                el("span", { class: "timeline-dot", "aria-hidden": "true" }),
                el(
                  "span",
                  { class: "moment-text" },
                  el("span", { class: "timeline-label", dir: "auto" }, moment.label),
                  el("span", { class: "timeline-when" }, formatDate(parseDate(moment.date), ctx.t)),
                ),
                el(
                  "button",
                  {
                    class: "moment-remove",
                    type: "button",
                    "aria-label": words.remove(moment.label),
                    onclick: () => remove(moment),
                  },
                  "\u00D7",
                ),
              ),
            ),
          )
        : el("p", { class: "note" }, words.empty),
      opener,
      form,
    ),
  );
}
