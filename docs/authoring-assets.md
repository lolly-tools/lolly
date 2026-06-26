# Authoring Assets

Assets are global, versioned, brand-controlled resources tools draw from. Logos and mascots, palettes, design tokens, event tiles, fonts, and video b-roll. The authoritative list of asset types is the `type` enum in `schemas/asset.schema.json`: `vector | raster | video | palette | tokens | font`.

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

## Rules that don't bend

- **`id` is forever.** Once published, never rename, never reuse. If you need a different logo, give it a different ID.
- **Bump `version` on every byte change.** Tools cache by id+version. Forgetting to bump means stale bytes everywhere.
- **Always include a `checksum`.** SRI-format SHA-256. End-to-end integrity check, prevents CDN poisoning.
- **Deprecate, don't delete.** Set `"deprecated": true` and optionally `"replacedBy": "new/asset/id"`. Existing references continue to resolve.

## Tiers

| Tier         | What it means                                                  | When to use |
|--------------|----------------------------------------------------------------|-------------|
| `core`       | Bundled with the app. Always available offline.                | Logos, primary palette, design tokens, core mascot poses |
| `catalog`    | Synced at boot, cached. Available offline once cached.         | Most things — event packs, icon sets |
| `on-demand`  | Fetched when first used, then cached. Needs net first time.    | Heavy items — hi-res photo, video b-roll |

The `core` tier is meant to stay small (target a few dozen brand essentials); today the catalog ships 10 core assets, the rest `on-demand`. Catalog-tier entries can set `"prefetch": true` (catalog tier only) to fetch their bytes at sync time rather than lazily on first use.

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

Tools reference palette swatches through `host.assets.get(id)` → `ref.meta.swatches`. Note this is wired up in the **CLI shell** today (its bridge parses the palette JSON and spreads `swatches` into `meta`); the web shell's assets bridge does not yet populate `meta.swatches`, so don't rely on it cross-shell.

The `color` input type also accepts a `palette` field (schema-valid, mapped to a `palette-picker` control in `engine/src/inputs.js`), but the web shell currently renders that control as a **stub**. For a working brand-restricted picker today, use a `color` input with `"swatchesOnly": true` — it renders the real brand swatch picker (no hex/native/alpha).

## Design tokens

`type: "tokens"` is a DTCG (Design Tokens Community Group) JSON document — the canonical brand-color source. The core asset `suse/tokens/brand` feeds the color picker's swatches and the defaults for brand-bound inputs. Beyond the normal asset checks, the validator runs a dedicated DTCG-structure validation against `schemas/tokens.schema.json` (`scripts/validate-catalog.js`). See [Design tokens](/info/design-tokens.html) for the token model and how palettes relate.

## Workflow

1. Drop the file under `catalog/assets/<namespace>/...`.
2. Add an entry to `catalog/assets/index.json` (the `checksum`/`size` can be left
   as `sha256-PLACEHOLDER`/`0` — the next step fills them in).
3. Run `npm run build:catalog` — `scripts/checksum-assets.js` computes the real
   SHA-256 (SRI) and byte size for every asset format and writes them into the
   index. `npm run validate:catalog` then verifies every checksum against the
   bytes on disk.
4. PR review. Approval = brand approval.
5. Merge → build catalog → deploy. Clients pick it up at next sync.

For **catalog/brand** assets there is no upload UI, no admin tool, no moderation queue. The git review **is** the moderation. (This is separate from a user's own device-local image library — the web shell lets a person save their own uploads under the `user/` namespace, capped at 50; those never enter the catalog and are not brand-reviewed.)

Composed renders — a tool that embeds another tool's output via `composes` (see [Authoring tools](/info/authoring-tools.html)) — surface as ephemeral `AssetRef`s through the same `{{asset id}}` helper, but they are runtime intermediates, not catalog assets.
