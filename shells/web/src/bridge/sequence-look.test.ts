// SPDX-License-Identifier: MPL-2.0
/**
 * Keyed appearance on the live DOM (plans/328): the preview applier and the export planner
 * read the same paint off a track, the applier writes only `--lolly-kf-*` custom
 * properties, and restoring the stage takes every one of them back off.
 *
 * Run directly:  node --test shells/web/src/bridge/sequence-look.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>');
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'SVGElement', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}

const { applySequenceTime, restoreSequenceTime } = await import('./sequence-dom.ts');
const { applyLook, clearLook, lookWritten, tracksLook, lookKey } = await import('./sequence-look.ts');
const { parseSequenceStage, sequenceDrawPlan, kfTrackOf } = await import('./sequence-plan.ts');
const { kfColourKey, kfLookVars, kfOutlinePath, serialiseKf } = await import('@lolly/engine');

const RED = kfColourKey('#ff0000', 'fill')!;
const BLUE = kfColourKey('#0000ff', 'fill')!;
const KF = serialiseKf([{ t: 0, ease: 'el', v: { ...RED, lw: 2, ts: 0, te: 0 } }, { t: 1000, v: { ...BLUE, lw: 10, te: 1 } }]);

function stage(kf: string): HTMLElement {
  const root = dom.window.document.createElement('div');
  root.innerHTML = `
    <div class="artboard" data-sequence data-seq-ms="2000" style="width:400px;height:300px">
      <div class="lolly-box" data-box-id="a" data-t-start="0" data-t-dur="2000" data-t-kf="${kf}"
           style="left:0px;top:0px;width:100px;height:50px;background:var(--lolly-kf-fill, #ffcc00)"></div>
      <div class="lolly-box" data-box-id="b" data-t-start="0" data-t-dur="2000" data-t-kf="t0_x0*t1000_x40"
           style="left:0px;top:100px;width:100px;height:50px;background:#00ff00"></div>
    </div>`;
  dom.window.document.body.appendChild(root);
  return root;
}
const box = (root: HTMLElement, id: string): HTMLElement =>
  root.querySelector(`[data-box-id="${id}"]`) as HTMLElement;
const lookProps = (el: HTMLElement): string[] =>
  Array.from({ length: el.style.length }, (_v, i) => el.style.item(i)).filter((n) => n.startsWith('--lolly-kf-'));

test('the applier writes the keyed paint as custom properties, and only on the box that keys it', () => {
  const root = stage(KF);
  const a = box(root, 'a');
  const b = box(root, 'b');
  const before = a.style.cssText;
  applySequenceTime(root, 500);
  assert.equal(a.style.getPropertyValue('--lolly-kf-sw'), '6px', 'the width halfway through a linear segment');
  assert.match(a.style.getPropertyValue('--lolly-kf-fill'), /^#[0-9a-f]{6}$/);
  assert.equal(a.style.getPropertyValue('--lolly-kf-trim'), '0.5 2');
  assert.deepEqual(lookProps(b), [], 'a box that keys no appearance carries no custom property');
  applySequenceTime(root, 0);
  assert.equal(a.style.getPropertyValue('--lolly-kf-fill'), '#ff0000');
  assert.equal(a.style.getPropertyValue('--lolly-kf-trim-on'), '0', 'an empty trim switches the stroke off');
  restoreSequenceTime(root);
  assert.deepEqual(lookProps(a), [], 'restore removes every appearance property');
  assert.equal(a.style.cssText, before, 'and leaves the authored declarations as they were');
  root.remove();
});

test('preview and export read the same paint off the track', () => {
  const root = stage(KF);
  const parsed = parseSequenceStage(root.querySelector('[data-sequence]') as HTMLElement);
  assert.ok(parsed);
  for (const t of [0, 250, 500, 999, 1500]) {
    applySequenceTime(root, t);
    const plan = sequenceDrawPlan(parsed.layers, t, parsed.totalMs, { stageW: 400, stageH: 300 });
    const item = plan.find((p) => p.layer.el?.getAttribute('data-box-id') === 'a');
    assert.ok(item?.look, `the plan carries the look at ${t}`);
    const want = kfLookVars(item.look);
    for (const [k, v] of Object.entries(want)) {
      assert.equal(box(root, 'a').style.getPropertyValue(k), v, `${k} at ${t}`);
    }
    const flat = plan.find((p) => p.layer.el?.getAttribute('data-box-id') === 'b');
    assert.equal(flat?.look, null, 'a layer that keys no appearance plans none');
  }
  restoreSequenceTime(root);
  root.remove();
});

test('applyLook is idempotent, reversible, and redraws a trimmed outline at the keyed size', () => {
  const el = dom.window.document.createElement('div');
  el.style.width = '120px';
  el.style.height = '80px';
  el.innerHTML = '<svg class="lolly-box-trim" data-trim-shape="rounded" data-trim-r="10" data-trim-sw="4">'
    + `<path d="${kfOutlinePath('rounded', 120, 80, 10, 2)}" pathLength="1"></path></svg>`;
  const path = el.querySelector('path')!;
  const authored = path.getAttribute('d');
  applyLook(el, { cr: 20, lw: 8 }, { w: 120, h: 80 });
  assert.equal(path.getAttribute('d'), kfOutlinePath('rounded', 120, 80, 20, 4));
  assert.equal(el.style.getPropertyValue('--lolly-kf-r'), '20px');
  assert.ok(lookWritten(el));
  applyLook(el, { cr: 20, lw: 8 }, { w: 120, h: 80 });
  clearLook(el);
  assert.equal(path.getAttribute('d'), authored, 'the authored outline comes back');
  assert.deepEqual(lookProps(el), []);
  assert.equal(lookWritten(el), false);
});

test('tracksLook and lookKey', () => {
  assert.equal(tracksLook(kfTrackOf('t0_x1*t10_x2')), false);
  assert.equal(tracksLook(kfTrackOf(KF)), true);
  assert.equal(tracksLook(null), false);
  assert.equal(lookKey(null), '');
  assert.equal(lookKey({ lw: 2, cl: 0.5 }), lookKey({ cl: 0.5, lw: 2 }), 'order-free');
});
