# Emoji

Emoji in ordinary text are drawn from a pinned set. New work defaults to Fluent High Contrast 2026.8.24 with the original treatment, so its foreground follows the surrounding text colour. Explicit tool/document choices override that default. Engine 1.196 wires the foundation below into the render path the shells already use: the runtime walks a rendered tree, replaces each emoji cluster with the chosen pack's canonical artwork, recolours it through a pinned brand treatment and records the pack's rights in the export's Content Credentials. Web, CLI, TUI and MCP run the same code over the same bytes. Nothing falls back to a system emoji font: an explicitly cleared choice, a glyph a set does not carry and a pin the device does not hold all end at a neutral placeholder. The one case that is left alone is a device holding no set at all, where there is nothing to choose and a placeholder would be a mark nobody can clear.

Four things are wired. The pass over every rendered tree and every export, the brand treatment with its own deterministic colour core, seven packs mounted outside every brand so each profile serves the same files, and the picker grid, which now draws each cell from the chosen set instead of from the machine's font. Authored Design text also uses `host.text.layoutRuns` for paragraph composition, including inline emoji. The separate strict emoji line compiler remains a single LTR specimen. "Known gaps in the rendered pass" and "What is not built" below name the rest.

The public data types are in [`@lolly-tools/core/emoji-v1`](../packages/core/src/emoji-v1.ts), with mirrored [pack](../schemas/emoji-pack-v1.schema.json) and [style](../schemas/emoji-style-v1.schema.json) schemas. A pack rides the catalog as an ordinary `data` asset whose optional `meta.emoji` object, new in 1.196, carries the pin, glyph count and licence a shell reads before it downloads anything. `host.emoji` (`sets`, `manifest`, `artwork`, `parseXml`) is the optional HostV1 API a shell implements to list its sets and hand over exact bytes for an exact pin; a host holding a different release answers null rather than a substitute.

## What works

- `lookupEmojiSequence` recognizes one complete candidate using pinned Unicode Emoji 17.0 data, including 3,953 canonical entries and 1,272 exact qualification aliases. Canonical counts include the nine standalone components. Scalar keys use lowercase hexadecimal, at least four digits per scalar, separated by hyphens. Source text is preserved.
- `readEmojiPack(bytes, pin)` checks the exact manifest digest, identity, version, reader support, schema, canonical semantic keys, unique mappings and bounded metrics. It returns an opaque handle over an owned snapshot; `describeEmojiPack` reads its family and style names back. Installed or newer packs cannot bypass admission by copying a handle's public fields.
- `resolveEmoji(request, style, packs)` resolves through the saved primary and ordered fallback pins. An absent choice returns `selection-required`. An unavailable pin returns `pack-unavailable`; only an admitted pack's known coverage gap permits the next explicitly selected fallback. Unknown joined sequences stay unresolved as a whole.
- `verifyEmojiArtwork(pack, meaning, bytes)` checks the actual source SVG bytes against their pin, using an owned buffer even when the host supplies a Node Buffer. This is an integrity check. It does not sanitize SVG, compile paints, render pixels or prove licensing permission.
- `readEmojiStyle` and `withEmojiStyle` round-trip the selection in `$extensions['com.suse.lolly'].emoji`, preserving other design tokens and extensions. No preference is inferred, no installed pack becomes a default, and malformed styles remain invalid.
- `emojiSourceIngredients(master.sources)` turns a compiled line's census into one `componentOf` C2PA source ingredient per distinct artwork (see Rights below); `emojiCreditsText` writes the matching readable credits.
- `applyEmojiTreatment(prepared, treatment, meaning)` recolours admitted artwork to a brand palette with arithmetic that gives the same bytes on every JavaScript engine, and leaves protected meanings alone (see Brand treatment below).
- `isSingleInkEmojiSvg` and `inkPreparedEmojiSvg` bind a monochrome glyph's black paints to the surrounding text colour under the `original` treatment, the way the same artwork behaves when a set ships as a font (see Single-ink sets follow the text colour below).
- `prepareEmojiText` and `applyEmojiToDom` resolve, prepare, treat and place artwork for a run of text or a whole rendered tree, and `revertEmojiDom` puts the characters back (see The rendered pass below).

Unicode text and custom symbols are separate requests. Custom symbols require a namespaced id and readable label. Bare text-default characters such as copyright or a heart remain text in `auto` presentation; explicitly requesting emoji resolves the documented qualification alias. Standardized VS15 text variants preserve text presentation. No runtime `Intl.Segmenter`, ICU property regex or operating-system font lookup participates in these decisions.

The resolver consumes a single complete candidate. Use `segmentEmojiText` to find candidates inside mixed text; do not call the resolver separately on the scalar components of a joined emoji.

## Mixed text and SVG admission

