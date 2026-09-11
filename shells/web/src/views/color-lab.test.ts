// SPDX-License-Identifier: MPL-2.0
/*
 * Colour Lab (#/lab) - the report's structure and its picking contract.
 *
 * Run directly:  node --test shells/web/src/views/color-lab.test.ts
 *
 * What matters here is that the report never describes one colour while showing
 * another. The subject is deliberately NOT clamped to sRGB, so two values are
 * always in play: the authored one and the nearest displayable one. Guard against
 * the failure mode where the two get silently conflated.
 *
 * jsdom gives no canvas 2D context and no layout, so the chart fills and the 3D
 * solid can't paint here; both bail cleanly on a zero-size box, which is exactly
 * what lets this file exercise the rest. The pixel work is verified against the
 * engine in tests/gamut.test.ts and tests/gamut-solid.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import {
  describeColor, inGamut, clipToGamut, oklchToHex, hexToOklch,
  apcaContrast, apcaUse, simulateCvdHex, toGrayscaleHex,
} from '@lolly/engine';
import type { GamutSource } from '@lolly/engine';

const dom = new JSDOM('<!doctype html><html><body><main id="view"></main></body></html>', {
  url: 'http://localhost/#/lab',
  pretendToBeVisual: true,
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.MutationObserver = dom.window.MutationObserver;
// jsdom rejects an Event built by Node's own constructor (different realm), and
// `applyTheme` dispatches one on window - so the jsdom versions have to win here.
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.Event = dom.window.Event;
globalThis.localStorage = dom.window.localStorage;
globalThis.sessionStorage = dom.window.sessionStorage;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
  dom.window.setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((id: number) => dom.window.clearTimeout(id)) as typeof cancelAnimationFrame;
// jsdom has no <dialog> showModal/close - shim the surface mountModal uses, so the
// profile panel (components/profiles-manager.ts) can open here.
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLDialogElement) {
  this.removeAttribute('open');
  this.dispatchEvent(new dom.window.Event('close'));
};
// jsdom has neither of these; the view's picker and drag paths touch both.
dom.window.Element.prototype.setPointerCapture = function () {};
dom.window.Element.prototype.releasePointerCapture = function () {};
dom.window.Element.prototype.hasPointerCapture = function () { return false; };
(dom.window as unknown as { CSS: { escape(s: string): string } }).CSS = {
  escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
};
globalThis.CSS = (dom.window as unknown as { CSS: typeof globalThis.CSS }).CSS;
/** jsdom has no clipboard - record what the view tries to copy. `navigator` is a
 *  getter-only global, so define the property rather than assigning it. */
const copied: string[] = [];
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { clipboard: { writeText: (v: string) => { copied.push(v); return Promise.resolve(); } } },
});

const { mountColorLab, swatchGamutState, contrastMatrix, simulatePalette } = await import('./color-lab.ts');
const { contrastText } = await import('../components/color-field.ts');
const { resetDisplayGamut } = await import('../lib/display-gamut.ts');

/**
 * Run `fn` with a stubbed HDR-capable display, then restore SDR detection.
 *
 * display-gamut.ts reads the bare `matchMedia` global and caches; jsdom has none, so
 * `displaySupportsHdr()` is false by default (which is what the SDR-path tests want).
 * This installs a stub whose `(dynamic-range: high)` matches, resets the module's
 * caches around it, and tears the stub back down so the surrounding tests stay SDR.
 */
async function withHdrDisplay(fn: () => Promise<void>): Promise<void> {
  const mm = (q: string): object => ({
    matches: /dynamic-range:\s*high/.test(q),
    media: q,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  });
  (globalThis as unknown as { matchMedia?: unknown }).matchMedia = mm;
  resetDisplayGamut();
  try { await fn(); }
  finally {
    delete (globalThis as unknown as { matchMedia?: unknown }).matchMedia;
    resetDisplayGamut();
  }
}

const view = document.getElementById('view')!;

/** Mount the view fresh with an optional `?c=` seed. */
async function mount(params = ''): Promise<void> {
  // Tear the previous mount down the way the router does - `#view` is persistent,
  // so clearing its children alone leaves the last view's rAF loop, observers and
  // its body-level toast behind (which is exactly what used to leak in the app).
  (view as HTMLElement & { _cleanup?: () => void })._cleanup?.();
  delete (view as HTMLElement & { _cleanup?: () => void })._cleanup;
  view.innerHTML = '';
  await mountColorLab(view, {}, params);
}

const $ = (sel: string): HTMLElement | null => view.querySelector<HTMLElement>(sel);
const text = (sel: string): string => ($(sel)?.textContent ?? '').trim();

/** The subject's sRGB hex, read off the swatch's hex alternate. There is no text
 *  field to read any more - the picker's own value pill is the single entry. */
function subjectHex(): string {
  const li = [...view.querySelectorAll('[data-lab-sw-alts] .lab-sw-alt')]
    .find(x => (x.querySelector('.lab-sw-alt-space')?.textContent ?? '').trim() === 'hex');
  return (li?.querySelector('code')?.textContent ?? '').trim().toLowerCase();
}
/** The subject's OKLCH, read off the panels' numeric inputs. */
function subjectOklch(): { l: number; c: number; h: number } {
  const num = (plane: string): number =>
    Number(($(`[data-lab-num="${plane}"]`) as HTMLInputElement).value);
  return { l: num('lc'), c: num('ch'), h: num('lh') };
}

test('the report mounts with every section present', async () => {
  await mount();
  for (const sel of [
    '[data-lab-swatch]', '[data-lab-picker]', '[data-lab-limit]',
    '[data-lab-gamut]', '[data-lab-headroom]', '[data-lab-ceilings]',
    '[data-lab-nits]', '[data-lab-hdr]',
    '[data-lab-contrast]', '[data-lab-ramp]', '[data-lab-notations]',
    '[data-lab-chart="lc"]', '[data-lab-chart="ch"]', '[data-lab-chart="lh"]',
    '[data-lab-solid]', '[data-lab-steps]', '[data-lab-blend]', '[data-lab-blend-raw]',
  ]) {
    assert.ok($(sel), `${sel} is present`);
  }
  // All four charts at once, not a switcher.
  assert.equal(view.querySelectorAll('[data-lab-chart]').length, 3);
  assert.equal(view.querySelectorAll('[data-lab-solid]').length, 1);
  // The real picker mounted, rather than a native colour input.
  assert.ok($('[data-lab-picker] [data-color-field]'), 'the shared colour field is mounted');
  // The colour field keeps ONE native input as a display:none canonical-hex
  // store, never clicked - the shell deliberately opens no OS colour picker. So
  // the check is that every native input is that store, not that none exists.
  for (const native of view.querySelectorAll('input[type="color"]')) {
    assert.ok(native.closest('.color-popover-native'),
      'a native colour input exists outside the hidden hex store');
  }
  // And the picker brought its OKLCH rings/sliders, which is why this is a view.
  assert.ok($('[data-lab-picker] .color-lch'), 'the LCH sliders are mounted');
});

test('a wide-gamut seed is described unclamped, and the clamp is disclosed', async () => {
  await mount('?c=' + encodeURIComponent('color(display-p3 1 0 0)'));
  // The gamut verdict names P3, not sRGB.
  assert.match(text('[data-lab-gamut] [data-lab-gamut-name]'), /Display-P3/);
  assert.equal($('[data-lab-gamut]')!.dataset.gamut, 'p3');
  // Headroom is negative - it is past the sRGB ceiling.
  assert.equal($('[data-lab-headroom]')!.dataset.state, 'over');
  assert.match(text('[data-lab-headroom] [data-lab-headroom-val]'), /^-/);
  // And the report SAYS the swatch is showing something else.
  // The notice is a toast - the nudge on crossing the boundary. The standing
  // record is the gamut card in step 5, so nothing sits in the flow.
  const toast = document.querySelector('[data-lab-toast]');
  assert.ok(toast, 'the out-of-gamut toast was raised');
  assert.match(toast!.textContent ?? '', /outside sRGB/i);
  // The swatch leads with the space the PICKER is set to (OKLCH by default), and
  // says where the colour was actually authored so it can't read as if it were
  // typed in OKLCH. The authored form itself stays in the field and the alternates.
  assert.match(text('[data-lab-sw-primary]'), /^oklch\(/);
  assert.match(text('[data-lab-sw-space]'), /^oklch · set in display-p3/);
  const altSpaces = [...view.querySelectorAll('[data-lab-sw-alts] .lab-sw-alt-space')]
    .map(el => (el.textContent ?? '').trim());
  assert.ok(altSpaces.includes('display-p3'), `the authored space is an alternate: ${altSpaces}`);
  assert.match(toast!.textContent ?? '', /#FF/i);
  // The authored form survives as an alternate even though nothing echoes it back
  // in a text field any more.
  const altCodes = [...view.querySelectorAll('[data-lab-sw-alts] code')].map(c => (c.textContent ?? '').trim());
  assert.ok(altCodes.some(c => c === 'color(display-p3 1 0 0)'), `authored form listed: ${altCodes}`);
  // The swatch asks the browser for the REAL colour, with the hex only as the
  // CSS fallback underneath it.
  assert.equal($('[data-lab-swatch]')!.style.background, 'color(display-p3 1 0 0)');
});

test('the picker is handed the authored colour, not its sRGB restatement', async () => {
  const subject = 'color(display-p3 1 0 0)';
  await mount('?c=' + encodeURIComponent(subject));
  // Read what the field was SEEDED with - the canonical attribute when the component
  // publishes one, otherwise the rendered value attribute. Not the live input value:
  // that is the picker's own working notation, which is its business, not the view's.
  const field = $('[data-lab-picker] [data-color-field]') ?? $('[data-lab-picker]')!;
  const seeded = field.getAttribute('data-color-canon')
    ?? $('[data-lab-picker] input.color-input')!.getAttribute('value') ?? '';
  const seededDesc = describeColor(seeded);
  assert.ok(seededDesc, `the picker's seed is a readable colour: ${seeded}`);
  // Seeding it with srgbHex is what used to flatten the subject: the picker echoes
  // its value back, and the echo then BECAME the subject. So the seed must still be
  // the wide colour, and must not be the gamut-mapped hex.
  assert.equal(seededDesc!.gamut, 'p3', `seeded at its real gamut: ${seeded}`);
  assert.notEqual(seeded.trim().toLowerCase(), describeColor(subject)!.srgbHex.toLowerCase());
});

test('an in-gamut colour raises no gamut toast at all', async () => {
  await mount('?c=%23c0392b');
  assert.equal(document.querySelector('[data-lab-toast]'), null);
  assert.equal($('[data-lab-gamut]')!.dataset.gamut, 'srgb');
  assert.equal($('[data-lab-headroom]')!.dataset.state, 'under');
  assert.match(text('[data-lab-headroom] [data-lab-headroom-val]'), /^\+/);
});

test('a junk seed falls back instead of rendering an empty report', async () => {
  await mount('?c=not-a-colour');
  assert.ok(text('[data-lab-gamut] [data-lab-gamut-name]').length > 0, 'still describes something');
  assert.equal(document.querySelector('[data-lab-toast]'), null);
});

test('any CSS space still arrives via ?c=, and junk falls back', async () => {
  // The removed text field was the only in-page way to type a wide-gamut value;
  // the URL param remains, and becomes redundant once the picker carries tabs for
  // those spaces. Junk must fall back rather than render an empty report.
  for (const [seed, gamut] of [
    ['oklch(70% 0.30 145)', 'rec2020'],
    ['lab(55% 70 50)', 'srgb'],
    ['color(display-p3 1 0 0)', 'p3'],
  ] as [string, string][]) {
    await mount('?c=' + encodeURIComponent(seed));
    assert.equal($('[data-lab-gamut]')!.dataset.gamut, gamut, seed);
  }
  await mount('?c=' + encodeURIComponent('chartreuse-ish'));
  assert.ok(text('[data-lab-gamut-name]').length > 0, 'junk still renders a report');
});

test('the notation table lists every space and marks the ones that clamp', async () => {
  await mount('?c=' + encodeURIComponent('color(display-p3 1 0 0)'));
  const rows = [...view.querySelectorAll('[data-lab-notations] tr')];
  assert.ok(rows.length >= 8, `${rows.length} notation rows`);
  const inexact = rows.filter(r => r.classList.contains('is-inexact'));
  assert.ok(inexact.length > 0, 'a P3 colour cannot be written in sRGB exactly');
  // Every row offers its value for copying.
  for (const r of rows) {
    assert.ok(r.querySelector('[data-lab-copy]'), 'each row has a copy button');
    assert.ok((r.querySelector('code')?.textContent ?? '').length > 0, 'each row shows a value');
  }
  // sRGB specifically must be flagged for this colour.
  const srgbRow = rows.find(r => r.querySelector('th')?.textContent === 'srgb');
  assert.ok(srgbRow?.classList.contains('is-inexact'), 'the sRGB row is flagged');
});

test('readability leads with APCA and follows with WCAG, on three surfaces', async () => {
  await mount('?c=%23c0392b');
  const cards = [...view.querySelectorAll('.lab-contrast-card')];
  assert.equal(cards.length, 3, 'white text, black text, and a surface you choose');
  assert.equal(cards.filter(c => c.classList.contains('is-best')).length, 1,
    'exactly one of the two extremes is marked best');

  for (const c of cards) {
    // APCA first - an Lc and the band it falls in.
    const apca = c.querySelector('[data-lab-apca]');
    assert.ok(apca, 'every card carries an Lc');
    assert.match(apca!.textContent ?? '', /Lc \d+\.\d/, 'the Lc is shown');
    assert.ok((apca as HTMLElement).dataset.use, 'and the band it falls in');
    // WCAG second - still present, still with both badges.
    assert.match(c.textContent ?? '', /\d+\.\d+:1/, 'shows a ratio');
    assert.equal(c.querySelectorAll('.lab-wcag').length, 2, 'body and large badges');
    // The order in the DOM IS the hierarchy - APCA must come first.
    const kids = [...c.children].map(k => k.className);
    const iApca = kids.findIndex(k => k.includes('lab-apca'));
    const iWcag = kids.findIndex(k => k.includes('lab-contrast-wcag'));
    assert.ok(iApca >= 0 && iWcag > iApca, `APCA precedes WCAG: ${kids.join(' | ')}`);
  }

  // The summary line leads with the Lc too, and names WCAG's number second.
  const note = text('[data-lab-contrast-note]');
  assert.match(note, /Best pairing/);
  assert.match(note, /Lc \d+\.\d/);
  assert.ok(note.indexOf('Lc') < note.indexOf('WCAG'), `APCA first in the summary: ${note}`);
});

test('the third surface is pickable and re-scores when it changes', async () => {
  await mount('?c=%23c0392b');
  const third = [...view.querySelectorAll('.lab-contrast-card')][2]!;
  // A popover picker, which is what a secondary control on a card wants - the
  // expanded form's rings would dominate the two numbers beside them.
  const pick = third.querySelector('[data-lab-ink-pick]');
  assert.ok(pick, 'the third card carries its own picker');
  assert.ok(pick!.querySelector('[data-color-field], .color-field, input'),
    'and the picker actually mounted');

  // Re-query after every change: a re-score REPLACES the cards, so a held
  // reference goes stale and would report the old number forever.
  const lcOf = (): string => (
    view.querySelectorAll('.lab-contrast-card')[2]?.querySelector('.lab-apca-lc')?.textContent ?? ''
  ).trim();
  const before = lcOf();
  // Drive it the way the component reports a pick - its own value field.
  const field = pick!.querySelector('input[data-color-hex]') as HTMLInputElement | null;
  assert.ok(field, 'the popover has a value field');
  field!.value = '#111111';
  field!.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 0));
  assert.notEqual(lcOf(), before, `a new surface re-scores the card: ${before} → ${lcOf()}`);
  // A near-black surface under a mid red is a far worse pairing than white was, so
  // the direction is checkable, not just the fact that something moved.
  assert.ok(Number(lcOf().replace(/[^\d.]/g, '')) < Number(before.replace(/[^\d.]/g, '')),
    `and it re-scores in the right direction: ${before} → ${lcOf()}`);
});

