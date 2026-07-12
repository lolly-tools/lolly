# Test Plan: Export with Custom Font and Stroke Text

## Objective

Verify that stroke text with custom fonts exports correctly to SVG and PDF, with:
1. Font resolved via `host.text.toPath` (HarfBuzz WASM)
2. Glyphs shaped correctly with custom font metrics
3. Stroked text outlines preserved in vector export
4. No fallback to generic fonts (Outfit, etc.)

## Test Scope

### What is being tested

- **Layout Studio tool** with text boxes styled with stroke properties
- **Custom font upload** (user-provided TTF/OTF)
- **SVG export** with text-as-paths + stroke attributes
- **PDF export** with outlined glyphs + fill+stroke operators
- **Text shaping** via HarfBuzz with OpenType features (ligatures, alternates)
- **Stroke properties**: color, width, opacity

### What is NOT tested (out of scope)

- Raster exports (PNG/JPG/WebP) — these flatten stroke via filters
- Font embedding in PDF — all fonts are outlined (text-as-paths rule)
- Stroke line-cap/line-join (not CSS properties, optional SVG/PDF enhancements)
- Complex gradient fills on stroked glyphs (raster fallback in vector)

## Test Execution

### Unit Tests

Run the test suite:

```bash
npm test tests/text-stroke-export.test.ts
```

These tests verify:
- ✓ `host.text.toPath` mock behavior with custom fonts
- ✓ SVG path generation with fill + stroke attributes
- ✓ PDF content stream structure for stroke operators
- ✓ Text-as-paths conversion (no embedded `<text>`)
- ✓ OpenType feature handling (liga, salt, clig)
- ✓ Stroke opacity and boundary cases

### Integration Tests (Manual)

To test with a real tool render:

1. **Setup**: Start the web shell in development
   ```bash
   npm run dev:web
   ```

2. **Navigate** to Layout Studio: `http://localhost:5173/#/tool/layout-studio`

3. **Create a text box** with stroke styling:
   - Add a text box
   - Set text: "Stroked Outline"
   - Set **Color** (fill): red `#FF0000`
   - Set **Font**: Custom font (upload via the font selector)
   - Set **Text size**: 64px
   - Set **Weight**: 700 (bold)
   - **NEW**: Set **Stroke** color: black `#000000`
   - **NEW**: Set **Stroke width**: 2px

4. **Export to SVG**:
   - Click the Export button → SVG
   - Save as `stroke-test.svg`
   - Verify in code editor or browser:
     ```xml
     <path fill="#FF0000" stroke="#000000" stroke-width="2" d="M..."/>
     ```

5. **Export to PDF**:
   - Click the Export button → PDF
   - Save as `stroke-test.pdf`
   - Open in a PDF viewer (Acrobat, Preview, etc.)
   - Visual check: text should have colored outline

6. **CLI test** (headless):
   ```bash
   npm run cli -- layout-studio \
     --boxes='[{"id":"t1","kind":"text","x":100,"y":100,"w":300,"h":100,"text":"Stroked","fg":"#FF0000","fontSize":64,"font":"CustomFont","weight":"700","stroke":"#000000","strokeWidth":"2"}]' \
     --export=svg \
     > stroke-test.svg

   npm run cli -- layout-studio \
     --boxes='[{"id":"t1","kind":"text","x":100,"y":100,"w":300,"h":100,"text":"Stroked","fg":"#FF0000","fontSize":64,"font":"CustomFont","weight":"700","stroke":"#000000","strokeWidth":"2"}]' \
     --export=pdf \
     > stroke-test.pdf
   ```

## Verification Checklist

### SVG Export Verification

- [ ] Verify no `<text>` or `<tspan>` elements in output
- [ ] All text converted to `<path>` elements
- [ ] Each path has `fill` attribute matching text color
- [ ] Each path has `stroke` attribute matching stroke color
- [ ] Stroke width correct: `stroke-width="2"`
- [ ] Stroke opacity preserved (if set): `stroke-opacity="0.5"` etc.
- [ ] Custom font name NOT in SVG (no `<defs><font>` or font-family refs)
- [ ] Glyphs render with correct shapes (visual inspection)

