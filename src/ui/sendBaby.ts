import { displayName } from "../domain/derive.ts";
import type { Baby } from "../domain/types.ts";
import type { Catalog } from "../i18n/en.ts";
import {
  readOneBaby,
  toMerge,
  toOneBaby,
  weighOneBaby,
  type Arrival,
  type Delivery,
  type PhotoChoice,
} from "../storage/oneBaby.ts";
import type { AppContext } from "./context.ts";
import { downloadBlob, el, replace } from "./dom.ts";
import { popup } from "./modal.ts";

/*
 * The two ends of handing one baby to somebody else who keeps this app.
 *
 * Sending is the card's dance with a different file: the share sheet where
 * there is one, since the point of the file is to send it, and a download where
 * there is not.
 *
 * Receiving is the opposite of that and deliberately slow. A file can add a
 * baby, bring one up to date or put back one you removed, and the only way to
 * know which is to say so and wait, so nothing is written until the account of
 * what would change has been read and agreed to line by line.
 */

/**
 * A filename rather than a sentence, so it is not in the catalogue. Letters of
 * any script survive, because a Hebrew name put through an a-to-z filter comes
 * out as nothing at all and the file arrives called ".json".
 */
function filenameFor(baby: Baby, t: Catalog): string {
  const slug = displayName(baby, t)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `stork-${slug}.json` : "stork-baby.json";
}

/** Rounded, since the reason for saying a size at all is the order of it. */
function humanSize(count: number, t: Catalog): string {
  const words = t.settings.send;
  const kb = count / 1024;
  return kb < 1024
    ? words.kilobytes(String(Math.max(1, Math.round(kb))))
    : words.megabytes((kb / 1024).toFixed(1));
}

/**
 * Hands the file to the phone's share sheet where there is one, and saves it
 * where there is not. Must be called from a tap: the share sheet needs one.
 */
export async function sendBaby(
  baby: Baby,
  now: Date,
  t: Catalog,
  photos: PhotoChoice,
): Promise<string> {
  const words = t.settings.send;
  const text = toOneBaby(baby, now, photos);
  const filename = filenameFor(baby, t);
  const file = new File([text], filename, { type: "application/json" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: displayName(baby, t) });
      return words.sent;
    } catch (error) {
      // Backing out of the share sheet is a choice, not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return "";
    }
  }

  downloadBlob(filename, new Blob([text], { type: "application/json" }));
  return words.savedAs(filename);
}

/** Settings' own row: a title, what it means, and the control for it. */
function setting(title: HTMLElement, body: string, action: HTMLElement | null): HTMLElement {
  return el(
    "div",
    { class: "setting" },
    el("div", { class: "setting-text" }, title, el("span", { class: "setting-body" }, body)),
    action,
  );
}

/* ------------------------------------------------------------------ sending */

export function renderSendBaby(ctx: AppContext, baby: Baby): HTMLElement {
  const words = ctx.t.settings.send;
  const size = weighOneBaby(baby, ctx.now);

  /*
   * Their picture always travels: it is one square already shrunk to a few tens
   * of kilobytes, and it is what makes the record recognisable when it lands.
   * The album is the part that runs to megabytes, so it is asked about rather
   * than assumed, and above what a share sheet will carry it is not offered.
   */
  let photos: PhotoChoice = "pictureOnly";

  const album = el("button", { class: "secondary", type: "button" });
  const paintAlbum = (): void => {
    const on = photos === "withAlbum";
    album.textContent = on ? words.albumOn : words.albumOff;
    album.setAttribute("aria-pressed", String(on));
  };
  album.addEventListener("click", () => {
    photos = photos === "withAlbum" ? "pictureOnly" : "withAlbum";
    paintAlbum();
  });
  paintAlbum();

  const send = async (): Promise<void> => {
    try {
      const said = await sendBaby(baby, ctx.now, ctx.t, photos);
      if (said) ctx.toast(said);
      // Nothing here changed the book, so this is a step out rather than the
      // end of a task: back to the baby the file was made from.
      ctx.back();
    } catch {
      ctx.toast(words.sendFailed);
    }
  };

  return popup({
    title: words.title,
    closeLabel: ctx.t.app.close,
    onClose: () => ctx.back(),
    body: [
      el(
        "section",
        { class: "panel" },
        el("p", {}, words.line),
        el("p", { class: "note" }, words.yoursStays),
        el("p", { class: "note" }, words.mergesAtTheirEnd),
      ),
      size.albumPhotos > 0
        ? el(
            "section",
            { class: "panel" },
            size.albumFits
              ? setting(
                  el("span", { class: "setting-title" }, words.albumTitle),
                  words.albumSize(size.albumPhotos, humanSize(size.album, ctx.t)),
                  album,
                )
              : el(
                  "p",
                  { class: "backup-line stale" },
                  words.albumTooBig(humanSize(size.album, ctx.t)),
                ),
            el("p", { class: "note" }, words.albumNote),
          )
        : null,
      el(
        "div",
        { class: "prompt-actions" },
        el("button", { class: "primary", type: "button", onclick: () => send() }, words.send),
      ),
    ],
  });
}