test('the tone ramp is pickable and every step re-seeds the report', async () => {
  await mount('?c=%23c0392b');
  // Scoped to the TONES ramp - there is a second ramp (the blend) further down.
  const steps = [...view.querySelectorAll<HTMLElement>('[data-lab-ramp] [data-lab-step]')];
  assert.equal(steps.length, 9);
  const before = text('[data-lab-sw-primary]');
  const target = steps[1]!;
  const wanted = target.dataset.labStep!;
  target.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.notEqual(text('[data-lab-sw-primary]'), before, 'the subject moved');
  // The swatch reads in OKLCH, so the step is confirmed through the hex alternate.
  assert.equal(subjectHex(), wanted.toLowerCase(), 'to the step that was clicked');
});

test('the gamut limit narrows the charts and their legends', async () => {
  await mount();
  const legendKeys = (): number => view.querySelectorAll('[data-lab-chart="lc"] .okls-key').length;
  const seg = $('[data-lab-limit]')!;
  // Rec.2020 is the DEFAULT - the report should not start by hiding colour the
  // user's screen might well be able to show.
  assert.equal(seg.querySelector('[data-val="rec2020"]')!.getAttribute('aria-pressed'), 'true');
  const atWidest = legendKeys();

  seg.querySelector<HTMLElement>('[data-val="srgb"]')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.ok(legendKeys() < atWidest, `sRGB-only shows fewer keys (${legendKeys()} < ${atWidest})`);
  assert.equal(seg.querySelector('[data-val="srgb"]')!.getAttribute('aria-pressed'), 'true');
  assert.equal(seg.querySelector('[data-val="rec2020"]')!.getAttribute('aria-pressed'), 'false');

  seg.querySelector<HTMLElement>('[data-val="rec2020"]')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(legendKeys(), atWidest, 'and back');
});

test('a narrower target narrows the CHARTS, never the controls or the colour', async () => {
  // The pill is a lens, not an editor. `oklch(50% 0.38 328)` is a real Rec.2020
  // colour, and pressing sRGB to see where sRGB stops must not take it away - that
  // would be the comparison target rewriting the subject, and it did: the chroma
  // range's own `max` dropped to sRGB's axis ceiling and the browser clamped the
  // value under it while the readout still said 0.380.
  await mount('?c=' + encodeURIComponent('oklch(50% 0.38 328)'));
  const num = (): HTMLInputElement => $('[data-lab-num="ch"]') as HTMLInputElement;
  const rng = (): HTMLInputElement => $('[data-lab-slider="ch"] [data-gsl-input]') as HTMLInputElement;
  /** Every chroma tick on the C×H chart, biggest first - the axis the chart draws. */
  const axisTop = (): number => Math.max(...[...view.querySelectorAll('[data-lab-chart="ch"] .okls-tick')]
    .map(el => Number(el.textContent)).filter(n => Number.isFinite(n) && n <= 1));

  const wideNum = num().max, wideRng = rng().max, wideAxis = axisTop();
  assert.equal(Number(rng().value).toFixed(3), '0.380', 'the thumb starts on the authored chroma');

  $('[data-lab-limit]')!.querySelector<HTMLElement>('[data-val="srgb"]')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

  assert.equal(num().max, wideNum, 'the typed box keeps its reach');
  assert.equal(rng().max, wideRng, 'so does the slider');
  assert.equal(Number(rng().value).toFixed(3), '0.380', 'and the thumb is still ON the value');
  assert.ok(Math.abs(subjectOklch().c - 0.38) < 1e-6, `the colour is untouched, got ${subjectOklch().c}`);

  // Typing it again is honoured rather than pulled back to sRGB's ceiling.
  num().value = '0.38';
  num().dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.ok(Math.abs(subjectOklch().c - 0.38) < 1e-6, `re-typing 0.38 sticks, got ${subjectOklch().c}`);

  // The chart's axis is the part that SHOULD follow the tab - that is what makes the
  // envelope fill the plot - so this is not a "nothing changed" test.
  assert.ok(axisTop() < wideAxis, `the chart axis narrowed (${axisTop()} < ${wideAxis})`);
});

test('a chroma past every axis stays expressible, and the slider stretches to it', async () => {
  // A chroma ceiling is a choice, not a bound. A range input cannot hold a value
  // above its own max, so the axis has to grow - otherwise a shared link at 0.7
  // opens with the thumb pinned at the end reporting a colour it is not on.
  await mount('?c=' + encodeURIComponent('oklch(50% 0.7 328)'));
  const rng = $('[data-lab-slider="ch"] [data-gsl-input]') as HTMLInputElement;
  assert.ok(Number(rng.max) >= Number(rng.value), `the axis reaches the thumb, max ${rng.max}`);
  assert.equal(Number(rng.value).toFixed(3), '0.700');
  assert.ok(Math.abs(subjectOklch().c - 0.7) < 1e-6, `and the value survived, got ${subjectOklch().c}`);
});

