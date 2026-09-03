/*
 * The two questions about the browser that more than one feature needs to ask:
 * are we running as an installed app, and is this an iPhone.
 *
 * They were private to installer.ts until storage wanted them too. Both are
 * sniffing of the kind that ages badly, so having one copy of each means there
 * is one place to fix when it does.
 */

/** Opened from the home screen rather than inside a tab. */
export function standalone(): boolean {
  if (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches) {
    return true;
  }
  // iOS does not report the media query and has its own flag instead.
  return (
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** An iPhone or an iPad, which behave differently about both. */
export function iPhoneish(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent ?? "")) return true;
  // A recent iPad calls itself a Mac, and only the touch points give it away.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}
