/*
 * An honest account of what this particular browser will actually do, which
 * varies more than anyone would like.
 *
 * A reminder that arrives while the app is closed needs the browser to wake the
 * service worker on a schedule. Chromium does that through Periodic Background
 * Sync, and only for an installed app. Safari does not do it at all: its push
 * support needs a server pushing to it, and there is no server here. Saying so
 * plainly is better than promising a nudge that never comes.
 */

import type { Catalog } from "../i18n/en.ts";

export type NudgeAbility = {
  /** Whether the browser has the Notification API at all. */
  canNotify: boolean;
  /** Whether the browser will wake us up on its own. */
  canWake: boolean;
  /** Whether the app is running from the home screen rather than a tab. */
  installed: boolean;
  permission: "default" | "granted" | "denied";
};

export type NudgeStatus = {
  line: string;
  /** What the button, if there is one, should say. */
  action: "ask" | "install" | null;
  /** Whether to keep pointing at the calendar export instead. */
  fallback: boolean;
};

export function describeNudges(ability: NudgeAbility, t: Catalog): NudgeStatus {
  const words = t.settings.nudges;

  if (!ability.canNotify) {
    return { line: words.cannot, action: null, fallback: true };
  }

  if (ability.permission === "denied") {
    return { line: words.refused, action: null, fallback: true };
  }

  if (ability.permission === "default") {
    return { line: words.offer, action: "ask", fallback: false };
  }

  if (ability.canWake) {
    return { line: words.onProperly, action: null, fallback: false };
  }

  if (!ability.installed) {
    return { line: words.onlyOpen, action: "install", fallback: true };
  }

  return { line: words.onlyOnLaunch, action: null, fallback: true };
}
