// SPDX-License-Identifier: MPL-2.0
/**
 * The tool sidebar's Emoji section - views/tool/emoji-section.ts.
 *
 * Three promises: the section stays out of the way until the host actually has a
 * set to offer, the seed order puts a link above a saved session above a device
 * preference, and every change hands the view the exact params a link, a session
 * stamp and the CLI all parse.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/tool/emoji-section.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { EmojiSetInfoV1, EmojiStyleV1 } from '@lolly-tools/core/emoji-v1';
import { DEFAULT_EMOJI_PIN, defaultEmojiStyle } from '../../../../../engine/src/emoji-default.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}

const { mountEmojiSection, showEmojiSection, emojiStyleFrom } = await import('./emoji-section.ts');
import type { EmojiParamPair } from '../../lib/emoji-prefs.ts';

const SET: EmojiSetInfoV1 = {
  pin: { id: 'community/emoji/twemoji/color-starter', pin: { version: '17.0.3' }, checksum: `sha256:${'a'.repeat(64)}` },
  family: 'Twemoji',
  style: 'Color (starter)',
  label: 'Twemoji Color (starter)',
  license: 'CC-BY-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: 'Twemoji by Twitter, licensed CC BY 4.0.',
  glyphs: 180,
  coverageComplete: false,
};
const SET_KEY = 'community/emoji/twemoji/color-starter@17.0.3';
const SWATCHES = [{ ref: '{color.brand.primary}', value: '#0c322c' }, { ref: '{color.brand.accent}', value: '#30ba78' }];

function fakeHost(over: { sets?: EmojiSetInfoV1[]; profile?: Record<string, unknown> } = {}): HostV1 {
  return {
    emoji: { sets: async () => over.sets ?? [SET], manifest: async () => null, artwork: async () => null, parseXml: () => null },
    tokens: { colors: async () => SWATCHES },
    profile: { get: async () => over.profile ?? {}, subscribe: () => () => {} },
  } as unknown as HostV1;
}

type EmojiState = { present: boolean; replaced: number; unresolved: number; style: EmojiStyleV1 | null };

interface FakeRuntime {
  emoji: EmojiState;
  onEmojiChange(fn: (s: EmojiState) => void): () => void;
  setEmojiStyle(style: EmojiStyleV1 | null): Promise<void>;
  applyEmojiToDom(node: unknown): Promise<unknown>;
  styles: (EmojiStyleV1 | null)[];
  walked: unknown[];
  announce(next: Partial<EmojiState>): void;
}

/** A render that already carries emoji, which is what makes the section relevant. */
function fakeRuntime(present = true, over: Partial<EmojiState> = {}): FakeRuntime {
  const listeners = new Set<(s: EmojiState) => void>();
  const state: EmojiState = { present, replaced: 1, unresolved: 0, style: null, ...over };
  return {
    emoji: state,
    styles: [],
    walked: [],
    onEmojiChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async setEmojiStyle(style) { this.styles.push(style); state.style = style; },
    async applyEmojiToDom(node) {
      this.walked.push(node);
      // Stand in for the engine pass: what matters here is only that the section
      // draws its specimen through the runtime rather than through a font.
      const el = node as { innerHTML?: string };
      if (el && typeof el === 'object') el.innerHTML = '<span class="lolly-emoji">artwork</span>';
      return { present: true, replaced: 5, unresolved: 0, census: [] };
    },
    announce(next: Partial<EmojiState>) { Object.assign(state, next); for (const fn of listeners) fn({ ...state }); },
  };
}

function sidebar(): HTMLElement {
  document.body.innerHTML = `
    <div id="view">
      <div id="tool-inputs"></div>
      <details class="input-section" id="emoji-section" hidden>
        <summary class="input-section-summary">Emoji</summary>
        <div class="input-section-body" id="emoji-section-body"></div>
      </details>
    </div>`;
  return document.getElementById('view')!;
}

const sectionState = (over: Partial<EmojiState> = {}): EmojiState =>
  ({ present: true, replaced: 0, unresolved: 0, style: null, ...over });

test('showEmojiSection hides a shell with no packs, no sets, or nothing to say', () => {
  assert.equal(showEmojiSection(sectionState({ replaced: 2 }), 1), true, 'the render drew emoji');
  assert.equal(showEmojiSection(sectionState({ unresolved: 1 }), 1), true, 'or wanted to and could not');
  assert.equal(showEmojiSection(sectionState({ style: { schemaVersion: 1, primary: SET.pin, fallbacks: [], metricsPolicy: 'inline-em-v1', treatment: { mode: 'original', strengthBps: 0 } } }), 1), true, 'or a set is chosen');
  // `present` is a host capability, not a fact about this render: gating on it
  // alone put a permanent Emoji section on the QR code tool.
  assert.equal(showEmojiSection(sectionState(), 1), false, 'a render with no emoji in it has nothing to offer');
  assert.equal(showEmojiSection(sectionState({ replaced: 2 }), 0), false, 'nothing to choose is not an offer');
  assert.equal(showEmojiSection(sectionState({ present: false, replaced: 2 }), 1), false);
});

