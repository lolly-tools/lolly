// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { newSourceCaptureDiagnostics, observeSourceCaptures, SOURCE_CAPTURE_BYTE_LIMIT,
  SOURCE_CAPTURE_IMAGE_LIMIT, SOURCE_CAPTURE_LIMIT } from './helpers/sequence-capture-diagnostics.ts';

const node = (images: unknown[] = []) => ({ querySelectorAll: () => images });
const canvas = (bytes = new Uint8ClampedArray([20, 40, 60, 255])) => ({ width: 1, height: 1,
  getContext: () => ({ getImageData: () => ({ data: bytes }) }) });

test('source diagnostics hash the actual RGBA and preserve native capture identity and arguments', async () => {
  const source = node([{ complete: true, naturalWidth: 8, naturalHeight: 9 },
    { complete: false }, { complete: true, naturalWidth: 0, naturalHeight: 0 }]);
  const actual = canvas(), options = { width: 1 }, calls: unknown[][] = [];
  const library = { async toCanvas(...args: unknown[]) { assert.equal(this, library); calls.push(args); return actual; } };
  const original = library.toCanvas, run = newSourceCaptureDiagnostics();
  assert.equal(run.enabled, false);
  const restore = observeSourceCaptures(library, run);
  assert.equal(run.enabled, true);
  assert.equal(await library.toCanvas(source, options), actual);
  assert.deepEqual(calls, [[source, options]]);
  assert.deepEqual(run.captures[0], { index: 0, width: 1, height: 1,
    images: { total: 3, checked: 3, ready: 1, pending: 1, failed: 1, overflow: 0 }, status: 'HASHED',
    rgbaSha256: createHash('sha256').update(new Uint8Array([20, 40, 60, 255])).digest('hex') });
  restore(); restore(); assert.equal(library.toCanvas, original);
});

test('changed source pixels produce changed full hashes independently of capture size', async () => {
  let value = 1;
  const library = { async toCanvas(_source: ReturnType<typeof node>) { return canvas(new Uint8ClampedArray([value++, 0, 0, 255])); } };
  const run = newSourceCaptureDiagnostics(), restore = observeSourceCaptures(library, run);
  try { await library.toCanvas(node()); await library.toCanvas(node()); }
  finally { restore(); }
  assert.notEqual(run.captures[0]!.rgbaSha256, run.captures[1]!.rgbaSha256);
  assert.ok(run.captures.every(row => row.status === 'HASHED'));
});

test('capture failure identity and rejection survive the observer', async () => {
  const error = new Error('original capture error'), run = newSourceCaptureDiagnostics();
  const library = { async toCanvas(_source: ReturnType<typeof node>) { throw error; } }, restore = observeSourceCaptures(library, run);
  try { await assert.rejects(() => library.toCanvas(node()), cause => cause === error); }
  finally { restore(); }
  assert.equal(run.captures[0]!.status, 'CAPTURE_REFUSED');
});

test('source diagnostics bound captures and image inspection without exposing addresses', async () => {
  const privateImage = { complete: true, naturalWidth: 1, naturalHeight: 1,
    src: 'https://private.invalid/picture?credential=held' };
  const images = Array.from({ length: SOURCE_CAPTURE_IMAGE_LIMIT + 1 }, () => privateImage);
  const run = newSourceCaptureDiagnostics(), library = { async toCanvas(_source: ReturnType<typeof node>) { return canvas(); } };
  const restore = observeSourceCaptures(library, run);
  try { for (let i = 0; i < SOURCE_CAPTURE_LIMIT + 2; i++) await library.toCanvas(node(images)); }
  finally { restore(); }
  assert.equal(run.captures.length, SOURCE_CAPTURE_LIMIT); assert.equal(run.overflow, 2);
  assert.equal(run.captures[0]!.images.overflow, 1);
  assert.equal(run.captures[0]!.images.ready, SOURCE_CAPTURE_IMAGE_LIMIT);
  assert.doesNotMatch(JSON.stringify(run), /credential|private\.invalid|picture/);
});

test('oversized source capture refuses readback before allocating pixel storage', async () => {
  let read = false;
  const actual = { width: SOURCE_CAPTURE_BYTE_LIMIT / 4 + 1, height: 1,
    getContext: () => { read = true; throw new Error('should not read'); } };
  const library = { async toCanvas(_source: ReturnType<typeof node>) { return actual; } }, run = newSourceCaptureDiagnostics();
  const restore = observeSourceCaptures(library, run);
  try { assert.equal(await library.toCanvas(node()), actual); }
  finally { restore(); }
  assert.equal(read, false); assert.equal(run.captures[0]!.status, 'TOO_LARGE');
  assert.equal(run.captures[0]!.rgbaSha256, null);
});

