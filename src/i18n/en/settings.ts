/*
 * Settings, and the notice cards about backups, installing and storage.
 *
 * This is the chattiest area of the app, on purpose. Everything here is a
 * promise about somebody's data, so the wording says what the browser will
 * really do - including the times it will do nothing at all - rather than what
 * the feature is called. Keep it level: no reassurance that is not true.
 *
 * Anything with a value in it is a function, because the pieces do not come in
 * the same order in every language.
 */
export const enSettings = {
  /* ------------------------------------------------------- the sheet itself */

  settings: {
    title: "Settings",
    /** The cross on a notice card, for anyone listening rather than looking. */
    notNow: "Not now",

    langSection: "Language",
    langLabel: "Language",
    /** The only option with no language of its own to be labelled in. */
    langSystem: "System",
    langNote:
      "Follows your phone unless you say otherwise. Hebrew brings the layout with it, right to left.",

    jewishSection: "Hebrew calendar",
    jewishNote:
      "The Hebrew date of birth, the Hebrew birthday, the brit and any chag a baby was born on, on their page. On in Hebrew and off in English, unless you settle it here.",
    jewishLabel: "Hebrew calendar",
    jewishAuto: "Auto",
    jewishOn: "On",
    jewishOff: "Off",

    lookSection: "Look",
    lookNote:
      "Dark by default. The babies keep their colours either way - they are the only part that should be shouting.",
    themeLabel: "Theme",
    themeAuto: "Auto",
    themeDark: "Dark",
    themeLight: "Light",

    remindersSection: "Reminders",
    turnOnNudges: "Turn on reminders",

    calendarSection: "Your dates, elsewhere",
    calendarTitle: "Add every date to your calendar",
    calendarBody:
      "Birthdays repeat every year, due dates land once, and both nudge you two days early.",
    exportIcs: "Export .ics",
    nothingToExport: "No dates to export yet",
    exported: "Calendar file saved - open it to add every date",

    aboutSection: "About",
    aboutWhat:
      "Stork keeps up with your friends' babies so you do not have to: who is due when, who just arrived, whose birthday is next, and whether you ever did send that gift.",
    aboutSigns:
      "Star sign dates shift by a day between years, so a birthday on a boundary is flagged rather than guessed. The Chinese zodiac turns over at Lunar New Year, not on 1 January.",
  },

  /* --------------------------------------------------------------- backups */

  backup: {
    section: "Backup",
    onDevice:
      "Everything you add lives on this device only. Nothing is uploaded and nobody else can see it, which also means clearing your browser data would take it with it.",
    syncFolder:
      "Put the backup somewhere your phone already syncs - iCloud Drive, Google Drive, Dropbox - and it will follow you to a new phone without anyone running a server for you.",

    nowTitle: "Back up now",
    nowBodyAuto: "Written automatically whenever anything changes.",
    nowBodyManual: "Choose the folder once; after that it is one tap.",
    nowAction: "Back up",

    autoTitle: "Keep it updated",
    autoBodyOn: "On. The same file is rewritten a couple of seconds after any change.",
    autoBodyOff: "Rewrite that file by itself, so you never have to remember.",
    turnOn: "Turn on",
    turnOff: "Turn off",

    restoreTitle: "Restore a backup",
    restoreBody: "Merges rather than overwrites: the newer version of each baby wins.",
    restoreAction: "Import",

    /* ------------------------------------------------------ what came of it */

    savedTo: (file: string) => `Saved to ${file}`,
    /** The one place iOS has to be told what to tap, since we cannot tap it. */
    saveToFiles: "Choose Save to Files to keep it in iCloud Drive",
    toDownloads: "Backup saved to your downloads",
    /** The heading on the iOS share sheet. */
    shareTitle: "Stork backup",
    autoNowOff: "Backups are yours to make now",
    autoNowOn: (file: string) => `${file} will be kept up to date`,
    merged: (added: number, updated: number, skipped: number) =>
      `${added} added, ${updated} updated, ${skipped} already current`,
    nothingReadable: "Nothing readable in that file",
    unreadable: "Could not read that file",
    writeFailed: "Could not write the backup",

    /* --------------------------------------- the one line about where it is */

    nothingYet: "Nothing to back up yet",
    babies: (n: number) => `${n} ${n === 1 ? "baby" : "babies"}`,
    never: (book: string) => `${book}, never backed up`,
    today: (book: string) => `${book}, backed up today`,
    yesterday: (book: string) => `${book}, backed up yesterday`,
    daysAgo: (book: string, days: number) => `${book}, backed up ${days} days ago`,
    outOfDate: (line: string) => `${line} - out of date`,

    /* ------------------------------------------------ bringing it up unasked */

    stoppedTitle: "Automatic backups have stopped",
    stoppedLine:
      "Stork cannot write to the folder you chose any more. Backing up once by hand hooks it back on.",
    noneTitle: "Nothing is backed up yet",
    noneLine: "All of this lives on this device. Clearing your browser data would take it with it.",
    staleTitle: "Your backup is out of date",
    staleLine: "Something has changed since the last one was written.",
    nudgeAction: "Back up now",
  },

  /* -------------------------------------------- whether the device holds on */

  storage: {
    askTitle: "Ask your browser to keep it",
    askBody:
      "Takes Stork off the list of things cleared to make room. It cannot stop you clearing your browsing data by hand, and nothing can.",
    askAction: "Ask",

    silent:
      "This browser will not say whether it keeps Stork's data or clears it when it needs the room.",
    persisted:
      "Your browser has agreed not to clear Stork's data by itself. Clearing your browsing data by hand still would.",
    sweepsInstalled:
      "Safari deletes a site's data after seven days without opening it. On the home screen Stork is counted on its own, so opening it now and again is enough.",
    sweepsInTab:
      "Safari deletes a site's data after seven days without opening it. Adding Stork to your home screen gives it a clock of its own.",
    mayClear: "Your browser may clear Stork's data if it runs short of room.",

    // What comes back from actually asking, which is a different thing from
    // the standing description above it.
    wontAnswer: "This browser will not answer that.",
    agreed: "Your browser has agreed to keep it.",
    refused: "Your browser would not promise. The backup is the answer either way.",
  },

  /* ------------------------------------------------------------- reminders */

  nudges: {
    cannot: "This browser will not show reminders at all.",
    refused:
      "You turned reminders down. Undoing that has to happen in your browser's settings for this site.",
    offer: "A nudge a week before, and one on the morning itself.",
    onProperly: "On. A week before and on the morning, whether or not Stork is open.",
    onlyOpen:
      "On, but only while Stork is open. Add it to your home screen and it can reach you properly.",
    onlyOnLaunch:
      "On, but this browser only checks when you open Stork, so a reminder can arrive late. The calendar export is the dependable one.",
  },

  /* ------------------------------------------------------------ installing */

  install: {
    title: "Keep Stork on your home screen",
    // Worth saying rather than assumed: people install things they understand
    // the point of, and "works with no signal" is the part that is not obvious.
    line: "It gets its own icon, opens without the address bar, and keeps working with no signal.",
    action: "Install Stork",
    /** Named the way the iOS share sheet names them, so they can be found. */
    steps: ["Tap the Share button", "Scroll down to Add to Home Screen", "Tap Add"],

    ownMenu: "This browser installs from its own menu.",
    installing: "Installing - look for Stork on your home screen.",
    declined: "No bother. The button stays in Settings.",
  },
};
