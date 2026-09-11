<!--
Every fact below was checked against the shipped code (not memory), mostly in
shells/web/src/components/search-bar.ts, shells/web/src/components/spotlight.ts,
shells/web/src/lib/search/{match,registry}.ts and the seven provider modules
under shells/web/src/lib/search/providers/, and against `ROUTES` in
shells/web/src/main.ts for exactly which routes show the bar. The feature is
fully shipped (main branch, commit ade7d3a), not a work-in-progress - unlike
the collab page, nothing here needs a "drill" annotation. Neither screenshot
below has been captured as of this page landing; both are recipes only.
-->

# Search

One search field, always in the same place at the bottom of the screen, that
reaches your tools, your saved work, the catalogue and your own
settings. Type from wherever you happen to be: either the list already in
front of you narrows, or a small panel opens above the field with what
matched.

## Where it lives

The field sits in the middle of the bar fixed to the bottom of the window, the
same bar that carries the Dashboard and Verify links.

<!--
SHOT NOTE (srch-footer-closed): the bar `footerNav()` writes is
`[Pro?] [Dashboard] <search> [Verify] [What?]`, and the Pro link renders unless
the `pro-batch` flag is explicitly off - flags default ON and the capture
context seeds nothing for it, so Pro WILL be in frame. The alt text below names
it for that reason; drop the word if a future capture profile turns Pro off.
-->
 It's one field for the
whole app rather than a different box on every screen, and it follows you: it
shows on the Tools gallery, Utilities, the Catalogue, Projects, the Dashboard
and Profile.

![the persistent search bar at rest: Pro and Dashboard on the left, the search field with its magnifier icon and a Ctrl-Space hint chip, Verify and What? on the right](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&cropSelector=.gallery-footer&dark=1&filename=srch-footer-closed)

It doesn't show everywhere. Once you're inside a tool's own canvas, Batch
mode, Verify, Convert, the spreadsheet, the Colour Lab, the PDF tool,
Multi-edit, the Design System studio, the component library, Script audio or
Ask Lolly, the bar is gone and the shortcut below does nothing - those
surfaces keep their own chrome for now (Ask Lolly has its own composer). That's
a narrower gap than the list makes it sound: every one of those except
Multi-edit is still a destination you can search your way *to*, from any screen
that does show the bar - they're in the Places group below, and Ask Lolly gets
a group of its own. Multi-edit is the one place search doesn't know about yet.

Search also reaches Lolly from outside the app. The installed apps own the
`lolly://` URL scheme, so a launcher's "open URL" action (Raycast, Alfred,
PowerToys Run), a macOS Shortcut or a terminal `open` opens an exact tool
with its inputs filled, and on Linux the GNOME Shell search provider and KRunner
list Lolly's tools by name. The scheme and its grammar are in
[URL mode](/info/url-mode.html), under "The lolly:// scheme".

## What it finds

A match is sorted into groups, always shown in the same order:

- **Tools** and **Utilities** - by name, description and tag. Matching folds
  accents and case (typing "cafe" finds something named "Café"), and a name
  stays findable by its original English word even when you're using the app
  in another language.
- **Projects** - your saved sessions, by their name, their filename and the
  tool that made them, and your folders by name. It matches the session's own
  label, not anything inside it: it can't find a session by a word you typed
  into one of its fields.
- **Catalogue** - the design system's images, logos, audio and fonts, and
  anything you've uploaded yourself, by name, id, tag, category and format. Again, this
  is metadata, not contents: it can't find an image by what's actually in the
  picture.
- **Settings** - every settings section, the four accessibility preferences
  and the feature flags, matched on their names and on the words people
  actually search for ("dark mode", "calm", "storage").
- **Places** - the app's own destinations, most of which don't carry the bar
  themselves: Verify, Convert, the spreadsheet, the Colour Lab, the PDF tool,
  the Design System studio, the component library, Script audio and Batch
  mode. Typing "verify" or "oklch" takes you there directly.

