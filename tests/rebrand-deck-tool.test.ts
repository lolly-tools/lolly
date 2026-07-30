/**
 * rebrand-deck tool contract tests.
 *
 * Run with: node --test tests/rebrand-deck-tool.test.ts
 * No test framework — node:test built-in.
 *
 * Loads the REAL community tool straight from community/rebrand-deck (not the
 * tools/ profile view, which doesn't include a freshly-added tool until the
 * profile is rebuilt) and drives it through the engine with a stubbed
 * host.pptx/host.tokens — only the host is stubbed; the tool code under test
 * is the shipped manifest + hooks. Guards:
 *   - the one-time mapping seed from the inspect result, and the never-reseed
 *     guard protecting the user's manual row edits,
 *   - the exportFile plan (theme suggestion, identity rows dropped,
 *     dropEmbeddedFonts) and the returned bytes/mime/filename,
 *   - the pending-race fallback: a download before the rows seeded derives
 *     them from the inspect result, equal to the seeded default,
 *   - the friendly failure when the shell has no host.pptx.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(COMMUNITY_DIR, path), 'utf8');

// rebrand-deck is a community tool — always present in a full checkout; a
// missing dir means it was renamed or deleted, which must FAIL loudly here.
assert.ok(existsSync(join(COMMUNITY_DIR, 'rebrand-deck', 'tool.json')),
  'community/rebrand-deck/tool.json is missing — the tool was renamed or deleted');

const tool: any = await loadTool('rebrand-deck', fetchFile);

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

// "PK\x03\x04" zip magic + padding — enough for the hook's byte sniff; the
// stubbed host.pptx never parses it.
const PK_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 1, 2, 3, 4]);

const deckFile = () => ({
  __file: true, name: 'Quarterly Update.pptx', mime: PPTX_MIME,
  size: PK_BYTES.length, bytes: PK_BYTES, url: null,
});

const REBRANDED = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 9, 9]);

const INSPECT_RESULT = {
  ok: true,
  slideCount: 12,
  theme: {
    colors: { dk1: '#1A1A1A', lt1: '#FFFFFF', accent1: '#4472C4' },
    majorFont: 'Calibri Light', minorFont: 'Calibri',
  },
  colors: [
    { hex: '#4472C4', suggested: '#30BA78' },
    { hex: '#ED7D31', suggested: '#FE7C3F', review: true },
    { hex: '#111111' },                       // no brand match → seeds as identity
  ],
  fonts: [
    { family: 'Calibri', suggested: 'Inter' },
    { family: 'Inter', suggested: 'Inter' },  // already the brand face → not a row
    { family: 'Wingdings' },                  // no suggestion → not a row
  ],
  themeSuggestion: { dk1: '#0C322C', lt1: '#FFFFFF', accent1: '#30BA78', majorFont: 'Inter', minorFont: 'Inter' },
};

// The shared stub host (helpers/host.ts) extended with the capabilities this
// tool exercises: host.tokens always, host.pptx unless the test drops it.
function makeHost({ pptx = true }: { pptx?: boolean } = {}) {
  const calls = { inspect: [] as any[][], rebrand: [] as any[][] };
  const host: any = baseHost();
  host.tokens = {
    colors: async () => [
      { value: '#30BA78', name: 'Jungle', path: 'color.brand.jungle' },
      { value: '', name: 'Broken', path: 'color.broken' },   // must be dropped
    ],
    resolve: async (ref: string) => (ref === '{font.brand}' ? ['Inter', 'sans-serif'] : undefined),
  };
  if (pptx) {
    host.pptx = {
      inspect: async (...args: any[]) => { calls.inspect.push(args); return INSPECT_RESULT; },
      rebrand: async (...args: any[]) => {
        calls.rebrand.push(args);
        return {
          bytes: REBRANDED,
          report: { themesPatched: 1, colorsRemapped: 2, fontsRemapped: 1, embeddedFontsStripped: 1, slidesTouched: ['ppt/slides/slide1.xml'] },
        };
      },
    };
  }
  return { host, calls };
}

const value = (rt: any, id: string) => rt.getModel().find((i: any) => i.id === id)?.value;

test('manifest: an on-device pptx file utility on the ^1.58 engine', () => {
  const m = tool.manifest;
  assert.equal(m.id, 'rebrand-deck');
  assert.equal(m.engineVersion, '^1.58.0');
  assert.equal(m.privacy, 'on-device');
  assert.equal(m.render.layout, 'canvas');
  const src = m.inputs.find((i: any) => i.id === 'source');
  assert.equal(src.type, 'file');
});

test('picking a deck seeds the colour/font mapping rows from the inspect result — once', async () => {
  const { host, calls } = makeHost();
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('source', deckFile() as any);

  assert.equal(calls.inspect.length, 1, 'one inspect per file');
  // Brand tokens adapted into the inspect opts: empty-valued swatches dropped,
  // font slots resolved from the `font.<slot>` tokens (first family of a stack).
  assert.deepEqual(calls.inspect[0]![1], {
    swatches: [{ hex: '#30BA78', name: 'Jungle', role: 'color.brand.jungle' }],
    fonts: { brand: 'Inter' },
  });

  assert.deepEqual(value(rt, 'colorMap'), [
    { from: '#4472C4', to: '#30BA78' },
    { from: '#ED7D31', to: '#FE7C3F' },
    { from: '#111111', to: '#111111' },   // no suggestion → identity row (user may remap)
  ]);
  assert.deepEqual(value(rt, 'fontMap'), [{ from: 'Calibri', to: 'Inter' }]);
});

test('user-edited mapping rows survive later inputs (never reseeded)', async () => {
  const { host } = makeHost();
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('source', deckFile() as any);

  const edited = [{ from: '#4472C4', to: '#0C322C' }];
  await rt.setInput('colorMap', edited as any);
  await rt.setInput('useTheme', false);   // any other keystroke — still no reseed

  assert.deepEqual(value(rt, 'colorMap'), edited, 'manual rows kept verbatim');
  assert.deepEqual(value(rt, 'fontMap'), [{ from: 'Calibri', to: 'Inter' }]);
});

test('the ready card renders the review (summary, theme strip, download)', async () => {
  const { host } = makeHost();
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('source', deckFile() as any);

  const html = rt.getHydrated() as string;
  assert.match(html, /Quarterly Update\.pptx/);
  assert.match(html, /12 slides · 3 hardcoded colours · 3 typefaces/);
  // before/after theme chips pair the read theme with the brand suggestion
  assert.match(html, /background: #1A1A1A/);
  assert.match(html, /background: #0C322C/);
  assert.match(html, /1 colour worth a look/);
  assert.match(html, /data-export-file data-busy-label="Rebranding…"/);
});

test('exportFile builds the surgical plan and returns the rebranded deck', async () => {
  const { host, calls } = makeHost();
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('source', deckFile() as any);
  // User tweaks: one real remap, one identity row (must be dropped from the plan).
  await rt.setInput('colorMap', [
    { from: '#4472C4', to: '#0C322C' },
    { from: '#ED7D31', to: '#ED7D31' },
  ] as any);

  const out = await rt.exportFile();

  assert.equal(calls.rebrand.length, 1);
  const [bytes, plan] = calls.rebrand[0]!;
  assert.deepEqual(bytes, PK_BYTES, 'rebrand receives the picked file\'s bytes');
  assert.deepEqual(plan, {
    theme: INSPECT_RESULT.themeSuggestion,
    colorMap: { '#4472C4': '#0C322C' },
    fontMap: { Calibri: 'Inter' },
    dropEmbeddedFonts: true,
  });
  assert.equal(calls.inspect.length, 1, 'the download reuses the cached inspect');

  assert.deepEqual(out.bytes, REBRANDED);
  assert.equal(out.mime, PPTX_MIME);
  assert.equal(out.filename, 'Quarterly Update-rebranded.pptx');
});

test('a download racing the review (rows never seeded) ships the seeded-default plan', async () => {
  // Model the pending race without wall-clock timers: the review's inspect
  // attempt fails, leaving the same state as a still-pending job (no rows
  // seeded for this file key, job dropped from the cache) — then the
  // download's own await gets the real result and must derive the rows.
  const { host, calls } = makeHost();
  let first = true;
  host.pptx.inspect = async (...args: any[]) => {
    calls.inspect.push(args);
    if (first) { first = false; throw new Error('inspect not ready'); }
    return INSPECT_RESULT;
  };
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('source', deckFile() as any);
  assert.deepEqual(value(rt, 'colorMap'), [], 'rows never seeded');

  await rt.exportFile();
  const racyPlan = calls.rebrand[0]![1];

  // The seeded path (pick, let the review land, then download) for comparison.
  const seeded = makeHost();
  const rt2 = await createRuntime(tool, seeded.host, {});
  await rt2.setInput('source', deckFile() as any);
  await rt2.exportFile();

  assert.deepEqual(racyPlan, seeded.calls.rebrand[0]![1], 'racy download equals the seeded default');
});

test('useTheme off leaves the deck theme alone (no theme in the plan)', async () => {
  const { host, calls } = makeHost();
  const rt = await createRuntime(tool, host, { useTheme: false });
  await rt.setInput('source', deckFile() as any);
  await rt.exportFile();

  const plan = calls.rebrand[0]![1];
  assert.equal('theme' in plan, false);
  assert.deepEqual(plan.colorMap, { '#4472C4': '#30BA78', '#ED7D31': '#FE7C3F' });
});

test('exportFile without host.pptx fails with the friendly message', async () => {
  const { host } = makeHost({ pptx: false });
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('source', deckFile() as any);
  await assert.rejects(() => rt.exportFile(), /PowerPoint rebranding isn't available in this app\./);
});

// ─── "this won't change anything" ─────────────────────────────────────────────
// The tool's job is to say NO before the user spends a download. Two shapes of
// nothing-to-do: a PDF (the export already flattened the deck), and a .pptx
// whose slides are only pictures (the same deck, re-wrapped). Both come back
// pixel-identical, so both are called out in the card rather than discovered
// after the fact.

// "%PDF-1.7" — the hook sniffs magic bytes, not the filename.
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

const pdfFile = () => ({
  __file: true, name: 'Quarterly Update.pdf', mime: 'application/pdf',
  size: PDF_BYTES.length, bytes: PDF_BYTES, url: null,
});

// A deck of nothing but full-bleed pictures — what "export to PDF, import back"
// produces. No literal colour, no typeface beyond the theme's own two.
const FLAT_INSPECT = {
  ok: true,
  slideCount: 8,
  theme: { colors: { dk1: '#1A1A1A', lt1: '#FFFFFF' }, majorFont: 'Calibri Light', minorFont: 'Calibri' },
  colors: [],
  fonts: [{ family: 'Calibri Light' }, { family: 'Calibri' }],
  themeSuggestion: { dk1: '#0C322C', lt1: '#FFFFFF' },
  content: { pictures: 8, texts: 0, shapes: 0, tables: 0, unknown: 0 },
};

function makeHostWith(result: any) {
  const { host, calls } = makeHost();
  host.pptx.inspect = async (...args: any[]) => { calls.inspect.push(args); return result; };
  return { host, calls };
}

test('a PDF is refused with a reason, not a generic "not a deck"', async () => {
  const { host, calls } = makeHost();
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('source', pdfFile() as any);

  const html = rt.getHydrated() as string;
  assert.match(html, /A PDF can't be rebranded\./);
  assert.match(html, /would not change a single pixel/);
  // The generic branch must NOT also fire, and the file never reaches inspect.
  assert.doesNotMatch(html, /Could not read this file as a PowerPoint deck/);
  assert.equal(calls.inspect.length, 0, 'a PDF is rejected on magic bytes, unparsed');
});

test('a picture-only deck says up front that nothing will change', async () => {
  const { host } = makeHostWith(FLAT_INSPECT);
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('source', deckFile() as any);

  const html = rt.getHydrated() as string;
  assert.match(html, /This deck won't change\./);
  assert.match(html, /Every slide in this deck is a flat picture/);
  // The download stays available (the theme part IS rewritten) but stops being
  // the confident call to action, and the mapping-rows note would be a lie.
  assert.match(html, /Download anyway/);
  assert.match(html, /class="rbd-download is-noop"/);
  assert.doesNotMatch(html, /prefilled as mapping rows/);
});

test('a normal deck carries no flattened warning', async () => {
  const { host } = makeHost();
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('source', deckFile() as any);

  const html = rt.getHydrated() as string;
  assert.doesNotMatch(html, /won't change/);
  assert.match(html, /Download rebranded deck/);
  assert.match(html, /prefilled as mapping rows/);
});

test('an older shell with no content tally still warns when nothing is mappable', async () => {
  // engine < 1.79: inspect omits `content`. The fallback signal is "no literal
  // colour AND no typeface beyond the theme's own", and it hedges accordingly —
  // a fully theme-linked deck looks the same from here and rebrands fine.
  const { content: _drop, ...noTally } = FLAT_INSPECT;
  const { host } = makeHostWith(noTally);
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('source', deckFile() as any);

  const html = rt.getHydrated() as string;
  assert.match(html, /No hardcoded colour or typeface was found on these slides\./);
  assert.match(html, /the brand theme below\s+still does the whole job/);
});
