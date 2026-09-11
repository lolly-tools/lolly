# Vendored Jelly UI (web components)

`jelly.mjs` is the built ESM bundle of **Jelly UI** - dependency-free web components
whose controls render a soft-body "jelly" squish on a per-component `<canvas>`
(2D spring-membrane physics, no WebGL, no SVG filters). It powers the flag-gated
jelly chrome controls (see `shells/web/src/lib/jelly.ts`); importing the module
defines every `<jelly-*>` element and injects its default tokens under `@layer jelly`.

**Do not hand-edit `jelly.mjs`.** Refresh it with:

```
curl -sL https://jelly-ui.com/dist/jelly.js -o shells/web/src/vendor/jelly/jelly.mjs
```

## Provenance
- Source: https://jelly-ui.com/dist/jelly.js (the site serves the repo's built,
  unminified ESM bundle - 40 custom elements, ~318 KB)
- Snapshot: 2026-07-21. Upstream had no tagged release yet; treat this as a pin
  and re-audit on refresh (the repo is early-stage).
- Repo: https://github.com/jelly-org/ui - TypeScript, MIT
- The trailing `//# sourceMappingURL=jelly.js.map` is upstream's; the map is not
  vendored (devtools may log a one-time 404 when the Sources panel is open).

## Theming contract (why this integrates cleanly)
All colors resolve through `--jelly-color-*` custom properties re-read from
computed style on every repaint, with hardcoded oklch fallbacks. Lolly maps its
shell tokens onto them in an **unlayered** bridge stylesheet (`lib/jelly.ts`),
which outranks the bundle's `@layer jelly` defaults; `theme.ts` stamps
`data-jelly-mode` and dispatches `jelly-theme-change` so idle (settled) canvases
repaint on theme switches. Reduced motion is respected upstream
(`prefers-reduced-motion` / `data-jelly-motion`).

## Known issues (upstream)
- **jelly-slider reportedly breaks when dragged all the way to the left** (Andy,
  2026-07-21, observed on the jelly-ui.com demo). Not reproduced/diagnosed here -
  the slider's range math looks clamped, so the failure is likely in the
  thumb-spring/paint path. Lolly only uses `jelly-switch` so far; test the left
  edge hard before wiring `jelly-slider`/`jelly-range` into any surface.

## Licensing - permissive
| Component | Licence |
|---|---|
| Jelly UI (c) 2026 bmson | MIT (`LICENSE.jelly.txt`) |
| Bundled Fluent System Icons (Microsoft) | MIT |
