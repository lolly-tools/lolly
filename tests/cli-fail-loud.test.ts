// SPDX-License-Identifier: MPL-2.0
/**
 * "Wrong file, exit 0" is the worst thing this CLI can do — these cases pin that it
 * doesn't.
 *
 * Every case here corresponds to a defect where the shell produced a plausible-looking
 * artifact and reported success:
 *
 *   1. HTML SUBSTITUTION. `--export=svg --output=aa.svg` on an HTML-layout tool wrote
 *      aa.HTML, exit 0, and aa.svg never existed. Now the run fails, nothing is written
 *      at the requested path, and the HTML artifact exists only behind --html-fallback.
 *   2. VECTOR ESCALATION. svg/emf/eps/dxf never tried the browser tier, even though the
 *      web shell's HTML→SVG walker produces real vector for exactly that case.
 *   3. FORMAT MISMATCH. `--export=avif` wrote PNG bytes under the .avif name.
 *   4. ENCRYPTED LINKS. `--zx=<token>` with a missing or wrong password rendered the
 *      tool's DEFAULTS and exited 0.
 *   5. PRINT PREP. `--bleed --marks` on a format that cannot carry page geometry was a
 *      byte-for-byte no-op with no warning.
 *   6. BROWSER ESCALATION was keyed on error PROSE across a submodule boundary.
 *   7. Unknown flags were swallowed silently.
 *
 * Hermetic, like tests/cli-redact-instructions.test.ts: a fixture repo pinned via
 * LOLLY_ROOT, and LOLLY_WEB_DIST pointed at a directory with no built shell so the
 * browser tier is deterministically absent and no Chromium is ever launched. The
 * WORKING half of the escalation (a real SVG out of an HTML-layout tool) needs a built
 * shell and a browser, so it is verified by hand, not here; what is pinned here is that
 * the escalation is attempted and that its failure is loud.
 *
 * Run with: node --test tests/cli-fail-loud.test.ts
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { packEncrypted } from '../engine/src/url-pack.ts';
import { sniffFormat, assertFormatBytes, FormatMismatchError } from '../packages/node-shell/src/format-sniff.ts';

const root = await mkdtemp(join(tmpdir(), 'lolly-fail-loud-'));
after(() => rm(root, { recursive: true, force: true }));

function manifest(id: string, formats: string[]): string {
  return JSON.stringify({
    id,
    name: id,
    version: '1.0.0',
    engineVersion: '^1.0.0',
    status: 'community',
    render: { width: 120, height: 80, formats },
    inputs: [{ id: 'label', type: 'text', label: 'Label', default: 'hello' }],
  });
}

// layout-tool: an HTML layout with TWO drawable children, so the bridge's rootSvgOf
// answers null (a container with two children is a layout, not a wrapper) — the exact
// shape that used to trigger the silent svg→html substitution.
const LAYOUT_TEMPLATE = '<div><p>{{label}}</p><p>second box</p></div>';
// vec-tool: a native <svg>, so the DOM-free path succeeds and nothing escalates.
const VEC_TEMPLATE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">' +
  '<rect width="120" height="80" fill="#3cb44b"/></svg>';

await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets'), { recursive: true });
await writeFile(
  join(root, 'catalog', 'tools', 'index.json'),
  JSON.stringify({ version: '1', tools: [{ id: 'layout-tool' }, { id: 'vec-tool' }] }),
);
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [] }));

for (const [id, template, formats] of [
  ['layout-tool', LAYOUT_TEMPLATE, ['svg', 'png']],
  ['vec-tool', VEC_TEMPLATE, ['svg', 'png', 'avif']],
] as Array<[string, string, string[]]>) {
  await mkdir(join(root, 'tools', id), { recursive: true });
  await writeFile(join(root, 'tools', id, 'tool.json'), manifest(id, formats));
  await writeFile(join(root, 'tools', id, 'template.html'), template);
}

// Pin the run → bridge chain to the fixture BEFORE the first import, and pin the
// browser tier to a directory with no built shell so it is deterministically absent.
process.env.LOLLY_ROOT = root;
process.env.LOLLY_WEB_DIST = join(root, 'no-such-dist');
delete process.env.LOLLY_WEB_BASE;
const { runToolCli, needsBrowserTier, unknownFlags } = await import('../shells/cli/src/run.ts');

/**
 * Run the CLI, capturing the stderr it would print. `stderr` is filled in whether the
 * run resolves or throws — several of these cases care about what was printed BEFORE a
 * failure (the escalation note), which a return value alone cannot carry.
 */
