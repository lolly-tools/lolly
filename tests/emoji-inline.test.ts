// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emojiInlineMetrics, emojiInlineStyle, prepareEmojiText } from '../engine/src/emoji-inline.ts';
import type { EmojiArtworkCache, EmojiTextIO } from '../engine/src/emoji-inline.ts';
import { emojiSourceIngredients } from '../engine/src/emoji-rights.ts';
import type { EmojiStyleV1 } from '../packages/core/src/emoji-v1.ts';
import { fixture, fixtureRoot, style } from './helpers/emoji-fixtures.ts';
import { parseEmojiXml } from './helpers/emoji-xml.ts';

/** Reads the pinned fixture artwork off disk, counting how often it is asked. */
function loader(directory: string): { io: EmojiTextIO; loads: () => number } {
  let loads = 0;
  return {
    loads: () => loads,
    io: {
      loadArtwork: async (_pin, asset) => {
        loads++;
        return new Uint8Array(await readFile(new URL(`${directory}/${asset.url}`, fixtureRoot)));
      },
      parseXml: parseEmojiXml,
    },
  };
}

test('inline-em-v1 sizes a glyph from its box, its em and its advance', () => {
  const metrics = emojiInlineMetrics({ viewBox: [0, 0, 36, 36] }, { unitsPerEm: 36, advance: 36, baseline: 30.6 });
  assert.equal(metrics.heightEm, 1);
  assert.equal(metrics.widthEm, 1);
  assert.equal(metrics.advanceEm, 1);
  assert.ok(Math.abs(metrics.descentEm - 0.15) < 1e-12);
  assert.equal(metrics.marginRightEm, 0);
  assert.equal(emojiInlineStyle(metrics), 'display:inline-block;position:relative;width:1em;height:1em;vertical-align:-0.15em');

  // An advance wider than the ink box becomes the space after it, never a stretch.
  const wide = emojiInlineMetrics({ viewBox: [0, 0, 72, 72] }, { unitsPerEm: 72, advance: 90, baseline: 72 });
  assert.equal(wide.advanceEm, 1.25);
  assert.equal(wide.marginRightEm, 0.25);
  assert.equal(wide.descentEm, 0);
  assert.match(emojiInlineStyle(wide), /margin-right:0\.25em$/);

  // A half-height glyph on a 1000-unit em, so the arithmetic is not just identity.
  const half = emojiInlineMetrics({ viewBox: [0, 0, 1000, 500] }, { unitsPerEm: 1000, advance: 1000, baseline: 400 });
  assert.deepEqual([half.heightEm, half.widthEm, half.descentEm], [0.5, 1, 0.1]);
  assert.throws(() => emojiInlineMetrics({ viewBox: [0, 0, 36, 36] }, { unitsPerEm: 0, advance: 36, baseline: 30 }), /em size/);
});

test('mixed text prepares one census entry per distinct artwork, with every occurrence', async () => {
  const input = await fixture('twemoji');
  const { io, loads } = loader('twemoji');
  const prepared = await prepareEmojiText('Hi 😀 and 😀!', style(input.lock.pin), [input.pack], io);

  assert.deepEqual(prepared.segments.map(segment => segment.kind), ['text', 'emoji', 'text', 'emoji', 'text']);
  assert.deepEqual(prepared.segments.filter(segment => segment.kind === 'text').map(segment => segment.text), ['Hi ', ' and ', '!']);
  const first = prepared.segments[1]!;
  assert.equal(first.kind, 'emoji');
  if (first.kind !== 'emoji') return;
  assert.equal(first.key, '1f600');
  assert.equal(first.label, 'grinning face');
  assert.match(first.markup, /^<svg /);
  assert.equal(first.metrics.heightEm, 1);

  // One artwork, loaded once however many times it appears.
  assert.equal(loads(), 1);
  assert.equal(prepared.census.length, 1);
  const entry = prepared.census[0]!;
  assert.equal(entry.assetId, 'community/emoji/twemoji/color/1f600');
  assert.equal(entry.normalizer, 'static-svg-v1');
  assert.equal(entry.source.license, 'CC-BY-4.0');
  assert.deepEqual(entry.occurrences, [{ start: 3, end: 5 }, { start: 10, end: 12 }]);

  // The census is exactly what the rights writer already takes.
  const ingredients = emojiSourceIngredients(prepared.census);
  assert.equal(ingredients.length, 1);
  assert.equal(ingredients[0]!.relationship, 'componentOf');
  assert.equal(ingredients[0]!.title, 'grinning face (Twemoji Color 17.0.3)');
  assert.match(ingredients[0]!.description!, /CC-BY-4\.0/);
});