/* ---------------------------------------------------------------- receiving */

export function renderReceiveBaby(ctx: AppContext): HTMLElement {
  const words = ctx.t.settings.send;
  // One panel, rewritten in place rather than a second route, so the back
  // button means the same thing before and after a file has been read.
  const stage = el("section", { class: "panel" });

  const picker = el("input", {
    type: "file",
    accept: "application/json,.json",
    hidden: true,
    onchange: async (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      // Lets the same file be picked again after a failure.
      input.value = "";
      if (!file) return;

      try {
        const delivery = readOneBaby(await file.text(), await ctx.repo.listAll());
        if (delivery.arrivals.length === 0) {
          ctx.toast(delivery.ignored > 0 ? words.deletionsIgnored : words.nothingReadable);
          return;
        }
        showAccount(delivery);
      } catch {
        ctx.toast(words.unreadable);
      }
    },
  });

  /** Everything this one record would do, in the order it matters. */
  const account = (arrival: Arrival): string => {
    const said = [
      arrival.effect === "new"
        ? words.isNew
        : arrival.effect === "update"
          ? words.isUpdate
          : arrival.effect === "restore"
            ? words.isRestore
            : words.isCurrent,
    ];
    if (arrival.looksLike) said.push(words.looksLike(displayName(arrival.looksLike, ctx.t)));
    return said.join(" ");
  };

  function showAccount(delivery: Delivery): void {
    // Anything already current has nothing to do, and putting somebody back
    // after you removed them is deliberate enough to be asked for.
    const taking = new Map(
      delivery.arrivals.map((arrival) => [
        arrival.baby.id,
        arrival.effect === "new" || arrival.effect === "update",
      ]),
    );

    const take = async (): Promise<void> => {
      const accepted = delivery.arrivals.filter((arrival) => taking.get(arrival.baby.id));
      if (accepted.length === 0) {
        ctx.toast(words.takeNothing);
        return;
      }

      const result = await ctx.repo.merge(toMerge(accepted, ctx.now));
      await ctx.refresh();
      ctx.toast(words.taken(result.added, result.updated));
      // One baby is the usual case, and reading them is the point of the file.
      ctx.finish(
        accepted.length === 1
          ? `#/baby/${encodeURIComponent(accepted[0]!.baby.id)}`
          : "#/",
      );
    };

    const row = (arrival: Arrival): HTMLElement => {
      // dir="auto" because the name came from whoever typed it, and a Hebrew
      // name in an English book has to read the right way round.
      const named = el(
        "span",
        { class: "setting-title", dir: "auto" },
        displayName(arrival.baby, ctx.t),
      );
      // Nothing already current has anything to agree to.
      if (arrival.effect === "current") return setting(named, account(arrival), null);

      const choice = el("button", { class: "secondary", type: "button" });
      const paint = (): void => {
        const on = Boolean(taking.get(arrival.baby.id));
        choice.textContent = on ? words.taking : words.skipping;
        choice.setAttribute("aria-pressed", String(on));
      };
      choice.addEventListener("click", () => {
        taking.set(arrival.baby.id, !taking.get(arrival.baby.id));
        paint();
      });
      paint();

      return setting(named, account(arrival), choice);
    };

    replace(
      stage,
      el("h2", { class: "section-title" }, words.changesTitle),
      ...delivery.arrivals.map(row),
      delivery.ignored > 0 ? el("p", { class: "note" }, words.deletionsIgnored) : null,
      el(
        "div",
        { class: "prompt-actions" },
        el("button", { class: "primary", type: "button", onclick: () => take() }, words.takeAction),
      ),
    );
  }

  replace(
    stage,
    el("p", {}, words.receiveBody),
    el(
      "button",
      { class: "primary block", type: "button", onclick: () => picker.click() },
      words.receiveAction,
    ),
  );

  return popup({
    title: words.receiveTitle,
    closeLabel: ctx.t.app.close,
    onClose: () => ctx.back(),
    body: [stage, picker],
  });
}
