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

lolly.tools ships this profile: `scripts/data/ship-targets.json` and the
lolly.tools jobs in `.github/workflows/deployment-suse.yml` (the web frontend and
image, its probe, the MCP browser image and the /info build) build with
`lolly-demo`.
The packaged apps keep `lolly-start` through `release-frontend.yml`'s default,
and the Dockerfiles' own defaults stay `lolly-start`. Putting a build on the
live site is still a production change that goes through the deployment
handoff with one named owner.

## What's in the pack

- **The Lolly Demo design system** (`catalog/assets/lolly/tokens/demo.json`,
  asset id `lolly/tokens/demo`). A layered DTCG document in the starter's
  shape: a shared
  `base` set with Opal's named colours, the chart spectrum, the faces and the
  logo slots, plus `light` and `dark` sets with the seven semantic slots and the
  slide roles, and one `colourway/<id>` set for each of its six
  [colourways](#colourways). The index declares it with `"brandTokens": "lolly/tokens/demo"`, so
  the shell's token bridge discovers it, and because its id is not the
  starter's `lolly/tokens/brand` the shell treats this install as branded.
- **The former id, kept as an alias.** The design system shipped as
  `lolly/tokens/opal` from 16 October 2026, after its palette. Asset ids
  are permanent, so that entry stays in the index with `"deprecated": true` and
  `"replacedBy": "lolly/tokens/demo"`, reading the same `demo.json`: a saved
  reference to the old id still resolves, while discovery, the asset browser and
  queries only offer `lolly/tokens/demo`. The alias comes after the design system
  in the index and has no `brand` tag, because the CLI, the MCP server and the
  share-card builder pick the first tokens asset by index order or by that tag;
  `validate:catalog` fails when those readers would disagree with `brandTokens`.
- **The horizontal logo.** Lolly Demo's horizontal logo slots hold the Lolly
  wordmark, one drawing in three colours: `lolly/logo/horizontal` in Liquorice
  for light backgrounds, `lolly/logo/horizontal-reverse` in Daylight for dark
  ones and `lolly/logo/horizontal-on-brand` in Green Apple for the brand ground.
  The last one fills a custom `horizontal-on-brand` slot, which the app's Brand
  theme shows before the reverse form. The vertical slots keep the square swirl
  mark. The three wordmark files are this pack's own and carry no credentials
  yet.
- **Shared rows, byte for byte.** The Lolly marks (`lolly/logo/primary`,
  `reverse`, `mono` and `mono-reverse`), the demo
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
- **Four house rules.** The tokens carry a `brandSystem` in
  `$extensions['com.suse.lolly']` whose rules Design checks layer by layer
  (`engine/src/design-house-rules.ts`): the export panel's Before you export
  card, `lolly check` and the Start view's Usage & rules room all read them.
  Each rule cites the Lolly brand standards (`/brand`) or the pack's own brand
  skill (`lolly/skill/brand`):
  - `headline-case` (text-case, required): headlines are never set in capitals.
  - `body-align` (text-align, advisory): text in a body slot of the slide
    master is left-aligned. Text without a slot role is not checked, because
    short display lines may be centred.
  - `logo-surface` (advisory): primary marks on light, reverse marks on dark.
    The standards name no mark for photographs, so the `photo` list holds every
    mark with the reverse marks first, which keeps `?theme=auto` and compose
    picking the marks they picked before the rule existed.
  - `dash-reserved` (advisory): dashed lines mean drop here.

  All four are `draft`, so `lolly check` reports the required rule as a
  warning until someone approves the rule. Three kinds are left out on purpose.
  The slide master sets titles at weight 700 while the standards page sets
  headings at 500, so there is no single weight for a text-weight rule. The
  standards judge contrast by text size (4.5:1 for body text, 3:1 for large
  headings) and keep highlight colours off body text, which one list of text
  colours per background (color-pairing) cannot say. And stroke-on-rounded also
  reports a full accent ring, which the standards allow as a highlight. Case on every line and
  alignment on every text were tried as well: the community templates set their
  eyebrow labels in capitals and centre some short display lines on purpose, so
  both would have reported the shipped templates.
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

## Colourways

Lolly Demo carries six colourways, written with the engine's own editors
(`liftToColourways` and `addColourway` in `engine/src/colourway.ts`). Each one
links three roles to Opal colours in each look: the lead (`primary`), the colour
on the lead (`on-primary`) and the partner (`secondary`). Spearmint is canonical
and keeps exactly the colours Lolly Demo shipped with, and the app's own chrome
always follows the canonical lead.

| Colourway | Mood | Light: lead, on lead, partner | Dark: lead, on lead, partner |
|---|---|---|---|
| Spearmint (canonical) | Lolly's own green | Spearmint, Sugar, Bunyapine | Green Apple, Liquorice, Bunyapine |
| Morning | Sunrise with a clear sky | Outback, Sugar, Lagoon | Honey, Liquorice, Sky |
| Spring | Blossom on new leaves | Fuchsia, Sugar, Olive | Donut, Liquorice, Green Apple |
| Beach | Surf and sand | Lagoon, Liquorice, Bark | Reef, Liquorice, Pancake |
| Afternoon | Red earth in the arvo sun | Ochre, Sugar, Khaki | Arvo, Liquorice, Banksia |
| Midnight | Liquorice night, one Jacaranda star | Liquorice, Sugar, Jacaranda | Jacaranda, Liquorice, Swell |

In every look the label on the lead reads at 4.5:1 or more, and the lead and the
partner reach 3:1 or more on the surface. `tests/lolly-demo-colourways.test.ts`
resolves each pairing through the engine and fails when a palette change breaks
one, and it checks that the canonical colourway still resolves every token as
the single-lead pack did (`tests/fixtures/colourway/lolly-demo-single-lead.json`).
A tool's Design system section offers the colourways wherever the lead colour
changes what the tool draws, and a link chooses one with `_themes`, for example
`?_themes={"colourway":"beach"}` (URL-encoded in practice).

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
  this pack's tool index is unsigned and `lolly/tokens/demo` and the derived
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
