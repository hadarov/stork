import { displayName } from "../domain/derive.ts";
import type { Baby } from "../domain/types.ts";
import { el } from "./dom.ts";

/** Six pastels, picked from the id so a baby keeps the same colour forever. */
const TINTS = 6;

export function tintIndex(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % TINTS;
}

export function tintFor(id: string): string {
  return `tint-${tintIndex(id)}`;
}

export function glyphFor(baby: Baby): string {
  return baby.status === "expecting" ? "\u{1F423}" : "\u{1F476}";
}

export function avatar(baby: Baby, size: "sm" | "lg" = "sm"): HTMLElement {
  if (baby.photo) {
    return el("img", {
      class: `avatar avatar-${size}`,
      src: baby.photo,
      alt: displayName(baby),
      loading: "lazy",
    });
  }
  return el(
    "div",
    { class: `avatar avatar-${size} ${tintFor(baby.id)}`, "aria-hidden": "true" },
    glyphFor(baby),
  );
}

/**
 * One square in the grid: a photo if there is one, otherwise a big glyph on the
 * baby's own colour, with the name underneath and a badge for anything
 * happening imminently.
 */
export function tile(
  baby: Baby,
  options: { sub: string; badge?: string; onOpen: () => void },
): HTMLElement {
  return el(
    "button",
    {
      class: `tile ${tintFor(baby.id)}`,
      type: "button",
      onclick: options.onOpen,
    },
    el(
      "span",
      { class: "tile-art" },
      baby.photo
        ? el("img", { src: baby.photo, alt: displayName(baby), loading: "lazy" })
        : el("span", { class: "tile-glyph", "aria-hidden": "true" }, glyphFor(baby)),
    ),
    el("span", { class: "tile-name" }, displayName(baby)),
    el("span", { class: "tile-sub" }, options.sub),
    options.badge
      ? el("span", { class: "tile-badge", "aria-hidden": "true" }, options.badge)
      : null,
  );
}

export function screenHeader(
  title: string,
  options: { onBack?: () => void; mark?: boolean; actions?: HTMLElement[] } = {},
): HTMLElement {
  return el(
    "header",
    { class: "topbar" },
    options.onBack
      ? el(
          "button",
          { class: "icon-button", type: "button", "aria-label": "Back", onclick: options.onBack },
          "\u2190",
        )
      : null,
    // Decorative: the word beside it already says Stork.
    options.mark ? el("img", { class: "logo", src: "./favicon.svg", alt: "" }) : null,
    el("h1", { class: "topbar-title" }, title),
    el("div", { class: "topbar-actions" }, ...(options.actions ?? [])),
  );
}

export function iconButton(
  label: string,
  glyph: string,
  onClick: () => void,
): HTMLButtonElement {
  return el(
    "button",
    { class: "icon-button", type: "button", "aria-label": label, title: label, onclick: onClick },
    glyph,
  );
}

export function chip(text: string, variant = ""): HTMLElement {
  return el("span", { class: `chip ${variant}`.trim() }, text);
}

export function factCard(label: string, value: string, detail?: string): HTMLElement {
  return el(
    "div",
    { class: "fact" },
    el("span", { class: "fact-label" }, label),
    el("span", { class: "fact-value" }, value),
    detail ? el("span", { class: "fact-detail" }, detail) : null,
  );
}

export function emptyState(heading: string, body: string, action?: HTMLElement): HTMLElement {
  return el(
    "div",
    { class: "empty" },
    el("div", { class: "empty-glyph", "aria-hidden": "true" }, "\u{1F423}"),
    el("h2", {}, heading),
    el("p", {}, body),
    action ?? null,
  );
}
