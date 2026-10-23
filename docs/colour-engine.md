# Colour in the engine

This page is for tool authors and anyone checking why an exported colour looks the way it does. It covers three separate questions: which colours Lolly can read, where its colour maths happens and which colour spaces it writes. For choosing an export format and its colour profile, see [Export a file](/info/exporting.html#colour-profiles).

One module, `engine/src/css-color.ts`, parses, converts, gamut-maps and writes colour for the whole platform, so the browser preview and every export walker agree on what a colour string means.

## Reading

Wherever a colour is written (a tool's stylesheet, an imported SVG's paint, a design token's value, a shadow or gradient inside a CSS shorthand), Lolly reads the full **CSS Color 4** vocabulary:

- `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()` and the CSS named colours;
- `color()` in the predefined spaces `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50` and `xyz-d65`;
- components written as the `none` keyword, kept distinct from zero so CSS's interpolation rules still apply.

This matters because a browser resolves modern CSS into modern CSS. A `color-mix(in oklab, …)` computes to `oklab(…)`, and a brand token stored as `oklch()` reaches the export walker in that form. Both are read as colours rather than dropped. A value the parser cannot read returns "no colour" instead of failing the render, because imported documents are untrusted input.

## Thinking

Colour maths happens perceptually rather than in raw channels.

- Palette derivation, ramps, harmonies and contrast run in **OKLCH and OKLab**.
- An out-of-gamut colour is brought into range with CSS Color 4's own gamut-mapping method: chroma reduction checked against perceptual distance. A vivid colour settles on the nearest colour you would accept rather than a clipped, flattened one.
- Gradients interpolate in the space you choose: OKLab by default, or `oklch`, `lab`, `lch`, `srgb`, `srgb-linear` or `hsl`, with a hue direction (shorter, longer, increasing or decreasing) for the polar spaces.
- Mixing is **premultiplied**, so a fade to transparent keeps its colour instead of darkening toward black on the way.

One interpolator serves the preview and the export walkers, so a gradient is blended the same way on screen and in the file.

## Writing

The output is narrower than the input, because a file has to be readable by any app that opens the file. A space is declared on output only when the numbers were really converted into that space.

| Output | Written as |
|---|---|
| Screen and web formats | **sRGB**, tagged as sRGB |
| Print formats | **CMYK** against a named press condition |
| The export panel's HDR card | **Rec.2100 PQ** |

A wide-gamut colour that reaches an ordinary export is mapped into sRGB rather than mislabelled. A Design document set to **Wide colour / HDR** works differently: it keeps its wider swatches and float pixels through its own raster and video exports, as [Wide colour and HDR editing](/info/hdr-editing.html) describes.

A gradient authored in OKLab is baked into plain sRGB stops on the way out. Extra stops are inserted only where sRGB would visibly drift from the perceptual curve, because an SVG `<linearGradient>` and a PDF axial shading have no setting for the interpolation space. One authored value gives the same gradient in the preview, the SVG and the PDF.

## Where to look in the code

| Concern | Module |
|---|---|
| Parsing, conversion, interpolation, gradient baking | `engine/src/css-color.ts` |
| OKLab and OKLCH maths, gamut mapping | `engine/src/brand-derive.ts` |
| Ramps for palettes and gradient tokens | `engine/src/color-tools.ts` (`rampOklab`) |
| ICC profile bytes and press conditions | `engine/src/color.ts` |
| Colours read out of SVG paint | `engine/src/svg-colors.ts` |
