# Authoring assets

An asset is a file plus one entry in an index: a logo, a mascot pose, a palette, a design-token document, an event tile, a font, a music bed or a video clip. Every tool's picker offers the assets in a library.

Assets are global, versioned and controlled by the design system's owner. The `type` enum in `schemas/asset.schema.json` lists every kind: `vector`, `raster`, `video`, `audio`, `lottie`, `model`, `lut`, `palette`, `tokens`, `font`, `profile`, `ratecard`, `text` and `data`. The filter row in Assets offers only the types the library holds.

![The Assets toolbar - type filter pills on the left and a live asset count beside them, the file-type enum surfaced as a control](/t/url-shot?url=%2F%23%2Fa&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&cropSelector=.cat-toolbar&dark=1&filename=at2-assets-typefilters)

<!--i:eti-upload-->
## Two ways to add assets

::: cols
## From the app, with no Git

Drag files onto [Assets](/info/using.html#assets-your-library) or the **Files** room in Lolly Design System Setup. They appear in every tool's picker at once, on your device. Most people need only this route.

## Into a shared catalog

Add the file and an index entry to a brand pack's catalog, rebuild and deploy. Everyone who syncs that catalog gets the asset. Use this route when an organisation keeps one library for many people.
:::

**Add from URL** takes a web address: paste an image link, or a Lolly tool link that renders on your device, in the uploads section of Assets or in a tool's asset picker. The file joins your uploads. The web app may fetch only from its own origin, so a small pass-through on that origin fetches a remote image. The desktop apps fetch the image directly. Nothing is stored but the image. The [privacy policy](/info/privacy.html) covers this.

![The Files room in Lolly Design System Setup - a drop area and the assets already ingested, the no-Git route into the same picker every tool reads](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dcatalogue&width=1440&height=900&dpi=192&waitMs=2000&css=.start-head%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.be-cat&dark=1&filename=at2-brand-catalogue-tab)

Files added in the app live under the `user/` namespace and do not enter a shared catalog by themselves. For an organisation-managed library, optional **Lolly Work** adds uploads, metadata, collections, versions and approval workflows. Lolly Work can also federate assets from existing storage or DAM services; see its [catalog guide](/info/work-catalog.html). Provider-backed assets stay governed by their source. [Use Lolly at your organisation](/info/organisation.html) explains the difference from the person's side.

![The Your uploads section in Assets - a drop area that takes files straight from your device into every tool's picker](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dyour-uploads&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&cropSelector=.cat-group--uploads&dark=1&filename=auth-assets-uploads)

<!--i:eti-folder-plus-->
## Add an asset to a catalog

A catalog keeps its files under `catalog/assets/<namespace>/<group>/<name>.<ext>`, beside one `index.json` that lists every asset:

```
catalog/assets/
├── index.json                                   # the manifest of all assets
└── lolly/
    ├── logo/primary.svg
    ├── logo/reverse.svg
    ├── palette/riso-inks.json
    └── tokens/demo.json
```

::: timeline
- <!--i:folder--> **Drop the file** under `catalog/assets/<namespace>/...`.
- <!--i:document--> **Add its entry** to `catalog/assets/index.json`. Leave `checksum` as `sha256-PLACEHOLDER` and `size` as `0`; the next step fills them in.
- <!--i:hash--> **Run `pnpm run build:catalog`.** `scripts/checksum-assets.ts` computes the SHA-256 (in SRI form) and byte size of every format and writes them into the index. `pnpm run validate:catalog` then checks every checksum against the bytes on disk.
- <!--i:usercheck--> **Review, if your organisation reviews brand assets.** A pull request can carry that review.
- <!--i:upload--> **Merge, build the catalog and deploy.** Clients pick the asset up at their next sync.
:::

This reviewed Git flow is one option for a shared, governed catalog. It is one option for that case, not how the app works day to day.

<!--i:eti-code-->
## The asset entry (in `index.json`)

Each entry is validated against `schemas/asset.schema.json`:

```json
{
  "id": "lolly/logo/primary",
  "name": "Lolly Mark - Primary",
  "type": "vector",
  "version": "1.2.0",
  "tier": "core",
  "tags": ["logo", "lolly", "mark", "primary"],
  "formats": [
    {
      "format": "svg",
      "url": "/catalog/assets/lolly/logo/primary.svg",
      "checksum": "sha256-...",
      "size": 19263
    }
  ],
  "license": "internal"
}
```

`id`, `type`, `version`, `tier` and `formats` are required. The other fields:

| Field | What it holds |
| --- | --- |
| `name`, `description` | What people see in Assets and the picker. |
| `tags` | What the asset is. Assets groups its tiles by tag: logos, backgrounds and icons get their own sections, and audio beds and token documents appear under **More**. |
| `added` | The date the file entered its pack. `build:catalog` stamps the date from Git history. Never write it by hand. |
| `meta` | Facts a shell needs before it downloads the bytes, such as an emoji pack's glyph count. |
| `locales` | Locale-specific format variants (below). |
| `prefetch` | Catalog tier only: fetch the bytes at sync time instead of on first use. |
| `deprecated`, `replacedBy` | Retire an asset without breaking links (below). |
| `license`, `attribution`, `rights`, `aiGenerated` | Where the asset comes from (below). |
| `brandLock` | Tokens assets only. `true` makes that design system authoritative: the app uses its colours and fonts, ignores any brand the person installed and turns off brand customisation. |

![The More group in Assets - one tile per index entry, each carrying the name and file type from its index.json record](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dother&width=1440&height=1400&dpi=96&waitMs=2400&format=svg&walker=1&cropSelector=.cat-group%5Bdata-group%3D%22other%22%5D&dark=1&filename=at2-assets-more-group)

A tool that embeds another tool's output through `composes` ([Composition and brand overlays](/info/tool-composition.html)) receives the render as an `AssetRef` through the same `{{asset id}}` helper. That render is a runtime intermediate, not a catalog asset.

<!--i:eti-lock-->
## Rules that don't bend

- **`id` is forever.** Once published, never rename or reuse an id. A different logo gets a different id.
- **Bump `version` on every byte change.** Tools cache by id and version, so a missed bump means stale bytes everywhere.
- **Always include a `checksum`.** A SHA-256 in SRI form checks integrity and stops a poisoned CDN copy.
- **Each id has its own file.** Two ids may hold identical bytes, but never share one file. Lolly Work decides whether to serve a file from the one asset that owns the file, so a withdrawal can name what it withdraws. Lolly Work refuses a catalog with two owners for one path, and `validate:catalog` fails on such a catalog. A `name.<16 hex>.ext` address also counts as claiming `name.ext`.
- **Deprecate, don't delete.** Set `"deprecated": true` and optionally `"replacedBy": "new/asset/id"`. Existing references keep resolving: a deprecated asset's bytes keep loading. `replacedBy` points people and catalog screens to the successor and is **never a runtime redirect**: `get(id)` always returns the original asset, so a link or saved session renders as before. The build checks that the chain points at a real asset that is not itself deprecated.

<!--i:eti-user-check-->
## Rights and credits

Record where each asset comes from.

::: note A missing record is not permission
It means "not recorded".
:::

- `license` - the declared licence, such as `cc-by-4.0` or `all-rights-reserved`.
- `attribution` - the readable credit a licence requires, shown in the asset details.
- `rights` - a structured creative-rights record (`CreativeWorkRecordV1` in `@lolly-tools/core`), kept beside the `license` and `attribution` strings.
- `aiGenerated` - `full` or `partial` for an asset made wholly or partly with a generative model; Assets then shows a GEN AI label. Leave it out for work made by people.

A `.lolly` pack carries a catalog file that records nothing about its rights (no licence, no rights record, no attribution), but warns the sender and asks whoever opens the pack to check the terms. A file whose recorded licence is not yet interpreted is held back unless the sender chooses to include the file. Record `license` and `rights` on anything meant to travel. See [Creative rights and credits](/info/creative-rights.html).

<!--i:eti-stamp-->
## Approval and intent in Details

A file's **Details** list in Assets shows what its Content Credential records. **Approval** gives the date of the decision, **Made for** gives the purpose and surface, and **Prompt** gives one line of a recorded prompt. Each row opens the matching panel under **Origins & credentials**; [Lolly Verify](/info/what-verify-checks.html#approval-and-intent-records) draws the same panels. **Checks** adds an **Approval** lamp when a record exists.

An approved file you kept from a request has one **Approval** row, which links back to the request. If the file no longer matches its credential, a warning appears under the file's name, outside every section. The row then reads **Does not match the approved file** instead of the date. **Open request** stays. The `approved` tag stays too, because tags are yours to change.

A PDF added through the upload area becomes editable vector assets, so its credential does not travel with them. To read a PDF's record, keep the approved file from its request or open the original in Lolly Verify.

To filter for approved files, use the `approved` tag on a kept file. There is no filter on the credential record, because reading the record would mean opening every file.

<!--i:eti-layers-->
## Tiers

The tier decides when a device downloads an asset.

::: cols
## `core`

Bundled with the app and always available offline. For brand essentials: logos, the primary palette, design tokens, core mascot poses. Keep it small, a few dozen items.

## `catalog`

Synced when the app starts, then cached and available offline. Most assets belong here: event packs, icon sets. Add `"prefetch": true` to fetch the bytes at sync time instead of on first use.

## `on-demand`

Fetched on first use, then cached. Needs a network connection once. For heavy items such as high-resolution photos and video b-roll.
:::

<!--i:eti-shapes-->
## Kinds of asset

### Palettes

A palette is an asset whose payload is JSON, not an image:

```json
{
  "name": "Riso Ink Colours",
  "swatches": [
    { "id": "black", "label": "Black", "hex": "#000000" },
    ...
  ]
}
```

The Swatches section in Assets shows a palette as chips, one per step of each ramp. Select chips to download a few colours as their own palette file. Click a chip to open that colour's details in the same sheet any asset opens: its linked print values and design token, every notation with a copy button, a gamut chart, its tones and its readability.

![The Swatches section in Assets - the brand ramps laid out as labelled chips with download buttons above](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=2000&walker=1&format=svg&cropSelector=.cat-group%5Bdata-group%3D%22swatches%22%5D&dark=1&filename=auth-assets-swatches)

Tools read palette swatches through `host.assets.get(id)` as `ref.meta.swatches`.

::: warning `ref.meta.swatches` is filled on the CLI only
Only the **CLI shell** fills that in, by parsing the palette JSON into `meta`. The web shell's assets bridge does not yet. Do not rely on the swatches across shells.
:::

A `color` input's `palette` and `swatchesOnly` fields are on [Tool inputs](/info/tool-inputs.html#colourway-leads-as-swatches).

### Themable two-colour icons

An icon tagged `themable` is an SVG that sets its two colours only through classes, in one default style block. It has no other `fill`, `stroke` or `style`.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
  <defs><style>.c1{fill:#30ba78}.c2{fill:#0c322c}</style></defs>
  <path class="c2" d="…"/>   <!-- base (majority) shapes -->
  <path class="c1" d="…"/>   <!-- accent shapes -->
</svg>
```

- `.c1` is the **accent** and `.c2` the **base**. The defaults are plain class rules, so a page or tool that inlines the SVG can override them: `.c1 { fill: … !important }` wins.
- The colour pairings Assets and the picker offer come from the design system's [colourways](/info/colourways.html#tools-that-use-every-lead): **Original** keeps the icon's own colours, then one pairing per colourway, with the colourway's name. A design system with no colourways offers none. Give the icons the canonical colourway's colours as defaults, so **Original** and the canonical colourway agree. An icon written as `example/icons/chat?theme=auto` takes the piece's colourway, in its pairing for the ground under the icon. An `icon-themes` palette in an older catalog is not offered, but the ids it declares still resolve.
- A pairing chosen in the picker travels **inside the asset id**, as `example/icons/chat?theme=green`, because an asset value is kept as its id alone. Both shell bridges read that suffix (`parseThemedAssetId`) and apply the pairing when the asset resolves. `applyIconTheme` removes the style block and writes the fills as attributes, so two copies in different themes never clash over class rules in one exported SVG or PDF.
- The validator checks the contract for every `themable` SVG: exactly one default style block, only the classes `c1` and `c2` and no inline styles or strokes.

### Design tokens

`type: "tokens"` is a DTCG (Design Tokens Community Group) JSON document, the canonical source of brand colour. The tokens asset given in the index's top-level `brandTokens` key (`lolly/tokens/demo` in the Lolly Demo pack) supplies the colour picker's swatches and the defaults for inputs bound to the brand. The validator also checks the DTCG structure against `schemas/tokens.schema.json`. [Design tokens](/info/design-tokens.html) covers the token model and how palettes relate.

### Fonts

`font` is a valid asset type, but most fonts do not go through the asset index:

- **Platform faces.** The shell serves SUSE and SUSE Mono (variable, upright and italic, SIL OFL 1.1) and Outfit from `/fonts/` on every brand pack (`shells/web/src/styles/fonts.css`). They are the defaults when a design system sets no font.
- **A design system's fonts.** The tokens document gives the families in `font.brand` and `font.mono`. The app and the community tools follow them through `var(--font-brand)` and `var(--font-mono)`. A brand pack can also ship font files under `catalog/fonts/`, beside `catalog/assets/`. These are plain static files: `index.json` does not version or checksum them.
- **A person's own fonts.** Font files dropped into the **Type** room in Lolly Design System Setup, and Google Fonts fetched once, stay on the device as user font assets.

When a vector export outlines its text (`host.text`), the shell looks for a font file in this order: the brand pack's own files, then the person's fonts, then the platform faces.

### Saved tunes

A saved tune is an `audio` asset of format `lofi`: a few bytes naming a Neurospicy station's mood and a seed. Lolly composes the tune again each time the tune plays. Lolly's own catalogs keep tunes under `lolly/tunes/`. No script adds a tune: write its `index.json` entry by hand, beside its `.lofi.json` file.

The six tunes already released in Lolly Demo and Lolly Start (`lolly/tunes/warm-250249288` and the five `lolly/tunes/sings-*` tunes) stay CC0 (`"license": "CC0-1.0"`), because a CC0 release cannot be withdrawn. New tunes are CC BY 4.0, with the credit Lolly's music asks for:

```json
{
  "license": "CC-BY-4.0",
  "attribution": "Music made with Lolly (https://lolly.tools), CC BY 4.0"
}
```

`tests/catalog-tunes-licence.test.ts` holds both catalogs to this rule: any tune outside the six that records another licence or credit fails the test. [Generated music](/info/generated-music.html#what-a-track-records) says what the licence covers.

### Locales

Locale-specific format variants go under `locales`:

```json
{
  "id": "lolly/logo/horizontal",
  "version": "1.0.0",
  "tier": "core",
  "formats": [
    { "format": "svg", "url": "/catalog/assets/lolly/logo/horizontal.svg", "checksum": "sha256-..." }
  ],
  "locales": {
    "ja": [
      { "format": "svg", "url": "/catalog/assets/lolly/logo/horizontal-ja.svg", "checksum": "sha256-..." }
    ]
  }
}
```

Tools and the app pick a variant by BCP 47 locale matching, and fall back to the base entry when no variant matches.

<!--i:eti-images-->
## Delivery addresses and display renditions

This section is for whoever builds and serves a catalog release. Keep the authored asset ID and source URL stable. A release creates copies
such as `primary.0123456789abcdef.png` and points its extracted index at those
copies. The suffix is a short address, not the integrity check: the full SHA-256
in `checksum` must match the decoded bytes. This pass changes only the release
output. Old hashed files and legacy URLs remain available for older clients.
[Delivery deployment](/info/deploy-delivery.html) covers retention.

The signed catalog envelope covers the tool index, asset index and slim index.
Clients verify the signature first, then fetch the exact hashed indexes. A
publisher's sequence and the last accepted catalog are stored together; a failed
download or changed asset index cannot advance that sequence. A version number
in an asset entry is still required for authoring and review.

**A rendition is a display-sized copy with its own checksum and credentials.**

![An original file with its checksum and credit produces WebP renditions at 320, 640 and 1280 pixels wide, used only for previews in the gallery and picker. Placing, downloading and exporting always use the original.](/info/diagrams/concepts/asset-renditions.svg)

The raster ladder uses WebP at widths 320, 640 and 1280, preserves aspect ratio
and does not upscale a smaller source. Its format entry identifies the original
by its full source SHA-256, not by an asset ID:

```json
{
  "format": "webp",
  "url": "/catalog/renditions/acme/photo/example/out.0123456789abcdef.webp",
  "checksum": "sha256-...",
  "size": 12345,
  "rendition": {
    "of": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "spec": { "w": 640, "fit": "inside", "format": "webp", "q": 80 }
  }
}
```

The gallery and picker can use these formats for previews. Choosing or placing
an asset, downloading the original or exporting a document uses the original
format. A rendition must never silently replace the source used by a template.

Generate a signed rendition once for each source hash, sizing specification and
signer version, then keep the bytes in version control or a persistent private
rendition cache. Signing includes time and random values, so signing on every
build would create different files. The generator records resizing or
transcoding, copies the source's credits and rights and records an existing
Content Credential as a `parentOf` ingredient. When the source has no manifest,
the ingredient records its hash without claiming who created that source.

Signing needs the asset owner's approval and the instance's configured authority.
The public starter products are already generated; normal releases apply those
products without issuing another signature:

```bash
node scripts/build-catalog-renditions.ts --root /path/to/extracted-release
```

That step checks the signature, the credit metadata and the source's identity
and hash before adding the formats. Run it before final catalog signing. For an operator
using the repository's private-CA wrapper, generation is explicit:

```bash
LOLLY_PRIVATE_DIR=/path/to/private-ca node scripts/run-private-ca.ts sign-renditions \
  --root /path/to/extracted-release \
  --output /path/to/extracted-release/catalog/renditions \
  --cache /path/to/private-rendition-cache \
  --source-base https://your-instance.example \
  --approve-signing
```

The private directory and cache must be readable only by their owner. Configure
your own pinned signing authority; the public Lolly authority is not an instance
credential. Keep signing keys out of release artefacts, logs and ordinary CI.

::: warning Serve signed images byte for byte
Serving a signed image, including a preview, OG card or documentation shot,
must preserve its decoded bytes. Compression of a response is allowed when
decompression returns those same bytes. Edge image optimisers, metadata stripping,
resizing and transcoding must be off for these files.
:::

Verify a rendition's own
credential and its parent in [Lolly Verify](/info/verify-yourself.html), then check that
an export using the asset still embeds the original.

<!--i:eti-folder-shared-->
## Shared libraries from Lolly Work

When Lolly is connected to a Lolly Work instance, Assets shows the organisation's shared library beside the files on your device. Your device assets and design-system panels stay available, even when a source cannot be reached. These features need no AI processing.

::: details Browse, search and select in a shared library
The **Shared library** section shows indexed records one page at a time, ordered by name. Type, tag and source controls filter on the server before counts and pages come back. The shared library uses the main Assets search bar. Indexed browse searches names, descriptions, tags, organisation fields and saved extracted text, with exact filters and bounded pages. Live search asks permitted sources for a limited set of candidates. Shared browse does not read the local library's search operators; use its Type, Tag and source controls. The app names sources that cannot be reached. It refuses filters a source cannot apply instead of dropping them.

Selections survive page and filter changes, so the selection bar can include files on another page. Clear the selection before starting another batch. Open an asset to choose its actual file. A rendition is labelled separately. A preview does not show that the original is available. A known change of source version is reported instead of silently replacing a selected reference. Keeping historical bytes is a separate capability.

Shared source status explains pending syncs, cached listings and incomplete counts. The source facts panel shows the indexed version, sync status, mapped approval and availability windows. Unknown values stay unknown. Source approval does not grant permission for every channel or use. Access to files is checked when they are opened.

Lolly Work must advertise support for the requested filters and provide the bounded startup inventory. Update Lolly Work before shipping this version of the app. An older server is refused with an update message instead of silently ignoring a filter.
:::

::: details Organisation metadata
Organisation metadata belongs to Lolly Work. The asset inspector's **Organisation metadata** section shows these fields as organisation overlays, separate from the upstream source's facts. A curator with `catalog.edit` can change the configured text, select, date and URL fields. Other members see the values without edit controls. These fields never change names, descriptions or tags in the upstream library. Lolly Work owns the field definitions and audits every change.
:::

::: details Read text into shared search
For an image, SVG or PDF, choose **Read text**, then review the extracted words. Extraction runs on your device and uploads nothing. **Add reviewed text to shared search** sends the reviewed excerpt to Lolly Work. Only curators can publish or remove indexed text. The index accepts up to 8192 characters and records the selected file, the indexed revision, the extraction method, the reviewer and the time. The record does not show that every page or every word was read.

When that source revision changes, its reviewed words stop matching shared search. Open the current asset and read its text again. Asset details show the stale state and offer **Remove indexed text**. Older text records without a source revision stay searchable and are labelled unverified. A revision records the current catalog snapshot. Upstream revocation and source changes become known through sync and file resolution.
:::

Open any asset to see its details. The sidebar header has **Download** and **Inspect & verify**. Below are expanding sections for metadata, sharing and origins, then the provenance and content-signal lamps under **Checks**.

**Details** lists everything known about the file, each label led by a small icon: what the asset is, its dimensions and size, its dates, its source and licence, then its tags and the camera, codec and encoding detail, with the asset ID last. Facts read from the file, such as camera settings or an audio codec, join the list a moment after the details open.

Drag the divider to resize the sidebar, or pull the divider inward to collapse the sidebar. The divider also takes the arrow keys, Home to collapse and Enter or a double click to reset. Width and section choices are remembered. Phone layouts stay expanded.
