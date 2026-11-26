// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { emojiParams, parseEmojiParams } from '../engine/src/emoji-style.ts';
import type { EmojiPaletteEntry, EmojiSetPin } from '../engine/src/emoji-style.ts';
import { validateEmojiStyle } from '../engine/src/emoji-pack.ts';
import { RESERVED, parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';
import type { InputManifest } from '../engine/src/inputs.ts';
import {
  SESSION_FORMAT_VERSION, SESSION_READER_VERSION, migrateSessionRecord, sessionEmojiStamp, sessionVersionStamp,
} from '../engine/src/session-record.ts';
import type { EmojiPackPinV1, EmojiStyleV1 } from '../packages/core/src/emoji-v1.ts';

const sum = (seed: string): string => `sha256:${seed.repeat(64).slice(0, 64)}`;
const pin = (id: string, version: string, seed: string): EmojiPackPinV1 => ({ id, pin: { version }, checksum: sum(seed) });
const STARTER = pin('community/emoji/twemoji/color-starter', '17.0.3', 'a');
const OPENMOJI = pin('community/emoji/openmoji/color', '17.0.0', 'b');
const SETS: EmojiSetPin[] = [{ pin: STARTER }, { pin: OPENMOJI }];
const PALETTE: EmojiPaletteEntry[] = [
  { id: 'color.ink', hex: '#0c322c' },
  { id: 'color.brand.primary', hex: '#30ba78' },
  { id: 'color.paper', hex: '#ffffff' },
];
const styleWith = (treatment: EmojiStyleV1['treatment']): EmojiStyleV1 =>
  ({ schemaVersion: 1, primary: STARTER, fallbacks: [], metricsPolicy: 'inline-em-v1', treatment });

test('the emoji param names a set the host holds, never its bytes', () => {
  const full = parseEmojiParams({ emoji: 'community/emoji/twemoji/color-starter@17.0.3' }, SETS, PALETTE);
  assert.deepEqual(full.issues, []);
  assert.deepEqual(full.pin, STARTER);
  assert.equal(full.pin!.checksum, sum('a'), 'the checksum comes from the listing, not the link');

  // The short form is the last two id segments, while exactly one set answers to it.
  const short = parseEmojiParams({ emoji: 'twemoji/color-starter@17.0.3' }, SETS, PALETTE);
  assert.deepEqual(short.pin, STARTER);
  const ambiguous = parseEmojiParams({ emoji: 'twemoji/color-starter@17.0.3' }, [...SETS, { pin: pin('other/emoji/twemoji/color-starter', '17.0.3', 'c') }], PALETTE);
  assert.equal(ambiguous.pin, undefined);
  assert.match(ambiguous.issues[0]!.message, /full set id/);

  // A version this device does not hold is unavailable, not a different version.
  const other = parseEmojiParams({ emoji: 'community/emoji/twemoji/color-starter@17.0.4' }, SETS, PALETTE);
  assert.equal(other.pin, undefined);
  assert.equal(other.issues[0]!.code, 'pack-unavailable');

  for (const junk of ['', 'twemoji', 'twemoji@', '@17.0.3', 'Twemoji/Color@17.0.3', '../../etc@1']) {
    const result = parseEmojiParams({ emoji: junk }, SETS, PALETTE);
    assert.equal(result.pin, undefined, junk);
    assert.equal(result.issues.length, junk === '' ? 0 : 1, junk);
  }
  assert.deepEqual(parseEmojiParams({}, SETS, PALETTE), { issues: [] });
});

test('the emojifx param pins the brand palette into a treatment', () => {
  const original = parseEmojiParams({ emojifx: 'original' }, SETS, PALETTE).treatment;
  assert.deepEqual(original, { mode: 'original', strengthBps: 0 });

  const snap = parseEmojiParams({ emojifx: 'snap' }, SETS, PALETTE).treatment!;
  assert.equal(snap.mode, 'snap');
  assert.equal(snap.strengthBps, 10000);
  assert.equal('palette' in snap && snap.palette.length, 3);
  assert.ok(!('protect' in snap), 'meaning is protected unless the link says otherwise');

  const influence = parseEmojiParams({ emojifx: 'influence:2500' }, SETS, PALETTE).treatment!;
  assert.equal(influence.mode, 'influence');
  assert.equal(influence.strengthBps, 2500);

  // Mono takes the brand's own accent; duotone the darkest and lightest, in that order.
  const mono = parseEmojiParams({ emojifx: 'mono' }, SETS, PALETTE).treatment!;
  assert.deepEqual('palette' in mono && mono.palette, [{ id: 'color.brand.primary', hex: '#30ba78' }]);
  const duotone = parseEmojiParams({ emojifx: 'duotone' }, SETS, PALETTE).treatment!;
  assert.deepEqual('palette' in duotone && duotone.palette, [{ id: 'color.ink', hex: '#0c322c' }, { id: 'color.paper', hex: '#ffffff' }]);

  // The suffix is what lets a treatment touch skin tones, flags and custom symbols.
  const loose = parseEmojiParams({ emojifx: 'snap,unprotected' }, SETS, PALETTE).treatment!;
  assert.deepEqual('protect' in loose && loose.protect, { skinTones: false, flags: false, custom: false });

  // Every treatment the parser emits is a style the resolver will accept.
  for (const value of ['original', 'snap', 'influence:1', 'influence:9999', 'mono', 'duotone', 'duotone,unprotected']) {
    const treatment = parseEmojiParams({ emojifx: value }, SETS, PALETTE).treatment!;
    assert.equal(validateEmojiStyle(styleWith(treatment)), null, value);
  }
});

test('a treatment the parser cannot honour is an issue, never a guess', () => {
  for (const value of ['influence', 'influence:0', 'influence:10000', 'influence:2500.5', 'influence:abc', 'sepia', 'snap,loud', '']) {
    const result = parseEmojiParams({ emojifx: value }, SETS, PALETTE);
    assert.equal(result.treatment, undefined, value);
    assert.equal(result.issues.length, value === '' ? 0 : 1, value);
    if (value !== '') assert.equal(result.issues[0]!.code, 'invalid-style', value);
  }
  // A brand with no colours cannot be snapped to, and the parser says so.
  const bare = parseEmojiParams({ emojifx: 'snap' }, SETS, []);
  assert.equal(bare.treatment, undefined);
  assert.match(bare.issues[0]!.message, /brand colours/);
  assert.equal(parseEmojiParams({ emojifx: 'duotone' }, SETS, [PALETTE[0]!]).treatment, undefined);
  // Colours arrive in whatever form the brand wrote them, and are pinned as #rrggbb.
  const mixed = parseEmojiParams({ emojifx: 'snap' }, SETS, [{ id: 'a', hex: '#ABC' }, { id: 'b', hex: '#11223344' }, { id: 'c', hex: 'rebeccapurple' } as EmojiPaletteEntry]);
  assert.deepEqual('palette' in mixed.treatment! && mixed.treatment.palette, [{ id: 'a', hex: '#aabbcc' }, { id: 'b', hex: '#112233' }]);
});

test('a saved style writes the two params, and they read back the same', () => {
  const cases: EmojiStyleV1['treatment'][] = [
    { mode: 'original', strengthBps: 0 },
    { mode: 'snap', strengthBps: 10000, palette: PALETTE, recipe: 'emoji-treatment-v1' },
    { mode: 'influence', strengthBps: 6500, palette: PALETTE, recipe: 'emoji-treatment-v1' },
    { mode: 'mono', strengthBps: 10000, palette: [PALETTE[1]!], recipe: 'emoji-treatment-v1' },
    { mode: 'duotone', strengthBps: 10000, palette: [PALETTE[0]!, PALETTE[2]!], recipe: 'emoji-treatment-v1' },
    { mode: 'snap', strengthBps: 10000, palette: PALETTE, protect: { skinTones: false, flags: false, custom: false }, recipe: 'emoji-treatment-v1' },
  ];
  for (const treatment of cases) {
    const params = emojiParams(styleWith(treatment));
    assert.equal(params.emoji, 'community/emoji/twemoji/color-starter@17.0.3');
    const back = parseEmojiParams({ emoji: params.emoji, emojifx: params.emojifx }, SETS, PALETTE);
    assert.deepEqual(back.issues, [], params.emojifx);
    assert.deepEqual(back.pin, STARTER);
    assert.deepEqual(back.treatment, treatment, params.emojifx);
  }
  assert.equal(emojiParams(styleWith(cases[2]!)).emojifx, 'influence:6500');
  assert.equal(emojiParams(styleWith(cases[5]!)).emojifx, 'snap,unprotected');
});

test('emoji and emojifx are reserved params on every surface', () => {
  assert.ok(RESERVED.has('emoji'));
  assert.ok(RESERVED.has('emojifx'));
  const manifest = { inputs: [{ id: 'heading', type: 'text' }, { id: 'emoji', type: 'text' }] } as unknown as InputManifest;
  const state = parseUrlState('heading=Hi&emoji=twemoji/color-starter@17.0.3&emojifx=mono', manifest);
  assert.equal(state.emoji, 'twemoji/color-starter@17.0.3');
  assert.equal(state.emojiFx, 'mono');
  assert.equal(state.values.heading, 'Hi');
  // Reserved wins over an input of the same name, which is why the catalog may
  // never mint one: no shipped tool has an `emoji` input id or urlKey.
  assert.equal(state.values.emoji, undefined);

  const blank = parseUrlState('heading=Hi', manifest);
  assert.equal(blank.emoji, null);
  assert.equal(blank.emojiFx, null);

  // Unlike ds and designv, both travel in a share link.
  const link = new URLSearchParams(serializeUrlState([], { emoji: 'community/emoji/twemoji/color-starter@17.0.3', emojiFx: 'influence:2500' }));
  assert.equal(link.get('emoji'), 'community/emoji/twemoji/color-starter@17.0.3');
  assert.equal(link.get('emojifx'), 'influence:2500');
  assert.equal(new URLSearchParams(serializeUrlState([], {})).has('emoji'), false);
  assert.equal(new URLSearchParams(serializeUrlState([], { emoji: '  ' })).has('emoji'), false);
});

test('a saved session carries the emoji stamp, and older records still open', () => {
  // v4 added the recorded licence decisions (plan 253) and v5 the picture reference
  // (plan 373). The emoji stamp is a v3 field and is unchanged by either, which is
  // what the older records below check.
  assert.equal(SESSION_FORMAT_VERSION, 5);
  assert.equal(SESSION_READER_VERSION, 5);
  assert.equal(sessionVersionStamp().formatVersion, 5);

  const data = { values: { heading: 'Hi' } };
  const warnings: string[] = [];
  const log = (level: 'warn' | 'info', message: string): void => { if (level === 'warn') warnings.push(message); };

  // A session written before the stamp existed opens unchanged and silently.
  for (const formatVersion of [undefined, 1, 2, 3, 4, 5]) {
    assert.deepEqual(migrateSessionRecord({ slot: 'a', data, formatVersion }, log), data);
  }
  assert.deepEqual(warnings, []);
  migrateSessionRecord({ slot: 'a', data, formatVersion: 6 }, log);
  assert.equal(warnings.length, 1, 'a record from a newer build is reported, not refused');

  assert.deepEqual(sessionEmojiStamp({ emoji: { emoji: ' twemoji/color-starter@17.0.3 ', emojifx: ' mono ' } }), {
    emoji: 'twemoji/color-starter@17.0.3', emojifx: 'mono',
  });
  assert.deepEqual(sessionEmojiStamp({ emoji: { emoji: 'a/b@1' } }), { emoji: 'a/b@1', emojifx: '' });
  for (const junk of [undefined, null, {}, { emoji: null }, { emoji: {} }, { emoji: { emoji: '' } }, { emoji: { emoji: 7 } }, { emoji: 'mono' }]) {
    assert.equal(sessionEmojiStamp(junk as { emoji?: unknown }), null, JSON.stringify(junk ?? null));
  }
});

test('a document link pins its full palette and fallbacks independently of another host', () => {
  const snapshot = styleWith({ mode: 'snap', strengthBps: 10000, recipe: 'emoji-treatment-v1', palette: PALETTE,
    protect: { skinTones: true, flags: false, custom: true } });
  snapshot.fallbacks = [SETS[1]!.pin];
  const params = emojiParams(snapshot);
  const restored = parseEmojiParams(params, [], [{ id: 'different', hex: '#123456' }]);
  assert.deepEqual(restored.style, snapshot);
  const query = serializeUrlState([], { emoji: params.emoji, emojiFx: params.emojifx, emojiStyle: params.emojistyle });
  assert.deepEqual(parseEmojiParams({ emojistyle: parseUrlState(query, { inputs: [] } as never).emojiStyle }).style, snapshot);
  assert.equal(sessionEmojiStamp({ emoji: params })?.emojistyle, params.emojistyle);
  assert.equal(parseEmojiParams({ ...params, emojistyle: '{bad' }, SETS, PALETTE).pin, undefined);
});
