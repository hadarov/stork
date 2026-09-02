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

## How it is laid out

The book itself is a grid of squares, three to a line, one per baby, each in its
own colour and showing a photo if you have added one. Everything else - adding a
baby, their details, editing, settings - opens as a popup over that grid, so you
are never taken away from it and closing one always lands you back where you
were. Escape, the backdrop and the phone's back button all close a popup.

Confirmations stack over the page that raised them rather than replacing it, so
backing out of a question leaves you looking at the baby you were reading.

A baby is either on the way or here, and that decides which date you are asked
for: a bump has a due date, a baby has a birthday, and never both. Changing one
to the other clears the date that no longer applies. Parents are two separate
fields and only the first is expected.

When the news lands, a bump's page has a **Just born!** button that turns them
into a baby, offering today's date and letting you pick another. Removing a baby
asks first, in a popup that stacks over their page so backing out of the
question leaves you exactly where you were.

## The look

Dark, soft and quiet, with one accent: the sage of the app's own egg. Every
emphasis is that colour and nothing else is - buttons, focus, the age under a
name in the grid, a milestone reached - so the eye only has to learn it once.
The six pastels belong to the babies and are the only other colour in the app.

Definition comes from hairlines rather than outlines drawn round everything, and
there are two of them because they sit on different things: `--edge` for neutral
surfaces, which is light on dark and dark on light, and `--edge-tint` for
anything on a pastel, which is dark in both because the pastel is. Ink works the
same way - `--ink` flips with the theme, `--on-tint` never does.

The tint sits on the square rather than the whole tile, so the grid reads as
photographs, with the name, whose baby it is and how far along underneath.

Dark is the default. **Settings - Look** offers Auto, Dark and Light, and an
inline script in `index.html` settles the choice before the first paint so a
light-mode phone does not flash black on every launch.

## Eggs and chicks

Whoever it is, the picture is where they have got to: an egg on the way, a
hatchling for the first year, and a chick after that.

The app's own icon is that first egg with a date circled round it, drawn in the
accent colour, so the mark, the palette and the two things the app does are all
one idea.

Above that the ladder keeps going, which is the easter egg. Somebody will
eventually put a grown adult in here to stop forgetting their birthday, and the
app noticing - a chicken at thirteen, a rooster at eighteen, a turkey at forty,
with a dry line on their page - is funnier and kinder than the app insisting
they are a chick. Nobody who is actually a baby ever sees any of it.

## Picking a date

One control split into three rather than an `<input type="date">`: a single
bordered box with hairlines between day, month and year, so a date still reads
as one answer. The native control is a different thing on every platform, none
of them can be styled to match, and all of them will happily accept the 31st of
February.

The lists are narrowed instead, so an impossible date cannot be picked: only the
days that month has, only leap years get the 29th, and a birthday cannot be set
later than today. A due date is deliberately left alone in both directions,
because bumps go overdue and get added late. Changing January to February drops
a 31st rather than quietly keeping it, and a part left blank means no date
rather than an error.

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

Birth weight and length are the two things it cannot work out, so it asks. They
are stored in grams and centimetres and shown both ways round, because whoever
announced it said one and whoever reads the page is thinking in the other.

The home screen opens on a **This week** strip: anything due, arriving or having
a birthday in the next seven days, before anything else.

## Families

Two babies who share a parent's name are siblings, worked out from what you
already typed rather than declared anywhere. A baby's page names the relation
from the other's point of view - big sister, little brother, or just an older
sibling when you have not said - and anyone still on the way is the younger one.
**Add a sibling** opens a new baby with the parents already filled in.

## Albums

Their picture, the one on the tile, is set in the form. The album beside it is a
separate thing: dated photos in a strip that reads oldest to newest, each with
its own page where the date and a caption can be corrected, or which can be
promoted to being their picture. Twelve each, because the whole book is data
URLs inside a few megabytes of `localStorage`.

