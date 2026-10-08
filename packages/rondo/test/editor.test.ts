// SPDX-License-Identifier: MPL-2.0
/**
 * The Rondocode editor frame's own modules: the colour table it derives from a
 * design system, its storage stand-ins, and its half of the message protocol.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contrastRatio, hexToOklch } from '../../../engine/src/brand-derive.ts';
import { derivePalette, paletteCssVars, paletteProblems, TEXT_CONTRAST, HIGH_CONTRAST, TEXT_ENTRIES } from '../editor/theme.ts';
import { FrameDb, MemoryStorage, installStorage, type StoreOp } from '../editor/storage.ts';
import { MAX_CODE_CHARS, parseParentMessage, toUpstreamLang, fromUpstreamLang } from '../editor/protocol.ts';

const BRANDS: Record<string, Parameters<typeof derivePalette>[0]> = {
  none: {},
  'suse pine': { primary: '#0c322c', secondary: '#30ba78', warn: '#ffb184', danger: '#dc2828' },
  'suse jungle': { primary: '#30ba78' },
  black: { primary: '#000000' },
  grey: { primary: '#888888' },
  white: { primary: '#ffffff' },
  red: { primary: '#ff0000', secondary: '#0000ff' },
  yellow: { primary: '#ffcc00' },
  blue: { primary: '#2453ff', warn: '#b28727' },
  'not a colour': { primary: 'oklch(50% 0.1 200)', secondary: 'red' },
};

test('every derived table passes its contrast checks, for bright, dark, grey and missing brands', () => {
  for (const [name, input] of Object.entries(BRANDS)) {
    const p = derivePalette(input);
    assert.deepEqual(paletteProblems(p), [], `${name}: ${paletteProblems(p).join('; ')}`);
    for (const v of Object.values(p)) assert.match(v, /^#[0-9a-f]{6}$/, `${name}: every entry is #rrggbb`);
  }
});

/** The app's semantic colours as the shell resolves them, light and dark (styles/tokens.css). */
const APP_LIGHT = { canvas: '#fcfcfc', raised: '#ffffff', muted: '#f1f3f2', overlay: '#ffffff', border: '#e3e6e5', text: '#141a18', textMuted: '#5d6b66', accent: '#30ba78', danger: '#dc2828' };
const APP_DARK = { canvas: '#0b1210', raised: '#131c19', muted: '#1b2622', overlay: '#16201d', border: '#26332e', text: '#e7efec', textMuted: '#93a39d', accent: '#30ba78', danger: '#f05252' };

test('the editor follows the app: light and dark tables from its own tokens, each passing every contrast check', () => {
  for (const [name, input] of Object.entries(BRANDS)) {
    for (const [mode, ui] of [['light', APP_LIGHT], ['dark', APP_DARK]] as const) {
      const p = derivePalette({ ...input, mode, ui });
      assert.deepEqual(paletteProblems(p), [], `${name} ${mode}: ${paletteProblems(p).join('; ')}`);
      // The app's own surfaces and text, not colours made up for the editor.
      assert.equal(p.bg, ui.canvas, `${name} ${mode}: the editor background is the app's canvas`);
      assert.equal(p.text, ui.text, `${name} ${mode}: the app's text colour keeps its contrast, so it is used as is`);
      const l = hexToOklch(p.bg)!.l;
      assert.ok(mode === 'light' ? l > 0.9 : l < 0.3, `${name} ${mode}: background lightness ${l.toFixed(2)}`);
    }
  }
  // With no mode given, the canvas colour says which.
  assert.equal(derivePalette({ ui: APP_LIGHT }).bg, APP_LIGHT.canvas);
  assert.ok(hexToOklch(derivePalette({ ui: APP_LIGHT }).keyword)!.l < 0.6, 'syntax on a light canvas is dark ink');
});

test('high contrast keeps every text entry at 7:1 in both modes', () => {
  for (const ui of [APP_LIGHT, APP_DARK]) {
    const p = derivePalette({ primary: '#30ba78', ui, highContrast: true });
    for (const [key, min] of TEXT_ENTRIES) {
      if (min !== TEXT_CONTRAST) continue;
      assert.ok(contrastRatio(p[key], p.bg) >= HIGH_CONTRAST, `${key} ${p[key]} on ${p.bg}`);
    }
  }
});

test('the table is dark whatever the brand when nothing says otherwise, and keeps a chromatic brand hue in its accent', () => {
  for (const [name, input] of Object.entries(BRANDS)) {
    const bg = hexToOklch(derivePalette(input).bg)!;
    assert.ok(bg.l < 0.25, `${name}: background is dark (L ${bg.l.toFixed(2)})`);
  }
  const hero = hexToOklch('#2453ff')!;
  const accent = hexToOklch(derivePalette({ primary: '#2453ff' }).accent)!;
  const gap = Math.min(Math.abs(hero.h - accent.h), 360 - Math.abs(hero.h - accent.h));
  assert.ok(gap < 8, `accent keeps the brand hue (gap ${gap.toFixed(1)} degrees)`);
  assert.ok(contrastRatio(derivePalette({ primary: '#2453ff' }).accent, derivePalette({ primary: '#2453ff' }).bg) >= TEXT_CONTRAST);
});

test('the same design system always gives the same table', () => {
  const a = derivePalette(BRANDS['suse pine']);
  const b = derivePalette({ ...BRANDS['suse pine'] });
  assert.deepEqual(a, b);
});

