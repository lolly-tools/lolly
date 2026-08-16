// SPDX-License-Identifier: MPL-2.0
/**
 * Machine-usable redaction instructions on the CLI (plans/37-redact-tool.md section 3).
 *
 * The bars array plus its options ARE the instruction format, and URL mode already
 * serialises them - so ONE canonical string has to survive a share link, an argv
 * invocation, and an MCP call. These cases pin the argv half:
 *
 *   • a `blocks` input arrives intact through --flag=… in tilde, JSON and CSV form;
 *   • a transform hook that can't run in the Node host escalates to the browser
 *     tier, and when that tier is missing the CLI says exactly what is missing
 *     instead of writing an unredacted or blank file;
 *   • a VERIFICATION failure is never mistaken for a missing capability - it fails
 *     the run, writes nothing, and keeps its own sentence;
 *   • --verify prints one line per file, only after the export gate ran clean.
 *
 * Hermetic: a fixture repo (LOLLY_ROOT) with fixture transform tools, and
 * LOLLY_WEB_DIST pointed at a directory with no built shell, so the browser tier
 * is deterministically unavailable and no Chromium is ever launched here. The real
 * browser-tier path is verified by hand against the built web shell (see the
 * plan's section 3 notes) - node:test must stay browser-free.
 *
 * Run with: node --test tests/cli-redact-instructions.test.ts
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = await mkdtemp(join(tmpdir(), 'lolly-redact-cli-'));
after(() => rm(root, { recursive: true, force: true }));

const BAR_FIELDS = [
  { id: 'page', type: 'number', label: 'Page' },
  { id: 'x', type: 'number', label: 'X' },
  { id: 'y', type: 'number', label: 'Y' },
  { id: 'w', type: 'number', label: 'W' },
  { id: 'h', type: 'number', label: 'H' },
];

function manifest(id: string): string {
  return JSON.stringify({
    id,
    name: id,
    version: '1.0.0',
    engineVersion: '^1.0.0',
    status: 'community',
    render: { width: 100, height: 100, formats: ['png'], export: false },
    hooks: { exportFile: true },
    inputs: [
      { id: 'source', type: 'file', label: 'File' },
      { id: 'bars', type: 'blocks', label: 'Bars', fields: BAR_FIELDS },
      { id: 'quantise', type: 'boolean', label: 'Quantise', default: true },
    ],
  });
}

// echo-tool: hands the committed instructions straight back, so a test can read what
// argv actually delivered to the hook. needs-browser / gate-fail model the two failure
// shapes the escalation has to tell apart.
const ECHO_HOOK = `
function exportFile({ model }) {
  var bars = (model.find(function (i) { return i.id === 'bars'; }) || {}).value;
  var quantise = (model.find(function (i) { return i.id === 'quantise'; }) || {}).value;
  var text = JSON.stringify({ bars: bars, quantise: quantise });
  var bytes = new Uint8Array(text.length);
  for (var i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return { bytes: bytes, mime: 'application/json', filename: 'echo.json' };
}
`;
const NEEDS_BROWSER_HOOK = `
function exportFile() { throw new Error('Redacting this file needs a browser canvas. Open this tool in the Lolly web app.'); }
`;
const GATE_FAIL_HOOK = `
function exportFile() { throw new Error('Verification failed: covered content is still present. Nothing was downloaded.'); }
`;

await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets'), { recursive: true });
await writeFile(
  join(root, 'catalog', 'tools', 'index.json'),
  JSON.stringify({ version: '1', tools: [{ id: 'echo-tool' }, { id: 'needs-browser' }, { id: 'gate-fail' }] }),
);
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [] }));

for (const [id, hooks] of Object.entries({
  'echo-tool': ECHO_HOOK,
  'needs-browser': NEEDS_BROWSER_HOOK,
  'gate-fail': GATE_FAIL_HOOK,
})) {
  await mkdir(join(root, 'tools', id), { recursive: true });
  await writeFile(join(root, 'tools', id, 'tool.json'), manifest(id));
  await writeFile(join(root, 'tools', id, 'template.html'), '<div data-export-file>Save</div>');
  await writeFile(join(root, 'tools', id, 'hooks.js'), hooks);
}

const SRC = join(root, 'doc.pdf');
await writeFile(SRC, '%PDF-1.4\n%%EOF\n');

// Pin the run → bridge chain to the fixture BEFORE the first import, and pin the
// browser tier to a directory with no built shell so it is deterministically absent.
process.env.LOLLY_ROOT = root;
process.env.LOLLY_WEB_DIST = join(root, 'no-such-dist');
delete process.env.LOLLY_WEB_BASE;
const { runToolCli, needsBrowserTier } = await import('../shells/cli/src/run.ts');

/** Run the CLI, capturing the stderr it would print. */
async function run(toolId: string, params: Record<string, string>, outputPath?: string, verify?: boolean): Promise<string> {
  const chunks: string[] = [];
  const orig = process.stderr.write.bind(process.stderr);
  (process.stderr as { write: unknown }).write = (s: string) => { chunks.push(String(s)); return true; };
  try {
    await runToolCli({ toolId, params, outputPath, verify });
  } finally {
    (process.stderr as { write: unknown }).write = orig;
  }
  return chunks.join('');
}

