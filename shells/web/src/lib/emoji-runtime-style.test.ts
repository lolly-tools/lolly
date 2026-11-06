// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { EmojiStyleV1 } from '@lolly-tools/core/emoji-v1';
import { embedUrlWithEmoji, seedEmojiRuntime, queryWithEmoji } from './emoji-runtime-style.ts';
import { DEFAULT_EMOJI_PIN, defaultEmojiStyle } from '../../../../engine/src/emoji-default.ts';

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

test('a link keeps the pinned set when it fits, and drops it rather than failing to mint', () => {
  const style = { schemaVersion: 1, primary: { id: 'test/color', pin: { version: '1.0.0' }, checksum: 'sha256:x' }, fallbacks: [], metricsPolicy: 'inline-em-v1', treatment: { mode: 'original', strengthBps: 0 } } as unknown as EmojiStyleV1;
  const roomy = (query: string): string | null => `https://x/${query}`;
  assert.match(embedUrlWithEmoji('title=Hi', style, roomy)!, /emoji=test/);
  const tight = (query: string): string | null => (query.length > 20 ? null : `https://x/${query}`);
  assert.equal(embedUrlWithEmoji('title=Hi', style, tight), 'https://x/title=Hi');
  assert.equal(embedUrlWithEmoji('title=Hi', style, () => null), null, 'a link too long without the pin still reports no link');
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
