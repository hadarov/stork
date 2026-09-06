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
  parseDate,
  starSign,
} from "../domain/derive.ts";
import { relation, siblingsOf } from "../domain/family.ts";
import {
  britMilah,
  chagOn,
  hebrewBirthday,
  hebrewDateText,
  type Brit,
} from "../domain/hebrew.ts";
import { toICalendar } from "../domain/ics.ts";
import { lifeStage } from "../domain/stage.ts";
import type { Baby } from "../domain/types.ts";
import type { Catalog } from "../i18n/en.ts";
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

/**
 * The day of the week, from the language's own locale. The nursery rhyme names
 * it in English only, but which day it was is worth knowing in any language.
 */
function weekdayName(date: Date, t: Catalog): string {
  return date.toLocaleDateString(t.dateLocale, { weekday: "long" });
}

function signPanel(date: Date, heading: string, t: Catalog): HTMLElement {
  const words = t.baby.detail;
  const sun = starSign(date, t);
  const chinese = chineseSign(date, t);

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
        el("span", { class: "sign-meta" }, words.signMeta(sun.element, sun.range)),
      ),
      el(
        "div",
        { class: "sign" },
        el("span", { class: "sign-emoji", "aria-hidden": "true" }, chinese.emoji),
        el("span", { class: "sign-name" }, words.chineseName(chinese.element, chinese.animal)),
        el("span", { class: "sign-meta" }, words.chineseYear(chinese.animal, chinese.year)),
      ),
    ),
    el("p", { class: "sign-trait" }, words.trait(sun.name, sun.trait)),
    el("p", { class: "sign-trait" }, words.trait(chinese.animal, chinese.trait)),
    sun.cuspWith ? el("p", { class: "note" }, words.cusp(sun.cuspWith.name)) : null,
  );
}

function bornBody(baby: Baby, ctx: AppContext): HTMLElement {
  const t = ctx.t;
  const words = t.baby.detail;
  const birthDate = baby.birthDate as string;
  const birth = parseDate(birthDate);
  const age = describeAge(birthDate, ctx.now, t, baby.sex);
  const birthday = nextBirthday(birthDate, ctx.now);
  const rhyme = dayOfWeekRhyme(birth, t);
  const weight = baby.birthWeightGrams ? describeWeight(baby.birthWeightGrams, t) : null;
  const length = baby.birthLengthCm ? describeLength(baby.birthLengthCm, t) : null;

  const points = milestones(birthDate, ctx.now, t);

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
          ? words.birthdayToday(birthday.turning, baby.sex)
          : words.birthdayIn(birthday.turning, birthday.daysUntil, baby.sex),
      ),
    ),
    signPanel(birth, words.stars, t),
    section(
      words.bornSection,
      el(
        "div",
        { class: "facts" },
        factCard(
          words.factDay,
          formatDate(birth, t),
          baby.birthTime ? words.atTime(baby.birthTime) : undefined,
        ),
        weight ? factCard(words.factWeight, weight.metric, weight.imperial) : null,
        length ? factCard(words.factLength, length.metric, length.imperial) : null,
        factCard(words.factBirthstone, birthstone(birth, t)),
        factCard(words.factFlower, birthFlower(birth, t)),
        factCard(words.factWeekday, weekdayName(birth, t)),
      ),
      // The rhyme exists in English and nowhere else. A language without one
      // says nothing rather than leaving a gap where a verse was.
      rhyme ? el("p", { class: "rhyme" }, words.rhyme(rhyme.line)) : null,
    ),
    section(
      words.milestonesSection,
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
                ? formatDate(point.date, t)
                : words.milestoneWhen(formatDate(point.date, t), point.daysUntil),
            ),
          ),
        ),
      ),
    ),
  );
}

