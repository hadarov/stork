import type { Nudge } from "../domain/nudges.ts";
import { idbGet, idbSet } from "./idb.ts";

/*
 * The handover point between the app and the service worker. The app writes a
 * finished list of reminders here whenever the book changes; the worker reads
 * it much later, decides nothing, and ticks off what it has said.
 */

export const PENDING_KEY = "nudges";
export const SAID_KEY = "nudgesSaid";

export function readNudges(): Promise<Nudge[] | null> {
  return idbGet<Nudge[]>(PENDING_KEY);
}

export function writeNudges(nudges: Nudge[]): Promise<void> {
  return idbSet(PENDING_KEY, nudges);
}

/** The ids the worker has already spoken, so nobody is told twice. */
export async function said(): Promise<string[]> {
  return (await idbGet<string[]>(SAID_KEY)) ?? [];
}

/**
 * Anything whose moment passed while the app was closed and the worker never
 * woke is marked as said rather than fired late, so opening the app after a
 * fortnight away does not set off a fortnight of alerts.
 */
export async function catchUp(nudges: Nudge[], now: Date): Promise<void> {
  const missed = nudges.filter((nudge) => nudge.at <= now.getTime()).map((nudge) => nudge.id);
  if (missed.length === 0) return;

  const already = await said();
  await idbSet(SAID_KEY, [...new Set([...already, ...missed])]);
}

/** Ids for reminders that no longer exist are dead weight. */
export async function forgetSaid(keep: Nudge[]): Promise<void> {
  const live = new Set(keep.map((nudge) => nudge.id));
  const trimmed = (await said()).filter((id) => live.has(id));
  await idbSet(SAID_KEY, trimmed);
}
