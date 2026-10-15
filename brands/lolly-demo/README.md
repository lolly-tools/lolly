# brands/lolly-demo - Lolly's own demo brand, wearing Opal

`lolly-demo` is the full Lolly demo brand: Lolly dressed in **Opal**, its first
design system, for first use and testing. `lolly-start` stays what it is, the
neutral blank for starting a design system, and stays the profile a public clone
falls back to (it comes first in `profiles.json`, so the resolver reaches it
before this one).

Run it locally with:

```bash
LOLLY_PROFILE=lolly-demo pnpm run dev:web
```

Nothing ships this profile yet. lolly.tools, the release workflows, the
Dockerfiles and `scripts/data/ship-targets.json` still name `lolly-start`, and
switching the public build is a production change that goes through the
deployment handoff with one named owner.

## What's in the pack

- **Opal** (`catalog/assets/lolly/tokens/opal.json`, asset id
  `lolly/tokens/opal`). A layered DTCG document in the starter's shape: a shared
  `base` set with Opal's named colours, the chart spectrum, the faces and the
  logo slots, plus `light` and `dark` sets with the seven semantic slots and the
  slide roles. It is the pack's only `tokens` asset, so the shell's token bridge
  discovers it, and because its id is not the starter's `lolly/tokens/brand` the
  shell treats this install as branded.
- **Shared rows, byte for byte.** The Lolly marks (`lolly/logo/*`), the demo
  assets (`lolly/demo/*`, including `lolly/demo/lolly-spin`, which community
  tools need to validate), the loops, songs, modules, LUTs, 3D models, slide
  masters and presets, and the riso ink palette are the files and index rows
  `lolly-start` ships, unchanged and under the same ids. Their checksums, and any
  credentials embedded in the files, are the starter's own. The renditions of
  the lorikeet photograph travel with it.
- **Palette documents derived from Opal**: `lolly/palette/opal-photo-treatments`
  and `lolly/palette/opal-icon-themes`, made with the same engine functions
  `scripts/ingest-brand.ts` uses (`engine/src/brand-treatments.ts`).
- **Emoji: Fluent Emoji Flat at Full palette influence.** Opal's tokens carry
  the pack's emoji style in `$extensions['com.suse.lolly'].emoji`, which
  `brandEmojiStyle` (`engine/src/emoji-default.ts`) reads: the Fluent Emoji Flat
  2026.8.24 set, with the Palette influence control's "Full" setting (`snap`),
  so every paint moves to its nearest Opal colour while skin tones, flags and
  custom symbols keep their own. A link's choice or a saved session's own style
  still comes first. The style pins the 61 colours the token bridge lists for
  Opal, so rewrite the block after a colour change.
- **No font files.** Outfit (headings), SUSE (text and italics) and SUSE Mono
  (code) are all served by the web shell from `shells/web/public/fonts/`, as for
  `lolly-start`.
- **No tools of its own.** Every tool comes from `community/`; `tools/` holds a
  README so the profile can mount the pack the same way it mounts a brand that
  does carry tools.

## Opal

Every colour is a treat or a piece of nature, remembered by name and never by
number. A tint keeps its parent's name (Liquorice raised, Liquorice panel).

| Group | Colours |
|---|---|
| Greens, the main brand hue | Spearmint `#033633`, Bunyapine `#008657`, Green Apple `#50c369`, and the lighter Pandanus `#ace1ad` (raised washes and selected states) and Avocado `#edf6e0` (the palest wash, for pages and paper) |
| Earth | Basalt `#373e44`, Bauxite `#a43427`, Bark `#734f31` |
| Relief | Banksia `#ee9138`, Honey `#fac044`, Wattle `#fdec9e` (a soft light yellow), Olive `#818e44` |
| Dramatic relief | Reef `#25c2c2` |
| Treats | Donut `#f39dbd`, Pancake `#d8b890` |
| Light and ink | Daylight (HDR white: `#ffffff`, about 1,000 nits on HDR screens), Sugar `#ffffff`, Meringue `#f9f7ef`, Beach `#f2e1bf`, Pebble `#99a0a4`, Liquorice `#09141a` (raised `#121d24`, panel `#1c282f`), Void `#000000` |
| Flowers | Jacaranda `#8182d3`, Fuchsia `#c32e85` |
| Reds for the app | Arvo `#ef9275` (error text on dark), Outback `#c55123` (red earth, for charts), Ochre `#72251c` (error text on light under High contrast) |

- **Light, the crystal chalice:** Liquorice text on Sugar (18.6:1), Spearmint
  accent with a Sugar label (13.3:1), Basalt for quiet text, Pebble hairlines.
  Where Opal names a wash or paper for its own surfaces (the slide roles' cards,
  tracks and alternative ground), it takes the light greens: Avocado for cards
  and paper, Pandanus for tinted cards and tracks, and Wattle's soft yellow for the
  card a slide argues for. Cards that warn stay warm.
- **Dark, the stealth ship:** Sugar text on a Liquorice hull, Green Apple accent
  with a Liquorice label (8.3:1), Pebble for quiet text (7.0:1), Basalt edges.
- **Brand, home:** the shell builds it from the accents' hues.
- **Charts** take the spectrum in this order: Green Apple, Reef, Honey, Donut,
  Banksia, Olive, Outback, Bark. A verdict never relies on colour alone.

The shell's chrome follows the semantic primary in each theme; the surfaces of
the app's own light and dark themes are still the shell's static blocks, so the
Liquorice hull reaches tool canvases (through the semantic `surface` slot) but
not yet the chrome around them. That is the open "static dark block" call in the
brand plan.

## Not done yet

- **Signing.** `pnpm run sign:credentials:catalog` and the catalog signature
  (`catalog/tools/index.sig.json`) need keys that the maintainer provisions, so
  this pack's tool index is unsigned and `lolly/tokens/opal` and the derived
  palette documents carry no Content Credentials. The shared files keep the
  credentials they were shipped with.
- **Share cards.** `catalog/og/` holds placeholders. The card generator puts a
  branded pack on its dark theme's surface, which for Opal is Liquorice, while
  Lolly's own cards are green; the cards wait for Opal's own share-card designs
  (the house, tool and stage cards from the brand page).
- **Four previews.** The tool previews were captured on 15 Oct 2026 against this
  profile, with four gaps. The booth-studio and flythrough tiles are
  `lolly-start`'s captures, because the headless capture on current main gets no
  WebGL context inside those two three.js tools. Jump's first look and frame's
  third look ship no capture, so the gallery renders them live. Re-capture all
  four when the capture can draw them. The 3d tile was captured in installed
  Chrome with the machine's own GPU: three.js's WebGPU renderer fails on the
  SwiftShader adapter the generator pins.
- **The show.** The cast, studio sweeps, stick overlays, the glass disc, tool
  prizes, an OG set and the stage master arrive in a later change.
- **Spearmint marks.** Lolly's reverse, mono and mono-reverse marks still carry
  Pine. Spearmint replaces it once the marks can be signed again.
- **Honey for unsaved work.** The shell picks its unsaved cue (`--brand-warn`)
  by hue, the palette colour nearest OKLCH 50 degrees (`nearestWarmHex` in
  `shells/web/src/brand-vars.ts`), so Opal's Banksia, Outback or Bark wins and a
  pack has no slot to name Honey. Naming it needs a shell change.