async function run(args: Parameters<typeof runToolCli>[0]): Promise<{ stderr: string }> {
  const chunks: string[] = [];
  const result = { get stderr() { return chunks.join(''); } };
  const orig = process.stderr.write.bind(process.stderr);
  (process.stderr as { write: unknown }).write = (s: string) => { chunks.push(String(s)); return true; };
  try {
    await runToolCli(args);
    return result;
  } finally {
    (process.stderr as { write: unknown }).write = orig;
  }
}

let seq = 0;
const outPath = (ext: string): string => join(root, `out-${seq++}.${ext}`);

// ── 1. the HTML substitution, the highest-risk previously-untested behaviour ──

test('an unproducible format FAILS instead of writing HTML under the requested name', async () => {
  const out = outPath('svg');
  await assert.rejects(
    () => run({ toolId: 'layout-tool', params: {}, outputPath: out, format: 'svg' }),
    (e: Error & { code?: string }) => {
      assert.match(e.message, /Cannot export "svg"/);
      // Both halves named: no browser-free path AND the tier that could is missing.
      assert.match(e.message, /No browser-free path/);
      assert.match(e.message, /No built web shell/);
      assert.match(e.message, /No file was written/);
      // A typed marker, so `lolly smoke` can classify this without reading prose.
      assert.equal(e.code, 'FORMAT_UNAVAILABLE');
      return true;
    },
  );
  assert.equal(existsSync(out), false, 'nothing may be written at the requested path');
  assert.equal(existsSync(out.replace(/\.svg$/, '.html')), false, 'and no renamed HTML sibling either');
});

test('--html-fallback is the ONLY way to get HTML, and it says the name changed', async () => {
  const out = outPath('svg');
  const { stderr } = await run({ toolId: 'layout-tool', params: {}, outputPath: out, format: 'svg', htmlFallback: true });
  const html = out.replace(/\.svg$/, '.html');
  assert.equal(existsSync(out), false, 'the requested .svg is still never written');
  assert.equal(existsSync(html), true, 'the opted-in HTML artifact is');
  assert.match(stderr, /--html-fallback was given/);
  assert.match(stderr, /NOT the name you asked for/);
});

test('a tool that CAN make the format is untouched by any of this', async () => {
  const out = outPath('svg');
  await run({ toolId: 'vec-tool', params: {}, outputPath: out, format: 'svg' });
  assert.equal(existsSync(out), true);
});

// ── 2. vector formats escalate to the browser tier ───────────────────────────

test('svg on an HTML-layout tool ESCALATES to the browser tier before giving up', async () => {
  const out = outPath('svg');
  const chunks: string[] = [];
  const orig = process.stderr.write.bind(process.stderr);
  (process.stderr as { write: unknown }).write = (s: string) => { chunks.push(String(s)); return true; };
  try {
    await assert.rejects(() => runToolCli({ toolId: 'layout-tool', params: {}, outputPath: out, format: 'svg' }));
  } finally {
    (process.stderr as { write: unknown }).write = orig;
  }
  // The note is printed before the tier is tried, so it survives the rejection.
  assert.match(chunks.join(''), /Escalating to the browser render tier/);
});

test('escalation is gated on the error TYPE, not its wording', async () => {
  // A RenderIntegrityError means this runtime's own render is broken; re-running it in a
  // browser would only launder the bug, so it must NOT escalate. Modelled by a tool whose
  // onInit throws — the runtime records it in hookErrors and assertRenderOk refuses.
  await mkdir(join(root, 'tools', 'broken-tool'), { recursive: true });
  await writeFile(join(root, 'tools', 'broken-tool', 'tool.json'), JSON.stringify({
    id: 'broken-tool', name: 'broken-tool', version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
    render: { width: 120, height: 80, formats: ['svg'] }, hooks: { onInit: true }, inputs: [],
  }));
  await writeFile(join(root, 'tools', 'broken-tool', 'template.html'), VEC_TEMPLATE);
  await writeFile(join(root, 'tools', 'broken-tool', 'hooks.js'), 'function onInit() { throw new Error("deliberate hook failure"); }\n');
  const out = outPath('svg');
  const chunks: string[] = [];
  const orig = process.stderr.write.bind(process.stderr);
  (process.stderr as { write: unknown }).write = (s: string) => { chunks.push(String(s)); return true; };
  try {
    await assert.rejects(
      () => runToolCli({ toolId: 'broken-tool', params: {}, outputPath: out, format: 'svg' }),
      (e: Error) => {
        assert.equal(e.name, 'RenderIntegrityError');
        assert.match(e.message, /render produced no usable output/);
        return true;
      },
    );
  } finally {
    (process.stderr as { write: unknown }).write = orig;
  }
  assert.doesNotMatch(chunks.join(''), /Escalating/, 'a broken render must not be re-run elsewhere');
  assert.equal(existsSync(out), false);
});

