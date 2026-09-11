// SPDX-License-Identifier: MPL-2.0
/**
 * The Type room's compare stage (plan 97 section 7.2, M4) - what it models, what it
 * renders, and what it refuses to pretend.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/type-compare.test.ts"
 *
 * jsdom supplies the DOM (the tray-ui.test.ts harness, same flags and for the
 * same reason: announce() defers its live-region write to requestAnimationFrame,
 * which jsdom only supplies under `pretendToBeVisual`). jsdom has NO FontFace and
 * no `document.fonts`, so both are stubbed here - which is fortunate rather than
 * unfortunate: the stub is what lets the suite assert that a preview
 * registration is added under the expected family name and DELETED again when
 * the card leaves or the stage is torn down. A preview that persisted would be
 * an installed font nobody asked for.
 *
 * The other thing pinned here is the network gate. `fetch` is a counting double
 * for the whole suite, and the Google path is only ever allowed to touch it
 * AFTER consentGoogle() resolves true - asserted in both directions, because
 * Google Fonts is this studio's one egress.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="stage"></div></body></html>', {
  url: 'http://localhost/#/start',
  pretendToBeVisual: true,
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.Event = dom.window.Event;
// jsdom's addEventListener only accepts ITS AbortSignal, and the stage wires every
// listener through one controller - so the realm's controller has to be jsdom's
// (trim-offer.test.ts hit the same wall).
globalThis.AbortController = dom.window.AbortController as unknown as typeof globalThis.AbortController;

// ── FontFace + document.fonts, which jsdom does not have ─────────────────────

/** Substrings of a preview family whose load() rejects - the "this file is not a
 *  font" path. Matched loosely because a preview family carries the MOUNT serial
 *  (`__ds-preview-liar-<mount>-<card>`), which a test cannot predict: mounts are
 *  counted for the life of the module, so the number depends on how many stages
 *  ran before this one. */
const failing = new Set<string>();
/** Every family currently registered on the fake document.fonts. */
const registered = new Set<string>();

class FakeFontFace {
  family: string;
  descriptors: Record<string, unknown>;
  constructor(family: string, _source: unknown, descriptors: Record<string, unknown> = {}) {
    this.family = family;
    this.descriptors = descriptors;
  }
  async load(): Promise<FakeFontFace> {
    if ([...failing].some((f) => this.family.includes(f))) throw new Error('bad font');
    return this;
  }
}
(globalThis as unknown as { FontFace: unknown }).FontFace = FakeFontFace;

Object.defineProperty(dom.window.document, 'fonts', {
  configurable: true,
  value: {
    add(face: FakeFontFace) { registered.add(face.family); },
    delete(face: FakeFontFace) { return registered.delete(face.family); },
  },
});

// ── fetch, counted ───────────────────────────────────────────────────────────

let fetchCalls: string[] = [];
/** What the next fetch does. 'reject' is the offline/CORS-400 shape the whole
 *  google-fonts ladder produces. */
let fetchMode: 'reject' = 'reject';
globalThis.fetch = (async (input: unknown) => {
  fetchCalls.push(String(input));
  if (fetchMode === 'reject') throw new Error('network down');
  return { ok: false, status: 400 } as unknown as Response;
}) as typeof fetch;

const {
  MAX_COMPARE_CARDS,
  admitCandidate,
  applyCardEvent,
  chipsFromFacts,
  collapsedFaceText,
  compareCardsHtml,
  defaultSpecimen,
  describeFaceBytes,
  faceLine,
  hasFetchableSource,
  mountTypeCompare,
  pickPreviewFace,
  pinnedFaces,
  previewFamilyName,
  readSystemName,
  slugFamily,
  stageAfterIndex,
  usableSystemName,
} = await import('./type-compare.ts');
import type {
  CompareCandidate, CompareCard, CompareChoice, FaceFacts, TypeCompareCtx,
} from './type-compare.ts';
import type { FaceState } from './ownership.ts';
import type { GoogleFontFace } from '../google-fonts.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { escape } from '../../utils.ts';

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** The identity translator: the module's copy is English source strings, so this
 *  is exactly what ships, minus the catalog lookup. This is `tRaw` - the one
 *  whose params come through untouched. */
const tRaw = (s: string, params?: Record<string, string | number>): string => {
  let out = s;
  for (const [k, v] of Object.entries(params ?? {})) out = out.replaceAll(`{${k}}`, String(v));
  return out;
};

/**
 * ...and this is `t`, which HTML-ESCAPES its interpolated params exactly as
 * i18n.ts's does (`interpolate(..., esc = true)`, pinned by i18n.test.ts).
 *
 * The distinction is not pedantry here: with a non-escaping double in this slot
 * the suite cannot tell a correctly escaped attribute from a doubly escaped one,
 * and "Q&A Sans" reaching an accessible name as "Q&amp;A Sans" would pass every
 * assertion below. Give the module the same translator the app gives it.
 */
const t = (s: string, params?: Record<string, string | number>): string => {
  let out = s;
  // The SHARED escape, not a copy of it: i18n.ts interpolates with this exact
  // function, so the double cannot drift from the real thing.
  for (const [k, v] of Object.entries(params ?? {})) out = out.replaceAll(`{${k}}`, escape(String(v)));
  return out;
};

function card(over: Partial<CompareCard> = {}): CompareCard {
  return {
    id: 'tycmp-card-1',
    seq: 1,
    kind: 'google',
    family: 'Inter',
    chips: [],
    state: 'idle',
    previewFamily: '__ds-preview-inter-0-1',
    needsFetch: true,
    busy: false,
    ...over,
  };
}

/** A minimal but REAL sfnt: an OTTO header with one OS/2 table whose fsType is
 *  `value`. detectFontFormat reads the magic, readFontEmbedding walks the table
 *  directory - neither is faked here. */
function sfnt(fsType: number, tag = 'OS/2'): Uint8Array {
  const headerLen = 12 + 16;
  const os2Off = headerLen;
  const os2Len = 12;
  const buf = new Uint8Array(headerLen + os2Len);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x4f54544f, false);        // 'OTTO'
  view.setUint16(4, 1, false);                 // numTables
  for (let i = 0; i < 4; i++) buf[12 + i] = tag.charCodeAt(i);
  view.setUint32(12 + 8, os2Off, false);       // table offset
  view.setUint32(12 + 12, os2Len, false);      // table length
  view.setUint16(os2Off + 8, fsType, false);   // OS/2.fsType
  return buf;
}

function gface(over: Partial<GoogleFontFace> = {}): GoogleFontFace {
  return {
    family: 'Inter', style: 'normal', weight: '400', subset: 'latin',
    unicodeRange: '', url: 'https://fonts.gstatic.com/x.woff2', format: 'woff2',
    ...over,
  };
}

const settle = (): Promise<void> => new Promise((r) => { setTimeout(r, 0); });

/** The registered preview families with the MOUNT serial folded out - 
 *  `__ds-preview-inter-3-1` → `__ds-preview-inter-*-1`. The mount number counts
 *  every stage this module has ever mounted, so it is a property of test ORDER
 *  and pinning it would make these assertions break for the wrong reason. What
 *  matters, and is still asserted exactly, is the family and the card serial. */
const registeredFaces = (): string[] =>
  [...registered].map((f) => f.replace(/-\d+-(\d+)$/, '-*-$1')).sort();

function stage(): HTMLElement {
  const el = document.querySelector<HTMLElement>('#stage')!;
  el.innerHTML = '';
  registered.clear();
  failing.clear();
  fetchCalls = [];
  return el;
}

/** A host with no tokens asset - the plain "nothing installed" case. */
const bareHost = { assets: {} } as unknown as HostV1;

