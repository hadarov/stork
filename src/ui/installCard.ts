/*
 * One drawing of the install offer, used in two places: a strip under the grid
 * that can be waved away, and a permanent entry in Settings that cannot. They
 * differ only in whether there is a close button, so they share everything else.
 */
import type { InstallOffer } from "../domain/install.ts";
import type { AppContext } from "./context.ts";
import { el } from "./dom.ts";
import { dismissInstall, install } from "./installer.ts";

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
              ctx.toast(await install());
              ctx.redraw();
            },
          },
          offer.label,
        )
      : el(
          "ol",
          { class: "install-steps" },
          ...offer.steps.map((step) => el("li", {}, step)),
        );

  return el(
    "section",
    { class: "install" },
    el(
      "div",
      { class: "install-head" },
      el("span", { class: "install-glyph" }, "\u{1F95A}"),
      el(
        "div",
        { class: "install-text" },
        el("span", { class: "install-title" }, offer.title),
        el("span", { class: "install-line" }, offer.line),
      ),
      options.closeable
        ? el(
            "button",
            {
              class: "icon-button install-close",
              type: "button",
              "aria-label": "Not now",
              onclick: () => {
                dismissInstall();
                ctx.redraw();
              },
            },
            "\u00d7",
          )
        : null,
    ),
    action,
  );
}
