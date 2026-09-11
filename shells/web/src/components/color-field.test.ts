// SPDX-License-Identifier: MPL-2.0
/**
 * The shared colour field: its pure track builder, its markup contract, and the
 * four traps that have each cost real hours here.
 *
 * The first two tests are DOM-free (the module only touches document inside its
 * wiring functions, so importing it under node:test is safe); the rest mount the
 * field into jsdom and drive it. Run directly:
 *   node --test shells/web/src/components/color-field.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import {
  lchTrackGradients, LCH_MAX, colorFieldHtml, wireColorField, setSwatches, runBoundaries,
  swatchName, resolveColorVar, colorVarLabel,
} from './color-field.ts';
import type { ColorChangeDetail, ColorFieldValue, WireColorFieldOpts } from './color-field.ts';
import { colorSpaces } from './color-spaces.ts';

test('each axis track sweeps its own range while holding the other two', () => {
  const t = lchTrackGradients(0.62, 0.11, 250);
  // L: 9 stops from 0% to 100%, C and H fixed at the current value.
  assert.equal((t.l.match(/oklch\(/g) ?? []).length, 9);
  assert.ok(t.l.startsWith('linear-gradient(to right, oklch(0% 0.11 250)'));
  assert.ok(t.l.endsWith('oklch(100% 0.11 250))'));
  // C: 0 → LCH_MAX.c at the current L/H.
  assert.ok(t.c.includes('oklch(62% 0 250)'));
  assert.ok(t.c.endsWith(`oklch(62% ${LCH_MAX.c} 250))`));
  // H: 13 stops (every 30°), closing the wheel at 360.
  assert.equal((t.h.match(/oklch\(/g) ?? []).length, 13);
  assert.ok(t.h.endsWith('oklch(62% 0.11 360))'));
});

test('the hue track floors chroma so the sweep stays visible near grey', () => {
  const t = lchTrackGradients(0.5, 0, 0);
  assert.ok(t.h.includes('oklch(50% 0.08 '), 'hue stops use the 0.08 floor, not the real C=0');
  // …but the chroma track itself must still start at the true zero.
  assert.ok(t.c.includes('oklch(50% 0 0)'));
});

// ── jsdom harness ────────────────────────────────────────────────────────────

const dom = new JSDOM(
  '<!doctype html><html><body><div id="host"></div><button id="away">away</button></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Event = dom.window.Event;
// The focusout handler asks whether focus landed on a node inside the field.
globalThis.Node = dom.window.Node;
// positionPopover walks computed styles looking for a fixed containing block.
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
  dom.window.setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame;
(dom.window as unknown as { CSS: { escape(s: string): string } }).CSS = {
  escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
};
globalThis.CSS = (dom.window as unknown as { CSS: typeof globalThis.CSS }).CSS;

interface Emitted { id: string; value: ColorFieldValue; detail: ColorChangeDetail }

/** Render + wire one field, recording everything it emits. */
function mount(value: unknown, opts: Parameters<typeof colorFieldHtml>[2] = {}, wire: WireColorFieldOpts = {}): {
  field: HTMLElement; seen: Emitted[];
} {
  const host = document.getElementById('host')!;
  host.innerHTML = colorFieldHtml('cf', value, opts);
  const seen: Emitted[] = [];
  wireColorField(host, { ...wire, onChange: (id, v, detail) => { seen.push({ id, value: v, detail }); } });
  return { field: host.querySelector<HTMLElement>('[data-color-field]')!, seen };
}

const fire = (el: Element, type = 'input'): void => {
  el.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
};

/** Click a space tab. */
const selectSpace = (field: HTMLElement, mode: string): void => {
  field.querySelector<HTMLElement>(`[data-mode="${mode}"]`)!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
};

/** Let the queued repaint (one rAF, mapped to a timer here) run. */
const settlePaint = (): Promise<void> => new Promise(r => { dom.window.setTimeout(() => r(), 0); });

const wait = (ms: number): Promise<void> => new Promise(r => { dom.window.setTimeout(() => r(), ms); });

const noteText = (field: HTMLElement): string => field.querySelector('.color-space-note')!.textContent ?? '';

/** One panel's slider values, in channel order. */
const sliderValues = (field: HTMLElement, mode: string): string[] =>
  [...field.querySelectorAll<HTMLInputElement>(`[data-space-group="${mode}"] [data-mode-ch]`)].map(i => i.value);

/** Drag one channel slider of the active space panel to `to` (display units). */
function drag(field: HTMLElement, mode: string, ch: string, to: number): void {
  const slider = field.querySelector<HTMLInputElement>(`[data-space-group="${mode}"] [data-mode-ch="${ch}"]`)!;
  assert.ok(slider, `no ${mode}/${ch} slider`);
  slider.value = String(to);
  fire(slider);
}

const valueInput = (field: HTMLElement): HTMLInputElement =>
  field.querySelector<HTMLInputElement>('.color-input[data-color-hex]')!;

/** Type into the value field, the way a paste lands. */
function type(field: HTMLElement, text: string): void {
  const input = valueInput(field);
  input.value = text;
  fire(input);
}

// ── Trap 1: nothing may emit at mount ────────────────────────────────────────

test('wiring a field emits NOTHING - no mount-time echo, in any configuration', () => {
  // The bug this pins: the picker used to emit an onChange while wiring up,
  // carrying the sRGB hex it had just been handed. A host that treats that as a
  // user edit overwrites its own state - in Colour Lab it made EVERY colour report
  // "sRGB" regardless of what was authored. jsdom never fires `input`, so this
  // assertion is the only guard there is.
  for (const opts of [
    {},
    { float: true },
    { inline: true },
    { inline: true, modes: true },
    { float: true, modes: true, dials: true },
    { swatchesOnly: true },
    { block: true },
  ]) {
    for (const v of ['#30ba78', '#30ba7880', 'transparent', '', 'not a colour', 'color(display-p3 1 0 0)']) {
      const { seen } = mount(v, opts);
      assert.equal(seen.length, 0, `emitted on mount for ${JSON.stringify({ v, opts })}`);
    }
  }
});

