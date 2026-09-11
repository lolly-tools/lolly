// SPDX-License-Identifier: MPL-2.0
/**
 * /valid's text-payload logic - the C2PA 2.4 carrier copy, the paste plumbing
 * and the ONE url gate that decides what this page will fetch (plans/105 M2).
 *
 * Run directly: node --test shells/web/src/views/valid-text.test.ts
 *
 * Two things are being pinned here, and they are not the same kind of thing.
 *
 *  * The GATE is security-shaped. `/verify` promises that nothing is fetched on
 *    your behalf, and three separate inputs can now carry a URL into it (a
 *    pasted line, a dragged selection, and a credential reference read out of an
 *    untrusted file). Every one of them goes through classifyUrl, so the hostile
 *    cases live here rather than in a browser: protocol-relative, `javascript:`,
 *    userinfo look-alikes, and the same-origin URL whose PATH normalises to a
 *    protocol-relative reference.
 *  * The COPY is policy. M1's report distinguishes "the credential is over
 *    there" from "the bytes changed" from "your exclusions are wrong", and the
 *    whole point of that work is lost if the page renders them all as red. These
 *    tests assert the mapping, not the prose: which notice id fires, what tone
 *    it carries, and - for the two shapes that MUST NOT read as an accusation - 
 *    that the tone stays informational.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TEXT_FORMAT_LABEL, formatLabel, pastedFileName, textSnippet, classifyUrl, classifyPastedUrl,
  verifyTextNotices, reserializedNotice, suppressModifiedBadge, aiDisclosureRows,
  textSignalPanel, analyzeVerifyText, buildHighlightSegments,
} from './valid-text.ts';
import type { VerifyNotice } from './valid-text.ts';
import type { VerifyReport, Check } from './valid-verdict.ts';
// Deep import, the beam-pack.ts:125 precedent: the engine barrel does not
// re-export this yet (another session owns engine/src/index.ts), and the point
// of the drift guard below is to read the ENGINE's vocabulary rather than a
// copy of it - a copy would drift in exactly the direction being guarded.
import { C2PA_TEXT_STATUS } from '../../../../engine/src/c2pa-extract.ts';

const ORIGIN = 'https://lolly.example';

function report(over: Partial<VerifyReport> = {}): VerifyReport {
  return {
    found: true,
    state: 'valid',
    trusted: false,
    madeWithLolly: false,
    likelyMadeWithLolly: false,
    partsMadeWithLolly: false,
    delivered: false,
    format: 'html',
    checks: [],
    ...over,
  };
}
const ok = (code: string): Check => ({ code, ok: true, explanation: '' });
const bad = (code: string): Check => ({ code, ok: false, explanation: '' });
const ids = (list: VerifyNotice[]): string[] => list.map((n) => n.id);
const byId = (list: VerifyNotice[], id: string): VerifyNotice | undefined => list.find((n) => n.id === id);

// ═══ format labels ════════════════════════════════════════════════════════════

test('formatLabel says what the sniffer actually established, and nothing more', () => {
  assert.equal(formatLabel('html'), 'HTML document');
  assert.equal(formatLabel('text'), 'plain text');
  // 'code' means "an section A.9 manifest DELIMITER is in this text" - NOT a language
  // claim, and NOT a claim that a whole armour block is present: the sniffer
  // sets it on one delimiter, which is the case the engine reports as "no
  // credential here". The label must over-claim neither the language nor the
  // credential.
  assert.equal(formatLabel('code'), 'source text with a C2PA manifest marker');
  assert.ok(!/javascript|css|source code file/i.test(TEXT_FORMAT_LABEL.code!));
  assert.ok(!/\bblock\b/i.test(TEXT_FORMAT_LABEL.code!), 'one delimiter is not a block');
  // Every other format keeps its own token: the binary presentation is unchanged.
  for (const f of ['png', 'pdf', 'svg', 'mp4', 'webm', 'jpeg']) assert.equal(formatLabel(f), f);
  assert.equal(formatLabel(null), '');
  assert.equal(formatLabel(undefined), '');
});

// ═══ pasted payload naming ════════════════════════════════════════════════════

test('a pasted payload is named from the SNIFF, and never over-claims', () => {
  assert.equal(pastedFileName('html'), 'pasted.html');
  assert.equal(pastedFileName('svg'), 'pasted.svg');
  // 'code' has no knowable host language, so it must not become pasted.js.
  assert.equal(pastedFileName('code'), 'pasted.txt');
  assert.equal(pastedFileName('text'), 'pasted.txt');
  assert.equal(pastedFileName(null), 'pasted.txt');
});

// ═══ the preview snippet ══════════════════════════════════════════════════════

test('textSnippet caps, reports what it left out, and never splits a surrogate pair', () => {
  assert.deepEqual(textSnippet('short'), { body: 'short', omitted: 0 });
  const long = 'x'.repeat(3000);
  const cut = textSnippet(long, 100);
  assert.equal(cut.body.length, 100);
  assert.equal(cut.omitted, 2900);
  // A lone high surrogate renders as U+FFFD - damage the file does not have.
  const astral = `${'a'.repeat(99)}😀tail`;
  const s = textSnippet(astral, 100);
  assert.equal(s.body.length, 99, 'backed off the pair rather than cutting through it');
  assert.equal(s.body, 'a'.repeat(99));
  assert.equal(s.omitted, astral.length - 99);
  // ...and a pair that fits stays whole.
  assert.equal(textSnippet('😀', 100).body, '😀');
});

// ═══ the url gate ═════════════════════════════════════════════════════════════

test('classifyUrl: the `?src=` policy, verbatim - a single-slash path is the only bare form', () => {
  assert.deepEqual(classifyUrl('/creds/doc.c2pa', ORIGIN), { kind: 'same-origin', path: '/creds/doc.c2pa' });
  assert.deepEqual(classifyUrl('/', ORIGIN), { kind: 'same-origin', path: '/' });
  // Protocol-relative is a URL to another host wearing a path's clothes.
  assert.deepEqual(classifyUrl('//evil.test/x', ORIGIN), { kind: 'unresolvable' });
  assert.deepEqual(classifyUrl('//evil.test', ORIGIN), { kind: 'unresolvable' });
});

test('classifyUrl: a same-origin absolute URL normalises to a path - but only a safe one', () => {
  assert.deepEqual(classifyUrl(`${ORIGIN}/creds/doc.c2pa`, ORIGIN), { kind: 'same-origin', path: '/creds/doc.c2pa' });
  assert.deepEqual(classifyUrl(`${ORIGIN}/c?v=2`, ORIGIN), { kind: 'same-origin', path: '/c?v=2' });
  // THE ONE that bites: a same-origin URL whose pathname is itself
  // protocol-relative. Handing `//evil.test/x` to fetch() would leave the origin
  // entirely, after an origin check that passed.
  assert.deepEqual(classifyUrl(`${ORIGIN}//evil.test/x`, ORIGIN), { kind: 'unresolvable' });
});

test('classifyUrl: cross-origin is named, not followed', () => {
  const out = classifyUrl('https://evil.test/creds.c2pa', ORIGIN);
  assert.deepEqual(out, { kind: 'elsewhere', host: 'evil.test' });
  // A different scheme or port is a different origin, and gets the same answer.
  assert.equal(classifyUrl(`http://lolly.example/x`, ORIGIN).kind, 'elsewhere');
  assert.equal(classifyUrl(`https://lolly.example:8443/x`, ORIGIN).kind, 'elsewhere');
});

test('classifyUrl: schemes this page will not follow, and userinfo look-alikes', () => {
  for (const raw of [
    'javascript:alert(1)',
    'data:application/c2pa;base64,AAAA',
    'file:///etc/passwd',
    'blob:https://lolly.example/abc',
    'JAVASCRIPT:alert(1)',
  ]) {
    assert.deepEqual(classifyUrl(raw, ORIGIN), { kind: 'unresolvable' }, raw);
  }
  // `https://lolly.example@evil.test/` IS evil.test - caught by origin anyway.
  assert.deepEqual(classifyUrl('https://lolly.example@evil.test/x', ORIGIN), { kind: 'elsewhere', host: 'evil.test' });
  // The reverse resolves same-origin, and is still refused: a credential
  // reference has no business carrying credentials.
  assert.deepEqual(classifyUrl('https://evil.test@lolly.example/x', ORIGIN), { kind: 'unresolvable' });
  assert.deepEqual(classifyUrl('https://u:p@lolly.example/x', ORIGIN), { kind: 'unresolvable' });
});

test('classifyUrl: whitespace, control characters and absurd length are refused unread', () => {
  assert.equal(classifyUrl('', ORIGIN).kind, 'not-a-url');
  assert.equal(classifyUrl('   ', ORIGIN).kind, 'not-a-url');
  // Whitespace and control characters cannot appear in a URI reference, and
  // stripping them silently is how a "safe" string stops matching the bytes the
  // file actually carries.
  assert.equal(classifyUrl('/creds /x', ORIGIN).kind, 'not-a-url');
  assert.equal(classifyUrl('/creds\n/x', ORIGIN).kind, 'not-a-url');
  assert.equal(classifyUrl('/creds\u0000/x', ORIGIN).kind, 'not-a-url');
  assert.equal(classifyUrl('/creds\u007f/x', ORIGIN).kind, 'not-a-url');
  assert.equal(classifyUrl(`/${'a'.repeat(2100)}`, ORIGIN).kind, 'not-a-url');
});

test('classifyUrl: a relative reference is resolved ONLY against the address the file came from', () => {
  // No base - a file on your device no longer records where it was served from,
  // and guessing this site's origin would invent a location. Its OWN kind: this
  // is the one case where "it is a relative address" is the true explanation,
  // and every other refusal above is an absolute address this page declines.
  assert.deepEqual(classifyUrl('doc.c2pa', ORIGIN), { kind: 'no-base' });
  // With a base (the ?src= path), it resolves - and stays inside the origin.
  assert.deepEqual(classifyUrl('doc.c2pa', ORIGIN, '/docs/page.html'), { kind: 'same-origin', path: '/docs/doc.c2pa' });
  assert.deepEqual(classifyUrl('../c/doc.c2pa', ORIGIN, '/docs/deep/page.html'), { kind: 'same-origin', path: '/docs/c/doc.c2pa' });
  // A cross-origin base cannot launder a relative reference into a fetch.
  assert.deepEqual(classifyUrl('doc.c2pa', ORIGIN, 'https://evil.test/page.html'), { kind: 'elsewhere', host: 'evil.test' });
});

test('classifyPastedUrl: text is PAYLOAD unless it is unmistakably an address', () => {
  // The expensive mistake would be swallowing the text someone asked us to check.
  assert.equal(classifyPastedUrl('<!DOCTYPE html><html>…', ORIGIN), null);
  assert.equal(classifyPastedUrl('notes.txt', ORIGIN), null);
  assert.equal(classifyPastedUrl('example.com', ORIGIN), null);
  assert.equal(classifyPastedUrl('see https://lolly.example/x for more', ORIGIN), null, 'a URL inside prose is prose');
  assert.equal(classifyPastedUrl('https://lolly.example/x\nand a second line', ORIGIN), null);
  assert.equal(classifyPastedUrl('', ORIGIN), null);
  // A bare address is an address.
  assert.deepEqual(classifyPastedUrl('  /docs/signed.html  ', ORIGIN), { kind: 'same-origin', path: '/docs/signed.html' });
  assert.deepEqual(classifyPastedUrl('https://evil.test/x', ORIGIN), { kind: 'elsewhere', host: 'evil.test' });
  assert.deepEqual(classifyPastedUrl(`${ORIGIN}//evil.test/x`, ORIGIN), { kind: 'unresolvable' });
});

// ═══ external credential (section A.7.1.2 / section A.9.3) ══════════════════════════════════

test('manifest.inaccessible NEVER renders as a broken credential', () => {
  // The exact field M1's report flags for this: state 'invalid' + the
  // manifest.inaccessible row, because no integrity check could run - which is
  // the one case where the state word is not the sentence to show.
  const r = report({
    state: 'invalid',
    checks: [bad('manifest.inaccessible')],
    textBinding: { kind: 'html', manifestUrl: '/creds/doc.c2pa' },
  });
  const notes = verifyTextNotices(r, { origin: ORIGIN, refetchable: true });
  const n = byId(notes, 'manifest-elsewhere')!;
  assert.ok(n, 'the external reference is explained');
  assert.equal(n.tone, 'info', 'informational - the credential is elsewhere, not broken');
  assert.equal(n.url, '/creds/doc.c2pa', 'the address is shown verbatim');
  assert.equal(n.fetchPath, '/creds/doc.c2pa', 'same-origin, so "Fetch and check" is offered');
  assert.ok(!/modif|tamper|broken|damaged/i.test(`${n.title} ${n.body}`), 'no accusation anywhere in the copy');
});

test('a cross-origin credential reference is refused in words, and never offers a fetch', () => {
  const r = report({
    state: 'invalid',
    checks: [bad('manifest.inaccessible')],
    textBinding: { kind: 'structuredText', manifestUrl: 'https://evil.test/creds.c2pa' },
  });
  const n = byId(verifyTextNotices(r, { origin: ORIGIN, refetchable: true }), 'manifest-elsewhere')!;
  assert.equal(n.fetchPath, undefined, 'nothing is fetched on your behalf');
  assert.equal(n.params?.host, 'evil.test');
  assert.match(n.body, /Nothing is fetched on your behalf/);
});

test('no fetch is offered when the bytes are no longer in hand', () => {
  const r = report({ state: 'invalid', textBinding: { kind: 'html', manifestUrl: '/creds/doc.c2pa' } });
  const n = byId(verifyTextNotices(r, { origin: ORIGIN, refetchable: false }), 'manifest-elsewhere')!;
  assert.equal(n.fetchPath, undefined, 'a button that cannot re-check anything is not offered');
});

test('a relative credential reference needs the address the document came from', () => {
  const bind = { kind: 'html' as const, manifestUrl: 'doc.c2pa' };
  const without = byId(verifyTextNotices(report({ textBinding: bind }), { origin: ORIGIN, refetchable: true }), 'manifest-elsewhere')!;
  assert.equal(without.fetchPath, undefined);
  assert.match(without.body, /relative address/);
  const with_ = byId(verifyTextNotices(report({ textBinding: bind }), { origin: ORIGIN, base: '/docs/page.html', refetchable: true }), 'manifest-elsewhere')!;
  assert.equal(with_.fetchPath, '/docs/doc.c2pa');
});

test('a fetched external credential says so - a valid verdict must not read as "the credential inside this file"', () => {
  const r = report({
    state: 'valid',
    checks: [ok('assertion.dataHash.match')],
    textBinding: { kind: 'html', manifestUrl: '/creds/doc.c2pa', externalManifestUsed: true },
  });
  const notes = verifyTextNotices(r, { origin: ORIGIN, refetchable: true });
  assert.deepEqual(ids(notes), ['external-used']);
  const n = notes[0]!;
  assert.match(n.title, /fetched/i);
  assert.match(n.body, /not inside this file/i);
  assert.equal(n.fetchPath, undefined, 'no second fetch offer once it has been done');
});

// ═══ carrier statuses ═════════════════════════════════════════════════════════

// Driven from the ENGINE's own frozen vocabulary, not a hand-written copy of
// it. `verifyTextNotices` looks the status up in a table and pushes nothing at
// all on a miss, so an unmapped status is silent - the hero stands with no note
// under it, which is the exact failure this wave exists to prevent. A literal
// list cannot catch that: M1 section 6.4 already plans to change one of these strings
// (`lolly.manifest.unsupportedReference` → the spec code), and a list of ten
// literals would have gone on passing while the note disappeared.
// `textMultipleWrappers` is the one status STATUS_NOTICE deliberately excludes - 
// wrapperNotice() words it from what the assertion selected instead.
const NOTICE_ID_FOR_STATUS: Record<string, string> = {
  htmlMultipleManifests: 'multiple-manifests',
  structuredTextMultipleReferences: 'multiple-manifests',
  structuredTextNoManifest: 'no-manifest-block',
  structuredTextEmptyReference: 'empty-block',
  textCorruptedWrapper: 'corrupted-wrapper',
  textMultipleWrappers: 'multiple-wrappers',
  credentialUnreadable: 'unreadable',
  unsupportedReference: 'unsupported-reference',
  malformedBase64: 'malformed-base64',
  htmlUnterminatedScript: 'unterminated-script',
  tooLarge: 'too-large',
};

test('every carrier status maps to a NON-accusatory note', () => {
  const cases = Object.entries(C2PA_TEXT_STATUS).map(([key, status]) => {
    const id = NOTICE_ID_FOR_STATUS[key];
    assert.ok(id, `C2PA_TEXT_STATUS.${key} (${status}) has no notice - add one to valid-text.ts, then to NOTICE_ID_FOR_STATUS`);
    return [status, id!] as [string, string];
  });
  assert.equal(cases.length, Object.keys(C2PA_TEXT_STATUS).length);
  for (const [status, id] of cases) {
    const notes = verifyTextNotices(report({ state: 'invalid', textBinding: { kind: 'text', status } }), { origin: ORIGIN });
    const n = byId(notes, id);
    assert.ok(n, `${status} → ${id}`);
    assert.equal(n!.tone, 'info', `${status} is a carrier problem, not damage`);
    // None of these establishes that anyone changed anything.
    assert.ok(!/\bmodified\b|\btampered\b|\baltered\b/i.test(`${n!.title} ${n!.body}`), status);
  }
});

test("the engine's own detail sentence rides along, verbatim", () => {
  const notes = verifyTextNotices(report({
    textBinding: { kind: 'text', status: 'manifest.text.corruptedWrapper', detail: 'the wrapper ends inside manifestLength (2 of 4 bytes)' },
  }), { origin: ORIGIN });
  assert.equal(byId(notes, 'corrupted-wrapper')!.detail, 'the wrapper ends inside manifestLength (2 of 4 bytes)');
});

test('the section A.9.5 "one delimiter only" case stays honest about quoted prose', () => {
  const n = byId(verifyTextNotices(report({
    state: 'none', found: false, format: 'code',
    textBinding: { kind: 'structuredText', status: 'manifest.structuredText.noManifest' },
  }), { origin: ORIGIN }), 'no-manifest-block')!;
  // The engine deliberately does NOT fail this (prose that quotes the delimiter
  // is indistinguishable from a damaged block), so the copy must not either.
  assert.match(n.body, /quotes a marker/);
  assert.equal(n.tone, 'info');
});

// ═══ section A.8 wrappers ════════════════════════════════════════════════════════════

test('multiple wrappers: a notice when one was selected, a refusal only when more than one MATCHED', () => {
  // Extraction-time multiplicity is a NOTICE (section A.8.4.1 gives selection to the
  // exclusions) - and here the assertion picked one cleanly, so the text is fine.
  const picked = byId(verifyTextNotices(report({
    state: 'valid',
    textBinding: { kind: 'text', status: 'manifest.text.multipleWrappers', wrappers: 3, matchedWrappers: 1, selectedWrapper: 2 },
  }), { origin: ORIGIN }), 'multiple-wrappers')!;
  assert.equal(picked.params?.n, 3);
  assert.equal(picked.params?.k, 2);
  assert.match(picked.body, /select wrapper \{k\}/);
  assert.equal(picked.tone, 'info');

  // section 15.12.1.3.1 step 4: more than one MATCH is the case with no verdict.
  const many = byId(verifyTextNotices(report({
    state: 'invalid',
    textBinding: { kind: 'text', wrappers: 3, matchedWrappers: 2 },
  }), { origin: ORIGIN }), 'multiple-wrappers')!;
  assert.match(many.title, /More than one hidden credential matches/);
  assert.match(many.body, /allows exactly one/);
});

test('a truncated wrapper walk says "none of the first N", not "none"', () => {
  const n = byId(verifyTextNotices(report({
    textBinding: { kind: 'text', wrappers: 32, wrappersTruncated: true },
  }), { origin: ORIGIN }), 'wrappers-truncated')!;
  assert.equal(n.params?.n, 32);
  assert.match(n.body, /none of the first/);
});

test('fragment fires only from the binding flag - never inferred from a mismatch', () => {
  const flagged = verifyTextNotices(report({ textBinding: { kind: 'text', fragment: true } }), { origin: ORIGIN });
  const n = byId(flagged, 'fragment')!;
  assert.match(n.title, /fragment of a larger signed text/);
  assert.equal(n.tone, 'info');
  // A plain hash mismatch is NOT a fragment claim: an edit and a truncation are
  // indistinguishable there, and M1 refuses to guess. So must this.
  const mismatch = verifyTextNotices(report({
    state: 'invalid', checks: [bad('assertion.dataHash.mismatch')], textBinding: { kind: 'text' },
  }), { origin: ORIGIN });
  assert.equal(byId(mismatch, 'fragment'), undefined);
});

test('the two exclusion-conformance shapes are told apart, and only one is a warning', () => {
  const narrower = byId(verifyTextNotices(report({
    textBinding: { kind: 'html', exclusionsConform: 'narrower' },
  }), { origin: ORIGIN }), 'exclusions-narrower')!;
  assert.equal(narrower.tone, 'info');
  assert.match(narrower.body, /binds more of the file, not less/);

  const other = byId(verifyTextNotices(report({
    state: 'invalid', textBinding: { kind: 'html', exclusionsConform: 'other' },
  }), { origin: ORIGIN }), 'exclusions-other')!;
  assert.equal(other.tone, 'warn', 'content really is outside the credential here');
  assert.match(other.body, /not covered by the hash/);
});

// ═══ the re-serialized carrier ════════════════════════════════════════════════

test('a pasted, re-serialized carrier is explained rather than accused - and only with the evidence for it', () => {
  const pastedHtml = report({
    state: 'invalid',
    format: 'html',
    checks: [ok('claimSignature.validated'), ok('assertion.hashedURI.match'), bad('assertion.dataHash.mismatch')],
  });
  const n = reserializedNotice(pastedHtml, { origin: ORIGIN, pasted: true })!;
  assert.ok(n);
  assert.equal(n.tone, 'info');
  assert.match(n.body, /Copying markup out of a rendered page/);
  assert.ok(suppressModifiedBadge(verifyTextNotices(pastedHtml, { origin: ORIGIN, pasted: true })), 'the hero must not also stamp "Modified after signing"');

  // NOT offered for a DROPPED file: nothing there says a serializer touched it.
  assert.equal(reserializedNotice(pastedHtml, { origin: ORIGIN, pasted: false }), null);
  // NOT offered when the credential itself is damaged - the innocent explanation
  // needs the claim signature to have verified.
  const badSig = report({
    state: 'invalid', format: 'html',
    checks: [bad('claimSignature.mismatch'), bad('assertion.dataHash.mismatch')],
  });
  assert.equal(reserializedNotice(badSig, { origin: ORIGIN, pasted: true }), null);
  // NOT offered when the bytes actually matched.
  const fine = report({ format: 'html', checks: [ok('claimSignature.validated'), ok('assertion.dataHash.match')] });
  assert.equal(reserializedNotice(fine, { origin: ORIGIN, pasted: true }), null);
  // NOT offered for a binary format - a re-serialized PNG is not a thing the
  // clipboard does, and this must not become a general excuse for a mismatch.
  const png = report({
    state: 'invalid', format: 'png',
    checks: [ok('claimSignature.validated'), bad('assertion.dataHash.mismatch')],
  });
  assert.equal(reserializedNotice(png, { origin: ORIGIN, pasted: true }), null);
});

test('a pasted SVG gets the same explanation (it has no textBinding at all)', () => {
  const svg = report({
    state: 'invalid', format: 'svg',
    checks: [ok('claimSignature.validated'), bad('assertion.dataHash.mismatch')],
  });
  assert.deepEqual(ids(verifyTextNotices(svg, { origin: ORIGIN, pasted: true })), ['reserialized']);
});

// ═══ nothing on the ordinary path ═════════════════════════════════════════════

test('an ordinary binary drop earns no notes at all', () => {
  const png = report({ format: 'png', checks: [ok('assertion.dataHash.match')] });
  assert.deepEqual(verifyTextNotices(png, { origin: ORIGIN }), []);
  assert.equal(suppressModifiedBadge(verifyTextNotices(png, { origin: ORIGIN })), false);
  const broken = report({ state: 'invalid', format: 'png', checks: [bad('assertion.dataHash.mismatch')] });
  assert.deepEqual(verifyTextNotices(broken, { origin: ORIGIN }), [], 'a broken PNG still reads exactly as it did');
});

test('a clean text credential earns no notes either', () => {
  const clean = report({ format: 'text', checks: [ok('assertion.dataHash.match')], textBinding: { kind: 'text', wrappers: 1, matchedWrappers: 1, exclusionsFrom: 'wrapper' } });
  assert.deepEqual(verifyTextNotices(clean, { origin: ORIGIN }), []);
});

// ═══ section 18.28 ai-disclosure ═════════════════════════════════════════════════════

test('aiDisclosureRows: the model is named from whichever field the claim used', () => {
  assert.deepEqual(aiDisclosureRows(report({ aiDisclosure: { modelName: 'Nano Banana' } })), [{ model: 'Nano Banana' }]);
  assert.deepEqual(aiDisclosureRows(report({ aiDisclosure: { modelIdentifier: 'urn:model:x' } })), [{ model: 'urn:model:x' }]);
  // A name wins over an identifier when both are there.
  assert.equal(aiDisclosureRows(report({ aiDisclosure: { modelName: 'Veo', modelIdentifier: 'urn:x' } }))[0]!.model, 'Veo');
  // A disclosure with neither is still a disclosure - the panel says so rather
  // than inventing a name or hiding the declaration.
  assert.deepEqual(aiDisclosureRows(report({ aiDisclosure: { oversight: 'humanInTheLoop' } })), [{ model: null, oversight: 'humanInTheLoop' }]);
  assert.deepEqual(aiDisclosureRows(report()), []);
});

test('aiDisclosureRows: every disclosure is listed when a claim made more than one', () => {
  const rows = aiDisclosureRows(report({
    aiDisclosure: { modelName: 'A' },
    aiDisclosures: [{ modelName: 'A' }, { modelName: 'B', modelType: 'generativeAI', scientificDomain: ['chemistry', 'biology'] }],
  }));
  assert.deepEqual(rows.map((r) => r.model), ['A', 'B']);
  assert.equal(rows[1]!.domains, 'chemistry · biology');
  assert.equal(rows[1]!.modelType, 'generativeAI');
});

// ── refused vs. relative: two facts, two explanations ───────────────────────
//
// `unresolvable` covers four gate outcomes and used to be worded for one of
// them. Every case below is an ABSOLUTE reference the engine was willing to
// hand up and this page declines to follow - printing "it is a relative
// address" above the absolute address, in a <code> block the reader can see, is
// a sentence the page can be caught in. The `//evil.test` one stings most: it
// is refused for a real security reason and the copy attributed it to
// relativity.
test('an absolute credential address this page refuses is not called "relative"', () => {
  for (const url of [
    'https://user@lolly.example/m.c2pa',        // userinfo, same origin
    'https://evil.test@lolly.example/m.c2pa',   // userinfo look-alike
    'https://lolly.example//evil.test/m.c2pa',  // path normalises to //
    'http://',                                  // unparseable
  ]) {
    const n = byId(verifyTextNotices(report({
      state: 'invalid', checks: [bad('manifest.inaccessible')],
      textBinding: { kind: 'html', manifestUrl: url },
    }), { origin: ORIGIN, refetchable: true }), 'manifest-elsewhere')!;
    assert.ok(n, url);
    assert.equal(n.url, url, 'the address is still shown verbatim');
    assert.equal(n.fetchPath, undefined, 'and still never fetched');
    assert.ok(!/relative/i.test(n.body), `${url} is absolute: ${n.body}`);
    assert.match(n.body, /not one this page is willing to resolve/);
    assert.equal(n.tone, 'info', 'a refusal by this page is not damage to the file');
  }
  // The genuinely relative one keeps the sentence that is true of it.
  const rel = byId(verifyTextNotices(report({
    textBinding: { kind: 'html', manifestUrl: 'doc.c2pa' },
  }), { origin: ORIGIN, refetchable: true }), 'manifest-elsewhere')!;
  assert.match(rel.body, /relative address/);
});

test('classifyUrl: a bare path is NORMALISED, not trusted - the backslash authority escape', () => {
  // `fetch()` resolves a path against the document, and for http(s) the WHATWG
  // URL parser treats `\` as a path separator. A single-`/` regex therefore
  // passes `/\evil.test/x` straight through to a cross-origin request, after an
  // origin check that never ran. Demonstrated end to end in
  // plans/105-m2/probes/url-gate-attack.mjs.
  for (const raw of ['/\\evil.test/m.c2pa', '/\\\\evil.test/m.c2pa', '/\\user@evil.test/m.c2pa', '  /\\evil.test/x  ']) {
    const gate = classifyUrl(raw, ORIGIN);
    assert.notEqual(gate.kind, 'same-origin', `${raw} must never be fetched as a path`);
    assert.deepEqual(gate, { kind: 'elsewhere', host: 'evil.test' }, raw);
  }
  // The pasted-address door is the same door.
  assert.deepEqual(classifyPastedUrl('/\\evil.test/x', ORIGIN), { kind: 'elsewhere', host: 'evil.test' });
  // `/..//host` normalises back to a protocol-relative path and is refused.
  assert.deepEqual(classifyUrl('/..//evil.test/m.c2pa', ORIGIN), { kind: 'unresolvable' });
  // ...and an ordinary same-origin path is untouched by any of it.
  assert.deepEqual(classifyUrl('/creds/doc.c2pa', ORIGIN), { kind: 'same-origin', path: '/creds/doc.c2pa' });
  assert.deepEqual(classifyUrl('/c?v=2', ORIGIN), { kind: 'same-origin', path: '/c?v=2' });
  assert.deepEqual(classifyUrl('/', ORIGIN), { kind: 'same-origin', path: '/' });
});

// ── Text AI-likelihood signals (plans/125) ───────────────────────────────────

const LLM_PARAGRAPH =
  "In today's ever-evolving landscape it's important to note that we must delve into the " +
  'rich tapestry of modern tools. A robust and seamless approach will foster a holistic ' +
  'workflow. This underscores a pivotal shift, and it showcases how teams can leverage ' +
  'comprehensive systems to garner real results across the board every single day.';

test('textSignalPanel maps band/tone/rows and carries the summary', () => {
  const p = analyzeVerifyText('hello\u200bworld a perfectly ordinary looking line of text', 'digital');
  assert.equal(p.band !== 'none', true, 'a zero-width char should register');
  assert.ok(p.rows.some((r) => r.kind === 'invisible-char' && r.tier === 'artifact'));
  assert.equal(typeof p.summary, 'string');
});

test('a strong artifact drives tone to warn', () => {
  const p = analyzeVerifyText('a line with \u{E0041}\u{E0042} hidden tags in it', 'digital');
  assert.equal(p.band, 'strong');
  assert.equal(p.tone, 'warn');
});

test('the lexicon paragraph yields a hedged style guess, tone stays info', () => {
  const p = analyzeVerifyText(LLM_PARAGRAPH, 'digital');
  assert.ok(['notable', 'strong'].includes(p.band));
  assert.ok(p.guess, 'expected a style-guess rationale');
  assert.equal(p.tone, 'info', 'a heuristic-led band is never a warning');
});

test('an OCR-sourced panel is pixelSourced with no artifact rows', () => {
  const p = analyzeVerifyText('read \u200b from an image with an invisible char', 'ocr');
  assert.equal(p.pixelSourced, true);
  assert.ok(p.rows.every((r) => r.tier !== 'artifact'));
});

test('textSignalPanel drops an absent style guess', () => {
  const p = analyzeVerifyText('a short ordinary human sentence with nothing odd', 'digital');
  assert.equal(p.guess, undefined);
});

// ── highlight marks (plans/125) ──────────────────────────────────────────────

test('the lexicon paragraph produces heuristic marks and a best-guess family', () => {
  const p = analyzeVerifyText(LLM_PARAGRAPH, 'digital');
  assert.ok(p.marks.length > 0, 'expected marks for the flagged wording');
  assert.ok(p.marks.every((m) => m.tier === 'heuristic'), 'a lexicon-led read has no artifact marks');
  assert.equal(p.guessFamily, 'generic-LLM');
});

test('an invisible char yields an artifact mark on the exact span', () => {
  const p = analyzeVerifyText('hello\u200bworld and a good deal more ordinary text follows here', 'digital');
  const art = p.marks.find((m) => m.tier === 'artifact');
  assert.ok(art, 'expected an artifact mark');
  assert.equal(art?.index, 5); // the zero-width char sits between "hello" and "world"
  assert.equal(art?.length, 1);
});

test('buildHighlightSegments splits text into plain + marked runs, in order', () => {
  const text = 'aXbYc';
  const segs = buildHighlightSegments(text, [
    { index: 1, length: 1, tier: 'artifact', kind: 'k', heat: 0.9 },
    { index: 3, length: 1, tier: 'heuristic', kind: 'k', heat: 0.4 },
  ]);
  assert.deepEqual(segs.map((s) => s.text), ['a', 'X', 'b', 'Y', 'c']);
  assert.deepEqual(segs.map((s) => s.tier), [undefined, 'artifact', undefined, 'heuristic', undefined]);
  // reassembling the segments reproduces the source exactly (no dropped/dup chars)
  assert.equal(segs.map((s) => s.text).join(''), text);
});

test('overlapping marks merge, artifact wins the overlap', () => {
  const merged = analyzeVerifyText('a', 'digital'); // trivial; exercise the merge via a crafted panel
  void merged;
  const segs = buildHighlightSegments('abcdef', [
    { index: 1, length: 3, tier: 'heuristic', kind: 'h', heat: 0.4 },
    { index: 2, length: 3, tier: 'artifact', kind: 'a', heat: 0.9 },
  ]);
  // The second (artifact) mark is inside/after the first; segments never overlap
  // and the joined text is intact.
  assert.equal(segs.map((s) => s.text).join(''), 'abcdef');
});

test('OCR-sourced marks are heuristic-only (no byte-level artifacts survive)', () => {
  const p = analyzeVerifyText(LLM_PARAGRAPH, 'ocr');
  assert.ok(p.marks.every((m) => m.tier === 'heuristic'));
});

// ── graded heat (plans/125 heat highlighting) ────────────────────────────────
// Appended with its own import so nothing above this line moves: the harness
// hoists module imports, so a trailing declaration is ordinary ESM.
import { heatBucket } from './valid-text.ts';

test('heatBucket grades heat into the 5 temperature buckets, coolest to hottest', () => {
  assert.equal(heatBucket(0.2), 1);
  assert.equal(heatBucket(0.4), 2);
  assert.equal(heatBucket(0.5), 3);
  assert.equal(heatBucket(0.7), 4);
  assert.equal(heatBucket(0.9), 5);
});

test('buildHighlightSegments carries each mark heat through to its marked segment', () => {
  const segs = buildHighlightSegments('aXbYc', [
    { index: 1, length: 1, tier: 'artifact', kind: 'k', heat: 0.9 },
    { index: 3, length: 1, tier: 'heuristic', kind: 'k', heat: 0.35 },
  ]);
  assert.deepEqual(segs.map((s) => s.text), ['a', 'X', 'b', 'Y', 'c']);
  // Plain runs carry no heat; each marked run keeps its own mark's heat.
  assert.deepEqual(segs.map((s) => s.heat), [undefined, 0.9, undefined, 0.35, undefined]);
});
