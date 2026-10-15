# brands/lolly-demo - Lolly Demo, Lolly's own demo brand

`lolly-demo` is the full Lolly demo brand: **Lolly Demo**, Lolly's first design
system, coloured with the **Opal** palette, for first use and testing.
`lolly-start` stays what it is, the
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

- **The Lolly Demo design system** (`catalog/assets/lolly/tokens/opal.json`;
  the asset id `lolly/tokens/opal` follows the palette's name). A layered DTCG
  document in the starter's shape: a shared
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
- **Emoji: Fluent Emoji Flat at Full palette influence.** The tokens carry
  the pack's emoji style in `$extensions['com.suse.lolly'].emoji`, which
  `brandEmojiStyle` (`engine/src/emoji-default.ts`) reads: the Fluent Emoji Flat
  2026.8.24 set, with the Palette influence control's "Full" setting (`snap`),
  so every paint moves to its nearest Opal colour while skin tones, flags and
  custom symbols keep their own. A link's choice or a saved session's own style
  still comes first. The style pins the first 64 colours the token bridge lists
  for Lolly Demo, the emoji palette's limit; the ones left over are a role that repeats
  Avocado and the chrome slots, which repeat named colours apart from Honey
  deep and the dark hover. Rewrite the block after a colour change.
- **No font files.** Outfit (headings), SUSE (text and italics) and SUSE Mono
  (code) are all served by the web shell from `shells/web/public/fonts/`, as for
  `lolly-start`.
- **No tools of its own.** Every tool comes from `community/`; `tools/` holds a
  README so the profile can mount the pack the same way it mounts a brand that
  does carry tools.
- **Lolly Demo's own share cards.** The tokens also declare
  `$extensions['com.suse.lolly'].shareCards: "opal"`, the card designs drawn in
  the Opal palette, so the card generator
  (`docs/og-image.ts` with `docs/og-opal.ts`) draws the brand page's house, tool
  and stage cards for this pack rather than putting it on its dark theme's
  Liquorice surface. `catalog/og/og.png` is the house landing card, which a build
  of this profile serves as `/og.png`; `catalog/og/` holds one tool card per tool
  and `catalog/og/views/` one house card per view, each set with its
  `.og-sigs.json`. The /info cards are build output and are not committed: the why
  pages take the stage card and every other page the house card. Regenerate with
  `LOLLY_PROFILE=lolly-demo` and `scripts/build-tool-og.ts`,
  `scripts/build-view-og.ts` and `scripts/build-og-base.ts`.

## The Opal palette

Every colour is a treat or a piece of nature, remembered by name and never by
number. A tint keeps its parent's name (Liquorice raised, Liquorice panel).

| Group | Colours |
|---|---|
| Greens, the main brand hue, by lightness | Spearmint `#033633`, Bunyapine `#008657`, Green Apple `#50c369`, Pandanus `#ace1ad` (raised washes and selected states), Avocado `#edf6e0` (the palest wash, for pages and paper) |
| Olive and Khaki | Khaki `#444f05`, Olive `#818e44` |
| Warm, deep red to soft yellow | Ochre `#72251c` (error text on light under High contrast), Bauxite `#a43427`, Outback `#c55123` (red earth, for charts), Arvo `#ef9275` (error text on dark), Banksia `#ee9138`, Honey `#fac044`, Wattle `#fdec9e` (a soft light yellow) |
| Earth and sand | Bark `#734f31`, Pancake `#d8b890`, Beach `#f2e1bf`, Meringue `#f9f7ef` |
| Flowers | Fuchsia `#da1889`, Donut `#f39dbd`, Jacaranda `#7476e0` |
| Waters | Lagoon `#1a85c4` and Sky `#5fcaff`; Reef `#25c2c2` and Swell `#b6f1f1` |
| Ink and light | Void `#000000`, Liquorice `#09141a` (raised `#121d24`, panel `#1c282f`), Basalt `#373e44`, Pebble `#99a0a4`, Sugar `#ffffff`, Daylight (HDR white: `#ffffff`, about 1,000 nits on HDR screens) |

- **Light, the crystal chalice:** Liquorice text on Sugar (18.6:1), Spearmint
  accent with a Sugar label (13.3:1), Basalt for quiet text, Pebble hairlines.
  Where Lolly Demo names a wash or paper for its own surfaces (the slide roles' cards,
  tracks and alternative ground), it takes the light greens: Avocado for cards
  and paper, Pandanus for tinted cards and tracks, and Wattle's soft yellow for the
  card a slide argues for. Cards that warn stay warm.
- **Dark, the stealth ship:** Sugar text on a Liquorice hull, Green Apple accent
  with a Liquorice label (8.3:1), Pebble for quiet text (7.0:1), Basalt edges.
- **Brand, home:** the shell builds it from the accents' hues.
- **Charts** take the spectrum in this order: Green Apple, Reef, Honey, Donut,
  Banksia, Olive, Outback, Bark. A verdict never relies on colour alone.

Lolly Demo also sets the app's own chrome in `color.chrome.*` in each theme set, which
the shell reads once PR #310 (a pack sets the chrome) is on main:

- **Light:** an Avocado page, Sugar cards, panels and menus, Pandanus edges,
  Liquorice ink and Basalt for quiet text. Unsaved work is Honey deep
  `#b57c0a`, because Honey itself reads under 3:1 on a light page.
- **Dark:** the Liquorice hull with its raised and panel tints, Basalt edges,
  Sugar ink and Pebble for quiet text, and Honey for unsaved work. Hover is
  `#263239`, a step above the panel, so Pebble keeps 4.96:1 on a hovered row;
  the hover the shell would work out (`#2d3a41`) gives 4.42:1.
- Under High contrast the pack's chrome steps aside and Lolly's own High
  contrast room takes over.

## Print

Every Opal colour carries a CMYK build in `com.suse.lolly.cmyk`, so a CMYK PDF
prints the same inks every time instead of the shell's naive conversion. The
builds target FOGRA39 (ISO Coated v2, the ECI profile), the press condition
Lolly's CMYK export declares by default, and were measured back through that
profile.

- Colours inside the press gamut print within about ΔE00 1.5 of the screen.
- Where the screen colour is outside the gamut, the build keeps hue and chroma
  first and lets lightness move (CIEDE2000 with kL 2; pale and dark colours keep
  lightness at full weight), with no black in bright colours and the ink total
  under 300%, or 280% for the darks.
- CMYK cannot reach Jacaranda (chroma 37 of 59), Green Apple (56 of 60), Swell,
  Pandanus, Reef and Sky. Void and the Liquorice tints are rich blacks at the
  press's deepest, about L 11.

Every colour except the paper whites (Sugar and Daylight) also names a spot ink
in `com.suse.lolly.spot`, for printing a colour at full strength: the nearest
colour in the [freieFarbe HLC Colour Atlas XL](https://freiefarbe.de/en/thema-farbe/hlc-colour-atlas/)
(13,283 colours, CC BY-ND 4.0, freieFarbe e.V.). HLC is an open colour system
defined in CIELAB (D50, 2° observer) and the basis of DIN SPEC 16699, "Open
Colour Communication". A colour's name is its own target (`H290_L055_C055` is
hue 290°, lightness 55, chroma 55), and the atlas publishes spectral data for
mixing each one as a spot ink. Every match is within ΔE00 2.4 of the screen
colour except Swell (3.95, nothing paler exists at its hue), and the spot keeps
the chroma CMYK loses: Jacaranda prints at chroma 55 as `H290_L055_C055`
against 37 in CMYK.

## Not done yet

- **Signing.** `pnpm run sign:credentials:catalog` and the catalog signature
  (`catalog/tools/index.sig.json`) need keys that the maintainer provisions, so
  this pack's tool index is unsigned and `lolly/tokens/opal` and the derived
  palette documents carry no Content Credentials. The shared files keep the
  credentials they were shipped with, apart from Lolly's four marks. On
  15 Oct 2026 the reverse, mono and mono-reverse marks took Spearmint as their
  dark in place of Pine, so their old manifests described other bytes. The
  primary mark's manifest no longer matched its artwork either. The four marks
  were signed again after the Spearmint change; PR #305 lists the steps.
- **Four previews.** The tool previews were captured on 15 Oct 2026 against this
  profile, with four gaps. The booth-studio and flythrough tiles are
  `lolly-start`'s captures, because the headless capture on current main gets no
  WebGL context inside those two three.js tools. Jump's first look and frame's
  third look ship no capture, so the gallery renders them live. Re-capture all
  four when the capture can draw them. The 3d tile was captured in installed
  Chrome with the machine's own GPU: three.js's WebGPU renderer fails on the
  SwiftShader adapter the generator pins.
- **The show.** The cast, studio sweeps, stick overlays, the glass disc, tool
  prizes and the stage master arrive in a later change. Until the prizes arrive,
  a tool card's sticker carries the tool's own catalog icon.
