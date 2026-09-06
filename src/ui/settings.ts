import { describeBackup } from "../domain/backupStatus.ts";
import { describeStorage } from "../domain/durability.ts";
import { describeInstall } from "../domain/install.ts";
import { toICalendar } from "../domain/ics.ts";
import { describeNudges } from "../domain/nudgeStatus.ts";
import { CATALOGS, LANGS } from "../i18n/index.ts";
import { readBackup } from "../storage/backup.ts";
import { lastChangedAt } from "../storage/watchRepo.ts";
import type { AppContext } from "./context.ts";
import { downloadFile, el } from "./dom.ts";
import { askToPersist, storageAbility } from "./durable.ts";
import {
  autoBackupOn,
  backUpNow,
  canKeepUpdated,
  lastBackupAt,
  setAutoBackup,
} from "./keeper.ts";
import { installCard } from "./installCard.ts";
import { ability } from "./installer.ts";
import {
  jewishChoice,
  langChoice,
  setJewishCalendar,
  setLangChoice,
  type LangChoice,
} from "./lang.ts";
import { popup } from "./modal.ts";
import { arrange, askToNudge, ability as nudgeAbility } from "./nudger.ts";
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

/**
 * The control this screen uses for a choice between a handful of things. Every
 * one of them has a default worth leaving alone, so the first option is always
 * "whatever the phone, or the language, already says".
 */
function segmented<T>(
  label: string,
  options: readonly (readonly [T, string])[],
  chosen: T,
  choose: (value: T) => void,
): HTMLElement {
  return el(
    "div",
    { class: "segmented", role: "group", "aria-label": label },
    ...options.map(([value, text]) =>
      el(
        "button",
        {
          type: "button",
          class: chosen === value ? "active" : "",
          "aria-pressed": String(chosen === value),
          onclick: () => choose(value),
        },
        text,
      ),
    ),
  );
}

