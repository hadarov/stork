import { MAX_MOMENTS, MAX_MOMENT_LABEL } from "../storage/repo.ts";
import type { Baby, Moment } from "./types.ts";

/*
 * The half of a baby's timeline that has no formula.
 *
 * Everything in derive.ts is worked out from one date: a hundred days, half a
 * year, a first birthday. A first tooth is not, and neither is the afternoon
 * they finally crossed the room, so those are typed in and kept here instead.
 */

/** Oldest first, the way the page reads it and the way storage keeps it. */
export function momentsOf(baby: Baby): Moment[] {
  return [...(baby.moments ?? [])].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * What was typed, as it will be stored. A moment is a line on a timeline, so a
 * pasted paragraph is folded onto one line rather than refused.
 */
export function tidyLabel(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_MOMENT_LABEL);
}

/**
 * Why a moment cannot be kept, as something a screen can look up rather than a
 * sentence, for the reason the photo reader gives: this file has no language.
 */
export type MomentProblem = "full" | "needLabel" | "needDate";

export function momentProblem(baby: Baby, label: string, date: string): MomentProblem | null {
  // First, because a full book is the one problem that typing cannot fix.
  if ((baby.moments?.length ?? 0) >= MAX_MOMENTS) return "full";
  if (!tidyLabel(label)) return "needLabel";
  if (!date) return "needDate";
  return null;
}

/** Case and spacing are not the difference between two names for one moment. */
function fold(label: string): string {
  return tidyLabel(label).toLowerCase();
}

/**
 * The common ones still worth offering. A first tooth happens once, so the list
 * stops suggesting it as soon as it has been written down.
 */
export function unusedSuggestions(baby: Baby, offered: readonly string[]): string[] {
  const taken = new Set((baby.moments ?? []).map((moment) => fold(moment.label)));
  return offered.filter((suggestion) => !taken.has(fold(suggestion)));
}
