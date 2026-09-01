import { el } from "./dom.ts";

/**
 * Every screen other than the book itself is a popup over it, so the grid stays
 * visible behind and closing one always lands you back where you were.
 */
export function popup(options: {
  title: string;
  onClose: () => void;
  body: (HTMLElement | null)[];
  actions?: (HTMLElement | null)[];
  /** A wider sheet for reading, rather than the narrow one for forms. */
  wide?: boolean;
}): HTMLElement {
  const sheet = el(
    "div",
    { class: options.wide ? "sheet wide" : "sheet", role: "document" },
    el(
      "header",
      { class: "sheet-bar" },
      el("h2", { class: "sheet-title" }, options.title),
      el("div", { class: "sheet-actions" }, ...(options.actions ?? []).filter(Boolean)),
      el(
        "button",
        {
          class: "icon-button",
          type: "button",
          "aria-label": "Close",
          onclick: options.onClose,
        },
        "\u00D7",
      ),
    ),
    el("div", { class: "sheet-body" }, ...options.body.filter(Boolean)),
  );

  return el(
    "div",
    {
      class: "overlay",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": options.title,
      // Only a tap on the backdrop itself closes; taps inside the sheet bubble
      // up to here too, and must not.
      onclick: (event: Event) => {
        if (event.target === event.currentTarget) options.onClose();
      },
    },
    sheet,
  );
}