test('the report opens in OKLCH, not hex', async () => {
  await mount();
  // The swatch leads in the picker's space, which defaults to OKLCH - hex is the
  // sRGB-only fallback expression and must not be what greets you.
  assert.match(text('[data-lab-sw-primary]'), /^oklch\(/, text('[data-lab-sw-primary]'));
  assert.match(text('[data-lab-sw-space]'), /^oklch/);
});

test('all three planes are sliced through the SAME colour', async () => {
  await mount('?c=' + encodeURIComponent('oklch(62% 0.15 260)'));
  // Each plane holds a different channel constant, and each must hold the
  // subject's own value for it - otherwise the three charts are unrelated views
  // rather than three cuts through one colour.
  assert.match(text('[data-lab-slice-at="lc"]'), /^260°$/);   // hue
  assert.match(text('[data-lab-slice-at="ch"]'), /^62%$/);    // lightness
  assert.match(text('[data-lab-slice-at="lh"]'), /^0\.15/);   // chroma
  // And each chart carries a dot for the subject.
  for (const plane of ['lc', 'ch', 'lh']) {
    assert.ok($(`[data-lab-chart="${plane}"] [data-okls-idx="0"]`), `${plane} plots the subject`);
  }
});

test('the URL keeps the subject shareable without stacking history', async () => {
  await mount('?c=%23c0392b');
  const before = dom.window.history.length;
  const step = view.querySelector<HTMLElement>('[data-lab-ramp] [data-lab-step]')!;
  const wanted = step.dataset.labStep!;
  step.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.match(dom.window.location.hash, /^#\/lab\?c=/);
  assert.equal(decodeURIComponent(dom.window.location.hash), `#/lab?c=${wanted}`);
  assert.equal(dom.window.history.length, before, 'replaceState, not pushState');
});

test('the page reads as one narrowing sequence, in order', async () => {
  await mount();
  // The hierarchy IS the feature: set a colour, choose what to see it against,
  // the charts, every notation, then what you build from it. A reorder that puts
  // the notation table before the charts (or the gamut control back above the
  // charts, away from the verdict it drives) should fail here.
  const heads = [...view.querySelectorAll('.lab-step-h')].map(h => (h.textContent ?? '').trim());
  assert.equal(heads.length, 5, `five steps, got ${heads.length}`);
  assert.match(heads[0]!, /Set a colour/);
  assert.match(heads[1]!, /Plotted on a colour space/);
  assert.match(heads[2]!, /Every notation/);
  assert.match(heads[3]!, /Tones and blends/);
  assert.match(heads[4]!, /Displayable range and readability/);

  // The charts sit high - second block, right after setting a colour - and the
  // gamut control travels WITH them, because it governs what they draw.
  const charts = view.querySelectorAll('.lab-step-block')[1]!;
  assert.equal(charts.querySelectorAll('[data-lab-chart]').length, 3);
  assert.ok(charts.querySelector('[data-lab-solid]'), 'the 3D chart is in the charts block');
  assert.ok(charts.querySelector('[data-lab-limit]'), 'the limit control is with the charts');

  // The verdict and the readability scores are reference material: LAST block.
  const ref = view.querySelectorAll('.lab-step-block')[4]!;
  assert.ok(ref.querySelector('[data-lab-gamut]'), 'the gamut verdict is at the bottom');
  assert.ok(ref.querySelector('[data-lab-contrast]'), '…with the readability scores');
  assert.equal(ref.querySelector('[data-lab-chart]'), null, 'and no charts down there');

  // Setting a colour is step 1, and all three ways in are there together.
  const setStep = view.querySelectorAll('.lab-step-block')[0]!;
  for (const sel of ['[data-lab-picker]', '[data-lab-brand]']) {
    assert.ok(setStep.querySelector(sel), `${sel} is a way into step 1`);
  }
});

test('the blend ramp spans the subject to a second colour the user sets', async () => {
  await mount('?c=%23c0392b');
  const blendSteps = (): string[] =>
    [...view.querySelectorAll<HTMLElement>('[data-lab-blend] [data-lab-step]')]
      .map(b => b.dataset.labStep!);
  const before = blendSteps();
  assert.equal(before.length, 9);
  // It starts at the subject.
  assert.equal(before[0]!.toLowerCase(), '#c0392b');

  // Changing the far end changes the ramp - and only the far end of it.
  const raw = $('[data-lab-blend-raw]') as HTMLInputElement;
  raw.value = 'oklch(90% 0.15 200)';
  raw.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  const after = blendSteps();
  assert.equal(after[0]!.toLowerCase(), '#c0392b', 'the near end is still the subject');
  assert.notEqual(after[8], before[8], 'the far end moved');
  // Junk is rejected without wrecking the ramp.
  raw.value = 'nope';
  raw.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(raw.getAttribute('aria-invalid'), 'true');
  assert.deepEqual(blendSteps(), after, 'an invalid far end changes nothing');
});

test('each ramp carries its own stop count, and both are clamped', async () => {
  await mount('?c=%23c0392b');
  const count = (sel: string): number => view.querySelectorAll(`${sel} [data-lab-step]`).length;
  assert.equal(count('[data-lab-ramp]'), 9);
  assert.equal(count('[data-lab-blend]'), 9);

  // The counts are separate on purpose: a tone ramp is a palette of a handful, a
  // blend gets cut finely to find one particular intermediate. So moving one must
  // NOT move the other.
  const tones = $('[data-lab-steps]') as HTMLInputElement;
  tones.value = '5';
  tones.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(count('[data-lab-ramp]'), 5, 'tones follow their own count');
  assert.equal(count('[data-lab-blend]'), 9, 'and the blend is left alone');
  assert.equal(($('[data-lab-steps-out]')!.textContent ?? '').trim(), '5');

  const mix = $('[data-lab-blend-steps] [data-gsl-input]') as HTMLInputElement;
  mix.value = '4';
  mix.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(count('[data-lab-blend]'), 4, 'the blend follows the mixer slider');
  assert.equal(count('[data-lab-ramp]'), 5, 'and the tones are left alone');
  assert.equal(($('[data-lab-blend-steps] [data-gsl-val]')!.textContent ?? '').trim(), '4');

  // Clamped, not trusted: the range is the UI but the value is guarded.
  for (const [el, sel] of [[tones, '[data-lab-ramp]'], [mix, '[data-lab-blend]']] as const) {
    el.value = '999';
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.ok(count(sel) <= 24, `an absurd count is clamped (${sel})`);
  }
});

test('the blend style tabs change what the middle looks like', async () => {
  // Subject and target are far apart in hue, which is where the spaces diverge most.
  await mount('?c=%23c0392b');
  const midHex = (): string => {
    const steps = [...view.querySelectorAll('[data-lab-blend] [data-lab-step]')];
    return (steps[Math.floor(steps.length / 2)]?.querySelector('.lab-step-hex')?.textContent ?? '').trim();
  };
  const seg = $('[data-lab-blend-space]')!;
  const pick = (val: string): void => {
    seg.querySelector<HTMLElement>(`[data-val="${val}"]`)!.dispatchEvent(
      new dom.window.MouseEvent('click', { bubbles: true }));
  };

  // VIVID is the default on this page - it is where you come to see how much colour
  // a blend can hold - and the tab says so.
  assert.equal(seg.querySelector('[data-val="oklch"]')!.getAttribute('aria-pressed'), 'true');
  const vivid = midHex();
  assert.match(vivid, /^#[0-9A-F]{6}$/);

  // Smooth goes through the middle instead of round, so the midpoint differs.
  pick('oklab');
  const smooth = midHex();
  assert.notEqual(smooth, vivid, 'Smooth is not Vivid');
  assert.equal(seg.querySelector('[data-val="oklab"]')!.getAttribute('aria-pressed'), 'true');
  assert.equal(seg.querySelector('[data-val="oklch"]')!.getAttribute('aria-pressed'), 'false');

  // sRGB is the classic behaviour, named plainly. Also distinct.
  pick('srgb');
  assert.notEqual(midHex(), vivid, 'sRGB is not Vivid');

  // The ends are exact in every style - a blend that does not start at the subject
  // is describing a different colour from the one the page is about.
  const ends = (): [string, string] => {
    const steps = [...view.querySelectorAll('[data-lab-blend] [data-lab-step] .lab-step-hex')];
    return [(steps[0]?.textContent ?? '').trim(), (steps[steps.length - 1]?.textContent ?? '').trim()];
  };
  for (const style of ['oklch', 'oklab', 'srgb']) {
    pick(style);
    assert.equal(ends()[0], '#C0392B', `${style} starts at the subject`);
  }
});

test('the hue route appears only where hue travel is a real choice', async () => {
  await mount('?c=%23c0392b');
  const hue = $('[data-lab-blend-hue]') as HTMLElement;
  const pickSpace = (val: string): void => {
    $('[data-lab-blend-space]')!.querySelector<HTMLElement>(`[data-val="${val}"]`)!
      .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  };
  // Vivid is the default and IS polar, so the row starts visible. OKLab and sRGB are
  // rectangular - no circle to go round, and CSS would reject `in oklab longer hue`.
  assert.equal(hue.hidden, false, 'shown for the default Vivid');
  pickSpace('srgb');
  assert.equal(hue.hidden, true, 'hidden for sRGB');
  pickSpace('oklab');
  assert.equal(hue.hidden, true, 'hidden for Smooth');
  pickSpace('oklch');
  assert.equal(hue.hidden, false, 'shown again for Vivid');

  const midHex = (): string => {
    const steps = [...view.querySelectorAll('[data-lab-blend] [data-lab-step] .lab-step-hex')];
    return (steps[Math.floor(steps.length / 2)]?.textContent ?? '').trim();
  };
  const short = midHex();
  hue.querySelector<HTMLElement>('[data-val="longer"]')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.notEqual(midHex(), short, 'the long way round is a different midpoint');
});

test('the blend slider rail carries the gradient it subdivides', async () => {
  await mount('?c=%23c0392b');
  // The rail IS the preview - there is no separate strip - so it has to be painted,
  // in the chosen space, from the AUTHORED values rather than their sRGB hexes.
  const seg = $('[data-lab-blend-steps] [data-gsl-track] .gsl-seg') as HTMLElement;
  assert.ok(seg, 'the rail has a painted segment');
  assert.match(seg.getAttribute('style') ?? '', /linear-gradient\(90deg in oklch,/);
  $('[data-lab-blend-space]')!.querySelector<HTMLElement>('[data-val="oklab"]')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.match(
    view.querySelector('[data-lab-blend-steps] [data-gsl-track] .gsl-seg')!.getAttribute('style') ?? '',
    /in oklab/);
  $('[data-lab-blend-space]')!.querySelector<HTMLElement>('[data-val="oklch"]')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  const after = view.querySelector('[data-lab-blend-steps] [data-gsl-track] .gsl-seg')!;
  // `shorter` is the CSS default and must be left OFF; `longer` must be stated.
  assert.doesNotMatch(after.getAttribute('style') ?? '', /shorter/);
  $('[data-lab-blend-hue]')!.querySelector<HTMLElement>('[data-val="longer"]')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.match(
    view.querySelector('[data-lab-blend-steps] [data-gsl-track] .gsl-seg')!.getAttribute('style') ?? '',
    /in oklch longer hue/);
});

test('the swatch leads in the picker’s space and lists popular alternates', async () => {
  await mount('?c=' + encodeURIComponent('color(display-p3 1 0 0)'));
  // Read the LABEL element, not textContent - the label and the value sit in
  // adjacent elements with no whitespace between them, so textContent runs
  // "oklch" straight into "oklch(64.857% …".
  const spacesOf = (): string[] =>
    [...view.querySelectorAll('[data-lab-sw-alts] .lab-sw-alt-space')]
      .map(el => (el.textContent ?? '').trim().toLowerCase());

  // OKLCH leads, because that is the picker's default tab.
  assert.match(text('[data-lab-sw-primary]'), /^oklch\(/);
  const spaces = spacesOf();
  assert.ok(!spaces.includes('oklch'), `the leading space is not repeated: ${spaces}`);
  assert.ok(spaces.includes('display-p3'), `the authored space is listed: ${spaces}`);
  assert.ok(spaces.includes('lch'), `lch present: ${spaces}`);
  // Hex is LAST - sRGB-only, so it's the fallback expression, not a peer.
  assert.equal(spaces[spaces.length - 1], 'hex');
  // Every alternate carries a real value beside its label.
  for (const li of view.querySelectorAll('[data-lab-sw-alts] .lab-sw-alt')) {
    assert.ok((li.querySelector('code')?.textContent ?? '').length > 0, 'an alternate has no value');
  }

  // Switching the picker's tab re-leads the swatch in that space.
  const hexTab = view.querySelector<HTMLElement>('[data-color-modes] [data-mode="hex"]')
    ?? view.querySelector<HTMLElement>('[data-color-modes] [data-val="hex"]');
  if (hexTab) {
    hexTab.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => dom.window.setTimeout(r, 30));
    assert.match(text('[data-lab-sw-primary]'), /^#[0-9A-F]{6}$/, 'the hex tab leads with a hex');
  }
});

test('a picker echo of the mapped hex does not collapse a wide-gamut subject', async () => {
  // The bug this pins: the picker emits an onChange as it wires up, carrying the
  // sRGB hex it was just handed. Unguarded, that arrives as if the user had picked
  // it, replacing `color(display-p3 1 0 0)` with #FF0B0C - so EVERY colour in the
  // report read "sRGB" no matter what was typed.
  //
  // jsdom does not fire the mount-time event, which is exactly why the suite was
  // blind to it and a browser check found it. So the guard itself is what's tested
  // here: feed the picker's value field the mapped hex and assert nothing moves.
  await mount('?c=' + encodeURIComponent('color(display-p3 1 0 0)'));
  assert.equal($('[data-lab-gamut]')!.dataset.gamut, 'p3', 'precondition: P3 subject');
  const mapped = subjectHex();

  const valueField = view.querySelector<HTMLInputElement>('[data-lab-picker] .color-input[data-color-hex]');
  assert.ok(valueField, 'the picker has a value field');
  valueField.value = mapped;
  valueField.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

  assert.equal($('[data-lab-gamut]')!.dataset.gamut, 'p3', 'still P3 after the echo');
  assert.match(text('[data-lab-sw-space]'), /set in display-p3/, 'the authored space survives');

  // …but a DIFFERENT value from the picker is a real edit and must land. Written
  // in the ACTIVE MODE's format (OKLCH by default), because that is what the
  // picker's value field parses - a hex would simply be held as unparseable there.
  valueField.value = '55% 0.13 145';
  valueField.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal($('[data-lab-gamut]')!.dataset.gamut, 'srgb', 'a real pick still works');
  assert.match(subjectHex(), /^#[0-9a-f]{6}$/, 'and becomes an sRGB hex');
});

test('each chart panel is named for the channel it sets, and sets it three ways', async () => {
  await mount('?c=' + encodeURIComponent('oklch(70% 0.19 317)'));
  // Panel titles are CHANNELS - the thing the panel's slider and number control - 
  // not the plane the chart happens to draw.
  // Scoped to the SLICE figures. A bare `.lab-chart-title` sweep was exhaustive
  // over every titled figure, so giving the 3D solid a title bar (for its pop-out
  // button) failed this test without anything being wrong - the assertion was
  // pinning "these are the only figures" when it means "these three are named for
  // their channels".
  const titles = [...view.querySelectorAll('.lab-chart:not(.lab-chart--solid) .lab-chart-title')]
    .map(h => (h.textContent ?? '').trim());
  assert.deepEqual(titles, ['Lightness', 'Chroma', 'Hue']);

  // Each panel has a slider AND a typed input for its own channel.
  for (const plane of ['lc', 'ch', 'lh']) {
    assert.ok($(`[data-lab-slider="${plane}"] [data-gsl-input]`), `${plane} has a slider`);
    assert.ok($(`[data-lab-num="${plane}"]`), `${plane} has a number`);
  }

  // The Hue panel's controls move HUE, not the plane's fixed channel.
  const hueNum = $('[data-lab-num="lh"]') as HTMLInputElement;
  assert.ok(Math.abs(Number(hueNum.value) - 317) < 0.5, `hue input shows the hue: ${hueNum.value}`);
  hueNum.value = '120';
  hueNum.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  const after = subjectOklch();
  assert.ok(Math.abs(after.h - 120) < 1.5, `hue moved to 120, got ${after.h}`);
  assert.ok(Math.abs(after.l - 0.7) < 0.02, 'lightness held');

  // The Lightness panel's number moves lightness.
  const lNum = $('[data-lab-num="lc"]') as HTMLInputElement;
  lNum.value = '0.4';
  lNum.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.ok(Math.abs(subjectOklch().l - 0.4) < 0.02, `lightness moved to 0.4, got ${subjectOklch().l}`);

  // Out-of-range typing is clamped, not obeyed.
  lNum.value = '99';
  lNum.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.ok(subjectOklch().l <= 1.0001, `clamped to 1, got ${subjectOklch().l}`);
});

test('bounds off lets you leave the gamut and marks it; bounds on yields chroma', async () => {
  // The stance, pinned: leaving sRGB is usually the intent, so the default must not
  // prevent it - it marks it. Turning bounds ON then pulls the colour in by giving
  // up CHROMA rather than refusing the axis being dragged, because refusing would
  // trap the thumb inside one segment of a broken track.
  await mount('?c=' + encodeURIComponent('oklch(70% 0.19 317)'));
  const box = $('[data-lab-bounds]') as HTMLInputElement;
  assert.ok(box, 'the toggle exists');
  assert.equal(box.checked, false, 'bounds are OFF by default');

  // Narrow the target to sRGB so a modest chroma is genuinely out.
  $('[data-lab-limit]')!.querySelector<HTMLElement>('[data-val="srgb"]')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

  // Push chroma well past what sRGB holds at this lightness and hue.
  const cNum = $('[data-lab-num="ch"]') as HTMLInputElement;
  cNum.value = '0.34';
  cNum.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  const free = subjectOklch();
  assert.ok(free.c > 0.3, `bounds off keeps the requested chroma, got ${free.c}`);
  assert.equal($('[data-lab-gamut]')!.dataset.gamut !== 'srgb', true, 'and it is out of sRGB');
  // …and the slider says so, without having stopped anything.
  assert.ok(view.querySelector('[data-lab-slider="ch"] .gsl.is-out'), 'the out-of-bounds mark is shown');

  // Now hold the bounds: chroma gives, hue and lightness do not.
  box.checked = true;
  box.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  const held = subjectOklch();
  assert.ok(held.c < free.c, `chroma yielded: ${free.c} → ${held.c}`);
  assert.ok(Math.abs(held.h - free.h) < 2, `hue held: ${free.h} → ${held.h}`);
  assert.ok(Math.abs(held.l - free.l) < 0.02, `lightness held: ${free.l} → ${held.l}`);
  assert.equal($('[data-lab-gamut]')!.dataset.gamut, 'srgb', 'and it is back inside sRGB');
  assert.equal(view.querySelector('[data-lab-slider="ch"] .gsl.is-out'), null, 'the mark clears');

  // With bounds on, a fresh out-of-range request is pulled in as it is made.
  cNum.value = '0.39';
  cNum.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal($('[data-lab-gamut]')!.dataset.gamut, 'srgb', 'held on the next edit too');
});

// The out-of-bounds MARK lives entirely in vendor thumb pseudo-elements that jsdom
// neither applies nor exposes, so the only way to test it is against the stylesheet
// text (the same approach color-field.test.ts's dashed-border sweep uses). What
// matters is the COUPLING: the glyph is baked into an SVG pre-rotated -45deg, so it
// lands upright once the thumb's own rotate(45deg) applies. Change either rotation
// and the exclamation mark silently ends up sideways.
test('the out-of-bounds diamond carries an upright exclamation mark', () => {
  const css = readFileSync(new URL('../lib/oklch-slice.css', import.meta.url), 'utf8');

  for (const thumb of ['-webkit-slider-thumb', '-moz-range-thumb']) {
    const base = new RegExp(`\\.gsl-input::${thumb} \\{([^}]*)\\}`).exec(css);
    assert.ok(base, `the base ${thumb} rule moved`);
    assert.match(base![1]!, /transform:\s*rotate\(45deg\)/,
      `${thumb} must still rotate 45deg - the glyph's -45deg counter-rotation assumes it`);

    const out = new RegExp(`\\.gsl\\.is-out \\.gsl-input::${thumb} \\{([^}]*)\\}`).exec(css);
    assert.ok(out, `the is-out ${thumb} rule moved`);
    assert.match(out![1]!, /background-image:\s*var\(--gsl-bang\)/, `${thumb} shows the mark`);
    assert.match(out![1]!, /background-position:\s*center/, `${thumb} centres it in the diamond`);
    assert.match(out![1]!, /oklch\(0\.65 0\.19 45\)/, `${thumb} keeps its warning ring`);
  }

  const glyph = /--gsl-bang:\s*url\("([^"]*)"\)/.exec(css);
  assert.ok(glyph, 'the --gsl-bang glyph moved');
  const svg = decodeURIComponent(glyph![1]!.replace(/^data:image\/svg\+xml,/, ''));
  assert.match(svg, /rotate\(-45 6 6\)/, 'the glyph is counter-rotated about the viewBox centre');
  assert.match(svg, /<rect[^>]*\/>[\s\S]*<circle[^>]*\/>/, 'a bar over a dot - an exclamation mark');
  // Sized to the diamond's UPRIGHT inscribed square, so the mark cannot overrun the
  // rotated corners. Both lengths are custom properties now - a coarse pointer scales
  // the whole slider up - so what has to hold is the RATIO between their defaults
  // (thumb / √2) and the fact that a bigger thumb takes a bigger mark with it.
  const thumb = /width:\s*var\(--gsl-thumb,\s*([\d.]+)rem\)/.exec(css);
  const bang = /background-size:\s*var\(--gsl-bang-size,\s*([\d.]+)rem\)/.exec(css);
  assert.ok(thumb && bang, 'the thumb and mark sizes are both declared');
  assert.ok(Math.abs(Number(bang![1]) - Number(thumb![1]) / Math.SQRT2) < 0.03,
    `the mark fits the inscribed square: ${bang![1]}rem against ${thumb![1]}rem / √2`);
  const coarse = /@media \(pointer: coarse\) \{\s*\.gsl \{([^}]*)\}/.exec(css);
  assert.ok(coarse, 'the coarse-pointer bump is there');
  assert.match(coarse![1]!, /--gsl-thumb:/, 'a thumb-sized thumb on touch');
  assert.match(coarse![1]!, /--gsl-bang-size:/, 'and the mark grows with it');
});

test('a blend stop copies; a tone step re-seeds', async () => {
  await mount('?c=%23c0392b');
  const before = subjectHex();
  copied.length = 0;

  // A BLEND stop is an output you take away - copying it must not move the subject,
  // which would also destroy the blend it came from (its near end IS the subject).
  const blendStop = view.querySelectorAll<HTMLElement>('[data-lab-blend] [data-lab-step]')[4]!;
  blendStop.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => dom.window.setTimeout(r, 5));
  assert.equal(copied.length, 1, `copied exactly once, got ${copied.length}`);
  assert.match(copied[0]!, /^oklch\(/, `the stop's own notation, not a hex: ${copied[0]}`);
  assert.equal(subjectHex(), before, 'and the subject did NOT move');
  assert.match(blendStop.getAttribute('aria-label') ?? '', /^Copy /, 'it says so to AT');

  // A TONE step is a point on the subject's own ramp, so it re-seeds and copies nothing.
  copied.length = 0;
  const toneStep = view.querySelectorAll<HTMLElement>('[data-lab-ramp] [data-lab-step]')[1]!;
  const toneHex = toneStep.dataset.labStep!;
  toneStep.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(subjectHex(), toneHex.toLowerCase(), 'the tone step re-seeded');
  assert.deepEqual(copied, [], 'and copied nothing');
});

test('you get the notation you clicked, not a canonical one', async () => {
  await mount('?c=%23c0392b');

  // The swatch's leading line is OKLCH, so clicking it copies oklch(...).
  copied.length = 0;
  $('[data-lab-sw-primary]')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => dom.window.setTimeout(r, 5));
  assert.equal(copied.length, 1);
  assert.match(copied[0]!, /^oklch\(/, `oklch line copies oklch: ${copied[0]}`);

  // Its hex alternate copies the hex.
  copied.length = 0;
  const hexCode = [...view.querySelectorAll<HTMLElement>('[data-lab-sw-alts] .lab-sw-alt')]
    .find(li => (li.querySelector('.lab-sw-alt-space')?.textContent ?? '').trim() === 'hex')!
    .querySelector<HTMLElement>('code')!;
  hexCode.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => dom.window.setTimeout(r, 5));
  assert.deepEqual(copied, ['#C0392B'], `hex line copies hex: ${copied}`);

  // A tone step's hex sub-label copies the hex and does NOT re-seed, because the
  // value you clicked was a value, not the swatch.
  copied.length = 0;
  const before = subjectHex();
  const toneHexLabel = view.querySelector<HTMLElement>('[data-lab-ramp] [data-lab-step] .lab-step-hex')!;
  toneHexLabel.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => dom.window.setTimeout(r, 5));
  assert.equal(copied.length, 1, 'clicking a value copies it');
  assert.equal(subjectHex(), before, 'and does not re-seed');
});

test('the blend target gets the expanded picker, dials included', async () => {
  await mount('?c=%23c0392b');
  const picker = $('[data-lab-blend-picker]')!;
  // The dials are gated on the inline form inside the component, so a float
  // popover can only ever show the hex field, alpha and swatches - which is what
  // this used to be, and why a blend target could not be picked perceptually.
  assert.ok(picker.querySelector('.color-field--inline'), 'mounted inline, not as a popover');
  assert.ok(picker.querySelector('[data-color-modes]'), 'has the space tabs');
  assert.ok(picker.querySelector('.color-lch'), 'has the L/C/H sliders');
  assert.ok(picker.querySelectorAll('.color-dial').length >= 3, 'has the dials');

  // And it still drives the blend.
  const stops = (): string[] => [...view.querySelectorAll<HTMLElement>('[data-lab-blend] [data-lab-step]')]
    .map(b => b.dataset.labStep!);
  const before = stops();
  const raw = $('[data-lab-blend-raw]') as HTMLInputElement;
  raw.value = 'oklch(88% 0.14 120)';
  raw.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.notEqual(stops()[8], before[8], 'the far end moved');
  assert.equal(stops()[0], before[0], 'the near end is still the subject');
});

test('the theme toggle rides the top-right chrome, icon-only, and cycles', async () => {
  // Why it is here at all: this page is about how a colour READS, and a colour reads
  // differently in each screen theme. So the switch belongs next to the report, not
  // three clicks away in a profile menu.
  await mount('?c=%23c0392b');
  const chrome = $('[data-lab-chrome]')!;
  assert.ok(chrome, 'the chrome capsule exists');
  // Opposite the back pill, in the same row - not stacked above the heading.
  assert.ok($('.lab-back .back-pill, .lab-back [data-back-pill]'), 'the back pill shares the row');
  const btn = chrome.querySelector('button')!;
  assert.ok(btn, 'the toggle is mounted');
  assert.ok(btn.querySelector('svg'), 'icon-only - a glyph, not a label');
  assert.equal((btn.textContent ?? '').trim(), '', 'no text beside the glyph');
  // The theme name rides the accessible name instead, since the glyph carries it visually.
  assert.match(btn.getAttribute('aria-label') ?? '', /theme/i);
  assert.equal(btn.getAttribute('aria-label'), btn.title, 'tooltip and accessible name agree');

  const before = document.documentElement.dataset.theme || 'light';
  btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 0));
  assert.notEqual(document.documentElement.dataset.theme, before, 'a click moves the theme on');
  assert.equal(btn.dataset.theme, document.documentElement.dataset.theme,
    'and the glyph shows the theme now in force');
});

test('the third surface’s picker survives its own change - the card is scored, not rebuilt', async () => {
  // The bug this pins, reported from the browser: "the sliders on the your surface
  // card disappear when clicked, they won't drag". `onChange` re-rendered the card
  // with innerHTML, which destroyed the live popover on its own FIRST input event - 
  // so the slider under the pointer vanished and the gesture died with it.
  await mount('?c=%23c0392b');
  const host = $('[data-lab-ink-pick]')!;
  const field = host.querySelector('input[data-color-hex]') as HTMLInputElement;
  const sliders = () => host.querySelectorAll('input[data-mode-ch]').length;
  const before = sliders();
  assert.ok(before > 0, 'the popover mounted its channel sliders');

  // A whole drag's worth of events - a real gesture is many, and the first one is
  // what used to kill it.
  for (const v of ['#111111', '#222222', '#333333']) {
    field.value = v;
    field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 0));
    assert.equal($('[data-lab-ink-pick]'), host, 'the picker host is the SAME element');
    assert.equal(sliders(), before, `the sliders are still there after ${v}`);
  }
  // And the scoring still happened - in place.
  assert.match(
    view.querySelector('[data-lab-card="ink"] .lab-apca-lc')?.textContent ?? '', /Lc \d/);

  // A subject change must not tear it out either: the whole point of stable markup.
  const step = view.querySelector<HTMLElement>('[data-lab-ramp] [data-lab-step]')!;
  step.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 0));
  assert.equal($('[data-lab-ink-pick]'), host, 'still the same host after a re-seed');
  assert.equal(sliders(), before, 'and still its sliders');
});

