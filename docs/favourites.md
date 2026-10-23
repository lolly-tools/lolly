<!--
Every fact below was checked against shells/web/src/components/featured-row.ts,
shells/web/src/views/gallery.ts (the mount/star/hide/view-mode wiring),
shells/web/src/lib/favourites.ts, shells/web/src/bridge/profile.ts and
shells/web/src/data-transfer.ts (PREF_KEYS, the portable-backup part list) -
not from memory. Two separate storage facts matter here and must
not get merged into one sentence: the favourites LIST lives on the user
profile (IndexedDB, part of a profile export); the Gallery/Cover Flow DISPLAY
MODE lives in a bare localStorage key that isn't even in PREF_KEYS, so it
never rides along in a profile export either.
-->

# Your favourites

Put the handful of tools you actually use at the top of the gallery. Star a tool (or, on Utilities, a utility card) and a big tile for it appears in a strip above the grid, one star at a time.

Until you star your first thing, the strip shows a short starter set: up to six featured tools on the Tools gallery, and Verify & Inspect, Jump, Sandbox and Unpack on Utilities. Nothing is written to your profile for that set. Your first star replaces it with your own list, and if you later unstar everything, the strip goes away rather than bringing the starter set back.

![The Tools gallery with two favourited tools drifting past in the strip above the grid](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-tool-id%3D%22qr-code%22%5D%7Cright%3Bclick%3A.folder-menu%20%5Bdata-act%3D%22fav%22%5D%3Bclick%3A%5Bdata-tool-id%3D%22battlecards%22%5D%7Cright%3Bclick%3A.folder-menu%20%5Bdata-act%3D%22fav%22%5D%3Bpress%3AHome%7Con%3Dbody%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&cropSelector=.featured&filename=fav-strip-gallery)
<!--
SHOT NOTE (fav-strip-gallery): the two drive clicks star `qr-code` and
`battlecards`, and the pairing is not arbitrary - BOTH MUST BE IN THE FIRST
GRID ROW. Playwright scrolls each click target into view, so the last click
sets the final scroll position, and the walker anchors a body walk to the
visible band. The recipe originally starred `qr-code` and `chart`; `chart` is in row
three, so the frame came out anchored 562px down and the strip this shot is
ABOUT was off the top of the frame. Measured row 1 at 1440px: audiogram, battlecards,
gradient, qr-code.
`captureNeutralPinned()` (lib/capture-neutral.ts) already forces the strip into
Gallery/filmstrip mode for any automated capture and freezes the cross-fade, so
no extra flag is needed to avoid Cover Flow here.
-->

## Starring and unstarring

You star a tool in two places, and both write to the same list:

- **In its right-click menu** - **Add to favourites** / **Remove from favourites**. On a phone or tablet, press and hold the card for the same menu.
- **In the selection bar** - tick a card's checkbox (or several: ⌘/Ctrl-click, Shift-click a range or drag a box across empty space) and an action bar appears along the bottom with a **Favourite** button that stars, or unstars, the whole selection in one go. Right-clicking inside a selection offers the same **Favourite** / **Unfavourite** row.

![The right-click menu of a tool card, with Add to favourites among its rows](/t/url-shot?url=%2F%23%2F&width=700&height=520&dpi=192&waitMs=1600&drive=click%3A%5Bdata-tool-id%3D%22qr-code%22%5D%7Cright&cropSelector=.folder-menu&walker=1&format=svg&dark=1&filename=fav-star-toggle)

<!--
SHOT NOTE (fav-star-toggle): tool cards carry no star of their own any more; favouriting
lives in the card's right-click menu and the selection bar, so the shot opens that menu.
-->

The same star works on a **utility** card in the Utilities view - Verify & Inspect, Colour Lab, Unpack, Spreadsheet and the rest. They aren't tools (no saved sessions, nothing to keep offline), but the strip treats a starred one exactly the same way: a tile of its own, icon-led since there's no preview to show.

> Not the strip you're after? The **★ Favourites** pill under **View options → Filter** shows the same starred set as an ordinary filtered list in the grid below, instead of the drifting strip up top - useful if you'd rather scan a plain list.

**One star, two lists.** The star on an **asset** ([Assets](/info/using.html#assets-your-library)) is a separate list: it pins that logo, image or colour to the top of every asset picker. Starring a tool never touches your pinned assets, and pinning an asset never adds a tool.

**The other way back.** Once you have saved work in three different tools, a **Yours** row of chips above the grid leads with your favourites, then the tools you used most recently.

## Gallery or Cover Flow

Open **View options** and, under **Favourites**, choose how the strip itself looks:

- **Gallery** - a slow, calm filmstrip that drifts sideways on its own and pauses the moment you touch the strip.
- **Cover Flow** - the same tiles fanned out in 3-D, one centred and upright, the rest tucked back at an angle; drag or flick through them, then press **Open** on whichever one is centred.

A new install opens on Cover Flow at every screen width, and the fan works with touch as well as a mouse. Once you pick one yourself, Lolly remembers your choice.

<!--
No screenshot of the Featured-view switch itself, and not for the same reason
as the Cover Flow note below - this one is a genuine pipeline gap, not a
vector-rendering one, worth fixing rather than working around:

The "Featured view" control only exists in the DOM at all when
`featuredEntries.length > 0` at the moment views/gallery.ts's innerHTML
template string is built (line ~685) - a ONE-TIME evaluation at mount, from
whatever the profile's favourites already were when the page loaded. A star
click afterwards (drive=click:[data-fav=...]) calls refreshFeatured(), which
is a live, imperative DOM update - it repopulates .featured-mount and
toggles .gallery's has-featured class directly - but it never re-runs the
outer template string, so the popover block that was written out empty stays
empty. A single page load that starts with zero favourites can star as many
tools as it likes via drive= and will still never make this control appear.
Reaching it needs the capture browser's PROFILE to already hold a favourite
BEFORE this page's first paint - i.e. seeded storage, the same shape as the
fixed `lolly-welcome-dismissed` / `theme` seeds build-docs-shots.ts already
sets via ctx.addInitScript(), just for `profile.favourites` too - which the
current pipeline has no per-recipe hook for. Add one there, not here, rather
than shipping a recipe that quietly captures an empty popover section.
-->

<!--
Deliberately no Cover Flow screenshot anywhere on this page: it fans its
covers with a 3-D rotateY, and the vector walker's parseCssMatrix refuses a
3-D matrix (mis-scaled or blank covers). It also keeps its rAF loop running
just to hold the fan's layout, so it can never sit fully still for a capture
either. Same documented blocker as the gallery's own Cover Flow shots
(CLAUDE.md, "Docs screenshots are vector"). Prose only for that mode.
-->

## Your favourites stay on your device

Your starred tools are saved on your [profile](/info/profile.html), the same on-device record that holds your name, your headshot and your other preferences.

- They are saved in this browser's own storage, with no account and nothing uploaded.
- They are separate from the **design system**: starring a tool is a shortcut for you and changes nothing on anyone else's install.
- They travel only where your whole profile does: with [Sync](/info/sync.html) through the storage you chose, or in a backup you export and import yourself. They never go to a Lolly server.

The choice between **Gallery** and **Cover Flow** is kept in this browser only and is not part of a profile export, so a new device starts on Cover Flow.

---

**Related:** [Search](/info/search.html) for the other way back to something quickly. [Using Lolly](/info/using.html) for the gallery, hiding tools you never use and the rest of the app. [Profiles](/info/profile.html) for what else rides on that on-device record.
