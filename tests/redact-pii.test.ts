// SPDX-License-Identifier: MPL-2.0
/**
 * Redact's OCR auto-suggest (plans/147 E8, the first M7 inheritor).
 *
 * The REAL community/redact/hooks.js is compiled the way the engine loader
 * compiles it (`new Function('host', …)`), so these run the shipped code:
 *
 *   · the personal-data classifiers, which live in community/_shared/pii.js and
 *     are copied into the hook by `npm run sync:shared` - hits, misses, and the
 *     two false-positive guards that matter on a technical document (a version
 *     string and a bare year are digit runs, not phone numbers);
 *   · the mapping from an OcrResult to proposed regions - the working-size
 *     downscale undone, the box clamped to the frame, one region per LINE
 *     because a v1 OcrLine carries no word boxes;
 *   · that a shell with no `host.ocr` publishes no affordance at all, which is
 *     what keeps the CLI render identical to what it was before.
 *
 * Suggestions are never applied here and cannot be: turning one into a bar is a
 * click in the canvas (template.html), and this file pins the half that decides
 * WHAT is offered.
 *
 * Run with: node --test tests/redact-pii.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createRuntime } from '../engine/src/runtime.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL_DIR = join(ROOT, 'community/redact');
const HOOKS_SRC = readFileSync(join(TOOL_DIR, 'hooks.js'), 'utf8');
const MANIFEST = JSON.parse(readFileSync(join(TOOL_DIR, 'tool.json'), 'utf8'));
const TEMPLATE = readFileSync(join(TOOL_DIR, 'template.html'), 'utf8');

const BARE_HOST: any = { version: '1', profile: { get: async () => ({}) }, log: () => {} };

interface PiiHit { kind: string; label: string; text: string; maybe: boolean; start: number; end: number }
interface Suggestion {
  page: number; x: number; y: number; w: number; h: number;
  kind: string; kinds: string[]; label: string; maybe: boolean; text: string; confidence: number;
}

/** The classifier + the region mapping, reached through the hook's own scope. */
function loadPii(): {
  piiFindings: (t: string) => PiiHit[];
  luhnOk: (d: string) => boolean;
  suggestionsFrom: (res: unknown, scale: number, w: number, h: number) => Suggestion[];
} {
  const factory = new Function('host', `${HOOKS_SRC}\nreturn { piiFindings, luhnOk, suggestionsFrom };`);
  return factory(BARE_HOST);
}

/** The tool as the loader hands it to createRuntime. */
function redactTool(): any {
  return { manifest: MANIFEST, hooksSource: HOOKS_SRC, template: TEMPLATE };
}

function loadHooks(): any {
  const factory = new Function('host', `${HOOKS_SRC}\nreturn { onInit, onInput, exportFile };`);
  return factory(BARE_HOST);
}

const kindsIn = (text: string): string[] => loadPii().piiFindings(text).map((h) => h.kind);

// ─── the classifiers ─────────────────────────────────────────────────────────

test('an email address is recognised, and only the address itself', () => {
  const hits = loadPii().piiFindings('Please write to jane.doe+tag@example.co.uk before Friday');
  assert.deepEqual(hits.map((h) => h.kind), ['email']);
  assert.equal(hits[0]!.text, 'jane.doe+tag@example.co.uk');
  assert.equal(hits[0]!.maybe, false, 'an address with an @ and a TLD is not a guess');
});

test('phone numbers are recognised in both an international and a local form', () => {
  const pii = loadPii();
  const intl = pii.piiFindings('Reception +44 20 7946 0958');
  assert.deepEqual(intl.map((h) => h.kind), ['phone']);
  assert.equal(intl[0]!.text, '+44 20 7946 0958');
  assert.equal(intl[0]!.maybe, false, 'a + prefix makes the international form definite');

  const local = pii.piiFindings('Mobile 020 7946 0958');
  assert.deepEqual(local.map((h) => h.kind), ['phone']);
  assert.equal(local[0]!.maybe, true, 'a bare digit run is offered as a question');

  // Too few digits to be a phone number anywhere.
  assert.deepEqual(kindsIn('Room 40 21'), []);
});