function ctxFor(over: Partial<TypeCompareCtx> = {}): TypeCompareCtx {
  return {
    host: bareHost,
    t,
    tRaw,
    consentGoogle: async () => false,
    onSelect: async () => { /* the caller persists; nothing to do here */ },
    ...over,
  };
}

// ── Pure: naming ─────────────────────────────────────────────────────────────

test('slugFamily reduces a family to a charset that cannot escape a CSS string', () => {
  assert.equal(slugFamily('Inter'), 'inter');
  assert.equal(slugFamily('  SUSE Mono  '), 'suse-mono');
  assert.equal(slugFamily('M PLUS Rounded 1c'), 'm-plus-rounded-1c');
  assert.equal(slugFamily("Evil'; }"), 'evil');
  assert.equal(slugFamily('日本語'), 'face', 'a name with nothing sluggable still yields an ident');
  assert.equal(slugFamily(''), 'face');
});

test('previewFamilyName is session-scoped and unique per card, not per family', () => {
  assert.equal(previewFamilyName('Inter', 1), '__ds-preview-inter-0-1');
  assert.equal(previewFamilyName('SUSE Mono', 12, 3), '__ds-preview-suse-mono-3-12');
  // The same family from two sources must never share one registration - 
  // removing either would blank the other.
  assert.notEqual(previewFamilyName('Inter', 1), previewFamilyName('Inter', 2));
  // ...and neither must two STAGES, which is what the mount serial is for:
  // document.fonts is per document, not per mount.
  assert.notEqual(previewFamilyName('Inter', 1, 1), previewFamilyName('Inter', 1, 2));
  assert.ok(!/["'\\;{}]/.test(previewFamilyName("Inter'; color:red", 3, 4)),
    'the name reaches a font-family value, so its charset is the guard');
});

// ── Pure: the candidate model and the cap ────────────────────────────────────

test('admitCandidate mints a card and hands it its own preview family', () => {
  const got = admitCandidate([], { kind: 'google', family: ' Inter ' }, 4);
  assert.ok(got.ok);
  assert.equal(got.card.family, 'Inter', 'the family is trimmed, not re-cased');
  assert.equal(got.card.previewFamily, '__ds-preview-inter-0-4');
  const inAnotherStage = admitCandidate([], { kind: 'google', family: 'Inter' }, 4, 7);
  assert.ok(inAnotherStage.ok);
  assert.equal(inAnotherStage.card.previewFamily, '__ds-preview-inter-7-4',
    'the mount serial rides through admission - document.fonts is per document');
  assert.equal(got.card.state, 'idle');
  assert.equal(got.card.needsFetch, true, 'no bytes means the face has to come off the network');
});

test('admitCandidate refuses a duplicate of the same kind, but not of another kind', () => {
  const first = admitCandidate([], { kind: 'google', family: 'Inter' }, 1);
  assert.ok(first.ok);
  const dupe = admitCandidate([first.card], { kind: 'google', family: 'inter' }, 2);
  assert.deepEqual(dupe, { ok: false, refusal: 'duplicate' }, 'family matching ignores case');

  const other = admitCandidate([first.card], {
    kind: 'upload', family: 'Inter', bytes: sfnt(0),
  }, 2);
  assert.ok(other.ok, 'an uploaded Inter beside a Google Inter is the comparison, not a duplicate');
  assert.notEqual(other.card.previewFamily, first.card.previewFamily);
});

test('admitCandidate caps the stage, and says cap only when there is nothing better to say', () => {
  let cards: CompareCard[] = [];
  for (let i = 0; i < MAX_COMPARE_CARDS; i++) {
    const got = admitCandidate(cards, { kind: 'google', family: `Face ${i}` }, i + 1);
    assert.ok(got.ok, `card ${i} should fit`);
    cards = [...cards, got.card];
  }
  assert.equal(cards.length, MAX_COMPARE_CARDS);
  assert.deepEqual(admitCandidate(cards, { kind: 'google', family: 'One More' }, 99),
    { ok: false, refusal: 'cap' });
  // Full AND already present: "it is already here" is the useful answer.
  assert.deepEqual(admitCandidate(cards, { kind: 'google', family: 'Face 0' }, 99),
    { ok: false, refusal: 'duplicate' });
});

test('admitCandidate refuses a candidate with nothing to show', () => {
  assert.deepEqual(admitCandidate([], { kind: 'google', family: '  ' }, 1), { ok: false, refusal: 'invalid' });
  assert.deepEqual(admitCandidate([], { kind: 'upload', family: 'Inter' }, 1), { ok: false, refusal: 'invalid' },
    'an upload with no bytes is not a face');
  assert.deepEqual(admitCandidate([], { kind: 'upload', family: 'Inter', bytes: new Uint8Array(0) }, 1),
    { ok: false, refusal: 'invalid' });
});

test('a scanned family with no fetchable source is admitted as an honest failure, not hidden', () => {
  const got = admitCandidate([], { kind: 'tray', family: 'Helvetica Neue LT Std 57' }, 1);
  assert.ok(got.ok, 'the source really found it - the card is where we say we cannot show it');
  assert.equal(got.card.state, 'failed');
  assert.equal(got.card.reason, 'no-source');
  const known = admitCandidate([], { kind: 'tray', family: 'inter' }, 2);
  assert.ok(known.ok);
  assert.equal(known.card.state, 'idle', 'a family we hold a source for is worth offering');
});

test('a Google pick is gated on the css2 name charset, not on the suggestion list', () => {
  // POPULAR_FAMILIES is a datalist, not an availability list (its own header
  // says so), so a real family that is simply not on it must still be tried.
  const offList = admitCandidate([], { kind: 'google', family: 'Bespoke Grotesk' }, 1);
  assert.ok(offList.ok);
  assert.equal(offList.card.state, 'idle');

  const impossible = admitCandidate([], { kind: 'google', family: 'Söhne Breit' }, 2);
  assert.ok(impossible.ok);
  assert.equal(impossible.card.state, 'failed', 'css2 cannot name this, so there is nothing to try');
  assert.equal(impossible.card.reason, 'no-source');

  assert.equal(hasFetchableSource('google', 'Bespoke Grotesk'), true);
  assert.equal(hasFetchableSource('tray', 'Bespoke Grotesk'), false);
  assert.equal(hasFetchableSource('tray', '  INTER '), true, 'family matching ignores case and padding');
});

// ── Pure: the load state machine ─────────────────────────────────────────────

test('applyCardEvent walks idle → loading → ready and clears the old reason', () => {
  const idle = card({ reason: 'declined' });
  const loading = applyCardEvent(idle, { type: 'start' });
  assert.equal(loading.state, 'loading');
  assert.equal(loading.reason, undefined, 'a retry does not keep showing why the last try failed');
  const ready = applyCardEvent(loading, { type: 'ready' });
  assert.equal(ready.state, 'ready');
  assert.equal(ready.reason, undefined);
});

test('applyCardEvent records a failure with its reason, and lets a retry restart it', () => {
  const failed = applyCardEvent(applyCardEvent(card(), { type: 'start' }), { type: 'fail', reason: 'fetch-failed' });
  assert.equal(failed.state, 'failed');
  assert.equal(failed.reason, 'fetch-failed');
  assert.equal(applyCardEvent(failed, { type: 'start' }).state, 'loading');
});

test('a decline is not a failure - it returns the card to idle, offer intact', () => {
  const declined = applyCardEvent(applyCardEvent(card(), { type: 'start' }), { type: 'declined' });
  assert.equal(declined.state, 'idle', 'nothing broke and nothing was fetched');
  assert.equal(declined.reason, 'declined');
});

test('no-source is terminal: nothing can restart a card with no source to try', () => {
  const dead = card({ state: 'failed', reason: 'no-source' });
  assert.equal(applyCardEvent(dead, { type: 'start' }), dead, 'the same object back - a provable no-op');
});

test('a stale resolution landing on a card that moved on is a no-op, not a repaint', () => {
  const ready = card({ state: 'ready' });
  assert.equal(applyCardEvent(ready, { type: 'ready' }), ready);
  assert.equal(applyCardEvent(ready, { type: 'fail', reason: 'fetch-failed' }), ready);
  assert.equal(applyCardEvent(ready, { type: 'start' }), ready, 'a ready face is not re-fetched');
  const idle = card();
  assert.equal(applyCardEvent(idle, { type: 'ready' }), idle, 'ready only applies to a load in flight');
  assert.equal(applyCardEvent(idle, { type: 'declined' }), idle);
});

// ── Pure: what a file says about itself ──────────────────────────────────────

test('describeFaceBytes reads format and fsType off a real sfnt, and admits what it cannot read', () => {
  const installable = describeFaceBytes(sfnt(0x0000));
  assert.equal(installable.format, 'otf');
  assert.equal(installable.embedding, 'installable');
  assert.equal(installable.embeddingReadable, true);

  const restricted = describeFaceBytes(sfnt(0x0002));
  assert.equal(restricted.embedding, 'restricted');

  const noSubset = describeFaceBytes(sfnt(0x0100));
  assert.equal(noSubset.noSubsetting, true);

  // wOF2 magic: the OS/2 table is inside a compressed wrapper we do not open.
  const woff2 = describeFaceBytes(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0]));
  assert.equal(woff2.format, 'woff2');
  assert.equal(woff2.embeddingReadable, false, 'we cannot read the flags, which is not the same as none stated');

  assert.equal(describeFaceBytes(new Uint8Array([1, 2, 3, 4])).format, 'unknown');
});

