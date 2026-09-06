/*
 * One card for anything the app needs to say about itself rather than about a
 * baby: a glyph, a title, a line, something to do about it, and sometimes a
 * cross to make it go away.
 *
 * Two of these on one screen should look like two of the same thing, which is
 * easier to guarantee from a single function than from everybody agreeing to
 * copy the same markup.
 */
import { el } from "./dom.ts";

export function noticeCard(notice: {
  glyph: string;
  title: string;
  line: string;
  action: HTMLElement | null;
  /**
   * What the cross is called, for anyone listening to the screen rather than
   * looking at it. Handed in with the rest of the words rather than read from
   * the catalogue here, so this stays a card and not a screen.
   */
  dismissLabel: string;
  /** Given only when the card is allowed to be waved away. */
  onDismiss?: () => void;
}): HTMLElement {
  return el(
    "section",
    { class: "notice" },
    el(
      "div",
      { class: "notice-head" },
      el("span", { class: "notice-glyph", "aria-hidden": "true" }, notice.glyph),
      el(
        "div",
        { class: "notice-text" },
        el("span", { class: "notice-title" }, notice.title),
        el("span", { class: "notice-line" }, notice.line),
      ),
      notice.onDismiss
        ? el(
            "button",
            {
              class: "icon-button notice-close",
              type: "button",
              "aria-label": notice.dismissLabel,
              onclick: notice.onDismiss,
            },
            "\u00d7",
          )
        : null,
    ),
    notice.action,
  );
}