test('a card number is recognised by its check digit, not by being long', () => {
  const pii = loadPii();
  assert.ok(pii.luhnOk('4111111111111111'), 'the standard test card passes Luhn');
  assert.equal(pii.luhnOk('4111111111111112'), false, 'one digit off fails');

  const hit = pii.piiFindings('Card 4111 1111 1111 1111 exp 12/26');
  assert.deepEqual(hit.map((h) => h.kind), ['card']);
  assert.equal(hit[0]!.text, '4111 1111 1111 1111');

  // A 16-digit order reference that fails the check digit is not a card - and
  // it is too long to be read as a phone number either.
  assert.deepEqual(kindsIn('Order 1234567890123456'), []);
});

test('an IBAN and a postcode are recognised, a plain word pair is only ever a maybe', () => {
  const pii = loadPii();
  assert.deepEqual(kindsIn('IBAN GB82 WEST 1234 5698 7654 32'), ['iban']);
  assert.deepEqual(kindsIn('221B Baker Street, London NW1 6XE'), ['address', 'postcode']);

  const name = pii.piiFindings('Jane Doe');
  assert.deepEqual(name.map((h) => h.kind), ['name']);
  assert.equal(name[0]!.maybe, true, 'a capitalised pair is a guess and says so');
  assert.deepEqual(kindsIn('Monday Morning'), [], 'a stoplisted word is not a surname');
});

test('a plain sentence yields nothing at all', () => {
  assert.deepEqual(kindsIn('The quick brown fox jumps over the lazy dog.'), []);
  assert.deepEqual(kindsIn('covered content is destroyed when the file is rebuilt'), []);
});

test('version strings and bare years are guarded, so a changelog is not a phone book', () => {
  assert.deepEqual(kindsIn('Lolly engine v1.149.0, released 2026'), []);
  assert.deepEqual(kindsIn('Requires 10.15.7.2024 or later'), []);
  assert.deepEqual(kindsIn('Copyright 2026'), []);
  // A URL's digits are claimed by the URL, never re-read as a number.
  assert.deepEqual(kindsIn('See https://example.com/2026/01/02/report'), []);
});

test('a dot-separated date is a date, not a version string', () => {
  // The version guard used to CLAIM 12.03.1980 - three dotted numbers is a
  // version by shape - which silently swallowed the way most of Europe writes
  // a date of birth: the one field on a scanned form that most needs covering.
  const pii = loadPii();
  for (const line of ['Born 12.03.1980 in Berlin', 'Geburtsdatum: 01.02.1975', 'invoice 12.03.1980 total']) {
    const hits = pii.piiFindings(line);
    assert.deepEqual(hits.map((h) => h.kind), ['date'], line);
    assert.equal(hits[0]!.maybe, true, 'a date is still only ever offered as a question');
    assert.equal(line.slice(hits[0]!.start, hits[0]!.end), hits[0]!.text);
  }
  // …and the guard it was doing double duty for still holds: neither of these
  // is the three-part, 2-to-4-digit-tail shape a date has.
  assert.deepEqual(kindsIn('Lolly engine v1.77.0'), []);
  assert.deepEqual(kindsIn('Build 1.149.0 shipped'), []);
});

test('every hit carries the span it matched, in reading order', () => {
  const line = 'jane@example.com / +44 20 7946 0958';
  const hits = loadPii().piiFindings(line);
  assert.deepEqual(hits.map((h) => h.kind), ['email', 'phone']);
  for (const h of hits) {
    assert.equal(line.slice(h.start, h.end), h.text, `${h.kind} span matches its text`);
  }
});

// ─── OcrResult → proposed regions ────────────────────────────────────────────

const ocrLine = (text: string, box: { x: number; y: number; w: number; h: number }, confidence = 0.9) =>
  ({ text, box, confidence });

test('a line that classifies becomes one region, scaled back to source pixels', () => {
  const { suggestionsFrom } = loadPii();
  // The reader saw a half-size working copy, so every box comes back doubled.
  const out = suggestionsFrom(
    { lang: 'en', text: '', lines: [ocrLine('jane@example.com', { x: 10, y: 20, w: 100, h: 12 }, 0.876)] },
    2, 1000, 800,
  );
  assert.equal(out.length, 1);
  assert.deepEqual(
    { page: out[0]!.page, x: out[0]!.x, y: out[0]!.y, w: out[0]!.w, h: out[0]!.h },
    { page: 1, x: 20, y: 40, w: 200, h: 24 },
  );
  assert.equal(out[0]!.kind, 'email');
  assert.equal(out[0]!.text, 'jane@example.com');
  assert.equal(out[0]!.confidence, 0.88, 'the model score is carried, rounded, never as a verdict');
});