test('one inversion rule: the swatch, the ramp labels and the picker flip together', async () => {
  // Andy's report: he liked the dial disc's flip point and wanted the value pill and
  // the big swatch - which flipped a good deal earlier - to match. There were three
  // rules: contrastText's luma threshold (the disc), a WCAG-ratio winner (the pill),
  // and `>= 4.5 against white` (the swatch and the ramp labels). The last two both
  // cross around relative luminance 0.18, far darker than the first.
  //
  // These two pinks sit either side of contrastText's threshold (luma 144.6 and
  // 157.9 against a 150 cut) but on the SAME side of the other two - so if any
  // surface reverts to an old rule, one of these two mounts disagrees.
  for (const [hex, want] of [['%23cf6ca9', '#ffffff'], ['%23dd79b6', '#000000']] as const) {
    await mount('?c=' + hex);
    const subject = decodeURIComponent(hex);
    assert.equal(contrastText(subject), want, `the fixture is on the right side: ${subject}`);
    assert.equal($('[data-lab-swatch]')!.style.color, want === '#ffffff' ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)',
      `the big swatch's ink at ${subject}`);
  }
});

test('no surface re-implements the ink inversion', async () => {
  // A drift guard, because this drifted once already: three rules, silently, across
  // two files. Any new black-or-white-over-a-colour decision must call contrastText.
  const { readFileSync } = await import('node:fs');
  const files = [
    'shells/web/src/views/color-lab.ts',
    'shells/web/src/components/color-field.ts',
  ];
  for (const f of files) {
    const src = readFileSync(new URL('../../../../' + f, import.meta.url), 'utf8');
    // The two forms that were replaced.
    assert.doesNotMatch(src, /contrastRatio\([^)]*'#ffffff'\)\s*>=\s*4\.5\s*\?/,
      `${f}: the ">= 4.5 against white" rule is back`);
    assert.doesNotMatch(src, /contrastRatio\('#ffffff',[^)]*\)\s*>=\s*contrastRatio\('#000000'/,
      `${f}: the WCAG-ratio-winner rule is back`);
  }
});

