import { describeNudges, type NudgeAbility, type NudgeStatus } from "../domain/nudgeStatus.ts";
import { nudgesFor, pruneNudges } from "../domain/nudges.ts";
import { catchUp, forgetSaid, writeNudges } from "../storage/nudgeStore.ts";
import type { BabyRepo } from "../storage/repo.ts";

/*
 * Reminders, arranged from the app's side. Everything that decides *what* to
 * say lives in domain/nudges.ts and everything that says it lives in the
 * service worker; this is the part that talks to the browser.
 */

/** A day is the shortest Chrome will honour in practice, whatever we ask for. */
const MIN_PERIOD = 12 * 60 * 60 * 1000;

const TAG = "stork-nudges";

function periodicSync(registration: ServiceWorkerRegistration): any {
  return (registration as any).periodicSync;
}

/*
 * The settings screen draws in one go and cannot wait on a promise, so the
 * registration is kept here from boot and read synchronously.
 */
let worker: ServiceWorkerRegistration | null = null;

export function ability(): NudgeAbility {
  const canNotify = typeof Notification === "function";
  return {
    canNotify,
    canWake: Boolean(worker && periodicSync(worker)),
    installed:
      typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches,
    permission: canNotify ? Notification.permission : "denied",
  };
}

export function nudgeStatus(): NudgeStatus {
  return describeNudges(ability());
}

/** Returns what to put in the toast, since the answer might be no. */
export async function askToNudge(): Promise<string> {
  if (typeof Notification !== "function") return "This browser cannot show reminders.";

  const answer = await Notification.requestPermission();
  if (answer !== "granted") return "No reminders, then.";

  await arrange();
  return "Reminders on.";
}

/**
 * Asks the browser to wake us up periodically. It will say no unless the app is
 * installed and used often enough, and it never promises a time - so this is a
 * request, not a schedule, and the settings screen says as much.
 */
async function askToWake(registration: ServiceWorkerRegistration): Promise<void> {
  const sync = periodicSync(registration);
  if (!sync) return;

  try {
    const status = await navigator.permissions.query({
      name: "periodic-background-sync" as PermissionName,
    });
    if (status.state !== "granted") return;

    await sync.register(TAG, { minInterval: MIN_PERIOD });
  } catch {
    // An older Chromium, or a browser that has never heard of the permission.
  }
}

/**
 * Recomputes the list of reminders and leaves it where the worker will find it.
 * Cheap enough to run on every write and every launch, which is what keeps the
 * list honest after a birthday is corrected or a baby is removed.
 */
export async function arrange(repo?: BabyRepo, now = new Date()): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
  if (typeof Notification !== "function" || Notification.permission !== "granted") return;

  worker = await navigator.serviceWorker.ready;
  const babies = await (repo ?? current)?.list();
  if (!babies) return;

  const nudges = pruneNudges(nudgesFor(babies, now), now);

  // Whatever is already overdue was missed while we were closed; tick it off
  // rather than firing it, and only then hand the worker the new list.
  await catchUp(nudges, now);
  await forgetSaid(nudges);
  await writeNudges(nudges);
  await askToWake(worker);
}

let current: BabyRepo | null = null;

/** Wired up once at boot, so a later write can rearrange without being handed the repo. */
export function watchForNudges(repo: BabyRepo): void {
  current = repo;
  void arrange(repo);
}
