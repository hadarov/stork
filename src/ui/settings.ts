import { describeBackup } from "../domain/backupStatus.ts";
import { describeInstall } from "../domain/install.ts";
import { toICalendar } from "../domain/ics.ts";
import { readBackup } from "../storage/backup.ts";
import { lastChangedAt } from "../storage/watchRepo.ts";
import type { AppContext } from "./context.ts";
import { downloadFile, el } from "./dom.ts";
import {
  autoBackupOn,
  backUpNow,
  canKeepUpdated,
  lastBackupAt,
  setAutoBackup,
} from "./keeper.ts";
import { installCard } from "./installCard.ts";
import { ability } from "./installer.ts";
import { popup } from "./modal.ts";
import { askToNudge, nudgeStatus } from "./nudger.ts";
import { setThemeChoice, themeChoice } from "./theme.ts";

function row(title: string, body: string, action: HTMLElement): HTMLElement {
  return el(
    "div",
    { class: "setting" },
    el(
      "div",
      { class: "setting-text" },
      el("span", { class: "setting-title" }, title),
      el("span", { class: "setting-body" }, body),
    ),
    action,
  );
}

function button(label: string, onClick: () => void, variant = "secondary"): HTMLElement {
  return el("button", { class: variant, type: "button", onclick: onClick }, label);
}

export function renderSettings(ctx: AppContext): HTMLElement {
  const keeping = autoBackupOn();
  const status = describeBackup({
    lastAt: lastBackupAt(),
    changedAt: lastChangedAt(ctx.babies),
    count: ctx.babies.length,
    now: ctx.now,
  });

  const importInput = el("input", {
    type: "file",
    accept: "application/json,.json",
    hidden: true,
    onchange: async (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;

      try {
        const incoming = readBackup(await file.text());
        if (incoming.length === 0) {
          ctx.toast("Nothing readable in that file");
          return;
        }
        const result = await ctx.repo.merge(incoming);
        await ctx.refresh();
        ctx.toast(
          `${result.added} added, ${result.updated} updated, ${result.skipped} already current`,
        );
      } catch {
        ctx.toast("Could not read that file");
      }
    },
  });

  const backUp = async (): Promise<void> => {
    try {
      const said = await backUpNow(ctx.repo, ctx.now);
      if (said) ctx.toast(said);
      ctx.redraw();
    } catch {
      ctx.toast("Could not write the backup");
    }
  };

  const toggleAuto = async (): Promise<void> => {
    try {
      ctx.toast(await setAutoBackup(!autoBackupOn(), ctx.repo, ctx.now));
      ctx.redraw();
    } catch {
      // Backing out of the folder picker lands here, and needs no telling off.
    }
  };

  const exportIcs = (): void => {
    if (ctx.babies.length === 0) {
      ctx.toast("No dates to export yet");
      return;
    }
    downloadFile("stork-babies.ics", "text/calendar", toICalendar(ctx.babies, ctx.now));
    ctx.toast("Calendar file saved - open it to add every date");
  };

  const nudges = nudgeStatus();
  const chosen = themeChoice();
  const themePicker = el(
    "div",
    { class: "segmented", role: "group", "aria-label": "Theme" },
    ...(
      [
        ["system", "Auto"],
        ["dark", "Dark"],
        ["light", "Light"],
      ] as const
    ).map(([value, label]) =>
      el(
        "button",
        {
          type: "button",
          class: chosen === value ? "active" : "",
          "aria-pressed": String(chosen === value),
          onclick: () => {
            setThemeChoice(value);
            ctx.redraw();
          },
        },
        label,
      ),
    ),
  );

  return popup({
    title: "Settings",
    onClose: () => ctx.back(),
    body: [
      el(
        "section",
        { class: "panel" },
        el("h2", { class: "section-title" }, "Look"),
        el(
          "p",
          { class: "note" },
          "Dark by default. The babies keep their colours either way - they are the only part that should be shouting.",
        ),
        themePicker,
      ),
      el(
        "section",
        { class: "panel" },
        el("h2", { class: "section-title" }, "Reminders"),
        el(
          "p",
          { class: nudges.fallback ? "backup-line stale" : "backup-line" },
          nudges.line,
        ),
        nudges.action === "ask"
          ? el(
              "button",
              {
                class: "primary block",
                type: "button",
                onclick: async () => {
                  ctx.toast(await askToNudge());
                  ctx.redraw();
                },
              },
              "Turn on reminders",
            )
          : null,
        // Reminders used to spell out the iOS share sheet here, to everybody,
        // including the people whose browser has a real install button. The
        // panel below knows which one it is talking to.
      ),
      installCard(ctx, describeInstall(ability()), { closeable: false }),
      el(
        "section",
        { class: "panel" },
        el("h2", { class: "section-title" }, "Your dates, elsewhere"),
        row(
          "Add every date to your calendar",
          "Birthdays repeat every year, due dates land once, and both nudge you two days early.",
          button("Export .ics", exportIcs),
        ),
      ),
      el(
        "section",
        { class: "panel" },
        el("h2", { class: "section-title" }, "Backup"),
        el(
          "p",
          { class: "note" },
          "Everything you add lives on this device only. Nothing is uploaded and nobody else can see it, which also means clearing your browser data would take it with it.",
        ),
        el(
          "p",
          { class: "note" },
          "Put the backup somewhere your phone already syncs - iCloud Drive, Google Drive, Dropbox - and it will follow you to a new phone without anyone running a server for you.",
        ),
        el("p", { class: status.stale ? "backup-line stale" : "backup-line" }, status.line),
        row(
          "Back up now",
          keeping
            ? "Written automatically whenever anything changes."
            : "Choose the folder once; after that it is one tap.",
          button("Back up", () => backUp(), "primary"),
        ),
        canKeepUpdated()
          ? row(
              "Keep it updated",
              keeping
                ? "On. The same file is rewritten a couple of seconds after any change."
                : "Rewrite that file by itself, so you never have to remember.",
              button(keeping ? "Turn off" : "Turn on", () => toggleAuto()),
            )
          : null,
        row(
          "Restore a backup",
          "Merges rather than overwrites: the newer version of each baby wins.",
          button("Import", () => importInput.click()),
        ),
        importInput,
      ),
      el(
        "section",
        { class: "panel" },
        el("h2", { class: "section-title" }, "About"),
        el(
          "p",
          { class: "note" },
          "Stork keeps up with your friends' babies so you do not have to: who is due when, who just arrived, whose birthday is next, and whether you ever did send that gift.",
        ),
        el(
          "p",
          { class: "note" },
          "Star sign dates shift by a day between years, so a birthday on a boundary is flagged rather than guessed. The Chinese zodiac turns over at Lunar New Year, not on 1 January.",
        ),
      ),
    ],
  });
}
