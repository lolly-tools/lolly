// SPDX-License-Identifier: MPL-2.0
/**
 * C2PA 2.4 WRITE SIDE - the three additions plan 105 section 5 asks the manifest
 * builder for, none of which touches a container:
 *
 *   1. `aiDisclosure`  → the section 18.28 `c2pa.ai-disclosure` assertion,
 *   2. `specVersion`   → inside `claim_generator_info` (2.4 moved it out of the
 *                        claim, where it is now deprecated),
 *   3. `buildExternalC2paStore` → section 11.4 / section A.7.1.2's EXTERNAL manifest: a store
 *      that binds the whole asset with no exclusion range and is never placed
 *      inside it (the M5 page-seal primitive: page bytes in, `.c2pa` sidecar out).
 *
 * Run with: node --test "tests/c2pa-writer-additions.test.ts"
 *
 * GROUND-TRUTH CAVEAT, stated up front: c2pa-rs 0.90 implements none of the 2.4
 * text bindings and c2patool cannot read an HTML asset, so - unlike every other
 * C2PA suite here - there is no second implementation to cross-check against.
 * Written-then-read-by-our-own-reader is necessary but NOT sufficient, so each
 * case pairs the round-trip with a spec-literal assertion: the assertion's CBOR
 * is decoded by a decoder written in this file (never the engine's encoder run
 * backwards), the claim's hashed URIs are recomputed here, and the external
 * store's hash is recomputed as a plain sha256 over the page bytes. A standing
 * TODO stays open to re-run this against c2pa-rs the release it lands handlers.
 *
 * CONTRACT (from section 18.28, section 10.2.3, section 11.4, section A.7.1.3):
 *   * label `c2pa.ai-disclosure`; `modelType` is the one required field and
 *     defaults to Table 12's generic `c2pa.types.model`; oversight nests under
 *     `contentProfile.humanOversightLevel`; `scientificDomain` is a LIST.
 *   * the disclosure is a CREATED assertion (section 2776 - created assertions are the
 *     ones attributed to the signer, which is what a disclosure is).
 *   * `specVersion` is a SemVer string in `claim_generator_info`, never in the
 *     claim, and is purely informational (section 10.2.3.1) - nothing branches on it.
 *   * an external manifest's data hash "shall have no exclusion range; the hash
 *     shall be computed over the entire document" (section A.7.1.3), and since the CDDL
 *     is `? "exclusions": [1* EXCLUSION_RANGE-map]`, "no range" means the key is
 *     ABSENT, not an empty array.
 *   * absent options change nothing: same inputs minus the new keys produce
 *     byte-identical stores (pinned with a deterministic stub signer).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildC2paManifest, buildExternalC2paStore, embedC2pa, AI_DISCLOSURE_ASSERTION, AI_MODEL_TYPE_GENERIC,
  AI_MODEL_TYPES, C2PA_SPEC_VERSION, GENERATED_SOURCE_TYPE, DIGITAL_SOURCE_TYPE, generateSigner,
} from '../engine/src/c2pa.ts';
// The reader, deep-imported (engine/src/index.ts is another session's lane).
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { parseC2paStore, prepareC2paIngredient, prepareC2paIngredientFromStore } from '../engine/src/c2pa-extract.ts';

const te = new TextEncoder();
const td = new TextDecoder();
const utf8 = (s: string): Uint8Array => te.encode(s);
const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const sha256 = async (b: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', b as unknown as BufferSource));

// ─── an independent CBOR decoder (RFC 8949, the definite-length subset) ───────
//
// Transcribed from the RFC's major-type table rather than imported: a fixture
// decoded with the encoder under test cannot catch that encoder being wrong.

function decodeItem(b: Uint8Array, i: number): [unknown, number] {
  const ib = b[i++]!;
  const major = ib >> 5;
  let n = ib & 0x1f;
  if (n === 24) { n = b[i]!; i += 1; }
  else if (n === 25) { n = (b[i]! << 8) | b[i + 1]!; i += 2; }
  else if (n === 26) { n = b[i]! * 0x1000000 + ((b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!); i += 4; }
  else if (n === 27) { n = Number(new DataView(b.buffer, b.byteOffset + i, 8).getBigUint64(0)); i += 8; }
  else if (n > 27) throw new Error('cbor: indefinite/reserved head');
  switch (major) {
    case 0: return [n, i];
    case 1: return [-1 - n, i];
    case 2: return [b.slice(i, i + n), i + n];
    case 3: return [td.decode(b.slice(i, i + n)), i + n];
    case 4: {
      const a: unknown[] = [];
      for (let k = 0; k < n; k++) { const [v, j] = decodeItem(b, i); a.push(v); i = j; }
      return [a, i];
    }
    case 5: {
      const m = new Map<unknown, unknown>();
      for (let k = 0; k < n; k++) {
        const [key, j] = decodeItem(b, i);
        const [v, j2] = decodeItem(b, j);
        m.set(key, v);
        i = j2;
      }
      return [m, i];
    }
    case 6: { const [v, j] = decodeItem(b, i); return [{ tag: n, value: v }, j]; }
    default: return [n === 20 ? false : n === 21 ? true : n === 22 ? null : n, i];
  }
}

function cbor(bytes: Uint8Array): unknown {
  const [v, end] = decodeItem(bytes, 0);
  assert.equal(end, bytes.length, 'cbor: trailing bytes after a single item');
  return v;
}

// ─── fixtures ─────────────────────────────────────────────────────────────────

/** A section A.7.1.2 HTML document that POINTS at its manifest - the M5 page shape.
 *  The `<link>` is inside the hash (there is no exclusion), so it must already
 *  be present in the bytes that get signed. */
