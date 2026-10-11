<!-- SPDX-License-Identifier: MPL-2.0 -->

# Penpot canvas and menu interactions

Canvas feedback and shared menu navigation adapt source from
[penpot/penpot](https://github.com/penpot/penpot/tree/10955f17e27943429a10e90360d0404e3f56e27c/),
commit `10955f17e27943429a10e90360d0404e3f56e27c`.

Copyright (c) KALEIDOS SUBSIDIARY SL. The copied source and its adaptations are
subject to the Mozilla Public License, Version 2.0. The full upstream license
is reproduced unchanged in [LICENSE](./LICENSE).

## Source and modifications

[upstream.json](./upstream.json) identifies every adapted upstream file, its
SHA-256, the unchanged local snapshot and the modified source destinations.
The `upstream/` tree retains the pinned source bytes. Derived source carries
the MPL source notice and upstream copyright. The Rust ruler file has no
per-file license header; the upstream repository license covers that source.

Shared menu navigation translates wrapped directional focus from
`context_menu_a11y.cljs` and the modern design system's `select.cljs`
`handle-focus-change` and `on-button-key-down`. The adapter uses one delegated
listener on each open panel, queries the current menu level on a navigation
key, focuses the next visible item and scrolls that option into view. Existing
popover code owns Tab, Escape, outside clicks, Back and cleanup. Native buttons
and links retain activation, and unavailable actions remain focusable when
they carry an explanation. The language and design-system menus retain their
existing roving Tab stop.

Snapping adapts prepared per-axis buckets from `worker/snap.cljs`
`make-insert-tree-data` and the bounded query pattern in `main/snap.cljs`
`snap-accuracy-ranges` and `closest-snap`. The adapter lazily builds sorted
arrays on the first eligible snap query in a gesture, then reuses that index
for binary searches within the existing threshold. Range-minimum insertion
ordinals preserve Lolly's
original target order for ties. Authored guides remain live linear candidates
without rebuilding the object index. The adapter retains
object and artboard guide spans, hidden-layer exclusion, locked-layer targets,
authored angled guides, grid precedence and screen-scaled accuracy. Penpot's
worker transport, Rx pipeline and pairwise equal-distance solver are not copied.

Guide feedback adapts `guides.cljs` `guide-pill-axis`, `guide-pill*` and the
newer WASM viewport overlay interactions. Native DOM pills retain constant
screen sizes and provide a lazy coordinate editor with Enter/blur commit and
Escape cancel. Dragging uses a three-screen-pixel threshold and one queued
preview frame. Lolly retains its document coordinates and angled guides;
Penpot's frame-bound guide ownership model is not copied.

Ruler feedback adapts the modern Rust `rulers.rs` `draw_selection_x`,
`draw_selection_y` and `format_label`: selection projection bands, endpoint
labels, outer label masks and two-decimal formatting without negative zero.
The DOM adapter keeps those dimensions constant on screen. Existing Lolly
tick intervals and tick geometry caches remain in use. The legacy SVG ruler
is not a reuse origin.

| Upstream source | Modified source |
|---|---|
| `context_menu_a11y.cljs`, `ds/controls/select.cljs` | `components/menu-navigation.ts` |
| `worker/snap.cljs`, `main/snap.cljs` | `views/canvas-snap-index.ts` |
| `viewport/guides.cljs` | `views/design-guides.ts`, `design-guides-view.ts`, `design-guides-interactions.ts`, `styles/parts/design-guides.css` |
| `render-wasm/src/render/ui/rulers.rs` | `views/design-guides-rulers.ts`, `design-guides-shared.ts`, `styles/parts/design-guides.css` |

The modified source is available under `shells/web/src/components/`,
`shells/web/src/views/` and `shells/web/src/styles/parts/` in the public
repository. The generated
[THIRD-PARTY-NOTICES.md](../../../../../THIRD-PARTY-NOTICES.md) and
[THIRD-PARTY-LICENSES.txt](../../../public/THIRD-PARTY-LICENSES.txt) identify
the destinations and reproduce the full MPL text for the web build. Regenerate
them with `pnpm run build:licenses` after changing this inventory.

The flex and grid sidebar and Rust/WASM layout kernel have separate provenance
under `shells/web/src/views/design-layout-section.penpot/` and
`packages/node-shell/wasm/layout-kernel/`.
