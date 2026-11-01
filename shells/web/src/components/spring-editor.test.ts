// SPDX-License-Identifier: MPL-2.0
/**
 * Springs and design-system curves in the Keyframes popup (plans/329), driven through
 * their real DOM under jsdom: the spring editor's commit law, the curve picker's groups
 * and what each option writes, the dock for a bound keyframe, the duration suggestions
 * and the motion-token install.
 *
 * NOT covered (browser-only): how the plot looks, the motion strip animating, and the
 * popup keeping its scroll position across a commit.
 *
 * Run directly:  node --test shells/web/src/components/spring-editor.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';

registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLOptGroupElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'matchMedia']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => dom.window.cancelAnimationFrame(h)) as typeof cancelAnimationFrame;

const { mountSpringEditor } = await import('./spring-editor.ts');
const { fillKfEaseSelect } = await import('../views/kf-ease-picker.ts');
const { mountKfCurveDock, kfSegmentMs } = await import('../views/kf-curve-dock.ts');
const { offerMotionDurations } = await import('../views/motion-durations.ts');
const { ensureMotionTokens, motionTokens, resetMotionTokens, MOTION_TOKENS_EVENT } = await import('../lib/motion-tokens.ts');
const { createTokenSet, parseKf, setKfEaseTokens, kfEaseResolved } = await import('@lolly/engine');

const doc = dom.window.document;
const change = (el: Element): void => { el.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };

const MOTION = {
  motion: {
    duration: { $type: 'duration', short: { $value: { value: 200, unit: 'ms' } }, scene: { $value: '2s' } },
    curve: { $type: 'cubicBezier', standard: { $value: [0.2, 0, 0, 1] } },
    spring: {
      bouncy: {
        $type: 'transition', $value: { duration: '700ms', delay: '0ms', timingFunction: [0.3, 1.3, 0.6, 1] },
        $extensions: { 'com.suse.lolly': { spring: { stiffness: 400, damping: 20, mass: 1 } } },
      },
    },
  },
};
const host = { tokens: { get: async () => createTokenSet(MOTION) } } as unknown as Parameters<typeof ensureMotionTokens>[0];

test('the spring editor writes nothing on mount, and one canonical spring per edit', () => {
  const parent = doc.createElement('div');
  doc.body.appendChild(parent);
  const commits: string[] = [];
  const ed = mountSpringEditor(parent as unknown as HTMLElement, { value: { stiffness: 600, damping: 15, mass: 1 }, spanMs: 500, onCommit: (t) => commits.push(t) });
  assert.deepEqual(commits, [], 'mounting authors nothing');
  const nums = [...ed.root.querySelectorAll<HTMLInputElement>('.spring-ed-num')];
  const ranges = [...ed.root.querySelectorAll<HTMLInputElement>('.spring-ed-slider')];
  assert.deepEqual(nums.map((n) => n.value), ['600', '15', '1']);
  ranges[1]!.value = '20';
  ranges[1]!.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.deepEqual(commits, [], 'dragging a slider paints and does not commit');
  change(ranges[1]!);
  assert.deepEqual(commits, ['esp(600)(20)(1)'], 'release commits once');
  change(ranges[1]!);
  assert.equal(commits.length, 1, 'a value that did not move is not an edit');
  nums[0]!.value = '99999';
  change(nums[0]!);
  assert.equal(commits.at(-1), 'esp(5000)(20)(1)', 'typed values are held to the wire clamps');
  nums[2]!.value = 'junk';
  change(nums[2]!);
  assert.equal(commits.length, 2, 'junk is refused');
  assert.equal(nums[2]!.value, '1', 'and the field shows the value again');
  // Bouncy over 500 ms has not settled: the dock says so.
  const notes = [...ed.root.querySelectorAll<HTMLElement>('.spring-ed-settle')];
  assert.match(notes[0]!.textContent ?? '', /Settles in/);
  ed.destroy();
  parent.remove();
});

test('the lands-early line shows only when the next keyframe comes first', () => {
  const parent = doc.createElement('div');
  const long = mountSpringEditor(parent as unknown as HTMLElement, { value: { stiffness: 600, damping: 15, mass: 1 }, spanMs: 3000, onCommit: () => {} });
  assert.equal(long.root.querySelectorAll<HTMLElement>('.spring-ed-settle')[1]!.hidden, true);
  long.destroy();
  const short = mountSpringEditor(parent as unknown as HTMLElement, { value: { stiffness: 600, damping: 15, mass: 1 }, spanMs: 200, onCommit: () => {} });
  assert.equal(short.root.querySelectorAll<HTMLElement>('.spring-ed-settle')[1]!.hidden, false);
  short.destroy();
});

test('motion tokens install from the host, once, and announce a change', async () => {
  resetMotionTokens();
  let events = 0;
  dom.window.addEventListener(MOTION_TOKENS_EVENT, () => { events++; });
  const read = await ensureMotionTokens(host);
  assert.deepEqual(read.curves.map((c) => c.path), ['motion.curve.standard', 'motion.spring.bouncy']);
  assert.equal(motionTokens(), read);
  assert.equal(kfEaseResolved('et(motion.spring.bouncy)'), 'esp(400)(20)(1)', 'the engine plays the token');
  assert.equal(events, 1);
  await ensureMotionTokens(host);
  assert.equal(events, 1, 'memoised: no second read, no second event');
});

test('the curve picker: design system first, then curves, then springs; a binding carries its value', async () => {
  await ensureMotionTokens(host);
  const el = doc.createElement('select');
  const picker = fillKfEaseSelect(el as unknown as HTMLSelectElement, 'eo', motionTokens());
  const groups = [...el.querySelectorAll('optgroup')].map((g) => [g.label, [...g.querySelectorAll('option')].map((o) => o.textContent)]);
  assert.deepEqual(groups, [
    ['Design system', ['Standard', 'Bouncy spring']],
    ['Curves', ['Linear', 'Ease in', 'Ease out', 'Ease in and out', 'Overshoot', 'Anticipate', 'Smooth', 'Snappy', 'Hold']],
    ['Springs', ['Gentle', 'Quick', 'Bouncy', 'Slow']],
  ]);
  assert.equal(el.value, 'eo');
  assert.equal(picker.easeFor('et(motion.spring.bouncy)'), 'et(motion.spring.bouncy)esp(400)(20)(1)', 'bound, with the value it has now');
  assert.equal(picker.easeFor('esp(600)(15)(1)'), 'esp(600)(15)(1)');

  const spring = doc.createElement('select');
  fillKfEaseSelect(spring as unknown as HTMLSelectElement, 'esp(601)(15)(1)', motionTokens());
  assert.equal(spring.selectedOptions[0]!.textContent, 'Custom spring');
  const preset = doc.createElement('select');
  fillKfEaseSelect(preset as unknown as HTMLSelectElement, 'esp(300)(20)(1)', motionTokens());
  assert.equal(preset.selectedOptions[0]!.textContent, 'Quick');

  const gone = doc.createElement('select');
  const goneEase = 'et(motion.curve.retired)eb(0.1)(0)(0)(1)';
  const p2 = fillKfEaseSelect(gone as unknown as HTMLSelectElement, goneEase, motionTokens());
  assert.equal(gone.selectedOptions[0]!.textContent, 'motion.curve.retired (not in this design system)');
  assert.equal(p2.easeFor(gone.value), goneEase, 'leaving it selected keeps the link and its remembered curve');

  const none = doc.createElement('select');
  fillKfEaseSelect(none as unknown as HTMLSelectElement, 'es', { curves: [], durations: [] });
  assert.equal(none.querySelectorAll('optgroup').length, 2, 'no design-system group without motion tokens');
});

test('the dock: a spring opens the spring editor, a binding says which token, a bezier is left to the caller', async () => {
  await ensureMotionTokens(host);
  const box = doc.createElement('div');
  const writes: string[] = [];
  assert.equal(mountKfCurveDock(box as unknown as HTMLElement, 'eo', 400, (e) => writes.push(e)), null);
  const sp = mountKfCurveDock(box as unknown as HTMLElement, 'esp(600)(15)(1)', 400, (e) => writes.push(e))!;
  assert.ok(box.querySelector('.spring-ed'));
  sp.destroy();
  const bound = mountKfCurveDock(box as unknown as HTMLElement, 'et(motion.curve.standard)', 400, (e) => writes.push(e))!;
  assert.equal(box.querySelector('.tl-kf-dock-bound')?.textContent, 'From the design system: Standard');
  assert.ok(box.querySelector('.ease-ed-handle'), 'a bound bezier opens the bezier editor on its value');
  bound.destroy();
  assert.equal(box.children.length, 0, 'destroy takes the notes with it');
  assert.equal(kfSegmentMs(parseKf('t0_x0*t600_x1*t900_x2'), 600), 300);
  assert.equal(kfSegmentMs(parseKf('t0_x0*t600_x1'), 600), null);
});

test('durations are offered where they fit the field, and nothing is offered where none does', async () => {
  await ensureMotionTokens(host);
  const row = doc.createElement('label');
  const input = doc.createElement('input');
  row.appendChild(input);
  doc.body.appendChild(row);
  offerMotionDurations(input as unknown as HTMLInputElement, { min: 50, max: 10000, unit: 'ms' });
  const list = input.list!;
  assert.deepEqual([...list.options].map((o) => `${o.value}:${o.label}`), ['200:Short', '2000:Scene']);
  offerMotionDurations(input as unknown as HTMLInputElement, { min: 0.8, max: 3600, unit: 's' });
  assert.deepEqual([...input.list!.options].map((o) => o.value), ['2'], 'seconds, and only the one long enough');
  assert.equal(row.querySelectorAll('datalist').length, 1, 'a refresh replaces the list');
  offerMotionDurations(input as unknown as HTMLInputElement, { min: 5, max: 10, unit: 's' });
  assert.equal(input.getAttribute('list'), null);
  assert.equal(row.querySelectorAll('datalist').length, 0);
  row.remove();
  setKfEaseTokens(null);
});
