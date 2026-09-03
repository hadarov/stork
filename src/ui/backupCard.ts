/*
 * The one place the app brings up backups without being asked.
 *
 * Everything about when to appear is in domain/backupStatus.ts, so the rule can
 * be argued with in a test rather than discovered by being nagged.
 */
import { nudgeAboutBackup } from "../domain/backupStatus.ts";
import { lastChangedAt } from "../storage/watchRepo.ts";
import type { AppContext } from "./context.ts";
import { el } from "./dom.ts";
import {
  autoBackupOn,
  backUpNow,
  backupHushedAt,
  hushBackupNudge,
  lastBackupAt,
} from "./keeper.ts";
import { noticeCard } from "./noticeCard.ts";

export function backupCard(ctx: AppContext): HTMLElement | null {
  const nudge = nudgeAboutBackup({
    count: ctx.babies.length,
    lastAt: lastBackupAt(),
    changedAt: lastChangedAt(ctx.babies),
    hushedAt: backupHushedAt(),
    keeping: autoBackupOn(),
    now: ctx.now,
  });

  if (nudge.kind === "none") return null;

  return noticeCard({
    glyph: "\u{1F4E6}",
    title: nudge.title,
    line: nudge.line,
    action: el(
      "button",
      {
        class: "primary block",
        type: "button",
        onclick: async () => {
          try {
            const said = await backUpNow(ctx.repo, ctx.now);
            if (said) ctx.toast(said);
            ctx.redraw();
          } catch {
            ctx.toast("Could not write the backup");
          }
        },
      },
      "Back up now",
    ),
    onDismiss: () => {
      hushBackupNudge(ctx.now);
      ctx.redraw();
    },
  });
}
