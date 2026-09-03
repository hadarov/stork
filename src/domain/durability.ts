/*
 * Whether this device will hold on to what it has been given, which is a
 * different question from whether there is a backup.
 *
 * Browsers treat a site's storage as disposable. Chromium clears it to make
 * room when the disk gets tight, and Safari deletes it outright after seven
 * days in which the site was not opened at all. Asking for persistent storage
 * takes the origin off that list, and browsers grant it on their own terms -
 * usually to something installed or used often - so it is a request rather
 * than a setting.
 *
 * What it is not is protection from anything deliberate. Clearing browsing data
 * clears this too, persisted or not, and no amount of API will change that. The
 * wording below says so, because the alternative is telling somebody their book
 * is safe and being wrong about it.
 *
 * Same shape as nudgeStatus.ts and install.ts, for the same reason: describe
 * what this browser will really do, not what the feature is called.
 */

export type StorageAbility = {
  /** The browser has a storage manager to ask at all. */
  canAsk: boolean;
  /** It has agreed not to clear this origin to make room. */
  persisted: boolean;
  /** Running from the home screen rather than inside a tab. */
  installed: boolean;
  /** Safari, which sweeps a site's storage after a week of not opening it. */
  sweeps: boolean;
};

export type StorageStatus = {
  line: string;
  /** Whether there is any point offering the button. */
  ask: boolean;
  /** A warning rather than reassurance. */
  warn: boolean;
};

export function describeStorage(ability: StorageAbility): StorageStatus {
  if (!ability.canAsk) {
    return {
      line: "This browser will not say whether it keeps Stork's data or clears it when it needs the room.",
      ask: false,
      warn: true,
    };
  }

  if (ability.persisted) {
    return {
      line: "Your browser has agreed not to clear Stork's data by itself. Clearing your browsing data by hand still would.",
      ask: false,
      warn: false,
    };
  }

  if (ability.sweeps) {
    // Worth separating: on the home screen the seven days are counted against
    // Stork alone, so opening it is enough. In a tab it is one site among all
    // the others and far easier to lose track of.
    return {
      line: ability.installed
        ? "Safari deletes a site's data after seven days without opening it. On the home screen Stork is counted on its own, so opening it now and again is enough."
        : "Safari deletes a site's data after seven days without opening it. Adding Stork to your home screen gives it a clock of its own.",
      ask: true,
      warn: true,
    };
  }

  return {
    line: "Your browser may clear Stork's data if it runs short of room.",
    ask: true,
    warn: true,
  };
}
