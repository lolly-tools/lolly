# The Dashboard

The Dashboard (`#/d`) is the instrument panel for a Lolly install: the brand it is wearing, what this device can do, the platform's capability map and a glance at your activity and storage. Four tabs, everything on them a read-out rather than a control - the one exception is the sound switch.

It opens on **Design system**. The other three are one click away, and every tab and every section on them has an address of its own.

| Tab | Address | What it shows |
|---|---|---|
| **This device** | `#/d?tab=device` | A live readout of the browser and machine this session is running on, plus sound and storage |
| **Design system** | `#/d?tab=brand` | The brand in force - logo, colours, type, tokens, print reference. Read-only |
| **Capabilities** | `#/d?tab=caps` | The whole platform as searchable cards, grouped by what they do |
| **Activity & stats** | `#/d?tab=activity` | What ships in this build, plus your own local counters and recent work |

Switching a tab rewrites the address as you go, so the link you copy is the tab you are looking at.

## This device

- <!--i:monitor--> **This Machine** - screen, input, graphics, memory, codecs, storage backend and the rest, read live from this session. Nothing is stored and nothing is sent. It opens by itself on a wide screen, where the tab lays out in two columns, and stays folded on a narrow one.
- <!--i:neurobeat--> **Sound** - interface sounds and the Neurospicy focus loops. This is the one switch on the page that writes anything, and the choice follows you across the app.
- <!--i:database--> **Storage** - what Lolly is keeping on this device, category by category. A read-only view of the meter on your [Profile](/info/profile.html), which is where you clear or carry it.

## Design system

The brand as it is actually loaded, rendered wearing its own variables: the name, the horizontal logo, the primary colour as a copyable value and the faces currently loaded on the device. Below the hero sit the palette on a hue/chroma wheel (greys have no hue, so they ride a lightness rail beside it), a live type specimen, the full colour palette, the brand token primitives - radius, spacing, effects, gradients - and a print and CMYK reference panel.

**Nothing on this tab writes brand state.** It is a mirror: the editing happens in the [Brand Studio](/info/brand-studio.html) at `#/start`, and the tab links there from the hero and from the tokens section. On a brand-locked build there is nothing to edit at all, and a **Brand locked** panel says so - the brand ships with the build, comes from the catalogue and is authoritative on that install.

Personal preferences live elsewhere too: theme and sound are on your [Profile](/info/profile.html), not here.

> `/b` and `/brand` are shortlinks straight to this tab. The retired `#/platform` and `#/capabilities` addresses both fold into the Dashboard, deep-link flags intact.

## Capabilities

Every part of the platform written up as a card, in eleven groups: Experiences, Platforms & runtimes, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control and Architecture. Each group folds, carries its own card count and opens a card into a dialog with that capability's feature list and - for about half of them - the same vector screenshot this documentation site uses.

A search field above the groups filters the cards as you type and force-opens whichever groups still hold a match, so a query turns the accordion into a flat result list. It says how many capabilities it is searching, and a query that matches nothing says that in words rather than leaving you with a column of empty sections.

This map is written documentation of what Lolly can do, kept in step with the guides and the export bridge. It is not a probe of the machine you are on - that is the **This device** tab, one click to the left.

## Activity & stats

The build first: how many tools are loaded, how many export formats exist, how many surfaces the platform runs on and how many brand assets the catalogue carries, with a **Catalogue** panel breaking down what ships in this build.

Then your own side of it: **Your activity** counts what you have made on this device (local counters, nothing recorded remotely), and **Recent creations** and **Latest exports** are swipeable stacks of your saved sessions and downloaded files, each appearing only once there is something to show. Both open an item exactly as it was.

## Deep links

Every destination on the page is addressable, and the same registry the Dashboard renders from is what [Search](/info/search.html) points its **Settings** results at - so a section can never be renamed out from under a search result.

- <!--i:hash--> **A tab:** `#/d?tab=brand`, `#/d?tab=caps`, `#/d?tab=device`, `#/d?tab=activity`.
- <!--i:hash--> **A section, exactly:** its own id as a bare flag - `#/d?dash-storage`, `#/d?dash-tokens`, `#/d?cap-formats`. This is the precise form.
- <!--i:search--> **A section by keyword:** `#/d?print`, `#/d?formats`, `#/d?palette`, `#/d?tokens`. Convenient, but keywords are shared - `print` belongs to both the brand tab's print reference and the Print production capability group - and the first one in page order wins. Use the id when it matters which.

A deep link switches to the tab that owns the target, opens it (and any group it is folded inside), then scrolls to it, re-landing for a moment or so while the asynchronous sections above it finish laying out.

---

**Related:** [The Brand Studio](/info/brand-studio.html) for editing what this page shows. [Your profile](/info/profile.html) for the settings, storage and offline downloads it mirrors. [Search](/info/search.html) for reaching any of these sections by typing.