test('the single-solid vector snapshot is a polygon SVG of the current limit', async () => {
  // The canvas is the turntable; this is the STILL a docs screenshot captures - 
  // real polygons, not a raster. Folded by default (a diagnostic), rendered on open.
  await mount();   // the default limit is Rec.2020
  const panel = view.querySelector<HTMLDetailsElement>('[data-lab-solid-svg-panel]');
  assert.ok(panel, 'the vector-snapshot panel is present');
  assert.equal(view.querySelector('[data-lab-solid-svg] svg'), null, 'nothing rendered while folded');

  panel!.open = true;
  panel!.dispatchEvent(new dom.window.Event('toggle'));
  const svg = view.querySelector('[data-lab-solid-svg] svg');
  assert.ok(svg, 'a still SVG is emitted on open');
  assert.ok(svg!.querySelectorAll('polygon').length > 0, 'it is built from real polygons');
  assert.match(svg!.getAttribute('viewBox') ?? '', /^0 0 \d+ \d+$/, 'a well-formed square viewBox');
});

test('the compare panel emits Display-P3 and Rec.2020 hulls side by side at one scale', async () => {
  // This is where P3 ⊄ Rec.2020 becomes visible as SHAPE: two hulls, no overlap,
  // one shared angle and scale. Both reuse the view's own orientation.
  await mount('?c=%23c0392b');
  const panel = view.querySelector<HTMLDetailsElement>('[data-lab-compare-panel]');
  assert.ok(panel, 'the compare panel is present');
  // It lives WITH the charts (step 2), the block that governs it.
  assert.ok(view.querySelectorAll('.lab-step-block')[1]!.contains(panel!),
    'the compare panel is in the charts block');
  assert.equal(view.querySelectorAll('[data-lab-compare-svg] svg').length, 0, 'folded until opened');

  panel!.open = true;
  panel!.dispatchEvent(new dom.window.Event('toggle'));

  const p3 = view.querySelector('[data-lab-compare-svg="p3"] svg');
  const rec = view.querySelector('[data-lab-compare-svg="rec2020"] svg');
  assert.ok(p3 && rec, 'both hulls are present and labelled by gamut id');
  assert.equal(view.querySelectorAll('[data-lab-compare-svg] svg').length, 2, 'exactly two, no overlay');
  for (const svg of [p3!, rec!]) {
    assert.ok(svg.querySelectorAll('polygon').length > 0, 'each hull is real polygons');
    assert.match(svg.getAttribute('viewBox') ?? '', /^0 0 \d+ \d+$/, 'well-formed viewBox');
    // Same viewBox as the P3 hull → same scale, so the two shapes compare directly.
    assert.equal(svg.getAttribute('viewBox'), p3!.getAttribute('viewBox'), 'one shared scale');
  }
  // Each cell carries its gamut's name as escaped text.
  const caps = [...view.querySelectorAll('.lab-compare-cell .lab-compare-cap')]
    .map(c => (c.textContent ?? '').trim());
  assert.deepEqual(caps, ['Display-P3', 'Rec.2020']);
});

