import { displayName, formatDate, formatShortDate, parseDate, toISODate } from "../domain/derive.ts";
import type { Baby, Photo } from "../domain/types.ts";
import { MAX_PHOTOS, newId } from "../storage/repo.ts";
import type { AppContext } from "./context.ts";
import { dateField } from "./dateField.ts";
import { el } from "./dom.ts";
import { popup } from "./modal.ts";
import { readPhoto } from "./photo.ts";

/** Oldest first, so the strip reads left to right as they grow. */
export function albumOf(baby: Baby): Photo[] {
  return [...(baby.photos ?? [])].sort((a, b) => a.date.localeCompare(b.date));
}

async function persist(ctx: AppContext, baby: Baby): Promise<void> {
  await ctx.repo.save({ ...baby, updatedAt: new Date().toISOString() });
  await ctx.refresh();
}

export function albumSection(baby: Baby, ctx: AppContext): HTMLElement {
  const photos = albumOf(baby);

  const picker = el("input", {
    type: "file",
    accept: "image/*",
    hidden: true,
    onchange: async (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      try {
        if (photos.length >= MAX_PHOTOS) {
          throw new Error(`${MAX_PHOTOS} photos each, so there is room for everyone.`);
        }
        const photo: Photo = {
          id: newId(),
          data: await readPhoto(file),
          // Almost always right, and editable in the viewer when it is not.
          date: toISODate(ctx.now),
        };
        await persist(ctx, { ...baby, photos: [...(baby.photos ?? []), photo] });
        ctx.toast("Photo added");
        // Stays on the page, so the strip has to be told to grow.
        ctx.redraw();
      } catch (error) {
        ctx.toast(error instanceof Error ? error.message : "Could not read that image.");
      } finally {
        // Lets the same file be picked again after a failure.
        input.value = "";
      }
    },
  });

  return el(
    "section",
    { class: "panel" },
    el(
      "h2",
      { class: "section-title" },
      "Album",
      photos.length > 0 ? el("span", { class: "section-count" }, String(photos.length)) : null,
    ),
    photos.length > 0
      ? el(
          "div",
          { class: "album" },
          ...photos.map((photo) =>
            el(
              "button",
              {
                class: "album-item",
                type: "button",
                onclick: () =>
                  ctx.navigate(
                    `#/photo/${encodeURIComponent(baby.id)}/${encodeURIComponent(photo.id)}`,
                  ),
              },
              el("img", { src: photo.data, alt: photo.caption ?? "", loading: "lazy" }),
              el("span", { class: "album-when" }, formatShortDate(parseDate(photo.date))),
            ),
          ),
        )
      : el("p", { class: "note" }, "Photos you add here stay in order, oldest first."),
    el(
      "button",
      { class: "secondary", type: "button", onclick: () => picker.click() },
      "\u{1F4F7} Add a photo",
    ),
    picker,
  );
}

export function renderPhotoViewer(ctx: AppContext, baby: Baby, photo: Photo): HTMLElement {
  const rest = (baby.photos ?? []).filter((candidate) => candidate.id !== photo.id);
  const replace = async (changed: Partial<Photo>): Promise<void> => {
    await persist(ctx, { ...baby, photos: [...rest, { ...photo, ...changed }] });
    // The title carries the date and the strip behind is in date order.
    ctx.redraw();
  };

  return popup({
    title: formatDate(parseDate(photo.date)),
    onClose: () => ctx.back(),
    body: [
      el("img", {
        class: "photo-full",
        src: photo.data,
        alt: photo.caption ?? displayName(baby),
      }),
      el(
        "label",
        { class: "field" },
        el("span", { class: "field-label" }, "Caption"),
        el("input", {
          class: "input",
          value: photo.caption ?? "",
          placeholder: "First smile",
          // On blur rather than on every keystroke, so a redraw mid-word
          // cannot take the cursor away from you.
          onchange: (event: Event) => {
            const caption = (event.target as HTMLInputElement).value.trim();
            return replace({ caption: caption || undefined });
          },
        }),
      ),
      dateField({
        label: "Taken",
        range: "past",
        value: photo.date,
        now: ctx.now,
        onChange: (date) => {
          if (date) void replace({ date });
        },
      }),
      el(
        "div",
        { class: "prompt-actions" },
        el(
          "button",
          {
            class: "secondary",
            type: "button",
            onclick: async () => {
              await persist(ctx, { ...baby, photo: photo.data });
              ctx.toast("That is their picture now");
              // Backing out redraws the page underneath, already updated.
              ctx.back();
            },
          },
          "Use as their picture",
        ),
        el(
          "button",
          {
            class: "quiet danger",
            type: "button",
            onclick: async () => {
              await persist(ctx, { ...baby, photos: rest });
              ctx.toast("Photo removed");
              ctx.back();
            },
          },
          "Delete",
        ),
      ),
    ],
  });
}