test('needsBrowserTier tells a missing capability from a failed verification', () => {
  assert.equal(needsBrowserTier('Redacting this file needs a browser canvas. Open this tool in the Lolly web app.'), true);
  assert.equal(needsBrowserTier('PDF redaction is not available in this app.'), true);
  // The gate's sentences must NEVER escalate - a failed check is a failed run.
  assert.equal(needsBrowserTier('Verification failed: the rebuilt PDF still carries Info. Nothing was downloaded.'), false);
  assert.equal(needsBrowserTier('Choose a file first.'), false);
  assert.equal(needsBrowserTier('That file is not a supported image, SVG or PDF.'), false);
});

test('tilde instructions arrive as bars through argv', async () => {
  const out = join(root, 'echo1.json');
  await run('echo-tool', { source: SRC, bars: '1,40,60,200,24~2,40,100,120,14' }, out);
  const got = JSON.parse(await readFile(out, 'utf8')) as { bars: Array<Record<string, string>>; quantise: unknown };
  assert.equal(got.bars.length, 2);
  assert.deepEqual(
    got.bars.map(b => [b.page, b.x, b.y, b.w, b.h].map(Number)),
    [[1, 40, 60, 200, 24], [2, 40, 100, 120, 14]],
  );
  assert.equal(got.quantise, true);
});

test('the JSON instruction form is accepted too, and --quantise=false rides along', async () => {
  const out = join(root, 'echo2.json');
  await run('echo-tool', { source: SRC, bars: '[{"page":1,"x":10,"y":20,"w":30,"h":40}]', quantise: 'false' }, out);
  const got = JSON.parse(await readFile(out, 'utf8')) as { bars: Array<Record<string, unknown>>; quantise: unknown };
  assert.equal(got.bars.length, 1);
  assert.deepEqual([got.bars[0]!.x, got.bars[0]!.w].map(Number), [10, 30]);
  assert.equal(got.quantise, false);
});

test('--bars-data=rows.csv fills the same instructions from a spreadsheet', async () => {
  const csv = join(root, 'bars.csv');
  await writeFile(csv, 'page,x,y,w,h\n1,40,60,200,24\n1,40,100,120,14\n');
  const out = join(root, 'echo3.json');
  await run('echo-tool', { source: SRC, 'bars-data': csv }, out);
  const got = JSON.parse(await readFile(out, 'utf8')) as { bars: unknown[] };
  assert.equal(got.bars.length, 2);
});

test('--verify prints one line per file, naming the tier', async () => {
  const out = join(root, 'echo4.json');
  const err = await run('echo-tool', { source: SRC, bars: '1,1,1,10,10' }, out, true);
  assert.match(err, /✓ verified: echo-tool exported doc\.pdf with no failed check \(tier: node\)/);
});

test('a hook that needs a canvas escalates, and names what the browser tier is missing', async () => {
  const out = join(root, 'never.png');
  let err = '';
  await assert.rejects(
    run('needs-browser', { source: SRC, bars: '1,1,1,10,10' }, out, true).then(s => { err = s; }),
    (e: Error) => {
      // The failure must name the missing piece - never a silent unredacted file.
      assert.match(e.message, /No built web shell/);
      assert.match(e.message, /npm run build:web/);
      return true;
    },
  );
  assert.equal(err, '');
  await assert.rejects(readFile(out), /ENOENT/);
});

test('a failed verification gate keeps its own sentence and writes nothing', async () => {
  const out = join(root, 'gate.png');
  await assert.rejects(
    run('gate-fail', { source: SRC, bars: '1,1,1,10,10' }, out, true),
    /Verification failed: covered content is still present\. Nothing was downloaded\./,
  );
  await assert.rejects(readFile(out), /ENOENT/);
});
