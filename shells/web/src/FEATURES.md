# Lolly Feature Release Notes

## Font Upload

**Status:** Stable

Users can now upload custom fonts in TTF, OTF, or WOFF formats and set them as the brand font. These uploaded fonts become available across all tools in the workspace without requiring app updates.

### Usage
1. Navigate to the Brand Studio (Design System > Appearance, or #/start Fonts tab)
2. In the Fonts section, click **Add Font**
3. Upload a TTF, OTF, or WOFF file from your computer
4. The font is automatically detected and added to your brand's font library
5. Set the font as your primary brand font via the **Set as Brand Font** button
6. The font is instantly available in all tools' text inputs and layouts

### Benefits
- **No vendor lock-in:** Use proprietary or custom typefaces without external dependencies
- **Brand consistency:** Ensure every export uses your exact typeface specifications
- **Zero distribution friction:** Fonts travel with the brand profile; no separate licensing or CDN setup
- **Offline-first:** Fonts are stored locally; tools can render without internet connectivity
- **Variable font support:** Upload variable fonts with multiple weight/width/optical-size axes; tools expose axis controls when available

### Gotchas
- **File size:** Large font files (especially full-charset, multi-weight variables) increase project size. Keep individual fonts under 1 MB where possible; subset fonts for faster load times.
- **Subsetting:** Lolly does not subset fonts automatically-uploaded fonts are used verbatim. If you upload a 500 KB CJK font but only need Latin, pre-subset with tools like FontTools or Glyphhanger.
- **Fallback chain:** If an uploaded font lacks glyphs for your text (e.g., Arabic in a Latin-only typeface), the engine's `fallbackFonts` chain will attempt recovery with system fonts. Check exports with diverse character sets.
- **License compliance:** Ensure your TTF/OTF/WOFF license permits embedding and redistribution in exported assets (not all do). Lolly embeds fonts in PDFs and EMF files.
- **Platform quirks:** Variable fonts may render with slightly different default instances on macOS vs. Linux vs. Windows; test on-brand exports on the target platform.

---

## Smooth Gradients

**Status:** Stable

Gradients now use OKLab color-space interpolation combined with Catmull-Rom spline fitting, ensuring perceptually uniform transitions and smoother visual flow than linear RGB blending.

### Usage
1. Open any tool with gradient inputs (e.g., Mesh Gradient, Design, filters)
2. In the Brand Studio **Colour tab**, expand the gradient editor
3. Add or edit gradient stops using the color picker
4. A toggle labeled **Smooth Interpolation** appears; enable it for OKLab + Catmull-Rom rendering
5. The gradient preview updates in real-time; export and compare with your design system specs

### Benefits
- **Perceptually uniform transitions:** OKLab avoids the gray-band "dead zone" that RGB gradients suffer when interpolating between saturated colors
- **Natural curvature:** Catmull-Rom splines reduce harsh transitions at gradient stops, mimicking hand-drawn smooth curves
- **Brand-aligned palettes:** Smooth gradients stay true to your brand's color semantics; e.g., a blue-to-pink gradient won't muddy toward purple
- **Accessible:** Improved lightness uniformity aids users with reduced color discrimination

### Gotchas
- **Rendering cost:** Smooth gradients (especially with many stops) require more computation on raster export. SVG exports are fast; PNG/JPEG at very high DPI may take 5–10 seconds.
- **OKLab gamut:** OKLab can produce out-of-sRGB colors on screen. Lolly clips to gamut on raster export, but PDFs and SVGs may show unexpected colors in non-color-managed viewers (rare, but test in Adobe Reader).
- **No UI preview banding:** Web canvas preview uses WebGL/CSS, which may not accurately reflect the final OKLab render. Always export a test PNG to verify.
- **Legacy compatibility:** Exported gradients with `smooth: true` in the SVG/PDF metadata are not compatible with Adobe CC older than 2023. If you need to share with older design tools, disable smooth interpolation.

---

## Text Outlines in Vector

**Status:** Stable

Text strokes (outlines) are now preserved when exporting to SVG, PDF, and EMF formats, allowing outlined typography to render as true vector paths instead of rasterizing to bitmaps.

### Usage
1. In any tool with text input (Design, Doc Studio, brand lockups), select a text field
2. In the sidebar, expand the **Text Stroke** or **Outline** section
3. Set stroke width (in px or physical units), color, and line-cap/line-join style
4. Export to SVG, PDF, or EMF format
5. Text strokes render as editable vector paths in design tools (Figma, Adobe Illustrator, Inkscape, CorelDRAW)

### Benefits
- **Editability:** Exported text outlines can be further edited in downstream design tools (change stroke width, color, or font without re-rendering)
- **File size:** Vector-only outlines are much smaller than rasterized fallback (SVG ~50–200 bytes per glyph vs. 2–5 KB rasterized at 300 DPI)
- **Quality at scale:** Strokes remain crisp at any zoom level or print resolution-no pixelation
- **Print fidelity:** Outlines preserve stroke specifications for CMYK and spot-color separations (critical for branded print assets)
- **Mixed media:** Combine stroked text with other vector elements (illustrations, shapes) without file-format conversions

### Gotchas
- **Complex glyphs:** Outlines of highly detailed or script typefaces can generate thousands of path nodes. Exported files may be larger than expected and slow to open in some tools.
- **Compound glyphs:** Fonts with ligatures or contextual alternates may not stroke as expected if the font lacks explicit outline glyph data. Test ligatures and accented characters in your brand font.
- **PDF viewer compatibility:** Basic PDF viewers (built-in browsers) display stroked text correctly, but older readers (PDF-XChange, Foxit) may require updating. Adobe Reader 2020+ is fully compatible.
- **SVG import quirks:** When importing an SVG with text outlines back into Lolly, outlines are treated as immutable vector shapes, not editable text. Use the original `.lolly` session to edit text; export SVG only for downstream handoff.
- **EMF limitation:** Windows EMF format has a ~64K node limit per path. Text with extreme stroke width or very high DPI may hit this limit. If so, fall back to PDF or rasterize.
- **Line-join artifacts:** At very acute angles (e.g., serifs), miter joins can spike beyond the intended stroke width. Use `bevel` or `round` joins for serif or script typefaces to avoid overspill.

---

## Future Roadmap

- **Gradient animation:** Smooth gradients may support animation/interpolation between multiple gradient states (Q3 2026)
- **Font subsetting UI:** Automatic glyph analysis and font subsetting directly in the Brand Studio (Q3 2026)
- **Text outline effects:** Gradient strokes and animated stroke dashoffset for outlined text (planned, TBD)
