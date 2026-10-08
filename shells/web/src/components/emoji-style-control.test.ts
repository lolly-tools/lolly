// SPDX-License-Identifier: MPL-2.0
/**
 * The shared emoji control - components/emoji-style-control.ts.
 *
 * Two promises are worth pinning. In document mode the emitted style PINS the
 * brand's colours at the moment of the choice, read from host.tokens.colors(),
 * so a file keeps the palette it was drawn with. In preference mode nothing but
 * the set, the mode and the strength leaves the control, because a seed has no
 * brand yet and must not carry one.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/emoji-style-control.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { EmojiPreferenceV1, EmojiSetInfoV1, EmojiStyleV1 } from '@lolly-tools/core/emoji-v1';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'localStorage']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}

const { mountEmojiStyleControl, EMOJI_SPECIMEN } = await import('./emoji-style-control.ts');
type ControlValue = EmojiStyleV1 | EmojiPreferenceV1 | null;

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

/** A ShareAlike set, so the adaptation note has something to be about. */
const SA_SET: EmojiSetInfoV1 = {
  pin: { id: 'community/emoji/openmoji/color', pin: { version: '17.0.0' }, checksum: `sha256:${'b'.repeat(64)}` },
  family: 'OpenMoji',
  style: 'Color',
  label: 'OpenMoji Color',
  license: 'CC-BY-SA-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  attribution: 'All emojis designed by OpenMoji. CC BY-SA 4.0.',
  glyphs: 4315,
  coverageComplete: true,
};
const SA_KEY = 'community/emoji/openmoji/color@17.0.0';

test('document emoji settings fold together and import stays a separate closed choice', async () => {
  const host = fakeHost();
  host.emoji!.install = async () => SET;
  const r = await rig({ mode: 'document', host, compactManagement: true });
  try {
    const section = r.root.querySelector<HTMLDetailsElement>('[data-emoji-manage]')!;
    assert.equal(section.open, false);
    assert.equal(r.root.querySelector('.emoji-style')!.children.length, 1);
    assert.ok(section.contains(r.root.querySelector('[data-emoji-set]')));
    const imports = section.querySelector<HTMLDetailsElement>('[data-emoji-import]')!;
    assert.equal(imports.open, false);
    assert.equal(imports.querySelector('.field-row .btn')!.textContent, 'Import file…');
    assert.equal(imports.querySelector('[role="status"]')!.textContent, '');
    const importInfo = imports.querySelector<HTMLButtonElement>('summary .help-tip-btn')!;
    importInfo.click();
    assert.equal(importInfo.getAttribute('aria-expanded'), 'true');
    assert.equal(imports.open, false, 'import help does not open the file-import section');
    const info = section.querySelector<HTMLButtonElement>('.help-tip-btn')!;
    assert.equal(info.getAttribute('aria-expanded'), 'false');
    info.click();
    assert.equal(info.getAttribute('aria-expanded'), 'true');
    assert.equal(section.open, false, 'requesting info does not expand the section');
    assert.equal(r.emitted.length, 0, 'opening settings never changes document artwork');
  } finally { r.destroy(); }
});

/** Two brand colours: one accent-named, one near-black, so mono and duotone both have an answer. */
const SWATCHES = [
  { ref: '{color.brand.primary}', value: '#0c322c' },
  { ref: '{color.brand.accent}', value: '#30ba78' },
  { ref: '{color.neutral.paper}', value: '#f2f2f2' },
];

function fakeHost(over: { sets?: EmojiSetInfoV1[]; colors?: typeof SWATCHES } = {}): HostV1 {
  return {
    emoji: {
      sets: async () => over.sets ?? [SET],
      manifest: async () => null,
      artwork: async () => null,
      parseXml: () => null,
    },
    tokens: { colors: async () => (over.colors ?? SWATCHES) },
  } as unknown as HostV1;
}

interface Rig {
  root: HTMLElement;
  emitted: ControlValue[];
  select(value: string): void;
  fx(id: string): void;
  key(fx: string, name: string): void;
  protect(on: boolean): void;
  destroy(): void;
}