// ── 3. the encoder returned a different format than requested ────────────────

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);

test('sniffFormat identifies the containers the CLI writes', () => {
  assert.equal(sniffFormat(PNG_BYTES), 'png');
  assert.equal(sniffFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'jpg');
  assert.equal(sniffFormat(new TextEncoder().encode('%PDF-1.7\n')), 'pdf');
  assert.equal(sniffFormat(new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="x"/>')), 'svg');
  assert.equal(sniffFormat(new TextEncoder().encode('%!PS-Adobe-3.0 EPSF-3.0')), 'eps');
  assert.equal(sniffFormat(new Uint8Array([0x76, 0x2f, 0x31, 0x01])), 'exr');
  // RIFF….WEBP
  const webp = new Uint8Array(16);
  webp.set(new TextEncoder().encode('RIFF'), 0);
  webp.set(new TextEncoder().encode('WEBP'), 8);
  assert.equal(sniffFormat(webp), 'webp');
  // No opinion on something unrecognised — "unknown" must never mean "wrong".
  assert.equal(sniffFormat(new TextEncoder().encode('id,name\n1,x\n')), null);
});

test('PNG bytes requested as avif are REFUSED, not written', () => {
  assert.throws(
    () => assertFormatBytes('avif', PNG_BYTES),
    (e: FormatMismatchError) => {
      assert.equal(e.name, 'FormatMismatchError');
      assert.equal(e.requested, 'avif');
      assert.equal(e.produced, 'png');
      assert.match(e.message, /No file was written/);
      // The refusal must not be swallowable by the HTML-fallback signature, the same
      // discipline deepSourceRefusal keeps in packages/node-shell/src/raster.ts.
      assert.doesNotMatch(e.message, /browser engine|needs a browser|requires an|<svg>|no built web shell|chromium/i);
      return true;
    },
  );
});

test('the sniff only ever fires on a positive identification of something else', () => {
  assertFormatBytes('png', PNG_BYTES);                                    // right container
  assertFormatBytes('json', PNG_BYTES);                                   // unchecked format
  assertFormatBytes('avif', new TextEncoder().encode('who knows'));       // unrecognised bytes
  assertFormatBytes('pdf-cmyk', new TextEncoder().encode('%PDF-1.7'));    // variant of a container
});

// ── 4. encrypted share links ─────────────────────────────────────────────────

const ZX = (await packEncrypted('label=from%20the%20locked%20link', 'hunter2'))!;

test('a zx link with the right password renders the ENCRYPTED state', async () => {
  const out = outPath('svg');
  await run({ toolId: 'vec-tool', params: { zx: ZX, 'link-password': 'hunter2' }, outputPath: out, format: 'svg' });
  assert.equal(existsSync(out), true);
});

test('a zx link with NO password fails; it never renders defaults', async () => {
  const out = outPath('svg');
  await assert.rejects(
    () => run({ toolId: 'vec-tool', params: { zx: ZX }, outputPath: out, format: 'svg' }),
    /password-protected link .* no password was given/s,
  );
  assert.equal(existsSync(out), false);
});

test('a zx link with the WRONG password fails; it never renders defaults', async () => {
  const out = outPath('svg');
  await assert.rejects(
    () => run({ toolId: 'vec-tool', params: { zx: ZX, 'link-password': 'nope' }, outputPath: out, format: 'svg' }),
    /the password is wrong, or the token is truncated or tampered with/,
  );
  assert.equal(existsSync(out), false);
});

test('--password stands in for --link-password when the link is encrypted', async () => {
  const out = outPath('svg');
  await run({ toolId: 'vec-tool', params: { zx: ZX, password: 'hunter2' }, outputPath: out, format: 'svg' });
  assert.equal(existsSync(out), true);
});

// ── 5. print prep that cannot be applied ─────────────────────────────────────

test('--bleed/--marks on a format that cannot carry page geometry is refused', async () => {
  const cases: Array<Record<string, string>> = [{ bleed: '3mm' }, { marks: 'crop,reg' }];
  for (const dims of cases) {
    const out = outPath('png');
    await assert.rejects(
      () => run({ toolId: 'vec-tool', params: dims, outputPath: out, format: 'png' }),
      (e: Error) => {
        assert.match(e.message, /cannot be applied to "png"/);
        assert.match(e.message, /pdf, pdf-cmyk, cmyk-tiff/);
        assert.match(e.message, /No file was written/);
        return true;
      },
    );
    assert.equal(existsSync(out), false, 'a silent no-op would have written a file here');
  }
});

test('a format that CAN carry page geometry is not refused by that check', async () => {
  // It still fails (no browser tier in this fixture), but for the tier reason, never
  // "--bleed cannot be applied" — the allowlist must not be over-broad.
  const out = outPath('pdf');
  await assert.rejects(
    () => run({ toolId: 'vec-tool', params: { bleed: '3mm' }, outputPath: out, format: 'pdf' }),
    (e: Error) => {
      assert.doesNotMatch(e.message, /cannot be applied/);
      return true;
    },
  );
});

// ── 6. the browser-escalation sentinel ───────────────────────────────────────

test('needsBrowserTier prefers a typed sentinel over prose', () => {
  assert.equal(needsBrowserTier(Object.assign(new Error('anything at all'), { code: 'NEEDS_BROWSER' })), true);
  assert.equal(needsBrowserTier(Object.assign(new Error('anything at all'), { needsBrowser: true })), true);
  assert.equal(needsBrowserTier(new Error('anything at all')), false);
});

test('needsBrowserTier still accepts the prose already shipped by tools', () => {
  // The string form (what the older tests and the MCP twin call it with).
  assert.equal(needsBrowserTier('Redacting this file needs a browser canvas.'), true);
  assert.equal(needsBrowserTier('PDF redaction is not available in this app.'), true);
  // THE BUG: convert-image's hook says "isn't", the old regex demanded "not".
  assert.equal(needsBrowserTier("Image conversion isn't available in this app."), true);
  assert.equal(needsBrowserTier('Image conversion isn’t available in this app.'), true);
  // A verification failure is never mistaken for a missing capability.
  assert.equal(needsBrowserTier('Verification failed: the rebuilt PDF still carries Info.'), false);
  assert.equal(needsBrowserTier(null), false);
  assert.equal(needsBrowserTier(undefined), false);
});

// ── 7. unknown flags ─────────────────────────────────────────────────────────

test('unknownFlags names typos and stays quiet about everything legitimate', () => {
  const m = {
    inputs: [
      { id: 'url', type: 'text', urlKey: 'u' },
      { id: 'rows', type: 'blocks' },
      { id: 'size', type: 'vector' },
    ],
  };
  assert.deepEqual(unknownFlags({ urll: 'x' }, m), ['urll']);
  assert.deepEqual(unknownFlags({ url: 'x', u: 'y' }, m), []);              // id and urlKey alias
  assert.deepEqual(unknownFlags({ 'rows-data': 'r.csv' }, m), []);          // the data-file flag
  assert.deepEqual(unknownFlags({ 'size.w': '3' }, m), []);                 // a vector field
  assert.deepEqual(unknownFlags({ format: 'png', c2pa: '30', lang: 'de' }, m), []);   // reserved
  assert.deepEqual(unknownFlags({ 'press-profile': 'fogra39', 'html-fallback': '1', 'link-password': 'x' }, m), []);
});

test('an unknown flag warns but does not fail the render', async () => {
  const out = outPath('svg');
  const { stderr } = await run({ toolId: 'vec-tool', params: { labell: 'typo' }, outputPath: out, format: 'svg' });
  assert.match(stderr, /--labell is not an input of "vec-tool"/);
  assert.equal(existsSync(out), true, 'url mode is deliberately tolerant of extra params');
});