test('the section stays hidden until the runtime reports the host can load sets', async () => {
  const root = sidebar();
  const runtime = fakeRuntime(false);
  const section = document.getElementById('emoji-section')!;
  const mounted = await mountEmojiSection({ root, host: fakeHost(), runtime, onStyle: () => {} });
  assert.equal(section.hasAttribute('hidden'), true, 'a host with no emoji API shows nothing');
  runtime.announce({ present: true });
  assert.equal(section.hasAttribute('hidden'), false, 'the section appears the moment the runtime says it can');
  assert.ok(root.querySelector('[data-emoji-set]'), 'the control is mounted in the section body');
  mounted.destroy();
});

test('a link beats the saved session, which beats the profile preference', async () => {
  const host = fakeHost({
    sets: [SET, { ...SET, pin: { id: 'community/emoji/openmoji/color', pin: { version: '17.0.0' }, checksum: `sha256:${'b'.repeat(64)}` }, label: 'OpenMoji Color' }],
    profile: { emoji: { pin: SET.pin, mode: 'snap', strengthBps: 10000 } },
  });
  const seen: (EmojiParamPair | null)[] = [];
  const runtime = fakeRuntime();
  await mountEmojiSection({
    root: sidebar(), host, runtime,
    url: { emoji: 'openmoji/color@17.0.0', emojifx: 'mono' },
    session: { emoji: SET_KEY, emojifx: 'snap' },
    onStyle: (_s, params) => seen.push(params),
  });
  assert.deepEqual(seen.at(-1), { emoji: 'community/emoji/openmoji/color@17.0.0', emojifx: 'mono', emojistyle: JSON.stringify(runtime.emoji.style) });

  const fromSession: (EmojiParamPair | null)[] = [];
  await mountEmojiSection({
    root: sidebar(), host, runtime, session: { emoji: SET_KEY, emojifx: 'snap' },
    onStyle: (_s, params) => fromSession.push(params),
  });
  assert.deepEqual(fromSession.at(-1), { emoji: SET_KEY, emojifx: 'snap', emojistyle: JSON.stringify(runtime.emoji.style) });

  const fromProfile: (EmojiParamPair | null)[] = [];
  await mountEmojiSection({ root: sidebar(), host, runtime, onStyle: (_s, params) => fromProfile.push(params) });
  assert.deepEqual(fromProfile.at(-1), { emoji: SET_KEY, emojifx: 'snap', emojistyle: JSON.stringify(runtime.emoji.style) });
});

test('a seed with no set chosen anywhere sets no style and writes no params', async () => {
  const runtime = fakeRuntime();
  const seen: unknown[] = [];
  const mounted = await mountEmojiSection({ root: sidebar(), host: fakeHost(), runtime, onStyle: (s, p) => seen.push([s, p]) });
  assert.deepEqual(seen, []);
  assert.deepEqual(runtime.styles, []);
  assert.equal(mounted.style, null);
  mounted.destroy();
});

test('the runtime default reaches the document and share link, while explicit overrides win', async () => {
  const initial = defaultEmojiStyle([{ pin: DEFAULT_EMOJI_PIN }])!;
  const host = fakeHost({ sets: [SET, { ...SET, pin: DEFAULT_EMOJI_PIN, label: 'Fluent High Contrast' }] });
  const runtime = fakeRuntime(true, { style: initial, replaced: 0 });
  const written: (EmojiParamPair | null)[] = [];
  const mounted = await mountEmojiSection({ root: sidebar(), host, runtime, onStyle: (_s, p) => written.push(p) });
  assert.deepEqual(mounted.style, initial);
  assert.equal(written.at(-1)?.emojistyle, JSON.stringify(initial));
  assert.equal(showEmojiSection(runtime.emoji, 2), false, 'an unused default stays out of the sidebar');
  runtime.announce({ replaced: 1 });
  assert.equal(showEmojiSection(runtime.emoji, 2), true);
  mounted.destroy();

  for (const emoji of ['none', 'not/installed@1.0.0', SET_KEY]) {
    const current = fakeRuntime(true, { style: initial });
    const section = await mountEmojiSection({
      root: sidebar(), host, runtime: current,
      url: { emoji, emojifx: 'original' }, onStyle: () => {},
    });
    assert.equal(current.emoji.style?.primary.id ?? null, emoji === SET_KEY ? SET.pin.id : null);
    section.destroy();
  }
});

test('changing the set drives the runtime and hands the view the URL params', async () => {
  const root = sidebar();
  const runtime = fakeRuntime();
  const seen: (EmojiParamPair | null)[] = [];
  const mounted = await mountEmojiSection({ root, host: fakeHost(), runtime, onStyle: (_s, params) => seen.push(params) });
  const select = root.querySelector<HTMLSelectElement>('[data-emoji-set]')!;
  select.value = SET_KEY;
  select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(seen.at(-1), { emoji: SET_KEY, emojifx: 'original', emojistyle: JSON.stringify(runtime.emoji.style) });
  assert.equal(runtime.styles.at(-1)!.primary.id, SET.pin.id);

  root.querySelector<HTMLElement>('[data-emoji-fx="mono"]')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(seen.at(-1), { emoji: SET_KEY, emojifx: 'mono', emojistyle: JSON.stringify(runtime.emoji.style) });
  const style = runtime.styles.at(-1)!;
  assert.equal(style.treatment.mode, 'mono');
  assert.deepEqual('palette' in style.treatment ? style.treatment.palette : [], [{ id: '{color.brand.primary}', hex: '#0c322c' }]);

  // Clearing the choice is a change like any other, and must reach every writer.
  // Re-queried: every choice re-renders the control, so the old node is detached.
  const live = root.querySelector<HTMLSelectElement>('[data-emoji-set]')!;
  live.value = '';
  live.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(seen.at(-1), { emoji: 'none', emojifx: '' });
  assert.equal(runtime.styles.at(-1), null);
  mounted.destroy();
});

