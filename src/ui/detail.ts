import {
  birthFlower,
  birthstone,
  chineseSign,
  dayOfWeekRhyme,
  describeAge,
  describeLength,
  describeParents,
  describeWeight,
  displayName,
  dueCountdown,
  formatDate,
  milestones,
  nextBirthday,
  ordinal,
  parseDate,
  starSign,
} from "../domain/derive.ts";
import { relation, siblingsOf } from "../domain/family.ts";
import { toICalendar } from "../domain/ics.ts";
import type { Baby } from "../domain/types.ts";
import { albumSection } from "./album.ts";
import { shareCard } from "./card.ts";
import { avatar, chip, factCard, iconButton } from "./components.ts";
import type { AppContext } from "./context.ts";
import { downloadFile, el } from "./dom.ts";
import { popup } from "./modal.ts";

function section(title: string, ...children: (Node | null)[]): HTMLElement {
  return el(
    "section",
    { class: "panel" },
    el("h2", { class: "section-title" }, title),
    ...children.filter(Boolean),
  );
}

function signPanel(date: Date, heading: string): HTMLElement {
  const sun = starSign(date);
  const chinese = chineseSign(date);

  return section(
    heading,
    el(
      "div",
      { class: "sign-row" },
      el(
        "div",
        { class: "sign" },
        el("span", { class: "sign-emoji", "aria-hidden": "true" }, sun.emoji),
        el("span", { class: "sign-name" }, sun.name),
        el("span", { class: "sign-meta" }, `${sun.element} \u00b7 ${sun.range}`),
      ),
      el(
        "div",
        { class: "sign" },
        el("span", { class: "sign-emoji", "aria-hidden": "true" }, chinese.emoji),
        el("span", { class: "sign-name" }, `${chinese.element} ${chinese.animal}`),
        el("span", { class: "sign-meta" }, `Year of the ${chinese.animal}, ${chinese.year}`),
      ),
    ),
    el("p", { class: "sign-trait" }, `${sun.name}: ${sun.trait}.`),
    el("p", { class: "sign-trait" }, `${chinese.animal}: ${chinese.trait}.`),
    sun.cuspWith
      ? el(
          "p",
          { class: "note" },
          `Right on the cusp with ${sun.cuspWith.name} - the boundary shifts by a day from year to year, so either could be fair.`,
        )
      : null,
  );
}

function bornBody(baby: Baby, ctx: AppContext): HTMLElement {
  const birthDate = baby.birthDate as string;
  const birth = parseDate(birthDate);
  const age = describeAge(birthDate, ctx.now);
  const birthday = nextBirthday(birthDate, ctx.now);
  const rhyme = dayOfWeekRhyme(birth);
  const weight = baby.birthWeightGrams ? describeWeight(baby.birthWeightGrams) : null;
  const length = baby.birthLengthCm ? describeLength(baby.birthLengthCm) : null;

  const points = milestones(birthDate, ctx.now);

  return el(
    "div",
    { class: "stack" },
    el(
      "div",
      { class: "hero-stat" },
      el("span", { class: "hero-number" }, age.label),
      el(
        "span",
        { class: "hero-sub" },
        birthday.isToday
          ? `\u{1F382} Turns ${ordinal(birthday.turning)} today`
          : `Turns ${ordinal(birthday.turning)} in ${birthday.daysUntil} days`,
      ),
    ),
    signPanel(birth, "Written in the stars"),
    section(
      "Born",
      el(
        "div",
        { class: "facts" },
        factCard("Day", formatDate(birth), baby.birthTime ? `at ${baby.birthTime}` : undefined),
        weight ? factCard("Weight", weight.metric, weight.imperial) : null,
        length ? factCard("Length", length.metric, length.imperial) : null,
        factCard("Birthstone", birthstone(birth)),
        factCard("Flower", birthFlower(birth)),
        factCard("Weekday", rhyme.day),
      ),
      el("p", { class: "rhyme" }, `\u201C${rhyme.line}.\u201D`),
    ),
    section(
      "Milestones",
      el(
        "ol",
        { class: "timeline" },
        ...points.map((point) =>
          el(
            "li",
            { class: point.done ? "timeline-item done" : "timeline-item" },
            el("span", { class: "timeline-dot", "aria-hidden": "true" }),
            el("span", { class: "timeline-label" }, point.label),
            el(
              "span",
              { class: "timeline-when" },
              point.done
                ? formatDate(point.date)
                : `${formatDate(point.date)} \u00b7 in ${point.daysUntil} days`,
            ),
          ),
        ),
      ),
    ),
  );
}