const pageHtml = (body = 'Content here.'): string =>
  `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Example</title>
    <link rel="c2pa-manifest" href="/info/example.c2pa" type="application/c2pa">
</head>
<body>
    <p>${body}</p>
</body>
</html>
`;

const DISCLOSURE = {
  modelName: 'Claude Fable 5',
  modelIdentifier: 'claude-fable-5',
  oversight: 'prompt_guided',
  scientificDomain: 'cs.AI',
} as const;

/** Signing options that make two builds byte-comparable: a stub signer with a
 *  fixed "signature" (real ECDSA is randomized, so identical inputs never
 *  produce identical bytes) plus frozen label/instance/dates. NOT usable for a
 *  verify - the cert is a stand-in - which is exactly why it is only used by the
 *  byte-stability case. */
const fixedSigning = {
  signer: { certDer: Uint8Array.from({ length: 40 }, (_, i) => (i * 7) & 0xff), sign: (): Uint8Array => new Uint8Array(64).fill(9) },
  manifestLabel: 'urn:uuid:11111111-2222-4333-8444-555555555555',
  instanceId: 'urn:uuid:66666666-7777-4888-8999-aaaaaaaaaaaa',
  dates: { signedAt: '2026-08-11T00:00:00Z' },
};

/** The assertion superbox with `label`, via the READER's store parser (an
 *  independent implementation of the JUMBF walk from the writer's box emitter). */
function assertionOf(store: Uint8Array, label: string): { content: Uint8Array; payload: Uint8Array } {
  const parts = parseC2paStore(store);
  const a = parts.assertions.find((x) => x.label === label);
  assert.ok(a, `store has no ${label} assertion`);
  return a;
}

const claimOf = (store: Uint8Array): Map<unknown, unknown> => {
  const claim = cbor(parseC2paStore(store).claimBytes);
  assert.ok(claim instanceof Map, 'claim is a CBOR map');
  return claim;
};

// ═══ section 18.28 - the ai-disclosure assertion ═════════════════════════════════════