**Expected SVG snippet**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
  <g id="text-stroke">
    <!-- Each glyph is a path with fill and stroke -->
    <path d="M100,100 Q105,80 110,100 T120,100 Z" 
          fill="#FF0000" stroke="#000000" stroke-width="2"/>
    <path d="M130,100 Q135,80 140,100 T150,100 Z" 
          fill="#FF0000" stroke="#000000" stroke-width="2"/>
  </g>
</svg>
```

### PDF Export Verification

Open the PDF in a text editor (or PDF analyzer) and check:

- [ ] Content stream has **line width operator** (`2 w`)
- [ ] Content stream has **stroke color operator** (`0 0 0 RG` for black)
- [ ] Content stream has **fill color operator** (`1 0 0 rg` for red)
- [ ] Content stream has **fill+stroke operator** (`B` or `b`)
- [ ] **No font references** for custom fonts (all glyphs as paths)
- [ ] Glyph outlines match SVG export (shape consistency)
- [ ] Visual: text appears with colored outline in PDF viewer

**Expected PDF content stream pattern**:
```
q               % save graphics state
2 w             % set line width = 2
0 0 0 RG        % set stroke RGB = black
1 0 0 rg        % set fill RGB = red (decimal: 1=255)
100 700 m       % move to start of glyph
... l/c/etc...  % line/curve commands for glyph shape
B               % fill and stroke the path
Q               % restore graphics state
```

## Font Resolution Chain

### Real Implementation (engine/shells):

1. **User uploads font** (TTF/OTF) via the tool UI
2. **Runtime stores** as `UserAsset` with type `'font'`
3. **During render**, `hooks.js` or template references font by name/id
4. **At export time**, `host.text.toPath()` is called with:
   ```javascript
   {
     text: "Stroked",
     font: { family: "CustomFont", weight: 700, style: "normal" },
     fontSize: 48,
     letterSpacing: 0,
     features: { liga: 1, clig: 1 },
     // ... more options
   }
   ```
5. **HarfBuzz WASM** (in the bridge):
   - Load the custom font file (TTF/OTF bytes)
   - Shape the text with the font
   - Return glyph outlines as SVG path data
6. **Engine/shell convert** glyphs to `<path>` elements with:
   - `fill` = text color
   - `stroke` = stroke color (from CSS)
   - `stroke-width` = stroke width (from CSS)

### Test Mock (tests/text-stroke-export.test.ts):

Simplified mock of HarfBuzz output:
```javascript
function mockTextToPath(options) {
  // Options: { text, font, fontSize, letterSpacing, features }
  // Returns: { glyphs: [...], width, height, baseline }
  return {
    glyphs: [
      { path: "M...", advance: 20, x: 0, y: 0 },
      { path: "M...", advance: 20, x: 20, y: 0 },
      // ... one per glyph
    ],
    width: 40,
    height: 48,
    baseline: 38,
  };
}
```

## Known Issues & Edge Cases

### Handled ✓

- [ ] Stroke opacity: `stroke-opacity="0.5"`
- [ ] Zero stroke width: `stroke-width="0"` (valid but invisible)
- [ ] Multiple text boxes with different strokes (each independent path)
- [ ] Variable fonts (weights 100–900): all work
- [ ] OpenType features: ligatures on/off, stylistic alternates on/off

### Not Yet Handled (future):

- [ ] Stroke line-cap (butt/round/square)
- [ ] Stroke line-join (miter/round/bevel)
- [ ] Stroke dash pattern (stroke-dasharray)
- [ ] Gradient fill on stroked glyphs (currently raster fallback)

## Code References

### Engine (font shaping & export):

- `engine/src/runtime.ts` — hook execution, calls `beforeExport`
- `engine/src/bridge/host-v1.ts` — `host.text.toPath` interface
- `shells/web/src/bridge/text-svg.ts` — HarfBuzz WASM wrapper, `canVectoriseText()`
- `shells/web/src/bridge/font-registry.ts` — font loading and resolution

### Web shell (export pipeline):

- `shells/web/src/bridge/export.ts`:
  - `renderSvgFromHtml()` — converts DOM to SVG with text-as-paths (line 1338–1346 handles stroke)
  - `renderPdf()` — PDF export via pdfkit + custom walker for vectors
  - `convertTextToPaths()` — main text-to-path conversion logic

- `shells/web/src/bridge/svg-ir.ts` — SVG intermediate representation for vector export
- `shells/web/src/bridge/export-css.ts` — CSS value parsing (colors, dimensions)

### CLI shell (headless):

- `shells/cli/src/bridge.ts` — same export bridges, but with jsdom + Playwright/Chromium
- `shells/cli/src/run.ts` — tool render + export orchestration

## Running the Full Test Suite

```bash
# Unit tests (mocked)
npm test tests/text-stroke-export.test.ts

