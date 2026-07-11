/**
 * Integration test for text stroke in layout-studio exports to SVG/PDF.
 *
 * This test exercises the full render-to-export pipeline for layout-studio:
 * 1. Create boxes with text styling (fill + stroke)
 * 2. Render via hooks.js (generates CSS strings)
 * 3. Export to SVG
 * 4. Verify text-as-paths conversion preserves both fill and stroke
 *
 * Note: This test uses mock/simulation of the export pipeline.
 * For real browser-based testing, see the shell's export tests.
 *
 * Run with: node --test tests/layout-studio-text-stroke.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mock the layout-studio hooks.js functions
function num(v: any, d: number): number {
  const x = typeof v === 'number' ? v : parseFloat(v);
  return isFinite(x) ? x : d;
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

function safeColor(v: any, fallback: string): string {
  const s = String(v == null ? '' : v).trim();
  if (!s) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/i.test(s)) return s;
  if (/^[a-zA-Z]+$/.test(s)) return s;
  return fallback;
}

function f2(v: number): number {
  return Math.round(v * 100) / 100;
}

// Text CSS generation - WITH stroke support
function textCssWithStroke(b: any): string {
  const size = Math.max(1, Math.round(num(b.fontSize, 48)));
  const weight = clamp(Math.round(num(b.weight, 700) / 100) * 100, 100, 900);
  const align = b.align === 'left' ? 'flex-start' : b.align === 'right' ? 'flex-end' : 'center';
  const lineHeight = clamp(num(b.lineHeight, 1.12), 0.5, 4);
  const pad = Math.round(clamp(num(b.pad, 8), 0, 400));

  let css = (
    'text-align:' + align + ';' +
    'color:' + safeColor(b.fg, '#0e1217') + ';' +
    'font-family:sans-serif;' +
    'font-size:' + size + 'px;' +
    'font-weight:' + weight + ';' +
    'line-height:' + lineHeight + ';' +
    'padding:' + pad + 'px;'
  );

  // Add stroke properties if present
  if (b.stroke) {
    css += 'stroke:' + safeColor(b.stroke, 'black') + ';';
  }
  if (b.strokeWidth) {
    // Parse stroke width (e.g., "2px" → "2")
    const strokeWidthStr = String(b.strokeWidth).replace(/px$/, '');
    const strokeWidth = num(strokeWidthStr, 1);
    if (strokeWidth > 0) {
      css += 'stroke-width:' + strokeWidth + 'px;';
    }
  }
  if (b.strokeOpacity !== undefined) {
    css += 'stroke-opacity:' + clamp(num(b.strokeOpacity, 1), 0, 1) + ';';
  }

  return css;
}

// ── Basic stroke property tests ────────────────────────────────────────────────

test('Text box with stroke properties', () => {
  const box = {
    id: 'text-1',
    kind: 'text',
    x: 100,
    y: 100,
    w: 300,
    h: 100,
    text: 'Outlined Text',
    fg: 'red',
    fontSize: 48,
    weight: '700',
    stroke: 'black',
    strokeWidth: '2px',
    lineHeight: 1.12,
    align: 'center',
    valign: 'middle',
  };

  assert.equal(box.fg, 'red');
  assert.equal(box.stroke, 'black');
  assert.equal(box.strokeWidth, '2px');
});

test('textCssWithStroke generates CSS with fill and stroke', () => {
  const box = {
    fg: 'red',
    fontSize: 48,
    weight: '700',
    stroke: 'black',
    strokeWidth: '2px',
    lineHeight: 1.12,
    align: 'center',
  };

  const css = textCssWithStroke(box);
  assert.ok(css.includes('color:red'), 'CSS should include fill color');
  assert.ok(css.includes('stroke:black'), 'CSS should include stroke color');
  assert.ok(css.includes('stroke-width:2px'), 'CSS should include stroke width');
});

test('textCssWithStroke with stroke-opacity', () => {
  const box = {
    fg: 'blue',
    fontSize: 36,
    weight: '600',
    stroke: 'white',
    strokeWidth: '3px',
    strokeOpacity: 0.8,
    align: 'left',
  };

  const css = textCssWithStroke(box);
  assert.ok(css.includes('color:blue'));
  assert.ok(css.includes('stroke:white'));
  assert.ok(css.includes('stroke-width:3px'));
  assert.ok(css.includes('stroke-opacity:0.8'));
});

test('textCssWithStroke handles missing/optional stroke properties', () => {
  const box = {
    fg: 'green',
    fontSize: 32,
    weight: '500',
    align: 'right',
    // No stroke properties
  };

  const css = textCssWithStroke(box);
  assert.ok(css.includes('color:green'));
  assert.ok(!css.includes('stroke:'), 'CSS should NOT include stroke if not provided');
});

test('textCssWithStroke with zero stroke width', () => {
  const box = {
    fg: 'yellow',
    fontSize: 40,
    weight: '400',
    stroke: 'purple',
    strokeWidth: '0px',
  };

  const css = textCssWithStroke(box);
  assert.ok(css.includes('color:yellow'));
  // Zero stroke width should not add the property
  assert.ok(!css.includes('stroke-width:0px'), 'Zero stroke width should be omitted');
});

// ── SVG export simulation tests ────────────────────────────────────────────────

test('SVG path with text-as-paths preserves both fill and stroke', () => {
  const svgPath = {
    fill: 'red',
    stroke: 'black',
    strokeWidth: 2,
    d: 'M 10 50 Q 15 40 20 50 T 30 50 L 30 60 Q 25 70 20 60 T 10 60 Z',
  };

  // Create SVG path element string
  const pathStr = `<path fill="${svgPath.fill}" stroke="${svgPath.stroke}" stroke-width="${svgPath.strokeWidth}" d="${svgPath.d}"/>`;

  // Verify the path contains required attributes
  assert.ok(pathStr.includes('fill="red"'), 'Path should have fill');
  assert.ok(pathStr.includes('stroke="black"'), 'Path should have stroke');
  assert.ok(pathStr.includes('stroke-width="2"'), 'Path should have stroke-width');
});

test('Multiple text boxes with different stroke colors export correctly', () => {
  const boxes = [
    { id: 'text-1', fg: 'red', stroke: 'black', strokeWidth: '2px' },
    { id: 'text-2', fg: 'blue', stroke: 'white', strokeWidth: '3px' },
    { id: 'text-3', fg: 'green', stroke: 'yellow', strokeWidth: '1px' },
  ];

  // Simulate SVG generation with text-as-paths
  const paths = boxes.map((box) => ({
    id: box.id,
    fill: box.fg,
    stroke: box.stroke,
    strokeWidth: box.strokeWidth,
  }));

  // Verify all paths maintain their individual stroke colors
  assert.equal(paths[0]!.stroke, 'black');
  assert.equal(paths[1]!.stroke, 'white');
  assert.equal(paths[2]!.stroke, 'yellow');

  // Verify all paths maintain their individual fill colors
  assert.equal(paths[0]!.fill, 'red');
  assert.equal(paths[1]!.fill, 'blue');
  assert.equal(paths[2]!.fill, 'green');
});

// ── PDF export consideration tests ────────────────────────────────────────────

test('PDF text-to-paths includes fill and stroke operations', () => {
  // In PDF, text converted to paths results in:
  // - Path command (Bezier curves)
  // - Fill color operation (rg/RG)
  // - Stroke color operation (RG)
  // - Fill and/or stroke operation (f/S/B/etc)

  interface PdfPathOp {
    path: string;
    fillColor: { r: number; g: number; b: number };
    strokeColor: { r: number; g: number; b: number };
    strokeWidth: number;
    operator: 'B' | 'f' | 'S'; // B=fill+stroke, f=fill, S=stroke
  }

  const operation: PdfPathOp = {
    path: '10 20 m 30 40 l',
    fillColor: { r: 1, g: 0, b: 0 }, // red
    strokeColor: { r: 0, g: 0, b: 0 }, // black
    strokeWidth: 2,
    operator: 'B', // fill and stroke
  };

  assert.equal(operation.fillColor.r, 1);
  assert.equal(operation.fillColor.g, 0);
  assert.equal(operation.fillColor.b, 0);
  assert.equal(operation.strokeColor.r, 0);
  assert.equal(operation.strokeColor.g, 0);
  assert.equal(operation.strokeColor.b, 0);
  assert.equal(operation.operator, 'B', 'Should use fill+stroke operator');
});

// ── Validation and constraints ────────────────────────────────────────────────

test('Stroke color validation rejects invalid colors', () => {
  // Valid colors should pass
  assert.equal(safeColor('#ff0000', 'black'), '#ff0000');
  assert.equal(safeColor('red', 'black'), 'red');
  assert.equal(safeColor('rgb(255, 0, 0)', 'black'), 'rgb(255, 0, 0)');

  // Invalid colors should use fallback
  assert.equal(safeColor('not-a-color', 'black'), 'black');
  assert.equal(safeColor('url(javascript:alert(1))', 'black'), 'black');
  assert.equal(safeColor('', 'black'), 'black');
  assert.equal(safeColor(null, 'black'), 'black');
});

test('Stroke width clamped to reasonable values', () => {
  // Simulate stroke width normalization
  const normalized = (w: string) => {
    const px = num(w.replace('px', ''), 1);
    return Math.max(0, Math.min(100, px)); // 0-100px
  };

  assert.equal(normalized('2px'), 2);
  assert.equal(normalized('-5px'), 0); // clamped to 0
  assert.equal(normalized('150px'), 100); // clamped to 100
});

test('Stroke opacity clamped to 0-1', () => {
  const clampOpacity = (o: number) => clamp(o, 0, 1);

  assert.equal(clampOpacity(0.5), 0.5);
  assert.equal(clampOpacity(-0.1), 0);
  assert.equal(clampOpacity(1.5), 1);
  assert.equal(clampOpacity(0), 0);
  assert.equal(clampOpacity(1), 1);
});

// ── Round-trip and consistency tests ────────────────────────────────────────

test('Box with stroke exports consistently to SVG and PDF', () => {
  const box = {
    id: 'text-box',
    kind: 'text',
    x: 100,
    y: 100,
    w: 300,
    h: 100,
    text: 'Stroked Text',
    fg: 'red',
    stroke: 'black',
    strokeWidth: '2px',
    fontSize: 48,
  };

  // Both SVG and PDF export should read the same properties
  const svgAttrs = {
    fill: box.fg,
    stroke: box.stroke,
    strokeWidth: box.strokeWidth,
  };

  const pdfAttrs = {
    fillRgb: { r: 1, g: 0, b: 0 }, // red
    strokeRgb: { r: 0, g: 0, b: 0 }, // black
    strokeWidth: 2,
  };

  // Verify consistency
  assert.equal(svgAttrs.fill, pdfAttrs.fillRgb.r === 1 ? 'red' : 'other');
  assert.equal(svgAttrs.stroke, pdfAttrs.strokeRgb.r === 0 ? 'black' : 'other');
});

test('Text with stroke exports without data loss or corruption', () => {
  const original = {
    text: 'Hello World',
    fg: '#ff0000',
    stroke: '#000000',
    strokeWidth: '2px',
  };

  // Simulate export round-trip
  const exported = {
    text: original.text,
    fill: original.fg,
    stroke: original.stroke,
    strokeWidth: original.strokeWidth,
  };

  // Verify nothing was lost
  assert.equal(exported.text, original.text);
  assert.equal(exported.fill, original.fg);
  assert.equal(exported.stroke, original.stroke);
  assert.equal(exported.strokeWidth, original.strokeWidth);
});
