import { displayName, formatDate, parseDate, toISODate } from "../domain/derive.ts";
import type { Baby } from "../domain/types.ts";
import type { AppContext } from "./context.ts";
import { dateField } from "./dateField.ts";
import { el } from "./dom.ts";
import { popup } from "./modal.ts";

/**
 * Both of these stack over the baby's own page rather than replacing it, so
 * backing out of one leaves you looking at the baby you were already reading.
 */

export function renderRemoveConfirm(ctx: AppContext, baby: Baby): HTMLElement {
  const t = ctx.t;

  const remove = async (): Promise<void> => {
    await ctx.repo.remove(baby.id);
    await ctx.refresh();
    ctx.toast(t.form.prompt.removed(displayName(baby, t)));
    // Back to the grid, past their own page: it has nothing left to show.
    ctx.finish("#/");
  };

  return popup({
    title: t.form.prompt.removeTitle,
    onClose: () => ctx.back(),
    body: [
      el("p", {}, t.form.prompt.removeBody(displayName(baby, t))),
      el("p", { class: "note" }, t.form.prompt.removeNote),
      el(
        "div",
        { class: "prompt-actions" },
        el(
          "button",
          { class: "primary danger-fill", type: "button", onclick: () => remove() },
          t.form.prompt.removeConfirm,
        ),
        el(
          "button",
          { class: "quiet", type: "button", onclick: () => ctx.back() },
          t.form.prompt.removeCancel,
        ),
      ),
    ],
  });
}

export function renderArrival(ctx: AppContext, baby: Baby): HTMLElement {
  const t = ctx.t;
  const today = toISODate(ctx.now);
  // Almost always today, since this gets tapped the moment the news lands.
  let birthDate = today;

  const chosen = el("p", { class: "note" });
  const paintChosen = (): void => {
    chosen.textContent = birthDate
      ? t.form.prompt.born(formatDate(parseDate(birthDate), t))
      : t.form.prompt.pickDay;
  };
  paintChosen();

  const arrive = async (): Promise<void> => {
    if (!birthDate) return;
    const arrived: Baby = {
      ...baby,
      status: "born",
      birthDate,
      updatedAt: new Date().toISOString(),
    };
    // A baby has a birthday, not a due date.
    delete arrived.dueDate;

    await ctx.repo.save(arrived);
    await ctx.refresh();
    ctx.toast(t.form.prompt.welcome(displayName(arrived, t), arrived.sex));
    ctx.finish(`#/baby/${encodeURIComponent(baby.id)}`);
  };

  return popup({
    title: t.form.prompt.arrivedTitle,
    onClose: () => ctx.back(),
    body: [
      el("p", {}, t.form.prompt.arrivedAsk(displayName(baby, t), baby.sex)),
      dateField({
        label: t.form.edit.birthday,
        range: "past",
        value: today,
        now: ctx.now,
        t,
        onChange: (value) => {
          birthDate = value;
          paintChosen();
        },
      }),
      chosen,
      el(
        "div",
        { class: "prompt-actions" },
        el(
          "button",
          { class: "primary", type: "button", onclick: () => arrive() },
          t.form.prompt.arrivedConfirm,
        ),
        el(
          "button",
          { class: "quiet", type: "button", onclick: () => ctx.back() },
          t.form.prompt.arrivedCancel,
        ),
      ),
    ],
  });
}
