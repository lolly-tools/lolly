// SPDX-License-Identifier: MPL-2.0
/**
 * The web export bridge's own rights receipt (plan 253 section 8.4), driven
 * through the real `createExportAPI().render`, not a host double.
 *
 * tests/rights-runtime.test.ts proves the runtime hands a plan to the host and
 * keeps the receipt it gets back; its host stamps and reads back by itself. This
 * file proves the other half: that shells/web/src/bridge/export.ts stamps the
 * export, reads the finished bytes back and reports exactly one receipt, and
 * that a credential that was never written never reads as a delivered credit.
 *
 * The technique is tests/export-still-frame-clock.test.ts's: a fake dom-to-image
 * and a plain-object node, so the real renderer, stamp and readback run with no
 * browser.
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test tests/rights-export-bridge.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createExportAPI, __setDomToImageForTest } from '../shells/web/src/bridge/export.ts';
import type { WebHost } from '../shells/web/src/bridge/export-shared.ts';
import { evaluateCreativeUses } from '../engine/src/rights-evaluate.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import type { C2paSourceIngredient } from '../engine/src/c2pa.ts';
import type { AttributionReceiptV1, CreativeWorkRecordV1 } from '../packages/core/src/rights-v1.ts';

// A 1x1 transparent PNG: what the dataURL path of renderRaster fetches and stamps.
const ONE_PX_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const SOURCE_URL = 'https://raw.githubusercontent.com/jdecked/twemoji/v17.0.3/assets/svg/1f600.svg';

const TITLE = 'grinning face (Twemoji Color 17.0.3)';

/** One placed glyph, with the pack's own licence declaration. */
const placedWork: CreativeWorkRecordV1 = {
  id: 'community/emoji/twemoji/color/1f600',
  title: TITLE,
  creators: [{ name: 'Twemoji', role: 'creator' }],
  sourceUrl: SOURCE_URL,
  sourceHash: `sha256:${'07'.repeat(32)}`,
  rights: [{ declaration: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/', assertedBy: 'catalog', evidence: 'catalog-entry', status: 'parsed' }],
};

/** The same glyph as the source ingredient the runtime hands the bridge. */
const placed: C2paSourceIngredient = {
  credential: 'none',
  title: TITLE,
  format: 'image/svg+xml',
  relationship: 'componentOf',
  url: SOURCE_URL,
  hash: new Uint8Array(32).fill(7),
  rights: {
    creator: 'Twemoji', license: 'CC-BY-4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Twemoji by Twitter, licensed CC BY 4.0',
    sourceUrl: SOURCE_URL,
    modifications: [],
    sourceHash: `sha256:${'07'.repeat(32)}`,
    usedHash: `sha256:${'1a'.repeat(32)}`,
  },
};

function evaluation() {
  return evaluateCreativeUses({
    works: [placedWork],
    uses: [{ work: placedWork.id, role: 'incorporated', operations: ['placed'] }],
    context: {
      operation: 'render',
      delivery: { format: 'png', route: 'file-with-c2pa', canCarryCredential: true, canCarryReadableCredit: true },
      audience: 'unknown',
    },
  });
}

/** A canvas double: fixed size, readable pixels, encodable to a blob. */
function fakeCanvas(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4).fill(200);
  return {
    width,
    height,
    getContext: () => ({
      getImageData: () => ({ data, width, height }),
      putImageData: () => {},
      drawImage: () => {},
      fillRect: () => {},
      clearRect: () => {},
      fillStyle: '',
    }),
    toBlob: (cb: (b: Blob) => void, type?: string) => cb(new Blob([new Uint8Array([1, 2, 3])], { type: type || 'image/png' })),
  };
}

/** dom-to-image, faked: a still capture hands back a real one-pixel PNG. */
const domToImage = {
  toCanvas: (_node: unknown, opts: { width: number; height: number }) => fakeCanvas(opts.width, opts.height),
  toPng: () => ONE_PX_PNG,
  toJpeg: () => ONE_PX_PNG,
};

/** The export node: a plain object with only what the export entry reads. */
const node = {
  getBoundingClientRect: () => ({ width: 200, height: 150, x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 150 }),
  querySelectorAll: () => [] as unknown[],
  querySelector: () => null,
  matches: () => false,
} as unknown as Element;

/** Render one PNG through the bridge and collect every receipt it reports. */
async function exportPng(c2pa: boolean, host: WebHost = { log: () => {} } as unknown as WebHost): Promise<{ bytes: Uint8Array; receipts: AttributionReceiptV1[] }> {
  const g = globalThis as Record<string, unknown>;
  const saved = { doc: g.document, win: g.window };
  g.document = { fonts: { ready: Promise.resolve() }, createElement: () => fakeCanvas(1, 1) };
  g.window = {};
  __setDomToImageForTest(domToImage);
  const receipts: AttributionReceiptV1[] = [];
  const { plan, fingerprint } = evaluation();
  try {
    const blob = await createExportAPI(host).render(node, 'png', {
      width: 200, height: 150, c2pa,
      ingredients: [placed],
      rights: { plan, fingerprint, onReceipt: receipt => receipts.push(receipt) },
    });
    return { bytes: new Uint8Array(await blob.arrayBuffer()), receipts };
  } finally {
    __setDomToImageForTest(null);
    g.document = saved.doc;
    g.window = saved.win;
  }
}

test('the export bridge stamps the source, reads the finished bytes back and reports one confirmed receipt', async () => {
  const { plan, fingerprint } = evaluation();
  assert.equal(plan.required.length, 1, 'CC BY asks for a credit');
  const { bytes, receipts } = await exportPng(true);

  assert.equal(receipts.length, 1, 'exactly one receipt per delivered file');
  const receipt = receipts[0]!;
  assert.equal(receipt.state, 'readback-confirmed');
  assert.equal(receipt.fingerprint, fingerprint);
  assert.deepEqual(receipt.remaining, []);
  assert.deepEqual(receipt.observed, receipt.expected);
  assert.match(receipt.outputHash ?? '', /^sha256:[0-9a-f]{64}$/, 'the receipt names the bytes it read');
  assert.match(receipt.credits, /grinning face/);

  // The receipt is a reading of these bytes, so the same bytes must carry the source.
  const report = await verifyC2pa(bytes);
  assert.equal(report.state, 'valid');
  assert.equal(report.ingredients?.length, 1);
  assert.equal(report.ingredients![0]!.rights?.license, 'CC-BY-4.0');
});

test('with Content Credentials off the bridge still reads back, and says the credit is not in the file', async () => {
  const { bytes, receipts } = await exportPng(false);

  assert.equal(receipts.length, 1, 'a route with no credential still owes an answer');
  assert.equal(receipts[0]!.state, 'written');
  assert.deepEqual(receipts[0]!.remaining.map(issue => issue.code), ['credential.ingredient-missing']);
  assert.match(receipts[0]!.credits, /CC BY 4\.0/, 'the credit is there to deliver another way');
  assert.equal((await verifyC2pa(bytes)).found, false, 'and the file really carries no credential');
});

test('a stamp that fails ships the bytes, and the receipt says the credit did not travel', async () => {
  const logs: string[] = [];
  // An enrolled signer that cannot sign: signAndEmbedC2pa throws, stampC2pa logs and
  // returns the unstamped bytes, and only the readback can tell.
  const host = {
    log: (level: string, message: string) => { logs.push(`${level}:${message}`); },
    identity: { signer: async () => ({ sign: () => { throw new Error('signer unavailable'); } }) },
  } as unknown as WebHost;
  const { bytes, receipts } = await exportPng(true, host);

  assert.ok(logs.some(line => /Content Credentials not attached/.test(line)), `the failed stamp is logged: ${logs.join(' | ')}`);
  assert.ok(bytes.byteLength > 0, 'the file still ships');
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0]!.state, 'written');
  assert.deepEqual(receipts[0]!.remaining.map(issue => issue.code), ['credential.ingredient-missing']);
});
