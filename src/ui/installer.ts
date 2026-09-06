/*
 * The browser half of installing: catching Chromium's prompt, noticing that we
 * are already installed, and telling an iPhone apart from everything else.
 *
 * The decision about what to say lives in domain/install.ts. This only answers
 * questions about the browser it happens to be running in.
 */
import type { InstallAbility } from "../domain/install.ts";
import type { Catalog } from "../i18n/en.ts";
import { iPhoneish, standalone } from "./platform.ts";

/** Chromium's prompt, which arrives unannounced and can only be fired once. */
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED = "stork.install.dismissed";

let waiting: InstallPrompt | null = null;
let changed: (() => void) | null = null;

function waved(): boolean {
  try {
    return localStorage.getItem(DISMISSED) === "1";
  } catch {
    return false;
  }
}

export function ability(): InstallAbility {
  return {
    installed: standalone(),
    canPrompt: waiting !== null,
    byHand: iPhoneish(),
    dismissed: waved(),
  };
}

export function dismissInstall(): void {
  try {
    localStorage.setItem(DISMISSED, "1");
  } catch {
    // A browser that will not remember the dismissal will ask again, which is
    // a smaller problem than refusing to close the thing.
  }
}

/**
 * Fires the prompt Chromium handed over. It is spent either way, so it is
 * dropped before the answer comes back rather than after.
 */
export async function install(t: Catalog): Promise<string> {
  const prompt = waiting;
  if (!prompt) return t.settings.install.ownMenu;

  waiting = null;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  changed?.();

  return outcome === "accepted" ? t.settings.install.installing : t.settings.install.declined;
}

/**
 * Chromium fires beforeinstallprompt early and exactly once, so this is called
 * before the app has finished starting rather than from a screen that might
 * not have been drawn yet.
 */
export function watchForInstall(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("beforeinstallprompt", (event) => {
    // Without this some browsers show their own bar as well as ours.
    event.preventDefault();
    waiting = event as InstallPrompt;
    changed?.();
  });

  window.addEventListener("appinstalled", () => {
    waiting = null;
    changed?.();
  });
}

/** The answer arrives after the first paint, so the app asks to be told. */
export function onInstallChange(redraw: () => void): void {
  changed = redraw;
}
