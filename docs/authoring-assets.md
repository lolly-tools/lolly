# Authoring Assets

Assets are global, versioned, brand-controlled resources tools draw from. Logos and mascots, palettes, design tokens, event tiles, fonts, music beds and video b-roll. The authoritative list of asset types is the `type` enum in `schemas/asset.schema.json`: `vector | raster | video | audio | lottie | palette | tokens | font`.

Those types are what the filter row in Assets is built from, and it only offers the buckets the library actually holds, so a library of audio and tokens shows fewer pills than a library of logos and photos.

![The Assets toolbar - type filter pills on the left and a live asset count beside them, the file-type enum surfaced as a control](/t/url-shot?url=%2F%23%2Fa&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&cropSelector=.cat-toolbar&dark=1&filename=at2-assets-typefilters)

## Shared libraries in Assets

When connected to Work, the Shared library section browses indexed records one page at a
time. Type, tag and source controls filter on the server before counts and pages are
returned. Shared rows are ordered by name. Your device assets and design-system panels
remain available separately, including when a source cannot be reached.

Selections survive page and filter changes. The selection bar can therefore include files
on another page; clear the selection before starting another batch. Open an asset to choose
its actual file. A rendition is labelled separately, and a preview does not establish
original availability. A known source version change is reported rather than silently
replacing a selected reference. Historical byte retention remains a separate capability.

The inspector's Organisation metadata section shows the Work fields and offers editing
where your current grant permits. Those values are organisation overlays, separate from
upstream source facts. Shared source status explains pending sync, cached listings and
incomplete counts. Live source search is a bounded candidate search; exact filters use
indexed browse. Update Work before shipping this shared-browser shell: Work must advertise
support for the requested filters and provide the bounded startup inventory. An older
server is refused with an update message rather than silently ignoring a filter.
Shared browse does not interpret the local library's search operators;
use its Type, Tag and source controls. These paths work without AI processing.

## Anatomy

```
catalog/assets/
├── index.json                                   # the manifest of all assets
└── <namespace>/<group>/<name>.<ext>             # the files themselves
```

Example:

```
catalog/assets/suse/logo/primary.svg
catalog/assets/suse/logo/primary.png
catalog/assets/suse/palette/brand-core.json
catalog/assets/event/kubecon-2026/badge.svg
```

## The asset entry (in `index.json`)

Validated against `schemas/asset.schema.json`.

```json
{
  "id": "suse/logo/primary",
  "name": "SUSE Primary Logo",
  "type": "vector",
  "version": "1.0.0",
  "tier": "core",
  "tags": ["logo", "official", "centermark"],
  "formats": [
    {
      "format": "svg",
      "url": "/catalog/assets/suse/logo/primary.svg",
      "checksum": "sha256-...",
      "size": 2048
    }
  ],
  "license": "internal"
}
```

Each entry becomes one tile in Assets, grouped by what its tags say it is. A pack of audio beds and token documents appears under **More**; logos, backgrounds and icons get their own sections once the tags are there.

![The More group in Assets - one tile per index entry, each carrying the name and file type from its index.json record](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dother&width=1440&height=1400&dpi=96&waitMs=2400&format=svg&walker=1&cropSelector=.cat-group%5Bdata-group%3D%22other%22%5D&dark=1&filename=at2-assets-more-group)

## Rules that don't bend

- **`id` is forever.** Once published, never rename, never reuse. If you need a different logo, give it a different ID.
- **Bump `version` on every byte change.** Tools cache by id+version. Forgetting to bump means stale bytes everywhere.
- **Always include a `checksum`.** SRI-format SHA-256. End-to-end integrity check, prevents CDN poisoning.
- **Deprecate, don't delete.** Set `"deprecated": true` and optionally `"replacedBy": "new/asset/id"`. Existing references continue to resolve - a deprecated asset's own bytes keep loading forever, and `replacedBy` is curation metadata for people and catalog UI, **never a runtime redirect**: `get(id)` always returns the original asset, so a link or saved session that points at it renders exactly what it always did. (The chain is validated at build time - it must point at a real, non-deprecated asset - but nothing follows it on resolve.)

