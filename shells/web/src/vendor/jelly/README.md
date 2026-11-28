# Vendored Jelly UI (web components)

Local Performance UI patch: `setPerformanceMode()` cancels active physics and
settles each membrane. Existing controls retain their form state and repaint on
input without sustaining an animation loop. Preserve this hook when re-vendoring;
`lib/jelly.ts` calls it when the shell policy changes.

`jelly.mjs` is the built ESM bundle of **Jelly UI** - dependency-free web components
whose controls render a soft-body "jelly" squish on a per-component `<canvas>`
(2D spring-membrane physics, no WebGL, no SVG filters). It powers the flag-gated
jelly chrome controls (see `shells/web/src/lib/jelly.ts`); importing the module
defines every `<jelly-*>` element and injects its default tokens under `@layer jelly`.

The exact distributed bytes and local-change status are recorded in `security/vendor-artifacts.json`. SBOM generation verifies this inventory before including the library. Do not refresh directly from the mutable hosted bundle. Select and review an immutable upstream source revision, rebuild the bundle, preserve the local performance hook, then update the reviewed byte inventory.

## Provenance
- Source: https://jelly-ui.com/dist/jelly.js (the site serves the repo's built,
  unminified ESM bundle - 40 custom elements, ~318 KB)
- Snapshot: 2026-07-21. Upstream had no tagged release yet; treat this as a pin
  and re-audit on refresh (the repo is early-stage).
- The snapshot did not record an upstream source commit. Checked afterwards
  (2026-11-21), the likely source is
  [`8e39a8e61b5a43a562ae85e4b01191d333d5b121`](https://github.com/jelly-org/ui/tree/8e39a8e61b5a43a562ae85e4b01191d333d5b121)
  (2026-07-20): the bundle carries that commit's button activation fix
  (`activationPointerId`, `cancelPointerClick`), lacks the pagination fix of the
  next commit (`46e3f1e`, 2026-07-25), and that commit's GitHub Pages deploy,
  which publishes jelly-ui.com, was the last one before the snapshot. Upstream
  commits no built bundle, so this is not confirmed byte for byte.
- The bytes as first vendored, before the performance patch, are in commit
  `8e1347493b` of the lolly-web history (2026-07-21), SHA-256
  `68af6000710c7b8bd22d3ed8e337308fb20d767511483d1458f27288d34950ef`. The current
  byte pin is in `security/vendor-artifacts.json`.
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