async function rig(opts: { mode: 'document' | 'preference'; value?: ControlValue; host?: HostV1; specimen?: (style: EmojiStyleV1) => Promise<string>; compactManagement?: boolean }): Promise<Rig> {
  document.body.innerHTML = '';
  const root = document.createElement('div');
  document.body.appendChild(root);
  const emitted: ControlValue[] = [];
  const control = mountEmojiStyleControl(root, {
    host: opts.host ?? fakeHost(),
    mode: opts.mode,
    value: opts.value ?? null,
    onChange: (next) => emitted.push(next),
    compactManagement: opts.compactManagement,
    ...(opts.specimen ? { specimen: opts.specimen } : {}),
  });
  // The listing and the palette both arrive on a microtask; the control renders twice.
  await new Promise((r) => setTimeout(r, 0));
  return {
    root,
    emitted,
    select(value: string) {
      const el = root.querySelector<HTMLSelectElement>('[data-emoji-set]')!;
      el.value = value;
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    },
    fx(id: string) {
      root.querySelector<HTMLElement>(`[data-emoji-fx="${id}"]`)!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    },
    key(fx: string, name: string) {
      root.querySelector<HTMLElement>(`[data-emoji-fx="${fx}"]`)!
        .dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: name, bubbles: true }));
    },
    protect(on: boolean) {
      const el = root.querySelector<HTMLInputElement>('[data-emoji-protect]')!;
      el.checked = on;
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    },
    destroy: () => control.destroy(),
  };
}

test('the set list offers every host set plus the empty prompt', async () => {
  const r = await rig({ mode: 'document' });
  const options = [...r.root.querySelectorAll('option')].map((o) => o.value);
  assert.deepEqual(options, ['', 'community/emoji/twemoji/color-starter@17.0.3']);
  const labelled = r.root.querySelector('option[value$="17.0.3"]')!.textContent!;
  assert.ok(labelled.includes('Twemoji Color (starter)'), 'the set names itself');
  assert.ok(labelled.includes('180'), 'the glyph count is on the option');
  assert.ok(labelled.includes('CC BY 4.0'), 'the licence is named on the option, before the choice is made');
  assert.ok(!labelled.includes('CC-BY-4.0'), 'and it is the canonical name, not the catalog spelling');
  r.destroy();
});

test('a licence nothing recognises is shown in the set\'s own words', async () => {
  const odd: EmojiSetInfoV1 = { ...SET, license: 'Handshake with the artist' };
  const r = await rig({ mode: 'document', host: fakeHost({ sets: [odd] }) });
  assert.ok(r.root.querySelector('option[value$="17.0.3"]')!.textContent!.includes('Handshake with the artist'));
  r.destroy();
});

test('a recoloured ShareAlike set says so, and still lets the treatment stand', async () => {
  const r = await rig({ mode: 'document', host: fakeHost({ sets: [SA_SET] }) });
  const labelled = r.root.querySelector('option[value$="17.0.0"]')!.textContent!;
  assert.ok(labelled.includes('CC BY-SA 4.0'), 'the set names its licence');
  r.select(SA_KEY);
  assert.equal(r.root.querySelector('[data-emoji-sa-note]'), null, 'untouched artwork is no adaptation');

  r.fx('full');
  const note = r.root.querySelector('[data-emoji-sa-note]');
  assert.ok(note, 'a recoloured ShareAlike set says what that makes it');
  assert.ok(note!.textContent!.includes('compatible licence'), 'and where the choice will be asked for');
  const style = r.emitted.at(-1) as EmojiStyleV1;
  assert.equal(style.treatment.mode, 'snap', 'the treatment the person chose is still what was emitted');
  assert.equal(r.root.querySelectorAll('[data-emoji-fx]').length, 6, 'and every treatment is still offered');

  r.fx('off');
  assert.equal(r.root.querySelector('[data-emoji-sa-note]'), null, 'going back to the original artwork clears it');
  r.destroy();
});

test('an attribution-only set never shows the adaptation note', async () => {
  const r = await rig({ mode: 'document' });
  r.select('community/emoji/twemoji/color-starter@17.0.3');
  r.fx('full');
  assert.equal(r.root.querySelector('[data-emoji-sa-note]'), null, 'CC BY carries no ShareAlike condition');
  r.destroy();
});

test('document mode emits a style whose palette is pinned from host.tokens.colors()', async () => {
  const r = await rig({ mode: 'document' });
  r.select('community/emoji/twemoji/color-starter@17.0.3');
  r.fx('strong');
  const style = r.emitted.at(-1) as EmojiStyleV1;
  assert.equal(style.schemaVersion, 1);
  assert.equal(style.primary.id, SET.pin.id);
  assert.equal(style.primary.checksum, SET.pin.checksum, 'the checksum comes from the host listing, never from the control');
  assert.equal(style.metricsPolicy, 'inline-em-v1');
  assert.equal(style.treatment.mode, 'influence');
  assert.equal(style.treatment.strengthBps, 6500);
  const palette = 'palette' in style.treatment ? style.treatment.palette : [];
  assert.deepEqual(palette, SWATCHES.map((s) => ({ id: s.ref, hex: s.value })), 'every brand colour is pinned into the style');
  r.destroy();
});

