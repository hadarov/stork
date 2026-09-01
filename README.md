# Stork

A little book of everyone else's babies. Who is due when, who just arrived,
whose birthday is next, what their star sign is, and whether you ever did send
that gift.

It is a web app you add to your home screen, where it behaves like any other
app: its own icon, no browser chrome, and it works with no signal.

## Opening it on your phone

No app store and no Expo. Deploy it once (below), open the link on your phone,
and use **Add to Home Screen**.

Each person who opens the link gets their own private book. Nothing is uploaded
and nothing is shared, so your friends can use the same link without ever seeing
each other's lists.

## What it works out for you

Give it a name, whose baby it is, and a date. Everything else is derived:

- **Age** in the unit people actually use - days for the first fortnight, then
  weeks, then months, then years. A baby born today reads "born today", not
  "0 months old".
- **Due dates** as a countdown, with the week of pregnancy and the trimester a
  midwife would name, counting up again once the date passes.
- **Star sign**, with its element and a line about what that supposedly means.
  A birthday on the first or last day of a sign is flagged as a cusp rather than
  stated flatly, because the boundary really does move by a day between years.
- **Chinese zodiac**, animal and element. The animal turns over at Lunar New
  Year, not on 1 January, so January babies get the previous year's animal.
- **Birthstone, birth flower** and which day of the week they were born on,
  with the line from the old rhyme.
- **Milestones**: 100 days, half a year, first and second birthdays.

The home screen opens on a **This week** strip: anything due, arriving or having
a birthday in the next seven days, before anything else.

## Reminders

Web push on a home-screen app is unreliable enough not to depend on, so Stork
hands the dates to the calendar you already use instead. **Settings - Export
.ics** produces a file with every birthday as a yearly repeating event and every
due date as a one-off, each nudging you two days early. There is the same button
on an individual baby's page.

## Your data

Everything lives in this browser on this device. Nothing is uploaded, there is
no account, and there is no server to leak it.

The flip side is that clearing your browser data would take it with it, so
**Settings - Export** writes a backup file. Importing merges rather than
overwrites: the newer version of each baby wins, and deletions stay deleted.

## Deploying it

The build is static and needs nothing installed, so any host will do. For
Vercel, [`vercel.json`](vercel.json) already sets the build command, the output
directory and the cache headers:

```bash
npx vercel        # preview
npx vercel --prod # the link you send people
```

iOS only offers **Add to Home Screen** as a real app over https, which a Vercel
URL gives you. `npm run dev` over Wi-Fi is plain http, so it is for quick checks
rather than for installing.

## Running it locally

Requires [Node.js](https://nodejs.org/) 22.13 or newer. There are no
dependencies to install.

```bash
npm run build
npm run dev
```

That prints a `http://<your-ip>:8080` address as well as localhost, so you can
open it on a phone on the same Wi-Fi. Rerun `npm run build` after any change;
the server always serves the last build.

## Tests

```bash
npm run smoke
```

Two suites, no test framework to install. `scripts/smoke.ts` covers the date and
zodiac arithmetic - leap-year birthdays, Lunar New Year boundaries, sign cusps,
daylight saving, month-end clamping - as pure functions that take the current
time as an argument. `scripts/smoke-ui.ts` renders every screen against the
minimal DOM in `scripts/dom-stub.mjs` and asserts on the text a person would
actually read.

`npm run build` is a check in its own right: it refuses to emit a bundle whose
TypeScript does not parse, whose rewritten imports point at a file that was
never emitted, or which throws when loaded.

## No dependencies

There are none, and there is no bundler. TypeScript is erased by Node's own
stripper rather than compiled, so the browser runs the same source the tests
run against, minus the types; the build rewrites relative `.ts` imports to `.js`
so a browser can follow them natively. The app icons are drawn from shapes and
PNG-encoded on top of `node:zlib`, because a home-screen app needs real PNGs and
there was no image library to hand.

## Adding sync later

The app was written local-first but not local-only. Every screen reads and
writes through the `BabyRepo` interface in
[`src/storage/repo.ts`](src/storage/repo.ts), and `LocalRepo` is just one
implementation of it. Records carry a UUID, an `updatedAt` timestamp and soft
deletes via `deletedAt`, and `mergeRecords` already does the last-write-wins
fold that import uses today.

Adding a server therefore means writing a `CloudRepo` against the same three
methods. No screen changes.

## Layout

| Path | Role |
| --- | --- |
| `src/domain/derive.ts` | Age, countdowns, birthdays, milestones, what happens next |
| `src/domain/almanac.ts` | Star signs, Chinese zodiac, birthstones, flowers, the rhyme |
| `src/domain/lunarNewYear.ts` | The dates the zodiac animal turns over |
| `src/domain/ics.ts` | Calendar export |
| `src/storage/repo.ts` | The `BabyRepo` interface and the merge rule |
| `src/storage/localRepo.ts` | The localStorage implementation of it |
| `src/storage/migrate.ts` | Making untrusted stored or imported data safe to render |
| `src/ui/` | The four screens, the router and a small DOM helper |
| `web/` | HTML, CSS, manifest and the service worker template |
| `scripts/build.mjs` | Strips types, rewrites imports, draws icons, verifies the result |
| `scripts/icon.mjs` | Draws the chick and encodes a PNG |
| `scripts/serve.mjs` | Serves `dist/` on the local network |
