<!-- SPDX-License-Identifier: MPL-2.0 -->

# Penpot layout sidebar source

The Design layout sidebar adapts the modern Penpot flex and grid inspector from
[penpot/penpot](https://github.com/penpot/penpot/tree/10955f17e27943429a10e90360d0404e3f56e27c/frontend/),
commit `10955f17e27943429a10e90360d0404e3f56e27c`.

Copyright (c) KALEIDOS SUBSIDIARY SL. The copied source and its adaptations are
subject to the Mozilla Public License, Version 2.0. The full upstream license
is reproduced unchanged in [LICENSE](./LICENSE).

## Source and modifications

[upstream.json](./upstream.json) records every reused upstream file, its SHA-256,
the unchanged local snapshot and the modified source destinations. The
`upstream/` tree retains the original source and copyright notices at the pinned
revision. These snapshots document the adaptation and are available with the
source repository.

The layout container, layout item and grid cell menus are translated from
ClojureScript and Rumext into TypeScript inspector markup and existing
`ModelPort` edits. Their SCSS control arrangements are adapted to scoped CSS and
the web shell's theme variables. The adapted files retain Penpot's MPL and
copyright notices.

| Upstream source | Modified source |
|---|---|
| `layout_container.cljs` | `design-layout-section.ts`, `design-layout-controls.ts`, `design-layout-tracks.ts` |
| `layout_item.cljs` | `design-layout-section.ts`, `design-layout-controls.ts` |
| `grid_cell.cljs` | `design-layout-section.ts` |
| The three corresponding SCSS files | `styles/parts/design-layout-section.css` |
| 68 layout SVGs from `frontend/resources/images/icons/` | `design-layout-icons.ts` |
| `common/src/app/common/types/shape/layout.cljc` | `design-layout-track-placement.ts` |

Track editing adapts occupied explicit-cell behavior from `add-grid-track`,
`make-remove-cell`, `make-decrease-track-num`, `remove-grid-row`,
`remove-grid-column`, `remove-cell-areas`, `remove-cell-areas-after`,
`swap-track-content` and `reorder-grid-track`. Track insertion shifts occupied
cells and extends spans across the inserted track. Automatic children retain
Design's automatic placement intent. The adapter represents occupied explicit
cells; the newer Rust kernel continues to calculate geometry.

The SVG strings retain the upstream geometry, view boxes, line caps and joins.
The render helper adds accessibility attributes and an optional rotation class.
The upstream SVGs have no per-file copyright header; their terms are recorded
by the repository MPL license. The derived icon module carries the MPL source
notice and KALEIDOS copyright, and the unchanged originals are in `upstream/`.

The modified source ships in the public repository under `shells/web/src/views/`
and `shells/web/src/styles/parts/`. The generated notices in
[THIRD-PARTY-NOTICES.md](../../../../../THIRD-PARTY-NOTICES.md) and
[THIRD-PARTY-LICENSES.txt](../../../public/THIRD-PARTY-LICENSES.txt) identify these
sources and reproduce the full MPL text for the web build. Regenerate them with
`pnpm run build:licenses` after changing this inventory.

The separate Rust/WASM layout kernel has its own provenance and build
instructions under `packages/node-shell/wasm/layout-kernel/`.