## Sending a card

**Share a card** draws the baby's page as a portrait PNG - their colour, their
photo, the age or the countdown across the middle, their signs as badges - and
hands it to the phone's share sheet, so the point of keeping all this is that
you can actually say congratulations. Where there is no share sheet it saves
the file instead.

It is drawn rather than screenshotted, so it looks the same from any phone and
carries none of the app's furniture.

## The brief

The thirty seconds before you walk in, which is what the rest of the app is for.
Tapping the parents' names on any baby's page gives you their whole household on
a single screen: what is coming, every baby in it with their age, and whether
you have sent anything.

There used to be a separate screen listing every household as a way in. It went,
because the grid names the parents on every tile now, which made it a second
door into the same room.

The gift line is the part worth having. A tick told you nothing, so it says
either that you sent something or that you did not and how old they are by now,
with a month's grace for a newborn. If you have written no notes about any of
them it says so, because the notes are the only part it cannot work out for you.

Households are found by following shared parent names from baby to baby, which
makes one baby naming two parents the thing that joins those two people's lists
into one. Occasionally that merges a family it should not have, and the fix is a
fuller name.

## Reminders

Two per occasion: a week before, and at nine on the morning itself. **Settings -
Turn on reminders** asks the browser, and then says plainly what that browser
will actually do, because the answer differs a lot:

| Where | What happens |
| --- | --- |
| Installed, on Chromium | Arrives on time, with Stork closed |
| In a tab | It offers to be added to the home screen instead |
| Everywhere else, Safari included | Only checked when you open Stork, so it can arrive late |

A reminder that arrives while the app is closed needs the browser to wake the
service worker on a schedule. Chromium does that through Periodic Background
Sync, for an installed app, at a time it chooses and never promises. Safari's
push support needs a server pushing to it and there is no server here, so it is
not offered a promise it cannot keep.

Which is why the calendar export has not gone anywhere, and is still the
dependable route. **Settings - Export .ics** produces a file with every birthday
as a yearly repeating event and every due date as a one-off, each nudging you
two days early. There is the same button on an individual baby's page.

Everything about *what* to say is worked out in the app and written to
IndexedDB as a finished list of lines and timestamps. The worker wakes up much
later, reads the clock, and has nothing to decide. Anything whose moment passed
while nobody was watching is ticked off rather than fired late, so coming back
after a fortnight away does not set off a fortnight of alerts.

## Your data, and surviving a new phone

Everything lives in this browser on this device. Nothing is uploaded, there is
no account, and there is no server to leak it. The flip side is that clearing
your browser data would take it with it.

So instead of a server, **Settings - Back up** puts the whole book in a file
wherever you say, and the trick is to say a folder your phone already syncs:
iCloud Drive, Google Drive, Dropbox. That folder is then the sync, and a new
phone is a matter of opening that file.

How it gets there depends on the browser, and Stork picks the best of the three
without asking you which:

| Where | How | What you get |
| --- | --- | --- |
| Chrome, Edge, Android | The file picker, and the handle is remembered in IndexedDB | Pick the folder once, then **Keep it updated** rewrites the same file a couple of seconds after any change |
| iOS Safari | The share sheet | Tap **Back up**, choose **Save to Files**, and put it in iCloud Drive |
| Anything older | A plain download | It lands in Downloads and where it goes next is up to you |

The automatic rewrite only ever *queries* the folder permission, never requests
it, because requesting needs a tap and a background backup has not got one. If
the permission has lapsed it stays quiet and the settings line goes yellow, so
a failed backup looks like a stale one rather than like nothing at all.

Every write goes through a repo wrapper rather than through a convention that
each screen remembers, so no change can slip past the backup unrecorded.

Restoring merges rather than overwrites: the newer version of each baby wins,
and deletions stay deleted.

## Deploying it

The build is static and needs nothing installed, so any host will do. Two are
already set up.