test('refused or incomplete readback stays explicit and does not change capture success', async () => {
  for (const getContext of [() => null, () => ({ getImageData: () => ({ data: new Uint8ClampedArray(1) }) }),
    () => { throw new Error('readback refused'); }]) {
    const actual = { width: 1, height: 1, getContext }, library = { async toCanvas(_source: ReturnType<typeof node>) { return actual; } };
    const run = newSourceCaptureDiagnostics(), restore = observeSourceCaptures(library, run);
    try { assert.equal(await library.toCanvas(node()), actual); }
    finally { restore(); }
    assert.equal(run.captures[0]!.status, 'READBACK_REFUSED');
    assert.equal(run.captures[0]!.rgbaSha256, null);
  }
});

test('observer restoration preserves a later independent capture replacement', () => {
  const library = { async toCanvas() { return canvas(); } }, later = async () => canvas();
  const restore = observeSourceCaptures(library, newSourceCaptureDiagnostics());
  library.toCanvas = later; restore(); assert.equal(library.toCanvas, later);
});

function cacheComparisonProgram(context: Record<string, unknown>): (options: unknown) => Promise<{
  on: { raw: string[] }; off: { raw: string[] }; rawMismatch: unknown;
  sourceDiagnostic: { diagnosticOnly: boolean; originalFailurePreserved: boolean; comparison: { rawEqual: boolean } } | null;
}> {
  const source = readFileSync(new URL('./lift-flythrough.browser.test.ts', import.meta.url), 'utf8');
  const start = source.indexOf("test('cached and uncached shadows encode");
  const tree = ts.createSourceFile('lift.ts', source, ts.ScriptTarget.Latest, true);
  let callback: ts.ArrowFunction | undefined;
  const visit = (node: ts.Node): void => {
    if (!callback && node.getStart(tree) > start && ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'evaluate'
      && ts.isArrowFunction(node.arguments[0]!)) callback = node.arguments[0] as ts.ArrowFunction;
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.ok(callback, 'exercise the actual in-page cache comparison');
  const js = ts.transpileModule(`(${callback.getText(tree)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return runInNewContext(js, context);
}

for (const mismatch of [false, true]) {
  test(`the actual cache comparison observes source only after original mismatch=${mismatch}`, async () => {
    const calls: { captureSourceDiagnostic?: boolean; signal?: AbortSignal }[] = [];
    let pair = 0;
    const originalOff = Array(4).fill('a'.repeat(64)), originalOn = Array(4).fill((mismatch ? 'b' : 'a').repeat(64));
    const deadlines: number[] = [], cleared: unknown[] = [];
    const context = { window: { SEQ: {
      beginRawComparison() { pair++; },
      async exportSeq(_spec: unknown, _format: unknown, options: { captureSourceDiagnostic?: boolean; signal?: AbortSignal }) {
        calls.push(options);
        const rawHashes = calls.length === 1 ? originalOff : calls.length === 2 ? originalOn : Array(4).fill('c'.repeat(64));
        return { key: 'held', error: null, size: 1, ms: 1, rawHashes };
      },
      async frameHashes() { return Array(4).fill('d'.repeat(64)); },
      takeRawComparison() { return pair === 1 ? mismatch ? { rawEqual: false } : null : { rawEqual: true }; },
    } }, AbortController, console: { info() {} },
    setTimeout(_callback: unknown, ms: number) { deadlines.push(ms); return 1; },
    clearTimeout(id: unknown) { cleared.push(id); } };
    const actual = await cacheComparisonProgram(context)({ spec: {}, fps: 15, width: 480, last: 59, prefix: 'held' });
    assert.equal(calls.length, mismatch ? 4 : 2);
    assert.equal(calls[0]!.captureSourceDiagnostic, undefined);
    assert.equal(calls[1]!.captureSourceDiagnostic, undefined);
    assert.equal(actual.off.raw, originalOff); assert.equal(actual.on.raw, originalOn);
    if (mismatch) {
      assert.ok(calls[2]!.captureSourceDiagnostic && calls[3]!.captureSourceDiagnostic);
      assert.equal(calls[2]!.signal, calls[3]!.signal, 'one shared diagnostic deadline');
      assert.deepEqual(deadlines, [30_000]); assert.deepEqual(cleared, [1]);
      assert.equal(actual.sourceDiagnostic!.diagnosticOnly, true);
      assert.equal(actual.sourceDiagnostic!.originalFailurePreserved, true);
      assert.equal(actual.sourceDiagnostic!.comparison.rawEqual, true);
      assert.throws(() => assert.deepEqual(actual.on.raw, actual.off.raw), 'diagnostic success cannot rescue the original oracle');
    } else {
      assert.equal(actual.sourceDiagnostic, null); assert.equal(actual.rawMismatch, null);
      assert.equal(deadlines.length, 0);
    }
  });
}
