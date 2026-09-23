# Settings

**Settings** brings personal preferences and the former Dashboard together. Open it from the footer or the avatar menu. It starts on **Preferences**, with the other sections alongside it.

| Section | Address | What it contains |
|---|---|---|
| **Preferences** | `#/settings` | Your details, appearance, accessibility, connections, storage and offline downloads |
| **This device** | `#/settings?tab=device` | A live readout of the browser and machine, plus sound and storage |
| **Design system** | `#/settings?tab=brand` | The active design system: logo, colours, type, tokens and print reference |
| **Capabilities** | `#/settings?tab=caps` | The platform's features, grouped into searchable cards |
| **Activity & stats** | `#/settings?tab=activity` | The catalogue, your local counters and recent work |

Each section has its own address. Existing `#/profile` and `#/d` links still work, including links to individual settings.

## This device

- <!--i:monitor--> **This Machine** - screen, input, graphics, memory, codecs, storage backend and the rest, read live from this session. Nothing is stored and nothing is sent. It opens by itself on a wide screen, where the tab lays out in two columns, and stays folded on a narrow one.
- <!--i:neurobeat--> **Sound** - interface sounds and the Neurospicy focus loops. This is the one switch on the page that writes anything, and the choice follows you across the app.
- <!--i:database--> **Storage** - what Lolly is keeping on this device, category by category. A read-only view of the meter on [Preferences](/info/profile.html), which is where you clear or carry it.

## Design system

The brand as it is actually loaded, rendered wearing its own variables: the name, the horizontal logo, the primary colour as a copyable value and the faces currently loaded on the device. Below the hero sit the palette on a hue/chroma wheel (greys have no hue, so they ride a lightness rail beside it), a live type specimen, the full colour palette, the brand token primitives - radius, spacing, effects, gradients - and a print and CMYK reference panel.

**Nothing on this tab writes brand state.** It is a mirror: the editing happens in the [Brand Studio](/info/brand-studio.html) at `#/start`, and the tab links there from the hero and from the tokens section. A **Brand locked** panel identifies a read-only design system. The lock applies to the selected system; local systems you create remain editable.

Theme and sound are in [Preferences](/info/profile.html), within the same Settings section.

> `/b` and `/brand` are shortlinks straight to this tab. The retired `#/platform` and `#/capabilities` addresses both fold into Settings, deep-link flags intact.

## Capabilities

Every part of the platform written up as a card, in eleven groups: Experiences, Platforms & runtimes, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control and Architecture. Each group folds, carries its own card count and opens a card into a dialog with that capability's feature list and - for about half of them - the same vector screenshot this documentation site uses.

A search field above the groups filters the cards as you type and force-opens whichever groups still hold a match, so a query turns the accordion into a flat result list. It says how many capabilities it is searching, and a query that matches nothing says that in words rather than leaving you with a column of empty sections.

This map is written documentation of what Lolly can do, kept in step with the guides and the export bridge. It is not a probe of the machine you are on - that is the **This device** tab, one click to the left.

## Activity & stats

The build first: how many tools are loaded, how many export formats exist, how many surfaces the platform runs on and how many brand assets the catalogue carries, with a **Catalogue** panel breaking down what ships in this build.

Then your own side of it: **Your activity** counts what you have made on this device (local counters, nothing recorded remotely), and **Recent creations** and **Latest exports** are swipeable stacks of your saved sessions and downloaded files, each appearing only once there is something to show. Both open an item exactly as it was.

## Deep links

Every destination on the page is addressable, and the same registry Settings renders from is what [Search](/info/search.html) points its **Settings** results at - so a section can never be renamed out from under a search result.

- <!--i:hash--> **A tab:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- <!--i:hash--> **A section, exactly:** its own id as a bare flag - `#/settings?dash-storage`, `#/settings?dash-tokens`, `#/settings?cap-formats`. This is the precise form.
- <!--i:search--> **A section by keyword:** `#/settings?print`, `#/settings?formats`, `#/settings?palette`, `#/settings?tokens`. Convenient, but keywords are shared - `print` belongs to both the brand tab's print reference and the Print production capability group - and the first one in page order wins. Use the id when it matters which.

A deep link switches to the tab that owns the target, opens it (and any group it is folded inside), then scrolls to it, re-landing for a moment or so while the asynchronous sections above it finish laying out.

---

**Related:** [The Brand Studio](/info/brand-studio.html) for editing what this page shows. [Preferences](/info/profile.html) for the personal settings, storage and offline downloads it mirrors. [Search](/info/search.html) for reaching any of these sections by typing.