test('each placement gets its own id prefix, so two copies never share a gradient', async () => {
  const input = await fixture('noto');
  const { io } = loader('noto');
  const prepared = await prepareEmojiText('😀 😀', style(input.lock.pin), [input.pack], io, { prefix: 'e7' });
  const markup = prepared.segments.filter(segment => segment.kind === 'emoji').map(segment => segment.markup);
  assert.equal(markup.length, 2);
  assert.ok(markup[0]!.includes('id="e7-0-'), 'first placement carries its own prefix');
  assert.ok(markup[1]!.includes('id="e7-1-'), 'second placement carries a different prefix');
  assert.notEqual(markup[0], markup[1]);
  // Same artwork, so one census entry with two occurrences.
  assert.equal(prepared.census.length, 1);
  assert.equal(prepared.census[0]!.occurrences.length, 2);
});

test('a caller-owned cache prepares each artwork once across calls', async () => {
  const input = await fixture('noto');
  const { io, loads } = loader('noto');
  const cache: EmojiArtworkCache = new Map();
  const chosen = style(input.lock.pin);
  const first = await prepareEmojiText('😀 and 🌪️', chosen, [input.pack], io, { cache });
  assert.equal(first.census.length, 2, 'two distinct artworks');
  assert.equal(loads(), 2);
  const second = await prepareEmojiText('😀 again', chosen, [input.pack], io, { cache });
  assert.equal(loads(), 2, 'the second run loads nothing new');
  assert.equal(second.census.length, 1);
  assert.equal(second.census[0]!.canonicalChecksum, first.census[0]!.canonicalChecksum);
});

test('nothing falls back to a system font: every unresolved case says why', async () => {
  const input = await fixture('twemoji');
  const { io, loads } = loader('twemoji');
  const chosen = style(input.lock.pin);

  const unchosen = await prepareEmojiText('a 😀', null, [input.pack], io);
  assert.deepEqual(unchosen.segments.map(segment => segment.kind), ['text', 'unresolved']);
  assert.equal(unchosen.segments[1]!.kind === 'unresolved' && unchosen.segments[1]!.reason, 'selection-required');
  assert.deepEqual(unchosen.census, []);

  // A glyph the chosen set does not carry, and a joined sequence Unicode does not know.
  const missing = await prepareEmojiText('🙂', chosen, [input.pack], io);
  assert.equal(missing.segments[0]!.kind === 'unresolved' && missing.segments[0]!.reason, 'glyph-unavailable');
  const nonsense = await prepareEmojiText('😀‍😀', chosen, [input.pack], io);
  assert.equal(nonsense.segments[0]!.kind === 'unresolved' && nonsense.segments[0]!.reason, 'unsupported-sequence');

  // A pack that is not admitted here, and artwork the host cannot hand over.
  const absent = await prepareEmojiText('😀', chosen, [], io);
  assert.equal(absent.segments[0]!.kind === 'unresolved' && absent.segments[0]!.reason, 'pack-unavailable');
  const broken = await prepareEmojiText('😀', chosen, [input.pack], { ...io, loadArtwork: async () => { throw new Error('offline'); } });
  assert.equal(broken.segments[0]!.kind === 'unresolved' && broken.segments[0]!.reason, 'artwork-unavailable');
  assert.equal(loads(), 0, 'nothing above resolved, so no artwork was ever fetched');

  // Text presentation stays text, and never becomes a placeholder.
  const copyright = await prepareEmojiText('(c) © 2026', chosen, [input.pack], io);
  assert.deepEqual(copyright.segments, [{ kind: 'text', text: '(c) © 2026' }]);
});

test('a treatment changes the placed bytes and the census reports that in the census', async () => {
  const input = await fixture('twemoji');
  const { io } = loader('twemoji');
  const plain = style(input.lock.pin);
  const treated: EmojiStyleV1 = {
    ...plain,
    treatment: {
      mode: 'snap', strengthBps: 10000, recipe: 'emoji-treatment-v1',
      palette: [{ id: 'brand.primary', hex: '#0c322c' }, { id: 'brand.accent', hex: '#30ba78' }],
    },
  };
  const before = await prepareEmojiText('😀', plain, [input.pack], io);
  const after = await prepareEmojiText('😀', treated, [input.pack], io);
  const original = before.census[0]!, recoloured = after.census[0]!;

  assert.notEqual(recoloured.canonicalChecksum, original.canonicalChecksum);
  assert.equal(recoloured.sourceChecksum, original.sourceChecksum, 'the source bytes are the same bytes');
  assert.equal(recoloured.normalizer, 'static-svg-v1+emoji-treatment-v1');
  assert.ok(recoloured.changes.length > original.changes.length, 'the treatment is recorded as a change');
  assert.ok(recoloured.changes.some(change => /emoji-treatment-v1/.test(change)));
  // Same inputs, same bytes: the second run of the same treatment agrees exactly.
  const again = await prepareEmojiText('😀', treated, [input.pack], loader('twemoji').io);
  assert.equal(again.census[0]!.canonicalChecksum, recoloured.canonicalChecksum);
});