test('lines with nothing personal on them propose nothing', () => {
  const { suggestionsFrom } = loadPii();
  const out = suggestionsFrom({
    lang: 'en',
    text: '',
    lines: [
      ocrLine('QUARTERLY REPORT', { x: 0, y: 0, w: 200, h: 20 }),
      ocrLine('page 3 of 12', { x: 0, y: 30, w: 80, h: 12 }),
      ocrLine('call 020 7946 0958', { x: 0, y: 60, w: 150, h: 12 }),
    ],
  }, 1, 400, 400);
  assert.deepEqual(out.map((s) => s.kind), ['phone']);
  assert.equal(out[0]!.y, 60, 'the region is the line that matched, not the block');
});

test('several matches on one line collapse to one region, because a line is one box', () => {
  const { suggestionsFrom } = loadPii();
  const out = suggestionsFrom(
    { lang: 'en', text: '', lines: [ocrLine('jane@example.com  +44 20 7946 0958', { x: 5, y: 5, w: 300, h: 14 })] },
    1, 400, 400,
  );
  assert.equal(out.length, 1, 'one line, one rectangle, one thing to accept');
  assert.deepEqual(out[0]!.kinds, ['email', 'phone']);
  assert.equal(out[0]!.maybe, false, 'a definite match anywhere on the line makes the region definite');
  assert.match(out[0]!.text, /jane@example\.com, \+44/);
});

test('a mixed line is headed by the hit that earns its confidence, not by the first one', () => {
  const { suggestionsFrom } = loadPii();
  // Reading order puts the capitalised pair (a guess) first and the address
  // (definite) second. `maybe` is false because of the address, so heading the
  // region with the guess printed "Name" with no question mark: a guess stated
  // as a fact, on the one chip a person decides from.
  const out = suggestionsFrom(
    { lang: 'en', text: '', lines: [ocrLine('Jane Doe  jane@example.com', { x: 0, y: 0, w: 200, h: 14 })] },
    1, 400, 400,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]!.maybe, false);
  assert.equal(out[0]!.kind, 'email', 'the definite hit heads the region');
  assert.equal(out[0]!.label, 'Email address');
  assert.deepEqual(out[0]!.kinds, ['name', 'email'], 'both are still reported');

  // A line with nothing definite on it keeps its first guess as the heading.
  const guess = suggestionsFrom(
    { lang: 'en', text: '', lines: [ocrLine('Jane Doe  020 7946 0958', { x: 0, y: 0, w: 200, h: 14 })] },
    1, 400, 400,
  );
  assert.equal(guess[0]!.kind, 'name');
  assert.equal(guess[0]!.maybe, true);
});

test('a region is clamped to the frame and a degenerate box is dropped', () => {
  const { suggestionsFrom } = loadPii();
  const out = suggestionsFrom({
    lang: 'en',
    text: '',
    lines: [
      ocrLine('jane@example.com', { x: 380, y: 10, w: 100, h: 12 }),   // runs off the right edge
      ocrLine('jane@example.com', { x: 500, y: 10, w: 40, h: 12 }),    // starts past it
      ocrLine('jane@example.com', { x: 0, y: 0, w: 0, h: 12 }),        // no width at all
    ],
  }, 1, 400, 400);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.x, 380);
  assert.equal(out[0]!.w, 20, 'clamped to the frame, never past it');
});

test('a read with no lines, or a malformed one, proposes nothing and does not throw', () => {
  const { suggestionsFrom } = loadPii();
  assert.deepEqual(suggestionsFrom({ lang: 'en', text: '', lines: [] }, 1, 100, 100), []);
  assert.deepEqual(suggestionsFrom(null, 1, 100, 100), []);
  assert.deepEqual(suggestionsFrom({ lines: [{ text: 'jane@example.com' }] }, 1, 100, 100), [],
    'a line with no box cannot become a region');
});

// ─── the affordance is absent where the reader is ────────────────────────────