<!--
ACCURACY NOTE for whoever merges this: "the feature flags" is deliberately not
"every feature flag". lib/search/providers/settings.ts indexes CATEGORY_FLAGS
plus a hand-listed STANDALONE_FLAGS (neurospicy, jelly, pro, strip-upload-meta,
preflight) - PRIVATE_COLLAB_FLAG is NOT in that array, so "private collab" is
currently unfindable in Settings. That is a one-line fix in the provider, and
this sentence can go back to "every" the moment it ships.
Places also carries Dashboard and Profile, which DO show the bar - hence "most
of which" rather than the flat claim.
-->

- **Docs** - this site: every published page and heading.
- **Ask** - always last, under whatever the other groups found: a single **Ask
  Lolly** row carrying what you typed into the in-app help view, where the
  answer is a documentation section quoted verbatim with its citation. It's the
  "didn't see it above?" row, not a result of its own.

What happens with a match depends on where you're standing. On the Tools
gallery, Utilities and the Catalogue, the grid you're already looking at
filters itself, exactly as it always has - that grid *is* the result, so its
own group is left out of the floating panel. On Projects, the Dashboard and
Profile, the screen behind never changes shape while you type: everything,
including your own projects and your own settings, shows in the panel
instead, so nothing you own can look like it quietly disappeared. Inside the
Tools, Utilities, Projects and Catalogue groups, a "See all in ..." row hands
off to a proper results view when a handful of matches isn't enough; Settings,
Places, Docs and Ask just end.

The panel itself floats centred over the whole window, not tucked under the
field, so it reads as one thing with the bar beneath it rather than a
dropdown off one corner.

![the search panel open above the bar, with results grouped by kind for a typed query, the tools grid behind it already filtered to match](/t/url-shot?url=%2F%23%2F&width=1440&height=820&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&drive=press%3Ac%7Con%3D.gallery-search%3Bpress%3Ah%3Bpress%3Aa%3Bpress%3Ar%3Bpress%3At%3Bwait%3A900&walker=1&format=svg&dark=1&filename=srch-spotlight-results)

Every hit is an ordinary link. A **Places** result goes to a plain hash route -
`#/verify`, `#/lab`, `#/start` - so you can bookmark it, paste it into a doc or
send it to a colleague, and several take you further in than the front door:
`#/lab?c=<any css colour>` opens the Colour Lab already reporting on that
colour, `#/ask?q=<question>` opens Ask Lolly with the question already asked
and `#/d?tab=<device|brand|caps|activity>` opens the Dashboard on that tab. A
hit in **Projects** is a link too, but it names a saved slot on this device
(`#/tool/<tool>?slot=…`), so that one travels no further than the device does.

## Keyboard

Press **Control-Space** from any screen that shows the bar and it jumps
straight to the field. (Cmd-Space is quietly wired in too, for anyone whose
Mac muscle memory reaches for it, but it's never the one advertised: on an
unmodified Mac the OS keeps that combination for Spotlight before the browser
ever sees it, so Ctrl-Space is the one that reliably works, everywhere.) A
small `⌃␣` chip sits inside the empty field as the reminder, on a wide enough
screen with a mouse or trackpad.

Once the panel is open: the arrow keys walk every row across every group,
Enter opens whichever is highlighted (Cmd/Ctrl-Enter opens it in a new tab
instead) and Escape backs out one step at a time - first the panel closes,
then a second press clears what you typed, then a third leaves the field.

## What it doesn't do

- It searches names, labels and tags, never contents. It won't find a session
  or an asset by something inside it, only by what it's called.
- Results only navigate. Nothing in the panel deletes, renames or flips a
  setting on your behalf - it takes you to the place you'd do that yourself.
- No history and nothing shown before you start typing. Below two characters
  the panel stays closed.
- Matching is exact substrings, folded for accents and case, not fuzzy - it
  won't correct a typo or guess at a word you didn't type.
- It's answered entirely on your device, from data already there. The one
  exception is Docs: the first time you search, it quietly fetches this
  documentation site's own search index, the same plain file its own on-page
  search already uses, so page and heading titles are searchable too. What you
  type is never part of that fetch, only matched locally once the file is
  in; offline, that one group just doesn't appear, without complaint.

---

**Related:** [Your favourites](/info/favourites.html) for keeping the handful you use where you can see them. [Using Lolly](/info/using.html) for the gallery, Projects and the Catalogue that search reaches into. [Privacy](/info/privacy.html) for what stays on your device.
