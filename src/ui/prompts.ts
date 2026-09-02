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
  const remove = async (): Promise<void> => {
    await ctx.repo.remove(baby.id);
    await ctx.refresh();
    ctx.toast(`${displayName(baby)} removed`);
    ctx.navigate("#/");
  };

  return popup({
    title: "Remove?",
    onClose: () => ctx.back(),
    body: [
      el(
        "p",
        {},
        `${displayName(baby)} will be taken out of your book, along with the dates and the photo.`,
      ),
      el("p", { class: "note" }, "There is no undo, but a backup you have already exported still has them."),
      el(
        "div",
        { class: "prompt-actions" },
        el(
          "button",
          { class: "primary danger-fill", type: "button", onclick: () => remove() },
          "Remove",
        ),
        el("button", { class: "quiet", type: "button", onclick: () => ctx.back() }, "Keep"),
      ),
    ],
  });
}

export function renderArrival(ctx: AppContext, baby: Baby): HTMLElement {
  const today = toISODate(ctx.now);
  // Almost always today, since this gets tapped the moment the news lands.
  let birthDate = today;

  const chosen = el("p", { class: "note" });
  const paintChosen = (): void => {
    chosen.textContent = birthDate
      ? `Born ${formatDate(parseDate(birthDate))}.`
      : "Pick the day they arrived.";
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
    ctx.toast(`\u{1F389} Welcome, ${displayName(arrived)}!`);
    ctx.navigate(`#/baby/${encodeURIComponent(baby.id)}`);
  };

  return popup({
    title: "They're here!",
    onClose: () => ctx.back(),
    body: [
      el("p", {}, `When did ${displayName(baby)} arrive?`),
      dateField({
        label: "Birthday",
        range: "past",
        value: today,
        now: ctx.now,
        onChange: (value) => {
          birthDate = value;
          paintChosen();
        },
      }),
      chosen,
      el(
        "div",
        { class: "prompt-actions" },
        el("button", { class: "primary", type: "button", onclick: () => arrive() }, "Yes, they're here"),
        el("button", { class: "quiet", type: "button", onclick: () => ctx.back() }, "Not yet"),
      ),
    ],
  });
}