test('section 18.28 — aiDisclosure is written in the spec\'s own shape, defaults modelType, and nests oversight', async () => {
  const store = await buildC2paManifest({
    title: 'Masthead',
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: 'Lolly', version: '1.116.0' },
    actions: [{ action: 'c2pa.created', digitalSourceType: GENERATED_SOURCE_TYPE }],
    aiDisclosure: DISCLOSURE,
    assetHash: { exclusions: [{ start: 10, length: 20 }], hash: new Uint8Array(32).fill(3) },
  });

  const m = cbor(assertionOf(store, AI_DISCLOSURE_ASSERTION).content) as Map<string, unknown>;
  assert.ok(m instanceof Map, 'the disclosure is a CBOR map');
  // section 18.28.2: "The value of the modelType field ... shall be present". The caller
  // named no model type, so Table 12's generic entry is written rather than a
  // guessed framework or a missing required field.
  assert.equal(m.get('modelType'), AI_MODEL_TYPE_GENERIC);
  assert.equal(m.get('modelName'), 'Claude Fable 5');
  assert.equal(m.get('modelIdentifier'), 'claude-fable-5');
  // section 18.28.4: humanOversightLevel lives inside content-profile-map, not at the
  // top level - the writer's flattened `oversight` input must land nested.
  const profile = m.get('contentProfile');
  assert.ok(profile instanceof Map, 'contentProfile is a nested map');
  assert.equal(profile.get('humanOversightLevel'), 'prompt_guided');
  // `$scientific-domain-list /= 1* $scientific-domain-string` - a list, even
  // though section 18.28.4's own example ships a bare string.
  assert.deepEqual(m.get('scientificDomain'), ['cs.AI']);
  // Nothing else: a disclosure that invented fields would be a claim nobody made.
  assert.deepEqual([...m.keys()], ['modelType', 'modelName', 'modelIdentifier', 'contentProfile', 'scientificDomain']);
});

test('section 18.28 — the disclosure is a CREATED assertion, referenced by a hashed URI that checks out', async () => {
  const store = await buildC2paManifest({
    aiDisclosure: { modelName: 'Claude Fable 5', oversight: 'human_validated' },
    assetHash: { exclusions: [{ start: 0, length: 4 }], hash: new Uint8Array(32).fill(1) },
  });
  const claim = claimOf(store);
  const created = claim.get('created_assertions') as Array<Map<string, unknown>>;
  assert.ok(Array.isArray(created), 'v2 claim splits references into created_assertions');
  const ref = created.find((r) => r.get('url') === `self#jumbf=c2pa.assertions/${AI_DISCLOSURE_ASSERTION}`);
  assert.ok(ref, 'the disclosure is referenced from created_assertions (section 2776: attributed to the signer)');
  // Never in gathered_assertions - nothing here was gathered from an ingredient.
  assert.equal(claim.get('gathered_assertions'), undefined);
  // Recompute the hashed URI here: sha256 over the assertion superbox payload
  // (jumd + content boxes, i.e. the box minus its 8-byte LBox+TBox header).
  const { payload } = assertionOf(store, AI_DISCLOSURE_ASSERTION);
  assert.equal(hex(ref.get('hash') as Uint8Array), hex(await sha256(payload)), 'hashed URI matches the assertion bytes');
});

test('section 18.28 — a disclosure round-trips into the reader\'s report.aiDisclosure', async () => {
  const page = utf8(pageHtml());
  const store = await buildExternalC2paStore(page, {
    title: 'Signed page',
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: 'Lolly', version: '1.116.0' },
    aiDisclosure: DISCLOSURE,
  });
  const report = await verifyC2pa(page, { externalManifest: store });
  assert.equal(report.state, 'valid');
  // The read side flattens contentProfile.humanOversightLevel to `oversight` and
  // normalizes the domain to a list - the same names the writer accepts.
  assert.deepEqual(report.aiDisclosure, {
    modelType: AI_MODEL_TYPE_GENERIC,
    modelName: 'Claude Fable 5',
    modelIdentifier: 'claude-fable-5',
    oversight: 'prompt_guided',
    scientificDomain: ['cs.AI'],
  });
  // One model, one disclosure: the multi-model field stays absent.
  assert.equal(report.aiDisclosures, undefined);
});