`emojiGraphemes` implements extended grapheme boundaries from pinned Unicode 17.0 properties and [UAX29 revision 47](https://www.unicode.org/reports/tr29/tr29-47.html), with UTF-16 source offsets and no text normalization. It passes the complete official GraphemeBreakTest corpus, including Indic conjuncts, combining marks, regional indicators and pictographic ZWJ sequences. `segmentEmojiText` groups ordinary text, preserves complete known emoji and marks unknown emoji clusters as unsupported. Standalone skin-tone components extend a preceding grapheme under UAX29; the paragraph path does not extract them from that grapheme. The input limit is 65,536 UTF-16 units; unpaired surrogates fail.

`prepareEmojiSvg(pack, meaning, bytes, parseXml)` verifies the artwork digest before invoking the host's XML parser. It returns an opaque prepared handle or an explicit failure. The host supplies a non-networked XML parser. The exact standard SVG 1.1 public doctype is removed without loading it; all other DTD/entity declarations and processing instructions are rejected before parsing. Canonical serialization uses a shared engine tree, not host DOM serialization.

The static subset (`static-svg-v1`) preserves paths, basic shapes, groups, inline presentation attributes, transforms, explicit integer RGB paints, fixed pixel viewports without a viewBox, local shape instances, local linear/radial gradients, `clipPath` elements whose children are shapes or `use` references to a local shape (the idiom Illustrator emits), `clip-path`, `clip-rule` and `paint-order`. Colours must be hex values, integer RGB triplets, CSS colour keywords (canonicalized to hex), `none` or supported local references; inline styles retain precedence over presentation attributes. Declarations that cannot change the picture under this subset are omitted and recorded as changes rather than failing: `enable-background` (no filters), `class` (no stylesheets), `color` (no currentColor paint), `overflow` (nothing establishes a viewport) and `display` values other than `none`. A `display: none` element is dropped and recorded, with any gradient or clip path it contains kept referenceable in a definitions container, as the SVG specification requires. Duplicate ids, dangling references, references of the wrong kind, malformed paths and unsupported attributes fail. The engine rewrites ids and every local reference (paint, clip-path, use href) with a stable placement prefix so repeated glyphs cannot share the wrong gradient or clip. It does not approximate arcs or recover a valid prefix from an incomplete path. Packed arc flags are currently unsupported.

Unsupported visual features include text, images, masks, filters, external references, CSS stylesheets or variables, animation and foreign namespaces. They cause failure rather than silent removal. Admission bounds include 2 MiB input, 4,096 elements, depth 32, 48 attributes per element, 1 M aggregate attribute characters, 400 K characters per path/list, 100 K numeric arguments, 10 K path segments and finite scalar magnitudes at most 1 M. These are implementation limits, not evidence of acceptable performance for every full family.

The canonical artwork checksum uses the fixed `emoji` id prefix. Placement uses its own prefix and is bound by the finished master checksum. Checksums prove byte identity; neither this subset nor its handle establishes rights, recognisability, complete repertoire coverage or suitability for fabrication.

`compileEmojiLine` builds one experimental LTR line from a pinned sfnt font, an explicit emoji style and admitted packs. It snapshots inputs, resolves complete emoji spans before host IO, verifies actual font bytes, sends them to `host.text.toPath` as an inline font, and emits only outlines plus admitted vectors. It preserves measured text-run advances and source offsets, admits repeated artwork once, and produces no partial master on failure. The master includes a recipe and a census of incorporated emoji sources: each distinct artwork's pack pin, family and style, meaning, label, asset id, original licence and attribution, source/artwork/canonical checksums, normalization changes and occurrences.

HostV1 1.192 adds `TextToPathOpts.preserveWhitespaceAdvance`: both Web and Node can measure a whitespace-only run while returning empty outlines and null ink bounds. It is opt-in, preserving existing callers' blank-run behavior. Without this measurement, a space between two emoji would disappear.

This compiler is deliberately a development specimen: one font's default instance, fixed text paint, ordinary OpenType kerning/ligatures, provisional pack metrics, no custom-symbol stream, paragraph bidi, wrapping, line breaking or caret mapping. RTL, bidi controls, line separators, unsupported clusters, missing glyphs and unsupported artwork fail visibly. Its recipe declares replay of the materialized SVG. General recipe recompilation still needs a persisted, enforced shaper build and complete layout contract; the fixture harness pins the actual HarfBuzz WASM and glue bytes separately.

## The rendered pass

`applyEmojiToDom(root, style, packs, io, options)` in [`emoji-dom.ts`](src/emoji-dom.ts) walks the text nodes of a rendered tree over a minimal node interface the file declares itself, so jsdom, a browser and anything else that answers those members all work without a DOM type reaching the engine. A text node is only segmented when a cheap regex says it might carry emoji, and that trigger is a true superset of the pinned table: every key and every qualification alias in the 3,953-entry table matches it, so plain text never loads the tables. Each cluster becomes one span, with the cluster's own characters written here as `[the cluster]`:

```html
<span class="lolly-emoji" role="img" aria-label="grinning face" data-emoji="[the cluster]" data-emoji-key="1f600"><svg …>…</svg><span class="lolly-emoji-text">[the cluster]</span></span>
```

The inner span keeps the characters, clipped rather than removed, so copy, find-in-page and a screen reader still read the text, and both export walkers skip it by class so the characters are never painted twice. Sizing is `inline-em-v1` ([`emoji-inline.ts`](src/emoji-inline.ts)): height, width, advance and descent are read off the glyph's viewBox and metrics as multiples of the em and written as an inline style on the outer span, so the host lays the glyph out with the surrounding text exactly as it lays out text today. The engine measures nothing.

Two properties the tests pin. The pass is idempotent: a second walk over a drawn tree replaces nothing and reports the same census. And placement id prefixes come from the work item's position in document order, not from a counter, so the same tree gives the same bytes however many times the pass has run over it and an export taken after ten edits matches one taken after the first paint. A caller walking several roots into one document passes `idScope` to keep them apart. `revertEmojiDom(root)` restores the original text nodes, which is what a text box does before it becomes editable.

`runtime.applyEmojiToDom(node, opts?)` is the one entry point a shell calls. It reads `host.emoji` (answering `{ present: false }` where there is none), admits the style's packs once per runtime, serialises its passes so a set changed mid-walk cannot draw one style's glyphs against another style's packs, and keeps the census. `opts` is `{ track?, idScope? }`, and it is what separates the render from chrome that draws emoji of its own: see "The picker grid" below. `runtime.export()` runs the same pass on the node it is about to export, right after the `beforeExport` hook, so a mount site that forgot the live call still exports artwork. `runtime.setEmojiStyle`, `runtime.emoji` and `runtime.onEmojiChange` are the chrome's half of it, `runtime.emojiIngredients()` the half a shell that stamps its own credential needs.

Where the pass runs today, read off this tree:

| Surface | Call site |
|---|---|
| Web canvas | `views/tool/render.ts` after every paint, through `views/emoji-mount.ts` (a stale-render guard, and a failure never takes the canvas down) |
| Web previews, batch rows and the offscreen export stage | `pro/render-export.ts` `mountToolCanvas`, `views/multi-edit.ts` |
| Web presentation mode | `views/tool/session.ts`, over the engine's own render rather than the editor DOM |
| Design text boxes | `views/free-canvas/text-edit.ts` keeps a passive artwork mirror during editing, restores native text during IME composition, and redraws after commit |
| Design artboard thumbnails | `views/free-canvas.ts` and `free-canvas/document.ts` pass each frame clone themselves, because `frameThumb` clones the live page on the paint tick, before the page's own asynchronous pass has run (verified in Chromium on 2026-09-13: the thumbnail shows the set's artwork, not the machine's glyph) |
| CLI | `run.ts`, `raster.ts` and compose in `bridge.ts`; `mix.ts` and `smoke.ts` only export, so the export-time pass covers them |
| TUI and MCP | `shells/tui/src/engine-render.ts` and `services/mcp/src/render.ts`, both also handing `runtime.emojiIngredients()` to the stamp |
| Sidebar table cells | `views/tool-inputs.ts` `drawEmojiCells`, once when the sidebar builds and again after a pick. Untracked, with an id scope per table |
| Sidebar text and block fields | `components/input-emoji-display.ts`, in a passive display layer over the native field. Untracked, with an id scope per field |
| The picker grid and the character browser | `components/emoji-picker.ts` `drawPackArtwork`, over the component's shadow root. Untracked |
| The Emoji section's specimen row | `views/tool/emoji-section.ts`, over a detached element. Untracked |

Tools need no manifest change and no code of their own. The pass is a runtime service every tool gets, the design tool included: its text boxes are plain divs in the hydrated DOM.

## SVG text

`emoji-svg-text.ts` shapes ordinary text with the host's pinned font service and places the same glyph artwork in SVG. It supports simple LTR text, flat tspan lines and single continuous text paths, with scalar or percentage coordinates, tracking, text anchors and common middle/central/hanging baselines. Text paths use bounded cubic sampling and retain the source path for editing. Source Unicode stays in inert definitions so editing can restore it. The ordinary SVG outliner skips those definitions. Nested positioning, bidi, transformed or stretched text paths, unsupported baselines and missing fonts show neutral placeholders with an element diagnostic. This is not a paragraph or full SVG text layout engine.

## Brand treatment

A style carries a treatment: `original`, `influence`, `snap`, `mono` or `duotone`, with the palette pinned into the style at the moment it is made. [`emoji-treatment.ts`](src/emoji-treatment.ts) recolours every hex `fill`, `stroke` and `stop-color` in the canonical tree through it. Paint `none` and `url(#…)` references pass through untouched, and gradient stops are recoloured one at a time. A recoloured tree gets a fresh checksum and the normalizer `static-svg-v1+emoji-treatment-v1`, with the recolour recorded as a change, so a census reports what was actually placed. Where nothing is recoloured (mode `original`, a protected meaning, or a palette with too few usable colours for the mode) the input handle comes back as it is, with no clone and no re-hash.

### Single-ink sets follow the text colour

A monochrome set is line art drawn in black. Placed as it is, a black glyph stays black beside white text and on a dark surface, which is not how the same artwork behaves when the set ships as a font: there the glyph takes the colour of the run it sits in. So under the `original` treatment the engine binds single-ink artwork to the surrounding text.

A prepared glyph is **single ink** when every paint it carries, fill, stroke and stop colour, on every element, is `none`, black (`#000`, `#000000`, or a CSS keyword admission canonicalized to one of those) or white (`#fff`, `#ffffff`). A gradient, a `url(#…)` reference or any other colour makes it not single ink, and so does a paint that is already `currentColor`, which is what makes the rewrite idempotent. `inkPreparedEmojiSvg` in [`emoji-svg.ts`](src/emoji-svg.ts) then rewrites every black paint to `currentColor`; white stays white, `none` stays `none`, and nothing else in the tree moves. It is a string and tree rewrite with no colour maths, and the inked tree gets a fresh checksum and the normalizer `static-svg-v1+emoji-ink-v1`. Artwork that is not single ink, and artwork whose ink is all white, come back as the handle that went in.

Nothing styles the placement: an inline `<svg>` inherits CSS `color`, so the glyph reads the colour of the text it sits in, and the web SVG export walker stamps the live computed `color` onto each inline svg it clones so a standalone file keeps it.

Fluent High Contrast 2026.8.24 uses `#212121` and, in one glyph, `#1c1c1c` as foreground ink. For that exact admitted pack id, version and manifest checksum, those two paints count as black in the rule above. All 1,586 glyphs follow `currentColor`, while white details stay white. Source bundle bytes and pins are unchanged, and catalog specimens use the same rewrite. Greys in other packs retain their authored colour; a new Fluent pin needs its ink inventory reviewed before it gets this exception. `tests/emoji-fluent-ink.test.ts` checks the entire pinned set and raster output.

One sentence is recorded, `Single-ink paints follow the surrounding text colour.`, and it deliberately does **not** start with `EMOJI_RECOLOUR_PREFIX`. This is not an adaptation: no palette was applied and no colour was chosen, the document's own text colour is what draws, and it is the intended use of a monochrome set. The census therefore reports the glyph as `placed` and not `recoloured`, so a ShareAlike set asks for no adaptation licence for it. There is a note beside the `recoloured` derivation in [`emoji-rights.ts`](src/emoji-rights.ts) saying so, because the obvious "fix" is to widen that test.

The general black-and-white rule reads the artwork, with the pinned Fluent foreground greys as its only pack-specific exception. Measured on the original three bundles: all 4,316 OpenMoji Black glyphs are single ink, 79 of the 4,315 OpenMoji Color glyphs are (the symbols that set draws as black line art, such as copyright, registered, the white flag and the speech balloons), and none of the 3,953 Twemoji Color glyphs is. Under `influence`, `snap`, `mono` and `duotone` the recipe runs exactly as it always did, because there black is a palette decision like any other colour.

**Protected meanings keep their own colours by default.** A key containing a skin tone (1f3fb to 1f3ff), a key that is two regional indicators, a key carrying tag scalars and every custom symbol are returned unchanged unless the treatment's `protect` block says otherwise. Recolouring a flag or a skin tone changes what the glyph means, so it is a decision someone has to make on purpose.

**The colour maths is its own core and uses no transcendental function.** V8 (Node, Chromium) and JavaScriptCore (the WebView on Apple platforms) agree bit for bit on IEEE add, subtract, multiply, divide and square root. They do not agree on `pow`, `cbrt`, `exp` or `log`, so a treatment that called those could give one answer on the desktop and another on a phone. The core therefore decodes sRGB through `SRGB_TO_LINEAR`, a pinned table of 256 double literals generated once with `Math.pow` and committed; encodes back by binary search over that same table; converts to OKLab with Ottosson's M1 and M2 matrices and a cube root by a fixed 20-step Newton iteration; and measures distance as Euclidean distance in OKLab. Only `sqrt`, `min`, `max` and `round` run at treatment time. Measured: the table regenerates from `Math.pow` with zero drift (`tests/emoji-treatment.test.ts` fails on any), and the cube root is within 2.22e-16 relative error of `Math.cbrt` over 100,001 samples in [0, 1].

Nearest palette colour follows the rule `brand-map.ts` uses for brand colours, reimplemented inside the deterministic core rather than called: the palette is sorted by id, a near-grey paint only considers near-grey palette entries and a chromatic paint only chromatic ones, each side falling back to the whole palette when that leaves nothing. `influence` moves the source toward that target by `strengthBps / 10000` in OKLab, `snap` takes the target outright, `mono` keeps the source's own lightness and takes the palette colour's hue scaled by the source's chroma so grey stays grey, and `duotone` ramps lightness between the darkest and the lightest of two palette colours. `tests/emoji-browser.test.ts` recolours the pinned specimens in real Chromium and in Node and compares the bytes.

## Choosing a set

The document choice travels in three reserved parameters on web, CLI and MCP:

- `emoji=<id>@<version>` selects a locally available set. `emoji=none` explicitly clears a choice.
- `emojifx=original | influence:<bps> | snap | mono | duotone` is the convenient treatment syntax, with optional `,unprotected`. When used alone with `emoji`, it resolves the current brand palette.
- `emojistyle=<JSON>` preserves the complete `EmojiStyleV1`: exact manifest checksum and version, ordered fallbacks, treatment palette and protection. Generated links and session stamps include this snapshot. It takes precedence over the convenience parameters and is limited to 32,768 characters. Invalid snapshots are reported, never replaced with a different set.

Web precedence is URL, saved document, brand typography default, personal preference, then Fluent High Contrast. CLI and MCP seed from the brand when no emoji parameters were supplied, otherwise retaining the same runtime default. The exact Fluent pin is selected only if listed by the host; no other installed set or newer release substitutes for it. Listing sets does not fetch their artwork. Explicit `emoji=none` and unavailable explicit choices never fall through to the default. A saved choice is independent of later brand changes. `parseEmojiParams` and `emojiParams` in [`emoji-style.ts`](src/emoji-style.ts) own the parser and writer, and [`emoji-default.ts`](src/emoji-default.ts) defines the shared default.

The control supports ordered fallback, creating a partial set from SVG files, importing a full bundle, exporting that bundle and downloading readable glyph credits. Unicode filenames such as `1f600.svg` replace that character; other filenames become named custom symbols in the asset library. Admission verifies every hash and the complete bounded SVG subset before storing the set. Source notices and a reviewed redistribution licence are required. An existing ID/version cannot be overwritten with different artwork.

Selected bundles become explicit user-asset dependencies. Sessions, templates, history, `.lolly` files and portable sharing carry those original bundles through the normal asset walkers. Opening a `.lolly` file on a fresh offline host restores exact manifests, artwork and treatment. A plain URL carries the style but not the pack bytes: recipients need those sets installed, or a portable document containing them.

Brand typography stores the same style and dependencies in the DTCG vendor extension. New work inherits it without rewriting earlier documents.

## The pack, and the shared mount that carries it

Seven packs are registered, all `tier: on-demand` and all in the one shared root, so every profile offers the same choice. Each is a single `EmojiPackBundleV1` JSON file carrying the exact manifest text plus each glyph's untouched source SVG, so one fetch is a whole set and the boot cost is its index entry:

| Set | Pack id | Glyphs | Canonical Unicode 17 keys | Bundle bytes, raw and gzip | Licence | Refused | Withheld |
|---|---|---|---|---|---|---|---|
| Twemoji Color 17.0.3 | `community/emoji/twemoji/color` | 3,953 | 3,953 of 3,953 | 15,710,132 / 2,083,025 | CC BY 4.0 | 0 | 0 |
| OpenMoji Color 17.0.0 | `community/emoji/openmoji/color` | 4,315 (3,949 Unicode, 366 OpenMoji symbols) | 3,949 of 3,953 | 20,696,471 / 2,447,694 | CC BY-SA 4.0 | 5 | 0 |
| OpenMoji Black 17.0.0 | `community/emoji/openmoji/black` | 4,316 (3,950 Unicode, 366 OpenMoji symbols) | 3,950 of 3,953 | 15,021,297 / 1,475,011 | CC BY-SA 4.0 | 4 | 0 |
| Fluent Emoji Flat 2026.8.24 | `community/emoji/fluent/flat` | 3,139 | 3,139 of 3,953 | 20,880,756 / 2,593,961 | MIT | 6 | 0 |
| Fluent Emoji High Contrast 2026.8.24 | `community/emoji/fluent/high-contrast` | 1,586 | 1,586 of 3,953 | 8,131,079 / 2,569,928 | MIT | 9 | 0 |
| Noto Emoji Color 2.051 | `community/emoji/noto/color` | 3,678 | 3,678 of 3,953 | 37,756,382 / 5,267,955 | Apache 2.0 | 11 | 2 |
| Blobmoji Color 2023.6.25 | `community/emoji/blobmoji/color` | 2,996 | 2,996 of 3,953 | 21,609,786 / 3,028,939 | Apache 2.0 | 417 | 4 |

Refused means the engine's static subset would not admit the upstream file: an id with a space in it, mojibake in an id, a stray text node. `--skip-refused` leaves those out and `meta.emoji.missing` names each one with the message it was refused with, so a gap in a set is a record rather than a surprise, and `coverageComplete` is false for both OpenMoji sets because of it. Nothing is withheld from the original three sets.

OpenMoji is ShareAlike, and the set control says so where the choice is made: Lolly records recoloured artwork from a ShareAlike set as an adaptation, under a named rule (`adaptation-operations-v1`) rather than as a ruling, and the export panel is where a compatible licence for sharing one is chosen. It never blocks the treatment. Recolouring is read per glyph, off the changes the renderer recorded, so a flag or a skin-toned sequence the treatment left alone is not reported as recoloured.

Noto upstream release 2.051 uses pack version `2.51.0` to satisfy the catalog version grammar. Fluent and Blobmoji use the pinned commit dates as their pack versions; the complete commit hashes remain in every source record.

The 2026-09-19 expansion adds two Fluent styles, Noto and Blobmoji. Bundles have a shared 64 MiB ceiling in the SDK, web host, Node host and audit; individual manifests retain their 32 MiB limit. This admits the measured 37.8 MB Noto bundle without relaxing per-glyph SVG limits. Downloads remain on demand and catalog specimens are baked into the index.

None of the new packs includes regional flags; coverage is measured against Unicode 17, rather than inferred from an upstream label. Fluent High Contrast has fewer tone variants than Flat. Blobmoji's grinning face contains an embedded bitmap, so that glyph is refused and its catalog specimen has four glyphs. Missing characters use the existing explicit fallback selection or neutral placeholder. No operating-system artwork or unselected pack fills a gap.

Fluent Color was measured but is not registered: only 183 of 3,145 source glyphs fit the static subset; most require filters, masks or blend modes. Full-family comparison at 64 px found no pixel differences for the admitted new artwork. Two Noto glyphs (rainbow flag, package) and four Blobmoji glyphs (cocktail glass, man lifting weights, lady beetle, hot beverage) crash the pinned resvg 2.6.2 in their original form and remain withheld. The admission reports are in `tests/fixtures/emoji/expansion/`.

The source census now carries the admitted pack's notice texts into rights evaluation, so MIT permission text and Apache notices reach readable export credits. Repeated identical notice blocks appear once in those credits.

Every entry carries a `rights` record (plan 253): the family as one work, its creators, its source at the pinned revision, and the licence declaration with the notice file's sha256, asserted by the catalog rather than signed by the artists. `scripts/import-emoji-pack.ts <family> --bundle=all --bundle-out=<file>` generates a bundle and prints the entry to register; `scripts/check-emoji-packs.ts --bundle=… --entry=…` checks that the bundle parses, that the manifest text's sha256 equals the `meta.emoji.checksum` in the asset index, that `readEmojiPack` admits it, that every artwork entry hashes to its glyph's checksum, and that every absence the entry records carries a key and a reason and is genuinely absent from the pack.

They do not live in a brand catalog. They live in a SHARED ASSET ROOT, `community/emoji-packs/` - a directory holding its own `index.json` plus its files - which every profile lists under the optional `assets` key in `profiles.json`. `packages/node-shell/src/content-roots.ts` is where that is resolved: `contentRoots().assetRoots` names the mounted roots, `catalogFile('packs/<name>/<rel>')` resolves the profile-independent url namespace `/catalog/packs/<rootName>/<file>`, `readAssetIndex()` is the brand's entries with every mounted root's appended in root order, and `materializeInto()` writes both into `dist/`. The prefix stays under `/catalog/` on purpose: the service worker, `instanceFetch`, the Tauri static export and every script that strips a catalog url keep working with no new prefix to learn. An asset id claimed by two roots is refused at read time, never resolved by order.

Two rules that fall out of the mount. A shared root is ADDITIVE, so a root that is not on disk is skipped rather than fatal - `isComplete` judges tools and catalog only. That is what lets a deployment leave the pack bundles out of a function's trace and still resolve content: a pack stays listed because `index.json` is traced, and `createNodeEmojiAPI` answers null for bytes it cannot find, so an MCP render draws the neutral placeholder where the web draws Twemoji. And the dev server assembles the merged index per request (`shells/web/vite.config.js`, `mergedAssetIndex`) with an ETag over the resolved profile plus each input's path, mtime and size - a date alone cannot tell two profiles apart, because the shared pack's `index.json` is the newest input on both.

What that means on a device, stated plainly. Every profile - `suse` and `lolly-start` alike - serves the same sets from the same files, so there is a set to choose everywhere and a chooser appears wherever a render carries emoji. A profile that mounted no pack would still have nothing to choose and the pass would leave its text alone; that is now a configuration nobody ships rather than the default state.

## The catalog set browser

Catalog tiles keep their five baked specimen glyphs. Opening an emoji set's item modal loads its exact manifest and offers every admitted glyph, including skin-tone variants and custom symbols. Search accepts names, pasted emoji, Unicode codes and symbol IDs. The glyph-type filter, size slider and arrow-key navigation work inside the modal; selecting a glyph shows larger artwork and a copy action. Custom symbols copy their ID because they have no Unicode character.

The browser prepares visible artwork through `prepareEmojiSvg`, preserving the set's original colours and using separate image documents for local SVG IDs. Closing or paging away stops pending paints and revokes its object URLs. A failed download offers a retry. The browser does not change an emoji preference; the existing **Use this set** action does that.

## The picker grid

The insertion button beside a sidebar text or block field, a table's `emoji` column, and the Emoji tab of the text workspace's character browser all use the same picker. New work opens its grid with Fluent High Contrast, unless a more specific choice applies. When no set is selected, the picker asks for one before showing its grid. Continue applies that choice to the document; the checked 'Use this set for new work' option also saves a profile seed. Change emoji set offers the same control again. Cancelling a draft leaves the current style and text alone. Text fields insert at the caret or replace the selection; emoji table cells replace the whole cell. The input's existing edit handlers still own validation, state and history.

All three surfaces draw the chosen set. `drawPackArtwork` in [`emoji-picker.ts`](../shells/web/src/components/emoji-picker.ts) takes the runtime's pass from its caller and walks the component's open shadow root: each cell's text node becomes the pack's artwork with the characters kept in the clipped span, and the placement is inline-styled, so no stylesheet has to cross the shadow boundary. The component keeps its own data, so search, keyboard focus and what a pick reports are untouched, and nothing in that chunk imports an engine emoji module.

Four things decide what it costs and what it shows.

- **Only the visible window is drawn.** Every cell of every category is in the DOM from the moment the component mounts, and one pass over all of them measured 2,982 ms in jsdom on a 2026 laptop for the full 3,953-glyph pack. A second pass over the same drawn grid is 163 ms. So the first pass draws only the cells the component is showing (about 99 ms for the 60 of a first screen), a MutationObserver coalesces each burst through one animation frame - the grid being built, a category switch, a search, cells losing `lazy-load` as they scroll in - and a drawn cell is left alone. Measured in Chromium on 2026-09-13: 82 placements on open (10 tab strip, 72 grid cells) out of 4,257 cells, rising to 154 after switching category. A fast flick can still paint the raw glyph for a frame before the pass lands; the component clears `lazy-load` before our burst runs, and no synchronous pass exists to prevent it.
- **Each tab is its own target**, not the strip as a whole. A set that carries some tab glyphs and not others would otherwise leave the rest showing the machine's font for the life of the popover.
- **A set chosen while the grid is open redraws it.** The pass is idempotent, so an already-drawn cell would otherwise keep the set it was drawn with. A caller that also hands in `revert` and `onSetChange` gets `run.redraw()`: the characters go back, the probe runs again and the visible cells are drawn from the new set. Both the popover and the character browser wire it through `runtime.revertEmojiDom` and `runtime.onEmojiChange`.
- **A pass that draws nothing leaves the grid alone.** A probe over a detached copy of the tab strip answers first: with no set chosen, no pack on the device, or no `host.emoji` at all, the watch stops and the component's own grid stands. A wall of several thousand identical placeholders is not a picker. The application surfaces ask for a set before mounting this grid; a bare component caller without selection support still gets this fallback. A catalog load failure offers a retry, and closing a loading popover cannot leave it over the next tool.

**Chrome that draws emoji passes `track: false`.** `runtime.applyEmojiToDom(node, opts)` takes `{ track?, idScope? }`. A tracked pass IS the render: the tree becomes the one a set change redraws and its counts are what `runtime.emoji` reports, which is what the Emoji section is shown on. A sidebar table cell, a picker cell and the section's own specimen row are not the render, so they pass `track: false` and an `idScope` of their own - placement ids are named after a work item's place in the tree it was handed, so two roots walked into ONE document both start at the beginning and one root's gradient or clip path would paint the other's glyph. The canvas keeps the default scope `e`; a sidebar table takes `s<n>_`, a picker cell `p`, the specimen `x`. Three of the 3,953 Twemoji glyphs mint local ids, so the collision was narrow and silent.

The sidebar's emoji table cells get the same treatment, drawn once when the sidebar builds and again after a pick. Ordinary text, long-text and block fields keep their native editing control and draw the chosen artwork in a passive display layer above it. The layer uses the field's typography, character advances, wrapping and scroll position; only the native glyph paint is hidden. The value remains Unicode, and focus, caret, selection, copy/paste and undo remain native. A set or treatment change redraws the layer. During IME composition the native field is visible, then the artwork returns when composition ends. Empty text and teardown restore the original paint. The layer is hidden from assistive technology and never contributes sources to an export.

## Tool coverage and layout limits

The runtime runs separate HTML and SVG passes. Work Avatar keeps mixed emoji text available to the curved SVG pass instead of losing it during font outlining; Wordmark uses the same path for straight text. Audiogram captions are timed HTML runs, so caption preview and frame export receive the same artwork. Growth and Synth sample the runtime's mixed vector text for their text shapes. Brand Lockup preserves mixed descriptor artwork. Annotate resolves its generated SVG text before baking an overlay, and Redact uses the same artwork for SVG, raster and PDF stamps.

The optional runtime-scoped `host.emoji.renderText()` returns bounded single-line vector artwork and metrics. `host.emoji.renderSvg()` resolves supported text in tool-generated SVG. Both use the document's exact pins and treatment. Tools that keep sampled text in a rendered scene declare `data-emoji-tool-source` on a source marker so credits include the artwork actually used. A set change reruns those hooks. These methods load lazily and ordinary tools pay no Unicode-table loading cost.

Bidi paragraphs, arbitrary nested SVG positioning, font generation, spatial extrusion and fabrication adapters remain outside this 2D workflow. Unsupported text layouts show a diagnostic and neutral placeholders rather than silently selecting a system emoji font.

- **A device with no packs is left alone.** The placeholder is a prompt: choose a
  set. Where `host.emoji.sets()` is empty there is no set to choose, so the
  runtime leaves the characters exactly as the tool drew them rather than marking
  every emoji with a mark nobody can clear. A set that exists but has not been
  chosen, and a chosen set that does not carry a glyph, both still draw the
  placeholder: those are choices a person can act on. A pin the device does not
  hold is logged as a warning, so a link naming a set nobody has does not degrade
  in silence.
- **Placement ids come from document order.** Each work item's position in the
  walk, plus the placement index within it, names the local ids of that glyph's
  artwork. Nothing counts passes, so the same tree gives the same bytes however
  many times the pass has run over it and an export taken after ten edits matches
  one taken after the first paint. A caller walking several roots into one
  document passes `idScope` to keep them apart.

## Rights: source ingredients in Content Credentials

Engine 1.194 adds the piece plans 252 and 253 both asked for: a source that carries no Content Credential of its own can be recorded as an ingredient without inventing one. The SDK's `SourceIngredient` (`credential: 'none'`) becomes a `c2pa.ingredient.v3` assertion with no `activeManifest` and no `validationResults`, binds the original bytes through the ingredient's external hashed URI (public URL plus sha256) when a locator exists, and carries the rights Lolly read (creator, licence and URL, attribution, source, revision, modifications, source and used hashes) in a `tools.lolly.rights` assertion bound to that ingredient. The action now follows the relationship: `componentOf` is recorded as `c2pa.placed` after the head step, `parentOf` stays `c2pa.opened` first, and a manifest with two parents is refused. The reader (`collectIngredientRecords`, `C2paReport.ingredients`) lists every recorded ingredient with its bound rights.

`emojiSourceIngredients` maps a compiled line's census onto that: one `componentOf` ingredient per distinct artwork, titled by glyph and set, bound to the untouched upstream bytes at their raw source URL, with the rights record naming the source licence (CC BY-SA stays CC BY-SA), every normalization change and the canonical hash actually placed. `tests/c2pa-source-ingredients.test.ts` embeds the real Twemoji, OpenMoji and Noto specimens into PNG and SVG, reads them back through Lolly's verifier, and c2patool 0.26.68 reports the PNG `Valid` with no status beyond the expected self-signed marker.

Since 1.196 the export path calls it. `runtime.export()` appends `emojiSourceIngredients(census)` to the export's ingredients under the same two gates as the credentialed ones: a `privacy: on-device` tool never stamps anything into a user's own file, and an export with no manifest metadata records nothing. So a PNG, PDF or SVG that placed pack artwork now carries one `componentOf` source ingredient per distinct glyph, each bound to the untouched upstream bytes at their raw source URL and carrying the licence Lolly read. The CLI, the TUI and the MCP render route stamp with `runtime.emojiIngredients()` because their own export bridges build the C2PA options themselves. The web shell's Verify page reads them back: its Sources panel lists every ingredient a file records, with its relationship, licence, creator, source link and modifications, and says plainly when a source was recorded by the exporter rather than signed by the source.

Since 1.197 the census is also evaluated, and the readable credit is delivered. `emojiWorksAndUses(sources)` says the same census in the shared rights vocabulary of plan 253: one work per distinct artwork carrying the pack's declaration as evidence the CATALOG asserted, one incorporated use pinned to the asset and version drawn, and the operations the pass actually performed. Recolouring is read per glyph off the changes the renderer recorded, never off the style that was asked for, so a protected flag or skin-toned sequence the treatment left alone is not reported as changed and no adaptation decision is asked for where none is owed. `runtime.rights(context)` evaluates that census against the reviewed licence profiles, `runtime.export()` freezes one evaluation and hands its plan to the host, and `sourceIngredientsFor` over the census produces byte-identical ingredients to `emojiSourceIngredients` for the same sources, which `tests/rights-runtime.test.ts` pins. The credit itself now reaches people: the export panel's Source credits card with Copy credit, the CLI's `Rights:` block, the MCP render and verify results, and a `.lolly` pack's `CREDITS.txt`. All of those build it with `attributionCredits(plan)`, the one writer for every surface; the Emoji control also downloads an emoji-only credit file through `runtime.emojiCredits()` and `emojiCreditsText`. A ShareAlike set is where this shows up first: recolour an OpenMoji glyph and the export panel asks, once, for a compatible licence for the adaptation before it is shared. See [`docs/creative-rights.md`](../docs/creative-rights.md) for the states, the profiles and their citations.

## Data and source evidence

The Unicode sources, hashes and notices are checked into [`scripts/data/unicode/17.0`](../scripts/data/unicode/17.0). [`build-emoji-data.ts`](../scripts/build-emoji-data.ts) generates the engine table offline and rejects source drift. The engine carries the Unicode licence alongside the table. The selected stable release was checked against [Unicode's release page](https://www.unicode.org/versions/latest/); the exact inputs are [emoji-test.txt](https://www.unicode.org/Public/17.0.0/emoji/emoji-test.txt) and [emoji-variation-sequences.txt](https://www.unicode.org/Public/17.0.0/ucd/emoji/emoji-variation-sequences.txt).

[`build-emoji-text-data.ts`](../scripts/build-emoji-text-data.ts) separately pins and generates the grapheme, conjunct, pictographic and conservative bidi-guard tables from Unicode 17.0 UCD inputs: [GraphemeBreakProperty](https://www.unicode.org/Public/17.0.0/ucd/auxiliary/GraphemeBreakProperty.txt), [GraphemeBreakTest](https://www.unicode.org/Public/17.0.0/ucd/auxiliary/GraphemeBreakTest.txt), [DerivedCoreProperties](https://www.unicode.org/Public/17.0.0/ucd/DerivedCoreProperties.txt), [emoji-data](https://www.unicode.org/Public/17.0.0/ucd/emoji/emoji-data.txt) and [DerivedBidiClass](https://www.unicode.org/Public/17.0.0/ucd/extracted/DerivedBidiClass.txt). The bidi table is a rejection guard for the first line experiment, not a UAX9 implementation.

[`tests/fixtures/emoji`](../tests/fixtures/emoji) contains one untouched grinning-face SVG from each pinned OpenMoji, Twemoji and Noto release, plus the Noto tornado (a real clipPath-through-use glyph), notices and a lock file. These are development specimens, not complete installed families. All three reports deliberately say `coverageComplete: false`. The 0.85-em baseline in the specimens is a proposed metric for future layout experiments, not an approved normalization or measured typographic result.

Each glyph preserves its creator, source URL/revision, licence, attribution, modification list and source checksum separately from the asset checksum. OpenMoji remains CC BY-SA, Twemoji CC BY, and Noto's specimen retains the SVG-specific Apache notice and full licence text. The font-level Noto licence does not replace the artwork notice.

### Full-family evidence (2026-09-12, local run)

`scripts/import-emoji-pack.ts` reads a sparse, blob-filtered clone of each upstream repository at its pinned commit (`dist/emoji-sources`, gitignored, fetched with git rather than a release archive so the commit hash is the content identity) and produces a full `EmojiPackManifestV1`, admits it, runs every glyph through the static subset, and with `--verify` and `--measure` renders each admitted glyph in a child process to compare decoded pixels with the untouched source and to measure its ink box. Reports land in `dist/emoji-packs/<family>/report.json`; nothing is committed. Measured against the 3,953 canonical Unicode 17 entries:

| Family, style, release | Files | Canonical coverage | Admitted | Pixel-identical | Reference raster crashes | Source bytes |
|---|---|---|---|---|---|---|
| OpenMoji Color 17.0.0 (CC BY-SA 4.0) | 4,495 (367 private-use extras kept as custom symbols, 175 non-Unicode sequences unmapped) | 3,953 of 3,953; 259/259 regional flags, 2,035/2,035 skin tones | 4,315 of 4,320 | all admitted | 0 | 14.2 MB |
| OpenMoji Black 17.0.0 (CC BY-SA 4.0) | 4,495 | 3,953 of 3,953 | 4,316 of 4,320 | all admitted | 0 | 8.6 MB |
| Twemoji Color 17.0.3 (CC BY 4.0) | 4,009 (56 unmapped legacy files) | 3,953 of 3,953; 259/259 flags, 2,035/2,035 skin tones | 3,952 of 3,953 | all admitted | 0 | 10.1 MB |
| Noto Emoji Color 2.051 (Apache 2.0) | 3,731 | 3,691 of 3,953: the 262 missing keys are exactly the regional and tag flags, which upstream keeps outside `svg/` | 3,680 of 3,691 | 3,678 | 2 (rainbow flag, package) | 32.1 MB |

The remaining refusals are upstream defects, correctly refused: OpenMoji ids containing spaces (`25FC`, `25FE`), mojibake in an id (`2B1B`, `E06C`) and a stray text node (`1F684`); one Twemoji file with a namespaced attribute; eleven Noto files with non-ASCII attribute characters. The two Noto crashes are a resvg 2.6.2 panic (`geom.rs:27`) on an element lying entirely outside the viewport with an opacity; the untouched source crashes it exactly as the canonical form does, so those glyphs carry no raster claim until the reference rasteriser is upgraded, and any batch raster path must isolate the renderer as the import script now does.

Ink at 64 px (fraction of the em box, median, with p10 and p90): OpenMoji 0.70 wide (0.55 to 0.91) and 0.72 tall; Twemoji 0.98 (0.72 to 1.00) both ways; Noto 0.92 wide and 0.94 tall. Every family is centred at 0.50 vertically. At equal em size an OpenMoji glyph therefore reads about 1.4 times smaller than a Twemoji one; the difference is scale, not baseline. This is the measured input for the `inline-em-v1` optical normalization decision, which still needs designer review before any value is frozen.

### Second-OS replay (2026-09-12)

[`replay-evidence.json`](../tests/fixtures/emoji/replay-evidence.json) records that the three line specimens produce the golden canonical SVG checksums and decoded RGBA digests on macOS arm64, Linux arm64 and Linux x86_64 (Node 24 in a container with the repository mounted read-only, the pinned engine, font and HarfBuzz bytes, and resvg 2.6.2 installed fresh for Linux). `scripts/emoji-replay-linux.sh` reruns the comparison with podman or docker and exits non-zero on any difference. This is evidence from those three hosts only, not a certification of every platform or of browser and GPU rasterizers.

## Decisions recorded for Phase 0 of plan 252

- **Baseline pack, shipped:** Twemoji Color 17.0.3. Complete canonical coverage, 99.97 percent admitted, every admitted glyph pixel-identical, CC BY 4.0 (attribution only, deliverable as a source ingredient), 10 MB of source. OpenMoji is equally complete but CC BY-SA, with a ShareAlike policy for recoloured and compiled derivatives still to be written, and 30 percent smaller optical size. Noto's SVG set has no flags and two glyphs that crash the pinned rasteriser. The complete Twemoji bundle is what is registered, described above; the 171-glyph starter subset it replaced is gone.
- **Manifest carrier:** the standalone `EmojiPackManifestV1` JSON validated by its own schema. A full family with per-glyph source records is 4.5 to 5.4 MB; a compact form (pack-level source with per-glyph overrides) is still a follow-up, and it is what would bring the 15.7 MB bundle down. The plan's idea of embedding the manifest in a `tokens` catalog asset stays deferred.
- **Shared pack mount, built:** `profiles.json` gained the optional `assets` list, the resolver gained `assetRoots`, the `packs/` namespace, `readAssetIndex` and the materialize step, and an id in two roots is refused rather than ordered. See "The pack, and the shared mount that carries it" above.
- **Metric normalization, open:** the ink measurements above are the evidence; `inline-em-v1` keeps the provisional 0.85 em baseline and no optical scale until designers approve one.
- **Renderer build:** resvg 2.6.2 stays the pinned reference for the specimens, with the two Noto crash exclusions documented. An upgrade needs the fixture goldens and the replay evidence regenerated together.
- **Minimum reader:** 1, unchanged.
- **Picker, built and revised:** `unicode-emoji-picker` has no renderer hook, but it attaches an OPEN shadow root, which turned out to be the hook. The earlier decision (replace the grid with a Lolly-owned virtualised one) was not carried out and is withdrawn: the component keeps its grid, its data, its search and its keyboard handling, and `drawPackArtwork` in `shells/web/src/components/emoji-picker.ts` walks the shadow root with the runtime's own pass so every cell and every tab glyph is the chosen set's artwork. See "The picker grid" above for what is drawn and when.
- **Device budgets, open:** nothing has been measured on a modest device.

## Validation

Run from the repository root:

```sh
node scripts/build-emoji-data.ts --check
node scripts/build-emoji-text-data.ts --check
node scripts/check-emoji-packs.ts
node scripts/check-emoji-packs.ts --bundle=community/emoji-packs/twemoji-color.json --entry=community/emoji-packs/index.json
node --test 'tests/emoji-*.test.ts' tests/c2pa-source-ingredients.test.ts
node scripts/build-emoji-specimens.ts
```

The mount itself is validated by the catalog gates, which cover the shared root on every profile:

```sh
pnpm run validate:catalog:all
node --test packages/node-shell/test/content-roots-packs.test.ts \
  packages/node-shell/test/emoji.test.ts \
  services/mcp/test/asset-index-shared.test.ts
```

The shell halves are co-located tests and need the CSS stub the suite runner uses:

```sh
node --import ./tests/css-stub.mjs --test \
  shells/web/src/bridge/emoji.test.ts \
  shells/web/src/components/emoji-style-control.test.ts \
  shells/web/src/lib/emoji-prefs.test.ts \
  shells/web/src/views/tool/emoji-section.test.ts \
  shells/web/src/views/tool/emoji-doc.test.ts \
  shells/web/src/views/design-inspector-emoji.test.ts \
  shells/web/src/views/free-canvas/text-edit-emoji.test.ts \
  shells/web/src/bridge/export-emoji-skip.test.ts \
  shells/web/src/components/emoji-picker.test.ts \
  shells/web/src/asset-index-dev.test.ts \
  packages/node-shell/test/emoji.test.ts \
  services/mcp/test/emoji-ingredients.test.ts
```

With network access and 200 MB of disk, the full-family evidence reruns from a sparse clone of each upstream at its pinned commit into `dist/emoji-sources` (see the git commands in `scripts/import-emoji-pack.ts`'s header and the pins in `tests/fixtures/emoji/packs.lock.json`), then `node scripts/import-emoji-pack.ts all --verify --measure`. With podman or docker, `scripts/emoji-replay-linux.sh [linux/arm64|linux/amd64]` reruns the second-OS replay.

The audit command also accepts `--lock=path/to/packs.lock.json`. It reads local files only, verifies source/notices and artwork hashes, and prints measured coverage of each snapshot. It rejects paths outside the snapshot; it does not import arbitrary remote SVGs or claim they are safe to render.

The tests compare every official Unicode emoji and grapheme row, exercise malformed packs/SVGs, missing choices/versions, custom symbols, ordered fallback, variation selectors, corrupt bytes, mutation during hashing, DTCG round-trips, the widened SVG subset (a synthetic Illustrator-idiom sample and the real Noto tornado, both pixel-identical to source), the source-ingredient writer and reader, and the credits text. Real Chromium tests compare pack resolution and complete mixed-line masters with Node. The line test installs only the checked local HarfBuzz/font resources, removes request routes, disconnects browser networking and then compiles all three families. Browser tests skip explicitly when Chromium is unavailable; the c2patool cross-check skips when the tool is not on PATH.

The pass and the treatment have their own suites. `tests/emoji-treatment.test.ts` regenerates the sRGB table, pins hex outputs for a fixed palette in every mode and checks the core against `hexToOklch` from `brand-derive.ts`. `tests/emoji-dom.test.ts` covers idempotence, text preservation, escaping, revert, the skip list, per-placement ids, a carriage return and the svg-root gap. `tests/emoji-runtime.test.ts` covers the runtime API, the ingredient append and the host with no `host.emoji`. `tests/emoji-cli-render.test.ts` renders through the CLI twice and compares bytes, and `tests/emoji-browser.test.ts` compares Chromium against Node for both pack resolution and recolouring. `tests/emoji-ink.test.ts` covers the single-ink rule: detection over synthetic paints and over three real OpenMoji Black glyphs (including the one glyph in 4,316 that carries a white stroke), the one recorded sentence, the untouched colour specimens with their checksums from before the rule existed, a `snap` treatment still taking black through the recipe, the census reporting the glyph as placed and not recoloured, and resvg decoding the inked glyph to the colour it inherits rather than to black. It skips by name where the shared pack bundle is not in the checkout.

Canonical SVG and untouched source artwork produce identical decoded RGBA pixels in resvg at 24, 72 and 256 pixels for all four fixtures. Mixed lines have committed SVG and decoded-pixel hash goldens. [`render.lock.json`](../tests/fixtures/emoji/render.lock.json) checks Outfit font bytes, HarfBuzz 1.6.1 WASM/glue bytes and resvg 2.6.2. Production raster receipts still need an enforced renderer build, options and colour contract.

The specimen script writes standalone SVGs, PNGs, JSON source/recipe records, upstream notices and a comparison sheet into `dist/emoji-specimens/`. That directory is local review output. Its README explicitly states that Content Credentials and attribution-delivery receipts are absent from those files.

The SDK packaging smoke imports both emoji schemas from an installed tarball and checks the published types. The packer copies every declared JSON export, including schemas without a runtime TypeScript import.

The `emoji-pack`, `emoji-svg` and `emoji-text` fuzz targets reach JSON, semantic and SVG validation with recomputed digests. For a focused run that preserves existing regression files:

```sh
FUZZ_KEEP=1 node tests/fuzz/run.ts 300 emoji-pack
FUZZ_KEEP=1 node tests/fuzz/run.ts 300 emoji-svg
FUZZ_KEEP=1 node tests/fuzz/run.ts 300 emoji-text
```

Only types reach the engine barrel. The pinned Unicode tables are half a megabyte, so the modules themselves stay behind the runtime's dynamic imports and a render with no emoji in it never loads them: the trigger regex decides, and `tests/emoji-runtime.test.ts` pins that plain text loads nothing. Byte limits are defensive implementation bounds; a complete family and low-memory-device benchmark still need to establish production budgets.

## What is not built

Named here so nobody has to find out by shipping on it.

- **Generic paragraph layout.** The ordinary rendered pass places each glyph as an inline element and lets the host lay out the line. The strict compiler (`compileEmojiLine`) remains one LTR line from one font's default instance, without wrapping, bidi or caret mapping. Authored Design text instead uses the shared `host.text.layoutRuns` paragraph contract, with inline emoji participating in bidi, wrapping, selection and vector conversion. See [authored text composition](text-composition.md) for that separate path and its limits.
- **Custom native editors.** Generic text fields, table display cells and Design rich text have artwork display layers. An arbitrary tool-owned native editor still needs to mount that display helper. IME candidates remain under the operating system's control.
- **A device budget.** The first picker pass and a 15.7 MB on-demand download have been measured on one 2026 laptop and in one Chromium. Nothing has been measured on a modest device or a slow connection.
- **Palette role annotations.** A treatment palette is a list of id and hex pairs. Nothing says which entry is a brand's primary, which is a surface and which must never become skin or foliage. So `mono` guesses, by matching a token id against the words primary, accent or brand and falling back to the first colour with real chroma in it, `duotone` takes the darkest and the lightest by lightness, and the protected set is the Unicode one (skin tones, flags and custom symbols) rather than anything the brand said. Curated role metadata, adjacency checks and small-size legibility proofs are plan 252's phase 4 work.
- **Optical normalization.** `inline-em-v1` sizes a glyph from its own box and advance. The measured ink differences between families (an OpenMoji glyph reads about 1.4 times smaller than a Twemoji one at the same em) are not corrected, because no optical scale has been approved.

Compact manifests, optical review, paragraph compilation, fabrication, spatial representations and font adapters remain separate follow-up work. Unsupported recipes are rejected rather than approximated.
