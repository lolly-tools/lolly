# Authoring Assets

Assets are global, versioned, brand-controlled resources tools draw from. Logos, palettes, mascots, event tiles, fonts.

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
| `core`       | Bundled with the app. Always available offline. ~30–50 items.  | Logos, primary palette, core mascot poses |
| `catalog`    | Synced at boot, cached. Available offline once cached.         | Most things — event packs, icon sets |
| `on-demand`  | Fetched when first used, then cached. Needs net first time.    | Heavy items — hi-res photo, video b-roll |

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

Tools reference palette swatches through `host.assets.get(id)` → `ref.meta.swatches`. The `color` input type's `palette` field lets a tool constrain a color picker to a specific palette.

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

There is no upload UI, no admin tool, no moderation queue. The git review **is** the moderation.