test('Mono pins exactly one colour and Duotone exactly two', async () => {
  const r = await rig({ mode: 'document' });
  r.select('community/emoji/twemoji/color-starter@17.0.3');
  r.fx('mono');
  const mono = r.emitted.at(-1) as EmojiStyleV1;
  assert.equal(mono.treatment.mode, 'mono');
  assert.deepEqual('palette' in mono.treatment ? mono.treatment.palette : [], [{ id: '{color.brand.primary}', hex: '#0c322c' }]);
  r.fx('duotone');
  const duo = r.emitted.at(-1) as EmojiStyleV1;
  assert.equal(duo.treatment.mode, 'duotone');
  const palette = 'palette' in duo.treatment ? duo.treatment.palette : [];
  assert.equal(palette.length, 2);
  assert.equal(palette[0]!.hex, '#0c322c', 'the darkest colour leads');
  assert.equal(palette[1]!.hex, '#f2f2f2', 'the lightest colour follows');
  r.destroy();
});

test('turning off "Keep skin tones and flags" writes the unprotected treatment', async () => {
  const r = await rig({ mode: 'document' });
  r.select('community/emoji/twemoji/color-starter@17.0.3');
  r.fx('full');
  r.protect(false);
  const style = r.emitted.at(-1) as EmojiStyleV1;
  assert.equal(style.treatment.mode, 'snap');
  assert.deepEqual('protect' in style.treatment ? style.treatment.protect : undefined, { skinTones: false, flags: false, custom: false });
  r.protect(true);
  const back = r.emitted.at(-1) as EmojiStyleV1;
  assert.equal('protect' in back.treatment ? back.treatment.protect : undefined, undefined, 'protection on is the default, so nothing is written');
  r.destroy();
});

test('preference mode emits only pin, mode and strength', async () => {
  const r = await rig({ mode: 'preference' });
  r.select('community/emoji/twemoji/color-starter@17.0.3');
  r.fx('subtle');
  const pref = r.emitted.at(-1) as EmojiPreferenceV1;
  assert.deepEqual(Object.keys(pref).sort(), ['mode', 'pin', 'strengthBps']);
  assert.equal(pref.mode, 'influence');
  assert.equal(pref.strengthBps, 2500);
  assert.deepEqual(pref.pin, SET.pin);
  assert.ok(!r.root.querySelector('[data-emoji-specimen]'), 'the profile page shows no specimen');
  r.destroy();
});

test('choosing the empty option clears the choice', async () => {
  const r = await rig({ mode: 'document' });
  r.select('community/emoji/twemoji/color-starter@17.0.3');
  r.select('');
  assert.equal(r.emitted.at(-1), null);
  assert.ok(!r.root.querySelector('[data-emoji-fx-group]'), 'there is nothing to treat until a set is chosen');
  r.destroy();
});

test('the specimen row is filled by the caller, with the style it just emitted', async () => {
  const seen: EmojiStyleV1[] = [];
  const r = await rig({
    mode: 'document',
    specimen: async (style) => { seen.push(style); return '<span class="lolly-emoji">drawn</span>'; },
  });
  r.select('community/emoji/twemoji/color-starter@17.0.3');
  await new Promise((res) => setTimeout(res, 0));
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.primary.id, SET.pin.id);
  assert.equal(r.root.querySelector('[data-emoji-specimen]')!.innerHTML, '<span class="lolly-emoji">drawn</span>');
  assert.equal(EMOJI_SPECIMEN.length > 0, true, 'the specimen text is exported for the caller to draw');
  r.destroy();
});

test('a saved style reads back onto the control', async () => {
  const value: EmojiStyleV1 = {
    schemaVersion: 1,
    primary: SET.pin,
    fallbacks: [],
    metricsPolicy: 'inline-em-v1',
    treatment: { mode: 'mono', strengthBps: 10000, palette: [{ id: '{color.brand.accent}', hex: '#30ba78' }], recipe: 'emoji-treatment-v1' },
  };
  const r = await rig({ mode: 'document', value });
  assert.equal(r.root.querySelector<HTMLSelectElement>('[data-emoji-set]')!.value, 'community/emoji/twemoji/color-starter@17.0.3');
  assert.equal(r.root.querySelector('[data-emoji-fx="mono"]')!.getAttribute('aria-checked'), 'true');
  r.destroy();
});

test('a host with no emoji API lists no sets and emits nothing', async () => {
  const r = await rig({ mode: 'document', host: {} as HostV1 });
  assert.deepEqual([...r.root.querySelectorAll('option')].map((o) => o.value), ['']);
  assert.deepEqual(r.emitted, []);
  r.destroy();
});

