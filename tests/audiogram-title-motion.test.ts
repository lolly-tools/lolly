// SPDX-License-Identifier: MPL-2.0
//
// Audiogram 2.10.0: the title entrance, ink that can be read, and type in the card's
// own unit. These drive the real tool through createRuntime and read what it hydrates
// to; how the entrance looks in a clip is a browser matter and is not claimed here.
//
// Run with:
//   node --import ./tests/css-stub.mjs --test tests/audiogram-title-motion.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const SKIP = !existsSync(join(COMMUNITY, 'audiogram', 'tool.json')) && 'community pack not mounted';

/** A design system's answers, as host.tokens.resolve gives them. */
function tokens(values: Record<string, unknown>) {
  return { tokens: { resolve: async (ref: string) => values[ref] ?? null } };
}

async function hydrate(values: Record<string, unknown>, host: Record<string, unknown> = {}): Promise<string> {
  const tool = await loadTool('audiogram', (p) => readFile(join(COMMUNITY, p), 'utf8'));
  const runtime = await createRuntime(tool as never, baseHost(host), values as never);
  return runtime.getHydrated();
}

/** The entrance's timing, as written on the card for the template to read. */
function entranceOf(hydrated: string): { unitMs: number; fadeMs: number; staggerMs: number; ease: number[]; endMs: number } {
  const m = /data-ag-entrance="([^"]*)"/.exec(hydrated);
  assert.ok(m, 'the card carries an entrance');
  return JSON.parse(m[1]!.replace(/&quot;/g, '"'));
}

const inkOf = (hydrated: string): string => /--ag-ink: ([^;]*);/.exec(hydrated)![1]!;
const DARK = { accent: '#30ba78', bg: '#0c322c' };

test('Title motion is the last input, off by default, and hidden where there are no words', { skip: SKIP }, async () => {
  const tool = await loadTool('audiogram', (p) => readFile(join(COMMUNITY, p), 'utf8'));
  const inputs = tool.manifest.inputs as { id: string; default?: unknown; showIf?: { layout?: string[] } }[];
  const last = inputs[inputs.length - 1]!;
  assert.equal(last.id, 'titleMotion');
  assert.equal(last.default, 'none');
  assert.ok(last.showIf?.layout && !last.showIf.layout.includes('minimal'));
});

test('Rise in splits the title into words, in order, and the subtitle follows as one line', { skip: SKIP }, async () => {
  const out = await hydrate({ title: 'Slow is smooth', subtitle: 'Build Notes', titleMotion: 'rise' });
  const units = [...out.matchAll(/<span class="ag-w"[^>]*data-ag-i="(\d+)">([^<]*)<\/span>/g)].map((m) => [Number(m[1]), m[2]]);
  assert.deepEqual(units, [[0, 'Slow'], [1, 'is'], [2, 'smooth'], [3, 'Build Notes']]);
  assert.match(out, /role="text" aria-label="Slow is smooth"/, 'a screen reader still gets the title as one phrase');
  assert.match(out, /class="ag-badge" aria-hidden="true" data-ag-in="fade" data-ag-i="0"/);
  assert.match(out, /<canvas id="ag-clock"/, 'the entrance has a clock to be driven from');
});

test('the entrance is over inside the first second, however long the title', { skip: SKIP }, async () => {
  for (const words of [1, 6, 14, 40]) {
    const title = Array.from({ length: words }, (_, i) => `word${i}`).join(' ');
    const e = entranceOf(await hydrate({ title, subtitle: 'A line', titleMotion: 'rise' }));
    assert.ok(e.endMs <= 1000, `${words} words end at ${e.endMs} ms`);
    assert.equal(e.endMs, e.unitMs + e.staggerMs * words, 'the subtitle is the last unit');
    assert.ok(e.staggerMs <= 80);
  }
});

test('the timing comes from the design system, with built-in values where it has none', { skip: SKIP }, async () => {
  const plain = entranceOf(await hydrate({ title: 'One two', titleMotion: 'rise' }));
  assert.deepEqual([plain.unitMs, plain.fadeMs, plain.ease], [400, 200, [0.05, 0.7, 0.1, 1]]);
  const system = entranceOf(
    await hydrate(
      { title: 'One two', titleMotion: 'rise' },
      tokens({
        '{motion.duration.medium}': { value: 300, unit: 'ms' },
        '{motion.duration.short}': '0.1s',
        '{motion.curve.emphasised}': [0.2, 0, 0, 1],
      }),
    ),
  );
  assert.deepEqual([system.unitMs, system.fadeMs, system.ease], [300, 100, [0.2, 0, 0, 1]]);
  // A system whose medium duration is longer than an entrance can be is held back.
  const slow = entranceOf(await hydrate({ title: 'One two', titleMotion: 'rise' }, tokens({ '{motion.duration.medium}': '3s' })));
  assert.equal(slow.unitMs, 600);
});

