// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { newSourceCaptureDiagnostics, observeSourceCaptures, SOURCE_CAPTURE_BYTE_LIMIT,
  SOURCE_CAPTURE_IMAGE_LIMIT, SOURCE_CAPTURE_LIMIT } from './helpers/sequence-capture-diagnostics.ts';
import { newPlateShare, plateShareSummary, recordPlates, replayPlates, shotSignature } from './helpers/sequence-plate-share.ts';

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
  on: { raw: string[] }; off: { raw: string[] }; rawMismatch: unknown; plates: unknown;
  sourceDiagnostic: { diagnosticOnly: boolean; originalFailurePreserved: boolean; plates: unknown; comparison: { rawEqual: boolean } } | null;
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
    const calls: { captureSourceDiagnostic?: boolean; signal?: AbortSignal; plates?: string }[] = [];
    let pair = 0, shares = 0, taken = 0;
    const shareSummary = (n: number) => ({ recorded: 12, replayed: 12, captureMs: n, refused: null, failed: 0, failures: [] });
    const originalOff = Array(4).fill('a'.repeat(64)), originalOn = Array(4).fill((mismatch ? 'b' : 'a').repeat(64));
    const deadlines: number[] = [], cleared: unknown[] = [];
    const context = { window: { SEQ: {
      beginRawComparison() { pair++; },
      beginPlateShare() { shares++; },
      takePlateShare() { taken++; return shareSummary(shares); },
      async exportSeq(_spec: unknown, _format: unknown, options: { captureSourceDiagnostic?: boolean; signal?: AbortSignal; plates?: string }) {
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
    assert.deepEqual(calls.map(call => call.plates), mismatch ? ['record', 'replay', 'record', 'replay'] : ['record', 'replay'],
      'every pair composites one set of plates');
    assert.equal(shares, mismatch ? 2 : 1, 'each pair starts its own plate share');
    assert.ok(taken > shares, 'every share is taken back, including on the way out');
    assert.deepEqual(actual.plates, shareSummary(1), 'the original pair reports its own share');
    assert.equal(actual.off.raw, originalOff); assert.equal(actual.on.raw, originalOn);
    if (mismatch) {
      assert.ok(calls[2]!.captureSourceDiagnostic && calls[3]!.captureSourceDiagnostic);
      assert.deepEqual(actual.sourceDiagnostic!.plates, shareSummary(2), 'the diagnostic pair reports a fresh share');
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

// ── plate sharing: one render's captures, answered into the next ─────────────

const shotNode = (z: string, src = 'data:image/svg+xml,held') => ({
  tagName: 'DIV', className: 'lolly-box',
  getAttribute: (name: string) => (name === 'data-t-z' ? z : null),
  querySelectorAll: () => [{ getAttribute: (name: string) => (name === 'src' ? src : null) }],
});
const shot = (width: number, height = 10) => ({ width, height, style: { transform: 'scale(0.5)', width: '960px', height: '540px' } });

test('a recorded capture is passed through unchanged and replayed as the same canvas, in order', async () => {
  const first = { id: 'first' }, second = { id: 'second' }, calls: unknown[][] = [];
  const results = [first, second];
  const library = { async toCanvas(...args: unknown[]) { assert.equal(this, library); calls.push(args); return results[calls.length - 1]; } };
  const original = library.toCanvas, share = newPlateShare();
  let clock = 0;
  const stopRecording = recordPlates(library, share, () => (clock += 5));
  const a = shotNode('10'), b = shotNode('20');
  assert.equal(await library.toCanvas(a, shot(100)), first);
  assert.equal(await library.toCanvas(b, shot(200)), second);
  stopRecording();
  assert.equal(library.toCanvas, original);
  assert.deepEqual(calls, [[a, shot(100)], [b, shot(200)]]);
  assert.equal(share.captureMs, 10, 'each capture is timed once');

  const stopReplay = replayPlates(library, share);
  try {
    assert.equal(await library.toCanvas(shotNode('10'), shot(100)), first, 'the cached render draws the very canvas the control drew');
    assert.equal(await library.toCanvas(shotNode('20'), shot(200)), second);
  } finally { stopReplay(); }
  assert.equal(calls.length, 2, 'a replay never captures');
  assert.deepEqual(plateShareSummary(share), { recorded: 2, replayed: 2, captureMs: 10, refused: null, failed: 0, failures: [] });
});

test('a replay refuses a capture that does not match the recording, and says so on the share', async () => {
  const library = { async toCanvas(_node: unknown, _options: unknown) { return { id: 'plate' }; } };
  for (const [node, options, why] of [
    [shotNode('10'), shot(101), /asked for/],
    [shotNode('11'), shot(100), /asked for/],
    [shotNode('10', 'data:image/svg+xml,longer'), shot(100), /asked for/],
  ] as const) {
    const share = newPlateShare();
    const stopRecording = recordPlates(library, share);
    await library.toCanvas(shotNode('10'), shot(100));
    stopRecording();
    const stopReplay = replayPlates(library, share);
    try { await assert.rejects(() => library.toCanvas(node, options), /plate replay refused/); }
    finally { stopReplay(); }
    assert.match(String(plateShareSummary(share).refused), why);
    assert.equal(plateShareSummary(share).replayed, 0);
  }
});

test('a replay refuses a capture past the end of the recording and reports plates it never used', async () => {
  const library = { async toCanvas(_node: unknown, _options: unknown) { return { id: 'plate' }; } };
  const share = newPlateShare();
  const stopRecording = recordPlates(library, share);
  await library.toCanvas(shotNode('10'), shot(100));
  await library.toCanvas(shotNode('20'), shot(200));
  stopRecording();
  let stopReplay = replayPlates(library, share);
  await library.toCanvas(shotNode('10'), shot(100));
  stopReplay();
  assert.match(String(plateShareSummary(share).refused), /1 recorded plate\(s\) were never asked for/);

  const short = newPlateShare();
  const stop = recordPlates(library, short);
  await library.toCanvas(shotNode('10'), shot(100));
  stop();
  stopReplay = replayPlates(library, short);
  try {
    await library.toCanvas(shotNode('10'), shot(100));
    await assert.rejects(() => library.toCanvas(shotNode('20'), shot(200)), /capture 2 has no recording \(1 recorded\)/);
  } finally { stopReplay(); }
  assert.match(String(plateShareSummary(null).refused), /no plate share was started/);
});

test('a capture that failed while recording fails again on replay, so both renders lose the same plate', async () => {
  const error = new Error('capture refused');
  const library = { async toCanvas(_node: unknown, _options: unknown): Promise<unknown> { throw error; } };
  const share = newPlateShare();
  const stopRecording = recordPlates(library, share);
  await assert.rejects(() => library.toCanvas(shotNode('10'), shot(100)), cause => cause === error);
  stopRecording();
  const stopReplay = replayPlates(library, share);
  try { await assert.rejects(() => library.toCanvas(shotNode('10'), shot(100)), cause => cause === error); }
  finally { stopReplay(); }
  assert.deepEqual(plateShareSummary(share), {
    recorded: 1, replayed: 1, captureMs: share.captureMs, refused: null, failed: 1, failures: ['capture refused'],
  });
});

test('plate sharing restores the library and keeps a later independent replacement', () => {
  const library = { async toCanvas(_node: unknown, _options: unknown): Promise<unknown> { return null; } };
  const original = library.toCanvas, later = async () => null;
  const stopRecording = recordPlates(library, newPlateShare());
  stopRecording(); stopRecording();
  assert.equal(library.toCanvas, original);
  const stopReplay = replayPlates(library, newPlateShare());
  library.toCanvas = later; stopReplay();
  assert.equal(library.toCanvas, later);
});

test('a shot signature names the node shape and shot options without carrying image addresses', () => {
  const signature = shotSignature(shotNode('42', 'https://private.invalid/picture?credential=held'), shot(300, 200));
  assert.doesNotMatch(signature, /credential|private\.invalid|picture/);
  assert.match(signature, /"42"/);
  assert.notEqual(signature, shotSignature(shotNode('42', 'https://private.invalid/other'), shot(300, 200)));
  assert.equal(shotSignature(null, undefined), shotSignature({}, {}));
});
