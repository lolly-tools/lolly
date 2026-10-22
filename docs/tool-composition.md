# Composition and brand overlays

Compose tools and resolve brand-specific logos and overlays.

Part of [Authoring Tools](/info/authoring-tools.html).

## Composition (`composes`)

A tool can embed **another tool's rendered output** as an image instead of re-implementing it. Declare it in the manifest and reference it in the template like any asset - no hook code, no copy-paste.

```jsonc
// tool.json
"capabilities": ["compose"],
"composes": [
  { "id": "badgeQr", "tool": "qr-code", "format": "svg",
    "inputs": { "url": "{{url}}", "color": "#0c322c", "join": true } }
]
```
```handlebars
{{!-- template.html - guard it: composition can fail gracefully --}}
{{#if badgeQr}}<img src="{{asset badgeQr}}" alt="">{{/if}}
```

- Each entry renders `tool` with `inputs` and exposes the result under `id` as an `{{asset <id>}}` extra (the same store hook-computed values use).
- String `inputs` values are **Handlebars**, hydrated against your tool's own context (its input values + extras), so a child input can bind to a parent value - e.g. `"url": "{{url}}"`.
- `format` (defaults to the child tool's first declared format, `render.formats[0]`) fixes the child render; `width`/`height` (px) default to the child's native size. **Compose any tool's render: an `svg` child stays a true vector when the parent exports to SVG or PDF and rasterises crisply for PNG; raster children (`png`, `jpg`/`jpeg`, `webp`) embed as images.** `svg` is the best-supported format. No public tool declares `composes` yet, so the example above is the starting point. The enum also lists `pdf`, but a **PDF child is not supported as a source** - nothing inlines a PDF blob, so don't set `format: "pdf"`. HTML / Markdown / plain-text composition is **not** supported.
- The composed value is a **normal asset URL**, so it works in a CSS `url()` background just as well as in an `<img src>` - bring another tool in exactly like a library image.
- The child renders through the **same engine path** (pixel-identical) and is never watermarked or provenance-stamped (it's an intermediate). Recursion is **depth- and cycle-guarded**: `a → b → a` fails gracefully and the slot stays empty, so always `{{#if}}`-guard the reference.
- Works wherever the shell can render the child to bytes; the lean CLI composes `svg` children. The mechanism is `host.compose` - see [Host API](/info/host-api.html).
- **End users get this too, without a manifest.** Any `asset` input can take a pasted Lolly tool link (see [`asset` - library or device upload](/info/tool-files.html#asset-library-or-device-upload)); the host renders it through the same `host.compose` path. `composes` is for renders *you* wire into the layout; the pasted-link path is for the user to choose which tool fills an image slot.

### Composition depth and baking

Nesting is capped at **3 levels** - a tool composing a tool composing a tool. A deeper chain fails the same way a cycle does: gracefully, with an empty slot. When a design genuinely needs to go deeper, **bake** the inner render: tick *Freeze as a static image* in the picker's render card. A baked image is a frozen copy - self-contained bytes that consume **no** nesting depth and never live-re-render - so it won't update when the source tool changes. Its slot shows a "❄ baked from …" row with a **Re-bake** button (and an Edit path into the source tool's inputs) that re-renders on demand, so a stale copy is one click from fresh.

## Brand logo (auto-switching)

A tool shouldn't hard-code one logo file. A design system lists its logos as token slots under `asset.logo`: `horizontal-` (wide) or `vertical-` (stacked), then `primary` or `mono`, with `-reverse` added for a dark background. In the Lolly Demo design system, `{asset.logo.vertical-primary}` resolves to `lolly/logo/primary` and `{asset.logo.vertical-primary-reverse}` to `lolly/logo/reverse`. A hook picks the slot that fits the background and the space, resolves it to an asset id with `host.tokens.resolve()`, and fetches the **actual SVG image** with `host.assets.get()`, so the same tool shows the right logo on any design system that fills those slots.

The shared helper `resolveBrandLogo(dark, mono)` in `community/_shared/brand-logo.js` does this, and tries the other orientation and treatment when a slot is empty:

```js
// hooks.js - WCAG luminance decides the reverse slot; the ink comes from an input.
async function onInit({ model }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  const dark = relLuminance(inputs.background) < 0.5;   // dark bg → a -reverse slot
  return { logo: await resolveBrandLogo(dark, inputs.ink === 'mono') }; // → extras.logo (an AssetRef, or null)
}
```

```html
<!-- template.html - the actual SVG asset, not a font lockup -->
{{#if logo}}<image href="{{asset logo}}" .../>{{/if}}   <!-- inside an <svg> → true vector export -->
{{!-- or, in an HTML canvas: --}}
{{#if logo}}<img src="{{asset logo}}" alt="Logo">{{/if}}
```

Putting the `<image>` inside an `<svg>` lets the export inline it (data-URI) and emit **true vector SVG**; an `<img>` in an HTML canvas exports raster/PDF only. `certificate`, `stationery` and `link-card` use the helper. Copy it into your own hooks with the shared-region markers and `pnpm run sync:shared` (see [Shared helper regions](/info/tool-hooks.html#shared-helper-regions-community-shared)).

## Brand overlays (`extends`)

A brand pack that only needs to tweak a community tool - a different template, a handful of re-worded translations - shouldn't carry a whole fork that silently drifts from its base. Instead, declare the brand's tool dir an **overlay**:

```json
// brands/<brand>/tools/<id>/tool.json - same id as the community tool
{
  "id": "color-palette",
  "extends": "community",
  ...
}
```

and keep **only the files that differ** in the overlay dir. The content resolver (`packages/node-shell/src/content-roots.ts`) then reads that tool as the per-file union of the base (`community/<id>/`) and the overlay (`brands/<brand>/tools/<id>/`), the same union for every consumer - a `dist/` build, the CLI, the dev server, the catalog signer:

- **Overlay wins** on any filename collision; everything else comes from the base.
- Composition recurses **one level** into subdirs (`i18n/`, `assets/`) - files there union per-file too; anything nested deeper is taken wholesale from the winning side.
- The `extends` field is **stripped from the composed `tool.json`**, so the engine, shells and catalog scripts always see a plain tool. Anything that reads manifest *bytes* goes through `readToolManifestText(id)` for exactly that reason, so the signed, served and shipped manifests are one set of bytes. Edit the pack source; there is no composed copy on disk to edit.
- Overlay and base **share the same tool id** (ids are permanent contracts; the URL `tools/<id>/` never changes), so the overlay's `tool.json` doubles as the marker carrier even when it's otherwise identical to the base's.

**Fail-closed:** a declared overlay whose base is missing (`community/<id>/tool.json` doesn't exist), an `extends` value other than `"community"` (the only base pack in v1) or an `extends` declared on a community tool itself fails loudly the first time anything resolves that profile, and is also rejected by `pnpm run validate:catalog`. You never get a silent partial tool. The composed result is validated like any other tool, because the validator asks the same resolver every shell asks.

[Back to Authoring Tools](/info/authoring-tools.html).