test('the CSS variables cover every entry upstream writes, plus the ones the patches add', () => {
  const palette = readFileSync(new URL('../upstream/packages/app/src/ui/palette.ts', import.meta.url), 'utf8');
  // Each constant carries its custom property: live('--c-bg', ...) in the patched file.
  const upstreamVars = [...palette.matchAll(/live\('(--c-[a-z-]+)'/g)].map((m) => m[1]);
  assert.ok(upstreamVars.length >= 18, 'read the patched palette');
  const ours = Object.keys(paletteCssVars(derivePalette()));
  for (const v of upstreamVars) assert.ok(ours.includes(v!), `${v} is set from the derived table`);
});

test('FrameDb answers from its snapshot, copies values, and reports only the saved stores', async () => {
  const ops: StoreOp[] = [];
  const db = new FrameDb({ projects: [{ id: 'p1', name: 'one', code: 'x' }, { name: 'no id' }, 'junk'] as unknown[] }, (op) => ops.push(op));
  assert.deepEqual((await db.all<{ id: string }>('projects')).map((p) => p.id), ['p1'], 'records without a string id are dropped');
  const got = await db.get<{ name: string }>('projects', 'p1');
  got!.name = 'changed';
  assert.equal((await db.get<{ name: string }>('projects', 'p1'))!.name, 'one', 'a read is a copy');
  await db.put('versions', { id: 'v1', projectId: 'p1', code: 'x' });
  await db.put('samples', { id: 's1', data: new Float32Array(4) });
  await db.del('projects', 'p1');
  assert.deepEqual(ops.map((o) => `${o.op}:${o.store}`), ['put:versions', 'del:projects'], 'samples stay in the frame');
});

test('MemoryStorage reports writes and removals, and stands in for the browser Storage', () => {
  const seen: Array<[string, string | null]> = [];
  const s = new MemoryStorage({ a: '1' }, (k, v) => seen.push([k, v]));
  s.setItem('a', '1'); // unchanged: no report
  s.setItem('b', '2');
  s.removeItem('a');
  s.removeItem('missing');
  assert.deepEqual(seen, [['b', '2'], ['a', null]]);
  assert.equal(s.length, 1);
  assert.equal(s.key(0), 'b');
  const target: Record<string, unknown> = {};
  installStorage(s, new MemoryStorage(), target);
  assert.equal((target.localStorage as MemoryStorage).getItem('b'), '2');
});

test('the frame accepts only well-formed messages from the utility', () => {
  assert.equal(parseParentMessage(null), null);
  assert.equal(parseParentMessage({ kind: 'rondo:nope' }), null);
  assert.equal(parseParentMessage({ kind: 'rondo:song', code: 5, name: 'x' }), null);
  assert.equal(parseParentMessage({ kind: 'rondo:song', code: 'x'.repeat(MAX_CODE_CHARS + 1), name: 'x' }), null, 'oversized song refused');
  assert.deepEqual(parseParentMessage({ kind: 'rondo:song', code: 'cps 1', name: 'n', lang: 'perl' }), { kind: 'rondo:song', code: 'cps 1', lang: 'auto', name: 'n' });
  const buf = new ArrayBuffer(3);
  assert.deepEqual(parseParentMessage({ kind: 'rondo:sing-models', id: 2, ok: true, files: { 'a.onnx': buf, bad: 'text' } }),
    { kind: 'rondo:sing-models', id: 2, ok: true, files: { 'a.onnx': buf } });
  assert.deepEqual(parseParentMessage({ kind: 'rondo:sing-models', id: 3, ok: false, reason: 'weird' }),
    { kind: 'rondo:sing-models', id: 3, ok: false, reason: 'error', message: '' });
  assert.equal(parseParentMessage({ kind: 'rondo:sing-progress', id: 1, label: 'x', done: -1, total: 2 }), null);
});

test('export results, notices and full screen arrive only well formed', () => {
  assert.deepEqual(parseParentMessage({ kind: 'rondo:export-result', id: 4, ok: true, message: 'Saved a.wav.' }),
    { kind: 'rondo:export-result', id: 4, ok: true, message: 'Saved a.wav.' });
  assert.equal(parseParentMessage({ kind: 'rondo:export-result', id: 4.5, ok: true, message: 'x' }), null, 'id must be an integer');
  assert.equal(parseParentMessage({ kind: 'rondo:export-result', id: 4, ok: true, message: 'x'.repeat(1001) }), null, 'oversized message refused');
  assert.deepEqual(parseParentMessage({ kind: 'rondo:notice', key: 'saved', message: 'Saved.' }), { kind: 'rondo:notice', key: 'saved', message: 'Saved.' });
  assert.equal(parseParentMessage({ kind: 'rondo:notice', key: 'Saved!', message: 'x' }), null, 'a key is a plain word');
  assert.deepEqual(parseParentMessage({ kind: 'rondo:immersive', on: false }), { kind: 'rondo:immersive', on: false });
  assert.equal(parseParentMessage({ kind: 'rondo:immersive', on: 'yes' }), null);
});

test("Lolly's language names map onto upstream's", () => {
  assert.equal(toUpstreamLang('js'), 'rondocode');
  assert.equal(toUpstreamLang('rondo'), 'rondo');
  assert.equal(toUpstreamLang('auto'), undefined);
  assert.equal(fromUpstreamLang('rondocode'), 'js');
  assert.equal(fromUpstreamLang('rondo'), 'rondo');
});