test('the charts open on Rec.2020, whatever the display claims', async () => {
  // The tab is a COMPARISON TARGET - the question the reader is asking - so it opens
  // at the widest gamut we classify and nothing narrows it for them. It was briefly
  // seeded from the display (a P3 screen opened on the P3 tab); Andy asked for
  // Rec.2020 back, and the reasoning is that answering "how far past sRGB is this?"
  // with the reader's own hardware hides colour before they have asked anything.
  //
  // The display still decides what it should - the tier opacity anchor and the canvas
  // encoding - which is why those live behind different functions.
  const claims: Array<string | null> = ['(color-gamut: p3)', '(color-gamut: rec2020)', null];
  const realMatchMedia = window.matchMedia;
  try {
    for (const claim of claims) {
      (window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({
        matches: claim != null && q === claim,
        media: q,
        addEventListener() {}, removeEventListener() {},
      });
      await mount('?c=%23c0392b');
      const seg = $('[data-lab-limit]')!;
      const pressed = [...seg.querySelectorAll<HTMLElement>('[data-val]')]
        .find(b => b.getAttribute('aria-pressed') === 'true');
      assert.equal(pressed?.dataset.val, 'rec2020', `claim ${claim}: opens on Rec.2020`);
      assert.equal($('[data-lab-gamut]') != null, true);
    }
  } finally {
    (window as unknown as { matchMedia: unknown }).matchMedia = realMatchMedia;
  }
});

test('a link carrying &limit= still wins over the default', async () => {
  // A shared link is a decision someone made; the default is only what happens when
  // nobody has.
  await mount('?c=%23c0392b&limit=srgb');
  const pressed = [...$('[data-lab-limit]')!.querySelectorAll<HTMLElement>('[data-val]')]
    .find(b => b.getAttribute('aria-pressed') === 'true');
  assert.equal(pressed?.dataset.val, 'srgb');
});

// ─── The print side: a press profile as a comparison target ───────────────────
//
// The Lab's fourth pill. Everything below is about the one rule the print work
// most easily breaks: the limit tab is the READER's question, so pressing a press
// profile must change what the charts are compared against and NOTHING about what
// the controls can express.

const {
  ingestProfile: labIngest, _resetProfileCache: labResetProfiles,
} = await import('../lib/color-profiles.ts');
const {
  buildProfile: labBuildProfile, mft2: labMft2, ascii: labAscii, u32: labU32,
} = await import('../../../../tests/helpers/icc-fixture.ts');

/** A four-ink press profile carrying perceptual + relative, but no saturation. */
const pressIcc = (): Uint8Array => labBuildProfile({
  deviceClass: 'prtr', space: 'CMYK',
  tags: [
    ['A2B0', labMft2(4, 3, [0x8000, 0x8080, 0x8080])],
    ['B2A0', labMft2(3, 4, [0x4000, 0x4000, 0x4000, 0])],
    ['A2B1', labMft2(4, 3, [0x8000, 0x8080, 0x8080])],
    ['B2A1', labMft2(3, 4, [0x4000, 0x4000, 0x4000, 0])],
    ['desc', [...labAscii('desc'), 0, 0, 0, 0, ...labU32(11), ...labAscii('Test Press'), 0]],
  ],
});

interface LabStored { id: string; type: string; format: string; blob: Blob; meta?: Record<string, unknown> }

/** The user-asset rail, in memory - the same four methods the real bridge has. */
function profileHost(): { assets: Record<string, (...a: never[]) => unknown> } & { store: Map<string, LabStored> } {
  const store = new Map<string, LabStored>();
  return {
    store,
    assets: {
      async _uploadUserAsset(rec: LabStored) { store.set(rec.id, rec); },
      async _deleteUserAsset(id: string) { store.delete(id); },
      async _listUserAssets() { return [...store.values()].map(r => ({ id: r.id, type: r.type, meta: r.meta })); },
      async _getBlob(id: string) { return store.get(id)?.blob ?? null; },
    },
  } as never;
}

/** Mount with a host that owns a user-asset rail. */
async function mountWithHost(hostLike: object, params = ''): Promise<void> {
  (view as HTMLElement & { _cleanup?: () => void })._cleanup?.();
  delete (view as HTMLElement & { _cleanup?: () => void })._cleanup;
  view.innerHTML = '';
  await mountColorLab(view, hostLike as never, params);
}

const pressedVal = (): string | undefined =>
  [...$('[data-lab-limit]')!.querySelectorAll<HTMLElement>('[data-val]')]
    .find(b => b.getAttribute('aria-pressed') === 'true')?.dataset.val;

/** Store the fixture on a fresh host and return its `&limit=` id. */
async function seedProfile(intent = 'relative'): Promise<{ host: object; id: string; digest: string }> {
  labResetProfiles();
  const host = profileHost();
  const file = new File([pressIcc() as unknown as BlobPart], 'press.icc', { type: 'application/vnd.iccprofile' });
  const entry = await labIngest(host as never, file);
  assert.ok(!('error' in entry), 'the fixture ingests');
  const digest = (entry as { digest: string }).digest;
  return { host, id: `icc:${digest}:${intent}`, digest };
}

test('the print affordance appears only where there is somewhere to store a profile', async () => {
  await mount('?c=%23c0392b');
  assert.equal($('[data-lab-limit] [data-lab-profiles]'), null,
    'a host with no user-asset rail offers no + button rather than one that cannot work');
  const { host } = await seedProfile();
  await mountWithHost(host, '?c=%23c0392b');
  assert.ok($('[data-lab-limit] [data-lab-profiles]'), 'the + is there when profiles can be stored');
  // Still the three display gamuts, and still opening on Rec.2020: adding the
  // affordance must not move the default target.
  assert.equal(pressedVal(), 'rec2020');
});

test('the + names the panel it actually opens, and says what it does', async () => {
  // The panel was renamed to "Colour profiles" (Print / Display / Other) precisely
  // because the ingest path was never print-only - and this trigger kept announcing
  // "Print profile", which is the claim the rename retracted and a dialog name that
  // no longer exists. The control's ONLY accessible name was false.
  const { host } = await seedProfile();
  await mountWithHost(host, '?c=%23c0392b');
  const add = $('[data-lab-limit] [data-lab-profiles]')!;
  assert.equal(add.getAttribute('aria-label'), 'Colour profiles',
    'the accessible name is the dialog’s own name');
  assert.equal(add.getAttribute('title'), null,
    'explained with data-tip, not a hover-only title no phone can open');
  assert.equal(add.getAttribute('data-tip'), 'Colour profiles');
  assert.ok(!/print/i.test(add.outerHTML), 'no trace of the retracted print claim');
  // And it is no longer the one wordless control in the row: a lone `+` at the end of
  // a segmented row reads as overflow, not as an invitation.
  assert.match(add.textContent!, /\+/);
  assert.match(add.textContent!, /[A-Za-z]/, 'the pill carries a word beside the glyph');
});

test('a link naming a stored profile charts against it', async () => {
  const { host, id } = await seedProfile();
  await mountWithHost(host, `?c=%23c0392b&limit=${encodeURIComponent(id)}`);

  assert.equal(pressedVal(), id, 'the press pill is the pressed one');
  const pill = $(`[data-lab-limit] [data-val="${id}"]`)!;
  assert.match(pill.textContent!, /Test Press/, 'the pill wears the profile’s OWN name');
  assert.match(pill.textContent!, /rel/, '…and the intent, because a gamut without one is under-specified');

  // The press card: measured numbers, named after the file.
  const card = $('[data-lab-press]')!;
  assert.equal(card.hidden, false);
  assert.match(card.querySelector('[data-lab-press-name]')!.textContent!, /Test Press/);
  const rows = new Map([...card.querySelectorAll('.lab-press-row')].map(r => [
    r.querySelector('.lab-press-k')!.textContent!.trim(),
    r.querySelector('.lab-press-v')!.textContent!.trim(),
  ]));
  assert.match(rows.get('Shift') ?? '', /^ΔE \d+\.\d$/, `a Shift row: ${JSON.stringify([...rows])}`);
  assert.match(rows.get('Ink') ?? '', /^\d+%$/, `an Ink row in the trade’s 0–400%: ${JSON.stringify([...rows])}`);
  assert.match(rows.get('Paper') ?? '', /^L\* \d+\.\d$/, `a Paper row: ${JSON.stringify([...rows])}`);
  assert.ok(card.querySelector('.lab-press-chip'), 'the substrate is shown as a colour, not only as a number');

  // A fourth ceiling, and its gain carries an explicit sign - a press is
  // frequently NARROWER than sRGB, which is the reason to show it at all.
  const ceils = [...$('[data-lab-ceilings]')!.querySelectorAll('.lab-ceil')];
  assert.equal(ceils.length, 4);
  assert.match(ceils[3]!.textContent!, /Test Press/);
  assert.match(ceils[3]!.querySelector('.lab-ceil-gain')!.textContent!, /^[+−]\d+%$/);

  // One notation row for the press, after the CSS spaces, and it is the ONLY
  // CMYK the table ever prints - nothing generic is added.
  const heads = [...$('[data-lab-notations]')!.querySelectorAll('th')].map(h => h.textContent!.trim());
  assert.equal(heads.filter(h => /Test Press/.test(h)).length, 1);
  assert.equal(heads.indexOf(heads.find(h => /Test Press/.test(h))!), heads.length - 1);
  const cmyk = [...$('[data-lab-notations]')!.querySelectorAll('tr')]
    .find(r => /Test Press/.test(r.querySelector('th')!.textContent!))!;
  assert.match(cmyk.querySelector('code')!.textContent!, /^cmyk\(\d+% \d+% \d+% \d+%\)$/);
});

test('pressing a press pill never takes chroma away from the controls', async () => {
  // The bug this guards: a comparison target that also scaled the sliders meant
  // pressing a narrow one silently rewrote the subject on the way down. Controls
  // stay at CONTROL_LIMIT whichever tab is pressed.
  const { host, id } = await seedProfile();
  await mountWithHost(host, `?c=${encodeURIComponent('oklch(62% 0.28 260)')}&limit=${encodeURIComponent(id)}`);
  const chroma = $('[data-lab-num="ch"]') as HTMLInputElement;
  const before = { max: chroma.max, value: chroma.value };

  $('[data-lab-limit] [data-val="rec2020"]')!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(chroma.max, before.max, 'the typed chroma box keeps its ceiling');
  assert.equal(chroma.value, before.value, 'and the colour is untouched');
  assert.equal(pressedVal(), 'rec2020');
  assert.equal($('[data-lab-press]')!.hidden, false,
    'the press card stays: the profile is still mounted, only the target moved');
});

test('a link whose profile is absent keeps the link intact and falls back to Rec.2020', async () => {
  labResetProfiles();
  const host = profileHost();
  const id = 'icc:0123456789abcdef:relative';
  await mountWithHost(host, `?c=%23c0392b&limit=${encodeURIComponent(id)}`);

  // The charts are drawn against the default…
  assert.equal(pressedVal(), 'rec2020');
  // …and the absent profile is SHOWN rather than silently dropped.
  const absent = $('[data-lab-limit] [data-lab-limit-absent]')!;
  assert.ok(absent, 'the fourth pill states that the link named a profile');
  assert.equal(absent.getAttribute('aria-pressed'), 'false');
  assert.equal(absent.dataset.state, 'absent');
  assert.match(absent.textContent!, /^icc 012345… · rel$/);
  assert.equal($('[data-lab-press]')!.hidden, true, 'no press card without a profile to measure with');

  // The URL is NEVER rewritten to rec2020: downgrading someone's link the moment
  // they open it would make the link lie the next time it was copied.
  $('[data-lab-num="lc"]')!.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.match(window.location.hash, new RegExp(`limit=${encodeURIComponent(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('a profile the device does not have is not mistaken for one it does', async () => {
  // Same digest shape, wrong intent: the fixture has no saturation table, so the
  // link must read absent rather than quietly answering from a different table.
  const { host, digest } = await seedProfile();
  const id = `icc:${digest}:saturation`;
  await mountWithHost(host, `?c=%23c0392b&limit=${encodeURIComponent(id)}`);
  assert.ok($('[data-lab-limit] [data-lab-limit-absent]'), 'an unusable intent is not a gamut');
  assert.equal(pressedVal(), 'rec2020');
});

test('junk in &limit= falls back rather than being carried into the URL', async () => {
  const { host } = await seedProfile();
  await mountWithHost(host, '?c=%23c0392b&limit=icc:nothexadecimal:relative');
  assert.equal(pressedVal(), 'rec2020');
  assert.equal($('[data-lab-limit] [data-lab-limit-absent]'), null);
  $('[data-lab-num="lc"]')!.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.ok(!/limit=/.test(window.location.hash), 'nothing pins a target nobody chose');
});

// ─── The two things a profile tab must not do ─────────────────────────────────

/** The panel is a <dialog> appended to the body; view teardown does not own it,
 *  so a test that opens one clears it rather than leaving it for the next. */
const closePanels = (): void => {
  for (const d of document.querySelectorAll('.labp-modal')) d.remove();
};

test('a display profile gets its own name and no ΔE it is not decided by', async () => {
  // A matrix/TRC profile has no B2A table, so `iccGamutSource` decides it on the
  // device cube and the round-trip ΔE is near zero well outside the gamut. The
  // card used to print "Outside the gamut / Shift ΔE 0.1" directly above "in gamut
  // is decided by a round trip within ΔE 3.0" - a rule and its own refutation.
  const { srgbIccProfile } = await import('@lolly/engine');
  labResetProfiles();
  const host = profileHost();
  const file = new File([srgbIccProfile() as unknown as BlobPart], 'srgb.icc',
    { type: 'application/vnd.iccprofile' });
  const entry = await labIngest(host as never, file);
  assert.ok(!('error' in entry), 'a monitor profile is a perfectly good comparison target');
  const id = `icc:${(entry as { digest: string }).digest}:relative`;
  // Well outside sRGB, so the verdict is 'outside' and the contradiction would show.
  await mountWithHost(host, `?c=${encodeURIComponent('oklch(0.5 0.3 250)')}&limit=${encodeURIComponent(id)}`);

  const card = $('[data-lab-press]')!;
  assert.equal(card.hidden, false);
  const keys = [...card.querySelectorAll('.lab-press-k')].map(k => k.textContent!.trim());
  assert.ok(!keys.includes('Shift'), `no Shift row for a cube-decided profile: ${keys.join()}`);
  assert.ok(!keys.includes('Ink'), 'and no ink on an additive profile');
  assert.equal(card.querySelector<HTMLElement>('[data-lab-press-note]')!.hidden, true,
    'the ΔE tolerance sentence goes with the number it explains');

  // The picker tab wears the file's OWN space. Labelling a three-channel RGB
  // profile 'CMYK' was a false claim, and its sliders composed to black.
  const { getColorSpace, composeColor } = await import('../components/color-spaces.ts');
  const spec = getColorSpace(id)!;
  assert.ok(spec, 'the profile is a picker tab');
  assert.equal(spec.label, 'RGB');
  assert.equal(spec.channels.length, 3);
  const c = composeColor(spec, { c1: 90, c2: 10, c3: 20 }, 1);
  assert.ok(c.components.some(v => Math.abs(v) > 1e-6),
    `a channel value reaches the colour rather than composing to black: ${JSON.stringify(c)}`);
});

test('activating a profile widens EVERY picker on the page, not only the subject’s', async () => {
  // A field bakes its tab strip at mount and subscribes to nothing, so only the
  // re-mounted ones grow the tab. The blend and ink pickers used to be left with
  // the strip they were born with - the same page showing two different tab rows
  // depending on whether the reader arrived by link or by drop.
  closePanels();
  const { host, digest } = await seedProfile();
  const id = `icc:${digest}:relative`;
  await mountWithHost(host, '?c=%23c0392b');
  const tabs = (field: string): string[] =>
    [...document.querySelectorAll(`[data-color-modes="${field}"] [data-mode]`)]
      .map(b => (b as HTMLElement).dataset.mode!);
  for (const f of ['lab-color', 'lab-other', 'lab-ink']) {
    assert.ok(!tabs(f).includes(id), `${f} has no press tab before one is mounted`);
  }

  $('[data-lab-limit] [data-lab-profiles]')!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  // The panel lists from IndexedDB, so let its refresh land before pressing.
  await new Promise(r => setTimeout(r, 0));
  const row = document.querySelector(`[data-labp-digest="${digest}"]`)!;
  row.querySelector<HTMLElement>('[data-lab-intent="relative"]')!
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 0));

  for (const f of ['lab-color', 'lab-other', 'lab-ink']) {
    assert.ok(tabs(f).includes(id), `${f} gained the press tab in-session`);
  }
  // Re-queried: pressing re-renders the list, so the row above is detached.
  assert.equal(
    document.querySelector(`[data-labp-digest="${digest}"] [data-lab-intent="relative"]`)!
      .getAttribute('aria-pressed'),
    'true');
  closePanels();
});

test('an intent that cannot be activated is not reported as if it had been', async () => {
  // The row is drawn from stored meta; the bytes behind it can be gone by the time
  // the button is pressed. Adopting the press regardless left the panel and the
  // pill row asserting opposite things, and erased the line that said so.
  closePanels();
  const { host, digest } = await seedProfile();
  // The bytes go, and so does this document's parse cache - otherwise the profile
  // is still live in memory and activating it legitimately succeeds.
  (host as { store: Map<string, unknown> }).store.delete(`user/profiles/${digest}`);
  await mountWithHost(host, '?c=%23c0392b');
  labResetProfiles();

  $('[data-lab-limit] [data-lab-profiles]')!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 0));
  const row = document.querySelector(`[data-labp-digest="${digest}"]`);
  if (!row) return;                       // the list re-read first: nothing to press
  row.querySelector<HTMLElement>('[data-lab-intent="relative"]')!
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 0));

  assert.equal(pressedVal(), 'rec2020', 'the charts did not move');
  const live = document.querySelector(`[data-labp-digest="${digest}"] [data-lab-intent="relative"]`);
  assert.notEqual(live?.getAttribute('aria-pressed'), 'true',
    'and the button does not claim they did');
  closePanels();
});

// ─── Layout and touch, from the four-device audit ─────────────────────────────

test('the blend picker sits BESIDE the ramp it changes, not above it', async () => {
  // Andy's report: "in color lab it would be good to have the picker side by side the
  // blend color swatches." Stacked, the expanded picker's ~554px of tabs, dials,
  // channel sliders and alpha pushed the style pills, the stop count and every
  // swatch about 600px down the page - so the ramp moving under your hands, the one
  // thing worth watching while you pick, was the one thing off screen.
  //
  // Structural rather than pixel-measured on purpose: jsdom has no layout, and the
  // fold to one column is a media query. What this pins is that the two are SIBLING
  // columns of one container, which is what the grid needs to be able to place them
  // side by side at all.
  await mount('?c=%23c0392b');
  const grid = $('.lab-blend')!;
  assert.ok(grid, 'the blend has a two-column container');
  const picker = $('[data-lab-blend-picker]')!;
  const ramp = $('[data-lab-blend]')!;
  assert.ok(grid.contains(picker), 'the far-end picker is in it');
  assert.ok(grid.contains(ramp), 'so is the ramp');
  // Neither may contain the other, or no grid can put them side by side.
  assert.ok(!picker.contains(ramp) && !ramp.contains(picker), 'they are separate columns');
  // Source order stays pick-then-result, which is what the stacked case reads as.
  assert.equal(
    picker.compareDocumentPosition(ramp) & 4 /* DOCUMENT_POSITION_FOLLOWING */, 4,
    'the picker comes first, so folding to one column still reads pick → result',
  );
  // The style pills and the stop slider travel with the ramp, not with the picker.
  const side = ramp.parentElement!;
  assert.ok(side.querySelector('[data-lab-blend-space]'), 'the style pills are on the ramp side');
  assert.ok(side.querySelector('[data-lab-blend-steps]'), '…and so is the stop count');
});

test('“Keep in bounds” is built from the shared field recipe', async () => {
  // It was a bare <input type=checkbox>, which the UA drew at 13×13 - outside
  // styles/parts/fields.css, so it missed the recipe's coarse-pointer bump to 20px
  // and was a fingertip miss on a phone. Every form control comes from the one
  // recipe; this is the assertion that keeps this one in it.
  await mount();
  const box = $('[data-lab-bounds]') as HTMLInputElement;
  assert.ok(box.classList.contains('field-check'), 'the tick is a .field-check');
  const row = box.closest('label')!;
  assert.ok(row.classList.contains('field-toggle'), 'and its row is a .field-toggle');
});

test('the copy affordances are reachable without a mouse', async () => {
  // `title=` is invisible to touch and to the keyboard, and the swatch's value lines
  // look like plain text - nothing else says pressing one copies it. So they carry
  // the tooltip primitive (`data-tip`, styles/parts/tooltip.css, which opens on plain
  // focus where there is no hover), announce themselves as buttons, and - since a
  // thing that says "button" has to answer Enter - copy from the keyboard too.
  await mount('?c=%23c0392b');
  const primary = $('[data-lab-sw-primary]')!;
  assert.ok(primary.dataset.tip, 'the leading value carries a tooltip');
  assert.equal(primary.hasAttribute('title'), false, 'and not a hover-only title');
  assert.equal(primary.getAttribute('role'), 'button');
  assert.equal(primary.tabIndex, 0, 'focusable, or the bubble can never open on touch');
  assert.ok((primary.getAttribute('aria-label') ?? '').length > 0,
    'the bubble is a pseudo-element, so the name has to be on the element');

  for (const code of view.querySelectorAll<HTMLElement>('[data-lab-sw-alts] code')) {
    assert.ok(code.dataset.tip, 'every alternate notation too');
    assert.equal(code.hasAttribute('title'), false);
    assert.equal(code.tabIndex, 0);
  }

  // Enter copies exactly what the line shows.
  copied.length = 0;
  primary.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(copied, [primary.dataset.labCopy]);
});

test('the blend styles explain themselves on a phone, and the clamp marker does too', async () => {
  // A blend style's ENTIRE rationale was in `title=t(b.why)` - the pills are labelled
  // in one word each precisely because the tooltip carries the reason, and on touch
  // there was no tooltip. Same for the notation table's "clamped", where the
  // explanation is the whole content of the marker.
  await mount('?c=color(display-p3%201%200%200)');
  const pills = [...view.querySelectorAll<HTMLElement>('[data-lab-blend-space] [data-val]')];
  assert.ok(pills.length >= 3);
  for (const p of pills) {
    assert.ok(p.dataset.tip, `${p.dataset.val}: the rationale is on data-tip`);
    assert.equal(p.hasAttribute('title'), false, `${p.dataset.val}: no hover-only title`);
    // The bubble is presentation only, so the reason has to reach a screen reader
    // by another route.
    assert.match(p.getAttribute('aria-label') ?? '', /-/);
  }
  const clamp = view.querySelector<HTMLElement>('.lab-note-fit span');
  assert.ok(clamp, 'a P3 red clamps somewhere');
  assert.ok(clamp!.dataset.tip, 'the marker explains itself on data-tip');
  assert.equal(clamp!.hasAttribute('title'), false);
  assert.equal(clamp!.tabIndex, 0, 'and can be focused to open it');
});

test('the 64 brand swatches are NOT given 64 tooltips', async () => {
  // Deliberate, and the reason is worth keeping: a swatch's tooltip would say its
  // name, and TAPPING it makes the colour the subject of the whole report - which
  // names it, in every notation, better than a bubble could. Sixty-four bubbles
  // stacked over a rail is noise, so the rail keeps `title` as a pointer nicety and
  // the accessible name as the real answer.
  await mount();
  const rail = $('[data-lab-brand]')!;
  const tips = rail.querySelectorAll('[data-tip]');
  assert.equal(tips.length, 0, 'no tooltips on the rail');
});

test('the report never lays out two rules for one grid, and holds the touch contract', async () => {
  // A CSS drift guard for the three defects that were invisible from jsdom:
  //
  //  · A DUPLICATE `.lab-charts` block dead-overrode the auto-fit grid with four
  //    fixed columns, which crushed every plot to 122×76 CSS px at 840px wide.
  //  · `white-space: nowrap` on `.lab-sw-alt` defeated its own `overflow-wrap`, and
  //    a long `color(display-p3 …)` then scrolled the DOCUMENT sideways - 71px at
  //    660px wide, 47px at 720px.
  //  · `touch-action: none` on the 3D solid froze the page under a control taking
  //    ~60% of a phone's viewport height.
  // Comments stripped first: this file explains WHY each of the three is what it is,
  // and a guard that reads the explanation as the declaration fails on its own prose.
  const css = readFileSync(new URL('../styles/parts/color-lab.css', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = css.match(/^\.lab-charts\s*\{/gm) ?? [];
  assert.equal(rules.length, 1, 'exactly ONE .lab-charts layout rule');
  assert.match(css, /\.lab-charts\s*\{[^}]*auto-fit/, 'and it is the auto-fit one');

  const swAlt = /\.lab-sw-alt\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.ok(swAlt.includes('overflow-wrap'), '.lab-sw-alt still wraps as a last resort');
  assert.doesNotMatch(swAlt, /white-space\s*:\s*nowrap/,
    'nothing may re-add a nowrap that defeats it - that is the sideways scroll');

  const solid = /\.lab-solid\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(solid, /touch-action\s*:\s*pan-y/,
    'the solid hands vertical gestures back to the page (the JS locks the axis)');
});

test('"This screen" hydrates from the same device probe the Dashboard uses', async () => {
  // The colophon at the foot of the report: the display the charts are being read
  // on. It is hidden in the served markup and only appears once the probe answers,
  // so the guard is that it (a) unhides, (b) carries the Display card's live gamut
  // row rather than a hand-written copy of it, and (c) offers the way out to the
  // full readout. jsdom has no WebGL, so the two Graphics cards are legitimately
  // absent here - which is the degradation the section is meant to survive.
  // The snapshot reads the bare `screen` global (as a browser has it); this file's
  // header only wires `window`, so give it one for the duration of this test.
  Object.defineProperty(globalThis, 'screen', { configurable: true, value: dom.window.screen });

  await mount();
  const sec = $('[data-lab-device]') as HTMLElement;
  assert.ok(sec, 'the section is in the markup');
  assert.equal(sec.hidden, true, 'and starts hidden - nothing is claimed before the probe answers');

  // The probe is async (UA hints + storage estimate); let its continuation run.
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(sec.hidden, false, 'the probe answered, so the section is shown');
  const cards = sec.querySelectorAll('.plat-client-card');
  assert.ok(cards.length >= 1, 'at least the Display card rendered');
  const rows = [...sec.querySelectorAll('.plat-kv dt')].map((d) => (d.textContent ?? '').trim());
  assert.ok(rows.includes('Colour gamut'), 'the gamut row is present - the fact the charts depend on');
  // Live rows exist here, so the disposer must be chained onto the view's cleanup.
  assert.ok(sec.querySelector('[data-live]'), 'the Display card carries live rows');

  const link = sec.querySelector<HTMLAnchorElement>('.lab-device-link');
  assert.equal(link?.getAttribute('href'), '#/d?tab=device', 'a quick link to the full readout');
});

// ── Per-swatch gamut badges (feature #3) ──────────────────────────────────────

test('swatchGamutState: out of gamut yields an in-gamut clip and a positive ΔE', () => {
  // P3 green is more saturated than sRGB green reaches, so it is genuinely outside sRGB.
  const wide = describeColor('color(display-p3 0 1 0)')!.oklch;
  const s = swatchGamutState(wide, 'srgb');
  assert.equal(s.outOfGamut, true, 'reported outside sRGB');
  assert.ok(s.deltaE > 0, `the clip moved the colour: ΔE ${s.deltaE}`);
  // The clip actually fits - asserted of the ACTUAL gamut, via the returned hex.
  const clipped = hexToOklch(s.clippedHex)!;
  assert.ok(inGamut(clipped.l, clipped.c, clipped.h, 'srgb'), `clippedHex ${s.clippedHex} is inside sRGB`);
});

test('swatchGamutState: an in-gamut colour is unclipped, ΔE 0, hex == oklchToHex', () => {
  const mid = describeColor('#3366cc')!.oklch;
  const s = swatchGamutState(mid, 'srgb');
  assert.equal(s.outOfGamut, false);
  assert.equal(s.deltaE, 0, 'no clip, so exactly zero - never a round-trip epsilon');
  assert.equal(s.clippedHex, oklchToHex(mid), 'the clip is identity, so the hex is the plain render');
});

test('swatchGamutState: fires against a gamut narrower than sRGB (the press-profile case)', () => {
  // A synthetic press-narrow source: inside sRGB AND low chroma. A saturated brand
  // red is a plain sRGB hex, yet it still falls outside - which is the whole reason
  // the badge exists for an sRGB-sourced palette.
  const narrow: GamutSource = {
    id: 'test:narrow',
    label: 'Test narrow',
    contains: (l, c, h) => inGamut(l, c, h, 'srgb') && c <= 0.05,
  };
  const brandRed = describeColor('#c02020')!.oklch;
  const s = swatchGamutState(brandRed, narrow);
  assert.equal(s.outOfGamut, true, 'an in-sRGB colour is outside a narrower press gamut');
  assert.ok(s.deltaE > 0, `and the clip moved it: ΔE ${s.deltaE}`);
});

test('swatchGamutState: membership is by inGamut, not by area ordering (P3 ⊄ Rec.2020)', () => {
  // P3's red primary is inside Display-P3 but OUTSIDE Rec.2020, even though Rec.2020
  // is the wider gamut by area. Ordering would call it safe in the wider one; the
  // actual membership test does not.
  const p3red = describeColor('color(display-p3 1 0 0)')!.oklch;
  assert.equal(swatchGamutState(p3red, 'p3').outOfGamut, false, 'inside Display-P3');
  assert.equal(swatchGamutState(p3red, 'rec2020').outOfGamut, true,
    'outside Rec.2020 despite it being the wider gamut - proves it is not an ordering');
});

test('the brand rail badges an out-of-gamut swatch and clears it when the target widens', async () => {
  // A one-colour brand whose sole swatch carries a Display-P3 face beyond sRGB.
  // `value` is the sRGB bake (what a click seeds); `faces['display-p3']` is the
  // richer truth the badge reasons about.
  const host = {
    tokens: {
      colors: () => [{
        id: 'brand.green', name: 'Brand Green',
        value: '#00c04a',
        faces: { 'display-p3': 'color(display-p3 0 1 0)' },
      }],
    },
  };
  // Mount pinned to sRGB so the wide face is out of gamut from the first paint.
  (view as HTMLElement & { _cleanup?: () => void })._cleanup?.();
  delete (view as HTMLElement & { _cleanup?: () => void })._cleanup;
  view.innerHTML = '';
  await mountColorLab(view, host, '?limit=srgb');

  const sw = view.querySelector<HTMLElement>('[data-lab-brand] .lab-brand-sw');
  assert.ok(sw, 'the brand swatch rendered');
  assert.equal(sw!.dataset.oog, 'true', 'it is flagged out of gamut against sRGB');
  assert.ok(sw!.querySelector('.lab-brand-badge'), 'the corner badge is present');
  assert.match(sw!.getAttribute('title') ?? '', /Outside/, 'the tip explains the clip');
  // Clicking must still SEED the colour, not the badge - the pick is the sRGB hex.
  assert.equal(sw!.dataset.labBrandPick, '#00c04a', 'the click target is the token value, unchanged');

  // Widen the comparison target to Rec.2020, which contains the P3 green - the badge clears.
  const rec = view.querySelector<HTMLElement>('[data-lab-limit] [data-val="rec2020"]');
  assert.ok(rec, 'the Rec.2020 target button is present');
  rec!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  const after = view.querySelector<HTMLElement>('[data-lab-brand] .lab-brand-sw');
  assert.notEqual(after!.dataset.oog, 'true', 'inside Rec.2020, so no longer badged');
  assert.equal(after!.querySelector('.lab-brand-badge'), null, 'and the corner badge is gone');
});

// ── APCA contrast matrix + CVD/grayscale preview (feature #4) ──────────────────

test('contrastMatrix: each cell is apcaContrast(row=text, col=bg), signed', () => {
  const colors = ['#ffffff', '#000000', '#c0392b'];
  const m = contrastMatrix(colors);
  assert.equal(m.length, 3);
  assert.equal(m[0]!.length, 3);
  // A known pair equals the engine primitive exactly (sign and all).
  assert.equal(m[2]![0]!.lc, apcaContrast('#c0392b', '#ffffff'), 'row=red text on col=white bg');
  assert.equal(m[0]![1]!.lc, apcaContrast('#ffffff', '#000000'), 'row=white text on col=black bg');
  // The band comes from the shared APCA band logic, not a reinvented threshold.
  assert.equal(m[2]![0]!.band, apcaUse(apcaContrast('#c0392b', '#ffffff')));
});

test('contrastMatrix: the diagonal - a colour on itself - is ~0', () => {
  const m = contrastMatrix(['#ffffff', '#000000', '#3366cc', '#c0392b']);
  for (let i = 0; i < 4; i++) {
    assert.ok(Math.abs(m[i]![i]!.lc) < 1e-9, `diagonal cell ${i} is ~0, got ${m[i]![i]!.lc}`);
  }
});

test('contrastMatrix: APCA is polarity-dependent, so the grid is asymmetric', () => {
  // White and black are the extreme polar pair: dark-on-light is positive, the
  // mirror is negative - a symmetric matrix would collapse the two.
  const m = contrastMatrix(['#ffffff', '#000000']);
  assert.notEqual(m[0]![1]!.lc, m[1]![0]!.lc, 'cell(i,j) != cell(j,i) for a polar pair');
  assert.ok(m[0]![1]!.lc < 0, 'white text on black is reverse polarity (negative)');
  assert.ok(m[1]![0]!.lc > 0, 'black text on white is normal polarity (positive)');
});

test('simulatePalette: Normal is identity; the modes match the engine wrappers', () => {
  const hex = '#c0392b';
  assert.equal(simulatePalette(hex, 'normal'), hex, 'Normal returns the input unchanged');
  assert.equal(simulatePalette(hex, 'grayscale'), toGrayscaleHex(hex), 'Grayscale is toGrayscaleHex');
  for (const type of ['protan', 'deutan', 'tritan'] as const) {
    assert.equal(simulatePalette(hex, type, 1), simulateCvdHex(hex, type, 1),
      `${type} at severity 1 is simulateCvdHex`);
  }
  // Severity 0 is an exact identity (the engine's severity-0 matrix is the identity).
  assert.equal(simulatePalette(hex, 'deutan', 0), hex, 'severity 0 is identity');
});

/** A three-colour brand host, so the matrix has a real palette to grid. */
const paletteHost = {
  tokens: {
    colors: () => [
      { id: 'c.red', name: 'Red', value: '#c0392b' },
      { id: 'c.green', name: 'Green', value: '#27ae60' },
      { id: 'c.blue', name: 'Blue', value: '#2980b9' },
    ],
  },
};

test('the matrix panel appears with a palette and grids white + black + the palette', async () => {
  await mountWithHost(paletteHost, '?c=%23c0392b');
  // The brand block is async (host.tokens.colors) - let it resolve.
  await new Promise(r => setTimeout(r, 0));
  const diag = $('[data-lab-diag]') as HTMLDetailsElement;
  assert.ok(diag, 'the diagnostic panel is in the markup');
  assert.equal(diag.hidden, false, 'and is revealed once a palette resolved');
  // 2 references (white, black) + 3 palette = a 5×5 grid of scored cells.
  const cells = view.querySelectorAll('[data-lab-matrix] .lab-mx-cell');
  assert.equal(cells.length, 25, `5×5 cells, got ${cells.length}`);
  // Every cell carries an APCA band cue and an integer |Lc|.
  for (const c of cells) {
    assert.ok((c as HTMLElement).dataset.use, 'a band cue on data-use');
    assert.match((c.textContent ?? '').trim(), /^\d+$/, 'a rounded |Lc|');
  }
});

test('the matrix stays hidden when there is no brand palette', async () => {
  await mount('?c=%23c0392b');
  const diag = $('[data-lab-diag]') as HTMLDetailsElement | null;
  // Present in the markup but never revealed - a palette diagnostic with no palette.
  assert.ok(diag, 'the panel markup is always present');
  assert.equal(diag!.hidden, true, 'but hidden without a palette');
});

test('a vision mode recolours the matrix and rescores it on the simulated colours', async () => {
  await mountWithHost(paletteHost, '?c=%23c0392b');
  await new Promise(r => setTimeout(r, 0));
  const cellAt = (r: number, c: number): HTMLElement =>
    view.querySelectorAll<HTMLElement>('[data-lab-matrix] tbody tr')[r]!
      .querySelectorAll<HTMLElement>('.lab-mx-cell')[c]!;
  // Row 2 = the first palette colour (red) as text; col 2 = red as background.
  const bgBefore = cellAt(2, 2).style.background;
  const wholeBefore = ($('[data-lab-matrix]')?.textContent ?? '');
  const railBefore = view.querySelector<HTMLElement>('[data-lab-brand] .lab-brand-sw')!
    .getAttribute('style');

  // Switch to Deuteranopia - a saturated palette shifts, so both the fills and the
  // scores move.
  view.querySelector<HTMLElement>('[data-lab-cvd] [data-val="deutan"]')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

  assert.notEqual(cellAt(2, 2).style.background, bgBefore, 'a coloured cell repaints for the vision');
  assert.notEqual(($('[data-lab-matrix]')?.textContent ?? ''), wholeBefore,
    'and at least one Lc recomputes on the simulated colours');
  // The brand rail above is transformed too - the same diagnostic, scoped to it.
  assert.notEqual(view.querySelector<HTMLElement>('[data-lab-brand] .lab-brand-sw')!.getAttribute('style'),
    railBefore, 'the brand rail recolours with the matrix');
  // The severity slider is offered only for the graded CVD types.
  assert.equal(($('[data-lab-cvd-sev]') as HTMLElement).hidden, false, 'severity appears for a CVD type');

  // Back to Normal restores the original fills (byte-identical paths).
  view.querySelector<HTMLElement>('[data-lab-cvd] [data-val="normal"]')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(cellAt(2, 2).style.background, bgBefore, 'Normal restores the true colour');
  assert.equal(($('[data-lab-cvd-sev]') as HTMLElement).hidden, true, 'and hides severity again');
});

test('the palette is capped to a readable N and the truncation is surfaced', async () => {
  const many = {
    tokens: {
      colors: () => Array.from({ length: 20 }, (_, i) => ({
        id: `c.${i}`, name: `C${i}`, value: `hsl(${i * 18} 70% 50%)`,
      })),
    },
  };
  await mountWithHost(many, '?c=%23c0392b');
  await new Promise(r => setTimeout(r, 0));
  // 2 references + 12 (the cap) = 14 axis entries → 14×14.
  const rows = view.querySelectorAll('[data-lab-matrix] tbody tr');
  assert.equal(rows.length, 14, `capped to 12 palette rows + white + black, got ${rows.length}`);
  const note = $('[data-lab-matrix-note]') as HTMLElement;
  assert.equal(note.hidden, false, 'the cap is shown, not silent');
  assert.match(note.textContent ?? '', /12.*20/, `the note names first-N-of-M: ${note.textContent}`);
});

// ── The headroom / nits axis (plan 154 WP-5) ────────────────────────────────

test('on an SDR display the nits control is hidden and the card gives a Tier C note', async () => {
  await mount();   // no matchMedia stub → the display reports no HDR headroom
  assert.equal(($('[data-lab-hdr]') as HTMLElement).hidden, true,
    'the nits control is hidden where there is no headroom to answer it');
  const nits = $('[data-lab-nits]')!;
  assert.equal(nits.dataset.state, 'sdr');
  assert.ok(text('[data-lab-nits] [data-lab-nits-note]').length > 0,
    'the readout card explains there is nothing above SDR white to show');
  // The nits axis must never touch the honest lightness readout - L stays <= 1.
  assert.ok(subjectOklch().l <= 1, 'OKLab L is unmoved by the nits card');
});

test('on an HDR display the nits control appears and the card reads in nits', async () => {
  await withHdrDisplay(async () => {
    await mount('?c=oklch(0.97 0.02 95)');   // a light colour, so it rides into headroom
    const panel = $('[data-lab-hdr]') as HTMLElement;
    assert.ok(panel, 'the HDR control block is present');
    assert.equal(panel.hidden, false, 'and shown once the display reports headroom');
    assert.ok($('[data-lab-nits-slider] [data-gsl-input]'), 'the nits slider is mounted');
    assert.ok($('[data-lab-hdr-ab] [data-val="hdr"]') && $('[data-lab-hdr-ab] [data-val="sdr"]'),
      'the SDR/HDR A/B toggle is present');
    const nits = $('[data-lab-nits]')!;
    assert.equal(nits.dataset.state, 'hdr');
    assert.match(text('[data-lab-nits] [data-lab-nits-val]'), /nits/,
      'the readout card reports a luminance in nits');
  });
});

test('the A/B toggle forces the SDR preview and the nits card follows', async () => {
  await withHdrDisplay(async () => {
    await mount('?c=oklch(0.95 0.03 95)');
    assert.equal($('[data-lab-nits]')!.dataset.state, 'hdr', 'starts on the HDR preview');
    const seg = $('[data-lab-hdr-ab]')!;
    const sdrBtn = seg.querySelector<HTMLElement>('[data-val="sdr"]')!;
    sdrBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.equal(sdrBtn.getAttribute('aria-pressed'), 'true', 'the SDR side is pressed');
    assert.equal($('[data-lab-nits]')!.dataset.state, 'sdr-preview',
      'and the readout card reports the forced-SDR preview');
  });
});

test('the nits axis round-trips through the URL on an HDR display', async () => {
  await withHdrDisplay(async () => {
    await mount('?c=oklch(0.9 0.05 95)&nits=1400');
    const input = $('[data-lab-nits-slider] [data-gsl-input]') as HTMLInputElement;
    assert.equal(input.value, '1400', 'a shared link seeds the exposure the sender set');
    // A change writes the exposure back to the hash, so forwarding it stays intact.
    input.value = '900';
    input.dispatchEvent(new dom.window.Event('change'));
    assert.match(window.location.hash, /nits=900/, 'the chosen exposure rides the URL');
  });
});