test('what the person typed is escaped, and right-to-left text moves as one line', { skip: SKIP }, async () => {
  const out = await hydrate({ title: '<img src=x onerror=alert(1)> "quoted"', titleMotion: 'rise' });
  assert.doesNotMatch(out, /<img src=x/);
  assert.match(out, /&lt;img<\/span>/);
  const rtl = await hydrate({ title: 'مرحبا بكم في البرنامج', titleMotion: 'rise' });
  assert.equal([...rtl.matchAll(/class="ag-w"/g)].length, 1, 'word boxes would reverse the words');
  const cjk = await hydrate({ title: '「今日」の話', titleMotion: 'rise' });
  const chars = [...cjk.matchAll(/<span class="ag-w"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(chars, ['「今', '日」', 'の', '話'], 'a bracket stays with its character');
});

test('Visual only has no words to move, so it carries no entrance', { skip: SKIP }, async () => {
  const out = await hydrate({ title: 'Hidden', titleMotion: 'rise', layout: 'minimal' });
  const card = out.slice(out.indexOf('</style>'), out.indexOf('<script>'));
  assert.equal(/data-ag-entrance|class="ag-w"|id="ag-clock"/.test(card), false);
});

test('an ink that reads is never touched', { skip: SKIP }, async () => {
  for (const ink of ['#ffffff', '#eef1f4', '#9fd8c0']) {
    assert.equal(inkOf(await hydrate({ ...DARK, ink })), ink);
  }
  // Tone on tone at 3:1 or better is a choice, not a mistake.
  assert.equal(inkOf(await hydrate({ bg: '#0c322c', ink: '#5f8f85' })), '#5f8f85');
});

test('an ink too close to the background is replaced, from the design system first', { skip: SKIP }, async () => {
  const system = tokens({ '{color.semantic.on-primary}': '#fdf6e3', '{color.semantic.text}': '#101010', '{color.semantic.surface}': '#fafafa' });
  const out = await hydrate({ ...DARK, ink: '#0f3a33' }, system);
  assert.equal(inkOf(out), '#fdf6e3');
  assert.match(out, /data-ink="#fdf6e3"/, 'the captions read the same ink');
  // On a light card the first ink to clear 4.5:1 is the system's text colour.
  assert.equal(inkOf(await hydrate({ bg: '#f4f4f4', ink: '#ffffff' }, system)), '#101010');
  // With no design system to ask, the card's own two inks stand in.
  assert.equal(inkOf(await hydrate({ ...DARK, ink: '#0f3a33' })), '#eef1f4');
  assert.equal(inkOf(await hydrate({ bg: '#f4f4f4', ink: '#ffffff' })), '#101828');
});

test('over the visual, its colour is a ground too, and the chosen ink stays when nothing reads better', { skip: SKIP }, async () => {
  // White reads on the dark card but only 2.5:1 on the bright visual. No other ink
  // reads on both, so white stays.
  assert.equal(inkOf(await hydrate({ ...DARK, ink: '#ffffff', layout: 'overlay' })), '#ffffff');
  // A grey that is weak on both is replaced by the ink that reads better on both.
  assert.equal(inkOf(await hydrate({ ...DARK, ink: '#7a8a86', layout: 'overlay' })), '#eef1f4');
  // Under the visual the same grey only has the card to read against, and reads.
  assert.equal(inkOf(await hydrate({ ...DARK, ink: '#7a8a86', layout: 'bottom' })), '#7a8a86');
});

test('a colour that is not a plain hex is left alone', { skip: SKIP }, async () => {
  assert.equal(inkOf(await hydrate({ bg: 'transparent', ink: '#101010' })), '#101010');
});

test('the type is sized in the card unit, which is one pixel on the square card', { skip: SKIP }, async () => {
  const template = await readFile(join(COMMUNITY, 'audiogram', 'template.html'), 'utf8');
  assert.match(template, /\.ag-title \{[^}]*font-size: calc\(56 \* var\(--ag-u\)\)/);
  assert.match(template, /\.ag-subtitle \{[^}]*font-size: calc\(26 \* var\(--ag-u\)\)/);
  assert.match(template, /\.ag-credit \{[^}]*font-size: calc\(20 \* var\(--ag-u\)\)/);
  // Square, padded: the box inside the padding is 928.8 px each way.
  const padded = (928.8 * 114) / 86 + 928.8;
  assert.ok(Math.abs(padded / 2160 - 1) < 1e-9);
  assert.match(template, /--ag-u: calc\(\(100cqw \* 114 \/ 86 \+ 100cqh\) \/ 2160\)/);
  assert.match(template, /\.ag-root\.is-overlay-center \{ --ag-u: calc\(\(100cqw \+ 100cqh\) \/ 2160\); \}/);
});

test('a replaced ink is said under Text colour, and the line goes when the colour reads', { skip: SKIP }, async () => {
  const tool = await loadTool('audiogram', (p) => readFile(join(COMMUNITY, p), 'utf8'));
  const runtime = await createRuntime(tool as never, baseHost(), { ...DARK, ink: '#0f3a33' } as never);
  assert.deepEqual(runtime.getNotices(), { ink: { tone: 'info', text: 'Too close to the background to read, so the card uses #eef1f4.' } });
  await runtime.setInput('ink', '#ffffff' as never);
  assert.deepEqual(runtime.getNotices(), {});
});
