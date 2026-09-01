import { toICalendar } from "../domain/ics.ts";
import { backupFilename, readBackup, toBackup } from "../storage/backup.ts";
import type { AppContext } from "./context.ts";
import { downloadFile, el } from "./dom.ts";
import { popup } from "./modal.ts";

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

  const exportJson = async (): Promise<void> => {
    // Tombstones are included, so importing elsewhere does not undo a deletion.
    const all = await ctx.repo.listAll();
    downloadFile(backupFilename(ctx.now), "application/json", toBackup(all, ctx.now));
    ctx.toast("Backup saved");
  };

  const exportIcs = (): void => {
    if (ctx.babies.length === 0) {
      ctx.toast("No dates to export yet");
      return;
    }
    downloadFile("stork-babies.ics", "text/calendar", toICalendar(ctx.babies, ctx.now));
    ctx.toast("Calendar file saved - open it to add every date");
  };

  return popup({
    title: "Settings",
    onClose: () => ctx.back(),
    body: [
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
          "Everything you add lives on this device only. Nothing is uploaded, and nobody else can see it - which also means clearing your browser data would take it with it.",
        ),
        row(
          "Save a backup",
          `${ctx.babies.length} ${ctx.babies.length === 1 ? "baby" : "babies"} in your book.`,
          button("Export", () => exportJson()),
        ),
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
