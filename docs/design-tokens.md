# Design Tokens

Design tokens are Lolly's **single source of truth for brand primitives** - colours first, then dimensions, type and the rest. One canonical token document feeds three things at once: the values baked into tools, the swatches the colour picker offers and an import/export bridge to other design tools. The format is the [W3C Design Tokens (DTCG)](https://www.designtokens.org/TR/drafts/format/) standard - the same format [Penpot imports and exports](https://help.penpot.app/user-guide/design-systems/design-tokens/) - so a brand defined in Lolly round-trips with Penpot and Tokens Studio. (Tokens carry the brand *variables* both ways; finished Figma/Penpot *files* come in through the Design tool's [Import a design](/info/design-import.html).)

This page is the spec. The engine model is [`engine/src/tokens.ts`](../engine/src/tokens.ts); the format contract is pinned by [`tests/tokens.test.ts`](../tests/tokens.test.ts).

> **Status.** The **colour** slice is shipped: brand colours are canonical tokens, the picker's swatches come from them and a chosen brand colour stays *linked* to its token. **Dimension tokens** (radius, spacing, sizing, stroke, opacity, rotation, shadows) and **typography** (brand fonts) are shipped too, editable in the [Brand Studio](/info/brand-studio.html)'s Tokens and Type tabs. **User import/export** is shipped - import W3C DTCG / Tokens Studio / Penpot in the Studio (or via [`ingest:brand`](/info/configuration.html#brand-packs)), and export a `LollyBrand` pack or a design-tokens palette. Token-aware tool *injection into templates* is not built yet.

![The Tokens panel - pick a kind, name it and the token joins the document your brand travels in](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=900&dpi=192&waitMs=1600&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-tokens&format=svg&walker=1&dark=1&filename=bs-token-editor)

## Why tokens

Before tokens there were three disagreeing colour "truths": a hard-coded swatch array in the web shell, a `palette` catalog asset that tools could reference and the engine's colour-management maths. Tokens collapse the first two into one canonical, versioned, git-reviewed source - and make it portable. The goal the project states plainly: *keep as many things as possible canonical via tokens, and be able to import/export them with tools like Penpot.*

## The format (a DTCG profile)

A token document is DTCG JSON. A **token** is an object with `$value` (required) and `$type`; **groups** are objects without `$value` and pass their `$type` down to descendants. References between tokens use the curly-brace alias `{dotted.path}`.

```json
{
  "color": {
    "$type": "color",
    "brand": {
      "jungle": {
        "$value": "#30ba78",
        "$description": "Jungle",
        "$extensions": { "com.suse.lolly": { "cmyk": [70, 0, 65, 0] } }
      }
    },
    "semantic": {
      "primary": { "$value": "{color.brand.jungle}" }
    }
  }
}
```

Two deliberate choices keep us interoperable with Penpot while serving Lolly's print needs:

- **Colours: read every form, store perceptually, resolve to hex.** DTCG's newer colour *object* (`{colorSpace, components, alpha, hex}`) is parsed, and so is every CSS Color 4 string - `#hex`, `rgb()/rgba()`, `hsl()/hsla()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()` and `color(<space> …)` across 14 colour spaces (`engine/src/css-color.ts`), which covers everything Penpot emits and a good deal more. A value *resolves* to a hex string (`#rrggbb` / `#rrggbbaa` / `transparent`) for rendering, except a bare colour keyword, which is handed back as-is. What Lolly **stores** is a different question: a derived brand writes `oklch()` into `$value`, and a swatch's *Stored as* control can pin `lch` (the default), hex, `rgb()` or `hsl()` instead. All of those are forms Penpot ingests cleanly.
- **CMYK rides in `$extensions`.** Print anchors live under the vendor key `com.suse.lolly`. DTCG reserves `$extensions` for exactly this, and Penpot round-trips it untouched - so a colour stays print-correct without breaking compatibility.

**Sets and themes.** Top-level keys can be token *sets*; a `$themes` array selects and orders sets per theme (later sets override earlier - Tokens-Studio layering), with `$metadata.tokenSetOrder` fixing the order. A document with no `$themes` is one implicit set, and token paths keep their `color.brand.x` shape.

## The four layers

**1. Engine - [`engine/src/tokens.ts`](../engine/src/tokens.ts).** Platform-agnostic, like `units.ts`. `createTokenSet(doc, { theme })` parses a document, inherits group `$type`, resolves `{}` aliases (chains, cycle-safe), applies the theme and returns a flat lookup with `get` / `resolve` / `query({type})` / `colors()` / `themes()`. It knows DTCG and nothing else - no DOM, no storage, no SUSE - so it ships as part of the open-source engine.

**2. Catalog - a `tokens` asset.** Each brand pack ships one core-tier `tokens` asset and the active profile decides which is canonical - `suse/tokens/brand` in the SUSE pack, `lolly/tokens/brand` in the blank brand, `<brand>/tokens/brand` for a pack built by `ingest:brand` (a `tokens`-type catalog asset, `core` tier so it's always available offline). It is generated from the shell palette by [`scripts/build-brand-tokens.ts`](../scripts/build-brand-tokens.ts) and validated against [`schemas/tokens.schema.json`](../schemas/tokens.schema.json) by `pnpm run validate:catalog`. Versioned and checksummed like any asset.

**3. User tokens - *shipped*.** A device-local store for the tokens a user creates or imports (from Penpot, DTCG or a `LollyBrand` pack), travelling as the `tokens.json` part of a `LollyBrand` pack, and inside the full data backup as a user asset in `assets.json` (see [Data Transfer](/info/data-transfer.html)). The [Brand Studio](/info/brand-studio.html) handles import, editing, the active theme and export back to DTCG.

**4. Bridge - `host.tokens`.** An additive, optional v1 capability (like `net`/`text`): `get` / `colors` / `resolve` / `themes`. Each shell implements it over the engine model and its sources; a shell that doesn't is simply not token-driven. Loading is offline-safe (prefers the core-prefetched blob, falls back to a direct fetch, then to the built-in palette).

![Catalog and user tokens feed the engine token model, which resolves themes and aliases. The shell exposes that model through host.tokens so tools can look up resolved values.](/info/diagrams/concepts/token-resolution.svg)

## Lolly UI tokens

Your brand describes identity. Lolly also carries a small **application UI** system
so menus, fields, panels and editor chrome remain coherent even when a brand has
no complete component library. It travels under a reserved namespace:

```text
lolly.foundation.*  # Lolly’s compatible base scale
lolly.ui.*          # stable application roles a design system may override
brand.*             # your identity tokens
```

The Tokens room shows the Lolly roles as **placeholders**. They affect the app
and the Penpot UI-library export, but they do not bloat a brand document merely
because it was opened. Changing one value saves only that owned `lolly.ui.*`
leaf; Reset removes it and restores Lolly’s stock role.

The supported UI contract is deliberately narrow: semantic text/surface/action,
selection, border and focus colours; control/panel/page spacing; role-based
radius; elevation/edge/focus effects; UI fonts/type sizes; feedback/overlay/
navigation motion; and chrome/overlay/toast layers. Lolly validates each value
before it reaches CSS. Unknown paths, unsafe CSS, incompatible types and
unresolved aliases stay out of the live app rather than partially applying.

Two foundation values are especially useful when starting with a token library:

- `shape.radius` drives the derived radius scale. Set it to `0px` for square
  UI; set it high for rounded controls. The pill/round roles derive from it too.
- `space.base` drives Lolly’s spacing rhythm (`.25×`, `.5×`, `.75×`, `1×`,
  `1.25×`, `1.5×`, `2×`, `3×`), so a system’s base unit reaches panels and
  controls without copying individual gaps.

Choose **Export Lolly UI to Penpot** in [Components](/#/components) to get the
stock library as editable frames plus both token layers and the active brand.
The archive holds every declared app component/pattern and uses sample data by
default. Token records are present in `tokens.json`; a property that Penpot
cannot bind natively remains an editable resolved value rather than a misleading
claim of a live binding. Lolly does not export personal sessions or current
content as an app surface unless that surface explicitly records consent.

## App chrome from a design pack

A design pack can set the app's own room as well: the page, the cards and side
panels, the top bar, the menus and the text on them, one room per theme. Put a
`color.chrome` group inside a theme set, beside the semantic slots. Every slot
is an optional colour, and an alias into your own palette is the normal way to
write one.

| Slot | Sets | For | Left out |
|---|---|---|---|
| `page` | `--background` | the page | the theme keeps Lolly's room, because the other surfaces need a page |
| `raised` | `--card` | cards, side panels and the top bar | worked out from `page` |
| `overlay` | `--popover` | menus, dialogs and popovers | the `raised` colour |
| `muted` | `--muted` and `--secondary` | wells, tracks and quiet fills | worked out from `page` |
| `hover` | `--accent` | hover and active surfaces | worked out from `page` |
| `edge` | `--border` and `--input` | hairlines and field edges | worked out from `page` |
| `ink` | `--foreground` and the card, popover, secondary and accent inks | body text on the chrome | Lolly's ink for the theme |
| `muted-ink` | `--muted-foreground` | secondary text | Lolly's muted ink for the theme |
| `unsaved` | `--brand-warn` | the colour that marks unsaved work | see "Unsaved work" below |

Opal's dark set is an example of the group in place:

```json
{
  "dark": {
    "color": {
      "$type": "color",
      "chrome": {
        "page": { "$value": "{color.brand.liquorice}" },
        "raised": { "$value": "{color.brand.liquorice-raised}" },
        "overlay": { "$value": "{color.brand.liquorice-panel}" },
        "muted": { "$value": "{color.brand.liquorice-panel}" },
        "edge": { "$value": "{color.brand.basalt}" },
        "ink": { "$value": "{color.brand.sugar}" },
        "muted-ink": { "$value": "{color.brand.pebble}" },
        "unsaved": { "$value": "{color.brand.honey}" }
      }
    }
  }
}
```

The slots set the same properties Lolly's own `tokens.css` sets, so everything
in the app that reads a surface follows the pack. Four things are never set from
here:

- the ink of the render canvas (`--foreground-canvas`): the canvas and the
  export stages always take the theme's own ink back at their edge, whatever
  `ink` the pack states, so a pack's chrome cannot move a pixel of an export
- the accent (`--primary` and `--ring`), which the semantic primaries own
- the destructive fills
- the radius and spacing

**Slots you leave out.** State a `page` and Lolly works the other surfaces out
from it, in the page's hue. The steps are lightness in OKLCH, measured from the
page:

| Slot | Light page | Dark and brand page |
|---|---|---|
| `raised` | 0.009 darker | 0.037 lighter |
| `muted` | 0.032 darker | 0.117 lighter |
| `hover` | 0.048 darker | 0.155 lighter |
| `edge` | 0.131 darker | 0.155 lighter |

An `edge` also carries more of the page's tint than the other surfaces: one and
a half times the page's chroma, at least 0.01 and at most 0.04. Lightness stays
between 0 and 1, and a colour that falls outside sRGB has its chroma reduced
until it fits.

**A theme that does not read keeps Lolly's room.** Each theme is checked whole.
If any check fails, that theme keeps Lolly's own room and the browser console
reports the first pair that failed. The other theme is judged on its own. A
value that does not parse counts as left out. The checks are:

1. Every surface keeps the theme's lightness band in OKLCH: 0.85 to 1 for light,
   0 to 0.4 for dark and 0.2 to 0.42 for brand.
2. The ink, yours or Lolly's, reads 4.5:1 or better on the page, `raised`,
   `overlay`, `muted` and `hover`.
3. The muted ink reads 4.5:1 or better on the page, `raised`, `overlay` and
   `muted`.
4. For the brand theme only, the inks and edge of Lolly's High contrast brand
   room still clear their bars on your surfaces.

Each applied theme also restates the error text colour, adjusted until it
reads 4.5:1 on the pack's surfaces and on a danger wash over them.

**High contrast.** The light and dark chrome steps aside while High contrast is
on, and Lolly's own High contrast room shows for every pack. That room is
measured against Lolly's own page, and keeping a pack's page under it would
let cards sink into the page. The brand chrome stays in force, and the High
contrast brand inks and edge win over the pack's own, which is why the fourth
check exists. The unsaved colour is not a surface, so it applies under High
contrast too.

**The brand theme.** Brand chrome is read only when the document's `$themes`
declares a theme named `brand`, and then from that theme's set. Asking the
token engine for a theme a document does not declare answers with its default
sets, which would hand the brand theme the light values. Without a `brand`
theme, the brand theme stays as Lolly builds it from the pack's primaries.

**Unsaved work.** When any theme states `unsaved`, the colour moves out of the
app's automatic pick into a block for each theme. The brand theme takes the
brand set's colour, else the dark set's, and a theme that states none takes the
automatic pick. That pick is the colour in the pack nearest red to yellow, and
when the pack has none Lolly's own amber stays. The label on it is black or
white, whichever reads better.

**When to use `lolly.ui.*` instead.** The `lolly.ui.color.*` roles hold one
value in every theme and set the app's `--ui-color-*` properties directly on the
page, so High contrast does not undo them. They suit one fixed colour, such as a
single canvas or border colour. Use `color.chrome.*` when the pack has a light
room and a dark room, since each theme reads its own set, and when High contrast
should still bring Lolly's measured room back. Lolly's blank starter brand
states a warm newsprint room this way in its light and dark sets. The slots are
ordinary tokens in the pack's DTCG file, so editing the file or importing one
changes the room, and a design system with no `color.chrome` group shows Lolly's
own cool room.

## How tools consume tokens

**Platform hydration (the common case).** Most tools never mention tokens. The platform feeds them:

- **The picker's swatches are tokens.** The colour field sources its swatches from `host.tokens.colors()` for the active theme, labelled and grouped by token. This is what the `palette` input field always promised.
- **Brand-bound values stay linked.** Choosing a token swatch stores a *reference*, not a frozen hex (see below), so a later token edit propagates everywhere.

**Direct injection - *(planned)*.** A token-aware tool (a brand sheet, a style guide, a chart that maps series to brand colours) can receive the resolved token tree in its template context via the existing `extras` mechanism, opted into from the manifest.

## The value model: reference + cached value

When a user picks a token-backed colour, the stored value is **a reference plus the hex it last resolved to**:

```json
{ "ref": "{color.brand.jungle}", "value": "#30ba78" }
```

A token-backed swatch reads as its token in the sidebar: the trigger carries the swatch's *name*, not a frozen hex, which is the visible difference between a linked value and one typed in by hand.

![A tool's colour row holding a token-backed value, the trigger showing the swatch circle and its name instead of a hex code](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DLinked%26color%3D%257Bcolor.spectrum.rose%257D&width=1440&height=900&dpi=192&waitMs=2000&css=%23tool-canvas%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.input-row%3Ahas%28%5Bdata-color-field%3D%22color%22%5D%29&dark=1&filename=at2-token-linked-swatch)

The `ref` keeps the value canonical - editing the token, or switching themes, re-resolves it everywhere. The cached `value` is the graceful fallback for a device where that token is absent. The path is fully backward-compatible: a plain colour string (a custom pick, or any existing tool) flows through untouched.

How it moves through the engine:

- **Hydration** ([`runtime.ts`](../engine/src/runtime.ts) → `resolveTokenRefs`, mirroring asset-ref resolution): on load, each token-backed colour re-resolves against the live token set and its cached hex is refreshed. `modelToValues` then hands the template a plain hex string - templates and data/JSON exports never see an object.
- **Hooks** see the flattened hex too (`modelForHooks` in [`inputs.ts`](../engine/src/inputs.ts)): the `{ ref, value }` shape is an engine detail and never reaches a tool's `onInit`/`onInput`, so the common `(inputs.x || '').trim()` pattern keeps working.
- **URL mode** ([`url-mode.ts`](../engine/src/url-mode.ts)): a token colour serialises to its reference (`?bg={color.brand.jungle}`), so a shared link re-resolves against the *recipient's* tokens. Parsing a `{path}` yields an unresolved token value the runtime then resolves.

- **Editing past a token** (typing a hex, dragging alpha) emits a plain string - deliberately de-linking from the token, because the user just overrode it.

The link below holds no colour value. Its three colour params are token paths (`{color.spectrum.violet}`, `{color.spectrum.teal}`, `{color.spectrum.amber}`), resolved at render time against whatever brand the device is carrying.

![A mesh gradient whose violet, teal and amber all arrived as token references in the link rather than as hex values](/t/url-shot?url=%2F%23%2Ftool%2Fgradient%3Fcount%3D3%26color1%3D%257Bcolor.spectrum.violet%257D%26color2%3D%257Bcolor.spectrum.teal%257D%26color3%3D%257Bcolor.spectrum.amber%257D%26full&width=880&height=560&dpi=96&waitMs=2400&walker=1&format=svg&dark=1&filename=at2-token-refs-in-url)

## Penpot interop

- **Author/generate:** the brand tokens are a DTCG document - already the shape Penpot reads.
- **Import/export (shipped):** import a Penpot single-file, ZIP or multifile export (`$themes.json` + `$metadata.json` + one file per set) in the [Brand Studio](/info/brand-studio.html) or via [`ingest:brand`](/info/configuration.html#brand-packs), and export Lolly's tokens back as DTCG. CMYK survives Lolly→Lolly round-trips via `$extensions` and is ignored by Penpot, as the standard intends.

![The download pill parked at the palette's bottom edge, with the format menu that carries the same colours back out as DTCG JSON](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dcolor&width=1440&height=900&dpi=192&waitMs=1800&cropSelector=.be-pal-dock&format=svg&walker=1&dark=1&filename=bs-palette-download)

## Take your tokens to Penpot

The round trip above, step by step - no code involved.

**Export from Lolly.** Open the [Brand Studio](/info/brand-studio.html) and go to the Colours room. The download pill parked at the bottom of the palette pane offers several formats; choose **Design tokens (JSON)**. The file you get is a W3C design-tokens document - the format Penpot and Tokens Studio read. If you have chosen faces in the Type room (Primary, Headings, Code, Italic), those travel in the same file as font tokens. Roles you left on the platform default stay out of the file: the export only carries choices you actually made.

**Import into Penpot.** Open a Penpot file and switch to the Tokens panel in the left sidebar. Import the JSON you just downloaded. Your sets appear in the panel, and the colours and fonts can be applied to shapes and text from there.

Two more paths exist beyond the token file. Once Penpot is connected under Profile → Connected services, a finished render can be sent from Lolly into a Penpot project as an image. And the Lolly bridge plugin for Penpot - installed by URL from a Lolly instance - can place a working Lolly session on the Penpot canvas as editable shapes.

## Migration & status

The brand colours moved into tokens without changing what anyone sees: `scripts/build-brand-tokens.ts` derives the token document from the existing palette, so the picker shows the same colours - now sourced canonically. The shell palette remains the fallback (and, for now, the source of CMYK anchors on export). With dimension/typography tokens and user import/export now shipped, most of the app resolves from tokens and the standalone palette recedes; template-level token *injection* is the main piece still to land.

The corner radius is the plainest of the shipped dimension tokens: one slider writing one `shape.radius` value that the app chrome, the panels and every opted-in tool then follow.

![The Rounded corners control in the Tokens tab - a live preview square, a slider and the value it writes, all standing for a single dimension token](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.be-radius-panel&dark=1&filename=at2-token-radius-dimension)

## Token workflows

The [token workflow guide](/info/token-workflows.html) covers retained source inspection, independent theme choices, typed links, reviewed source edits, scale recipes and upstream updates. The controls use the same fields, buttons, cards and dialogs throughout Lolly.

## Reference

- Engine model: [`engine/src/tokens.ts`](../engine/src/tokens.ts) - `createTokenSet`, `resolveColorValue`, `colorToHex`, `isAlias`, `isTokenValue`, `TOKEN_EXT`.
- Tests: [`tests/tokens.test.ts`](../tests/tokens.test.ts) (model) and [`tests/tokens-value-path.test.ts`](../tests/tokens-value-path.test.ts) (URL/hydration round-trip).
- Schema: [`schemas/tokens.schema.json`](../schemas/tokens.schema.json). Generator: [`scripts/build-brand-tokens.ts`](../scripts/build-brand-tokens.ts).
- Bridge contract: `TokensAPI` in [`packages/core/src/host-v1.ts`](../packages/core/src/host-v1.ts) (re-exported as `engine/src/bridge/host-v1.ts`). Web impl: [`shells/web/src/bridge/tokens.ts`](../shells/web/src/bridge/tokens.ts).