test('chipsFromFacts never turns "we cannot read it" into "nothing is stated"', () => {
  const base: FaceFacts = {
    format: 'woff2', family: 'Inter', weight: null, weightRange: null, style: null,
    embedding: 'unknown', embeddingReadable: false, noSubsetting: false, bitmapOnly: false,
  };
  const woff2 = chipsFromFacts(base, t);
  assert.ok(woff2.includes('WOFF2'));
  assert.ok(woff2.includes('Licence flags not readable in this format'));
  assert.ok(!woff2.includes('Licence not stated'), 'the two claims are different and must not be merged');

  const readable = chipsFromFacts({ ...base, format: 'otf', embeddingReadable: true }, t);
  assert.ok(readable.includes('Licence not stated'), 'an OS/2-less sfnt genuinely states nothing');

  const restricted = chipsFromFacts({
    ...base, format: 'ttf', embeddingReadable: true, embedding: 'restricted',
    weight: 700, style: 'italic', noSubsetting: true,
  }, t);
  assert.deepEqual(restricted,
    ['TTF', 'Weight 700', 'Italic', 'Embedding not permitted', 'Subsetting not permitted']);
});

test('a variable face is chipped by its AXIS, not by the one weight OS/2 defaults to', () => {
  // usWeightClass on Outfit[wght].ttf is 100. Saying "Weight 100" about a file
  // that carries 100 to 900 is true of one instance and wrong about the face.
  const variable: FaceFacts = {
    format: 'ttf', family: 'Outfit', weight: 100, weightRange: '100 900', style: 'normal',
    embedding: 'installable', embeddingReadable: true, noSubsetting: false, bitmapOnly: false,
  };
  assert.deepEqual(chipsFromFacts(variable, t), ['TTF', 'Variable weight 100–900']);
  assert.deepEqual(chipsFromFacts({ ...variable, weightRange: null }, t), ['TTF', 'Weight 100']);
});

test('describeFaceBytes reports no axis for a static face, and never reads one through a wrapper', () => {
  assert.equal(describeFaceBytes(sfnt(0)).weightRange, null, 'an OS/2-only sfnt is static');
  const woff2 = describeFaceBytes(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0]));
  assert.equal(woff2.weightRange, null, 'the table directory is inside the wrapper we do not open');
});

// ── Pure: picking one Google face ────────────────────────────────────────────

test('pickPreviewFace takes one upright latin face nearest 400', () => {
  const exact = pickPreviewFace([gface({ weight: '700' }), gface({ weight: '500' }), gface({ weight: '400' })]);
  assert.equal(exact?.weight, '400');

  const noFour = pickPreviewFace([
    gface({ weight: '700' }),
    gface({ weight: '400', style: 'italic' }),
    gface({ weight: '500' }),
  ]);
  assert.equal(noFour?.weight, '500', 'the nearest UPRIGHT weight wins over an italic 400');
  assert.equal(noFour?.style, 'normal');
});

test('pickPreviewFace prefers a variable range that covers 400, and latin over other subsets', () => {
  const variable = pickPreviewFace([gface({ weight: '900' }), gface({ weight: '100 900' })]);
  assert.equal(variable?.weight, '100 900', 'a range containing 400 costs nothing');

  const latin = pickPreviewFace([
    gface({ subset: 'cyrillic', weight: '400' }),
    gface({ subset: 'latin', weight: '700' }),
  ]);
  assert.equal(latin?.subset, 'latin');

  assert.equal(pickPreviewFace([]), null);
  assert.equal(pickPreviewFace([gface({ style: 'italic' })])?.style, 'italic',
    'an italic-only family still previews - refusing to show it would be worse');
});

// ── Pure: the specimen's opening text ────────────────────────────────────────

test('usableSystemName rejects the placeholder labels the install path writes', () => {
  assert.equal(usableSystemName('Acme Health'), 'Acme Health');
  assert.equal(usableSystemName('  Acme  '), 'Acme');
  assert.equal(usableSystemName('Brand tokens'), null);
  assert.equal(usableSystemName('My brand'), null);
  assert.equal(usableSystemName(''), null);
  assert.equal(usableSystemName(undefined), null);
  assert.equal(usableSystemName('x'.repeat(80)), null, 'a specimen line is not a paragraph');
});

test('defaultSpecimen uses the system name when there is one, else a pangram', () => {
  assert.equal(defaultSpecimen('Acme Health', t), 'Acme Health');
  assert.equal(defaultSpecimen('Brand tokens', t), 'Sphinx of black quartz, judge my vow');
  assert.equal(defaultSpecimen(null, t), 'Sphinx of black quartz, judge my vow');
});

test('readSystemName digs the label out of the tokens asset, and survives a broken store', async () => {
  const withName = {
    assets: { _findMetaByType: async () => ({ id: 'user/tokens/brand', meta: { name: 'Acme Health' } }) },
  } as unknown as HostV1;
  assert.equal(await readSystemName(withName), 'Acme Health');

  const placeholder = {
    assets: { _findMetaByType: async () => ({ id: 'user/tokens/brand', meta: { name: 'Brand tokens' } }) },
  } as unknown as HostV1;
  assert.equal(await readSystemName(placeholder), null);

  const broken = {
    assets: { _findMetaByType: async () => { throw new Error('idb unavailable'); } },
  } as unknown as HostV1;
  assert.equal(await readSystemName(broken), null, 'no name is a fine answer');
  assert.equal(await readSystemName(bareHost), null);
});

// ── Pure: markup ─────────────────────────────────────────────────────────────

