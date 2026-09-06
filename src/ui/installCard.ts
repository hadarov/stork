/*
 * The install offer, in two places: a strip under the grid that can be waved
 * away, and a permanent entry in Settings that cannot. They differ only in
 * whether there is a close button.
 */
import type { InstallOffer } from "../domain/install.ts";
import type { AppContext } from "./context.ts";
import { el } from "./dom.ts";
import { dismissInstall, install } from "./installer.ts";
import { noticeCard } from "./noticeCard.ts";

export function installCard(
  ctx: AppContext,
  offer: InstallOffer,
  options: { closeable: boolean },
): HTMLElement | null {
  if (offer.kind === "none") return null;

  const action =
    offer.kind === "button"
      ? el(
          "button",
          {
            class: "primary block",
            type: "button",
            onclick: async () => {
              ctx.toast(await install(ctx.t));
              ctx.redraw();
            },
          },
          offer.label,
        )
      : el("ol", { class: "notice-steps" }, ...offer.steps.map((step) => el("li", {}, step)));

  return noticeCard({
    glyph: "\u{1F95A}",
    title: offer.title,
    line: offer.line,
    action,
    dismissLabel: ctx.t.settings.settings.notNow,
    onDismiss: options.closeable
      ? () => {
          dismissInstall();
          ctx.redraw();
        }
      : undefined,
  });
}