test('the specimen is drawn through the runtime, and the canvas is redrawn after it', async () => {
  const root = sidebar();
  const runtime = fakeRuntime();
  const canvas = document.createElement('div');
  const mounted = await mountEmojiSection({ root, host: fakeHost(), runtime, canvas: () => canvas, onStyle: () => {} });
  const select = root.querySelector<HTMLSelectElement>('[data-emoji-set]')!;
  select.value = SET_KEY;
  select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(runtime.walked.length, 0, 'nothing is drawn while the section is closed, because drawing loads the whole set');
  const section = root.querySelector<HTMLDetailsElement>('#emoji-section')!;
  section.open = true;
  section.dispatchEvent(new dom.window.Event('toggle'));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(root.querySelector('[data-emoji-specimen]')!.innerHTML, '<span class="lolly-emoji">artwork</span>');
  assert.equal(runtime.walked.at(-1), canvas, 'the canvas is the last tree walked, so the next change redraws it');
  mounted.destroy();
});

test('a hidden section never loads a set for its specimen', async () => {
  // The state every tool opens in: the shipped default in force and no emoji drawn.
  const style = defaultEmojiStyle([{ pin: DEFAULT_EMOJI_PIN }]);
  const root = sidebar();
  const runtime = fakeRuntime(true, { replaced: 0, unresolved: 0, style });
  const mounted = await mountEmojiSection({ root, host: fakeHost(), runtime, onStyle: () => {} });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(root.querySelector<HTMLDetailsElement>('#emoji-section')!.hidden, true);
  assert.ok(root.querySelector('[data-emoji-specimen]'), 'the control is there, ready to fill when someone opens it');
  assert.deepEqual(runtime.walked, [], 'a tool with no emoji asks the runtime to draw nothing');
  mounted.destroy();
});

test('the first placeholder with no set chosen opens the section once', async () => {
  const root = sidebar();
  const runtime = fakeRuntime(true, { replaced: 0, unresolved: 0 });
  const section = document.getElementById('emoji-section') as HTMLDetailsElement;
  const mounted = await mountEmojiSection({ root, host: fakeHost(), runtime, onStyle: () => {} });
  assert.equal(section.open, false, 'nothing to explain yet');

  runtime.announce({ unresolved: 3 });
  assert.equal(section.hidden, false);
  assert.equal(section.open, true, 'the sentence that explains the grey squares is in view');

  // Once. A person who closes it again is not argued with.
  section.open = false;
  runtime.announce({ unresolved: 4 });
  assert.equal(section.open, false);
  mounted.destroy();
});

test('emojiStyleFrom refuses a set this device does not hold', () => {
  assert.equal(emojiStyleFrom({ emoji: 'nobody/here@1.0.0', emojifx: 'mono' }, [SET], []), null);
  assert.equal(emojiStyleFrom(null, [SET], []), null);
  const style = emojiStyleFrom({ emoji: SET_KEY, emojifx: '' }, [SET], [])!;
  assert.equal(style.treatment.mode, 'original', 'no treatment named is the untouched artwork, never a guess');
  assert.deepEqual(style.primary, SET.pin, 'the checksum comes from the listing, never from the link');
});

test('picker choices update the sidebar, document writer and chromeless dock exactly once', async () => {
  for (const chromeless of [false, true]) {
    const root = sidebar();
    if (chromeless) root.querySelector('#emoji-section')!.remove();
    const runtime = fakeRuntime();
    const written: (EmojiParamPair | null)[] = [];
    const mounted = await mountEmojiSection({ root, host: fakeHost(), runtime, onStyle: (_style, params) => written.push(params) });
    const style = emojiStyleFrom({ emoji: SET_KEY, emojifx: 'original' }, [SET], []);
    runtime.announce({ style });
    runtime.announce({ replaced: 3 });
    assert.equal(mounted.style?.primary.id, SET.pin.id);
    assert.deepEqual(written, [{ emoji: SET_KEY, emojifx: 'original', emojistyle: JSON.stringify(style) }]);
    if (!chromeless) assert.equal(root.querySelector<HTMLSelectElement>('[data-emoji-set]')!.value, SET_KEY);
    runtime.announce({ style: null });
    assert.deepEqual(written.at(-1), { emoji: 'none', emojifx: '' });
    mounted.destroy();
    runtime.announce({ style });
    assert.equal(written.length, 2);
  }
});
