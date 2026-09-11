# NOTICE - lolly-tools

The tool definitions in this repository (manifests, templates, hooks, styles,
thumbnails, and tool-local assets) are licensed under **MPL-2.0** (see
`LICENSE`), except as noted below.

## Tool icons

Each tool's `icon.svg` follows the Lucide icon house style. Lucide is licensed
under the **ISC** license (https://lucide.dev/license).

## Vendored libraries

Some tools vendor minified third-party libraries under `<id>/lib/`, and
`qr-code/hooks.js` inlines two directly so the tool stays a single
self-contained data file: qrcode-svg (MIT) and a selective bwip-js/BWIPP
bundle (MIT) for the industrial symbologies. `gradient/template.html`
inlines the 3D simplex noise GLSL by Ian McEwan and Stefan Gustavson, Ashima
Arts (webgl-noise, MIT) for its Flow mode shader. `backdrop/lib/` vendors a
tree-shaken bundle of Paper Shaders (@paper-design/shaders, Apache-2.0,
© Paper Design) - its LICENSE and NOTICE ship in that directory. `3d/lib/`
and `flythrough/lib/` vendor three.js (MIT, © 2010-2026 three.js authors) with
its GLTFLoader, RoomEnvironment and OrbitControls addons; the `3d` bundle is
the WebGPU build, rebuilt by the monorepo's `scripts/build-three-bundle.ts`.
`chart/lib/three-chart.min.js` is a smaller Three.js WebGL build containing only
the scene, geometry, material and lighting primitives used by Chart's real-z
bar, scatter and surface adapter; it is rebuilt by
`scripts/build-chart-three.ts`. `chart/lib/d3.min.js` vendors D3 7.9.0 (ISC,
© 2010-2023 Mike Bostock), and `chart/lib/observable-plot.min.js` vendors the
official Observable Plot 0.6.17 UMD build (ISC, © 2020-2025 Observable, Inc.) for
Chart's curated statistical/editorial SVG lane. The latter shares that D3
runtime; `chart/lib/chart-plot.js` is Lolly's MPL-2.0 adapter and accepts no raw
vendor configuration.
Each keeps
its upstream license; see the `lolly` monorepo's `THIRD-PARTY-NOTICES.md` for
full attribution.

## Trademarks

Example values in some manifests reference `suse.com` URLs purely as
illustrative defaults. "SUSE" is a trademark of SUSE LLC; nothing in this
repository grants trademark rights.