test('the treatment group answers the arrow keys, so it is reachable without a mouse', async () => {
  const r = await rig({ mode: 'document' });
  r.select('community/emoji/twemoji/color-starter@17.0.3');
  const checked = (): string => r.root.querySelector('[data-emoji-fx][aria-checked="true"]')!.getAttribute('data-emoji-fx')!;
  assert.equal(checked(), 'off', 'a fresh choice starts on Off');

  r.key('off', 'ArrowRight');
  assert.equal(checked(), 'subtle');
  r.key('subtle', 'ArrowDown');
  assert.equal(checked(), 'strong');
  r.key('strong', 'ArrowLeft');
  assert.equal(checked(), 'subtle');
  r.key('subtle', 'End');
  assert.equal(checked(), 'duotone');
  r.key('duotone', 'ArrowRight');
  assert.equal(checked(), 'off', 'the group wraps');
  r.key('off', 'Home');
  assert.equal(checked(), 'off');
  r.destroy();
});

test('the keyboard stays on the control that was operated', async () => {
  const r = await rig({ mode: 'document' });
  r.select('community/emoji/twemoji/color-starter@17.0.3');
  r.root.querySelector<HTMLElement>('[data-emoji-fx="off"]')!.focus();
  r.key('off', 'ArrowRight');
  const active = document.activeElement as HTMLElement;
  assert.equal(active.getAttribute('data-emoji-fx'), 'subtle', 'focus follows the newly checked option');
  assert.ok(r.root.contains(active), 'and never falls back to the body');

  const select = r.root.querySelector<HTMLSelectElement>('[data-emoji-set]')!;
  select.focus();
  r.select('');
  assert.equal((document.activeElement as HTMLElement).hasAttribute('data-emoji-set'), true, 'the set picker keeps the keyboard too');
  r.destroy();
});

test('the protect switch is a document setting, and the profile page never shows it', async () => {
  const doc = await rig({ mode: 'document' });
  doc.select('community/emoji/twemoji/color-starter@17.0.3');
  assert.ok(doc.root.querySelector('[data-emoji-protect]'), 'a document can protect skin tones and flags');
  assert.ok(doc.root.querySelector('.field-toggle .field-check'), 'and it uses the house tick, not a bare UA checkbox');
  doc.destroy();

  const pref = await rig({ mode: 'preference' });
  pref.select('community/emoji/twemoji/color-starter@17.0.3');
  assert.equal(pref.root.querySelector('[data-emoji-protect]'), null, 'a preference carries no protection field to write');
  pref.destroy();
});

test('two mounts in one document never share the treatment label', async () => {
  document.body.innerHTML = '';
  const roots = [document.createElement('div'), document.createElement('div')];
  for (const root of roots) document.body.appendChild(root);
  const value: EmojiStyleV1 = {
    schemaVersion: 1, primary: SET.pin, fallbacks: [], metricsPolicy: 'inline-em-v1',
    treatment: { mode: 'original', strengthBps: 0 },
  };
  const controls = roots.map((root) => mountEmojiStyleControl(root, {
    host: fakeHost(), mode: 'document', value, onChange: () => {},
  }));
  await new Promise((r) => setTimeout(r, 0));
  const ids = [...document.querySelectorAll('[data-emoji-fx-group]')].map((g) => g.getAttribute('aria-labelledby'));
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1], 'each mount labels its own group');
  for (const id of ids) assert.equal(document.querySelectorAll(`#${id}`).length, 1, 'and that id is unique');
  for (const control of controls) control.destroy();
});

test('Inspector remounts retain disclosure state even before toggle events arrive', () => {
  const root = document.createElement('div'); document.body.append(root);
  const host = fakeHost(); host.emoji!.install = async () => SET;
  const disclosureState = { management: false, import: false };
  const options = { host, mode: 'document' as const, value: null, sets: [SET], palette: [],
    compactManagement: true, disclosureState, onChange: () => {} };
  const first = mountEmojiStyleControl(root, options);
  root.querySelector<HTMLDetailsElement>('[data-emoji-manage]')!.open = true;
  root.querySelector<HTMLDetailsElement>('[data-emoji-import]')!.open = true;
  first.destroy();
  const second = mountEmojiStyleControl(root, options);
  assert.equal(root.querySelector<HTMLDetailsElement>('[data-emoji-manage]')!.open, true);
  assert.equal(root.querySelector<HTMLDetailsElement>('[data-emoji-import]')!.open, true);
  second.destroy(); root.remove();
});