## Tiers

| Tier         | What it means                                                  | When to use |
|--------------|----------------------------------------------------------------|-------------|
| `core`       | Bundled with the app. Always available offline.                | Logos, primary palette, design tokens, core mascot poses |
| `catalog`    | Synced at boot, cached. Available offline once cached.         | Most things - event packs, icon sets |
| `on-demand`  | Fetched when first used, then cached. Needs net first time.    | Heavy items - hi-res photo, video b-roll |

The `core` tier is meant to stay small (target a few dozen brand essentials) - most assets ride in the `catalog` and `on-demand` tiers. Catalog-tier entries can set `"prefetch": true` (catalog tier only) to fetch their bytes at sync time rather than lazily on first use.

## Locales

Locale-specific format variants go under `locales`:

```json
{
  "id": "suse/wordmark/horizontal",
  "version": "1.0.0",
  "tier": "core",
  "formats": [
    { "format": "svg", "url": "/catalog/assets/suse/wordmark/horizontal.svg", "checksum": "sha256-..." }
  ],
  "locales": {
    "ja": [
      { "format": "svg", "url": "/catalog/assets/suse/wordmark/horizontal-ja.svg", "checksum": "sha256-..." }
    ]
  }
}
```

Tools and host UI resolve via BCP-47 locale matching. Falls back to the base entry if no locale variant exists.

## Palettes

Palettes are a special asset type whose payload is JSON, not an image:

```json
{
  "name": "SUSE Brand Core",
  "swatches": [
    { "name": "Jungle", "hex": "#0C322C", "rgb": "...", "hsl": "..." },
    ...
  ]
}
```

A palette asset is what the Swatches section in Assets renders: every ramp step as a chip, click to copy its hex.

![The Swatches section in Assets - the brand ramps laid out as labelled chips with download buttons above](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=2000&walker=1&format=svg&cropSelector=.cat-group%5Bdata-group%3D%22swatches%22%5D&dark=1&filename=auth-assets-swatches)

Tools reference palette swatches through `host.assets.get(id)` → `ref.meta.swatches`. Note this is wired up in the **CLI shell** today (its bridge parses the palette JSON and spreads `swatches` into `meta`); the web shell's assets bridge does not yet populate `meta.swatches`, so don't rely on it cross-shell.

The `color` input type also accepts a `palette` field (schema-valid, mapped to a `palette-picker` control in `engine/src/inputs.ts`), but the web shell currently renders that control as a **stub**. For a working brand-restricted picker today, use a `color` input with `"swatchesOnly": true` - it renders the real brand swatch picker (no hex/native/alpha).

## Themable two-colour icons