test('section 18.28 — malformed enums are refused at write time, not silently written', async () => {
  const base = { assetHash: { exclusions: [{ start: 0, length: 1 }], hash: new Uint8Array(32) } };
  await assert.rejects(
    () => buildC2paManifest({ ...base, aiDisclosure: { oversight: 'reviewed' as never } }),
    /oversight must be one of fully_autonomous \/ prompt_guided \/ human_validated/,
    'an oversight level outside human-oversight-enum is refused',
  );
  await assert.rejects(
    () => buildC2paManifest({ ...base, aiDisclosure: { scientificDomain: 'artificial intelligence' } }),
    /arXiv taxonomy term/,
    'a scientificDomain the section 18.28.4 regexp rejects is refused',
  );
  await assert.rejects(
    () => buildC2paManifest({ ...base, aiDisclosure: { modelType: '   ' } }),
    /modelType cannot be empty/,
    'an empty modelType is refused (section 18.28.2 requires the field)',
  );
});

test('section 18.28.2 — modelType is checked against Table 12, and the c2pa namespace cannot be invented in', async () => {
  // "The value of the modelType field is an enumeration of AI model types defined
  // in Table 12, 'Model type values' and it shall be present in the
  // ai-model-disclosure-map object." Two of the three constrained fields were
  // validated and the REQUIRED one was not: any non-empty string was written.
  //
  // section 18.28.4's CDDL widens the socket (`$model-type-choice /= tstr`), and
  // section 18.21.1 spells out the escape hatch for the neighbouring asset type - "or
  // use an entity-specific namespace (e.g., com.litware.types.abc), conforming to
  // the syntax defined for assertion labels in section 6.2.2" - so the rule is Table 12
  // OR someone else's namespace, never an invented c2pa.* value.
  const base = { assetHash: { exclusions: [{ start: 0, length: 1 }], hash: new Uint8Array(32) } };
  const written = async (modelType: string): Promise<Record<string, unknown>> => {
    const store = await buildC2paManifest({ ...base, aiDisclosure: { modelType } });
    const a = parseC2paStore(store).assertions.find((x) => x.label === AI_DISCLOSURE_ASSERTION)!;
    return Object.fromEntries(cbor(a.content) as Map<string, unknown>);
  };
  assert.deepEqual(await written('c2pa.types.model.onnx'), { modelType: 'c2pa.types.model.onnx' }, 'a Table 12 value is written through');
  assert.deepEqual(await written('com.litware.types.abc'), { modelType: 'com.litware.types.abc' }, 'section 6.2.2 entity namespace accepted');
  for (const bad of ['not.a.c2pa.type at all', 'c2pa.types.model.invented', 'c2pa.types.dataset.onnx', 'model', '.leading.dot']) {
    await assert.rejects(
      () => buildC2paManifest({ ...base, aiDisclosure: { modelType: bad } }),
      /neither a Table 12 model type/,
      `${bad} is refused`,
    );
  }
  // Table 12 is transcribed, not paraphrased: the generic default is its first
  // row and every entry is a c2pa.types.model* label.
  assert.equal(AI_MODEL_TYPES[0], AI_MODEL_TYPE_GENERIC);
  assert.equal(AI_MODEL_TYPES.length, 24, 'Table 12 has 24 rows');
  assert.ok(AI_MODEL_TYPES.every((t) => t === AI_MODEL_TYPE_GENERIC || t.startsWith('c2pa.types.model.')));
});

// ═══ section 10.2.3 - specVersion in claim_generator_info ════════════════════════════

test('section 10.2.3 — specVersion is written inside claim_generator_info, never in the claim', async () => {
  const store = await buildC2paManifest({
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: 'Lolly', version: '1.116.0' },
    specVersion: C2PA_SPEC_VERSION,
    assetHash: { exclusions: [{ start: 0, length: 4 }], hash: new Uint8Array(32).fill(2) },
  });
  const claim = claimOf(store);
  const gen = claim.get('claim_generator_info') as Map<string, unknown>;
  assert.ok(gen instanceof Map, 'v2 carries a single generator-info map');
  assert.equal(gen.get('specVersion'), '2.4.0');
  assert.equal(gen.get('name'), 'Lolly');
  // 2.4 deprecated the claim-level field; a 2.4 writer must not emit it.
  assert.equal(claim.get('specVersion'), undefined);
  // The per-action softwareAgent is the same map TYPE but a different subject:
  // the manifest was produced to a spec version, one edit step was not.
  const actions = cbor(assertionOf(store, 'c2pa.actions.v2').content) as Map<string, unknown>;
  const first = (actions.get('actions') as Array<Map<string, unknown>>)[0]!;
  const agent = first.get('softwareAgent') as Map<string, unknown>;
  assert.equal(agent.get('name'), 'Lolly');
  assert.equal(agent.get('specVersion'), undefined, 'specVersion is not repeated on every action');
});

