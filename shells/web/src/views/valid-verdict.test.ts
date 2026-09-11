// SPDX-License-Identifier: MPL-2.0
/**
 * /valid's pure verdict/scorecard logic - resolveState/stateTone/isExpiredOnly/
 * scorecardModel had zero coverage (they live in valid.ts, a 2,200+-line view with a
 * top-level CSS import that made it unloadable outside a bundler). Extracted to
 * valid-verdict.ts so it's importable standalone; these are the first tests for it.
 *
 * Run directly: node --test shells/web/src/views/valid-verdict.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveState, stateTone, isExpiredOnly, scorecardModel, STATE_COPY,
  sourceTypeLabel, SOURCE_TYPE_LABEL, INGEST_SOURCE_TYPE_LABEL,
  hashFailed, hasHashVerdict, isCarrierOnly, isExclusionsOnly,
  type VerifyReport, type Check, type Watermark,
} from './valid-verdict.ts';

// A minimal, otherwise-clean report - callers override just the fields under test.
function baseReport(over: Partial<VerifyReport> = {}): VerifyReport {
  return {
    found: true,
    state: 'valid',
    trusted: false,
    madeWithLolly: false,
    likelyMadeWithLolly: false,
    partsMadeWithLolly: false,
    delivered: false,
    format: 'image/png',
    checks: [],
    ...over,
  };
}
const check = (code: string, ok: boolean): Check => ({ code, ok, explanation: code });

// ── isExpiredOnly ────────────────────────────────────────────────────────────

test('isExpiredOnly: true only when cert expiry is the SOLE non-untrusted failure', () => {
  assert.equal(isExpiredOnly(baseReport({ checks: [
    check('signingCredential.untrusted', false),
    check('signingCredential.expired', false),
  ] })), true, 'untrusted is always-present noise, not a real failure');

  assert.equal(isExpiredOnly(baseReport({ checks: [
    check('signingCredential.expired', false),
    check('assertion.dataHash.mismatch', false),
  ] })), false, 'a second real failure disqualifies it');

  assert.equal(isExpiredOnly(baseReport({ checks: [] })), false, 'zero failures is not "expired-only"');
  assert.equal(isExpiredOnly(baseReport({ checks: [check('assertion.dataHash.mismatch', false)] })), false);
});

// ── resolveState: priority order across the whole STATE_COPY ladder ─────────

test('resolveState: no credential → STATE_COPY.none, regardless of other flags', () => {
  const { state } = resolveState(baseReport({ found: false, state: 'none' }));
  assert.equal(state, STATE_COPY.none);
});

test('resolveState: intact + untrusted → STATE_COPY.valid (default, on-device key)', () => {
  const { state } = resolveState(baseReport({ state: 'valid', trusted: false }));
  assert.equal(state, STATE_COPY.valid);
});

test('resolveState: intact + CA-trusted chain → STATE_COPY.trusted', () => {
  const { state } = resolveState(baseReport({ state: 'valid', trusted: true }));
  assert.equal(state, STATE_COPY.trusted);
});

test('resolveState: trusted + delivered → STATE_COPY.delivered', () => {
  const { state } = resolveState(baseReport({ state: 'valid', trusted: true, delivered: true }));
  assert.equal(state, STATE_COPY.delivered);
});

test('resolveState: madeWithLolly outranks trusted AND delivered - the headline always wins', () => {
  const { state } = resolveState(baseReport({
    state: 'valid', trusted: true, delivered: true, madeWithLolly: true,
  }));
  assert.equal(state, STATE_COPY.lolly);
});

test('resolveState: broken credential + likelyMadeWithLolly → STATE_COPY.likelyLolly', () => {
  const { state } = resolveState(baseReport({ state: 'invalid', likelyMadeWithLolly: true }));
  assert.equal(state, STATE_COPY.likelyLolly);
});

test('resolveState: broken credential, expiry the only real failure → STATE_COPY.expired', () => {
  const { state } = resolveState(baseReport({
    state: 'invalid',
    checks: [check('signingCredential.untrusted', false), check('signingCredential.expired', false)],
  }));
  assert.equal(state, STATE_COPY.expired);
});

test('resolveState: broken credential, a real mismatch → STATE_COPY.invalid (defence in depth)', () => {
  // report.trusted true here must NOT win - an invalid file never outranks its own break,
  // whatever the (buggy, hypothetical) engine says about `trusted`.
  const { state } = resolveState(baseReport({
    state: 'invalid', trusted: true,
    checks: [check('assertion.dataHash.mismatch', false)],
  }));
  assert.equal(state, STATE_COPY.invalid);
});

test('resolveState: third-party CA root names the actual issuer/signer in `sub`, HTML-escaped', () => {
  const { state, sub } = resolveState(baseReport({
    state: 'valid', trusted: true,
    signer: {
      commonName: undefined, organization: '<Acme> & Co', notBefore: '', notAfter: '', selfSigned: false, alg: 'ES256',
      identity: { email: null, issuer: 'Google <Root> CA' },
    },
  }));
  assert.equal(state, STATE_COPY.trusted);
  assert.ok(sub.includes('Google &lt;Root&gt; CA'), 'issuer must be escaped, not raw HTML');
  assert.ok(sub.includes('&lt;Acme&gt; &amp; Co'), 'signer org must be escaped, not raw HTML');
  assert.ok(!sub.includes('the pinned Lolly CA root'), 'must not use the Lolly-specific default wording for a foreign anchor');
});

test('resolveState: Lolly-issued trusted chain keeps the Lolly-worded sub (no third-party override)', () => {
  const { sub } = resolveState(baseReport({
    state: 'valid', trusted: true,
    signer: { commonName: undefined, organization: undefined, notBefore: '', notAfter: '', selfSigned: false, alg: 'ES256', identity: { email: null, issuer: 'Lolly Root CA' } },
  }));
  assert.ok(sub.includes('the pinned Lolly CA root'));
});

// ── stateTone ────────────────────────────────────────────────────────────────

test('stateTone: maps each STATE_COPY tier to its badge tone', () => {
  assert.equal(stateTone(baseReport({ found: false, state: 'none' })), 'none');
  assert.equal(stateTone(baseReport({ state: 'valid' })), 'good');
  assert.equal(stateTone(baseReport({ state: 'valid', trusted: true })), 'good');
  assert.equal(stateTone(baseReport({ state: 'valid', madeWithLolly: true })), 'good');
  assert.equal(stateTone(baseReport({ state: 'invalid', likelyMadeWithLolly: true })), 'warn');
  assert.equal(stateTone(baseReport({
    state: 'invalid',
    checks: [check('signingCredential.untrusted', false), check('signingCredential.expired', false)],
  })), 'warn');
  assert.equal(stateTone(baseReport({ state: 'invalid', checks: [check('assertion.dataHash.mismatch', false)] })), 'bad');
});

// ── scorecardModel ─────────────────────────────────────────────────────────

test('scorecardModel: every pip is "na" on an empty/not-found report - nothing hard-codes a pass', () => {
  const pips = scorecardModel(baseReport({ found: false, checks: [] }));
  const byLabel = (label: string) => pips.find((p) => p.label === label);
  assert.equal(byLabel('Manifest found')!.status, 'na');
  assert.equal(byLabel('Manifest readable')!.status, 'na');
  assert.equal(byLabel('Assertions bound to the claim')!.status, 'na');
  assert.equal(byLabel('Claim signature valid')!.status, 'na');
  assert.equal(byLabel('Certificate within validity')!.status, 'na');
  assert.equal(byLabel('File bytes match (hard binding)')!.status, 'na');
});

test('scorecardModel: pip states derive from the actual check rows', () => {
  const report = baseReport({
    found: true,
    checks: [
      check('assertion.hashedURI.match', true),
      check('claimSignature.validated', true),
      check('claimSignature.insideValidity', true),
      check('assertion.dataHash.match', true),
      check('signingCredential.trusted', true),
    ],
  });
  const pips = scorecardModel(report);
  const byLabel = (label: string) => pips.find((p) => p.label === label)!;
  assert.equal(byLabel('Manifest readable').status, 'pass');
  assert.equal(byLabel('Assertions bound to the claim').status, 'pass');
  assert.equal(byLabel('Claim signature valid').status, 'pass');
  assert.equal(byLabel('Certificate within validity').status, 'pass');
  assert.equal(byLabel('File bytes match (hard binding)').status, 'pass');
  assert.equal(byLabel('Signer identity (CA-verified)').status, 'pass');
});

test('scorecardModel: a real failure reports "fail", not "na" - and the always-present untrusted marker never counts as one', () => {
  const report = baseReport({
    checks: [
      check('signingCredential.untrusted', false), // the designed posture, not damage
      check('assertion.dataHash.mismatch', false),
      check('claimSignature.mismatch', false),
    ],
  });
  const pips = scorecardModel(report);
  const byLabel = (label: string) => pips.find((p) => p.label === label)!;
  assert.equal(byLabel('File bytes match (hard binding)').status, 'fail');
  assert.equal(byLabel('Claim signature valid').status, 'fail');
});

test('scorecardModel: self-signed on-device key gets the ash "signed with an on-device key" pip, not a bare n/a identity row', () => {
  const report = baseReport({ signer: { commonName: undefined, organization: undefined, notBefore: '', notAfter: '', selfSigned: true, alg: 'ES256' } });
  const pip = scorecardModel(report).find((p) => p.label === 'Signed with an on-device key');
  assert.ok(pip, 'expected the ash on-device-key pip');
  assert.equal(pip!.status, 'na');
  assert.equal(pip!.hideStatus, true);
  assert.equal(pip!.ash, true);
});

test('scorecardModel: lollipop pip wording/status tracks made/likely/parts/none, and only "made" shows its status', () => {
  const made = scorecardModel(baseReport({ madeWithLolly: true })).find((p) => p.icon === 'lollipop')!;
  assert.equal(made.label, 'Made with Lolly');
  assert.equal(made.status, 'pass');
  assert.equal(made.hideStatus, false);

  const likely = scorecardModel(baseReport({ likelyMadeWithLolly: true })).find((p) => p.icon === 'lollipop')!;
  assert.equal(likely.label, 'Likely made with Lolly');
  assert.equal(likely.status, 'warn');
  assert.equal(likely.hideStatus, true);

  const parts = scorecardModel(baseReport({ partsMadeWithLolly: true })).find((p) => p.icon === 'lollipop')!;
  assert.equal(parts.label, 'Parts made with Lolly');
  assert.equal(parts.status, 'warn');

  const none = scorecardModel(baseReport()).find((p) => p.icon === 'lollipop')!;
  assert.equal(none.label, 'Not made with Lolly');
  assert.equal(none.status, 'na');
});

test('scorecardModel: a detected Lolly Imprint adds its own always-pass pip, absent otherwise', () => {
  const watermark: Watermark = { present: true, score: 0.9 };
  const withMark = scorecardModel(baseReport(), watermark);
  const pip = withMark.find((p) => p.icon === 'imprint');
  assert.ok(pip);
  assert.equal(pip!.status, 'pass');
  assert.equal(pip!.statusWord, 'detected');

  const embedded = scorecardModel(baseReport(), { present: true, score: 0.9, embedded: true })
    .find((p) => p.icon === 'imprint')!;
  assert.equal(embedded.statusWord, 'in an image');

  assert.equal(scorecardModel(baseReport(), { present: false, score: 0 }).some((p) => p.icon === 'imprint'), false);
});

test('scorecardModel: extra pips (aiMarkPip/stegoPips callers) are spliced in as-is, not dropped or reordered away', () => {
  const extra = [{ icon: 'sparkle' as const, label: 'Extra signal', status: 'pass' as const }];
  const pips = scorecardModel(baseReport(), undefined, extra);
  assert.ok(pips.some((p) => p.label === 'Extra signal'));
});

// ── sourceTypeLabel: who is the source type ABOUT? ───────────────────────────
//
// Regression: Lolly's own `c2pa.opened` propagates an ingredient's AI source
// type (anti-laundering - the flag must survive an ingredient strip). Rendered
// with the producing wording it read "Generated by AI" beside the green Lolly
// pill, i.e. "Lolly made these pixels with AI". Lolly generated nothing; it
// opened something that already was AI-generated.

test('sourceTypeLabel: an ingest step attributes the source type to what came IN', () => {
  assert.equal(sourceTypeLabel('c2pa.opened', 'trainedAlgorithmicMedia'), 'Source was AI-generated');
  assert.equal(sourceTypeLabel('c2pa.placed', 'trainedAlgorithmicMedia'), 'Source was AI-generated');
  assert.equal(sourceTypeLabel('c2pa.opened', 'composite'), 'Source was a composite of multiple elements');
});

test('sourceTypeLabel: a producing step still describes its OWN output', () => {
  // Google's `c2pa.resized` genuinely produced AI pixels - that wording is correct.
  assert.equal(sourceTypeLabel('c2pa.resized', 'trainedAlgorithmicMedia'), 'Generated by AI');
  assert.equal(sourceTypeLabel('c2pa.created', 'digitalCreation'), 'Created in software');
  assert.equal(sourceTypeLabel('c2pa.edited', 'composite'), 'Composite of multiple elements');
});

test('sourceTypeLabel: no ingest phrasing claims the step itself generated anything', () => {
  for (const [slug, label] of Object.entries(INGEST_SOURCE_TYPE_LABEL)) {
    assert.ok(label.startsWith('Source '), `${slug}: ingest wording must attribute to the source, got "${label}"`);
  }
  // Every producing slug has an ingest counterpart, or a step would silently lose its line.
  for (const slug of Object.keys(SOURCE_TYPE_LABEL)) {
    assert.ok(INGEST_SOURCE_TYPE_LABEL[slug], `${slug} has no ingest wording`);
  }
});

test('sourceTypeLabel: an unknown slug yields no line rather than a guess', () => {
  assert.equal(sourceTypeLabel('c2pa.opened', 'somethingNew'), undefined);
  assert.equal(sourceTypeLabel('c2pa.edited', ''), undefined);
});

// ── `#/verify?src=` is same-origin only ──────────────────────────────────────
//
// The verify page promises nothing is uploaded and nothing is fetched on your
// behalf. A `src` deep link is the one thing that makes it fetch, so the accepted
// shape is narrow ON PURPOSE: a single leading slash and no second one. Anything
// that could name another host must be refused, including the protocol-relative
// `//host/x` form that looks like a path but is not.
const acceptsSrc = (src: string): boolean => /^\/[^/]/.test(src);

test('verify ?src= accepts same-origin paths', () => {
  for (const ok of ['/info/the-flood.webp', '/catalog/assets/x.png', '/a']) {
    assert.equal(acceptsSrc(ok), true, `${ok} is a same-origin path`);
  }
});

test('verify ?src= refuses anything that can name another host', () => {
  for (const bad of [
    '//evil.example/x.png',        // protocol-relative - a host, not a path
    'https://evil.example/x.png',
    'http://evil.example/x.png',
    'data:image/png;base64,AAAA',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'evil.example/x.png',
    '',
  ]) {
    assert.equal(acceptsSrc(bad), false, `${bad} must not be fetched`);
  }
});

// ── The credential stored elsewhere (C2PA 2.4 section A.7.1.2 / section A.9.3) ─────────────
//
// The engine reports `state: 'invalid'` + `manifest.inaccessible` for a text
// asset that REFERENCES its credential instead of carrying it, because `state`
// is integrity-only and no integrity check could run. Every word of the flat
// broken verdict - "Credential broken", "Bytes no longer match", "Modified
// after signing" - is false about that file: nothing was compared. This is the
// same lesson the expired-certificate state exists for.

test('an external credential reference is its own state, never "Credential broken"', () => {
  const r = baseReport({
    state: 'invalid',
    checks: [{ code: 'manifest.inaccessible', ok: false, explanation: 'references an external manifest' }],
  });
  const { state } = resolveState(r);
  assert.equal(state, STATE_COPY.external);
  assert.notEqual(state, STATE_COPY.invalid);
  assert.ok(!/broken|modified|changed/i.test(state.title), state.title);
  // Neutral, not red and not green: nothing was checked either way.
  assert.equal(stateTone(r), 'none');
});

test('a real failure alongside the external reference keeps the broken verdict', () => {
  // The rewording is for ONE specific single-cause report. It must never become
  // a softener for a file that also failed something real.
  const r = baseReport({
    state: 'invalid',
    checks: [
      { code: 'manifest.inaccessible', ok: false, explanation: '' },
      { code: 'claimSignature.mismatch', ok: false, explanation: '' },
    ],
  });
  assert.equal(resolveState(r).state, STATE_COPY.invalid);
  assert.equal(stateTone(r), 'bad');
});

test('the scorecard does not report a manifest it never read as "readable"', () => {
  const r = baseReport({
    state: 'invalid',
    checks: [{ code: 'manifest.inaccessible', ok: false, explanation: '' }],
  });
  const readable = scorecardModel(r).find((i) => i.label === 'Manifest readable')!;
  assert.equal(readable.status, 'na', 'nothing in these bytes was read');
  // A credential that IS in the file still reads as before.
  const embedded = baseReport({ checks: [{ code: 'assertion.dataHash.match', ok: true, explanation: '' }] });
  assert.equal(scorecardModel(embedded).find((i) => i.label === 'Manifest readable')!.status, 'pass');
});

test('a credential fetched from elsewhere never claims to be "embedded"', () => {
  // The verdict is earned - these bytes DO match that credential - but every
  // stock sub says "its embedded credential", and after a sidecar fetch that
  // word is the one thing in the sentence that is false.
  const r = baseReport({
    state: 'valid',
    checks: [{ code: 'assertion.dataHash.match', ok: true, explanation: '' }],
    textBinding: { kind: 'html', manifestUrl: '/creds/doc.c2pa', externalManifestUsed: true },
  });
  const { sub } = resolveState(r);
  assert.ok(!/embedded/i.test(sub), sub);
  assert.match(sub, /not inside the file/);
  // An ordinary embedded credential keeps its existing wording untouched.
  const embedded = baseReport({ state: 'valid', checks: [{ code: 'assertion.dataHash.match', ok: true, explanation: '' }] });
  assert.equal(resolveState(embedded).sub, STATE_COPY.valid.sub);
});

// ── "Bytes no longer match" needs a row that says so ────────────────────────
//
// Every hero sentence and badge about the FILE's bytes is an inference from one
// check row: a failed hard binding. Nine of the C2PA 2.4 text statuses return
// before that row is ever produced, and the section A.7.1.3 / section A.9.4 carve-out fails
// the report with that row PASSING beside it. Printing the accusation in either
// case is the page arguing with its own check list.

test('hashFailed / hasHashVerdict read the rows, and nothing else', () => {
  const none = baseReport({ state: 'invalid', checks: [check('manifest.html.multipleManifests', false)] });
  assert.equal(hasHashVerdict(none), false, 'nothing was hashed');
  assert.equal(hashFailed(none), false);
  const passed = baseReport({ checks: [check('assertion.dataHash.match', true)] });
  assert.equal(hasHashVerdict(passed), true);
  assert.equal(hashFailed(passed), false, 'a PASS is a verdict, not a failure');
  const failed = baseReport({ state: 'invalid', checks: [check('assertion.dataHash.mismatch', false)] });
  assert.equal(hashFailed(failed), true);
  // BMFF video takes the same path under a different row name.
  assert.equal(hashFailed(baseReport({ checks: [check('assertion.bmffHash.mismatch', false)] })), true);
  assert.equal(hasHashVerdict(baseReport({ checks: [check('assertion.bmffHash.match', true)] })), true);
});

test('a carrier problem is its own amber state, never "Credential broken"', () => {
  // Not a crafted attack: a Markdown document ABOUT C2PA text bindings, quoting
  // the armour delimiters twice, reaches this exact report - and M2 is what put
  // three routes (.md in the picker, the paste handler, the text/plain drop) in
  // front of it.
  for (const code of [
    'manifest.html.multipleManifests',
    'manifest.structuredText.multipleReferences',
    'manifest.structuredText.emptyReference',
    'manifest.structuredText.malformedReference',
    'manifest.text.corruptedWrapper',
    'manifest.text.multipleWrappers',
    'credential.unreadable',
    'assertion.dataHash.malformed',
  ]) {
    const r = baseReport({ state: 'invalid', checks: [check(code, false), check('signingCredential.untrusted', false)] });
    const { state, sub } = resolveState(r);
    assert.equal(state, STATE_COPY.carrier, code);
    assert.equal(stateTone(r), 'warn', `${code}: amber, not red`);
    // The three claims the flat invalid hero used to make about a file where
    // nothing was hashed.
    assert.ok(!/\bmodified\b|no longer match|\bbroken\b/i.test(`${state.title} ${sub}`), `${code}: ${state.title} / ${sub}`);
    assert.equal(hashFailed(r), false, `${code} must not reach the badge group`);
  }
});

test('the carrier state is single-cause: real credential damage keeps the broken verdict', () => {
  // isCarrierOnly is a rewording of one shape, never a softener. A failure that
  // is not in the carrier set drags the whole report back to "broken".
  for (const code of ['claimSignature.mismatch', 'assertion.hashedURI.mismatch', 'assertion.missing']) {
    const r = baseReport({ state: 'invalid', checks: [check('manifest.inaccessible', false), check(code, false)] });
    assert.equal(isCarrierOnly(r), false, code);
    assert.equal(resolveState(r).state, STATE_COPY.invalid, code);
    assert.equal(stateTone(r), 'bad', code);
  }
  // ...and an empty check list is not a carrier problem either.
  assert.equal(isCarrierOnly(baseReport({ state: 'invalid' })), false);
});

test('an invalid state with no hash FAILURE never claims the bytes changed', () => {
  // Two shapes, two honest sentences: a hash that ran and passed, and a hash
  // that never ran at all. The default sub asserts both halves of an inference
  // neither shape supports.
  const ranAndPassed = baseReport({
    state: 'invalid',
    checks: [check('claimSignature.mismatch', false), check('assertion.dataHash.match', true)],
  });
  const a = resolveState(ranAndPassed);
  assert.equal(a.state, STATE_COPY.invalid, 'a damaged credential is still broken');
  assert.match(a.sub, /still match the hash that was signed/);
  assert.ok(!/\bmodified after signing\b|no longer match its bytes/i.test(a.sub), a.sub);

  const neverRan = baseReport({
    state: 'invalid',
    checks: [check('manifest.inaccessible', false), check('claimSignature.mismatch', false)],
  });
  const b = resolveState(neverRan);
  assert.equal(b.state, STATE_COPY.invalid);
  assert.match(b.sub, /never compared/);
  assert.ok(!/\bmodified after signing\b/i.test(b.sub), b.sub);

  // The real thing is untouched: a genuine mismatch keeps every word.
  const real = baseReport({ state: 'invalid', checks: [check('assertion.dataHash.mismatch', false)] });
  assert.equal(resolveState(real).sub, STATE_COPY.invalid.sub);
  assert.equal(stateTone(real), 'bad');
});

test('the section A.7.1.3 carve-out reads as coverage, not as damage', () => {
  // The forgery shape M1 section 6.3 added the refusal for: the exclusion swallows a
  // paragraph as well as the manifest block, so the hash over the remainder
  // MATCHES. The old hero said "Bytes no longer match" on a page whose own
  // check list printed "data hash valid" two panels below.
  const r = baseReport({
    state: 'invalid',
    checks: [
      check('claimSignature.validated', true),
      check('assertion.dataHash.additionalExclusionsPresent', false),
      check('assertion.dataHash.match', true),
      check('signingCredential.untrusted', false),
    ],
    textBinding: { kind: 'html', exclusionsConform: 'other' },
  });
  assert.equal(isExclusionsOnly(r), true);
  const { state, sub } = resolveState(r);
  assert.equal(state, STATE_COPY.uncovered);
  assert.equal(stateTone(r), 'warn');
  assert.ok(!/\bmodified\b|no longer match/i.test(`${state.title} ${sub}`), sub);
  // ...and it still says the dangerous part out loud.
  assert.match(sub, /never covered by the signature/);
  // A carve-out ALONGSIDE a real mismatch is a different report, and keeps the
  // broken verdict.
  const alsoMismatched = baseReport({
    state: 'invalid',
    checks: [check('assertion.dataHash.additionalExclusionsPresent', false), check('assertion.dataHash.mismatch', false)],
  });
  assert.equal(isExclusionsOnly(alsoMismatched), false);
  assert.equal(resolveState(alsoMismatched).state, STATE_COPY.invalid);
});

test('a file whose text was never searched is not reported as clean', () => {
  // The mirror of the never-accuse rule: never exonerate either. The engine
  // declines to read past 16 MiB and says so; the shell used to answer with a
  // flat "This file carries no C2PA manifest".
  const r = baseReport({
    found: false, state: 'none', format: 'html',
    textBinding: { kind: 'html', status: 'lolly.text.tooLarge' },
  });
  const { state, sub } = resolveState(r);
  assert.equal(state, STATE_COPY.notInspected);
  assert.equal(stateTone(r), 'none');
  assert.ok(!/carries no C2PA manifest/i.test(sub), sub);
  assert.match(sub, /never searched/);
  // The second half of the old sub is still true and must survive: the other
  // on-device inspections DID run.
  assert.match(sub, /Lolly Imprint/);
  // An ordinary no-credential file is untouched.
  assert.equal(resolveState(baseReport({ found: false, state: 'none' })).sub, STATE_COPY.none.sub);
});

test('the external hero does not promise an address it has none of', () => {
  // section A.7.1.2 with a `javascript:` href: the engine refuses to hand the
  // reference up at all (M1 section 3, "manifestUrl is deliberately absent"), so the
  // stock sub's closing "The address is shown below." pointed at nothing.
  const noUrl = baseReport({
    state: 'invalid',
    checks: [check('manifest.inaccessible', false)],
    textBinding: { kind: 'html', status: 'lolly.manifest.unsupportedReference' },
  });
  const { state, sub } = resolveState(noUrl);
  assert.equal(state, STATE_COPY.external, 'still not "broken"');
  assert.equal(stateTone(noUrl), 'none');
  assert.ok(!/shown below/i.test(sub), sub);
  assert.match(sub, /no address is shown/);
  // With a real address, the original sentence stands.
  const withUrl = baseReport({
    state: 'invalid',
    checks: [check('manifest.inaccessible', false)],
    textBinding: { kind: 'html', manifestUrl: '/creds/doc.c2pa' },
  });
  assert.equal(resolveState(withUrl).sub, STATE_COPY.external.sub);
});
