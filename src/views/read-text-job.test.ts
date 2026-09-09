// SPDX-License-Identifier: MPL-2.0
/**
 * The two "Read text" call sites, as a source contract (WP-F, plans/124 section 9).
 *
 * Both OCR entry points - the catalogue asset modal (views/catalog.ts, `read-text`)
 * and the credential checker's image read (views/valid.ts, `readImageText`) - used
 * to `await host.ocr.run(...)` inline behind a disabled button, then write the
 * outcome in a `finally`. Two things were wrong with that, and this file exists so
 * neither comes back:
 *
 *   1. the run outlives its surface. A modal closes, ←/→ pages to another asset, a
 *      new file is dropped into the checker - and the `finally` wrote a label onto a
 *      DETACHED button, or worse, onto a DIFFERENT asset's button.
 *   2. the DURABLE half was lost with the surface. The catalogue read persists an
 *      AI-signals verdict onto the asset's meta (persistAiSignals); if the modal had
 *      closed, that write never happened and the read was simply thrown away.
 *
 * Now both enqueue a job (lib/ocr-job.ts) and every DOM write is guarded on the
 * surface still being live, while `persistAiSignals` runs either way. These are
 * source scans rather than mounted views on purpose: neither mountCatalog (5k
 * lines) nor mountValid is headless-mountable, and the property being protected is
 * structural. lib/ocr-job.test.ts covers the job behaviour itself.
 *
 * Run directly:  node --test shells/web/src/views/read-text-job.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
// catalog is an orchestrator plus feature modules under ./catalog/ (2026-09-09 split)
const CATALOG = [read('./catalog.ts'), ...readdirSync(new URL('./catalog/', import.meta.url)).filter((n) => n.endsWith('.ts')).sort().map((n) => read(`./catalog/${n}`))].join('\n');
const VALID = read('./valid.ts');

/** The `read-text` action's whole handler body, from its guard to the next action. */
function catalogReadTextBlock(): string {
  const start = CATALOG.indexOf("if (act === 'read-text') {");
  assert.ok(start > 0, "the catalogue's read-text handler is still there");
  const after = CATALOG.indexOf("if (act === '", start + 10);
  assert.ok(after > start, 'and a following action delimits it');
  return CATALOG.slice(start, after);
}

/** views/valid.ts's `readImageText`, from its signature to the next declaration. */
function readImageTextBody(): string {
  const start = VALID.indexOf('async function readImageText(');
  assert.ok(start > 0, 'readImageText is still there');
  const after = VALID.indexOf('\n  reportEl.addEventListener(', start);
  assert.ok(after > start, 'and the click wiring below delimits it');
  return VALID.slice(start, after);
}

/** Leading-space count of the first line matching `needle`. */
function indentOf(text: string, needle: string): number {
  const line = text.split('\n').find((l) => l.includes(needle));
  assert.ok(line !== undefined, `expected a line containing ${JSON.stringify(needle)}`);
  return (line.match(/^ */) as RegExpMatchArray)[0].length;
}

// ── both sites go through the job ────────────────────────────────────────────

test('neither call site awaits host.ocr.run inline any more - both enqueue a job', () => {
  const cat = catalogReadTextBlock();
  const val = readImageTextBody();
  assert.match(cat, /startOcrJob\(/, 'the catalogue read is a WP-F job');
  assert.match(val, /startOcrJob\(/, 'the checker read is a WP-F job');
  assert.doesNotMatch(cat, /host\.ocr!?\??\.run\(/,
    'a blocking read holds the modal hostage and dies with it - go through lib/ocr-job.ts');
  assert.doesNotMatch(val, /host\.ocr!?\??\.run\(/,
    'a blocking read holds the report hostage and dies with it - go through lib/ocr-job.ts');
});

test('the pixels are still decoded on the calling surface, before the job starts', () => {
  const cat = catalogReadTextBlock();
  const val = readImageTextBody();
  // Decoding needs the source still resolvable and is the cheap half; the run is the
  // long one. Same split as the matte/upscale dialogs.
  assert.ok(cat.indexOf('rasterToOcrFrame(') < cat.indexOf('startOcrJob('),
    'the frame is decoded before the read is enqueued');
  assert.ok(val.indexOf('createImageBitmap(') < val.indexOf('startOcrJob('),
    'the frame is decoded before the read is enqueued');
});

test('both restore their button through onSettled, which a CANCEL also fires', () => {
  // A cancel from the toast calls neither onComplete nor onError. Without onSettled
  // the button would sit disabled and reading "Reading…" for as long as its surface lives.
  assert.match(catalogReadTextBlock(), /onSettled: restore/);
  assert.match(readImageTextBody(), /onSettled: restore/);
});

// ── no writes to a surface that has moved on ─────────────────────────────────

test('the catalogue read has no finally-block writing to a possibly-detached button', () => {
  const cat = catalogReadTextBlock();
  assert.doesNotMatch(cat, /\}\s*finally\s*\{/,
    'the finally that restored a detached (or a NEWLY PAGED) modal\'s button is gone');
  assert.match(cat, /const alive = \(\): boolean => (?:cat\.)?detailsDialog === dlg;/,
    'liveness is "is THIS modal still the open one", not "is something open"');
  assert.match(cat, /const restore = \(\): void => \{\s*\n\s*if \(!alive\(\)\) return;/,
    'the button restore returns early when the modal has moved on');
});

test('the checker read guards its paints on the result element still being in the document', () => {
  const val = readImageTextBody();
  assert.match(val, /const alive = \(\): boolean => resultEl\.isConnected;/,
    'a new drop repaints the report and detaches everything captured before the run');
  assert.match(val, /if \(!btn\.isConnected\) return;/,
    'and the button restore checks the button itself');
  // The overlay pins a ResizeObserver to the <img>; doing that to a detached image
  // leaks an observer onto a node that will never be laid out again.
  assert.match(val, /if \(img\?\.isConnected && img\.parentElement\)/,
    'the box overlay only mounts onto an image still in the document');
});

// ── the durable half survives the surface ────────────────────────────────────

test('the catalogue read persists its AI-signals verdict whether or not the modal is open', () => {
  const cat = catalogReadTextBlock();
  assert.match(cat, /await (?:cat\.\w+\.)?persistAiSignals\(ref, panel, 'ocr'\);/, 'the verdict is still written');
  // Structural: the persist call is a SIBLING of the `if (alive())` branch, not a
  // child of it. Nested inside, a read whose modal had closed would be thrown away -
  // which is the whole bug this conversion fixes.
  assert.equal(
    indentOf(cat, /await (?:cat\.\w+\.)?persistAiSignals\(ref, panel, 'ocr'\);/.exec(cat)?.[0] ?? ''),
    indentOf(cat, 'if (alive()) {'),
    'persistAiSignals must sit OUTSIDE the alive() branch - it is the durable half of the read',
  );
});

test('a completed read with nowhere to paint is announced, not silently dropped', () => {
  assert.match(catalogReadTextBlock(), /announce\(t\('The text was read\. Open this asset again to see the result\.'\)\)/,
    'the catalogue tells the user where the result went');
  assert.match(readImageTextBody(), /announce\(t\('The text was read, but this report has moved on\. Check the file again to see it\.'\)\)/,
    'the checker does the same');
  // Same for the two other outcomes - a failure and an empty read must not vanish
  // just because the surface closed.
  assert.match(catalogReadTextBlock(), /else announce\(t\('The text could not be read\.'\)\)/);
  assert.match(readImageTextBody(), /else announce\(t\('The text in this image could not be read\.'\)\)/);
});