**GitHub Pages.** [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
runs the tests, builds and publishes `dist/` on every push to `main`. Create the
repository, then set **Settings - Pages - Source** to **GitHub Actions** and
push. `dist/` is not committed, so the workflow is the only thing that ever
produces the deployed copy.

Pages serves from a subpath, `https://you.github.io/stork/`. Every path in the
app is relative for exactly this reason - the manifest, the icons, the service
worker registration and its precache list - so nothing needs changing. Pages
also fixes its own cache headers at ten minutes, which the service worker
cannot override, so a new version can take that long to reach a phone that
already has the app installed.

**Vercel.** [`vercel.json`](vercel.json) sets the build command, the output
directory and better cache headers than Pages allows, including a `sw.js` that
is never cached:

```bash
npx vercel        # preview
npx vercel --prod # the link you send people
```

Either way, iOS only offers **Add to Home Screen** as a real app over https.
`npm run dev` over Wi-Fi is plain http, so it is for quick checks rather than
for installing.

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

The cloud-folder backup above is deliberately not that: it is a file, not a
sync, and two phones editing at once would each overwrite the other's file. It
buys the thing people actually want from sync - not losing the book - without
anyone having to run or pay for anything. When a real server does arrive, the
plan is a one-time code by email rather than passwords.

## Layout

| Path | Role |
| --- | --- |
| `src/domain/derive.ts` | Age, countdowns, birthdays, milestones, what happens next |
| `src/domain/almanac.ts` | Star signs, Chinese zodiac, birthstones, flowers, the rhyme |
| `src/domain/lunarNewYear.ts` | The dates the zodiac animal turns over |
| `src/domain/family.ts` | Who is whose sibling, and which households that makes |
| `src/domain/stage.ts` | Egg, hatchling, chick, and the rungs above that |
| `src/domain/calendar.ts` | Which days a month has, and which to offer at all |
| `src/domain/nudges.ts` | What each reminder says and the moment it says it |
| `src/domain/nudgeStatus.ts` | The honest account of what this browser will do |
| `src/domain/card.ts` | What goes on a shared card, apart from the drawing of it |
| `src/domain/ics.ts` | Calendar export |
| `src/storage/repo.ts` | The `BabyRepo` interface and the merge rule |
| `src/storage/localRepo.ts` | The localStorage implementation of it |
| `src/storage/migrate.ts` | Making untrusted stored or imported data safe to render |
| `src/storage/vault.ts` | Picking a folder, remembering it, writing to it again |
| `src/storage/idb.ts` | The one keyed box in IndexedDB that the worker also reads |
| `src/storage/nudgeStore.ts` | Handing the reminder list over to the worker |
| `src/storage/watchRepo.ts` | The wrapper that says when something was written |
| `src/ui/keeper.ts` | Keeping the backup file current, and the three ways to |
| `src/domain/backupStatus.ts` | The one line that says whether you are safe |
| `src/ui/home.ts` | The grid, the search and the "this week" strip |
| `src/ui/brief.ts` | One household on one screen, for the walk from the car |
| `src/ui/dateField.ts` | The three dropdowns that stand in for a date input |
| `src/ui/nudger.ts` | Asking for permission, and keeping the list current |
| `src/ui/theme.ts` | Dark, light, or whatever the phone says |
| `src/ui/modal.ts` | The popup every other screen is rendered into |
| `src/ui/album.ts` | The photo strip and the viewer behind it |
| `src/ui/card.ts` | Drawing the shareable card onto a canvas |
| `src/ui/` | The rest: detail, form, prompts, settings, router, a DOM helper |
| `web/` | HTML, CSS, manifest and the service worker template |
| `scripts/build.mjs` | Strips types, rewrites imports, draws icons, verifies the result |
| `scripts/icon.mjs` | Draws the chick and encodes a PNG |
| `scripts/serve.mjs` | Serves `dist/` on the local network |