function expectingBody(baby: Baby, ctx: AppContext): HTMLElement {
  const due = baby.dueDate ? dueCountdown(baby.dueDate, ctx.now) : null;

  // The one button you want the moment the news arrives, so it sits directly
  // under the countdown rather than behind the edit form.
  const arrived = el(
    "button",
    {
      class: "primary block",
      type: "button",
      onclick: () => ctx.navigate(`#/born/${encodeURIComponent(baby.id)}`),
    },
    "\u{1F389} Just born!",
  );

  if (!due) {
    return el(
      "div",
      { class: "stack" },
      el(
        "div",
        { class: "hero-stat" },
        el("span", { class: "hero-number" }, "On the way"),
        el("span", { class: "hero-sub" }, "Add a due date to start the countdown."),
      ),
      arrived,
    );
  }

  const progress = Math.max(0, Math.min(1, due.week / 40));

  return el(
    "div",
    { class: "stack" },
    el(
      "div",
      { class: "hero-stat" },
      el("span", { class: "hero-number" }, due.label),
      el(
        "span",
        { class: "hero-sub" },
        `Week ${due.week} \u00b7 ${ordinal(due.trimester)} trimester \u00b7 ${formatDate(due.date)}`,
      ),
      el(
        "div",
        {
          class: "progress",
          role: "progressbar",
          "aria-valuenow": String(due.week),
          "aria-valuemin": "0",
          "aria-valuemax": "40",
        },
        el("div", { class: "progress-fill", style: `width:${Math.round(progress * 100)}%` }),
      ),
    ),
    arrived,
    signPanel(due.date, "If they arrive on time"),
    el(
      "p",
      { class: "note" },
      "Babies rarely read the calendar, so the sign may well change on the day.",
    ),
  );
}

/** How a sibling is getting on, in the few words that fit on one line. */
function siblingStatus(baby: Baby, now: Date): string {
  if (baby.status === "born" && baby.birthDate) return describeAge(baby.birthDate, now).label;
  return baby.dueDate ? dueCountdown(baby.dueDate, now).label : "on the way";
}

function familySection(baby: Baby, ctx: AppContext): HTMLElement {
  const siblings = siblingsOf(baby, ctx.babies);

  return section(
    "Family",
    ...siblings.map((sibling) =>
      el(
        "button",
        {
          class: "sibling",
          type: "button",
          onclick: () => ctx.navigate(`#/baby/${encodeURIComponent(sibling.id)}`),
        },
        avatar(sibling, "sm"),
        el(
          "span",
          { class: "sibling-text" },
          el("span", { class: "sibling-name" }, displayName(sibling)),
          el(
            "span",
            { class: "sibling-meta" },
            `${relation(baby, sibling)} \u00b7 ${siblingStatus(sibling, ctx.now)}`,
          ),
        ),
      ),
    ),
    el(
      "button",
      {
        class: "secondary",
        type: "button",
        onclick: () => ctx.navigate(`#/sibling/${encodeURIComponent(baby.id)}`),
      },
      siblings.length > 0 ? "\uFF0B Another one" : "\uFF0B Add a sibling",
    ),
  );
}

export function renderDetail(ctx: AppContext, baby: Baby): HTMLElement {
  const parents = describeParents(baby.parents);

  const giftToggle = el(
    "button",
    {
      class: baby.giftSent ? "gift-toggle done" : "gift-toggle",
      type: "button",
      "aria-pressed": String(Boolean(baby.giftSent)),
      onclick: async () => {
        await ctx.repo.save({ ...baby, giftSent: !baby.giftSent });
        await ctx.refresh();
        ctx.toast(baby.giftSent ? "Marked as not sent" : "Gift marked as sent");
        // Nothing navigates, so the tick has to be redrawn where it stands.
        ctx.redraw();
      },
    },
    baby.giftSent ? "\u2713 Gift sent" : "Mark gift as sent",
  );

  return popup({
    title: displayName(baby),
    wide: true,
    onClose: () => ctx.back(),
    actions: [
      iconButton("Edit", "\u270E", () => ctx.navigate(`#/edit/${encodeURIComponent(baby.id)}`)),
    ],
    body: [
      el(
        "div",
        { class: "hero" },
        avatar(baby, "lg"),
        el("h2", { class: "hero-name" }, displayName(baby)),
        parents ? el("p", { class: "hero-parents" }, parents) : null,
        baby.sex && baby.sex !== "surprise"
          ? chip(baby.sex === "girl" ? "Girl" : "Boy")
          : null,
      ),
      baby.status === "born" && baby.birthDate
        ? bornBody(baby, ctx)
        : expectingBody(baby, ctx),
      baby.parents.length > 0 ? familySection(baby, ctx) : null,
      albumSection(baby, ctx),
      baby.notes ? section("Notes", el("p", { class: "notes" }, baby.notes)) : null,
      section(
        "Keeping up",
        giftToggle,
        el(
          "button",
          {
            class: "primary block",
            type: "button",
            onclick: async () => {
              try {
                const said = await shareCard(baby, ctx.now);
                if (said) ctx.toast(said);
              } catch (error) {
                ctx.toast(error instanceof Error ? error.message : "Could not make a card.");
              }
            },
          },
          "\u{1F48C} Share a card",
        ),
        el(
          "button",
          {
            class: "secondary",
            type: "button",
            onclick: () => {
              downloadFile(
                `${displayName(baby).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`,
                "text/calendar",
                toICalendar([baby], ctx.now),
              );
              ctx.toast("Calendar file saved - open it to add the date");
            },
          },
          "\u{1F4C5} Add to my calendar",
        ),
      ),
      el(
        "div",
        { class: "danger-zone" },
        el(
          "button",
          {
            class: "quiet danger",
            type: "button",
            onclick: () => ctx.navigate(`#/remove/${encodeURIComponent(baby.id)}`),
          },
          "Remove",
        ),
      ),
    ],
  });
}