test('section 10.2.3 — the reader reads specVersion back off the generator info', async () => {
  const page = utf8(pageHtml());
  const store = await buildExternalC2paStore(page, {
    generatorInfo: { name: 'Lolly', version: '1.116.0' },
    specVersion: C2PA_SPEC_VERSION,
  });
  const report = await verifyC2pa(page, { externalManifest: store });
  assert.equal(report.state, 'valid');
  assert.equal(report.specVersion, '2.4.0');
});

test('section 10.2.3 — a specVersion the CDDL\'s semver-string rejects is refused', async () => {
  await assert.rejects(
    () => buildC2paManifest({ specVersion: '2.4', assetHash: { exclusions: [{ start: 0, length: 1 }], hash: new Uint8Array(32) } }),
    /specVersion must be a SemVer string/,
    'a two-part version is not SemVer',
  );
  await assert.rejects(
    () => buildC2paManifest({ specVersion: 'v2.4.0', assetHash: { exclusions: [{ start: 0, length: 1 }], hash: new Uint8Array(32) } }),
    /specVersion must be a SemVer string/,
    'a leading v is not SemVer',
  );
});

test('the two new options are absent by default — same inputs, byte-identical store', async () => {
  const args = {
    title: 'Stable',
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: 'Lolly', version: '1.116.0' },
    assetHash: { exclusions: [{ start: 100, length: 200 }], hash: new Uint8Array(32).fill(7), pad: new Uint8Array(4) },
    ...fixedSigning,
  };
  const plain = await buildC2paManifest(args);
  const explicitlyUnset = await buildC2paManifest({ ...args, aiDisclosure: undefined, specVersion: undefined });
  assert.equal(hex(plain), hex(explicitlyUnset), 'omitting the options perturbs nothing');
  // And when they ARE set, the store necessarily grows - the guard above is
  // about absence, not about the options being inert.
  const disclosed = await buildC2paManifest({ ...args, aiDisclosure: DISCLOSURE, specVersion: C2PA_SPEC_VERSION });
  assert.ok(disclosed.length > plain.length);
  assert.throws(() => assertionOf(plain, AI_DISCLOSURE_ASSERTION), /no c2pa\.ai-disclosure assertion/);
});

// ═══ section 11.4 / section A.7.1.2 - the external (sidecar) store ══════════════════════════

test('section A.7.1.3 — an external store binds the WHOLE document: no exclusions key, hash over every byte', async () => {
  const page = utf8(pageHtml());
  const store = await buildExternalC2paStore(page, { title: 'Signed page' });

  const hd = cbor(assertionOf(store, 'c2pa.hash.data').content) as Map<string, unknown>;
  // "The data hash assertion shall have no exclusion range" - and the CDDL's
  // `[1* EXCLUSION_RANGE-map]` means an empty array would be non-conformant, so
  // the key is absent entirely.
  assert.equal(hd.has('exclusions'), false, 'no exclusions key at all');
  assert.equal(hd.get('alg'), 'sha256');
  assert.equal(hd.get('name'), 'whole document');
  // Recomputed here as a plain digest of the page bytes - no exclusion arithmetic
  // to get wrong, which is the whole point of the external form.
  assert.equal(hex(hd.get('hash') as Uint8Array), hex(await sha256(page)), 'the hash is sha256 over the entire document');
  // Nothing was placed in the asset: the store is returned on its own.
  assert.equal(parseC2paStore(store).claimVersion, 2);
});

