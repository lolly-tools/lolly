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

Star a tool (or, on Utilities, a utility card) and a big, cinematic tile for it appears in a strip above the grid. It's the fastest way back to the handful of things you actually use - built by you, one star at a time, not pre-loaded with anyone's idea of what you'll want.

A fresh install shows none of this. There's no starter set: the strip simply doesn't exist until you star your first thing, and it collapses away again if you ever get back down to zero.

![The Tools gallery with two favourited tools drifting past in the strip above the grid](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-fav%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-fav%3D%22battlecards%22%5D%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=fav-strip-gallery)
<!--
SHOT NOTE (fav-strip-gallery): the two drive clicks star `qr-code` and
`battlecards`, and the pairing is not arbitrary - BOTH MUST BE IN THE FIRST
GRID ROW. Playwright scrolls each click target into view, so the last click
sets the final scroll position, and the walker anchors a body walk to the
visible band. The recipe originally starred `qr-code` and `chart`; `chart` is in row
three, so the frame came out anchored 562px down and the strip this shot is
ABOUT was off the top of it. Measured row 1 at 1440px: audiogram, battlecards,
gradient, qr-code.
`captureNeutralPinned()` (lib/capture-neutral.ts) already forces the strip into
Gallery/filmstrip mode for any automated capture and freezes the cross-fade, so
no extra flag is needed to avoid Cover Flow here.
-->

## Starring and unstarring

The star lives in three places, and all three write to the same list:

- **On the card itself** - the ★ in its corner. Click it once to add, again to remove.
- **In its right-click menu** - **Add to favourites** / **Remove from favourites**.
- **In the selection bar** - tick a card's checkbox (or several: ⌘/Ctrl-click, Shift-click a range or drag a box across empty space) and an action bar appears along the bottom with a **Favourite** button that stars, or unstars, the whole selection in one go. Right-clicking inside a selection offers the same **Favourite** / **Unfavourite** row.

![A single tool card, with the ★ that stars it sitting in the top corner beside the download and info buttons](/t/url-shot?url=%2F%23%2F&width=700&height=420&dpi=192&waitMs=1600&drive=click%3A%5Bdata-fav%3D%22qr-code%22%5D&cropSelector=%5Bdata-tool-id%3D%22qr-code%22%5D&walker=1&format=svg&dark=1&filename=fav-star-toggle)

<!--
SHOT NOTE (fav-star-toggle): the alt says WHERE the star is, not that it is
filled, and that is a walker limitation rather than an editorial choice. The
drive click really does star the tool - measured after the click:
`aria-pressed="true"`, `class="… gtile-fav is-fav"` - but the FILL is applied by
CSS (`.gtile-fav.is-fav svg { fill: … }`, gallery.css), and the walker's
svg-rooted passthrough clones an inline icon with its AUTHORED attributes, so
the icon keeps `fill="none"` and comes out as an outline. Computed `color` does
carry across; computed `fill`/`stroke` on a passthrough <svg> root do not.
Worth fixing in shells/web/src/bridge/export.ts (apply the computed
fill/stroke to the cloned root when it differs from the attribute) - every
CSS-filled icon in every walker shot has the same hole. Until then, do NOT
"solve" this with a raster: the shot is honest about the control's position,
and a bitmap would trade a whole page of vector for one filled glyph.
-->

The same star works on a **utility** card in the Utilities view - Verify & Inspect, Colour Lab, Unpack, Spreadsheet and the rest. They aren't tools (no saved sessions, nothing to keep offline), but the strip treats a starred one exactly the same way: a tile of its own, icon-led since there's no preview to show.

> Not the strip you're after? The **★ Favourites** pill in **Sort & filter** shows the same starred set as an ordinary filtered list in the grid below, instead of the drifting strip up top - useful if you'd rather scan a plain list.

**One star, two lists.** The ★ on a **catalogue asset** ([Using Lolly → The Catalogue](/info/using.html#the-catalogue-your-asset-library)) is a different list entirely: it pins that logo, image or colour to the top of every asset picker. Same verb, same glyph, unrelated sets - starring a tool never touches your pinned assets, and vice versa.

## Gallery or Cover Flow

Open **Sort & filter → Featured view** to choose how the strip itself looks:

- **Gallery** - a slow, calm filmstrip that drifts sideways on its own and pauses the moment you touch it.
- **Cover Flow** - the same tiles fanned out in 3-D, one centred and upright, the rest tucked back at an angle; drag or flick through them, then press **Open** on whichever one is centred.

A new install opens on Cover Flow at desktop width and on the plain filmstrip on a phone-width screen - the fan doesn't hold up that narrow yet - but the moment you pick one yourself, that choice sticks and stops guessing.

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

## This is local, not part of the design system

Your starred tools are saved onto your **profile** - the same on-device record that holds your name, your headshot and your other preferences (see [Profiles](/info/profile.html)). That means:

- It's saved **on this device**, in the browser's own local database. No account, nothing uploaded.
- It has nothing to do with the **design system** - the colours, fonts and tools the app was set up with. Starring a tool is a personal shortcut for you; it changes nothing about what anyone else's install shows.
- It **doesn't follow you** anywhere on its own. The one way it travels is the same way your whole profile does - export a portable backup and import it on another device - and that's a deliberate, occasional action you take, never an ambient sync running in the background.

Even the choice between **Gallery** and **Cover Flow** is more local still: it lives in a small preference kept only in this one browser's own storage, and it isn't part of that profile export at all. A new device always starts back on the plain default, no matter how many profiles you've moved around.

---

**Related:** [Search](/info/search.html) for the other way back to something quickly. [Using Lolly](/info/using.html) for the gallery, hiding tools you never use and the rest of the app. [Profiles](/info/profile.html) for what else rides on that on-device record.
