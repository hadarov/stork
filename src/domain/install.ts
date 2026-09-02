/*
 * What this browser will let you do about installing, which is three different
 * answers wearing the same coat.
 *
 * Chromium decides for itself that an app is worth keeping and hands over a
 * prompt, which can be fired on a tap and looks like a real install. Safari on
 * iOS never offers one and never will, but Add to Home Screen is sitting in the
 * share sheet, so the only useful thing to do is point at it. Everything else -
 * a desktop Firefox, a browser part way through making up its mind - can
 * install nothing on demand, and inventing steps for it would send people
 * hunting for a button that is not there.
 *
 * Same shape as nudgeStatus.ts, and for the same reason: say what this browser
 * will really do rather than what the feature is called.
 */

export type InstallAbility = {
  /** Already opened from the home screen rather than in a tab. */
  installed: boolean;
  /** The browser handed over a prompt that we are allowed to fire later. */
  canPrompt: boolean;
  /** iOS, where installing is real but has to be done by hand. */
  byHand: boolean;
  /** The strip on the home screen has been waved away before. */
  dismissed: boolean;
};

export type InstallOffer =
  | { kind: "none" }
  | { kind: "button"; title: string; line: string; label: string }
  | { kind: "steps"; title: string; line: string; steps: string[] };

const TITLE = "Keep Stork on your home screen";

// Worth saying rather than assumed: people install things they understand the
// point of, and "works with no signal" is the part that is not obvious.
const LINE =
  "It gets its own icon, opens without the address bar, and keeps working with no signal.";

export function describeInstall(ability: InstallAbility): InstallOffer {
  if (ability.installed) return { kind: "none" };

  if (ability.canPrompt) {
    return { kind: "button", title: TITLE, line: LINE, label: "Install Stork" };
  }

  if (ability.byHand) {
    return {
      kind: "steps",
      title: TITLE,
      line: LINE,
      steps: ["Tap the Share button", "Scroll down to Add to Home Screen", "Tap Add"],
    };
  }

  return { kind: "none" };
}

/**
 * The same offer, except the home screen only asks once. Settings keeps it
 * either way, so waving it away loses nothing but the asking.
 */
export function offerOnHome(ability: InstallAbility): InstallOffer {
  return ability.dismissed ? { kind: "none" } : describeInstall(ability);
}