test('section 11.4 — the sidecar verifies against the unmodified page and fails against an edited one', async () => {
  const page = utf8(pageHtml());
  const store = await buildExternalC2paStore(page, {
    title: 'Signed page',
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: 'Lolly', version: '1.116.0' },
  });

  const ok = await verifyC2pa(page, { externalManifest: store });
  assert.equal(ok.found, true);
  assert.equal(ok.state, 'valid');
  assert.equal(ok.format, 'html');
  assert.equal(ok.textBinding?.kind, 'html');
  // "these bytes match a credential served from over there" is a different
  // sentence from "these bytes match the credential inside them", and the report
  // has to say which.
  assert.equal(ok.textBinding?.externalManifestUsed, true);
  assert.ok(ok.checks.some((c) => c.ok && c.code === 'assertion.dataHash.match'));
  assert.equal(ok.madeWithLolly, true);

  // One character changed anywhere in the document - including outside the head,
  // which is the half an exclusion range would have carved out on the inline form.
  const edited = utf8(pageHtml('Content there.'));
  const bad = await verifyC2pa(edited, { externalManifest: store });
  assert.equal(bad.found, true);
  assert.equal(bad.state, 'invalid');
  assert.ok(bad.checks.some((c) => !c.ok && c.code === 'assertion.dataHash.mismatch'), 'the hard binding catches it');
  assert.equal(bad.madeWithLolly, false);
  // The claim itself is intact - only the bytes moved - so the softer verdict is
  // the honest one for a re-serialized page (section A.7.1.3's own warning).
  assert.equal(bad.likelyMadeWithLolly, true);

  // A one-byte truncation is still a mismatch, never a crash or a pass.
  const cut = page.slice(0, page.length - 1);
  assert.equal((await verifyC2pa(cut, { externalManifest: store })).state, 'invalid');
});

test('section A.7.1.4 — without the sidecar the page reports "referenced but not obtained", not "no credential"', async () => {
  const page = utf8(pageHtml());
  const report = await verifyC2pa(page);
  assert.equal(report.found, true);
  assert.equal(report.state, 'invalid');
  assert.match(report.reason ?? '', /external C2PA manifest at \/info\/example\.c2pa/);
  assert.equal(report.textBinding?.manifestUrl, '/info/example.c2pa');
});

test('section 11.4 — ingredients ride into the external store and the chain reads back', async () => {
  // A signed masthead: its own store, its own claim, its own section 18.28 disclosure - 
  // the M4 artifact, built here without a container so the test stays about the
  // ingredient machinery rather than about SVG splicing.
  const masthead = utf8('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>');
  const mastheadStore = await buildExternalC2paStore(masthead, {
    title: 'Masthead — provenance',
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: 'Lolly', version: '1.116.0' },
    actions: [{ action: 'c2pa.created', digitalSourceType: GENERATED_SOURCE_TYPE, description: 'Generated by a trained model' }],
    aiDisclosure: DISCLOSURE,
    specVersion: C2PA_SPEC_VERSION,
  });
  // An external store is only ever consulted for an asset that REFERENCES one
  // (section A.7.1.2's link element), which SVG has no form of - so a bare SVG plus a
  // sidecar reads as no credential, not as a broken one. That is exactly why M4
  // embeds a masthead's store in the SVG (section A.3.3) and only the M5 page uses the
  // sidecar form; this fixture is here for the ingredient machinery.
  assert.equal((await verifyC2pa(masthead, { externalManifest: mastheadStore })).state, 'none');

  const ing = prepareC2paIngredientFromStore(mastheadStore, 'svg');
  assert.ok(ing, 'a store built here is packageable as an ingredient');
  assert.equal(ing.digitalSourceType, GENERATED_SOURCE_TYPE, 'the AI origin is lifted out of the ingredient chain');

  const page = utf8(pageHtml());
  const store = await buildExternalC2paStore(page, {
    title: 'Signed page',
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: 'Lolly', version: '1.116.0' },
    actions: [{ action: 'c2pa.created', digitalSourceType: DIGITAL_SOURCE_TYPE }],
    ingredients: [ing],
  });

  const report = await verifyC2pa(page, { externalManifest: store });
  assert.equal(report.state, 'valid', 'the page hash still covers the whole document with ingredients present');
  // One seal for the page, ingredients disclose the parts: the page's own claim
  // never restates the genAI origin, the chain walk derives it.
  assert.deepEqual(report.aiGenerated, { kind: 'generated', sourceType: GENERATED_SOURCE_TYPE });
  const opened = (report.history ?? []).filter((s) => s.action === 'c2pa.opened');
  assert.equal(opened.length, 1, 'the page opened exactly one ingredient');
  assert.equal(opened[0]!.digitalSourceType, GENERATED_SOURCE_TYPE);
  assert.ok((report.history ?? []).some((s) => s.description === 'Generated by a trained model'),
    'the ingredient manifest\'s own actions are walked, not just the active claim\'s');
  // The ingredient's manifest travelled verbatim: its signature is still there to
  // be checked, which is what "the chain nests" has to mean to be worth anything.
  const ingredientAssertion = cbor(assertionOf(store, 'c2pa.ingredient.v3').content) as Map<string, unknown>;
  assert.equal(ingredientAssertion.get('dc:format'), 'image/svg+xml');
  assert.equal(ingredientAssertion.get('relationship'), 'parentOf');
  assert.equal(ingredientAssertion.get('dc:title'), 'Masthead — provenance');
  // report.aiDisclosure is the ACTIVE manifest's - the page made no disclosure of
  // its own, and the reader does not (and should not) hoist an ingredient's.
  assert.equal(report.aiDisclosure, undefined);
  // …but the model name is not lost: the ingredient's whole manifest superbox
  // travelled VERBATIM into the page store, disclosure assertion and signature
  // included, so a surface that wants the model name reads the component's own
  // credential (which is what the docs credential line does with `from=`).
  const activeIngredientBox = ing.manifestBoxes[ing.manifestBoxes.length - 1]!;
  assert.ok(indexOfBytes(store, activeIngredientBox) >= 0, 'the ingredient manifest is carried in byte-for-byte');
  const disclosure = cbor(assertionOf(mastheadStore, AI_DISCLOSURE_ASSERTION).content) as Map<string, unknown>;
  assert.equal(disclosure.get('modelName'), 'Claude Fable 5');
});