test('compareCardsHtml paints the face ONLY when the card is ready', () => {
  const ready = compareCardsHtml([card({ state: 'ready' })], 'Hamburgefonstiv', t);
  assert.ok(ready.includes(`font-family:'__ds-preview-inter-0-1'`), 'a ready card shows the real face');
  assert.ok(!ready.includes('tycmp-skel'));
  assert.ok(!ready.includes('Shown in the interface face.'));

  // Nothing loaded, but something is coming: a skeleton bar the height of the
  // specimen. Not a line of type in the interface face - that is the one
  // unforgivable bug in a comparison, and the words under it were never enough.
  for (const state of ['idle', 'loading', 'failed'] as const) {
    const html = compareCardsHtml([card({ state })], 'Hamburgefonstiv', t);
    assert.ok(!html.includes('font-family'), `a ${state} card must not paint a face it does not have`);
    assert.ok(html.includes('tycmp-skel'), `a ${state} card draws the placeholder instead`);
    assert.ok(!html.includes('Hamburgefonstiv'), 'and does not set the specimen at all');
    assert.ok(!html.includes('Shown in the interface face.'));
  }

  // The one exception: nothing is EVER coming for this family, so the interface
  // face is all there is, and the card says so in words.
  const dead = compareCardsHtml([card({ state: 'failed', reason: 'no-source' })], 'Hamburgefonstiv', t);
  assert.ok(!dead.includes('font-family'));
  assert.ok(dead.includes('Hamburgefonstiv'), 'the specimen still stands');
  assert.ok(dead.includes('Shown in the interface face.'));
});

test('compareCardsHtml renders no disabled control, ever - the state chooses the primary', () => {
  // plan 182 section 6.2. "Use this face" used to be on every card and greyed out on
  // four of them, so the loudest thing on a card somebody had just asked for was
  // a dead button. It is now simply absent until there is a face to choose.
  const ready = compareCardsHtml([card({ state: 'ready' })], 'Aa', t);
  assert.ok(ready.includes('data-tycmp-select="tycmp-card-1"'));

  for (const state of ['idle', 'loading', 'failed'] as const) {
    const html = compareCardsHtml([card({ state })], 'Aa', t);
    assert.equal(html.includes('data-tycmp-select'), false, `${state} offers no Use this face at all`);
  }
  // A press in flight is not repeatable - but the guard is select()'s own
  // `card.busy` check, not an attribute that makes the button read as broken.
  const busy = compareCardsHtml([card({ state: 'ready', busy: true })], 'Aa', t);
  assert.match(busy, /data-tycmp-select="tycmp-card-1"[^>]*aria-busy="true"/);

  const every: CompareCard[] = [
    card(),
    card({ state: 'idle', reason: 'declined' }),
    card({ state: 'loading' }),
    card({ state: 'ready' }),
    card({ state: 'ready', busy: true }),
    card({ state: 'failed', reason: 'fetch-failed' }),
    card({ state: 'failed', reason: 'no-source' }),
    card({ state: 'failed', reason: 'unsupported' }),
    card({ kind: 'upload', needsFetch: false, state: 'failed', reason: 'decode-failed' }),
  ];
  for (const c of every) {
    const html = compareCardsHtml([c], 'Aa', t);
    const where = `${c.state}/${c.reason ?? '-'}`;
    assert.equal(/disabled/.test(html), false, `a disabled control in ${where}`);
    const buttons = [...html.matchAll(/data-tycmp-(?:select|preview)=/g)].length;
    assert.ok(buttons <= 1, `one primary at most, got ${buttons} in ${where}`);
  }
});

test('compareCardsHtml offers Fetch before a fetch, Try again after a failure, and neither with no source', () => {
  assert.ok(compareCardsHtml([card()], 'Aa', t).includes('Fetch from Google'));
  assert.ok(compareCardsHtml([card({ state: 'idle', reason: 'declined' })], 'Aa', t).includes('Fetch from Google'),
    'a decline is not a refusal - the offer stands on the card');
  assert.ok(compareCardsHtml([card({ state: 'failed', reason: 'fetch-failed' })], 'Aa', t).includes('Try again'));

  const dead = compareCardsHtml([card({ state: 'failed', reason: 'no-source' })], 'Aa', t);
  assert.ok(!dead.includes('Try again'), 'a button that cannot succeed is worse than no button');
  assert.ok(dead.includes('No source we can fetch for this family. A font file installs it.'));

  const local = compareCardsHtml([card({ kind: 'upload', needsFetch: false })], 'Aa', t);
  assert.ok(!local.includes('Fetch from Google'), 'a file on this device has nothing to fetch');
});

test('every card state carries exactly one sentence saying where it is', () => {
  const notes: Array<[Partial<CompareCard>, string]> = [
    [{ state: 'loading' }, 'Fetching from Google…'],
    [{ state: 'loading', kind: 'upload', needsFetch: false }, 'Reading the file…'],
    [{ state: 'idle' }, 'Not fetched yet.'],
    [{ state: 'idle', reason: 'declined' }, 'Not fetched. Nothing was sent to Google.'],
    [{ state: 'failed', reason: 'fetch-failed' }, 'Could not fetch this face from Google Fonts.'],
  ];
  for (const [over, sentence] of notes) {
    assert.ok(compareCardsHtml([card(over)], 'Aa', t).includes(sentence),
      `expected "${sentence}" on ${over.state}/${over.reason ?? '-'}`);
  }
  assert.equal(compareCardsHtml([card({ state: 'ready' })], 'Aa', t).includes('tycmp-note'), false,
    'a face you can see explains itself');
});

test('compareCardsHtml escapes a hostile family, label, chip and specimen', () => {
  const html = compareCardsHtml([card({
    family: '<img src=x onerror=alert(1)>',
    label: '"><script>bad()</script>',
    chips: ['<b>SUBSET</b>'],
    provenance: '"><svg onload=alert(1)>',
    state: 'ready',
  })], '</p><script>alert(1)</script>', t);

  assert.ok(!html.includes('<img src=x'), 'the family never reaches the sink as markup');
  assert.ok(!html.includes('<script>'), 'nor the label, chip, provenance or specimen text');
  assert.ok(!html.includes('<b>SUBSET</b>'));
  assert.ok(html.includes('&lt;img src=x'), 'it is escaped, not dropped');
});

test('compareCardsHtml hides the repeated specimen from the accessibility tree', () => {
  // The same string, six times, in six cards: a screen-reader user already has
  // it in the labelled field they typed it into. The RENDERING is the visual
  // property being compared; the text is not new information per card.
  const html = compareCardsHtml([card({ state: 'ready' })], 'Aa', t);
  assert.match(html, /class="tycmp-specimen"[^>]*aria-hidden="true"/);
});

/** Parse a card row the way a browser will, so an assertion can ask for the
 *  ACCESSIBLE NAME rather than for the markup that produces it. */
function parseCards(html: string): HTMLElement {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  return holder;
}

test('an ampersand in a family or a file name is escaped ONCE, not twice', () => {
  // t() escapes what it interpolates (i18n.ts). escape()ing that again is
  // invisible in the raw markup and very visible in the accessible name: the
  // user hears "Remove Q&amp;A Sans".
  const holder = parseCards(compareCardsHtml([card({
    family: 'Q&A Sans', provenance: 'Q&A logo.ttf', state: 'ready',
  })], 'Aa', t));

  const remove = holder.querySelector('[data-tycmp-remove]') as HTMLElement;
  assert.equal(remove.getAttribute('aria-label'), 'Remove Q&A Sans');
  assert.equal(remove.getAttribute('title'), 'Remove Q&A Sans');
  assert.equal(holder.querySelector('.tycmp-family')?.textContent, 'Q&A Sans');
  const chips = [...holder.querySelectorAll('.tycmp-chip')].map((n) => n.textContent);
  assert.ok(chips.includes('from Q&A logo.ttf'), `the provenance chip reads as written, got ${chips}`);
  assert.equal((holder.querySelector('[data-tycmp-card]') as HTMLElement).getAttribute('aria-label'), 'Q&A Sans');
});

