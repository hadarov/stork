import { displayName } from "../domain/derive.ts";
import { lifeStage } from "../domain/stage.ts";
import type { Baby } from "../domain/types.ts";
import type { Catalog } from "../i18n/en.ts";
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

export function glyphFor(baby: Baby, now: Date, t: Catalog): string {
  return lifeStage(baby, now, t).glyph;
}

export function avatar(
  baby: Baby,
  now: Date,
  t: Catalog,
  size: "sm" | "lg" = "sm",
): HTMLElement {
  if (baby.photo) {
    return el("img", {
      class: `avatar avatar-${size}`,
      src: baby.photo,
      alt: displayName(baby, t),
      loading: "lazy",
    });
  }
  return el(
    "div",
    { class: `avatar avatar-${size} ${tintFor(baby.id)}`, "aria-hidden": "true" },
    glyphFor(baby, now, t),
  );
}

/**
 * One square in the grid: a photo if there is one, otherwise a big glyph on the
 * baby's own colour, with the name, whose they are and how far along underneath,
 * plus a badge for anything happening imminently.
 */
export function tile(
  baby: Baby,
  now: Date,
  t: Catalog,
  options: { sub: string; badge?: string; onOpen: () => void },
): HTMLElement {
  return el(
    "button",
    {
      class: "tile",
      type: "button",
      onclick: options.onOpen,
    },
    el(
      "span",
      { class: `tile-art ${tintFor(baby.id)}` },
      baby.photo
        ? el("img", { src: baby.photo, alt: displayName(baby, t), loading: "lazy" })
        : el("span", { class: "tile-glyph", "aria-hidden": "true" }, glyphFor(baby, now, t)),
    ),
    // dir="auto" on anything somebody typed: a Hebrew name in an English book,
    // or an English one in a Hebrew book, reads in its own direction rather
    // than in the interface's.
    el("span", { class: "tile-name", dir: "auto" }, displayName(baby, t)),
    // The short join, because there is only ever about one line of room. What
    // counts as short is the catalogue's business, not this file's.
    baby.parents.length > 0
      ? el("span", { class: "tile-parents", dir: "auto" }, t.label.shortList(baby.parents))
      : null,
    el("span", { class: "tile-sub" }, options.sub),
    options.badge
      ? el("span", { class: "tile-badge", "aria-hidden": "true" }, options.badge)
      : null,
  );
}

/*
 * No back arrow: everything that used to be a screen behind this one is a
 * popup now, and a popup closes itself. The arrow was left over from the
 * routed version and nothing had called for it in a while.
 */
export function screenHeader(
  title: string,
  options: {
    mark?: boolean;
    actions?: HTMLElement[];
  } = {},
): HTMLElement {
  return el(
    "header",
    { class: "topbar" },
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
    el("div", { class: "empty-glyph", "aria-hidden": "true" }, "\u{1F95A}"),
    el("h2", {}, heading),
    el("p", {}, body),
    action ?? null,
  );
}