test('section 11.4 — a signed FILE is packageable as an ingredient of a page seal (the M4 → M5 path)', async () => {
  // The real component shape: an SVG that carries its own store (section A.3.3), which
  // is what /info/mastheads/<id>.svg serves and what "Check it yourself" verifies.
  const svg = utf8('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>');
  const signedSvg = await embedC2pa(svg, 'svg', {
    title: 'Masthead — provenance',
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: 'Lolly', version: '1.116.0' },
    actions: [{ action: 'c2pa.created', digitalSourceType: GENERATED_SOURCE_TYPE, description: 'Generated by a trained model' }],
  });
  const standalone = await verifyC2pa(signedSvg);
  assert.equal(standalone.state, 'valid', 'the component verifies on its own bytes');
  assert.deepEqual(standalone.aiGenerated, { kind: 'generated', sourceType: GENERATED_SOURCE_TYPE });

  const ing = prepareC2paIngredient(signedSvg);
  assert.ok(ing);
  const page = utf8(pageHtml());
  const store = await buildExternalC2paStore(page, {
    title: 'Signed page',
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: 'Lolly', version: '1.116.0' },
    specVersion: C2PA_SPEC_VERSION,
    ingredients: [ing],
  });
  const report = await verifyC2pa(page, { externalManifest: store });
  assert.equal(report.state, 'valid');
  assert.equal(report.specVersion, '2.4.0');
  assert.deepEqual(report.aiGenerated, { kind: 'generated', sourceType: GENERATED_SOURCE_TYPE },
    'the page seal inherits the component\'s AI origin through the chain, with no new verdict logic');
});

/** First index of `needle` in `hay`, or -1 - a plain byte scan, used to prove an
 *  ingredient manifest was carried in unaltered rather than re-encoded. */