test('the source chips a stage did not write are still escaped on the way in', () => {
  // Two different safeties in one list: translator output goes straight to the
  // sink (t() escaped its own params), a SOURCE's chip does not.
  const holder = parseCards(compareCardsHtml([card({
    kind: 'upload', needsFetch: false, chips: ['<b>SUBSET</b>'], state: 'ready',
  })], 'Aa', t));
  const chips = [...holder.querySelectorAll('.tycmp-chip')].map((n) => n.textContent);
  assert.deepEqual(chips, ['From a file', '<b>SUBSET</b>']);
  assert.equal(holder.querySelector('.tycmp-chip b'), null, 'the source authored text, not markup');
});

test('a card names itself and points at the sentence that explains the state it is in', () => {
  // A loading card has NO button at all, so there is nothing pressable to hang a
  // description on - and that is the state a screen-reader user is most likely to
  // land in, because pressing the previous button is what caused it. The reason
  // hangs off the <article>, which focusInCard parks the keyboard on.
  const described = (c: CompareCard): string => {
    const holder = parseCards(compareCardsHtml([c], 'Aa', t));
    const article = holder.querySelector('[data-tycmp-card]') as HTMLElement;
    return (article.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
      .map((id) => [...holder.querySelectorAll('[id]')].find((n) => n.id === id)?.textContent ?? '')
      .join(' ');
  };

  const holder = parseCards(compareCardsHtml([card({ state: 'loading' })], 'Aa', t));
  const article = holder.querySelector('[data-tycmp-card]') as HTMLElement;
  assert.equal(article.getAttribute('aria-label'), 'Inter');
  assert.equal(article.getAttribute('tabindex'), '-1', 'a repaint can hand the keyboard back to the card');
  assert.match(described(card({ state: 'loading' })), /Fetching from Google…/);
  assert.match(described(card({ state: 'failed', reason: 'fetch-failed' })), /Could not fetch this face from Google Fonts\./);
  // The one card that IS showing the interface face says both things.
  const dead = described(card({ state: 'failed', reason: 'no-source' }));
  assert.match(dead, /No source we can fetch for this family\./);
  assert.match(dead, /Shown in the interface face\./);

  const ready = parseCards(compareCardsHtml([card({ state: 'ready' })], 'Aa', t));
  assert.equal((ready.querySelector('[data-tycmp-card]') as HTMLElement).getAttribute('aria-describedby'), null,
    'a face you can see needs no explanation');
});

test('describedby ids are per MOUNT as well as per card, so two stages cannot collide', () => {
  const a = admitCandidate([], { kind: 'google', family: 'Inter' }, 1, 1);
  const b = admitCandidate([], { kind: 'google', family: 'Inter' }, 1, 2);
  assert.ok(a.ok && b.ok);
  // `no-source` is the state that carries BOTH addressed sentences (the note and
  // the interface-face line), so it is the one that can collide in two ways.
  const idsOf = (c: CompareCard): string[] => [...parseCards(compareCardsHtml([{ ...c, state: 'failed', reason: 'no-source' }], 'Aa', t))
    .querySelectorAll('[id]')].map((n) => n.id);
  const first = idsOf(a.card);
  assert.ok(first.length >= 2, `the note and the fallback both carry ids, got ${first}`);
  assert.deepEqual(first.filter((id) => idsOf(b.card).includes(id)), [],
    'a document with two stages open must not have two elements sharing an id');
});

// ── Mount: previews are registrations, and they never persist ────────────────

test('a dropped file previews immediately, with no consent and no network', async () => {
  const el = stage();
  let asked = 0;
  const ui = mountTypeCompare(el, ctxFor({ consentGoogle: async () => { asked++; return true; } }));
  ui.addCandidate({ kind: 'upload', family: 'Acme Sans', bytes: sfnt(0) });
  await settle();

  assert.equal(fetchCalls.length, 0, 'a file on this device is not a network operation');
  assert.equal(asked, 0, 'and it is not a reason to ask about Google');
  assert.deepEqual(registeredFaces(), ['__ds-preview-acme-sans-*-1']);
  assert.equal(el.querySelector('.tycmp-card')?.getAttribute('data-tycmp-state'), 'ready');
  ui.teardown();
});

test('teardown deletes every preview registration', async () => {
  const el = stage();
  const ui = mountTypeCompare(el, ctxFor());
  ui.addCandidate({ kind: 'upload', family: 'One', bytes: sfnt(0) });
  ui.addCandidate({ kind: 'upload', family: 'Two', bytes: sfnt(0) });
  await settle();
  assert.equal(registered.size, 2);

  ui.teardown();
  assert.equal(registered.size, 0, 'a preview that outlived the stage would be an install nobody asked for');
  assert.equal(el.innerHTML, '');
});

test('removing a card revokes its face and leaves the others alone', async () => {
  const el = stage();
  const ui = mountTypeCompare(el, ctxFor());
  ui.addCandidate({ kind: 'upload', family: 'One', bytes: sfnt(0) });
  ui.addCandidate({ kind: 'upload', family: 'Two', bytes: sfnt(0) });
  await settle();

  el.querySelector<HTMLElement>('[data-tycmp-remove="tycmp-card-1"]')!.click();
  await settle();

  assert.deepEqual(registeredFaces(), ['__ds-preview-two-*-2']);
  assert.equal(el.querySelectorAll('.tycmp-card').length, 1);
  ui.teardown();
});

test('removing the card that had focus hands focus on, never to the body', async () => {
  const el = stage();
  const ui = mountTypeCompare(el, ctxFor());
  ui.addCandidate({ kind: 'upload', family: 'One', bytes: sfnt(0) });
  ui.addCandidate({ kind: 'upload', family: 'Two', bytes: sfnt(0) });
  await settle();

  const x = el.querySelector<HTMLElement>('[data-tycmp-remove="tycmp-card-1"]')!;
  x.focus();
  x.click();
  await settle();

  assert.notEqual(document.activeElement, document.body, 'a stage that drops focus is unusable by keyboard');
  assert.equal((document.activeElement as HTMLElement).getAttribute('data-tycmp-remove'), 'tycmp-card-2');
  ui.teardown();
});

test('a file that is not a font fails honestly - no card pretending, no registration', async () => {
  const el = stage();
  const ui = mountTypeCompare(el, ctxFor());
  failing.add('__ds-preview-liar-');
  // Real sfnt magic (so it is admitted) whose decode then rejects - the form of
  // a truncated or corrupt font file.
  ui.addCandidate({ kind: 'upload', family: 'Liar', bytes: sfnt(0) });
  await settle();

  const cardEl = el.querySelector('.tycmp-card')!;
  assert.equal(cardEl.getAttribute('data-tycmp-state'), 'failed');
  assert.equal(registered.size, 0);
  assert.ok(cardEl.textContent?.includes('This file did not load as a font.'));
  assert.ok(cardEl.querySelector('.tycmp-skel'), 'the specimen is a placeholder, not the interface face');
  assert.equal(cardEl.querySelector('[data-tycmp-select]'), null, 'nothing to choose, so nothing to press');
  ui.teardown();
});

// ── Mount: the consent gate is the only door to the network ──────────────────

test('a Google candidate asks at the press that adds it, and a decline fetches nothing', async () => {
  // plan 182 section 6.1: the dialog moved from a ghost button two presses later to
  // the press somebody actually made. The NETWORK contract is unchanged - nothing
  // leaves this device until consentGoogle() resolves true - which is asserted in
  // both directions here.
  const el = stage();
  let asked = 0;
  const ui = mountTypeCompare(el, ctxFor({ consentGoogle: async () => { asked++; return false; } }));
  ui.addCandidate({ kind: 'google', family: 'Inter' });
  await settle();

  assert.equal(asked, 1, 'the press that lands the card is the press that asks');
  assert.equal(fetchCalls.length, 0, 'a decline fetches nothing at all');
  const cardEl = el.querySelector('.tycmp-card')!;
  assert.equal(cardEl.getAttribute('data-tycmp-state'), 'idle');
  assert.ok(cardEl.textContent?.includes('Not fetched. Nothing was sent to Google.'));
  assert.equal(cardEl.querySelector('[data-tycmp-select]'), null, 'no face yet, so no way to choose one');

  // The offer stands on the card, so changing your mind is not a hunt.
  el.querySelector<HTMLElement>('[data-tycmp-preview="tycmp-card-1"]')!.click();
  await settle();

  assert.equal(asked, 2, 'a second press is a second question, not a remembered refusal');
  assert.equal(fetchCalls.length, 0);
  assert.equal(el.querySelector('.tycmp-card')!.getAttribute('data-tycmp-state'), 'idle');
  ui.teardown();
});

test('consent given once holds for the mount, and a later fetch failure stays honest', async () => {
  const el = stage();
  let asked = 0;
  const ui = mountTypeCompare(el, ctxFor({ consentGoogle: async () => { asked++; return true; } }));
  ui.addCandidate({ kind: 'google', family: 'Inter' });
  await settle();

  assert.equal(asked, 1);
  assert.ok(fetchCalls.length > 0, 'consent granted, so the ladder runs');
  assert.ok(fetchCalls.every((u) => u.startsWith('https://fonts.googleapis.com/')
    || u.startsWith('https://fonts.gstatic.com/')), 'the one allowed egress, and nothing else');
  assert.equal(el.querySelector('.tycmp-card')!.getAttribute('data-tycmp-state'), 'failed');
  assert.ok(el.textContent?.includes('Could not fetch this face from Google Fonts.'));
  assert.equal(registered.size, 0, 'a failed fetch registers no face');

  // Consent holds: a second Google candidate previews without asking again.
  fetchCalls = [];
  ui.addCandidate({ kind: 'google', family: 'Outfit' });
  await settle();
  assert.equal(asked, 1, 'the gate is one-time, per the type tab it shares');
  assert.ok(fetchCalls.length > 0);
  ui.teardown();
});

test('a SEEDED tray candidate is not a press: it waits behind its own button', async () => {
  // The Type room opens the stage with up to three pending tray fonts. Nobody
  // asked for those, so previewing them on arrival would fire a fetch - and a
  // consent dialog - per card for family names the person never typed. The
  // press-previews-at-once rule is for candidates somebody asked for.
  const el = stage();
  let asked = 0;
  const ui = mountTypeCompare(el, ctxFor({
    consentGoogle: async () => { asked++; return true; },
    candidates: [{ kind: 'tray', family: 'Inter', provenance: 'brand-guidelines.pdf' }],
  }));
  await settle();

  assert.equal(asked, 0, 'a stage opening is not a request to fetch anything');
  assert.equal(fetchCalls.length, 0);
  const cardEl = el.querySelector('.tycmp-card')!;
  assert.equal(cardEl.getAttribute('data-tycmp-state'), 'idle');
  assert.ok(cardEl.textContent?.includes('Not fetched yet.'));

  el.querySelector<HTMLElement>('[data-tycmp-preview="tycmp-card-1"]')!.click();
  await settle();
  assert.equal(asked, 1, 'the button on the card is the press that asks');
  ui.teardown();
});

test('two presses before the first answer share one consent dialog', async () => {
  const el = stage();
  let asked = 0;
  // The resolver is parked on an object, not a `let` - TS narrows a local
  // assigned only inside a callback to `never` and then refuses the call.
  const gate: { release?: (ok: boolean) => void } = {};
  const ui = mountTypeCompare(el, ctxFor({
    consentGoogle: () => { asked++; return new Promise<boolean>((r) => { gate.release = r; }); },
  }));
  ui.addCandidate({ kind: 'google', family: 'Inter' });
  ui.addCandidate({ kind: 'google', family: 'Outfit' });
  await settle();

  assert.equal(asked, 1, 'two stacked modals asking the same question is not two questions');
  gate.release?.(false);
  await settle();
  assert.equal(el.querySelectorAll('[data-tycmp-state="idle"]').length, 2, 'and one answer settles both');
  ui.teardown();
});

test('a tray candidate that carries its own bytes never touches the network', async () => {
  const el = stage();
  const ui = mountTypeCompare(el, ctxFor({
    consentGoogle: async () => { throw new Error('must not be asked'); },
    candidates: [{
      kind: 'tray', family: 'Guidelines Serif', bytes: sfnt(0),
      chips: ['SUBSET'], provenance: 'brand-guidelines.pdf',
    }],
  }));
  await settle();

  assert.equal(fetchCalls.length, 0);
  assert.deepEqual(registeredFaces(), ['__ds-preview-guidelines-serif-*-1']);
  const cardEl = el.querySelector('.tycmp-card')!;
  assert.equal(cardEl.getAttribute('data-tycmp-state'), 'ready');
  assert.ok(cardEl.textContent?.includes('SUBSET'), 'the source\u2019s honesty chips ride through');
  assert.ok(cardEl.textContent?.includes('brand-guidelines.pdf'));
  ui.teardown();
});

// ── Mount: choosing, the shared specimen, and the cap ────────────────────────

test('a select hands the caller a choice and installs nothing itself', async () => {
  const el = stage();
  const chosen: CompareChoice[] = [];
  const ui = mountTypeCompare(el, ctxFor({ onSelect: async (c) => { chosen.push(c); } }));
  ui.addCandidate({ kind: 'upload', family: 'Acme Sans', label: 'acme.otf', bytes: sfnt(0) });
  await settle();

  el.querySelector<HTMLElement>('[data-tycmp-select="tycmp-card-1"]')!.click();
  await settle();

  assert.equal(chosen.length, 1);
  assert.equal(chosen[0]!.family, 'Acme Sans');
  assert.equal(chosen[0]!.install, 'bytes', 'a file installs from its own bytes');
  assert.ok(chosen[0]!.bytes instanceof Uint8Array);
  assert.deepEqual(registeredFaces(), ['__ds-preview-acme-sans-*-1'], 'selecting is not installing - the preview is all there is');
  ui.teardown();
});

test('the install path follows the bytes, and a face nobody has seen cannot be chosen', async () => {
  const el = stage();
  const chosen: CompareChoice[] = [];
  const ui = mountTypeCompare(el, ctxFor({ onSelect: async (c) => { chosen.push(c); } }));
  // Straight to ready without the network: the same shape the fetch path lands
  // in, reached through a tray candidate that carries bytes but keeps its kind.
  ui.addCandidate({ kind: 'google', family: 'Inter', bytes: sfnt(0) });
  await settle();
  el.querySelector<HTMLElement>('[data-tycmp-select="tycmp-card-1"]')!.click();
  await settle();
  assert.equal(chosen[0]!.install, 'bytes');

  // And the real Google shape - a card with no bytes of its own - cannot be
  // selected at all until its face has loaded, which is the point of the stage.
  // The default ctx declines consent, so this card never gets one.
  const el2 = stage();
  const ui2 = mountTypeCompare(el2, ctxFor({ onSelect: async (c) => { chosen.push(c); } }));
  ui2.addCandidate({ kind: 'google', family: 'Outfit' });
  await settle();
  assert.equal(el2.querySelector('[data-tycmp-select="tycmp-card-1"]'), null,
    'you cannot choose a face you have never seen - there is no button to press');
  assert.equal(chosen.length, 1);
  ui.teardown();
  ui2.teardown();
});

test('a failed select leaves the card standing so it can be tried again', async () => {
  const el = stage();
  const ui = mountTypeCompare(el, ctxFor({ onSelect: async () => { throw new Error('install failed'); } }));
  ui.addCandidate({ kind: 'upload', family: 'Acme Sans', bytes: sfnt(0) });
  await settle();

  el.querySelector<HTMLElement>('[data-tycmp-select="tycmp-card-1"]')!.click();
  await settle();

  assert.ok(el.textContent?.includes('Acme Sans could not be applied. Nothing changed.'));
  const button = el.querySelector<HTMLButtonElement>('[data-tycmp-select="tycmp-card-1"]')!;
  assert.equal(button.disabled, false, 'the press is available again');
  ui.teardown();
});

test('the specimen field is one control mirrored into every card, at one size', async () => {
  const el = stage();
  const ui = mountTypeCompare(el, ctxFor());
  ui.addCandidate({ kind: 'upload', family: 'One', bytes: sfnt(0) });
  ui.addCandidate({ kind: 'upload', family: 'Two', bytes: sfnt(0) });
  await settle();

  const field = el.querySelector<HTMLInputElement>('[data-tycmp-text]')!;
  assert.equal(field.value, 'Sphinx of black quartz, judge my vow', 'no system name here, so the pangram');
  field.value = 'Handgloves';
  field.dispatchEvent(new dom.window.Event('input'));

  const lines = [...el.querySelectorAll('[data-tycmp-specimen]')];
  assert.equal(lines.length, 2);
  assert.ok(lines.every((n) => n.textContent === 'Handgloves'), 'one string, every card');
  // The size is a property of the STAGE, not of a card - a comparison where each
  // card could differ would not be one.
  assert.equal(el.querySelectorAll('[style*="font-size"]').length, 0);
  ui.teardown();
});

test('Escape in the specimen field cancels the edit and keeps focus', async () => {
  const el = stage();
  const ui = mountTypeCompare(el, ctxFor());
  ui.addCandidate({ kind: 'upload', family: 'One', bytes: sfnt(0) });
  await settle();

  const field = el.querySelector<HTMLInputElement>('[data-tycmp-text]')!;
  field.focus();
  field.value = 'half-typed';
  field.dispatchEvent(new dom.window.Event('input'));
  assert.equal(el.querySelector('[data-tycmp-specimen]')!.textContent, 'half-typed');

  field.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(field.value, 'Sphinx of black quartz, judge my vow', 'Escape reverts; it never commits');
  assert.equal(el.querySelector('[data-tycmp-specimen]')!.textContent, 'Sphinx of black quartz, judge my vow');
  assert.equal(document.activeElement, field, 'a cancel does not drop focus');
  ui.teardown();
});

test('Escape in the specimen field bubbles whenever there is no edit to cancel', async () => {
  // The stage does not own a dialog: the panel around it closes on Escape, and
  // the specimen field is the control that panel focuses first. A field that
  // swallowed every Escape would make that panel uncloseable from where the
  // keyboard actually starts.
  const el = stage();
  const heard: string[] = [];
  const outer = (e: Event): void => { heard.push((e as KeyboardEvent).key); };
  document.body.addEventListener('keydown', outer);
  const ui = mountTypeCompare(el, ctxFor());
  await settle();

  const field = el.querySelector<HTMLInputElement>('[data-tycmp-text]')!;
  field.focus();
  const esc = (): void => {
    field.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  };

  esc();
  assert.deepEqual(heard, ['Escape'], 'nothing typed, so the key was never the field’s');

  field.value = 'half-typed';
  field.dispatchEvent(new dom.window.Event('input'));
  esc();
  assert.equal(heard.length, 1, 'an edit in progress is the one Escape the field answers');
  assert.equal(field.value, 'Sphinx of black quartz, judge my vow');

  esc();
  assert.equal(heard.length, 2, 'and the next press, with nothing left to cancel, goes on through');
  assert.equal(document.activeElement, field);

  document.body.removeEventListener('keydown', outer);
  ui.teardown();
});

test('pressing Preview never parks the keyboard on Remove', async () => {
  const el = stage();
  const ui = mountTypeCompare(el, ctxFor({ consentGoogle: async () => true }));
  ui.addCandidate({ kind: 'google', family: 'Inter' });
  await settle();

  const press = el.querySelector<HTMLElement>('[data-tycmp-preview="tycmp-card-1"]')!;
  press.focus();
  press.click();

  // The load is in flight: Preview is gone and "Use this face" is disabled, so
  // there is no control left to hold. The CARD takes it - never the one button
  // that destroys the thing being loaded.
  const loading = document.activeElement as HTMLElement;
  assert.equal(loading.getAttribute('data-tycmp-card'), 'tycmp-card-1',
    `expected the card itself, got ${loading.outerHTML.slice(0, 80)}`);
  assert.equal(loading.hasAttribute('data-tycmp-remove'), false);

  await settle();
  // The stubbed network is down, so Try again is what the card now offers, and
  // that is where the keyboard belongs.
  const after = document.activeElement as HTMLElement;
  assert.equal(after.getAttribute('data-tycmp-preview'), 'tycmp-card-1',
    `expected Try again, got ${after.outerHTML.slice(0, 80)}`);
  assert.equal(el.querySelector('[data-tycmp-card="tycmp-card-1"]')?.getAttribute('data-tycmp-state'), 'failed');
  ui.teardown();
});

test('a card that finishes loading says so, whether or not anyone is looking at it', async () => {
  // announce() defers to requestAnimationFrame, so a frame has to pass.
  const spoken = async (): Promise<string> => {
    await new Promise((r) => { setTimeout(r, 40); });
    return document.querySelector('[data-a11y-live]')?.textContent ?? '';
  };

  const el = stage();
  const ui = mountTypeCompare(el, ctxFor({ consentGoogle: async () => true }));
  ui.addCandidate({ kind: 'upload', family: 'Acme Sans', bytes: sfnt(0) });
  assert.equal(await spoken(), 'Acme Sans is ready to compare.');

  // A failure is the outcome most worth hearing: the visible answer is a
  // sentence in a subtree that was just replaced wholesale, which no live region
  // covers, so silence here would mean a press that returns nothing at all.
  ui.addCandidate({ kind: 'google', family: 'Inter' });
  assert.equal(await spoken(), 'Inter: Could not fetch this face from Google Fonts.');

  // A decline is an outcome too - nothing broke, and saying nothing would read
  // as nothing happening.
  const el2 = stage();
  const ui2 = mountTypeCompare(el2, ctxFor({ consentGoogle: async () => false }));
  ui2.addCandidate({ kind: 'google', family: 'Outfit' });
  assert.equal(await spoken(), 'Outfit: Not fetched. Nothing was sent to Google.');

  ui.teardown();
  ui2.teardown();
});

test('the system name replaces the pangram, unless someone has already typed', async () => {
  const named = {
    assets: { _findMetaByType: async () => ({ id: 'user/tokens/brand', meta: { name: 'Acme Health' } }) },
  } as unknown as HostV1;

  const el = stage();
  const ui = mountTypeCompare(el, ctxFor({ host: named }));
  ui.addCandidate({ kind: 'upload', family: 'One', bytes: sfnt(0) });
  await settle();
  assert.equal(el.querySelector<HTMLInputElement>('[data-tycmp-text]')!.value, 'Acme Health');
  assert.equal(el.querySelector('[data-tycmp-specimen]')!.textContent, 'Acme Health');
  ui.teardown();

  const el2 = stage();
  const ui2 = mountTypeCompare(el2, ctxFor({ host: named }));
  const field = el2.querySelector<HTMLInputElement>('[data-tycmp-text]')!;
  field.value = 'mine';
  field.dispatchEvent(new dom.window.Event('input'));
  await settle();
  assert.equal(field.value, 'mine', 'an edit outranks a default, always');
  ui2.teardown();
});

test('the cap refuses the seventh card and says why', async () => {
  const el = stage();
  const ui = mountTypeCompare(el, ctxFor());
  for (let i = 0; i < MAX_COMPARE_CARDS + 1; i++) {
    ui.addCandidate({ kind: 'upload', family: `Face ${i}`, bytes: sfnt(0) });
  }
  await settle();

  assert.equal(el.querySelectorAll('.tycmp-card').length, MAX_COMPARE_CARDS);
  assert.ok(el.querySelector('[data-tycmp-msg]')!.textContent!.includes('Remove one to add another.'));
  assert.ok(el.querySelector('[data-tycmp-drop]')!.classList.contains('is-full'));

  // Room again, and the refusal was not queued behind the cap.
  el.querySelector<HTMLElement>('[data-tycmp-remove="tycmp-card-1"]')!.click();
  await settle();
  assert.equal(el.querySelectorAll('.tycmp-card').length, MAX_COMPARE_CARDS - 1);
  assert.ok(!el.querySelector('[data-tycmp-drop]')!.classList.contains('is-full'));
  ui.teardown();
});

test('the empty state stands only while there is nothing to compare', async () => {
  const el = stage();
  const ui = mountTypeCompare(el, ctxFor());
  const empty = el.querySelector<HTMLElement>('[data-tycmp-empty]')!;
  assert.equal(empty.hidden, false);

  ui.addCandidate({ kind: 'upload', family: 'One', bytes: sfnt(0) });
  await settle();
  assert.equal(empty.hidden, true);

  el.querySelector<HTMLElement>('[data-tycmp-remove="tycmp-card-1"]')!.click();
  await settle();
  assert.equal(el.querySelector<HTMLElement>('[data-tycmp-empty]')!.hidden, false);
  ui.teardown();
});

// ── The ownership grammar (plan 182 sections 4.2, 6.5) ───────────────────────
// One face, four states, four different sentences. The defect these close is T2:
// a chosen face, an inherited default and a role following another role all said
// the same thing, so nothing on the page told you which of your type was yours.

const face = (over: Partial<FaceState> = {}): FaceState =>
  ({ family: 'SUSE', state: 'inherited', ...over });

test('a face line says which of the four states a role is in', () => {
  // Own: the family, and nothing else on the line.
  assert.deepEqual(faceLine('display', face({ family: 'Inter', state: 'own' }), tRaw),
    { text: 'Inter', tag: '' });
  // Inherited: a real face, chosen by nobody - the family plus the pill.
  assert.deepEqual(faceLine('brand', face(), tRaw), { text: 'SUSE', tag: 'Starter' });
  // Follows: the CHAIN, not the resolved family. Restating "SUSE" here is what
  // made three different states look like one.
  assert.deepEqual(faceLine('italic', { family: 'SUSE', state: 'follows', follows: 'brand' }, tRaw),
    { text: '↳ follows Primary', tag: '' });
  // Unset mono ends at the platform mono, not at another role.
  assert.deepEqual(faceLine('mono', { family: '', state: 'unset' }, tRaw),
    { text: '↳ follows the starter mono', tag: '' });
  // Unset with a face still resolving is a starter face by another route…
  assert.deepEqual(faceLine('brand', { family: 'SUSE', state: 'unset' }, tRaw),
    { text: 'SUSE', tag: 'Starter' });
  // …and unset with nothing behind it says so plainly.
  assert.deepEqual(faceLine('brand', { family: '', state: 'unset' }, tRaw),
    { text: 'Not set', tag: '' });
});

test('a family with an ampersand reaches the line intact (textContent, not markup)', () => {
  const line = faceLine('brand', face({ family: 'Q&A Sans', state: 'own' }), tRaw);
  assert.equal(line.text, 'Q&A Sans', 'the non-escaping translator is the one this takes');
});

test('the collapsed strip says role, face and state on one line', () => {
  assert.equal(collapsedFaceText('brand', face(), tRaw), 'SUSE · Starter');
  assert.equal(collapsedFaceText('display', face({ family: 'Inter', state: 'own' }), tRaw), 'Inter');
  assert.equal(collapsedFaceText('italic', { family: 'SUSE', state: 'follows', follows: 'brand' }, tRaw),
    '↳ follows Primary');
  // The card the open stage belongs to says what is happening to it instead.
  assert.equal(collapsedFaceText('display', face({ family: 'Inter', state: 'own' }), tRaw, true), 'choosing…');
});

test('pinned chips are candidates you do not already have', () => {
  const pinned = ['Outfit', 'SUSE', 'SUSE Mono', 'Overpass', 'Overpass Mono', 'JetBrains Mono', 'Ubuntu', 'Ubuntu Mono'];
  // The starter's own faces are already serving roles, so they are not offered.
  assert.deepEqual(pinnedFaces(pinned, ['SUSE', 'SUSE Mono']),
    ['Outfit', 'Overpass', 'Overpass Mono', 'JetBrains Mono', 'Ubuntu', 'Ubuntu Mono']);
  // Six is the row, and the stage's own cap.
  assert.equal(pinnedFaces(pinned).length, 6);
  // Case and spacing are not a second chip, and neither is a repeat in the list.
  assert.deepEqual(pinnedFaces(['Inter', ' inter ', 'Lora'], [' INTER ']), ['Lora']);
  assert.deepEqual(pinnedFaces(['Inter', 'Inter', 'Lora']), ['Inter', 'Lora']);
  assert.deepEqual(pinnedFaces([], ['Inter']), []);
});

test('the stage follows the card that opened it, and no card when nothing did', () => {
  const roles = ['brand', 'display', 'mono', 'italic'];
  assert.equal(stageAfterIndex(roles, 'brand'), 0);
  assert.equal(stageAfterIndex(roles, 'italic'), 3);
  // The Fonts panel's "Add a face" belongs to no card: back to its own seat.
  assert.equal(stageAfterIndex(roles, null), -1);
  assert.equal(stageAfterIndex(roles, 'nonsense'), -1);
});

test('a Google card can state the axis the family spec declared, once it is ready', () => {
  const loading = applyCardEvent(card({ state: 'loading', chips: [] }), { type: 'start' });
  const ready = applyCardEvent({ ...loading, state: 'loading' }, {
    type: 'ready', chips: ['Variable weight 100–900'],
  });
  assert.equal(ready.state, 'ready');
  assert.deepEqual(ready.chips, ['Variable weight 100–900']);
  // A card's own chips are never replaced by the fetch's.
  const kept = applyCardEvent(card({ state: 'loading', chips: ['SUBSET'] }), {
    type: 'ready', chips: ['Variable weight 100–900'],
  });
  assert.deepEqual(kept.chips, ['SUBSET', 'Variable weight 100–900']);
  // No chips is no change at all.
  assert.deepEqual(applyCardEvent(card({ state: 'loading', chips: ['SUBSET'] }), { type: 'ready' }).chips,
    ['SUBSET']);
});
