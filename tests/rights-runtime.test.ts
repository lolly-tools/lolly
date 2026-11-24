// SPDX-License-Identifier: MPL-2.0
/**
 * The runtime's rights service (plan 253, stage E2): what a mounted tool's
 * recorded sources ask of a delivery, what an export hands the host, what a
 * receipt says after the written bytes were read back, and what a saved session
 * remembers about the decisions somebody made.
 *
 * The two upstream specimens in tests/fixtures/emoji are the plan's own review
 * artifact: an unsigned CC BY illustration (Twemoji) and a CC BY-SA one
 * (OpenMoji) that a brand treatment recolours. Neither is a stand-in - they are
 * the exact bytes and the exact declarations the packs ship.
 *
 * Run with: node --test tests/rights-runtime.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { JSDOM } from 'jsdom';

import { createRuntime } from '../engine/src/runtime.ts';
import type { Runtime } from '../engine/src/runtime.ts';
import { emojiSourceIngredients, emojiWorksAndUses } from '../engine/src/emoji-rights.ts';
import type { EmojiLineSource } from '../engine/src/emoji-line.ts';
import { sourceIngredientsFor } from '../engine/src/rights-attribution.ts';
import { checkAttributionReadback } from '../engine/src/rights-attribution.ts';
import { migrateSessionRecord, sessionRightsDecisions, SESSION_FORMAT_VERSION, SESSION_READER_VERSION } from '../engine/src/session-record.ts';
import { embedC2pa } from '../engine/src/c2pa.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import type { EmojiAPI } from '../packages/core/src/host-v1.ts';
import type { EmojiPackPinV1, EmojiStyleV1, EmojiTreatmentV1 } from '../packages/core/src/emoji-v1.ts';
import { fixture } from './helpers/emoji-fixtures.ts';

const GRIN = '\u{1F600}';

const xmlDom = new JSDOM('');
const parseXml = (source: string): unknown =>
  new xmlDom.window.DOMParser().parseFromString(source, 'image/svg+xml');

const palette = [
  { id: '{color.brand.primary}', hex: '#0c322c' },
  { id: '{color.brand.accent}', hex: '#30ba78' },
];
const SNAP: EmojiTreatmentV1 = { mode: 'snap', strengthBps: 10000, palette, recipe: 'emoji-treatment-v1' };
const ORIGINAL: EmojiTreatmentV1 = { mode: 'original', strengthBps: 0 };

/** A host emoji API serving ONE pinned fixture pack and nothing else. */
async function fixtureEmoji(name: 'twemoji' | 'openmoji'): Promise<{ api: EmojiAPI; pin: EmojiPackPinV1 }> {
  const { lock, bytes, artwork, manifest } = await fixture(name);
  const api: EmojiAPI = {
    sets: async () => [{
      pin: lock.pin, family: manifest.family, style: manifest.style, label: `${manifest.family} ${manifest.style}`,
      license: manifest.source.license, licenseUrl: manifest.source.licenseUrl, attribution: manifest.source.attribution,
      glyphs: manifest.glyphs.length, coverageComplete: false,
    }],
    manifest: async (pin) => (pin.id === lock.pin.id && pin.checksum === lock.pin.checksum ? new Uint8Array(bytes) : null),
    artwork: async (_pin, asset) => (asset.url === '1f600.svg' ? new Uint8Array(artwork) : null),
    parseXml,
  };
  return { api, pin: lock.pin };
}

function styleFor(pin: EmojiPackPinV1, treatment: EmojiTreatmentV1): EmojiStyleV1 {
  return { schemaVersion: 1, primary: pin, fallbacks: [], metricsPolicy: 'inline-em-v1', treatment };
}

let toolSeq = 0;
/** Hook factories are memoised by id@version, so every mount gets its own id. */
function toolDouble(): Parameters<typeof createRuntime>[0] {
  return {
    trustClass: 'catalog',
    manifest: {
      id: `rights-runtime-${++toolSeq}`, name: 'Rights runtime', version: '1.0.0',
      engineVersion: '^1.0.0', status: 'official',
      render: { width: 200, height: 100, formats: ['png'] },
      inputs: [{ id: 'title', type: 'text', default: `Hello ${GRIN}` }],
    },
    template: '<p class="line">{{title}}</p>',
    styles: null, hooksSource: null, hooksUrl: null,
    textTemplates: {}, textTemplateErrors: {},
  } as unknown as Parameters<typeof createRuntime>[0];
}