function indexOfBytes(hay: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

// ═══ the one external cross-check that IS available ═══════════════════════════

const which = (tool: string): boolean => spawnSync('which', [tool], { encoding: 'utf8' }).status === 0;

test('c2pa-rs reads the sidecar store: signature, hashed URIs, ai-disclosure and specVersion', {
  skip: !which('c2patool') && 'c2patool not installed',
}, async (t) => {
  // c2patool cannot open an HTML asset, so the BINDING half of an external
  // manifest still has no second implementation to check it (the standing TODO).
  // But the store is an ordinary JUMBF manifest store, and c2patool reads one
  // straight from a `.c2pa` file - so everything except the asset hash gets a
  // genuinely independent verdict here: the COSE signature, every hashed URI
  // (the section 18.28 assertion included), and the 2.4 placement of specVersion.
  const page = utf8(pageHtml());
  const store = await buildExternalC2paStore(page, {
    title: 'Signed page',
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: 'Lolly', version: '1.116.0' },
    aiDisclosure: DISCLOSURE,
    specVersion: C2PA_SPEC_VERSION,
  });
  const file = join(mkdtempSync(join(tmpdir(), 'c2pa-ext-')), 'page.c2pa');
  writeFileSync(file, store);
  const res = spawnSync('c2patool', [file, '--detailed'], { encoding: 'utf8' });
  const text = ((res.stdout || '') + (res.stderr || '')).trim();
  t.diagnostic(`c2patool exit ${res.status}`);
  if (!/"claim"/.test(text)) {
    t.skip(`this c2patool build cannot read a bare manifest store: ${text.slice(0, 200)}`);
    return;
  }
  const out = JSON.parse(text.slice(text.indexOf('{')));
  const manifest = out.manifests[out.active_manifest];
  assert.equal(manifest.claim.claim_generator_info.specVersion, '2.4.0', 'c2pa-rs reads specVersion off the generator info');
  assert.equal(manifest.claim.specVersion, undefined, 'and there is no deprecated claim-level copy');
  assert.deepEqual(manifest.assertion_store['c2pa.ai-disclosure'], {
    modelType: AI_MODEL_TYPE_GENERIC,
    modelName: 'Claude Fable 5',
    modelIdentifier: 'claude-fable-5',
    contentProfile: { humanOversightLevel: 'prompt_guided' },
    scientificDomain: ['cs.AI'],
  }, 'an independent CBOR implementation decodes the disclosure to the same map');
  assert.equal(manifest.assertion_store['c2pa.hash.data'].exclusions, undefined, 'no exclusions key survives the round-trip');
  const success: Array<{ code: string; url: string }> = out.validation_results.activeManifest.success;
  assert.ok(success.some((s) => s.code === 'claimSignature.validated'), 'c2pa-rs verifies our COSE signature');
  assert.ok(success.some((s) => s.code === 'assertion.hashedURI.match' && s.url.endsWith('c2pa.ai-disclosure')),
    'c2pa-rs re-hashes the disclosure assertion and matches our claim reference');
  // The failures c2patool DOES report are both expected and honest: the signer is
  // an ephemeral self-signed key, and the "asset" it hashed was the sidecar file
  // itself - there is no way to hand it the page these bytes actually bind.
  const failures: Array<{ code: string }> = out.validation_results.activeManifest.failure;
  assert.deepEqual(failures.map((f) => f.code).sort(), ['assertion.dataHash.mismatch', 'signingCredential.untrusted']);
});

test('section 11.4 — an enrolled/explicit signer and dates flow through the external path', async () => {
  const page = utf8(pageHtml());
  const signer = await generateSigner({ notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 86_400_000) });
  const store = await buildExternalC2paStore(page, {
    title: 'Signed page',
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: 'Lolly', version: '1.116.0' },
    signer,
    author: { name: 'Andy Fitzsimon' },
    rights: '© 2026 Lolly',
  });
  const report = await verifyC2pa(page, { externalManifest: store });
  assert.equal(report.state, 'valid');
  assert.equal(report.author?.name, 'Andy Fitzsimon');
  assert.equal(report.rights, '© 2026 Lolly');
  assert.equal(report.signer?.selfSigned, true, 'still the ephemeral on-device posture unless a CA-issued chain is passed');
  await assert.rejects(
    () => buildExternalC2paStore('not bytes' as never),
    /bytes as a Uint8Array/,
    'the primitive refuses anything but bytes',
  );
});
