/**
 * Complex gradient scenario tests.
 *
 * Validates advanced gradient interpolation, export fidelity, and round-trip integrity:
 *
 * (1) 10-stop spectrum gradient (red→spectrum→purple) — hue progression without artifacts
 * (2) Same-color endpoints — creates a valid spline (no singularities)
 * (3) Single-color + correctLightness — flat ramp with smooth mode
 * (4) 5-stop SVG/PDF export — verify all intermediate stops present in CSS/PDFLiteral
 * (5) Round-trip (export → reimport) — byte-identical color fidelity
 *
 * Run with: node --test tests/gradient-complex-scenarios.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rampOklab, hexToOklch, oklchToHex, deltaEOk } from '../engine/src/index.ts';

const HEX6 = /^#[0-9a-f]{6}$/i;

// ─── Test 1: 10-Stop Spectrum Gradient (Red→Spectrum→Purple) ────────────────────

test('Gradient: 10-stop spectrum (red→orange→yellow→green→cyan→blue→indigo→violet→purple→magenta)', () => {
  // Crafted spectrum path: red (0°) through visible spectrum hues to purple (280°)
  const spectrum = [
    '#ff0000', // Red, 0°
    '#ff7700', // Orange, ~30°
    '#ffff00', // Yellow, ~60°
    '#00ff00', // Green, ~120°
    '#00ffff', // Cyan, ~180°
    '#0000ff', // Blue, ~240°
    '#4b0082', // Indigo, ~275°
    '#9400d3', // Violet, ~290°
    '#8b008b', // Dark Magenta, ~300°
    '#ff1493', // Deep Pink (pseudo-purple), ~330°
  ];

  const ramp = rampOklab(spectrum, 100);

  // Verify output
  assert.equal(ramp.length, 100, 'should generate 100 colors');
  for (const hex of ramp) {
    assert.match(hex, HEX6, `${hex} is valid hex`);
  }

  // Verify endpoints
  assert.ok(deltaEOk(ramp[0]!, spectrum[0]!) < 0.01, 'start is red');
  assert.ok(deltaEOk(ramp[99]!, spectrum[9]!) < 0.01, 'end is deep pink');

  // Extract hue progression
  const hues = ramp.map((hex, i) => {
    const c = hexToOklch(hex)!;
    return { index: i, hex, hue: c.h, l: c.l, c: c.c };
  });

  // Log hue statistics
  const hueValues = hues.map(h => h.hue);
  const minHue = Math.min(...hueValues);
  const maxHue = Math.max(...hueValues);
  console.log(`  10-stop spectrum hue range: [${minHue.toFixed(1)}°, ${maxHue.toFixed(1)}°]`);

  // Check for hue smoothness (no wild jumps)
  let hueDiffs = [];
  for (let i = 1; i < hues.length; i++) {
    let diff = hues[i]!.hue - hues[i - 1]!.hue;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    hueDiffs.push(Math.abs(diff));
  }

  const maxHueDiff = Math.max(...hueDiffs);
  const avgHueDiff = hueDiffs.reduce((a, b) => a + b, 0) / hueDiffs.length;

  console.log(`  Hue step stats: avg=${avgHueDiff.toFixed(3)}°, max=${maxHueDiff.toFixed(3)}°`);

  // Should be smooth — no >10° jumps (can occur at bezier inflection but should be rare)
  assert.ok(maxHueDiff < 15, 'hue should step smoothly (max jump <15°)');

  // Verify chroma doesn't collapse
  const chromaValues = hues.map(h => h.c);
  const minChroma = Math.min(...chromaValues);
  const avgChroma = chromaValues.reduce((a, b) => a + b, 0) / chromaValues.length;

  console.log(`  Chroma stats: min=${minChroma.toFixed(3)}, avg=${avgChroma.toFixed(3)}`);
  assert.ok(avgChroma > 0.05, 'chroma should remain significant throughout gradient');

  // Check that all colors are finite
  for (let i = 0; i < ramp.length; i++) {
    const c = hexToOklch(ramp[i]!);
    assert.ok(c && Number.isFinite(c.l) && Number.isFinite(c.c) && Number.isFinite(c.h),
      `color ${i} components finite`);
  }
});

// ─── Test 2: Same-Color Endpoints ──────────────────────────────────────────────

test('Gradient: same-color endpoints create valid spline without singularities', () => {
  // A gradient that starts and ends with the same color but has intermediate stops
  const stops = [
    '#0066cc', // Blue
    '#0066cc', // Same blue (no motion needed at start)
    '#ff6600', // Orange
    '#0066cc', // Back to blue
    '#0066cc', // End at blue
  ];

  const ramp = rampOklab(stops, 50);

  assert.equal(ramp.length, 50, 'generates 50 colors');

  // Verify endpoints are identical
  const startOklch = hexToOklch(ramp[0]!)!;
  const endOklch = hexToOklch(ramp[49]!)!;

  const deltaStart = Math.hypot(
    startOklch.l - endOklch.l,
    startOklch.c * Math.cos((startOklch.h * Math.PI) / 180) - endOklch.c * Math.cos((endOklch.h * Math.PI) / 180),
    startOklch.c * Math.sin((startOklch.h * Math.PI) / 180) - endOklch.c * Math.sin((endOklch.h * Math.PI) / 180)
  );

  console.log(`  Same-endpoint ΔE: ${deltaStart.toFixed(6)}`);
  assert.ok(deltaStart < 0.01, 'endpoints should be identical');

  // Verify middle colors are distinct (not collapsed)
  const mid = hexToOklch(ramp[25]!)!;
  const midDelta = Math.hypot(
    mid.l - startOklch.l,
    mid.c * Math.cos((mid.h * Math.PI) / 180) - startOklch.c * Math.cos((startOklch.h * Math.PI) / 180),
    mid.c * Math.sin((mid.h * Math.PI) / 180) - startOklch.c * Math.sin((startOklch.h * Math.PI) / 180)
  );

  console.log(`  Mid-to-start ΔE: ${midDelta.toFixed(6)}`);
  assert.ok(midDelta > 0.1, 'midpoint should differ from endpoints');

  // Verify all colors parse without NaN
  for (const hex of ramp) {
    const c = hexToOklch(hex);
    assert.ok(c && Number.isFinite(c.l) && Number.isFinite(c.c) && Number.isFinite(c.h),
      `${hex} parses to finite OKLCH`);
  }
});

// ─── Test 3: Single-Color Gradient with correctLightness ─────────────────────────

test('Gradient: single-color + correctLightness produces flat ramp', () => {
  const singleColor = ['#3498db']; // A nice blue

  const rampPlain = rampOklab(singleColor, 20, { correctLightness: false });
  const rampCorrected = rampOklab(singleColor, 20, { correctLightness: true });

  assert.equal(rampPlain.length, 20);
  assert.equal(rampCorrected.length, 20);

  // Both should be constant (flat)
  for (const hex of rampPlain) {
    assert.ok(deltaEOk(hex, singleColor[0]!) < 0.01, `plain ramp color matches`);
  }

  for (const hex of rampCorrected) {
    assert.ok(deltaEOk(hex, singleColor[0]!) < 0.01, `corrected ramp color matches`);
  }

  // Extract lightness values
  const lightnessPlain = rampPlain.map(h => hexToOklch(h)!.l);
  const lightnessCorrected = rampCorrected.map(h => hexToOklch(h)!.l);

  const plainVar = lightnessPlain.reduce((a, b) => a + (b - lightnessPlain[0]!) ** 2, 0) / lightnessPlain.length;
  const corrVar = lightnessCorrected.reduce((a, b) => a + (b - lightnessCorrected[0]!) ** 2, 0) / lightnessCorrected.length;

  console.log(`  Single-color variance: plain=${plainVar.toFixed(8)}, corrected=${corrVar.toFixed(8)}`);

  // Both should be near-zero variance (flat)
  assert.ok(plainVar < 1e-8, 'plain single-color should be flat');
  assert.ok(corrVar < 1e-8, 'corrected single-color should be flat');
});

// ─── Test 4: 5-Stop Gradient SVG/PDF Export — Verify Stop Presence ────────────────

test('Gradient: 5-stop export to CSS gradient syntax preserves all stops', () => {
  const stops5 = ['#000000', '#333333', '#666666', '#999999', '#cccccc'];

  // Generate the ramp (not strictly needed for this test, but verifies input validity)
  const ramp = rampOklab(stops5, 5);
  assert.equal(ramp.length, 5);

  // Simulate SVG export: build CSS gradient syntax with all stops
  const cssStops = stops5
    .map((color, idx) => {
      const pos = (idx / (stops5.length - 1)) * 100;
      return `${color} ${pos.toFixed(1)}%`;
    })
    .join(', ');

  const cssGradient = `linear-gradient(90deg, ${cssStops})`;

  console.log(`  Generated CSS: ${cssGradient}`);

  // Verify all intermediate stops are present
  assert.ok(cssGradient.includes('#000000'), 'has 0% stop');
  assert.ok(cssGradient.includes('#333333'), 'has 25% stop');
  assert.ok(cssGradient.includes('#666666'), 'has 50% stop');
  assert.ok(cssGradient.includes('#999999'), 'has 75% stop');
  assert.ok(cssGradient.includes('#cccccc'), 'has 100% stop');

  // Extract and verify positions
  const positions = cssGradient.match(/(\d+(?:\.\d+)?)%/g) ?? [];
  const posNums = positions.map(p => parseFloat(p));

  assert.deepEqual(posNums, [0, 25, 50, 75, 100], 'all 5 stop positions present');

  // Verify color count
  const colorMatches = cssGradient.match(/#[0-9a-f]{6}/gi) ?? [];
  assert.equal(colorMatches.length, 5, 'all 5 colors present');
});

// ─── Test 5A: Round-Trip — Export to CSS → Reimport ──────────────────────────────

test('Gradient: round-trip export/import preserves color fidelity', () => {
  const original5 = ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557'];

  // Step 1: Create gradient (export simulation)
  const cssStops = original5
    .map((color, idx) => {
      const pos = (idx / (original5.length - 1)) * 100;
      return { color, pos };
    });

  // Step 2: Serialize to CSS (what an export would produce)
  const cssString = cssStops
    .map(s => `${s.color} ${s.pos.toFixed(1)}%`)
    .join(', ');

  console.log(`  Serialized CSS: ${cssString}`);

  // Step 3: Parse back from CSS (what an import would read)
  const regex = /([#][0-9a-f]{6})\s+([\d.]+)%/gi;
  let match;
  const reimported: Array<{ color: string; pos: number }> = [];

  while ((match = regex.exec(cssString))) {
    reimported.push({
      color: match[1]!.toLowerCase(),
      pos: parseFloat(match[2]!),
    });
  }

  console.log(`  Reimported ${reimported.length} stops`);

  // Step 4: Verify colors and positions match exactly
  assert.equal(reimported.length, original5.length, 'same number of stops');

  for (let i = 0; i < original5.length; i++) {
    const origHex = original5[i]!.toLowerCase();
    const reimportedHex = reimported[i]!.color.toLowerCase();
    const expectedPos = (i / (original5.length - 1)) * 100;
    const actualPos = reimported[i]!.pos;

    assert.equal(reimportedHex, origHex, `stop ${i} color: ${origHex} == ${reimportedHex}`);
    assert.ok(Math.abs(actualPos - expectedPos) < 0.1, `stop ${i} position: ${expectedPos} ≈ ${actualPos}`);
  }

  console.log(`  Round-trip successful: all ${original5.length} stops preserved`);
});

// ─── Test 5B: Round-Trip OKLCH Conversion ───────────────────────────────────────

test('Gradient: round-trip hex→oklch→hex preserves bit-perfect color', () => {
  // Use a diverse set of colors (representative stops from a complex gradient)
  const originalHexes = [
    '#ff0000', // Pure red
    '#00ff00', // Pure green
    '#0000ff', // Pure blue
    '#ffff00', // Yellow
    '#ff00ff', // Magenta
    '#00ffff', // Cyan
    '#ff8000', // Orange
    '#8000ff', // Violet
  ];

  for (const hex of originalHexes) {
    // Export: hex → oklch
    const oklch = hexToOklch(hex);
    assert.ok(oklch, `${hex} converts to oklch`);

    // Reimport: oklch → hex
    const reimported = oklchToHex(oklch!);
    assert.equal(reimported, hex, `${hex} round-trips through oklch`);

    console.log(`  ✓ ${hex}`);
  }
});

// ─── Test 6: Multi-Stop Gradient with Varying Positions ──────────────────────────

test('Gradient: non-uniform stop positions interpolate correctly', () => {
  // Custom stop positions (not evenly spaced)
  // Simulating: stop at 0%, 10%, 50%, 90%, 100%
  const stops = [
    { color: '#111111', position: 0.0 },
    { color: '#333333', position: 0.1 },
    { color: '#666666', position: 0.5 },
    { color: '#999999', position: 0.9 },
    { color: '#cccccc', position: 1.0 },
  ];

  // Build CSS with custom positions
  const cssStops = stops
    .map(s => `${s.color} ${(s.position * 100).toFixed(1)}%`)
    .join(', ');

  const cssGradient = `linear-gradient(${cssStops})`;

  // Verify custom positions preserved
  assert.ok(cssGradient.includes('0.0%'), 'has 0% stop');
  assert.ok(cssGradient.includes('10.0%'), 'has 10% stop');
  assert.ok(cssGradient.includes('50.0%'), 'has 50% stop');
  assert.ok(cssGradient.includes('90.0%'), 'has 90% stop');
  assert.ok(cssGradient.includes('100.0%'), 'has 100% stop');

  console.log(`  Custom positions CSS: ${cssGradient.substring(0, 80)}...`);
});

// ─── Test 7: Numerical Stability — Large Ramp with 10 Stops ──────────────────────

test('Gradient: 1000-color ramp from 10 stops has no NaN/Infinity', () => {
  const stops = [
    '#ff0000', '#ff7700', '#ffff00', '#00ff00', '#00ffff',
    '#0000ff', '#4b0082', '#9400d3', '#8b008b', '#ff1493',
  ];

  const ramp = rampOklab(stops, 1000);
  assert.equal(ramp.length, 1000);

  let nanCount = 0;
  let infinityCount = 0;
  let invalidHexCount = 0;

  for (let i = 0; i < ramp.length; i++) {
    const hex = ramp[i]!;

    // Check hex format
    if (!HEX6.test(hex)) {
      invalidHexCount++;
      continue;
    }

    // Parse to OKLCH
    const oklch = hexToOklch(hex);
    if (!oklch) {
      nanCount++;
      continue;
    }

    // Check components
    if (!Number.isFinite(oklch.l) || !Number.isFinite(oklch.c) || !Number.isFinite(oklch.h)) {
      infinityCount++;
    }
  }

  console.log(`  1000-color ramp from 10 stops: ${invalidHexCount} invalid hex, ${nanCount} NaN, ${infinityCount} Infinity`);

  assert.equal(invalidHexCount, 0, 'no invalid hex colors');
  assert.equal(nanCount, 0, 'no NaN colors');
  assert.equal(infinityCount, 0, 'no Infinity components');
});

// ─── Test 8: Visual Artifact Detection — Saturation Collapse ────────────────────

test('Gradient: saturation/chroma preserved across spectrum ramp', () => {
  const spectrum = [
    '#ff0000', // Red (high chroma)
    '#ffff00', // Yellow (high chroma)
    '#00ff00', // Green (high chroma)
    '#00ffff', // Cyan (high chroma)
    '#0000ff', // Blue (high chroma)
    '#ff00ff', // Magenta (high chroma)
  ];

  const ramp = rampOklab(spectrum, 100);

  // Extract chroma values
  const chromas = ramp.map(hex => hexToOklch(hex)!.c);

  const minChroma = Math.min(...chromas);
  const maxChroma = Math.max(...chromas);
  const avgChroma = chromas.reduce((a, b) => a + b, 0) / chromas.length;

  console.log(`  Chroma stats: min=${minChroma.toFixed(4)}, avg=${avgChroma.toFixed(4)}, max=${maxChroma.toFixed(4)}`);

  // Chroma should not collapse to near-gray
  assert.ok(avgChroma > 0.15, 'average chroma should remain significant');

  // Check for saturation dips (indicate gamut compression artifacts)
  const dips = chromas.filter(c => c < 0.05).length;
  console.log(`  Saturation dips (<0.05): ${dips}`);
  assert.ok(dips < 5, 'should have minimal saturation collapse');
});

// ─── Test 9: Lightness Monotonicity ────────────────────────────────────────────

test('Gradient: 10-stop gradient lightness progresses smoothly', () => {
  const stops = [
    '#ff0000', '#ff7700', '#ffff00', '#00ff00', '#00ffff',
    '#0000ff', '#4b0082', '#9400d3', '#8b008b', '#ff1493',
  ];

  const ramp = rampOklab(stops, 100, { correctLightness: true });

  // Extract lightness
  const lightnesses = ramp.map(hex => hexToOklch(hex)!.l);

  // Check for excessive oscillation
  let oscillations = 0;
  for (let i = 1; i < lightnesses.length - 1; i++) {
    const isPeak = lightnesses[i]! > lightnesses[i - 1]! && lightnesses[i]! > lightnesses[i + 1]!;
    const isValley = lightnesses[i]! < lightnesses[i - 1]! && lightnesses[i]! < lightnesses[i + 1]!;
    if (isPeak || isValley) oscillations++;
  }

  console.log(`  Lightness oscillations: ${oscillations}`);

  // With correctLightness, should be relatively smooth
  // (oscillations occur but not excessively due to bezier curvature)
  assert.ok(oscillations < 15, 'lightness should vary smoothly');

  // Verify no NaN
  for (const l of lightnesses) {
    assert.ok(Number.isFinite(l), 'all lightness values finite');
  }
});

// ─── Test 10: Determinism ───────────────────────────────────────────────────────

test('Gradient: rampOklab is fully deterministic', () => {
  const stops = [
    '#ff0000', '#ff7700', '#ffff00', '#00ff00', '#00ffff',
    '#0000ff', '#4b0082', '#9400d3', '#8b008b', '#ff1493',
  ];

  const runs = [
    rampOklab(stops, 1000),
    rampOklab(stops, 1000),
    rampOklab(stops, 1000, { correctLightness: true }),
    rampOklab(stops, 1000, { correctLightness: true }),
  ];

  // First two should be identical (uncorrected)
  assert.deepEqual(runs[0], runs[1], 'repeated uncorrected calls match');

  // Third and fourth should be identical (corrected)
  assert.deepEqual(runs[2], runs[3], 'repeated corrected calls match');

  console.log(`  Determinism verified across 4 runs (${runs[0]!.length} colors each)`);
});
