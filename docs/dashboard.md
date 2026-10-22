# Settings

**Settings** brings personal preferences and the former Dashboard together. Open it from the footer or the avatar menu. It starts on **Preferences**, with the other sections alongside it.

| Section | Address | What it contains |
|---|---|---|
| **Preferences** | `#/settings` | Your details, appearance, accessibility, connections, storage and offline downloads |
| **This device** | `#/settings?tab=device` | A live readout of the browser and machine, plus sound and storage |
| **Design system** | `#/settings?tab=brand` | The active design system as a cover and pages, with a strip of covers to switch systems |
| **Capabilities** | `#/settings?tab=caps` | The platform's features, grouped into searchable cards |
| **Activity & stats** | `#/settings?tab=activity` | The catalogue, your local counters and recent work |

Each section has its own address. Existing `#/profile` and `#/d` links still work, including links to individual settings.

## This device

- <!--i:monitor--> **This Machine** - screen, input, graphics, memory, codecs, storage backend and the rest, read live from this session. Nothing is stored and nothing is sent. It opens by itself on a wide screen, where the tab lays out in two columns, and stays folded on a narrow one.
- <!--i:neurobeat--> **Sound** - interface sounds and the Neurospicy focus loops. This is the one switch on the page that writes anything, and the choice follows you across the app.
- <!--i:database--> **Storage** - what Lolly is keeping on this device, category by category. A read-only view of the meter on [Preferences](/info/profile.html), which is where you clear or carry it.

## Design system

The active design system, set out as a read. When this browser holds two or more design systems, a strip of small covers at the top lists them; choose one to make it active, and **Undo** in the notice that follows puts the previous one back.

The tab opens on a cover painted in the system's own colours, with its logo, its name in its display face and the note its author wrote. A line of counts on the cover links to each page:

- <!--i:palette--> **Colour** - the surface, text, primary and secondary of the light and dark looks, every named colour as a chip with its name and hex, a band for each tint ramp and the chart spectrum, and the colour roles in a fold. Select a value to copy the hex.
- <!--i:font--> **Type** - Headings, Text, Emphasis and Code, each set in its own face.
- <!--i:image--> **Logos** - each logo file on the ground it was made for.
- <!--i:layers--> **Colourways** - the light and dark pair of each colourway, when the system has more than one.
- <!--i:sliders--> **Tokens** - radius, spacing, effects and gradients.
- <!--i:document--> **Print & CMYK** - the colours locked to an exact ink, and the press conditions a CMYK PDF can declare.

**Switching is the only change this tab makes.** Editing happens in the [Brand Studio](/info/brand-studio.html) at `#/start`, which the cover links to as **Edit in Start**. A read-only system says so on its cover; local systems you create remain editable.

Theme and sound are in [Preferences](/info/profile.html), within the same Settings section.

> `/b` and `/brand` are shortlinks straight to this tab. The retired `#/platform` and `#/capabilities` addresses both fold into Settings, deep-link flags intact.

## Capabilities

Every part of the platform written up as a card, in twelve groups: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control and Architecture (for builders). Each group folds, carries its own card count and opens a card into a dialog with that capability's feature list and - for about half of them - the same vector screenshot this documentation site uses.

A search field above the groups filters the cards as you type and force-opens whichever groups still hold a match, so a query turns the accordion into a flat result list. It says how many capabilities it is searching, and a query that matches nothing says that in words rather than leaving you with a column of empty sections.

This map is written documentation of what Lolly can do, kept in step with the guides and the export bridge. It is not a probe of the machine you are on - that is the **This device** tab.

## Activity & stats

The build first: how many tools are loaded, how many export formats exist, how many surfaces the platform runs on and how many brand assets the catalogue carries, with a **Catalogue** panel breaking down what ships in this build.

Then your own side of it: **Your activity** counts what you have made on this device (local counters; an optional lolly.work instance has separate [organisation telemetry and audit records](/info/privacy.html#organisation-services-with-lolly-work)), and **Recent creations** and **Latest exports** are swipeable stacks of your saved sessions and downloaded files, each appearing only once there is something to show. Both open an item exactly as it was.

## Deep links

Every destination on the page is addressable, and the same registry Settings renders from is what [Search](/info/search.html) points its **Settings** results at - so a section can never be renamed out from under a search result.

- <!--i:hash--> **A tab:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- <!--i:hash--> **A section, exactly:** its own id as a bare flag - `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways`, `#/settings?cap-formats`. This is the precise form. The older `#/settings?dash-lock` and `#/settings?dash-palette-wheel` links open the cover and the Colour page.
- <!--i:search--> **A section by keyword:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (the Colour page), `#/settings?tokens`. Convenient, but keywords are shared - `print` belongs to both the brand tab's print reference and the Print production capability group - and the first one in page order wins. Use the id when it matters which.

A deep link switches to the tab that owns the target, opens it (and any group it is folded inside), then scrolls to it, re-landing for a moment or so while the asynchronous sections above it finish laying out.

---

**Related:** [The Brand Studio](/info/brand-studio.html) for editing what this page shows. [Preferences](/info/profile.html) for the personal settings, storage and offline downloads it mirrors. [Search](/info/search.html) for reaching any of these sections by typing.
