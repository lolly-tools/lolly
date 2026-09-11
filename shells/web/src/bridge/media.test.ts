// SPDX-License-Identifier: MPL-2.0
/**
 * media.ts - tests for the PURE exported helpers only.
 *
 * `stampComputedTransforms` is the commitStyles bypass behind the anim frame
 * source: commitStyles is known-flaky for `transform` on SVG targets (transform
 * is a presentation attribute there - Chrome can refuse the commit), and the
 * field symptom was a mark whose hue keyframes animated while its rotate
 * keyframes froze (Andy, 2026-08-10, repo-root icon.svg). The helper copies each
 * animated target's RESOLVED matrix (+ origin/box) onto the corresponding node
 * of a structural clone, mapped purely by tree order.
 *
 * Driven with fake elements (tree order + identity + style.setProperty are the
 * whole contract) so the test needs no jsdom CSS support and cannot pass
 * vacuously through a css shim. NOT covered here (needs a real browser): the
 * bake loop itself - getAnimations/commitStyles/getComputedStyle over a live
 * SVG - and the ImageDecoder/video grab paths. Real-browser check: play the
 * animated icon through a filter and confirm the ROTATION animates, not just
 * the hue shift.
 *
 * Run directly:  node --test shells/web/src/bridge/media.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stampComputedTransforms, sniffRasterMime } from './media.ts';

// ── fake element tree (tree order + identity + a recording style) ────────────
interface FakeEl {
  name: string;
  children: FakeEl[];
  style: { props: Record<string, string>; setProperty(k: string, v: string): void };
  querySelectorAll(sel: string): FakeEl[];
}

function el(name: string, children: FakeEl[] = []): FakeEl {
  const node: FakeEl = {
    name,
    children,
    style: {
      props: {},
      setProperty(k: string, v: string) { this.props[k] = v; },
    },
    // Depth-first preorder over descendants - the same document order a real
    // querySelectorAll('*') walks.
    querySelectorAll: () => {
      const out: FakeEl[] = [];
      const walk = (n: FakeEl): void => { for (const c of n.children) { out.push(c); walk(c); } };
      walk(node);
      return out;
    },
  };
  return node;
}

const asEls = (n: FakeEl): Element => n as unknown as Element;

/** Two structurally identical trees (src and its "clone"). */
function twinTrees() {
  const src = el('svg', [el('g', [el('path'), el('path')]), el('g', [el('circle')])]);
  const clone = el('svg', [el('g', [el('path'), el('path')]), el('g', [el('circle')])]);
  return { src, clone };
}

test('stamps the resolved matrix (+ origin/box) onto the tree-order twin of each target', () => {
  const { src, clone } = twinTrees();
  const target = src.children[1]!; // second <g> - index 4 in [root, ...descendants]
  const styles = new Map<FakeEl, { transform: string; transformOrigin: string; transformBox: string }>([
    [target, { transform: 'matrix(0, 1, -1, 0, 0, 0)', transformOrigin: '64px 64px', transformBox: 'fill-box' }],
  ]);
  stampComputedTransforms(asEls(src), asEls(clone), [asEls(target)],
    (e) => styles.get(e as unknown as FakeEl) ?? { transform: 'none', transformOrigin: '', transformBox: '' });

  const twin = clone.children[1]!;
  assert.equal(twin.style.props.transform, 'matrix(0, 1, -1, 0, 0, 0)');
  assert.equal(twin.style.props['transform-origin'], '64px 64px');
  assert.equal(twin.style.props['transform-box'], 'fill-box');
  // Nothing else was touched - the stamp is target-exact, not tree-wide.
  const others = [clone, clone.children[0]!, ...clone.children[0]!.children, ...twin.children];
  for (const o of others) assert.deepEqual(o.style.props, {}, `${o.name} untouched`);
});

test('the root itself can be a target (index 0), e.g. a whole-mark spin', () => {
  const { src, clone } = twinTrees();
  stampComputedTransforms(asEls(src), asEls(clone), [asEls(src)],
    () => ({ transform: 'rotate(90deg)', transformOrigin: '50% 50%', transformBox: 'view-box' }));
  assert.equal(clone.style.props.transform, 'rotate(90deg)');
});

test("transform:'none', out-of-subtree targets and duplicates are all skipped safely", () => {
  const { src, clone } = twinTrees();
  const inside = src.children[0]!.children[0]!;
  const outside = el('div'); // not in the src tree at all
  let reads = 0;
  stampComputedTransforms(asEls(src), asEls(clone), [asEls(inside), asEls(inside), asEls(outside)],
    (e) => {
      reads++;
      return e === asEls(inside)
        ? { transform: 'none', transformOrigin: '0px 0px', transformBox: '' }
        : { transform: 'matrix(1,0,0,1,9,9)', transformOrigin: '', transformBox: '' };
    });
  // 'none' → nothing stamped anywhere; duplicate target read once; outside target never maps.
  assert.equal(reads, 1, 'duplicate targets are read once; unmapped targets are never read');
  const all = [clone, ...clone.querySelectorAll('*')];
  for (const o of all) assert.deepEqual(o.style.props, {});
});

test('empty origin/box are not stamped (only what the style resolver returned)', () => {
  const { src, clone } = twinTrees();
  const target = src.children[0]!;
  stampComputedTransforms(asEls(src), asEls(clone), [asEls(target)],
    () => ({ transform: 'matrix(2,0,0,2,0,0)', transformOrigin: '', transformBox: '' }));
  const twin = clone.children[0]!;
  assert.deepEqual(twin.style.props, { transform: 'matrix(2,0,0,2,0,0)' });
});

// ── sniffRasterMime ──────────────────────────────────────────────────────────

test('sniffRasterMime recognises the three animated-raster containers', () => {
  const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(sniffRasterMime(gif), 'image/gif');
  assert.equal(sniffRasterMime(png), 'image/png');
  assert.equal(sniffRasterMime(webp), 'image/webp');
  assert.equal(sniffRasterMime(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])), null);
  assert.equal(sniffRasterMime(new Uint8Array(0)), null);
});