interface HostDouble {
  host: Parameters<typeof createRuntime>[1];
  renders: Record<string, unknown>[];
  logs: string[];
}

/**
 * A host that behaves like a real export bridge: it stamps the bytes it was
 * handed through the SAME embedC2pa the shells use, then reads them back and
 * reports one receipt. `stamp: false` is the bridge whose credential failed -
 * the file still ships, and the receipt has to say the credits are not in it.
 */
function hostDouble(emoji: EmojiAPI | undefined, opts: { stamp?: boolean } = {}): HostDouble {
  const renders: Record<string, unknown>[] = [];
  const logs: string[] = [];
  const host = {
    version: '1',
    shell: 'test',
    profile: { get: async () => ({}) },
    log: (level: string, message: string) => { logs.push(`${level}:${message}`); },
    export: {
      render: async (_node: unknown, _format: string, options: Record<string, unknown>) => {
        renders.push(options);
        // A real PNG, because a credential is embedded into a container.
        let bytes = pngBytes();
        const rights = options.rights as { plan: never; fingerprint: string; onReceipt?: (receipt: unknown) => void } | undefined;
        if (opts.stamp !== false) {
          bytes = await embedC2pa(bytes, 'png', {
            title: 'Rights runtime',
            ingredients: options.ingredients as never,
          });
        }
        if (rights?.onReceipt) {
          const report = await verifyC2pa(bytes);
          rights.onReceipt(checkAttributionReadback(rights.plan, report, undefined, rights.fingerprint));
        }
        return new Blob([bytes as BlobPart], { type: 'image/png' });
      },
    },
    ...(emoji ? { emoji } : {}),
  };
  return { host: host as unknown as Parameters<typeof createRuntime>[1], renders, logs };
}

