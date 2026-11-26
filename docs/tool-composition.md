# Composition and brand overlays

Tools can build on each other instead of copying each other. `composes` embeds another tool's output, the brand logo helper picks the design system's logo for the background and `extends` lets a brand pack change one file of a community tool.

<!--i:eti-layers-->
## Composition (`composes`)

A tool can embed **another tool's rendered output** as an image. Declare the child in the manifest and use it in the template like any asset, with no hook code:

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

![A parent tool's composes entry renders the child tool through the same engine path, and the result fills an image slot in the parent's template. Nesting stops at three levels, and a cycle leaves the slot empty.](/info/diagrams/concepts/tool-composition.svg)

- Each entry renders `tool` with `inputs` and exposes the result under `id` as an `{{asset <id>}}` extra, the same store hook-computed values use.
- String values in `inputs` are **Handlebars**, filled from your tool's own context (its input values and extras), so a child input can follow a parent value: `"url": "{{url}}"`.
- **Use `format: "svg"`.** An SVG child stays vector when the parent exports SVG or PDF and rasterises crisply for PNG. Raster children (`png`, `jpg`, `jpeg`, `webp`) embed as images. Without `format`, the child's first declared format (`render.formats[0]`) is used. `width` and `height` in pixels default to the child's own size. The enum also lists `pdf`, but nothing can place a PDF as an image, so never choose `pdf`. HTML, Markdown and plain-text children are not supported.
- The composed value is an ordinary asset URL, so it works in a CSS `url()` background as well as an `<img src>`.
- The child renders through the **same engine path**, pixel for pixel. As an intermediate, the child is never watermarked or given provenance. Nesting is **guarded against depth and cycles**: `a → b → a` fails gracefully and the slot stays empty, so always guard the reference with `{{#if}}`.
- Composition works wherever the shell can render the child to bytes. The lean CLI composes `svg` children. The mechanism is `host.compose` ([Host API](/info/host-api.html)).
- No public tool declares `composes` yet.

Without a manifest, people get the same result by pasting a Lolly tool link into any `asset` input ([A pasted tool link becomes an image](/info/tool-files.html#a-pasted-tool-link-becomes-an-image)). Use `composes` for renders you wire into the layout. The pasted link is for people choosing what fills an image slot.

### Composition depth and baking

Nesting stops at **3 levels**: a tool composing a tool composing a tool. A deeper chain fails like a cycle, with an empty slot. To go deeper, **bake** the inner render: tick **Freeze as a static image** in the picker's render card. A baked image is a frozen copy of the bytes. It uses no nesting depth and never renders again by itself, so it does not update when the source tool changes. Its slot shows a "baked from …" row with a **Re-bake** button and a way to edit the source tool's inputs.

<!--i:eti-image-->
## Brand logo (auto-switching)

Do not hard-code one logo file. A design system lists its logos as token slots under `asset.logo`: `horizontal-` (wide) or `vertical-` (stacked), then `primary` or `mono`, with `-reverse` added for a dark background. In the Lolly Demo design system, `{asset.logo.vertical-primary}` resolves to `lolly/logo/primary` and `{asset.logo.vertical-primary-reverse}` to `lolly/logo/reverse`. A hook picks the slot that fits the background and the space, resolves the slot to an asset id with `host.tokens.resolve()` and fetches the **actual SVG image** with `host.assets.get()`. The same tool then shows the right logo on any design system that fills those slots.

The shared helper `resolveBrandLogo(dark, mono)` in `community/_shared/brand-logo.js` does this. When a slot is empty, the helper tries the other orientation and treatment:

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

An `<image>` inside an `<svg>` lets the export inline the logo and write **true vector SVG**. An `<img>` in an HTML canvas exports as raster or PDF only. `certificate`, `stationery`, `link-card`, `deck-studio` and `multi-page-pdf` use the helper. Copy the helper into your own hooks with the shared-region markers and `pnpm run sync:shared` ([Shared helper regions](/info/tool-hooks.html#shared-helper-regions-community-shared)).

<!--i:eti-folder-shared-->
## Brand overlays (`extends`)

A brand pack that only adjusts a community tool, for example with a different template or a few reworded translations, should not carry a whole copy that drifts from the original. Declare the brand's tool folder an **overlay** instead:

```jsonc
// brands/<brand>/tools/<id>/tool.json - same id as the community tool
{
  "id": "color-palette",
  "extends": "community",
  ...
}
```

and keep **only the files that differ** in the overlay folder. The content resolver (`packages/node-shell/src/content-roots.ts`) then reads the tool as a file-by-file union of the base (`community/<id>/`) and the overlay (`brands/<brand>/tools/<id>/`). Every reader gets the same union: a `dist/` build, the CLI, the dev server and the catalog signer.

- **Overlay wins** on any filename collision. Everything else comes from the base.
- The union goes **one level** into subfolders (`i18n/`, `assets/`), file by file. Anything nested deeper comes whole from the winning side.
- The `extends` field is **removed from the combined `tool.json`**, so the engine, shells and catalog scripts always see a plain tool. Anything that reads manifest bytes goes through `readToolManifestText(id)`, so the signed, served and shipped manifests are one set of bytes. Edit the pack source. There is no combined copy on disk.
- Overlay and base **share one tool id**, because ids are permanent and the URL `tools/<id>/` never changes. The overlay's `tool.json` carries the `extends` marker even when it is otherwise identical to the base's.

::: warning A broken overlay stops with an error
An overlay whose base is missing (no `community/<id>/tool.json`), an `extends` value other than `"community"` (the only base pack in v1) or an `extends` on a community tool itself fails with an error the first time anything resolves that profile. `pnpm run validate:catalog` also rejects such an overlay. The validator asks the same resolver every shell asks, so the combined result is validated like any other tool.
:::
