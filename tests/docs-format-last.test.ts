// SPDX-License-Identifier: MPL-2.0
/**
 * "Choose the format last": the landing band after the hero and its proof on the formats
 * page (docs/site/format-last.json, docs/build.ts formatLastBand / formatLastFigure, the
 * panels and originals in docs/figures/formats-last-*, made by
 * scripts/build-format-last-art.ts).
 *
 * What is pinned, and why:
 *  - THE TWO PAGES AGREE. docs/formats.md opens with the landing's own heading and line,
 *    so the claim on the door and the page that proves it say the same thing.
 *  - EVERY OUTPUT HAS ITS PANEL, signed. A panel is a reader's drawing of a real file,
 *    so a panel without a credential, or an output without a panel, is a mock-up.
 *  - THE OFFICE FILES KEEP TEXT AS TEXT. The deck and the document are offered as files
 *    a person keeps editing; their words must be text runs, not pictures.
 *  - THE COPY STAYS TRUE: no PDF/X claim (Lolly does not claim it by default), Google
 *    Slides is not named, and nothing says a design goes to Word.
 *
 * Source files only: the panels and originals are committed, so nothing here builds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readZip } from '../engine/src/zip.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
interface Output { id: string; kind: string; format: string; alt: string; drawn: string }
const FL = JSON.parse(read('docs/site/format-last.json')) as { heading: string; line: string; outputs: Output[]; caption: string; out: string[]; in: string[] };
const BUILD = read('docs/build.ts');

/** The panel file for each output id, read from FORMAT_LAST_PANELS in docs/build.ts. */
function panels(): Record<string, { art: string; source: string }> {
  const m = /const FORMAT_LAST_PANELS[^=]*=\s*(\{[\s\S]*?\n\});/.exec(BUILD);
  assert.ok(m, 'docs/build.ts no longer declares FORMAT_LAST_PANELS');
  return new Function(`return (${m[1]});`)() as Record<string, { art: string; source: string }>;
}

test('the formats page opens with the landing\'s own heading and line', () => {
  const body = read('docs/formats.md').split('\n').slice(1).join('\n').trim();
  assert.ok(body.startsWith(`**${FL.heading}** ${FL.line}`),
    'docs/formats.md must open with the "Choose the format last" heading and line, word for word, so the landing and the page that proves it agree');
  assert.match(body, /<!-- the format-last figure renders here -->/, 'the figure marker is missing from docs/formats.md');
});

test('every output has a signed panel and an original beside it', async () => {
  const map = panels();
  assert.deepEqual(FL.outputs.map((o) => o.id).sort(), Object.keys(map).sort(), 'format-last.json outputs and FORMAT_LAST_PANELS name different panels');
  for (const o of FL.outputs) {
    const p = map[o.id]!;
    for (const f of [p.art, p.source]) assert.ok(existsSync(join(ROOT, 'docs/figures', f)), `docs/figures/${f} is missing: run node scripts/build-format-last-art.ts`);
    const report = await verifyC2pa(new Uint8Array(readFileSync(join(ROOT, 'docs/figures', p.art))));
    assert.equal(report.state, 'valid', `${p.art} carries no valid Content Credential`);
    assert.ok(o.alt.trim() && o.drawn.trim(), `${o.id} needs alt text and the reader that drew it`);
  }
  // The build copies the raster panels and the originals, which the bank copy does not.
  for (const f of [...Object.values(map).map((p) => p.source), ...Object.values(map).map((p) => p.art)].filter((f) => !f.endsWith('.svg'))) {
    assert.match(BUILD, new RegExp(`FORMAT_LAST_FILES = \\[[^\\]]*'${f.replace(/[.]/g, '\\.')}'`), `${f} is not in FORMAT_LAST_FILES, so the site would not serve it`);
  }
});

test('the deck and the document keep their words as editable text', () => {
  const pptx = readZip(new Uint8Array(readFileSync(join(ROOT, 'docs/figures/formats-last.pptx'))));
  const slide = new TextDecoder().decode(pptx.find((e) => e.name === 'ppt/slides/slide1.xml')!.bytes);
  const runs = [...slide.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
  assert.ok(runs.includes('Riverside Garden Day'), 'the slide title is not a text run');
  assert.match(slide, /<p:ph type="title"\/>/, 'the slide title is not a real title placeholder');
  assert.match(slide, /<a:latin typeface="Outfit"\/>/, 'the slide no longer names the brand\'s display face on its runs');
  const docx = readZip(new Uint8Array(readFileSync(join(ROOT, 'docs/figures/formats-last.docx'))));
  const body = new TextDecoder().decode(docx.find((e) => e.name === 'word/document.xml')!.bytes);
  assert.match(body, /<w:pStyle w:val="Heading1"\/><\/w:pPr><w:r><w:t xml:space="preserve">Riverside Garden Day<\/w:t>/, 'the document title is not a Heading 1 text run');
  assert.ok((body.match(/<w:numPr>/g) ?? []).length >= 3, 'the document list is no longer a real list');
});

test('the copy stays inside what Lolly does', () => {
  const copy = JSON.stringify(FL) + read('docs/formats.md').split('\n').slice(0, 6).join('\n');
  assert.doesNotMatch(copy, /PDF\/X/i, 'Lolly makes no PDF/X claim by default: say press-ready PDF in print colours');
  assert.doesNotMatch(copy, /Google Slides/i, 'Google Slides is reached through PowerPoint and Send to Google Drive: do not name it yet');
  assert.doesNotMatch(copy, /\bto Word\b|\bWord document\b/i, 'only Lolly Doc Studio writes DOCX: do not say a design goes to Word');
  // The "In" chips are formats Lolly reads, each one in the formats register.
  const register = JSON.parse(read('docs/site/formats-catalog.json')) as { formats: Array<{ token: string; name: string; dir: string }> };
  const reads = new Set(register.formats.filter((f) => f.dir !== 'out').flatMap((f) => [f.token, f.name]));
  for (const chip of FL.in) assert.ok(reads.has(chip) || (chip === 'IDML' && reads.has('InDesign')), `"${chip}" is an In chip but the register does not read it`);
  const writes = new Set(register.formats.filter((f) => f.dir !== 'in').flatMap((f) => [f.token, f.name]));
  for (const chip of FL.out) assert.ok(writes.has(chip) || (chip === 'Print PDF' && writes.has('CMYK PDF')), `"${chip}" is an Out chip but the register does not write it`);
});
