/*
 * The arithmetic behind the date dropdowns. Kept out of the UI because "which
 * days does this month have" is exactly the sort of thing that is wrong for
 * four years and then wrong again in February.
 */

/*
 * The month names used to live here as a list of English words. They are now
 * asked of Intl in the language being read, so that the word the dropdown
 * offers is the same word the app writes back into a date.
 */

export type Parts = { year: number; month: number; day: number };

/** Month is 1-12, the way it is spoken rather than the way Date counts. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function splitISO(value: string): Parts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  return { year, month, day };
}

export function joinISO({ year, month, day }: Parts): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Which years to offer. A birthday is behind us, and reaches back far enough to
 * cover somebody who is plainly not a baby. A due date is this year or the next
 * two: an overdue bump is still this year, and nobody is expecting in 2031.
 */
export function yearsFor(range: "past" | "future", now: Date): number[] {
  const year = now.getFullYear();
  if (range === "future") return [year, year + 1, year + 2];

  return Array.from({ length: 61 }, (_, index) => year - index);
}

/**
 * Months and days are only narrowed for a birthday in the current month, since
 * nobody has been born tomorrow. A due date is left alone.
 */
export function monthsFor(range: "past" | "future", now: Date, year: number): number[] {
  const last = range === "past" && year === now.getFullYear() ? now.getMonth() + 1 : 12;
  return Array.from({ length: last }, (_, index) => index + 1);
}

export function daysFor(
  range: "past" | "future",
  now: Date,
  year: number,
  month: number,
): number[] {
  const thisMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const last =
    range === "past" && thisMonth ? now.getDate() : daysInMonth(year, month);
  return Array.from({ length: last }, (_, index) => index + 1);
}