export function renderSettings(ctx: AppContext): HTMLElement {
  const words = ctx.t.settings.settings;
  const backup = ctx.t.settings.backup;
  const storage = ctx.t.settings.storage;

  const keeping = autoBackupOn();
  const durability = describeStorage(storageAbility(), ctx.t);
  const status = describeBackup(
    {
      lastAt: lastBackupAt(),
      changedAt: lastChangedAt(ctx.babies),
      count: ctx.babies.length,
      now: ctx.now,
    },
    ctx.t,
  );

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
          ctx.toast(backup.nothingReadable);
          return;
        }
        const result = await ctx.repo.merge(incoming);
        await ctx.refresh();
        ctx.toast(backup.merged(result.added, result.updated, result.skipped));
      } catch {
        ctx.toast(backup.unreadable);
      }
    },
  });

  const backUp = async (): Promise<void> => {
    try {
      const said = await backUpNow(ctx.repo, ctx.now, ctx.t);
      if (said) ctx.toast(said);
      ctx.redraw();
    } catch {
      ctx.toast(backup.writeFailed);
    }
  };

  const toggleAuto = async (): Promise<void> => {
    try {
      ctx.toast(await setAutoBackup(!autoBackupOn(), ctx.repo, ctx.now, ctx.t));
      ctx.redraw();
    } catch {
      // Backing out of the folder picker lands here, and needs no telling off.
    }
  };

  const exportIcs = (): void => {
    if (ctx.babies.length === 0) {
      ctx.toast(words.nothingToExport);
      return;
    }
    downloadFile(
      "stork-babies.ics",
      "text/calendar",
      toICalendar(ctx.babies, ctx.now, ctx.t, ctx.jewish),
    );
    ctx.toast(words.exported);
  };

  const nudges = describeNudges(nudgeAbility(), ctx.t);

  /*
   * Each language is offered in its own words rather than in the one currently
   * on, because the person most likely to need this control is the one who
   * cannot read the screen it is drawn on.
   */
  const langOptions: [LangChoice, string][] = [
    ["system", words.langSystem],
    ...LANGS.map((lang): [LangChoice, string] => [lang, CATALOGS[lang].name]),
  ];

  return popup({
    title: words.title,
    onClose: () => ctx.back(),
    body: [
      el(
        "section",
        { class: "panel" },
        el("h2", { class: "section-title" }, words.langSection),
        el("p", { class: "note" }, words.langNote),
        segmented(words.langLabel, langOptions, langChoice(), (choice) => {
          setLangChoice(choice);
          // Reminders are worded when they are worked out and read days later
          // by a worker that cannot look anything up, so the pending ones have
          // to be rewritten now or they arrive in the language just left.
          void arrange(ctx.repo);
          ctx.redraw();
        }),
      ),
      el(
        "section",
        { class: "panel" },
        el("h2", { class: "section-title" }, words.jewishSection),
        el("p", { class: "note" }, words.jewishNote),
        // Three ways rather than two, because following the language is a real
        // answer and a switch that is only on or off cannot be put back to it.
        segmented(
          words.jewishLabel,
          [
            [undefined, words.jewishAuto],
            [true, words.jewishOn],
            [false, words.jewishOff],
          ] as const,
          jewishChoice(),
          (choice) => {
            setJewishCalendar(choice);
            // Same reason as the language: turning the Hebrew calendar on adds
            // brit and Hebrew-birthday reminders that are not in the stored
            // list yet, and turning it off leaves them there.
            void arrange(ctx.repo);
            ctx.redraw();
          },
        ),
      ),
      el(
        "section",
        { class: "panel" },
        el("h2", { class: "section-title" }, words.lookSection),
        el("p", { class: "note" }, words.lookNote),
        segmented(
          words.themeLabel,
          [
            ["system", words.themeAuto],
            ["dark", words.themeDark],
            ["light", words.themeLight],
          ] as const,
          themeChoice(),
          (choice) => {
            setThemeChoice(choice);
            ctx.redraw();
          },
        ),
      ),
      el(
        "section",
        { class: "panel" },
        el("h2", { class: "section-title" }, words.remindersSection),
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
                  ctx.toast(await askToNudge(ctx.t));
                  ctx.redraw();
                },
              },
              words.turnOnNudges,
            )
          : null,
        // Reminders used to spell out the iOS share sheet here, to everybody,
        // including the people whose browser has a real install button. The
        // panel below knows which one it is talking to.
      ),
      installCard(ctx, describeInstall(ability(), ctx.t), { closeable: false }),
      el(
        "section",
        { class: "panel" },
        el("h2", { class: "section-title" }, words.calendarSection),
        row(words.calendarTitle, words.calendarBody, button(words.exportIcs, exportIcs)),
      ),
      el(
        "section",
        { class: "panel" },
        el("h2", { class: "section-title" }, backup.section),
        el("p", { class: "note" }, backup.onDevice),
        el("p", { class: "note" }, backup.syncFolder),
        el("p", { class: durability.warn ? "backup-line stale" : "backup-line" }, durability.line),
        durability.ask
          ? row(
              storage.askTitle,
              storage.askBody,
              button(storage.askAction, async () => {
                ctx.toast(await askToPersist(ctx.t));
                ctx.redraw();
              }),
            )
          : null,
        el("p", { class: status.stale ? "backup-line stale" : "backup-line" }, status.line),
        row(
          backup.nowTitle,
          keeping ? backup.nowBodyAuto : backup.nowBodyManual,
          button(backup.nowAction, () => backUp(), "primary"),
        ),
        canKeepUpdated()
          ? row(
              backup.autoTitle,
              keeping ? backup.autoBodyOn : backup.autoBodyOff,
              button(keeping ? backup.turnOff : backup.turnOn, () => toggleAuto()),
            )
          : null,
        row(
          backup.restoreTitle,
          backup.restoreBody,
          button(backup.restoreAction, () => importInput.click()),
        ),
        importInput,
      ),
      el(
        "section",
        { class: "panel" },
        el("h2", { class: "section-title" }, words.aboutSection),
        el("p", { class: "note" }, words.aboutWhat),
        el("p", { class: "note" }, words.aboutSigns),
      ),
    ],
  });
}