/** The smallest real PNG: an 8x8 grey square, written by hand so the test needs no rasteriser. */
function pngBytes(): Uint8Array {
  const width = 8, height = 8;
  const raw = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const at = y * (width * 3 + 1) + 1 + x * 3;
      raw[at] = 0x30; raw[at + 1] = 0xba; raw[at + 2] = 0x78;
    }
  }
  const ihdr = new Uint8Array(13);
  new DataView(ihdr.buffer).setUint32(0, width);
  new DataView(ihdr.buffer).setUint32(4, height);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const chunks = [chunk('IHDR', ihdr), chunk('IDAT', new Uint8Array(deflateSync(raw))), chunk('IEND', new Uint8Array())];
  const size = chunks.reduce((n, c) => n + c.length, 8);
  const out = new Uint8Array(size);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  let at = 8;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;

  function chunk(type: string, data: Uint8Array): Uint8Array {
    const body = new Uint8Array(4 + type.length + data.length + 4);
    const view = new DataView(body.buffer);
    view.setUint32(0, data.length);
    for (let i = 0; i < type.length; i++) body[4 + i] = type.charCodeAt(i);
    body.set(data, 8);
    view.setUint32(body.length - 4, crc32Of(body.subarray(4, body.length - 4)));
    return body;
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32Of(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A document holding one hydrated render. */
function page(html: string): Element {
  const dom = new JSDOM(`<!doctype html><html><body><div id="canvas">${html}</div></body></html>`);
  return dom.window.document.getElementById('canvas')!;
}

async function mounted(name: 'twemoji' | 'openmoji', treatment: EmojiTreatmentV1, opts: { stamp?: boolean } = {}): Promise<{
  runtime: Runtime; canvas: Element; renders: Record<string, unknown>[]; logs: string[];
}> {
  const { api, pin } = await fixtureEmoji(name);
  const { host, renders, logs } = hostDouble(api, opts);
  const runtime = await createRuntime(toolDouble(), host);
  await runtime.setEmojiStyle(styleFor(pin, treatment));
  const canvas = page(runtime.getHydrated());
  await runtime.applyEmojiToDom(canvas);
  return { runtime, canvas, renders, logs };
}

test('an unchanged CC BY glyph is ready to deliver, with its credit prepared', async () => {
  const { runtime } = await mounted('twemoji', ORIGINAL);
  const evaluation = runtime.rights();

  assert.equal(evaluation.status, 'ready');
  assert.deepEqual(evaluation.issues, []);
  assert.equal(evaluation.uses.length, 1);
  assert.equal(evaluation.uses[0]!.licence, 'CC-BY-4.0');
  assert.equal(evaluation.uses[0]!.classification, 'collection-component');
  assert.equal(evaluation.uses[0]!.reviewed, true);

  assert.equal(evaluation.plan.required.length, 1, 'CC BY asks for a credit');
  const credit = evaluation.plan.required[0]!.credit;
  assert.match(credit, /grinning face/);
  // The pack asked to be credited in its own words, so those words identify the
  // creator and the licence part adds the link rather than the name twice.
  assert.match(credit, /Twemoji graphics by Twitter, Inc\. and other contributors, CC BY 4\.0, https:\/\/creativecommons\.org\/licenses\/by\/4\.0\//);
  // The credit states the same changes the credential records for this source.
  // A file whose credit said `unchanged` while its own credential named two
  // modifications would be two answers to one question.
  assert.match(credit, /changes: Canonicalized SVG syntax and inline presentation styles, Prefixed local SVG ids and paint references for placement\.$/);
  assert.deepEqual(
    evaluation.plan.required[0]!.changes?.split(', '),
    runtime.emojiIngredients()[0]!.rights!.modifications,
    'the plan and the credential name the same modifications',
  );
  assert.deepEqual(evaluation.plan.channels, ['c2pa-ingredients', 'readable-details']);
  assert.deepEqual(evaluation.plan.humanActions, []);
  // A prepared credit is not a delivered one, and nothing here says it is.
  assert.equal(runtime.lastReceipt, null);
});

test('a recoloured CC BY-SA glyph shared in public needs a licence for the adaptation', async () => {
  const { runtime } = await mounted('openmoji', SNAP);
  const evaluation = runtime.rights({ audience: 'public' });

  assert.equal(evaluation.status, 'actions-required');
  assert.deepEqual(evaluation.issues.map((issue) => issue.code), ['licence.adaptation-choice']);
  assert.equal(evaluation.uses[0]!.licence, 'CC-BY-SA-4.0');
  assert.equal(evaluation.uses[0]!.classification, 'adaptation');
  assert.equal(evaluation.issues[0]!.summary, 'If you share this adaptation, it needs a compatible licence.');
  // The remedies name the compatible licence as data, and keep the three ways
  // out that are not a licence choice.
  const remedies = evaluation.issues[0]!.remedies;
  assert.deepEqual(remedies.filter((r) => r.kind === 'output-licence').map((r) => r.licence), ['CC-BY-SA-4.0', 'FAL-1.3', 'GPL-3.0-or-later']);
  assert.deepEqual(
    remedies.map((r) => r.kind).filter((kind) => kind !== 'output-licence'),
    ['keep-original', 'replace-work', 'separate-permission'],
  );
  assert.match(evaluation.plan.required[0]!.credit, /Recoloured every paint with emoji-treatment-v1 in snap mode\.$/);
});

test('the same adaptation kept private asks for nothing extra', async () => {
  const { runtime } = await mounted('openmoji', SNAP);
  const evaluation = runtime.rights({ audience: 'private' });

  assert.equal(evaluation.status, 'ready');
  assert.deepEqual(evaluation.issues, []);
  assert.equal(evaluation.plan.required.length, 1, 'the credit is still owed; only the ShareAlike step is not');
});

test('a recorded decision turns the ShareAlike action into a ready delivery', async () => {
  const { runtime } = await mounted('openmoji', SNAP);
  const before = runtime.rights({ audience: 'public' });
  const work = before.issues[0]!.work!;

  runtime.setRightsDecision({ work, kind: 'output-licence', licence: 'CC-BY-SA-4.0', fingerprint: before.situation });
  const after = runtime.rights({ audience: 'public' });

  assert.equal(after.status, 'ready');
  assert.deepEqual(after.issues, []);
  assert.notEqual(after.fingerprint, before.fingerprint, 'a recorded decision is part of what was evaluated');

  // Recorded once, readable for the session record, and replaced rather than doubled.
  runtime.setRightsDecision({ work, kind: 'output-licence', licence: 'CC-BY-SA-4.0' });
  assert.equal(runtime.rightsDecisions().length, 1);
  assert.equal(runtime.rightsDecisions()[0]!.licence, 'CC-BY-SA-4.0');

  // A decision that names no compatible licence resolves nothing.
  runtime.setRightsDecision({ work, kind: 'output-licence', licence: 'MIT' });
  assert.equal(runtime.rights({ audience: 'public' }).status, 'actions-required');

  // And a restore from a saved session puts the answer back.
  runtime.setRightsDecisions([{ work, kind: 'output-licence', licence: 'CC-BY-SA-4.0' }]);
  assert.equal(runtime.rights({ audience: 'public' }).status, 'ready');
});

test('the ingredients an export hands the host are byte-identical to the emoji record', async () => {
  const { runtime, canvas, renders } = await mounted('twemoji', ORIGINAL);
  // The census this render placed, straight off the pass that placed it.
  const census = (await runtime.applyEmojiToDom(canvas)).census as EmojiLineSource[];
  await runtime.export(canvas, 'png', { c2pa: true });

  const handed = renders[0]!.ingredients as unknown[];
  const { works, uses, details } = emojiWorksAndUses(census);
  const viaRights = sourceIngredientsFor(works, uses, details);
  const direct = emojiSourceIngredients(census);

  assert.equal(census.length, 1);
  assert.equal(handed.length, 1);
  assert.deepStrictEqual(viaRights, direct);
  assert.deepStrictEqual(handed, direct);
  // Byte-identical, not merely deep-equal: the key ORDER is what a signed
  // credential records, so a reordered record is a different file.
  assert.equal(json(viaRights), json(direct));
  assert.equal(json(handed), json(direct));
  assert.deepStrictEqual(direct, runtime.emojiIngredients());
});

test('an export reads its own bytes back before it says the credits are in the file', async () => {
  const { runtime, canvas, renders } = await mounted('twemoji', ORIGINAL);
  await runtime.export(canvas, 'png', { c2pa: true });

  const promised = renders[0]!.rights as { plan: { required: unknown[] }; fingerprint: string };
  assert.ok(promised, 'the host is handed the plan it is delivering');
  assert.equal(promised.plan.required.length, 1);

  const receipt = runtime.lastReceipt;
  assert.ok(receipt, 'the host reported one receipt');
  assert.equal(receipt.state, 'readback-confirmed');
  assert.equal(receipt.fingerprint, promised.fingerprint);
  assert.deepEqual(receipt.remaining, []);
  assert.equal(receipt.expected.length, 1);
  assert.deepEqual(receipt.observed, receipt.expected);
  assert.match(receipt.credits, /grinning face/);
  assert.ok(receipt.checks.every((check) => check.ok), JSON.stringify(receipt.checks));
});

test('a credential that was never written never reads as delivered', async () => {
  const { runtime, canvas } = await mounted('twemoji', ORIGINAL, { stamp: false });
  await runtime.export(canvas, 'png', { c2pa: true });

  const receipt = runtime.lastReceipt;
  assert.ok(receipt);
  assert.equal(receipt.state, 'written', 'the file shipped; the credits did not travel with it');
  assert.deepEqual(receipt.remaining.map((issue) => issue.code), ['credential.ingredient-missing']);
  assert.match(receipt.credits, /CC BY 4\.0/, 'the credit is there to deliver another way');
  assert.equal(receipt.checks.find((check) => check.name === 'sources.expected')?.ok, false);
});

test('an export with no recorded source promises nothing and receipts nothing', async () => {
  const { api, pin } = await fixtureEmoji('twemoji');
  const { host, renders } = hostDouble(api);
  const runtime = await createRuntime(toolDouble(), host);
  await runtime.setEmojiStyle(styleFor(pin, ORIGINAL));
  await runtime.setInput('title', 'Plain text with no emoji');

  await runtime.export(page(runtime.getHydrated()), 'png', { c2pa: true });
  assert.equal(renders[0]!.rights, undefined);
  assert.equal(renders[0]!.ingredients, undefined);
  assert.equal(runtime.lastReceipt, null);
  assert.equal(runtime.rights().status, 'ready');
  assert.deepEqual(runtime.rights().plan.required, []);
});

test('a saved session remembers the decisions, and an older record opens without them', () => {
  // v5 (plan 373) added the picture reference; the decisions are a v4 field, unchanged.
  assert.equal(SESSION_FORMAT_VERSION, 5);
  assert.equal(SESSION_READER_VERSION, 5);

  const decisions = [{ work: 'community/emoji/openmoji/color/1f600', kind: 'output-licence' as const, licence: 'CC-BY-SA-4.0' }];
  assert.deepEqual(sessionRightsDecisions({ rightsDecisions: decisions }), decisions);

  // A record written before this existed simply has none, which is what the
  // evaluator assumes of every session anyway.
  const data = { values: { title: 'Hi' } };
  const warnings: string[] = [];
  const log = (level: 'warn' | 'info', message: string): void => { if (level === 'warn') warnings.push(message); };
  for (const formatVersion of [undefined, 1, 2, 3, 4]) {
    assert.deepEqual(migrateSessionRecord({ slot: 'a', data, formatVersion }, log), data);
  }
  assert.deepEqual(warnings, []);
  assert.equal(sessionRightsDecisions({ slot: 'a', data, formatVersion: 3 }), null);

  // Untrusted rows: junk is dropped entry by entry, never thrown over.
  assert.equal(sessionRightsDecisions(null), null);
  assert.equal(sessionRightsDecisions({ rightsDecisions: 'all of them' }), null);
  assert.equal(sessionRightsDecisions({ rightsDecisions: [{ work: 'a' }, { kind: 'output-licence' }, null, 7] }), null);
  assert.deepEqual(
    sessionRightsDecisions({ rightsDecisions: [{ work: 'a', kind: 'acknowledged' }, { work: 'b', kind: 'ignore-everything' }] }),
    [{ work: 'a', kind: 'acknowledged' }],
  );
  assert.equal(sessionRightsDecisions({ rightsDecisions: Array.from({ length: 500 }, (_, i) => ({ work: `work-${i}`, kind: 'acknowledged' })) })?.length, 200);
  // One work named twice keeps the LAST choice, so the order of a stored array
  // never decides which one applies.
  assert.deepEqual(
    sessionRightsDecisions({ rightsDecisions: [{ work: 'a', kind: 'output-licence', licence: 'MIT' }, { work: 'a', kind: 'output-licence', licence: 'CC-BY-SA-4.0' }] }),
    [{ work: 'a', kind: 'output-licence', licence: 'CC-BY-SA-4.0' }],
  );
});

function json(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (v instanceof Uint8Array ? Array.from(v) : v));
}


test('saved vector sources survive reopening without an emoji provider and exclude hidden source copies', async () => {
  const original = await mounted('twemoji', ORIGINAL);
  const census = (await original.runtime.applyEmojiToDom(original.canvas)).census as EmojiLineSource[];
  const { host, renders } = hostDouble(undefined);
  const tool = toolDouble(); tool.template = '<svg><path d="M0 0h10v10z"/></svg>';
  const runtime = await createRuntime(tool, host), canvas = page(runtime.getHydrated());
  const vector = canvas.querySelector('svg')!;
  vector.setAttribute('data-emoji-vector-sources', JSON.stringify(census));
  const hidden = vector.cloneNode(true) as Element; hidden.setAttribute('data-export-hide', ''); canvas.append(hidden);
  const pass = await runtime.applyEmojiToDom(canvas);
  assert.equal(pass.census.length, 1);
  assert.equal(pass.census[0]!.occurrences.length, census[0]!.occurrences.length);
  assert.equal(runtime.rights().plan.required.length, 1);
  await runtime.export(canvas, 'png', { c2pa: true });
  assert.deepEqual(renders[0]!.ingredients, emojiSourceIngredients(census));
  assert.equal(runtime.lastReceipt?.state, 'readback-confirmed');
});
