/*
 * The browser half of durable storage. The decision about what to say lives in
 * domain/durability.ts; this only asks the browser questions about itself.
 *
 * Reading whether we are already persisted is free and silent, so it happens at
 * startup. Asking to become persisted is not: Chromium answers on its own from
 * how much the site is used, but Firefox puts a permission prompt on screen for
 * it. So the request is only ever made from a tap in Settings, next to the
 * sentence explaining what it is for. An unexplained permission dialog during
 * the first paint is how apps teach people to press No.
 */
import type { StorageAbility } from "../domain/durability.ts";
import { iPhoneish, standalone } from "./platform.ts";

let persisted = false;
let changed: (() => void) | null = null;

function manager(): StorageManager | null {
  if (typeof navigator === "undefined") return null;
  const storage = navigator.storage;
  return storage && typeof storage.persisted === "function" ? storage : null;
}

export function storageAbility(): StorageAbility {
  return {
    canAsk: manager() !== null,
    persisted,
    installed: standalone(),
    sweeps: iPhoneish(),
  };
}

/** Free and silent, so it runs at startup. Never prompts. */
export async function readPersistence(): Promise<void> {
  const storage = manager();
  if (!storage) return;

  try {
    persisted = await storage.persisted();
  } catch {
    // A browser that will not answer is treated as a browser that said no.
    persisted = false;
  }
  changed?.();
}

/** Needs a tap behind it, because in some browsers this is a permission. */
export async function askToPersist(): Promise<string> {
  const storage = manager();
  if (!storage || typeof storage.persist !== "function") {
    return "This browser will not answer that.";
  }

  try {
    persisted = await storage.persist();
  } catch {
    persisted = false;
  }
  changed?.();

  return persisted
    ? "Your browser has agreed to keep it."
    : "Your browser would not promise. The backup is the answer either way.";
}

/** The answer arrives after the first paint, so the app asks to be told. */
export function onStorageChange(redraw: () => void): void {
  changed = redraw;
}