/** The smallest PNG the hook's own scanners accept: signature, IHDR, IEND. */
function tinyPng(w = 40, h = 20): Uint8Array {
  const chunk = (type: string, data: Uint8Array): Uint8Array => {
    const out = new Uint8Array(12 + data.length);
    new DataView(out.buffer).setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    return out; // the scanners never check the CRC
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8; ihdr[9] = 6;
  const sig = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const a = chunk('IHDR', ihdr);
  const b = chunk('IEND', new Uint8Array(0));
  const out = new Uint8Array(sig.length + a.length + b.length);
  out.set(sig, 0); out.set(a, sig.length); out.set(b, sig.length + a.length);
  return out;
}

function modelFor(over: Record<string, unknown> = {}): { id: string; value: unknown }[] {
  const values: Record<string, unknown> = {
    source: { __file: true, name: 'shot.png', mime: 'image/png', size: 0, bytes: tinyPng(), url: null },
    bars: [], quantise: true, grayscale: false, svgVector: false, resign: false,
    style: 'branded', stampLabel: '', fileKind: '', ocr: '',
    ...over,
  };
  (values.source as { size: number }).size = (values.source as { bytes: Uint8Array }).bytes.length;
  return MANIFEST.inputs.map((i: { id: string }) => ({ id: i.id, value: values[i.id] }));
}

test('the manifest carries the canvas request channel and no user-facing toggle', () => {
  const ocr = MANIFEST.inputs.find((i: { id: string }) => i.id === 'ocr');
  assert.ok(ocr, 'the ocr input exists');
  assert.equal(ocr.type, 'text');
  assert.equal(ocr.default, '');
  assert.deepEqual(ocr.showIf, { fileKind: '__never-rendered' }, 'never rendered in the sidebar');
});

test('a shell with no host.ocr publishes no suggest affordance, so the CLI is unchanged', async () => {
  const hooks = loadHooks();
  const out = await hooks.onInit({ model: modelFor(), host: BARE_HOST, id: '' });
  assert.equal(out.ocrAvailable, false);
  assert.equal(out.ocrPending, false);
  assert.equal(out.ocrError, '');
  assert.equal(out.suggestJson, '[]');
  assert.equal(out.hasSuggestions, false);
  assert.deepEqual(out.suggestions, []);
});

/** A shell that can raster and carries an on-device reader. */
function readerHost(over: Record<string, unknown> = {}): any {
  return {
    ...BARE_HOST,
    raster: { canRaster: () => true },
    ocr: { isAvailable: () => true, run: async () => ({ text: '', lines: [], lang: 'en' }), ...over },
  };
}

test('(e2e) a shell with a reader renders the Suggest control on the canvas', async () => {
  const rt = await createRuntime(
    redactTool(),
    readerHost(),
    { source: { __file: true, name: 'shot.png', mime: 'image/png', size: tinyPng().length, bytes: tinyPng(), url: null } },
  );
  const html = rt.getHydrated();
  assert.match(html, /data-ocr-group/, 'the suggest group is published');
  assert.match(html, /data-ocr-run/, 'and it offers a read, not a running one');
  // The rendered ATTRIBUTE form, not the bare string - the canvas script's own
  // source mentions both names and is part of this same markup.
  assert.doesNotMatch(html, /data-ocr-pending="1"/, 'nothing is read until it is asked for');
  assert.doesNotMatch(html, /data-sugg-accept-all title/, 'nothing to accept before a read');
});

test('(e2e) a read that cannot run says so instead of spinning forever', async () => {
  // Claims raster, has a reader, but no image decoder exists here - which is
  // exactly the shape a half-capable shell has, and it must fail visibly.
  const rt = await createRuntime(
    redactTool(),
    readerHost(),
    {
      source: { __file: true, name: 'shot.png', mime: 'image/png', size: tinyPng().length, bytes: tinyPng(), url: null },
      ocr: '1770000000001',
    },
  );
  const html = rt.getHydrated();
  assert.match(html, /data-toast-key="ocrerr/, 'the failure is a toast, not a stuck busy state');
  assert.doesNotMatch(html, /data-ocr-pending="1"/, 'a failed read is finished, not pending');
});

// ─── dismissals belong to one file ───────────────────────────────────────────

/**
 * The canvas script's dismissal store, lifted out of template.html and run
 * against stubs. It is the only piece of suggestion state that OUTLIVES a
 * repaint (it rides the persistent canvas container), so it is the only piece
 * that can carry over to the next document.
 */
function dismissStore(file: string, shared: Record<string, string>): {
  suggKey: (s: Record<string, unknown>) => string;
  suggDismissed: () => string[];
  suggDismiss: (keys: string[]) => void;
} {
  const from = TEMPLATE.indexOf('function suggKey(');
  const to = TEMPLATE.indexOf('/* A suggestion becomes a bar', from);
  assert.ok(from > 0 && to > from, 'the dismissal block is still where the test extracts it from');
  const src = TEMPLATE.slice(from, to);
  const factory = new Function('canvasRoot', 'suggFile', `${src}\nreturn { suggKey, suggDismissed, suggDismiss };`);
  return factory({ dataset: shared }, file);
}

test('a dismissal is forgotten when the next file is loaded', () => {
  // A key is geometry plus a kind, and two scans of the same form line up
  // exactly - so without the file scope the second document silently withheld
  // a suggestion because the first one's was waved away.
  const shared: Record<string, string> = {};
  const first = dismissStore('form-a.png|120 kB', shared);
  const region = { page: 1, x: 40, y: 80, w: 220, h: 18, kind: 'email' };
  const key = first.suggKey(region);
  first.suggDismiss([key]);
  assert.deepEqual(first.suggDismissed(), [key], 'and it stays dismissed across a repaint');
  assert.deepEqual(dismissStore('form-a.png|120 kB', shared).suggDismissed(), [key]);

  const second = dismissStore('form-b.png|118 kB', shared);
  assert.deepEqual(second.suggDismissed(), [], 'the next document starts over');
  second.suggDismiss([key]);
  assert.deepEqual(second.suggDismissed(), [key]);
  assert.deepEqual(dismissStore('form-a.png|120 kB', shared).suggDismissed(), [],
    'and the store holds exactly one file at a time, never a growing list');
});

test('(e2e) the stage names the file its dismissals belong to', async () => {
  const rt = await createRuntime(
    redactTool(),
    readerHost(),
    { source: { __file: true, name: 'shot.png', mime: 'image/png', size: tinyPng().length, bytes: tinyPng(), url: null } },
  );
  assert.match(rt.getHydrated(), /data-suggest-file="shot\.png\|/);
});

test('a request belongs to the file it was made on, so the next picture is not read unasked', async () => {
  // `canRaster()` reads the host the hook was COMPILED with, so the reader host
  // has to be the factory argument as well as the ctx one.
  const host = readerHost();
  const hooks: any = new Function('host', `${HOOKS_SRC}\nreturn { onInit, onInput };`)(host);
  const pngA = tinyPng(40, 20);
  const pngB = tinyPng(60, 30);
  const fileA = { __file: true, name: 'a.png', mime: 'image/png', size: pngA.length, bytes: pngA, url: null };
  const fileB = { __file: true, name: 'b.png', mime: 'image/png', size: pngB.length, bytes: pngB, url: null };
  // No image decoder exists here, so a read that STARTS is visible as an error.
  const first = await hooks.onInit({ model: modelFor({ source: fileA, ocr: '1770000000010' }), host, id: 'ocr' });
  assert.equal(first.ocrAvailable, true);
  assert.notEqual(first.ocrError, '', 'the click on this picture did start a read');

  const carried = await hooks.onInput({ model: modelFor({ source: fileB, ocr: '1770000000010' }), host, id: 'source' });
  assert.equal(carried.ocrAvailable, true, 'the Suggest button is still offered on the new picture');
  assert.equal(carried.ocrError, '', 'but the leftover nonce did not read it');
  assert.equal(carried.ocrPending, false);
  assert.equal(carried.ocrRead, false);
  assert.equal(carried.hasSuggestions, false);

  const asked = await hooks.onInput({ model: modelFor({ source: fileB, ocr: '1770000000011' }), host, id: 'ocr' });
  assert.notEqual(asked.ocrError, '', 'a fresh click on the new picture reads it');
});

test('a request is ignored where there is no reader, and never patches the request input', async () => {
  const hooks = loadHooks();
  const out = await hooks.onInit({ model: modelFor({ ocr: '1770000000000' }), host: BARE_HOST, id: 'ocr' });
  assert.equal(out.ocrAvailable, false, 'asking cannot conjure a reader');
  assert.equal(out.hasSuggestions, false);
  assert.ok(!('ocr' in out), 'the hook never writes the input the canvas owns');
});
