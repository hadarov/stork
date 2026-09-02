import { displayName, nextEvent } from "./derive.ts";
import type { Baby } from "./types.ts";

/*
 * What to say and when to say it, worked out here rather than in the service
 * worker. The worker wakes up rarely, at a time the browser chooses, with no
 * access to any of this logic - so it gets handed a finished list of lines and
 * timestamps and has nothing to do but read the clock.
 */

export type Nudge = {
  /** Stable for a given baby and occasion, so a repeat is easy to spot. */
  id: string;
  /** When to say it, in epoch milliseconds. */
  at: number;
  title: string;
  body: string;
};

/** A week's warning is enough to actually buy something and post it. */
const LEAD_DAYS = 7;

/** Nine in the morning, not the middle of the night. */
const HOUR = 9;

/** Far enough ahead to survive a browser that only wakes up once a fortnight. */
const HORIZON_DAYS = 90;

const DAY = 24 * 60 * 60 * 1000;

function morningOf(date: Date, daysEarlier: number): number {
  const when = new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysEarlier);
  when.setHours(HOUR, 0, 0, 0);
  return when.getTime();
}

function lines(baby: Baby, kind: string, daysEarlier: number): { title: string; body: string } {
  const name = displayName(baby);

  if (kind === "due") {
    return daysEarlier === 0
      ? { title: `${name} is due today`, body: "Today would be a good day to check in." }
      : { title: `${name} is due next week`, body: "A week's warning, so you have no excuse." };
  }

  if (kind === "birthday") {
    return daysEarlier === 0
      ? { title: `${name}'s birthday is today`, body: "Say something before the day runs out." }
      : { title: `${name}'s birthday is in a week`, body: "Long enough to order something." };
  }

  return daysEarlier === 0
    ? { title: `${name} has a big day`, body: "Worth a message." }
    : { title: `${name} has a big day next week`, body: "Consider yourself warned." };
}

/**
 * Every reminder due between now and the horizon: a week's warning, and one on
 * the morning itself. Anything already in the past is left out, so a phone that
 * has been asleep for a month does not wake up and fire off ten stale nudges.
 */
export function nudgesFor(babies: Baby[], now: Date): Nudge[] {
  const found: Nudge[] = [];

  for (const baby of babies) {
    const event = nextEvent(baby, now);
    if (!event || event.daysUntil > HORIZON_DAYS) continue;

    // "Arrived today" is news you already have; there is nothing to warn about.
    if (event.kind === "arrival") continue;

    for (const daysEarlier of [LEAD_DAYS, 0]) {
      const at = morningOf(event.date, daysEarlier);
      if (at <= now.getTime()) continue;

      const { title, body } = lines(baby, event.kind, daysEarlier);
      found.push({
        id: `${baby.id}:${event.date.toISOString().slice(0, 10)}:${daysEarlier}`,
        at,
        title,
        body,
      });
    }
  }

  return found.sort((a, b) => a.at - b.at);
}

/** Reminders that have come and gone, so the stored list does not grow forever. */
export function pruneNudges(nudges: Nudge[], now: Date): Nudge[] {
  return nudges.filter((nudge) => nudge.at > now.getTime() - DAY);
}
