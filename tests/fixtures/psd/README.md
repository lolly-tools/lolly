# Photoshop fixtures

These nine files were saved by Adobe Photoshop. They are the unchanged test files of psd-tools at commit `9e706d6ba3b5e5c91a1d0c423ff783ce3e9c363c`, copyright Kota Yamaguchi, under the MIT licence included as `LICENSE.psd-tools`. Source: https://github.com/psd-tools/psd-tools/tree/9e706d6ba3b5e5c91a1d0c423ff783ce3e9c363c/tests/psd_files . A file from an upstream subfolder keeps that folder as a name prefix: `layers-minimal/type-layer.psd` is `layers-minimal_type-layer.psd` here.

`tests/psd-real-files.test.ts` reads them. They hold the cases hand-made fixtures missed (plans/289, 2026-10-02):

| File | What it holds |
|---|---|
| `text.psd` | A three-line type layer in ArialMT |
| `layers-minimal_type-layer.psd` | One paragraph type layer |
| `stroke.psd` | Shape layers with a dashed stroke, a dotted stroke, a gradient stroke, a pattern fill and a pattern stroke, with fills in `vscg` |
| `layers-minimal_shape-layer.psd` | A polygon with a fill and an inside stroke |
| `layers-minimal_solid-color-fill.psd` | A solid colour fill layer |
| `path-operations_combine.psd` | Three ellipses combined in one layer, with an outside stroke |
| `path-operations_subtract-all.psd` | Three ellipses joined by subtract |
| `clipping-mask.psd` | Vector shapes in groups, one clipped to the layer below |
| `fill_adjustments.psd` | Fifteen adjustment layers, Invert's empty block included, and shapes with layer effects switched on |