test('switching space emits nothing - it changes the numbers, not the colour', () => {
  const { field, seen } = mount('#30ba78', { inline: true, modes: true });
  const modes = field.querySelector<HTMLElement>('[data-color-modes]')!;
  for (const spec of colorSpaces()) {
    field.querySelector<HTMLElement>(`[data-mode="${spec.mode}"]`)!
      .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.equal(modes.dataset.activeMode, spec.mode);
    const panel = field.querySelector<HTMLElement>(`[data-space-group="${spec.mode}"]`)!;
    assert.equal(panel.hidden, false, `${spec.mode}'s panel is visible`);
    assert.equal(field.querySelectorAll('[data-space-group]:not([hidden])').length, 1, 'exactly one panel shows');
  }
  assert.equal(seen.length, 0, 'a mode switch must never emit');
  // …and the value field re-notates into the space being edited.
  field.querySelector<HTMLElement>('[data-mode="hex"]')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(valueInput(field).value, '#30ba78');
  field.querySelector<HTMLElement>('[data-mode="oklch"]')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.match(valueInput(field).value, /^oklch\(/);
});

// ── The tab strip ────────────────────────────────────────────────────────────

test('one flat tablist, grouped into three labelled families, wired to its panels', () => {
  const { field } = mount('#30ba78', { inline: true, modes: true });
  assert.equal(field.querySelectorAll('[role="tablist"]').length, 1, 'ONE tablist - not one per family');
  const tabs = [...field.querySelectorAll<HTMLElement>('[role="tab"]')];
  assert.equal(tabs.length, colorSpaces().length);
  // Order in the registry IS visual order IS arrow-key order.
  assert.deepEqual(tabs.map(t => t.dataset.mode), colorSpaces().map(s => s.mode));
  // Three presentational family wrappers with aria-hidden labels; the family
  // reaches assistive tech through each tab's own aria-label instead.
  const fams = [...field.querySelectorAll<HTMLElement>('.color-mode-fam')];
  assert.deepEqual(fams.map(f => f.dataset.modeFamily), ['perceptual', 'device', 'output']);
  for (const f of fams) {
    assert.equal(f.getAttribute('role'), 'presentation');
    assert.equal(f.querySelector('.color-mode-fam-label')!.getAttribute('aria-hidden'), 'true');
  }
  assert.match(field.querySelector<HTMLElement>('[data-mode="oklch"]')!.getAttribute('aria-label')!,
    /^OKLCH, perceptual$/);
  assert.match(field.querySelector<HTMLElement>('[data-mode="cmyk"]')!.getAttribute('aria-label')!,
    /^CMYK, output, no profile$/);
  // Every tab controls a real tabpanel, and that panel points back.
  for (const tab of tabs) {
    const panel = field.querySelector(`#${tab.getAttribute('aria-controls')!}`);
    assert.ok(panel, `${tab.dataset.mode} has no panel`);
    assert.equal(panel!.getAttribute('role'), 'tabpanel');
    assert.equal(panel!.getAttribute('aria-labelledby'), tab.id);
    assert.equal(panel!.getAttribute('tabindex'), '-1');
  }
  // One tab stop for the whole strip.
  assert.equal(tabs.filter(t => t.tabIndex === 0).length, 1);
  // One live caution line per field, silent until it has something to say.
  const notes = [...field.querySelectorAll<HTMLElement>('.color-space-note')];
  assert.equal(notes.length, 1);
  assert.equal(notes[0]!.getAttribute('role'), 'status');
  assert.equal(notes[0]!.getAttribute('aria-live'), 'polite');
  // The OKLCH panel keeps .color-lch: views/color-lab.test.ts asserts it, and the
  // non-modes popover's focus-to-expand selector depends on it.
  assert.ok(field.querySelector('.color-space.color-lch[data-space-group="oklch"]'));
});

test('a popover field folds every fine control behind Fine-tune, sliders visible inside', () => {
  const { field } = mount('#30ba78', { float: true });
  assert.equal(field.querySelectorAll('[role="tablist"]').length, 1);
  // One fold holds the value, HSL / OKLCH tabs, channel panel and alpha.
  const fine = field.querySelector<HTMLElement>('[data-color-fine]')!;
  assert.ok(fine);
  assert.equal(fine.hidden, true, 'the fold starts closed');
  const panel = fine.querySelector<HTMLElement>('[data-space-group="hsl"]')!;
  assert.ok(panel, 'the default HSL panel lives inside the fold');
  assert.equal(panel.hidden, false, 'no second gate on the panel itself');
  assert.equal(panel.getAttribute('role'), 'tabpanel');
  assert.equal(fine.querySelector<HTMLElement>('[data-space-group="oklch"]')!.hidden, true);
  assert.ok(fine.contains(valueInput(field)), 'the value field is folded too');
  // The palette leads: swatches come before the fold in the popover.
  const popover = field.querySelector<HTMLElement>('.color-popover')!;
  const kids = [...popover.children];
  assert.ok(kids.indexOf(popover.querySelector('.color-swatches')!) < kids.indexOf(fine));
  const toggle = field.querySelector<HTMLElement>('[data-color-fine-toggle]')!;
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  toggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(fine.hidden, false, 'the toggle opens the fold');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  toggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(fine.hidden, true, 'and closes it again');
});

test('a progressive inline field keeps the first choice simple and reveals expert controls', () => {
  const { field } = mount('#7c3aed', { inline: true, modes: true, dials: true, progressive: true });
  const value = valueInput(field);
  const fine = field.querySelector<HTMLElement>('[data-color-fine]')!;
  const toggle = field.querySelector<HTMLButtonElement>('[data-color-fine-toggle]')!;
  assert.ok(value, 'the editable value remains immediately available');
  assert.equal(fine.contains(value), false, 'the first choice is not hidden with expert controls');
  assert.equal(fine.hidden, true);
  assert.ok(fine.querySelector('[role="tablist"]'), 'colour-space modes wait behind Fine-tune');
  assert.ok(fine.querySelector('.color-dials'), 'dials wait behind Fine-tune');
  assert.ok(field.querySelector('[data-color-native-button]'), 'the visual OS picker remains one press away');
  toggle.click();
  assert.equal(fine.hidden, false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
});

// ── Trap 2: the dials are no longer gated on `inline` ────────────────────────

test('dials follow their own option, defaulting to inline', () => {
  assert.equal(mount('#30ba78', { inline: true }).field.querySelectorAll('.color-dials').length > 0, true);
  assert.equal(mount('#30ba78', { float: true }).field.querySelectorAll('.color-dials').length, 0);
  // The point of the decoupling: a float popover can ask for them…
  assert.ok(mount('#30ba78', { float: true, dials: true }).field.querySelector('.color-dials'));
  // …and an inline panel can decline them.
  assert.equal(mount('#30ba78', { inline: true, dials: false }).field.querySelectorAll('.color-dials').length, 0);
  // Every dial stays out of the tab order and out of the a11y tree - the slider
  // beneath it is the control of record.
  const { field } = mount('#30ba78', { inline: true });
  for (const d of field.querySelectorAll<HTMLElement>('.color-dial')) {
    assert.equal(d.tabIndex, -1);
    assert.equal(d.getAttribute('aria-hidden'), 'true');
  }
});

// ── Trap 3: the value field takes ANY CSS colour ─────────────────────────────

test('the value field accepts any CSS colour, not just the active space format', () => {
  const { field, seen } = mount('#30ba78', { inline: true, modes: true });
  selectSpace(field, 'oklch');
  // A hex typed while OKLCH is active. This used to be silently held.
  type(field, '#c0392b');
  assert.equal(seen.at(-1)!.value, '#c0392b');
  // A wide-gamut notation, in its authored space.
  type(field, 'color(display-p3 1 0 0)');
  const wide = seen.at(-1)!;
  assert.equal(wide.detail.color.space, 'display-p3');
  assert.equal(wide.detail.css, 'color(display-p3 1 0 0)');
  assert.equal(wide.detail.baked, true, 'the emitted hex is an approximation and says so');
  assert.match(wide.value as string, /^#[0-9a-f]{6}$/, 'the emitted value is still an sRGB hex');
  // A named colour, and a perceptual one.
  type(field, 'rebeccapurple');
  assert.equal(seen.at(-1)!.value, '#663399');
  type(field, 'oklch(62% 0.11 250)');
  assert.equal(seen.at(-1)!.detail.color.space, 'oklch');
  assert.equal(seen.at(-1)!.detail.baked, false);
  // The bare component list the picker has always spoken still works.
  const before = seen.length;
  type(field, '55% 0.13 145');
  assert.equal(seen.length, before + 1);
  assert.deepEqual(seen.at(-1)!.detail.color.components, [0.55, 0.13, 145]);
  // Junk mid-edit holds the last good colour rather than emitting nonsense.
  type(field, 'oklch(55% 0.13');
  assert.equal(seen.length, before + 1);
});

// ── Trap 4: slider state is one-directional ──────────────────────────────────

test('a near-grey keeps its hue across lightness drags (no hex round trip)', () => {
  const { field, seen } = mount('#808080', { inline: true, modes: true });
  const hue = (): number => seen.at(-1)!.detail.color.components[2];
  // Grey has no hue of its own, so the sliders show the remembered one and every
  // drag must carry it through. Round-tripping the slider output back through a
  // hex is what used to make it wander.
  for (const l of [70, 40, 85, 12]) {
    drag(field, 'oklch', 'l', l);
    assert.equal(seen.at(-1)!.detail.color.space, 'oklch');
    assert.equal(hue(), 250, `hue drifted at L=${l}`);
  }
  // Moving the hue slider WRITES the memory; lightness then carries the new one.
  drag(field, 'oklch', 'h', 137);
  assert.equal(hue(), 137);
  drag(field, 'oklch', 'l', 55);
  assert.equal(hue(), 137);
  // The same rule in a space whose hue is component 0 rather than 2.
  field.querySelector<HTMLElement>('[data-mode="hsl"]')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  drag(field, 'hsl', 'h', 200);
  drag(field, 'hsl', 'l', 30);
  assert.equal(seen.at(-1)!.detail.color.components[0], 200, 'HSL hue survived a lightness drag');
});

test('a drag composes straight to the space it is in - CMYK stays put on K', () => {
  const { field, seen } = mount('#3c7a9f', { inline: true, modes: true });
  field.querySelector<HTMLElement>('[data-mode="cmyk"]')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  const k = field.querySelector<HTMLInputElement>('[data-space-group="cmyk"] [data-mode-ch="k"]')!;
  const c = field.querySelector<HTMLInputElement>('[data-space-group="cmyk"] [data-mode-ch="c"]')!;
  const k0 = k.value;
  // CMYK→RGB is many-to-one on K, so re-deriving the panel from the colour after
  // every drag would make K jump under the user's hand. Dragging C must not move it.
  c.value = '80';
  fire(c);
  assert.equal(k.value, k0, 'K moved while dragging C');
  assert.ok(seen.length > 0);
  assert.equal(seen.at(-1)!.detail.mode, 'cmyk', 'the emit names the space being edited');
});

// ── The emit contract ────────────────────────────────────────────────────────

test('the emitted value is unchanged: a lowercase sRGB hex, alpha byte-exact', () => {
  const { field, seen } = mount('#30ba7880', { inline: true, modes: true });
  const alpha = field.querySelector<HTMLInputElement>('.color-alpha-slider')!;
  assert.equal(alpha.value, '128', 'the alpha byte round-trips into the slider');
  alpha.value = '64';
  fire(alpha);
  assert.equal(seen.at(-1)!.value, '#30ba7840', 'alpha = byte/255 in, round(alpha*255) out');
  alpha.value = '255';
  fire(alpha);
  assert.equal(seen.at(-1)!.value, '#30ba78', 'a full alpha drops the pair entirely');
  assert.equal(field.querySelector<HTMLElement>('.color-alpha-pct')!.textContent, '100%');
});

test('transparent stays transparent - it is not a CssColor and must not become black', () => {
  const { field, seen } = mount('transparent', { inline: true, modes: true });
  assert.equal(field.dataset.colorCanon, 'transparent');
  type(field, 'transparent');
  assert.equal(seen.at(-1)!.value, 'transparent');
  assert.equal(seen.at(-1)!.detail.css, 'transparent');
  // The engine parses 'transparent' to opaque-black-at-alpha-0, so a state without
  // the explicit sentinel would emit '#00000000' here.
  assert.notEqual(seen.at(-1)!.value, '#00000000');
});

test('seeding is widened: any CSS colour is kept in its authored space', () => {
  for (const [input, canon] of [
    ['#30ba78', 'color(srgb 0.188235 0.729412 0.470588)'],
    ['oklch(62% 0.11 250)', 'oklch(62% 0.11 250)'],
    ['color(display-p3 1 0 0)', 'color(display-p3 1 0 0)'],
    ['rebeccapurple', 'color(srgb 0.4 0.2 0.6)'],
    ['transparent', 'transparent'],
    ['', ''],
    ['not a colour', ''],
  ] as const) {
    const { field } = mount(input, { float: true });
    assert.equal(field.dataset.colorCanon, canon, `seeding ${input}`);
  }
  // A wide-gamut seed survives the render → wire handoff and comes back out whole.
  const { field, seen } = mount('color(display-p3 0 1 0)', { inline: true, modes: true });
  drag(field, 'oklch', 'l', 70);
  assert.equal(seen.at(-1)!.detail.color.space, 'oklch', 'the drag lands in the space being dragged');
  assert.equal(field.dataset.colorCanon, seen.at(-1)!.detail.css, 'the handoff attribute stays truthful');
});

// ── Alpha is not a one-way ratchet ───────────────────────────────────────────

test('typing an explicitly opaque colour restores opacity; an alpha-less one inherits', () => {
  for (const opts of [{ inline: true, modes: true }, { float: true }] as const) {
    const where = JSON.stringify(opts);
    const { field, seen } = mount('oklch(70% 0.14 157.2 / 0.4)', opts);
    // A notation that says nothing about opacity keeps what the slider shows.
    type(field, '#30ba78');
    assert.equal(seen.at(-1)!.detail.color.alpha, 0.4, `bare hex must inherit the field's alpha ${where}`);
    // …and one that DOES state it is an instruction, `ff` / `/ 100%` / `/ 1` included.
    // Inferring "stated nothing" from alpha === 1 made this a downward-only ratchet
    // that only the alpha slider could undo.
    for (const opaque of ['#30ba78ff', 'rgb(48 186 120 / 100%)', 'oklch(70% 0.14 157.2 / 1)']) {
      type(field, '#30ba7866');                       // back down first
      assert.equal(seen.at(-1)!.detail.color.alpha, 0.4, `${opaque}: the 66 step must land ${where}`);
      type(field, opaque);
      assert.equal(seen.at(-1)!.detail.color.alpha, 1, `${opaque} must make the colour opaque ${where}`);
      assert.match(seen.at(-1)!.value as string, /^#[0-9a-f]{6}$/, `${opaque} drops the alpha pair ${where}`);
    }
    // Lowering still works, and a partial alpha is unaffected by any of this.
    type(field, 'rgb(255 0 0 / 50%)');
    assert.equal(seen.at(-1)!.detail.color.alpha, 0.5, `a partial alpha must land ${where}`);
  }
});

// ── A field with no space tabs speaks hex, and is not capped at 9 characters ──

test('a compact field keeps a hex value while advanced editors use the active notation', () => {
  const { field, seen } = mount('#30ba78', { float: true });
  const input = valueInput(field);
  assert.equal(input.getAttribute('maxlength'), null,
    'a 9-character cap truncated every CSS colour the field itself can now read');
  // The live update path used to write the active space's notation into this box - 
  // 'oklch(70.085% 0.15123 157.2 / 0.7843)' in an input hinted '#rrggbbaa', which the
  // user could then not re-enter.
  const alpha = field.querySelector<HTMLInputElement>('.color-alpha-slider')!;
  alpha.value = '200';
  fire(alpha);
  assert.match(input.value, /^#[0-9a-f]{8}$/, 'a modes-less field states the colour as a hex');
  drag(field, 'oklch', 'l', 40);
  assert.match(input.value, /^#[0-9a-f]{8}$/, 'still a hex after a slider drag');
  // …and the widened parse is reachable here, not only in a modes picker.
  type(field, 'color(display-p3 1 0 0)');
  assert.equal(seen.at(-1)!.detail.color.space, 'display-p3');
  assert.match(input.value, /^#ff0b0c[0-9a-f]{2}$/,
    'and it comes back stated as the (gamut-mapped) hex the box is sized for, alpha kept');
  // A field WITH tabs is the other half of the contract: it speaks its space.
  const { field: tabbed } = mount('#30ba78', { inline: true, modes: true });
  assert.match(valueInput(tabbed).value, /^hsl\(/);
});

// ── The dial can never disagree with the slider beneath it ────────────────────

test('the dragged channel keeps painting its dial needle', async () => {
  const { field } = mount('#30ba78', { inline: true, modes: true, dials: true });
  const needle = (ch: string): string =>
    field.querySelector<HTMLElement>(`[data-space-group="oklch"] .color-dial[data-dial-ch="${ch}"] .color-dial-needle`)!
      .style.transform;
  const before = needle('l');
  drag(field, 'oklch', 'l', 20);
  await settlePaint();
  // The repaint skips the dragged channel's TRACK (its own ramp did not change), and
  // used to drop that channel from the dial paint entirely - so the needle froze
  // while the slider moved, and a dial drag stopped following the finger.
  assert.notEqual(needle('l'), before, 'the L needle never moved');
  assert.equal(needle('l'), 'rotate(72.0deg)', 'L=20 of 0–100 is 72° from 12 o’clock');
  // The other channels' needles still land where their own values are.
  drag(field, 'oklch', 'h', 90);
  await settlePaint();
  assert.equal(needle('h'), 'rotate(90.0deg)');
  assert.equal(needle('l'), 'rotate(72.0deg)', 'L stayed put while H moved');
});

// ── The boundary hairlines on the dials ───────────────────────────────────────

/** Every stop fraction in a gradient, in percent. Positions are the only numbers
 *  followed by a ',' or the closing ')' - a colour's own `62.00%` lightness is
 *  followed by a space. (Same trick as the tier test above.) */
const stopFracs = (bg: string): number[] =>
  [...bg.matchAll(/(\d+\.\d\d)%(?=[,)]|$)/g)].map(m => Number(m[1]));

/**
 * Where a run list' gradient actually BREAKS, read off the gradient itself: each
 * run closes at the fraction the next one opens at, so a boundary is the one place
 * a position repeats. Deriving the expectation this way rather than by recomputing
 * `channelRuns` is the point - it pins the hairline to the same edge the eye sees.
 */
const gradientBreaks = (bg: string): number[] => {
  const f = stopFracs(bg);
  return f.filter((v, i) => i > 0 && f[i - 1] === v && v > 0 && v < 100);
};

const ringBg = (field: HTMLElement, ch: string): string =>
  field.querySelector<HTMLElement>(`[data-space-group="oklch"] .color-dial[data-dial-ch="${ch}"]`)!.style.background;

const edgeAngles = (field: HTMLElement, ch: string): number[] =>
  [...field.querySelectorAll<HTMLElement>(`[data-space-group="oklch"] .color-dial[data-dial-ch="${ch}"] .color-dial-edge`)]
    .map(e => Number(/rotate\(([\d.]+)deg\)/.exec(e.style.transform)![1]));

/** The angles the hairlines WOULD have if they sat on the gradient's own breaks. */
const breakAngles = (bg: string): number[] =>
  gradientBreaks(bg).map(p => p / 100 * 360);

/**
 * Same boundaries, same order, same angles - within the width of the gradient's own
 * quantisation. A stop position is printed at two decimals of a percent, so a
 * fraction read back out of the gradient can differ from the one the hairline was
 * rotated by by 0.036° (0.01% of 360°), and the rotation itself is written to a tenth
 * of a degree (±0.05°). Anything past their sum is a hairline sitting beside its own
 * edge, which is the thing being pinned - and 0.09° of a 3.25rem ring is a tenth of a
 * device pixel.
 */
const assertSameAngles = (got: number[], want: number[], what: string): void => {
  assert.equal(got.length, want.length, `${what}: ${got.length} hairlines for ${want.length} breaks`);
  got.forEach((a, i) => {
    assert.ok(Math.abs(a - want[i]!) <= 0.09, `${what}: hairline ${i} at ${a}°, break at ${want[i]}°`);
  });
};

test('runBoundaries reports every interior tier crossing, once', () => {
  const run = (from: number, to: number, tier: number) => ({ from, to, stops: ['red', 'red'], tier });
  // A single-band axis crosses nothing: the ends are where the axis stops, not
  // where a gamut does.
  assert.deepEqual(runBoundaries([run(0, 1, 0)]), []);
  assert.deepEqual(runBoundaries([]), []);
  // Three bands → the two crossings between them, and never 0 or 1.
  assert.deepEqual(runBoundaries([run(0, 0.25, 1), run(0.25, 0.8, 0), run(0.8, 1, 1)]), [0.25, 0.8]);
  // A hue ring leaving and re-entering a gamut several times: EVERY crossing, not
  // the first one.
  assert.deepEqual(
    runBoundaries([run(0, 0.1, 0), run(0.1, 0.2, 1), run(0.2, 0.5, 0), run(0.5, 0.6, 2), run(0.6, 1, 0)]),
    [0.1, 0.2, 0.5, 0.6],
  );
  // A duplicate fraction (two boundaries the bisection landed on the same spot)
  // is one hairline, not two stacked.
  assert.deepEqual(runBoundaries([run(0, 0.4, 0), run(0.4, 0.4, 1), run(0.4, 1, 2)]), [0.4]);
});

test('a dial marks every gamut crossing with a hairline, at the gradient’s own fraction', () => {
  // What Andy asked for: "a hairline indicator at the boundary on the dials … but
  // they should see the full color".
  const { field } = mount('oklch(62% 0.19 260)', { inline: true, modes: true, dials: true });

  // 1. The full colour, both sides. The ring pours the SAME runs as the slider, at
  //    the same fractions, but with no tier wash on it - the ladder is the
  //    sliders' answer, not the dials'.
  const c = ringBg(field, 'c');
  const track = field.querySelector<HTMLElement>('[data-space-group="oklch"] [data-mode-ch="c"]')!.style.background;
  assert.ok(track.includes('color-mix(in oklab,'), `the slider still washes its rings: ${track}`);
  assert.ok(!c.includes('color-mix('), `a dial shows the full colour past the boundary: ${c}`);
  assert.deepEqual(stopFracs(c), stopFracs(track), 'ring and slider must still break together');

  // 2. A hairline on each break, at the break's own angle.
  const expected = breakAngles(c);
  assert.ok(expected.length >= 1, `a chroma axis past sRGB has a boundary: ${c}`);
  assertSameAngles(edgeAngles(field, 'c'), expected, 'chroma');

  // 3. More than one crossing on an axis that crosses more than once. A hue ring at
  //    high chroma leaves and re-enters sRGB several times, and each of those is a
  //    place the display stops.
  const { field: wide } = mount('oklch(60% 0.22 0)', { inline: true, modes: true, dials: true });
  const h = ringBg(wide, 'h');
  const many = breakAngles(h);
  assert.ok(many.length >= 2, `a high-chroma hue ring crosses repeatedly: ${many.length} in ${h}`);
  assertSameAngles(edgeAngles(wide, 'h'), many, 'hue');
  // …and none of them is stacked on 12 o'clock, where the axis merely ends.
  assert.ok(many.every(a => a > 0 && a < 360));
});

test('the hairlines move with the ramp they mark', async () => {
  const { field } = mount('oklch(62% 0.19 260)', { inline: true, modes: true, dials: true });
  const before = edgeAngles(field, 'c');
  // Lightness up near white: the chroma axis reaches far less, so its sRGB edge
  // moves. The repaint has to rebuild the hairlines with the gradient - a stale set
  // would sit beside its own edge.
  drag(field, 'oklch', 'l', 95);
  await settlePaint();
  const after = edgeAngles(field, 'c');
  assert.notDeepEqual(after, before, 'the chroma hairlines never moved');
  assertSameAngles(after, breakAngles(ringBg(field, 'c')), 'chroma after L=95');
  // The needle and the hub survive the rebuild - they are siblings of the hairline
  // container, which is the only innerHTML target.
  const dial = field.querySelector<HTMLElement>('[data-space-group="oklch"] .color-dial[data-dial-ch="c"]')!;
  assert.ok(dial.querySelector('.color-dial-needle') && dial.querySelector('.color-dial-hub'));
});

test('the dial hairline is a rotated element, styled entirely from CSS', () => {
  const css = readFileSync(new URL('../styles/parts/color-field.css', import.meta.url), 'utf8');
  const rule = /\.color-dial-edge::before \{([^}]*)\}/.exec(css);
  assert.ok(rule, 'the dial hairline rule moved - find it before deleting this test');
  const body = rule![1]!;
  // Not dashed (that means DROP AREA here) and not a border - it is a mark of its own.
  assert.ok(!/dashed/.test(body), `no dashed hairline: ${body.trim()}`);
  assert.ok(!/\bborder\s*:/.test(body), `not a border: ${body.trim()}`);
  // Tunable the way the tier opacities are: JS writes the rotation and nothing else.
  for (const v of ['--dial-edge-w', '--dial-edge-len', '--dial-edge-c']) {
    assert.ok(body.includes(`var(${v}`), `${v} carries the hairline's ${v}: ${body.trim()}`);
    assert.match(css, new RegExp(`${v}:\\s*\\S`), `${v} has a value declared in this file`);
  }
  // A stop pair inside the conic would be a wedge (thin at the hub, wide at the
  // rim) - the width has to be a length, not an angle.
  assert.match(body, /width:\s*var\(--dial-edge-w/);
  const src = readFileSync(new URL('./color-field.ts', import.meta.url), 'utf8');
  const emit = /function dialEdgesHtml\([^)]*\): string \{([\s\S]*?)\n\}/.exec(src);
  assert.ok(emit, 'dialEdgesHtml moved - find it before deleting this test');
  assert.ok(!/background|color-mix|border/.test(emit![1]!), `JS writes the angle only: ${emit![1]!}`);
});

// ── The caution line ─────────────────────────────────────────────────────────

test('the caution line names the space just switched to, on the leading edge', () => {
  const { field } = mount('#30ba78', { inline: true, modes: true });
  // Wiring writes the note, priming the throttle - so a switch inside 300ms used to
  // be deferred and this role="status" line kept naming the space the user left.
  selectSpace(field, 'cmyk');
  assert.equal(noteText(field), 'CMYK - exact');
  selectSpace(field, 'lab');
  assert.equal(noteText(field), 'Lab - exact', 'each step of an arrow-key walk must announce its own space');
  selectSpace(field, 'oklch');
  assert.equal(noteText(field), 'OKLCH - exact');
});

test('a superseded caution never lands on top of the colour that contradicts it', async () => {
  const { field } = mount('#30ba78', { inline: true, modes: true });
  selectSpace(field, 'oklch');
  drag(field, 'oklch', 'c', 0.39);                 // far outside sRGB
  await wait(400);
  assert.equal(noteText(field), 'Outside sRGB');
  drag(field, 'oklch', 'c', 0.05);                 // queues 'OKLCH - exact'
  drag(field, 'oklch', 'c', 0.39);                 // same text as on screen: early return
  await wait(400);
  // The queued write used to survive the early return, so the line settled on
  // "exact" over a colour nothing about it was exact.
  assert.equal(noteText(field), 'Outside sRGB', 'a write for text the colour has left must be cancelled');
  assert.equal(field.dataset.colorCanon, 'oklch(70.085% 0.39 157.2)');
});

// ── One state, one set of sliders ─────────────────────────────────────────────

test('a transparent field seeds its sliders the same way whichever path re-seeds them', () => {
  const { field } = mount('transparent', { inline: true, modes: true });
  const seeded = sliderValues(field, 'oklch');
  assert.notDeepEqual(seeded, ['0', '0', '250'], 'the neutral seed, not alpha-0 black');
  type(field, 'transparent');                      // the afterEdit path
  assert.deepEqual(sliderValues(field, 'oklch'), seeded,
    'a transparent apply must seed the panel through panelSeed, like a mode switch does');
  selectSpace(field, 'hsl');
  selectSpace(field, 'oklch');                     // the selectMode path
  assert.deepEqual(sliderValues(field, 'oklch'), seeded);
});

test('the CMYK value field states the ink split its own sliders state', () => {
  const { field } = mount('#3c7a9f', { inline: true, modes: true });
  selectSpace(field, 'cmyk');
  for (const ch of ['c', 'm', 'y']) drag(field, 'cmyk', ch, 100);
  const inks = sliderValues(field, 'cmyk');
  // c=m=y=100% composes to black, which DECOMPOSES as k=100% - so re-deriving the
  // text made the field read 'cmyk(0% 0% 0% 100%)' under sliders reading 100/100/100/38.
  assert.equal(valueInput(field).value, 'cmyk(100% 100% 100% 38%)');
  // …and a round trip through another tab must not rewrite the split either.
  selectSpace(field, 'oklch');
  selectSpace(field, 'cmyk');
  assert.deepEqual(sliderValues(field, 'cmyk'), inks, 'a tab round trip is not an edit');
  assert.equal(valueInput(field).value, 'cmyk(100% 100% 100% 38%)');
  // The alpha is in the text, so copying it out of the field keeps the opacity.
  const { field: half } = mount('#3c7a9f40', { inline: true, modes: true });
  selectSpace(half, 'cmyk');
  assert.equal(valueInput(half).value, 'cmyk(62% 23% 0% 38% / 0.251)');
});

// ── The host's interaction bracket ───────────────────────────────────────────

test('the interaction ends when focus leaves the field, however it got there', () => {
  const events: string[] = [];
  const { field } = mount('#30ba78', { inline: true, modes: true }, {
    onInteractStart: () => events.push('start'),
    onInteractEnd: () => events.push('end'),
  });
  const input = valueInput(field);
  input.focus();
  assert.deepEqual(events, ['start']);
  // Hopping to a control inside the field must NOT release: the host's
  // drag-suppression is what keeps the picker alive through a slider drag.
  field.querySelector<HTMLElement>('[data-mode="hsl"]')!.focus();
  assert.deepEqual(events, ['start'], 'a hop inside the field is not the end of the interaction');
  // …but leaving the field must, and used to not - the blur handler sat on the value
  // input, which by then had long since lost focus, so the host stayed latched.
  document.getElementById('away')!.focus();
  assert.deepEqual(events, ['start', 'end']);
});

// ── Text that is not a colour ────────────────────────────────────────────────

test('unparsable text is marked invalid and put back when focus leaves', () => {
  const { field, seen } = mount('#30ba78', { inline: true, modes: true });
  const input = valueInput(field);
  input.focus();
  const good = input.value;
  input.value = 'not-a-colour';
  fire(input);
  // Held, not applied - but no longer silently: the field used to display a string
  // that was not the colour while the caution line called that colour exact.
  assert.equal(seen.length, 0, 'junk must not emit');
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.ok(input.classList.contains('color-input--invalid'));
  assert.equal(input.value, 'not-a-colour', 'mid-edit text stays the user’s');
  document.getElementById('away')!.focus();        // commit
  assert.equal(input.value, good, 'on the way out the colour’s own notation comes back');
  assert.equal(input.getAttribute('aria-invalid'), null);
  // Something readable clears the flag immediately.
  input.focus();
  input.value = 'oklch(55% 0.13 145';
  fire(input);
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  type(field, '#c0392b');
  assert.equal(input.getAttribute('aria-invalid'), null);
});

// ── Layout the picker promises not to shift ──────────────────────────────────

test('every space panel reserves the widest space’s rows, and its dials size by slot', () => {
  const { field } = mount('#30ba78', { inline: true, modes: true, dials: true });
  const widest = Math.max(...colorSpaces().map(s => s.channels.length));
  for (const spec of colorSpaces()) {
    const panel = field.querySelector<HTMLElement>(`[data-space-group="${spec.mode}"]`)!;
    const rows = panel.querySelectorAll('.color-lch-row');
    assert.equal(rows.length, widest,
      `${spec.mode} must carry ${widest} row slots so switching space shifts nothing below it`);
    const fillers = [...panel.querySelectorAll('.color-lch-row--filler')];
    assert.equal(fillers.length, widest - spec.channels.length);
    for (const f of fillers) {
      assert.equal(f.childElementCount, 0, 'a filler row holds no control');
      assert.equal(f.getAttribute('aria-hidden'), 'true');
    }
    assert.equal(panel.querySelectorAll('input[data-mode-ch]').length, spec.channels.length,
      'and it grows no extra sliders');
    // The rings share the row by slot, not by sibling count, so a 3-channel space
    // draws the same size ring as CMYK and the band's height stops moving.
    assert.equal(panel.querySelector<HTMLElement>('.color-dials')!.style.getPropertyValue('--dial-slots'),
      String(widest + 1), `${spec.mode}'s dial band must size for the widest space`);
  }
  // A lone panel has no sibling space to match, so it sizes for itself.
  const { field: bare } = mount('#30ba78', { float: true, dials: true });
  assert.equal(bare.querySelectorAll('.color-lch-row--filler').length, 0);
  assert.equal(bare.querySelector<HTMLElement>('.color-dials')!.style.getPropertyValue('--dial-slots'), '4');
});

test('a long value keeps its whole string reachable', () => {
  const { field } = mount('oklch(61.374% 0.13585 260.14)', { inline: true, modes: true });
  const input = valueInput(field);
  assert.ok(input.value.length > 22, `expected a long notation, got ${input.value}`);
  // The narrow hosts (a 316px swatch editor) cut this off at the hue with no ellipsis
  // and no title - the string the field itself wrote was unreadable and unrecoverable.
  assert.ok(input.classList.contains('color-input--long'));
  assert.equal(input.title, input.value);
  // A hex is short, so it is not stepped down.
  const { field: hex } = mount('#30ba78', { float: true });
  assert.equal(valueInput(hex).classList.contains('color-input--long'), false);
  assert.equal(valueInput(hex).title, '#30ba78');
});

test('the stretches the gamut cannot show are painted as fainter rings, not holes', () => {
  // What Andy asked for: the transparent regions stay VISIBLE, with opacity dropping
  // onion-ring style as you go up gamuts. The tier tokens carry the opacity, so the
  // assertions are about STRUCTURE - a ring exists, an outer ring is fainter than an
  // inner one, and the numbers themselves live in CSS where they can be tuned.
  const { field } = mount('oklch(62% 0.19 260)', { inline: true, modes: true, dials: true });
  const track = field.querySelector<HTMLElement>('[data-space-group="oklch"] [data-mode-ch="c"]')!;
  const bg = track.style.background;
  assert.ok(bg.includes('color-mix(in oklab,'), `a chroma axis past sRGB must paint washes: ${bg}`);
  assert.ok(bg.includes('var(--track-tier-1'), 'the first ring out reads its own token');
  // The dial above it is the SAME run list poured into a conic gradient, so it breaks
  // at the same fractions - that is what keeps the ring and the slider in register.
  const dial = field.querySelector<HTMLElement>('[data-space-group="oklch"] [data-dial-ch="c"] .color-dial-ring')
    ?? field.querySelector<HTMLElement>('[data-space-group="oklch"] [data-dial-ch="c"]')!;
  const ring = dial.style.background || dial.querySelector<HTMLElement>('[style*="conic"]')?.style.background || '';
  assert.ok(ring.includes('conic-gradient'), `the dial paints a conic ramp: ${ring}`);
  const fracs = (v: string): string[] => [...v.matchAll(/(\d+\.\d\d)%(?=[,)]|$)/g)].map(m => m[1]!);
  assert.deepEqual(fracs(ring), fracs(bg), 'the dial and its slider must break at the same fractions');

  // A hue axis at high chroma crosses more than one gamut, so more than one ring is
  // named on the same track - the onion.
  const { field: wide } = mount('oklch(60% 0.22 0)', { inline: true, modes: true, dials: true });
  const hue = wide.querySelector<HTMLElement>('[data-space-group="oklch"] [data-mode-ch="h"]')!.style.background;
  assert.ok(hue.includes('var(--track-tier-1') && hue.includes('var(--track-tier-2'),
    `a high-chroma hue axis shows at least two rings: ${hue}`);

  // The scale is a token scale, and it decreases outward. Read from the stylesheet
  // rather than pinned as literals here: which value stops looking *available* is a
  // design judgement, and this test must not become the reason it cannot be changed.
  const tokens = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
  const pctOf = (name: string): number => {
    const m = new RegExp(`--track-tier-${name}:\\s*([\\d.]+)%`).exec(tokens);
    assert.ok(m, `--track-tier-${name} is missing from tokens.css`);
    return Number(m![1]);
  };
  const [t1, t2, t3] = [pctOf('1'), pctOf('2'), pctOf('3')];
  assert.ok(t1 > t2 && t2 > t3, `the rings must fade outward, got ${t1}/${t2}/${t3}`);
  assert.ok(t1 < 60, 'an unreachable band must never read as available');
  assert.equal(pctOf('beyond'), 0, 'past every gamut the browser would clamp the colour: rail only');

  // The boost for dark grounds covers EVERY dark theme. `brand` declares
  // `color-scheme: dark` (statically, and in every block brand-vars.ts generates), so
  // left off this selector it paid the light amounts over a near-black rail - the
  // faintest rings of the three shipped themes, in the one that is the pre-JS default.
  const boost = /(\[data-theme[^{]*)\{[^}]*--track-tier-1:/.exec(tokens);
  assert.ok(boost, 'the dark tier boost moved - find it before deleting this test');
  for (const theme of ['dark', 'brand']) {
    assert.match(boost![1]!, new RegExp(`\\[data-theme="${theme}"\\]`),
      `${theme} is a dark ground and must get the dark tier amounts: ${boost![1]!.trim()}`);
  }
});

test('the color-mix support probe can actually fail', () => {
  // It could not before: the probe string carried a `var()`, and a declaration holding
  // one cannot be validated until substitution - so CSS.supports answers TRUE for it
  // unconditionally (it says yes to `totally-not-a-color(in oklab, red var(--x),
  // transparent)` as well). The fallback the probe exists to reach was unreachable,
  // and on a browser without color-mix the whole `background` shorthand - rail
  // included - would have been dropped.
  // Asserted against the source because jsdom has no CSS.supports to ask (which is why
  // the caller optional-chains it), and Chromium - where it was verified both ways - 
  // is not available here.
  const src = readFileSync(new URL('./color-field.ts', import.meta.url), 'utf8');
  const arg = /CSS\.supports\?\.\(\s*'background', '([^']+)'/.exec(src);
  assert.ok(arg, 'the support probe moved - find it before deleting this test');
  assert.ok(!arg![1]!.includes('var('), `a var() makes the probe vacuous: ${arg![1]}`);
  assert.match(arg![1]!, /color-mix\(in oklab, [^,]+ \d+%, transparent\)/,
    'a literal percentage is what makes it discriminate');
});

test('a gamut-sliced track has a visible rail, and it is NOT a dashed border', () => {
  // Two requirements pulling against each other, which is why this is pinned.
  //
  // A track with gaps needs SOMETHING behind it, or a fully out-of-gamut axis
  // renders as a bare thumb ring floating on the card with no rail at all. But it
  // must not be a dashed border: in this design language dashed means DROP AREA and
  // nothing else, so a dashed rail is a false affordance on every slider in the app.
  // The rail is therefore a faint bottom background layer, and the clamp mark an inset
  // ring - NOT an `outline`, see the focus assertion below.
  //
  // It cannot be a background-color: JS assigns the `background` SHORTHAND for the
  // track gradient, which would wipe one declared here. Nor an inset box-shadow: an
  // inset shadow paints OVER the background, so a full-width one veils the very
  // gradient it frames and leaves every slider paler than the dial above it. So the
  // rail is the BOTTOM LAYER of that same shorthand, out of --track-rail.
  const css = readFileSync(new URL('../styles/parts/color-field.css', import.meta.url), 'utf8');
  const rail = /\.color-lch-slider,\s*\.color-mode-slider,\s*\.color-dial \{([^}]*)\}/.exec(css);
  assert.ok(rail, 'the track rail rule moved - find it before deleting this test');
  const body = rail![1]!;
  assert.ok(!/dashed/.test(body), `no dashed border on a slider, got "${body.trim()}"`);
  assert.ok(!/box-shadow:\s*inset/.test(body), 'an inset rail would paint over the runs');
  // The rail colour itself is a :root token, because the Colour Lab sliders' wells
  // need the SAME rail - the stretch beyond every gamut paints nothing at all, so
  // the rail is the only thing left saying the axis continues there.
  const tokenCss = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
  assert.match(tokenCss, /--track-rail:\s*hsl\(var\(--muted\)/, 'a faint rail colour is present');

  // …and every track carries it, empty axis or not, always UNDER the runs - which is
  // the claim that still holds. An axis with nothing reachable is no longer bare: it
  // paints the onion-ring washes for the gamuts that could show it, over the rail.
  const { field } = mount('color(display-p3 1 0 0)', { inline: true, modes: true, dials: true });
  selectSpace(field, 'hex');                        // all three RGB axes are outside sRGB here
  const empty = [...field.querySelectorAll<HTMLElement>('[data-space-group="hex"] input[data-mode-ch]')];
  assert.equal(empty.length, 3);
  for (const t of empty) {
    assert.match(t.style.background, /, linear-gradient\(var\(--track-rail[^;]*\)$/,
      'an axis with no reachable colour still shows its rail, underneath');
  }
  const { field: green } = mount('#30ba78', { inline: true, modes: true, dials: true });
  const bg = green.querySelector<HTMLElement>('[data-space-group="oklch"] [data-mode-ch="l"]')!.style.background;
  assert.match(bg, /^linear-gradient\(to right, (transparent|oklch\(|color-mix\()/, 'the runs come first…');
  assert.ok(bg.includes('oklch('), 'the reachable stretch paints its own colours');
  assert.match(bg, /, linear-gradient\(var\(--track-rail[^;]*\)$/, '…and the rail is the bottom layer');

  const clamp = /\.color-lch-row:has\(\.color-lch-val\.is-clamped\) > \.color-mode-slider \{([^}]*)\}/.exec(css);
  assert.ok(clamp, 'the clamp-mark rule moved');
  assert.ok(!/dashed/.test(clamp![1]!), 'the clamp mark is not dashed either');
  assert.match(clamp![1]!, /#d97706/, 'the clamp mark still marks in amber');
  // …and it must not be an `outline`. An element has exactly one, this selector is more
  // specific than :focus-visible, and that outline is the sliders' ONLY focus
  // affordance - so an amber outline silently removed the keyboard focus ring from
  // precisely the sliders an out-of-gamut colour is being dragged on.
  assert.ok(!/outline/.test(clamp![1]!),
    `the clamp mark must not use outline - it would eat the focus ring: "${clamp![1]!.trim()}"`);
  assert.match(clamp![1]!, /box-shadow:\s*inset/, 'an inset ring coexists with the focus outline');
  assert.match(css, /:focus-visible[^{]*\{[^}]*outline:\s*2px solid hsl\(var\(--ring\)\)/,
    'the focus ring is still an outline, and now nothing outranks it');

  // And the rule holds across the whole colour surface, not just here.
  for (const [file, url] of [
    ['color-field.css', new URL('../styles/parts/color-field.css', import.meta.url)],
    ['oklch-slice.css', new URL('../lib/oklch-slice.css', import.meta.url)],
  ] as [string, URL][]) {
    const text = readFileSync(url, 'utf8');
    const offenders = text.split('\n')
      .filter(line => /border(-style)?:[^;]*dashed/.test(line) && !line.trim().startsWith('*'));
    assert.deepEqual(offenders, [], `${file} has a dashed border: ${offenders.join(' | ')}`);
  }
});

test('a token-backed swatch emits a token value; editing afterwards de-links it', () => {
  // Runs last: setSwatches is global state.
  setSwatches([{ value: '#30ba78', label: 'Jungle', group: 'Brand', ref: '{color.brand.jungle}' }]);
  const { field, seen } = mount('#c0392b', { float: true });
  field.querySelector<HTMLElement>('.color-trigger')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  field.querySelector<HTMLElement>('[data-swatch-value="#30ba78"]')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(seen.at(-1)!.value, { ref: '{color.brand.jungle}', value: '#30ba78' });
  assert.equal(seen.at(-1)!.detail.ref, '{color.brand.jungle}');
  // Any manual edit clears the link, so the value stops claiming to be the token.
  drag(field, 'oklch', 'c', 0.2);
  assert.equal(typeof seen.at(-1)!.value, 'string');
  assert.equal(seen.at(-1)!.detail.ref, null);
});

// ── The stranded swatch tip ──────────────────────────────────────────────────
// Picking a colour closes the swatch grid, and a removed node fires no
// mouseout - so the floating name chip used to stay on the page, and the
// 240ms show delay could even pop it AFTER the grid was gone (screen
// recording, 2026-08-24). Three ways out, all pinned here: any press, Escape,
// and the swatch leaving the DOM inside the delay.

test('the swatch name tip never survives a pick, an Escape, or the swatch leaving the DOM', async () => {
  mount('#30ba78', {});                       // arms the delegated tip listeners
  const mkSwatch = (): HTMLElement => {
    const sw = document.createElement('button');
    sw.className = 'color-swatch';
    sw.dataset.name = 'Jungle 3';
    document.body.appendChild(sw);
    return sw;
  };
  const over = (el: HTMLElement): void => {
    el.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true }));
  };
  const tipShown = (): boolean =>
    document.querySelector('.swatch-name-tip')?.classList.contains('is-shown') ?? false;

  // Hovered and left alone: the chip appears after its delay.
  const sw1 = mkSwatch();
  over(sw1);
  await wait(300);
  assert.equal(tipShown(), true, 'a hovered swatch shows its name chip');

  // A press anywhere drops it (capture, so it wins even when the click unmounts the grid).
  document.body.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
  assert.equal(tipShown(), false, 'pointerdown hides the chip');
  sw1.remove();

  // The strand case: hover, then the grid closes inside the show delay.
  const sw2 = mkSwatch();
  over(sw2);
  sw2.remove();
  await wait(300);
  assert.equal(tipShown(), false, 'a removed swatch must never pop its chip late');

  // Esc closes the picker; the chip goes with it.
  const sw3 = mkSwatch();
  over(sw3);
  await wait(300);
  assert.equal(tipShown(), true);
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(tipShown(), false, 'Escape hides the chip');
  sw3.remove();
});

// ══ colour NAMES (plan 179 A17) ═══════════════════════════════════════════════
//
// "Colour: aqua #ffa3e9" was announced for a pink artboard fill. A name picked by
// anything other than distance in a perceptual space can do that; a name picked by
// OKLCH distance over a hue wheel that WRAPS cannot. These pin the three colours
// from the bug report plus the wrap itself.

// The list the picker names against for this block: a brand White, plus a swatch whose
// LABEL disagrees with its colour. Nothing here may hand "Aqua" to a pink.
//
// Installed PER TEST, not at module scope. `setSwatches` is global state and every module
// body runs before the first test callback does, so a module-scope call here was overwritten
// by the token test's own single-swatch list (declared earlier in the file, executed later):
// this block was naming against a lone Jungle swatch, the mislabelled Aqua was never in
// the list, and the test that exists to catch a swatch-list interference tested nothing.
const nameSwatches = (): void => {
  setSwatches([
    { value: '#ffffff', label: 'White', group: null, ref: null },
    { value: '#00c8d7', label: 'Aqua', group: null, ref: null },
  ]);
};

test('a pink is never named for a cyan, whatever the swatch list says', () => {
  nameSwatches();
  assert.equal(swatchName('#00c8d7'), 'Aqua', 'the mislabelled swatch really is in the list');
  const name = swatchName('#ffa3e9');
  assert.doesNotMatch(name, /aqua|cyan|teal|blue|green/i,
    `#ffa3e9 is a pale magenta - "${name}" would have to be measured, not asserted`);
  assert.match(name, /magenta|pink|rose|purple|violet/i, 'named for the half of the wheel it is on');
});

test('a dark green is named a green', () => {
  nameSwatches();
  assert.match(swatchName('#025937'), /green|emerald|teal/i);
});

test('white takes its palette name, not a computed one', () => {
  // #ffffff IS a swatch, and a swatch's own label always wins - that is the whole
  // point of having a brand palette in the picker. Named against TWO different lists,
  // because 'White' is also what the perceptual table would answer: with only the
  // first assertion, deleting the palette lookup from swatchName left this passing.
  nameSwatches();
  assert.equal(swatchName('#ffffff'), 'White');
  setSwatches([{ value: '#ffffff', label: 'Paper', group: null, ref: null }]);
  assert.equal(swatchName('#ffffff'), 'Paper', 'the palette is consulted, not a fixed table');
});

test('the hue wheel wraps: 359° and 1° are named by the same neighbourhood', () => {
  nameSwatches();
  // Two colours a couple of degrees apart across the 0/360 seam. A lookup that
  // compared raw hue numbers would put them at opposite ends of the list.
  const a = swatchName('#ff005b');   // ~just below 360 in OKLCH
  const b = swatchName('#ff2a2a');   // ~just above 0
  assert.ok(a && b, 'both are named');
  const family = (s: string): string => s.split(' ').pop()!;
  assert.ok(['Rose', 'Red', 'Pink', 'Magenta'].includes(family(a)), `${a} sits on the seam`);
  assert.ok(['Rose', 'Red', 'Pink', 'Magenta'].includes(family(b)), `${b} sits on the seam`);
});

test('alpha and shorthand do not change a name, and a non-colour has none', () => {
  nameSwatches();
  assert.equal(swatchName('#ffffffcc'), 'White', 'alpha is ignored when naming');
  assert.equal(swatchName('#fff'), 'White', 'shorthand is the same colour');
  assert.equal(swatchName('transparent'), '',
    'transparent is a sentinel, not a colour to name perceptually - only a swatch can name it');
  assert.equal(swatchName('var(--brand-primary, #0b1220)'), '',
    'a token reference is not a colour we can name - the host resolves it first');
  assert.equal(swatchName(''), '');
});

// ══ var() colour values (plan 179 A2) ═════════════════════════════════════════
//
// The resolver is driven with a FAKE getComputedStyle: what matters is the decision
// tree (cascade → literal fallback → the raw string), not jsdom's cascade.

/** Run `fn` with `getComputedStyle` replaced by a lookup over `vars`. */
function withVars<T>(vars: Record<string, string>, fn: () => T): T {
  const real = globalThis.getComputedStyle;
  (globalThis as { getComputedStyle: unknown }).getComputedStyle = ((el: Element) => ({
    getPropertyValue: (p: string) => vars[p] ?? '',
    el,
  })) as unknown as typeof globalThis.getComputedStyle;
  try { return fn(); } finally { (globalThis as { getComputedStyle: unknown }).getComputedStyle = real; }
}

const scope = (): Element => document.getElementById('host')!;

test('a var() resolves through the element it is painted on', () => {
  withVars({ '--brand-primary': ' #ff8fbe ' }, () => {
    assert.equal(resolveColorVar('var(--brand-primary, #0b1220)', scope()), '#ff8fbe',
      'the cascade is the only thing that knows what the token paints right now');
    assert.equal(resolveColorVar('var(--brand-primary)', scope()), '#ff8fbe');
  });
});

test('an unresolvable var() falls back to the literal the author wrote', () => {
  withVars({}, () => {
    assert.equal(resolveColorVar('var(--brand-primary, #0b1220)', scope()), '#0b1220');
  });
});

test('an unresolvable var() with no fallback keeps the raw string, never a guess', () => {
  withVars({}, () => {
    assert.equal(resolveColorVar('var(--nope)', scope()), 'var(--nope)',
      'showing black would be a claim about the colour; the raw string is only a claim about the model');
  });
});

test('a nested var() chain is walked to the first thing that resolves', () => {
  withVars({ '--b': 'rgb(1, 2, 3)' }, () => {
    assert.equal(resolveColorVar('var(--a, var(--b, #fff))', scope()), 'rgb(1, 2, 3)');
  });
  withVars({}, () => {
    assert.equal(resolveColorVar('var(--a, var(--b, #fff))', scope()), '#fff', 'down to the last literal');
  });
});

test('a plain colour passes through untouched, so every seed can be wrapped', () => {
  withVars({ '--brand-primary': '#ff8fbe' }, () => {
    for (const v of ['#0c322c', 'transparent', 'rgb(1 2 3)', 'oklch(62% 0.11 250)', '']) {
      assert.equal(resolveColorVar(v, scope()), v);
    }
  });
});

test('the resolver never throws when there is no computed style to read', () => {
  const real = globalThis.getComputedStyle;
  (globalThis as { getComputedStyle: unknown }).getComputedStyle = (() => { throw new Error('no layout'); });
  try {
    assert.equal(resolveColorVar('var(--x, #123456)', scope()), '#123456');
  } finally { (globalThis as { getComputedStyle: unknown }).getComputedStyle = real; }
});

test('a brand token has a human name; a private variable does not', () => {
  assert.equal(colorVarLabel('var(--brand-primary, #0b1220)'), 'Primary');
  assert.equal(colorVarLabel('var(--brand-on-primary)'), 'On Primary');
  assert.equal(colorVarLabel('var(--lolly-frame-surface)'), 'Frame Surface');
  assert.equal(colorVarLabel('var(--x)'), '', 'not a brand token');
  assert.equal(colorVarLabel('#0b1220'), '', 'not a var at all');
});

test('a host can say WHICH property the field paints, and an edit does not lose it', () => {
  // A panel can lay out several of these at once - the Design inspector shows Fill,
  // Stroke, shadow Colour and Text colour on one box, in `<div><span>` rows that
  // associate nothing - so all four announced the identical "Colour: #000000": the
  // trigger carried the value and no hint of what the value was FOR.
  const m = mount('#123456', { float: true, label: 'Fill' });
  const trigger = m.field.querySelector('.color-trigger')!;
  assert.match(trigger.getAttribute('aria-label') ?? '', /^Fill: /, 'the name leads with the property');
  assert.match(trigger.getAttribute('aria-label') ?? '', /#123456/, 'and still says which colour it is');
  assert.equal(m.field.querySelector('.color-trigger-name')!.textContent, swatchName('#123456'),
    'and the VISIBLE name is untouched - the label is an accessible-name addition, not a caption');

  // updateTrigger rewrites this attribute on every edit, so the label rides on the
  // field (data-color-label) rather than in a closure it could be dropped from.
  const hex = m.field.querySelector<HTMLInputElement>('.color-input')!;
  hex.value = '#00ff00';
  fire(hex, 'change');
  assert.match(trigger.getAttribute('aria-label') ?? '', /^Fill: /, 'the property survived the edit');

  // Nothing passed, nothing changed: the wording is what it has always been.
  const plain = mount('#123456', { float: true });
  assert.match(plain.field.querySelector('.color-trigger')!.getAttribute('aria-label') ?? '', /^Colour: /);
});

test('the name a host passes wins over the computed one, and the hex still rides along', () => {
  const host = document.getElementById('host')!;
  host.innerHTML = colorFieldHtml('cf-tok', '#ff8fbe', { float: true, name: 'Primary' });
  const trigger = host.querySelector('.color-trigger')!;
  assert.equal(host.querySelector('.color-trigger-name')!.textContent, 'Primary');
  assert.match(trigger.getAttribute('aria-label') ?? '', /^Colour: Primary #ff8fbe/,
    'the token names the colour and the resolved hex says which one it is today');
  // Without the override the field names the colour itself.
  host.innerHTML = colorFieldHtml('cf-tok', '#ff8fbe', { float: true });
  assert.notEqual(host.querySelector('.color-trigger-name')!.textContent, 'Primary');
});


test('the everyday picker defaults to HSL; switching to OKLCH preserves colour and alpha', () => {
  const { field, seen } = mount('color(display-p3 1 0 0 / 0.4)');
  const canonical = field.dataset.colorCanon;
  const modes = field.querySelector<HTMLElement>('[data-color-modes]')!;
  assert.deepEqual([...modes.querySelectorAll('[role="tab"]')].map(t => t.getAttribute('data-mode')), ['hsl', 'oklch']);
  assert.equal(modes.dataset.activeMode, 'hsl');
  selectSpace(field, 'oklch');
  assert.equal(modes.dataset.activeMode, 'oklch');
  assert.equal(field.dataset.colorCanon, canonical);
  assert.equal(seen.length, 0);
  drag(field, 'oklch', 'l', 65);
  assert.equal(seen.at(-1)!.detail.mode, 'oklch');
  assert.equal(seen.at(-1)!.detail.color.alpha, 0.4);
});

test('palette scrolling stays open without focus entering it; outside scrolling dismisses', async () => {
  const { field } = mount('#30ba78');
  const trigger = field.querySelector<HTMLButtonElement>('.color-trigger')!;
  trigger.click();
  trigger.focus();
  await wait(1); // Outside listeners arm after the opening click.
  const popover = field.querySelector<HTMLElement>('.color-popover')!;
  field.querySelector('.color-swatches')!.dispatchEvent(new dom.window.Event('scroll'));
  assert.equal(popover.hidden, false);
  popover.dispatchEvent(new dom.window.Event('scroll'));
  assert.equal(popover.hidden, false, 'the viewport-bounded panel can scroll too');
  window.dispatchEvent(new dom.window.Event('scroll'));
  assert.equal(popover.hidden, true);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
});

test('a compact trigger opens a usable viewport-bounded picker', () => {
  const { field } = mount('#2453ff', { float: true });
  const trigger = field.querySelector<HTMLButtonElement>('.color-trigger')!;
  trigger.getBoundingClientRect = () => new dom.window.DOMRect(1000, 740, 34, 34);
  trigger.click();
  const popover = field.querySelector<HTMLElement>('.color-popover')!;
  assert.ok(parseFloat(popover.style.width) >= 264);
  assert.ok(parseFloat(popover.style.left) + parseFloat(popover.style.width) <= window.innerWidth - 8);
  assert.ok(parseFloat(popover.style.top) + parseFloat(popover.style.maxHeight) <= window.innerHeight - 8);
  field.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
});

test('inline palette is populated and fine-tuning is optional; names precede trigger swatches', () => {
  const { field, seen } = mount('#30ba78', { inline: true, palette: true });
  assert.ok(field.querySelectorAll('.color-swatches button').length > 0);
  assert.equal(field.querySelector<HTMLElement>('[data-color-fine]')!.hidden, true);
  assert.equal(field.querySelector('.color-swatch-menu'), null);
  field.querySelector<HTMLButtonElement>('[data-color-fine-toggle]')!.click();
  assert.equal(field.querySelector<HTMLElement>('[data-color-fine]')!.hidden, false);
  assert.equal(seen.length, 0);
  const { field: named } = mount('#fe7c3f', { name: 'Persimmon' });
  assert.deepEqual([...named.querySelector('.color-trigger')!.children].map(el => el.className), ['color-trigger-name', 'color-trigger-preview']);
});

test('with no screen sampler and no creative surface, the eyedropper opens the system colour picker', () => {
  // No window.EyeDropper (jsdom) and no #tool-canvas to loupe → the button falls
  // back to the OS colour panel rather than doing nothing (plan 216 item 8). This
  // decision is now made at click time, so there are no mount-time markers to read.
  const { field, seen } = mount('#30ba7880');
  const action = field.querySelector<HTMLButtonElement>('[data-color-eyedropper]')!;
  const native = field.querySelector<HTMLInputElement>('.color-popover-native')!;
  let opened = 0;
  native.addEventListener('click', () => opened++);
  action.click();
  assert.equal(opened, 1);
  native.value = '#fe7c3f';
  fire(native);
  assert.equal(seen.at(-1)!.value, '#fe7c3f80');
});

test('screen eyedropper preserves alpha and treats cancellation as no edit', async () => {
  const win = window as typeof window & { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } };
  let cancelled = false;
  win.EyeDropper = class { async open() { if (cancelled) throw new Error('cancelled'); return { sRGBHex: '#2453ff' }; } };
  // Warm the lazily-imported eyedropper module so the click's dynamic import is a
  // cache hit and a one-tick wait is enough to observe the result.
  await import('../lib/eyedropper.ts');
  try {
    const { field, seen } = mount('#30ba7880');
    const action = field.querySelector<HTMLButtonElement>('[data-color-eyedropper]')!;
    action.click();
    await wait(5);
    assert.equal(seen.at(-1)!.value, '#2453ff80', 'the picked colour keeps the field alpha');
    cancelled = true;
    action.click();
    await wait(5);
    assert.equal(seen.length, 1, 'a cancelled pick is no edit');
  } finally { delete win.EyeDropper; }
});
