/**
 * Animated-SVG core contract tests.
 * Run with: node --test tests/svg-anim.test.ts
 *
 * Exercises the PURE flipbook assembly (namespaceSvgIds + assembleAnimatedSvg) that
 * turns N vector snapshots into one self-contained animated SVG. The DOM sampling
 * (renderSvgFromHtml) lives in the export bridge and isn't testable here; this
 * covers the id-namespacing that prevents cross-frame collisions and the step-end
 * @keyframes flipbook that shows exactly one frame per time slice.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { namespaceSvgIds, assembleAnimatedSvg } from '../shells/web/src/lib/svg-anim-core.ts';

test('namespaceSvgIds prefixes ids and their internal references', () => {
  const inner = '<defs><linearGradient id="svggrad-1"/></defs><rect fill="url(#svggrad-1)"/>';
  const out = namespaceSvgIds(inner, 'f3-');
  assert.match(out, /id="f3-svggrad-1"/);
  assert.match(out, /fill="url\(#f3-svggrad-1\)"/);
  assert.doesNotMatch(out, /url\(#svggrad-1\)/, 'the un-prefixed reference is gone');
});

test('namespaceSvgIds handles quoted url() and href hash refs, leaves data: hrefs alone', () => {
  const inner = '<clipPath id="fcclip-2"/><g clip-path="url(\'#fcclip-2\')"/>'
    + '<use href="#fcclip-2"/><image href="data:image/png;base64,AAAA"/>';
  const out = namespaceSvgIds(inner, 'f0-');
  assert.match(out, /url\('#f0-fcclip-2'\)/);
  assert.match(out, /href="#f0-fcclip-2"/);
  assert.match(out, /href="data:image\/png;base64,AAAA"/, 'data URL untouched');
});

test('two frames stacked have no id collision', () => {
  const frameA = '<linearGradient id="svggrad-1"/><rect fill="url(#svggrad-1)"/>';
  const frameB = '<linearGradient id="svggrad-1"/><rect fill="url(#svggrad-1)"/>';
  const svg = assembleAnimatedSvg({
    frames: [frameA, frameB], widthAttr: '100px', heightAttr: '100px', viewBox: '0 0 100 100',
    frameMs: 100, loops: 0,
  });
  const ids = [...svg.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids, ['f0-svggrad-1', 'f1-svggrad-1'], 'ids are unique per frame');
});

test('flipbook: one layer + one keyframes block per frame, infinite by default', () => {
  const svg = assembleAnimatedSvg({
    frames: ['<rect/>', '<rect/>', '<rect/>'], widthAttr: '10px', heightAttr: '10px', viewBox: '0 0 10 10',
    frameMs: 100, loops: 0,
  });
  assert.equal([...svg.matchAll(/class="laf laf-\d+"/g)].length, 3);
  assert.equal([...svg.matchAll(/@keyframes la\d+\{/g)].length, 3);
  // 3 frames × 100ms = 300ms cycle, infinite.
  assert.match(svg, /animation:300ms step-end infinite both/);
  // step-end hard cuts: frame 0 starts visible, first cut at 33.3333%.
  assert.match(svg, /@keyframes la0\{0%\{opacity:1\}33\.3333%\{opacity:0\}\}/);
  // Middle frame visible only in its slice.
  assert.match(svg, /@keyframes la1\{0%\{opacity:0\}33\.3333%\{opacity:1\}66\.6667%\{opacity:0\}\}/);
  // Last frame stays on at the end (no closing 0 stop; fill-mode holds it).
  assert.match(svg, /@keyframes la2\{0%\{opacity:0\}66\.6667%\{opacity:1\}\}/);
});

test('finite loop count is emitted verbatim', () => {
  const svg = assembleAnimatedSvg({
    frames: ['<rect/>', '<rect/>'], widthAttr: '10px', heightAttr: '10px', viewBox: '0 0 10 10',
    frameMs: 50, loops: 3,
  });
  assert.match(svg, /animation:100ms step-end 3 both/);
});

test('a single frame produces a static SVG with no animation', () => {
  const svg = assembleAnimatedSvg({
    frames: ['<rect/>'], widthAttr: '10px', heightAttr: '10px', viewBox: '0 0 10 10',
    frameMs: 100, loops: 0,
  });
  assert.doesNotMatch(svg, /<style>/);
  assert.doesNotMatch(svg, /@keyframes/);
  assert.match(svg, /class="laf laf-0"/);
});

test('provenance meta becomes a comment and a dc:description', () => {
  const svg = assembleAnimatedSvg({
    frames: ['<rect/>', '<rect/>'], widthAttr: '10px', heightAttr: '10px', viewBox: '0 0 10 10',
    frameMs: 100, loops: 0, meta: { description: 'Made with Lolly', source: 'lolly' },
  });
  assert.match(svg, /<!-- Made with Lolly · lolly -->/);
  assert.match(svg, /<dc:description>Made with Lolly · lolly<\/dc:description>/);
});
