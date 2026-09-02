import {
  daysFor,
  joinISO,
  MONTHS,
  monthsFor,
  splitISO,
  yearsFor,
  type Parts,
} from "../domain/calendar.ts";
import { el } from "./dom.ts";

/*
 * Three dropdowns instead of an <input type="date">.
 *
 * The native control is a different thing on every platform - a spinner, a
 * calendar, three unlabelled boxes - and none of them can be styled or made to
 * look like the rest of this. Three selects are the same everywhere, and the
 * lists can be narrowed so an impossible date cannot be picked at all: no 31st
 * of February, and no birthday next week.
 *
 * A part left blank means no date, which the form treats as "not answered"
 * rather than as an error.
 */

export type DateFieldOptions = {
  label: string;
  value: string;
  now: Date;
  /** A birthday is behind us; a due date is mostly ahead. */
  range: "past" | "future";
  hint?: string;
  onChange: (value: string) => void;
};

type Draft = { year: number | null; month: number | null; day: number | null };

function option(value: string, text: string, selected: boolean): HTMLElement {
  return el("option", { value, ...(selected ? { selected: "selected" } : {}) }, text);
}

export function dateField(options: DateFieldOptions): HTMLElement {
  const existing: Parts | null = splitISO(options.value);
  const draft: Draft = existing
    ? { ...existing }
    : { year: null, month: null, day: null };

  const select = (what: string) =>
    el("select", {
      class: "date-select",
      "aria-label": `${what} of ${options.label}`,
      onchange: () => onPick(),
    });

  const day = select("Day");
  const month = select("Month");
  const year = select("Year");

  const part = (control: HTMLElement) => el("span", { class: "date-part" }, control);

  /** A whole date or nothing; a half-filled one is not worth reporting. */
  const report = (): void => {
    const { year: y, month: m, day: d } = draft;
    options.onChange(y && m && d ? joinISO({ year: y, month: m, day: d }) : "");
  };

  const paint = (): void => {
    const now = options.now;

    year.replaceChildren(
      option("", "Year", draft.year === null),
      ...yearsFor(options.range, now).map((value) =>
        option(String(value), String(value), draft.year === value),
      ),
    );

    // Until a year is chosen there is nothing to narrow by, so offer all twelve
    // and every day the longest month could have.
    const forYear = draft.year ?? now.getFullYear();
    const allowedMonths = draft.year ? monthsFor(options.range, now, forYear) : range12();
    month.replaceChildren(
      option("", "Month", draft.month === null),
      ...allowedMonths.map((value) =>
        option(String(value), MONTHS[value - 1]!, draft.month === value),
      ),
    );

    const allowedDays =
      draft.year && draft.month
        ? daysFor(options.range, now, forYear, draft.month)
        : range31();
    day.replaceChildren(
      option("", "Day", draft.day === null),
      ...allowedDays.map((value) =>
        option(String(value), String(value), draft.day === value),
      ),
    );

    for (const control of [day, month, year]) {
      control.classList.toggle("empty", control.value === "");
    }
  };

  const read = (control: HTMLSelectElement): number | null =>
    control.value === "" ? null : Number(control.value);

  const onPick = (): void => {
    draft.year = read(year);
    draft.month = read(month);
    draft.day = read(day);

    // Changing February to the 30th, or a leap year to a common one, has to
    // drop the day rather than quietly keep an impossible one.
    if (draft.year && draft.month) {
      const allowed = daysFor(options.range, options.now, draft.year, draft.month);
      if (draft.day && !allowed.includes(draft.day)) draft.day = null;
    }
    if (draft.year && draft.month && !monthsFor(options.range, options.now, draft.year).includes(draft.month)) {
      draft.month = null;
      draft.day = null;
    }

    paint();
    report();
  };

  paint();

  return el(
    "div",
    { class: "field" },
    el("span", { class: "field-label" }, options.label),
    el("div", { class: "date-field" }, part(day), part(month), part(year)),
    options.hint ? el("span", { class: "field-hint" }, options.hint) : null,
  );
}

function range12(): number[] {
  return Array.from({ length: 12 }, (_, index) => index + 1);
}

function range31(): number[] {
  return Array.from({ length: 31 }, (_, index) => index + 1);
}