function expectingBody(baby: Baby, ctx: AppContext): HTMLElement {
  const t = ctx.t;
  const words = t.baby.detail;
  const due = baby.dueDate ? dueCountdown(baby.dueDate, ctx.now, t) : null;

  // The one button you want the moment the news arrives, so it sits directly
  // under the countdown rather than behind the edit form.
  const arrived = el(
    "button",
    {
      class: "primary block",
      type: "button",
      onclick: () => ctx.navigate(`#/born/${encodeURIComponent(baby.id)}`),
    },
    words.justBorn(baby.sex),
  );

  if (!due) {
    return el(
      "div",
      { class: "stack" },
      el(
        "div",
        { class: "hero-stat" },
        el("span", { class: "hero-number" }, words.onTheWay),
        el("span", { class: "hero-sub" }, words.noDueDate),
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
        words.dueLine(
          t.due.week(due.week),
          t.due.trimester(due.trimester),
          formatDate(due.date, t),
        ),
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
    signPanel(due.date, words.starsIfOnTime, t),
    el("p", { class: "note" }, words.signMayChange),
  );
}

/* -------------------------------------------------------- Hebrew calendar */

/**
 * Still worth a card this long after the eighth day. Past that it stops being
 * news and the page has nothing to add by keeping it.
 */
const BRIT_RECENT_DAYS = 14;

function britCard(brit: Brit, t: Catalog): HTMLElement {
  const on = t.hebrew.britOn(formatDate(brit.date, t));
  if (brit.daysUntil === 0) return factCard(t.hebrew.brit, t.hebrew.britToday, on);
  if (brit.done) return factCard(t.hebrew.britPassed, formatDate(brit.date, t));
  return factCard(t.hebrew.brit, t.hebrew.britIn(brit.daysUntil), on);
}

/**
 * What the Hebrew calendar has to add, which is more than a second spelling of
 * a date already on the page: the Hebrew year is lunisolar, so a Hebrew
 * birthday walks around the Gregorian one by a couple of weeks each year and
 * lands on a genuinely different day.
 */
function hebrewSection(baby: Baby, ctx: AppContext): HTMLElement | null {
  const t = ctx.t;
  const words = t.baby.detail;

  if (baby.status === "born" && baby.birthDate) {
    const birth = parseDate(baby.birthDate);
    const birthday = hebrewBirthday(baby.birthDate, ctx.now);
    const chag = chagOn(birth);
    // A brit is a boy's, and only while it is ahead or still recent.
    const brit = baby.sex === "boy" ? britMilah(baby.birthDate, ctx.now) : null;

    return section(
      t.hebrew.section,
      el(
        "div",
        { class: "facts" },
        factCard(t.hebrew.born, hebrewDateText(birth, t)),
        factCard(
          birthday.isToday ? t.hebrew.birthdayToday : t.hebrew.birthday,
          formatDate(birthday.date, t),
          birthday.isToday
            ? t.hebrew.turning(birthday.turning)
            : words.hebrewBirthdayMeta(
                birthday.daysUntil,
                t.hebrew.turning(birthday.turning),
              ),
        ),
        brit && brit.daysUntil >= -BRIT_RECENT_DAYS ? britCard(brit, t) : null,
      ),
      chag ? el("p", { class: "sign-trait" }, t.hebrew.bornOn(t.hebrew.chag[chag])) : null,
      // Where the date came from, said once and quietly, because the app has a
      // civil date and a Hebrew day turns over at sunset.
      el("p", { class: "note" }, t.hebrew.sunset),
      birthday.moved ? el("p", { class: "note" }, t.hebrew.moved) : null,
    );
  }

  if (!baby.dueDate) return null;

  const due = parseDate(baby.dueDate);
  const chag = chagOn(due);

  return section(
    t.hebrew.section,
    el("div", { class: "facts" }, factCard(words.hebrewDue, hebrewDateText(due, t))),
    chag ? el("p", { class: "sign-trait" }, t.hebrew.dueOn(t.hebrew.chag[chag])) : null,
  );
}

/* ----------------------------------------------------------------- family */

/** How a sibling is getting on, in the few words that fit on one line. */
function siblingStatus(baby: Baby, now: Date, t: Catalog): string {
  if (baby.status === "born" && baby.birthDate) {
    return describeAge(baby.birthDate, now, t, baby.sex).label;
  }
  return baby.dueDate ? dueCountdown(baby.dueDate, now, t).label : t.stage.egg;
}

function familySection(baby: Baby, ctx: AppContext): HTMLElement {
  const t = ctx.t;
  const words = t.baby.detail;
  const siblings = siblingsOf(baby, ctx.babies);

  return section(
    words.familySection,
    ...siblings.map((sibling) =>
      el(
        "button",
        {
          class: "sibling",
          type: "button",
          onclick: () => ctx.navigate(`#/baby/${encodeURIComponent(sibling.id)}`),
        },
        avatar(sibling, ctx.now, t, "sm"),
        el(
          "span",
          { class: "sibling-text" },
          // dir="auto" on anything somebody typed, so a Hebrew name in an
          // English book reads the right way round, and the reverse too.
          el("span", { class: "sibling-name", dir: "auto" }, displayName(sibling, t)),
          el(
            "span",
            { class: "sibling-meta" },
            words.siblingMeta(
              relation(baby, sibling, t),
              siblingStatus(sibling, ctx.now, t),
            ),
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
      siblings.length > 0 ? words.anotherOne : words.addSibling,
    ),
  );
}

/**
 * A filename from the baby's name. Letters of any script survive, because a
 * Hebrew name put through an a-to-z filter comes out as nothing at all and the
 * file arrives called ".ics".
 */
function calendarFilename(baby: Baby, t: Catalog): string {
  const slug = (text: string) =>
    text.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-+|-+$/g, "");
  return `${slug(displayName(baby, t)) || slug(t.app.name)}.ics`;
}

export function renderDetail(ctx: AppContext, baby: Baby): HTMLElement {
  const t = ctx.t;
  const words = t.baby.detail;
  const parents = describeParents(baby.parents, t);
  const stage = lifeStage(baby, ctx.now, t);

  const giftToggle = el(
    "button",
    {
      class: baby.giftSent ? "gift-toggle done" : "gift-toggle",
      type: "button",
      "aria-pressed": String(Boolean(baby.giftSent)),
      onclick: async () => {
        await ctx.repo.save({ ...baby, giftSent: !baby.giftSent });
        await ctx.refresh();
        ctx.toast(baby.giftSent ? words.giftUnmarked : words.giftMarked);
        // Nothing navigates, so the tick has to be redrawn where it stands.
        ctx.redraw();
      },
    },
    baby.giftSent ? words.giftSent : words.markGift,
  );

  return popup({
    title: displayName(baby, t),
    wide: true,
    closeLabel: t.app.close,
    onClose: () => ctx.back(),
    actions: [
      iconButton(words.edit, "\u270E", () =>
        ctx.navigate(`#/edit/${encodeURIComponent(baby.id)}`),
      ),
    ],
    body: [
      el(
        "div",
        { class: "hero" },
        avatar(baby, ctx.now, t, "lg"),
        el("h2", { class: "hero-name", dir: "auto" }, displayName(baby, t)),
        // The way through to the household, from the one line that names it.
        parents
          ? el(
              "button",
              {
                class: "hero-parents",
                type: "button",
                dir: "auto",
                onclick: () => ctx.navigate(`#/brief/${encodeURIComponent(baby.id)}`),
              },
              parents,
            )
          : null,
        baby.sex && baby.sex !== "surprise"
          ? chip(baby.sex === "girl" ? words.girl : words.boy)
          : null,
        // Only appears once somebody has clearly repurposed a baby app.
        stage.aside ? el("p", { class: "aside" }, stage.aside) : null,
      ),
      baby.status === "born" && baby.birthDate
        ? bornBody(baby, ctx)
        : expectingBody(baby, ctx),
      ctx.jewish ? hebrewSection(baby, ctx) : null,
      baby.parents.length > 0 ? familySection(baby, ctx) : null,
      albumSection(baby, ctx),
      baby.notes
        ? section(words.notesSection, el("p", { class: "notes", dir: "auto" }, baby.notes))
        : null,
      section(
        words.keepingUpSection,
        giftToggle,
        el(
          "button",
          {
            class: "primary block",
            type: "button",
            onclick: async () => {
              try {
                const said = await shareCard(baby, ctx.now, t);
                if (said) ctx.toast(said);
              } catch (error) {
                ctx.toast(error instanceof Error ? error.message : words.cardFailed);
              }
            },
          },
          words.shareCard,
        ),
        el(
          "button",
          {
            class: "secondary",
            type: "button",
            onclick: () => {
              downloadFile(
                calendarFilename(baby, t),
                "text/calendar",
                toICalendar([baby], ctx.now, t, ctx.jewish),
              );
              ctx.toast(words.calendarSaved);
            },
          },
          words.addToCalendar,
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
          words.remove,
        ),
      ),
    ],
  });
}
