// SPDX-License-Identifier: MPL-2.0
/**
 * views/export-preflight.ts - the export panel's "Before you export" card.
 *
 * Run directly:  node --test shells/web/src/views/export-preflight.test.ts
 *
 * The card is DOM-heavy, so what is tested here is the pure half: the
 * report → view mapping, which is where every honesty rule actually lives (a
 * ceiling must not become a bare fact row; a finding whose number is already a
 * fact must not be repeated; the engine's English must survive as a fallback for
 * every id the panel has no translated copy for; and no currency may appear).
 * The DOM writer is covered only for the structural properties that matter:
 * it emits a real <button aria-haspopup="dialog"> (no browser-default hijack), and
 * it stays hidden until there is something true to say.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  preflightView, preflightBodyHtml, preflightRowHtml, applyPreflight, messageFor,
  metaphorIcon, statusIcon,
} from './export-preflight.ts';
import { PREFLIGHT_FLAG, overrideFlagInMemory } from '../feature-flags.ts';
import type { Count, Finding, PreflightReport } from '@lolly/engine';
import { preflight } from '@lolly/engine';

// The export-panel surface is a personal OPT-IN flag, default OFF (an individual
// exporting a PNG must never be ambushed by prepress findings - PREFLIGHT_FLAG in
// feature-flags.ts; a control plane can default it on or hide the toggle through
// the ordinary flag governance). Pin the default first - with no mirror and no
// override the flag's own `default:false` must hold, never the historic
// missing-key-means-ON fallback - then enable for the rest of the suite, which
// tests the surface as a user who turned it on sees it.
test('preflight card is absent by default - the user (or governance) opts in', () => {
  assert.equal(preflightRowHtml(), '', 'flag off ⇒ no card markup at all');
  assert.notEqual(preflightRowHtml({ force: true }), '', 'a tool may force its own assurance surface');
  overrideFlagInMemory(PREFLIGHT_FLAG.id, true);
  assert.notEqual(preflightRowHtml(), '');
});

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.document = dom.window.document;

const CTX = { formatLabel: 'Print PDF', sizeText: '210 × 297 mm at 300 DPI', bleedText: '3 mm' };

const report = (findings: Finding[]): PreflightReport => ({
  $format: 'lolly-preflight',
  formatVersion: 1,
  engine: 'test',
  job: {
    toolId: 'x', format: 'pdf-cmyk', source: 'test', modelPhase: 'post-init',
    stageMounted: false, paletteResolved: false,
    settings: {
      format: 'pdf-cmyk',
      size: { width: { value: 210, unit: 'mm' }, height: { value: 297, unit: 'mm' }, dpi: 300, declaredBy: 'url', unitDeclared: true },
      bleed: { known: true, value: { value: 3, unit: 'mm' } },
      marks: { known: true, value: { crop: true } },
      pressProfile: { known: true, value: null },
    },
  },
  findings,
  counts: findings.map(f => f.count).filter(Boolean) as Count[],
  gaps: findings.filter(f => f.needs),
});

const area = (box: 'trim' | 'bleed', value: number): Count =>
  ({ kind: 'area', value, unit: 'm2-sheet', box, bound: 'exact', basis: 'test' });

test('an empty report renders no card at all', () => {
  const v = preflightView(report([]), CTX);
  assert.equal(v.show, false);
  assert.deepEqual(v.rows, []);
  assert.deepEqual(v.facts, []);
});

test('shell-specific checks can drive the view without enabling generic preflight', () => {
  const v = preflightView(null, {
    ...CTX,
    additionalRows: [
      { id: 'design.text.overflow', tone: 'warn', text: 'Clipped.' },
      { id: 'design.text.contrast-review', tone: 'gap', text: 'Review visually.' },
    ],
  });
  assert.equal(v.show, true);
  assert.equal(v.tone, 'fix');
  assert.equal(v.verdict, '1 to fix, 1 not checked');
  assert.deepEqual(v.rows.map((row) => row.id), [
    'design.text.overflow',
    'design.text.contrast-review',
  ]);
});

test('the verdict states what there is to fix, and carries no counts of things', () => {
  const clean = preflightView(report([
    { id: 'count.raster-pixels', severity: 'info', message: 'px', count: { kind: 'pixels', value: 4, unit: 'px', bound: 'exact', basis: 't' } },
  ]), CTX);
  assert.equal(clean.tone, 'know');
  assert.equal(clean.verdict, 'One thing to know', 'singular, not "1 things"');

  const bad = preflightView(report([
    { id: 'print.no-bleed', severity: 'warn', message: 'w' },
    { id: 'print.finish-separates-as-ink', severity: 'error', message: 'e' },
    { id: 'refuse.output-file-size', severity: 'info', message: 'i', needs: 'not-computable' },
  ]), CTX);
  assert.equal(bad.tone, 'fix');
  assert.equal(bad.verdict, '2 to fix, 1 not checked',
    'a refusal is never summed into "to know" - counted and not-counted are different answers');

  const counted = preflightView(report([
    { id: 'print.no-bleed', severity: 'warn', message: 'w' },
    { id: 'plates.process', severity: 'info', message: 'i' },
  ]), CTX);
  assert.equal(counted.verdict, '1 to fix, 1 to know');
});

test('a gap is toned as a gap and counted separately from a measurement', () => {
  const v = preflightView(report([
    { id: 'plates.process', severity: 'info', message: 'four plates', count: { kind: 'processPlates', value: 4, unit: 'plate', bound: 'ceiling', basis: 't' } },
    { id: 'plates.palette-unresolved', severity: 'info', message: 'no palette', needs: 'not-resolved' },
    { id: 'refuse.output-file-size', severity: 'info', message: 'no size', needs: 'not-computable' },
  ]), CTX);
  assert.deepEqual(v.rows.map(r => r.tone), ['note', 'gap', 'gap'],
    'severity alone would have made all three identical');
  assert.equal(v.verdict, '1 counted, 2 not checked');
  assert.equal(v.tone, 'know', 'a refusal is never an alarming tone');
});

test('a report with nothing in it but passed checks reads as calm, not as a badge', () => {
  // No findings at all is the "not shown" case above; a findings list with only
  // info is the calm one. Neither ever produces an alarming tone.
  const v = preflightView(report([{ id: 'plates.process', severity: 'info', message: 'x' }]), CTX);
  assert.notEqual(v.tone, 'fix');
});

test('an EXACT page count becomes a fact row; a CEILING never does', () => {
  const exact = preflightView(report([
    { id: 'count.pages.paginate', severity: 'info', message: '3 pages, one per row.', count: { kind: 'pages', value: 3, unit: 'page', bound: 'exact', basis: 't' } },
  ]), CTX);
  assert.ok(exact.facts.some(f => f.label === 'Pages' && f.value === '3'));
  assert.equal(exact.rows.length, 0, 'the finding is not repeated under its own fact row');

  const ceiling = preflightView(report([
    { id: 'count.pages.paginate', severity: 'info', message: 'Up to 3 pages, one per row.', count: { kind: 'pages', value: 3, unit: 'page', bound: 'ceiling', basis: 't' } },
  ]), CTX);
  assert.equal(ceiling.facts.some(f => f.label === 'Pages'), false,
    'a ceiling must not be laundered into a bare figure');
  assert.match(ceiling.rows[0]!.text, /Up to 3/, 'it stays in the body, still qualified');
});

test('trim and bleed areas become their own labelled rows and are not repeated', () => {
  const v = preflightView(report([
    { id: 'print.geometry', severity: 'info', message: 'Trim …', count: area('trim', 0.0624) },
    { id: 'print.geometry', severity: 'info', message: 'Bleed box …', count: area('bleed', 0.0662) },
    { id: 'print.geometry', severity: 'info', message: 'Media box …', count: { kind: 'area', value: 0.07, unit: 'm2-sheet', box: 'media', bound: 'exact', basis: 't' } },
  ]), CTX);
  assert.ok(v.facts.some(f => f.label === 'Trim' && f.value === '0.0624 m²'));
  assert.ok(v.facts.some(f => f.label === 'With bleed' && f.value === '0.0662 m²'));
  assert.equal(v.rows.length, 1, 'only the media box, which has no fact row, is listed');
});

test('the panel translates by finding id and falls back to the engine English otherwise', () => {
  const finish: Finding = {
    id: 'print.finish-separates-as-ink', severity: 'error',
    message: 'ENGINE ENGLISH',
    evidence: { swatch: 'Gold', finish: 'foil', spotName: 'PMS 871', tokenPath: 'color.brand.gold', format: 'pdf-cmyk' },
  };
  const shown = messageFor(finish);
  assert.notEqual(shown, 'ENGINE ENGLISH');
  assert.match(shown, /Gold/);
  assert.match(shown, /foil/);

  // An id with no entry in the copy map is NOT dropped and NOT blanked.
  assert.equal(messageFor({ id: 'some.future.check', severity: 'warn', message: 'A brand new sentence.' }),
    'A brand new sentence.');
});

test('no view, for any job, contains a currency symbol or the word cost', () => {
  // Phase 1 counts; it does not cost. Asserted over real engine output, not a
  // hand-built report, so a rule that ever grew a price would be caught here.
  const jobs = ['pdf-cmyk', 'png', 'webm'].map(format => preflight({
    manifest: { id: 't', render: { width: 800, height: 600, formats: ['png', 'pdf-cmyk', 'webm'] } },
    settings: {
      format,
      size: { width: { value: 210, unit: 'mm' }, height: { value: 297, unit: 'mm' }, dpi: 300, declaredBy: 'url', unitDeclared: true },
      bleed: { known: true, value: { value: 3, unit: 'mm' } },
      marks: { known: true, value: { crop: true } },
      pressProfile: { known: true, value: 'fogra39' },
    },
    palette: { known: true, value: [{ name: 'Gold', path: 'color.brand.gold', spot: { name: 'PMS 871', finish: 'foil' } }] },
    stage: { known: false, why: 'needs-mount' },
  }));
  for (const r of jobs) {
    const v = preflightView(r, CTX);
    const text = [v.verdict, ...v.facts.map(f => `${f.label} ${f.value}`), ...v.rows.map(x => x.text)].join(' ');
    // NOT a bare /\brate\b/: "the frame rate actually used" is an honest sentence
    // about a render, and a test that failed on it would push the wording around
    // instead of catching money. The monetary senses are matched instead.
    assert.doesNotMatch(text, /[$€£¥]|\bcosts?\b|\bprices?\b|\bquote\b|\brate card\b|\bUSD\b|\bEUR\b|\bper unit\b/i, `for ${r.job.format}`);
    assert.doesNotMatch(text, /-/, 'house copy rule: no em-dashes');
  }
});

test('a declared FINISH surfaces as an error the user can read, through the real rules', () => {
  // cmyk-tiff has no /Separation plate, so a finish genuinely flattens into the
  // process build and cannot overprint - still an error. (On pdf-cmyk the finish now
  // overprints as its own named plate, so it is an info heads-up, tested in the engine.)
  const r = preflight({
    manifest: { id: 't', render: { width: 800, height: 600 } },
    settings: {
      format: 'cmyk-tiff',
      size: { width: { value: 210, unit: 'mm' }, height: { value: 297, unit: 'mm' }, dpi: 300, declaredBy: 'url', unitDeclared: true },
      bleed: { known: true, value: { value: 3, unit: 'mm' } },
      marks: { known: true, value: { crop: true } },
      pressProfile: { known: true, value: 'fogra39' },
    },
    palette: { known: true, value: [{ name: 'Gold', path: 'color.brand.gold', spot: { name: 'PMS 871', finish: 'foil' } }] },
    stage: { known: false, why: 'needs-mount' },
  });
  const v = preflightView(r, CTX);
  assert.equal(v.tone, 'fix');
  const err = v.rows.find(x => x.id === 'print.finish-flattened-into-process');
  assert.ok(err, 'the finish finding reaches the panel');
  assert.equal(err!.tone, 'error');
  assert.match(err!.text, /Gold/);
});

test('the control is a real <button> that opens a dialog, hidden until there is something to say', () => {
  const panel = document.createElement('div');
  panel.innerHTML = preflightRowHtml();
  const card = panel.querySelector('[data-preflight-section]') as HTMLElement;
  const btn = card.querySelector('[data-action="preflight-open"]') as HTMLElement;
  assert.equal(btn.tagName, 'BUTTON', 'a real <button>, not a div role=button: no browser-default hijack');
  assert.equal(btn.getAttribute('aria-haspopup'), 'dialog', 'it announces it opens a dialog');
  assert.equal(card.style.display, 'none', 'invisible until there is something true to say');

  applyPreflight(panel, preflightView(report([
    { id: 'print.no-bleed', severity: 'warn', message: 'No bleed.' },
  ]), CTX));
  assert.equal(card.style.display, 'flex');
  assert.equal(card.dataset.tone, 'fix', 'the verdict tone rides the collapsed control');
  assert.match(card.querySelector('[data-preflight-verdict]')!.textContent!, /to fix/);
});

test('the body uses tinted full-border findings, never a one-sided stripe or a dash', () => {
  const html = preflightBodyHtml(preflightView(report([
    { id: 'print.no-bleed', severity: 'warn', message: 'No bleed.' },
    { id: 'plates.process', severity: 'info', message: 'Four plates.' },
    { id: 'refuse.output-file-size', severity: 'info', message: 'Cannot predict size.', needs: 'not-computable' },
  ]), CTX));
  assert.match(html, /<ul class="preflight-findings">/);
  assert.match(html, /class="preflight-finding is-warn"/);
  assert.match(html, /class="preflight-finding is-note"/);
  assert.match(html, /class="preflight-finding is-gap"/);
  assert.doesNotMatch(html, /border-left|dashed|style=/, 'no inline styles, stripes or dashed edges');
});

test('each finding carries a content metaphor and a status badge', () => {
  const html = preflightBodyHtml(preflightView(report([
    { id: 'print.ink-over-tac', severity: 'warn', message: 'Over TAC.' },
    { id: 'plates.process', severity: 'info', message: 'Four plates.' },
  ]), CTX));
  // Two rows, each a figure (metaphor + badge) plus the wrapping text span.
  assert.equal((html.match(/preflight-finding-figure/g) ?? []).length, 2);
  assert.equal((html.match(/preflight-finding-metaphor/g) ?? []).length, 2);
  assert.equal((html.match(/preflight-finding-badge"/g) ?? []).length, 2);
  assert.equal((html.match(/preflight-finding-text/g) ?? []).length, 2);
});

test('the metaphor is the CONTENT of the check, the badge is its STATUS', () => {
  // Content: keyed by id (exact, then family prefix, then a neutral default).
  assert.equal(metaphorIcon('print.ink-over-tac'), 'droplet');
  assert.equal(metaphorIcon('print.rich-black'), 'droplet');
  assert.equal(metaphorIcon('plates.process'), 'layers');
  assert.equal(metaphorIcon('print.no-bleed'), 'crop');
  assert.equal(metaphorIcon('print.image-effective-dpi'), 'image');
  assert.equal(metaphorIcon('count.pages.pages'), 'document', 'family prefix');
  assert.equal(metaphorIcon('input.required-blank'), 'keyboard', 'family prefix');
  assert.equal(metaphorIcon('a.brand.new.check'), 'checklist', 'unknown id still renders, via the default');
  // Status: severity, never colour alone - a distinct glyph per tone.
  assert.equal(statusIcon('error'), 'alert');
  assert.equal(statusIcon('warn'), 'alert');
  assert.equal(statusIcon('note'), 'info');
  assert.equal(statusIcon('gap'), 'help');
});

test('body text is escaped, so a hostile brand ink name cannot inject markup', () => {
  const html = preflightBodyHtml(preflightView(report([
    { id: 'print.finish-unknown-kind', severity: 'info', message: '<img src=x onerror=alert(1)> declares a finish' },
  ]), CTX));
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});
