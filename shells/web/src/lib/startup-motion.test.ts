// SPDX-License-Identifier: MPL-2.0
/**
 * The gallery's ambient motion holds still while the shell's WebGPU startup check runs
 * (startup-motion.ts). On software graphics the gallery's looping repaints delayed the
 * device past its 30 s budget, and the shell then showed the unsupported card on a
 * machine that supports WebGPU. These pin the helper, that boot() marks the root for
 * exactly the life of the check, and that every looping animation on a gallery surface
 * pauses under that mark (so none can be added later without its hold).
 *
 * Run directly:  node --test shells/web/src/lib/startup-motion.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { STARTUP_PENDING_ATTRIBUTE, onStartupMotionResume, startupMotionHeld } from './startup-motion.ts';

const delivered = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

test('motion is held only while the root carries the mark', () => {
  const doc = new JSDOM('<!doctype html><html></html>').window.document;
  assert.equal(startupMotionHeld(doc), false, 'a page that never ran the check holds nothing');
  doc.documentElement.setAttribute(STARTUP_PENDING_ATTRIBUTE, '');
  assert.equal(startupMotionHeld(doc), true);
  doc.documentElement.removeAttribute(STARTUP_PENDING_ATTRIBUTE);
  assert.equal(startupMotionHeld(doc), false);
});

test('a resume runs once when the check settles, and never when nothing was held', async () => {
  const doc = new JSDOM('<!doctype html><html></html>').window.document;
  let runs = 0;
  onStartupMotionResume(() => { runs++; }, doc);
  doc.documentElement.setAttribute(STARTUP_PENDING_ATTRIBUTE, '');
  await delivered();
  assert.equal(runs, 0, 'registered with nothing held, so it stays a no-op');

  const held = onStartupMotionResume(() => { runs++; }, doc);
  doc.documentElement.dataset.theme = 'dark';
  await delivered();
  assert.equal(runs, 0, 'still held: other attributes do not release it');
  doc.documentElement.removeAttribute(STARTUP_PENDING_ATTRIBUTE);
  await delivered();
  assert.equal(runs, 1, 'released once the check settles');
  doc.documentElement.setAttribute(STARTUP_PENDING_ATTRIBUTE, '');
  doc.documentElement.removeAttribute(STARTUP_PENDING_ATTRIBUTE);
  await delivered();
  assert.equal(runs, 1, 'and only once');
  held();

  doc.documentElement.setAttribute(STARTUP_PENDING_ATTRIBUTE, '');
  const cancelled = onStartupMotionResume(() => { runs++; }, doc);
  cancelled();
  doc.documentElement.removeAttribute(STARTUP_PENDING_ATTRIBUTE);
  await delivered();
  assert.equal(runs, 1, 'a cancelled resume never runs');
});

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('boot() marks the root before the check starts and clears the mark when it settles', () => {
  const main = read('../main.ts');
  const mark = main.indexOf('setAttribute(STARTUP_PENDING_ATTRIBUTE');
  const check = main.indexOf('startWebGpuCheck()', mark);
  assert.ok(mark > 0 && check > mark, 'the mark goes on before the check starts');
  const settle = main.slice(check, main.indexOf('});', main.indexOf('.finally(', check)) + 3);
  assert.match(settle, /\.then\([\s\S]*stopForWebGpu\)\s*\.finally\(\(\) => \{ document\.documentElement\.removeAttribute\(STARTUP_PENDING_ATTRIBUTE\); \}\);$/,
    'and comes off after either outcome has been recorded');
});

/** Selector -> declarations for every rule in a sheet, nested rules included. */
function rules(css: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: m[1]!.trim().replace(/\s+/g, ' '), body: m[2]! });
  }
  return out;
}

test('every looping animation on a gallery surface pauses under the mark', () => {
  let looping = 0;
  for (const sheet of ['../styles/parts/gallery.css', '../styles/parts/featured.css']) {
    const all = rules(read(sheet));
    for (const { selector, body } of all) {
      if (!/animation:[^;]*\binfinite\b/.test(body)) continue;
      looping++;
      const held = all.find(r => r.selector === `html[${STARTUP_PENDING_ATTRIBUTE}] ${selector}`);
      assert.ok(held, `${sheet}: "${selector}" loops with no hold under html[${STARTUP_PENDING_ATTRIBUTE}]`);
      assert.match(held!.body, /animation-play-state:\s*paused/, `${sheet}: "${selector}" pauses, so it resumes on the same frame`);
    }
  }
  assert.ok(looping >= 3, 'the trace, the pending dot and the Ken Burns are all found');
});