# All engine + shell tests
npm test

# Visual integration (manual browser testing)
npm run dev:web
# → Navigate to Layout Studio, create stroked text, export
```

## Success Criteria

- [ ] **All unit tests pass** (17/17)
- [ ] **SVG export**:
  - No `<text>` elements
  - All glyphs as `<path>` with `fill` + `stroke` attributes
  - Stroke width, color, opacity correct
  - No font family references in SVG
- [ ] **PDF export**:
  - Visual: stroked outline appears in PDF viewer
  - Content stream has stroke operators (w, RG, rg, B)
  - No font subsets embedded (all outlined)
- [ ] **Custom font**:
  - Non-default font shapes glyphs correctly
  - Font file bytes are NOT embedded in vector exports (text-as-paths rule)
  - HarfBuzz shaping respects OpenType features
- [ ] **CLI parity**:
  - `npm run cli -- layout-studio --boxes='...' --export=svg/pdf` produces identical output to web shell

## Test Artifacts

Generated during manual testing:

```
stroke-test.svg          # SVG export with stroke paths
stroke-test.pdf          # PDF export with stroked glyphs
stroke-test-cli.svg      # CLI export (should match web SVG)
stroke-test-cli.pdf      # CLI export (should match web PDF)
```

Compare with:
```bash
diff stroke-test.svg stroke-test-cli.svg       # should be identical
# PDF comparison is visual (use a PDF diff tool or side-by-side viewer)
```

## Automated Regression Test

To add to CI (future):

```bash
# Generate canonical SVG with stroked text from layout-studio
npm run cli -- layout-studio \
  --boxes='[{"id":"t1","kind":"text","x":0,"y":0,"w":200,"h":100,"text":"Test","fg":"#FF0000","fontSize":48,"font":"SUSE","weight":"700","stroke":"#000000","strokeWidth":"2"}]' \
  --export=svg > /tmp/stroke-canonical.svg

# Check for required attributes
grep -q 'fill="#FF0000"' /tmp/stroke-canonical.svg || echo "FAIL: fill color"
grep -q 'stroke="#000000"' /tmp/stroke-canonical.svg || echo "FAIL: stroke color"
grep -q 'stroke-width="2"' /tmp/stroke-canonical.svg || echo "FAIL: stroke width"
! grep -q '<text' /tmp/stroke-canonical.svg || echo "FAIL: embedded <text>"
```

## Related Documentation

- `docs/authoring-tools.md` — tool inputs and manifest format
- `docs/url-mode.md` — URL parameter encoding for tools
- `engine/src/bridge/host-v1.ts` — `host.text.toPath` API
- `plans/vector-output-text-as-paths.md` — text vectorization design
- `tests/text-stroke.test.ts` — DOM/SVG unit tests for stroke rendering

---

**Last Updated**: 2026-07-12  
**Test Suite**: `tests/text-stroke-export.test.ts`  
**Status**: Ready for integration testing (manual + automated)
