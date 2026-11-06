// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { EmojiStyleV1 } from '@lolly-tools/core/emoji-v1';
import { readFileSync } from 'node:fs';
import { seedEmojiRuntime, queryWithEmoji, embedUrlWithEmoji, emojiStyleFrom } from './emoji-runtime-style.ts';
import { DEFAULT_EMOJI_PIN, defaultEmojiStyle } from '../../../../engine/src/emoji-default.ts';
import { readEmojiStyle } from '../../../../engine/src/emoji-style.ts';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { buildEmbedUrl } from '../../../../engine/src/tool-url.ts';

const pin = { id: 'test/color', pin: { version: '1.0.0' }, checksum: `sha256:${'a'.repeat(64)}` };
test('embedded source seeding honors its link and preserves that set in the re-applied URL', async () => {
  let style: EmojiStyleV1 | null = null;
  const runtime = { setEmojiStyle: async (next: EmojiStyleV1) => { style = next; } } as unknown as Runtime;
  const host = {
    emoji: { sets: async () => [{ pin }] },
    profile: { get: async () => ({ emoji: { pin, mode: 'snap', strengthBps: 10000 } }) },
  } as unknown as HostV1;
  await seedEmojiRuntime(runtime, host, { emoji: 'test/color@1.0.0', emojifx: 'original' });
  const query = new URLSearchParams(queryWithEmoji('title=Hello%20world&rows=%5B%22x%22%5D', style));
  assert.equal(query.get('emoji'), 'test/color@1.0.0');
  assert.equal(query.get('emojifx'), 'original');
  assert.equal(query.get('title'), 'Hello world');
  assert.equal(query.get('rows'), '["x"]');
  assert.equal(queryWithEmoji('title=Hi&emoji=old&emojifx=mono', null), 'title=Hi');
});

test('embedded sources retain the runtime default unless a source explicitly selects or clears it', async () => {
  const initial = defaultEmojiStyle([{ pin: DEFAULT_EMOJI_PIN }]);
  let actual = initial;
  const runtime = { setEmojiStyle: async (style: EmojiStyleV1 | null) => { actual = style; } } as Runtime;
  const host = { emoji: { sets: async () => [{ pin }] }, profile: { get: async () => ({}) } } as unknown as HostV1;
  await seedEmojiRuntime(runtime, host, null);
  assert.deepEqual(actual, initial);
  await seedEmojiRuntime(runtime, host, { emoji: `${pin.id}@1.0.0`, emojifx: '' });
  assert.deepEqual(actual?.primary, pin);
  await seedEmojiRuntime(runtime, host, { emoji: 'none', emojifx: '' });
  assert.equal(actual, null);
});

/** Lolly Demo's design system and the emoji style it states. */
function demoStyle(): { doc: unknown; style: EmojiStyleV1 } {
  const doc: unknown = JSON.parse(readFileSync(new URL('../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8'));
  const read = readEmojiStyle(doc);
  assert.equal(read.status, 'selected', 'Lolly Demo states an emoji style');
  return { doc, style: (read as { style: EmojiStyleV1 }).style };
}

test('a placed tool under Lolly Demo gets a link, and the link keeps the same emoji style', () => {
  const { doc, style } = demoStyle();
  const build = (query: string): string | null => buildEmbedUrl({ toolId: 'qr-code', format: 'svg', query });
  assert.equal(build(queryWithEmoji('url=https%3A%2F%2Fexample.com', style)), null, 'the whole style does not fit an embed id');

  const link = embedUrlWithEmoji('url=https%3A%2F%2Fexample.com', style, build);
  assert.ok(link, 'the link is minted');
  const params = new URL(link).searchParams;
  assert.equal(params.get('url'), 'https://example.com');
  assert.equal(params.get('emojistyle'), null);

  // The render resolves the short params against the same design system's colours, so this
  // is the style that link draws with.
  const swatches = createTokenSet(doc).colors().map(swatch => ({ id: swatch.ref, hex: swatch.value }));
  const pair = { emoji: params.get('emoji') ?? '', emojifx: params.get('emojifx') ?? '' };
  assert.deepEqual(emojiStyleFrom(pair, [{ pin: style.primary }], swatches), style);
});

test('a link gives up the saved style first, then the set, and reports when nothing fits', () => {
  const style = {
    schemaVersion: 1, primary: pin, fallbacks: [], metricsPolicy: 'inline-em-v1', treatment: { mode: 'original', strengthBps: 0 },
  } as EmojiStyleV1;
  const upTo = (limit: number) => (query: string): string | null => (query.length > limit ? null : query);

  assert.match(embedUrlWithEmoji('title=Hi', style, upTo(4096))!, /emojistyle=/, 'room for all of it');
  const short = embedUrlWithEmoji('title=Hi', style, upTo(60))!;
  assert.match(short, /emoji=test/);
  assert.doesNotMatch(short, /emojistyle=/);
  assert.equal(embedUrlWithEmoji('title=Hi', style, upTo(20)), 'title=Hi');
  assert.equal(embedUrlWithEmoji('title=Hi', style, upTo(4)), null);
  assert.equal(embedUrlWithEmoji('title=Hi&emoji=old', null, upTo(20)), 'title=Hi', 'no style leaves no pin behind');
});

test('every place that mints a placed tool link can fall back', () => {
  for (const file of ['../views/embed-panel.ts', '../views/tool-inputs.ts']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /embedUrlWithEmoji\(/, `${file} goes through the fallback`);
    assert.doesNotMatch(source, /queryWithEmoji\(/, `${file} does not mint from the whole style alone`);
  }
});
