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

export function describeNudges(ability: NudgeAbility): NudgeStatus {
  if (!ability.canNotify) {
    return {
      line: "This browser will not show reminders at all.",
      action: null,
      fallback: true,
    };
  }

  if (ability.permission === "denied") {
    return {
      line: "You turned reminders down. Undoing that has to happen in your browser's settings for this site.",
      action: null,
      fallback: true,
    };
  }

  if (ability.permission === "default") {
    return {
      line: "A nudge a week before, and one on the morning itself.",
      action: "ask",
      fallback: false,
    };
  }

  if (ability.canWake) {
    return {
      line: "On. A week before and on the morning, whether or not Stork is open.",
      action: null,
      fallback: false,
    };
  }

  if (!ability.installed) {
    return {
      line: "On, but only while Stork is open. Add it to your home screen and it can reach you properly.",
      action: "install",
      fallback: true,
    };
  }

  return {
    line: "On, but this browser only checks when you open Stork, so a reminder can arrive late. The calendar export is the dependable one.",
    action: null,
    fallback: true,
  };
}