An icon tagged `themable` is an SVG that expresses its two colours only as classes, with one overridable default block and nothing else - no other `fill`/`stroke`/`style` anywhere:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
  <defs><style>.c1{fill:#30ba78}.c2{fill:#0c322c}</style></defs>
  <path class="c2" d="…"/>   <!-- base (majority) shapes -->
  <path class="c1" d="…"/>   <!-- accent shapes -->
</svg>
```

- `.c1` is the **accent**, `.c2` the **base**. The defaults (jungle on pine) are plain class rules, so inlining the SVG lets a page or tool override them - `.c1 { fill: … !important }` wins by design.
- The colour pairings the picker offers come from a palette-type asset tagged `icon-themes` (`suse/palette/icon-themes`); its first pairing must match the defaults baked into the icons.
- A non-default pairing chosen in the picker travels **inside the asset id** - `suse/icons/ai?theme=ocean` - because an asset value persists as its id alone (URL mode). Both shell bridges parse that suffix (`parseThemedAssetId`) and bake the pairing at resolve time (`applyIconTheme`: style block removed, fills inlined as attributes) so two differently-themed copies never fight over class rules inside one exported SVG/PDF.
- The validator enforces the contract for every `themable`-tagged SVG (exactly one default style block; classes limited to `c1`/`c2`; no inline styles or strokes).

## Design tokens

`type: "tokens"` is a DTCG (Design Tokens Community Group) JSON document - the canonical brand-color source. The core asset `suse/tokens/brand` feeds the color picker's swatches and the defaults for brand-bound inputs. Beyond the normal asset checks, the validator runs a dedicated DTCG-structure validation against `schemas/tokens.schema.json` (`scripts/validate-catalog.ts`). See [Design tokens](/info/design-tokens.html) for the token model and how palettes relate.

## Fonts

`font` is a valid asset type, but the shared SUSE typefaces don't live in the asset index - they ship as static files under `catalog/fonts/`, a sibling of `catalog/assets/`:

```
catalog/fonts/
├── variable/    # variable TTFs (SUSE[wght].ttf, SUSEMono[wght].ttf, + italic axes)
├── webfonts/    # woff2 - the variable fonts plus per-weight statics
├── ttf/         # static TTFs
└── otf/         # static OTFs
```

The web shell loads them via `@font-face` (`shells/web/src/styles/fonts.css`, with the variable woff2 preloaded from `index.html`); tool templates reference the same `/catalog/fonts/...` URLs directly. The text-to-path step (`host.text`, used when a vector export outlines its text) reads the static TTFs from `catalog/fonts/ttf/`. Because they're plain static files, they aren't versioned or checksummed through `index.json` the way catalog entries are.

## Workflow

1. Drop the file under `catalog/assets/<namespace>/...`.
2. Add an entry to `catalog/assets/index.json` (the `checksum`/`size` can be left
   as `sha256-PLACEHOLDER`/`0` - the next step fills them in).
3. Run `pnpm run build:catalog` - `scripts/checksum-assets.ts` computes the real
   SHA-256 (SRI) and byte size for every asset format and writes them into the
   index. `pnpm run validate:catalog` then verifies every checksum against the
   bytes on disk.
4. PR review. Approval = brand approval.
5. Merge → build catalog → deploy. Clients pick it up at next sync.

This git-reviewed flow is for a **shared, governed catalog** - the model where a whole organisation syncs one asset library and wants every change to carry PR review as brand approval. It's an *option for that case*, not how the app works day to day.

Most people never touch it: in the open app you **ingest your own creative files straight into Assets** - drag them onto [Assets](/info/using.html#assets-your-library) or the Brand Studio's Files room, and they're instantly available in every tool's asset picker, on your device. **Add from URL** takes the same files by web address instead: paste an image link (or a Lolly tool link, which renders on your device) in the uploads section of Assets or a tool's asset picker, and it is added to your uploads the same way. Because the web app is only allowed to fetch from its own origin, a remote image is fetched for you by a small pass-through on the app's own origin; the desktop apps fetch it directly. Nothing is stored but the image, and the [privacy policy](/info/privacy.html) covers it in its own words.

![The Brand Studio's Files room - a drop area and the assets already ingested, the no-git route into the same picker every tool reads](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dcatalogue&width=1440&height=900&dpi=192&waitMs=2000&css=.start-head%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.be-cat&dark=1&filename=at2-brand-catalogue-tab)

Those user assets live under the `user/` namespace and do not automatically enter a shared catalog. A repository-managed shared library uses the git route above. For an organisation-managed library, optional **lolly.work** also supports uploads, metadata, collections, versions and approval workflows, and can federate assets from existing storage or DAM services. Follow its [catalog guide](https://github.com/lolly-tools/lolly-work/blob/main/docs/catalog.md); provider-backed assets remain governed by their source. See [Use Lolly at your organisation](/info/organisation.html) for the user-facing distinction.

![The Your uploads section in Assets - a drop area that takes files straight from your device into every tool's picker](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dyour-uploads&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&cropSelector=.cat-group--uploads&dark=1&filename=auth-assets-uploads)

Composed renders - a tool that embeds another tool's output via `composes` (see [Authoring tools](/info/authoring-tools.html)) - surface as ephemeral `AssetRef`s through the same `{{asset id}}` helper, but they are runtime intermediates, not catalog assets.

## Delivery addresses and display renditions

Keep the authored asset ID and source URL stable. A release creates actual copies
such as `primary.0123456789abcdef.png` and points its extracted index at those
copies. The suffix is a short address, not the integrity check: the full SHA-256
in `checksum` must match the decoded bytes. This pass changes the release output,
not the authored catalog. Old hashed files and legacy URLs remain available for
older clients. See [Delivery deployment](/info/deploy-delivery.html) for retention.

The signed catalog envelope covers the tool index, asset index and slim index.
Clients verify the signature first, then fetch the exact hashed indexes. A
publisher's sequence and the last accepted catalog are stored together; a failed
download or changed asset index cannot advance that sequence. A version number
in an asset entry is still required for authoring and review.

**A rendition is a display-sized copy with its own checksum and credentials.**
The raster ladder uses WebP at widths 320, 640 and 1280, preserves aspect ratio
and does not upscale a smaller source. Its format entry identifies the original
by its full source SHA-256, rather than by an asset ID:

```json
{
  "format": "webp",
  "url": "/catalog/renditions/example-640.webp",
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
signer version, then retain the bytes in version control or a persistent private
rendition cache. Signing includes time and random values, so signing again on
every build would create different files. The generator records resizing or
transcoding, copies the source's credits and rights, and records an existing
Content Credential as a `parentOf` ingredient. When the source has no manifest,
the ingredient records its hash without claiming who created that source.

Signing needs the asset owner's approval and the instance's configured authority.
The public starter products are already generated; normal releases apply those
products without issuing another signature:

```bash
node scripts/build-catalog-renditions.ts --root /path/to/extracted-release
```

That step checks the signature, source identity and hash, and credit metadata
before adding the formats. Run it before final catalog signing. For an operator
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
credential. Keep signing keys out of release artifacts, logs and ordinary CI.

Serving a signed image, including a preview, OG card or documentation shot,
must preserve its decoded bytes. Compression of a response is allowed when
decompression returns those same bytes. Edge image optimisers, metadata stripping,
resizing and transcoding must be off for these files. Verify a rendition's own
credential and its parent in [Verify](/info/verify-yourself.html), then check that
an export using the asset still embeds the original.

### Inspect and curate shared assets

Connected libraries appear in Assets beside the files on your device. The source facts panel shows the indexed version, sync status, mapped approval and availability windows. Unknown values stay unknown. Source approval does not establish permission for every channel or use; access to files is checked when opened. Original and rendition labels describe the file offered by the connection.

Organisation metadata belongs to Lolly Work. A curator with `catalog.edit` can change configured text, select, date and URL fields. Ordinary members see the values without edit controls. These fields do not change names, descriptions or tags in the upstream library. Work owns the field definitions and audits changes.

The shared library uses the main Assets search bar. Indexed browse searches names, descriptions, tags, organisation fields and saved extracted text with exact filters and bounded pages. Live search asks permitted sources for a limited candidate set; the UI identifies unavailable sources and refuses incompatible filters rather than dropping them.

For an image, SVG or PDF, choose **Read text**, then review the extracted words. Extraction runs on your device. **Add reviewed text to shared search** explicitly sends the reviewed excerpt to Work; nothing is uploaded by the extraction action itself. Only curators can publish or remove indexed text. The index accepts up to 8192 characters and records the selected file, indexed revision, extraction method, reviewer and time. It does not establish that every page or every word was read.

If that indexed source revision changes, its previously reviewed words stop matching shared search. Open the current asset and read again. Asset details show this stale state and offer **Remove indexed text**. Older text records without a source revision remain searchable for compatibility and are labelled unverified. A revision records the current catalog snapshot; upstream revocation and source changes become known through the existing sync and file-resolution paths.
