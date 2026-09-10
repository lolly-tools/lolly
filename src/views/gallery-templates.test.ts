// SPDX-License-Identifier: MPL-2.0
/**
 * THE GALLERY COUNTS THE STARTING POINTS A PERSON ACTUALLY HAS.
 *
 * A tool card used to say "N templates" straight off the catalog index, which stopped
 * being true the moment plans/226 let someone hide a shipped template and save their own:
 * a card could offer four and show none of them, or show four when two were hidden. The
 * card line, the About dialog's tiles and the search haystack are the three places that
 * number leaks into, and all three now read the same two overlays (the hidden set and the
 * person's own templates) off the profile record the mount already has in hand.
 *
 * Three properties hold this together, and each is one line a later edit can drop:
 *
 *   1. both overlays are read from the ONE profile the mount already awaits - no second
 *      round trip, and nothing added to the path the first paint waits on;
 *   2. every surface derives from those overlays, never from `tool.templates` raw;
 *   3. a "Start with" replaces the count rather than adding to it - one line, one meaning.
 *
 * WHY A SOURCE SCAN: `mountGallery` cannot be imported outside Vite (stylesheet imports,
 * and sibling modules that use the `.js` specifier convention Node cannot resolve), and
 * `cardMarkup` / `showInfoDialog` are module-private. `views/tool-template-mount.test.ts`,
 * `views/tool-collab-mount.test.ts` and `views/multi-edit-crash-guard.test.ts` all scan for
 * the same reason; this file follows them. The overlays' own behaviour is unit-tested where
 * they live (lib/hidden-templates.ts, lib/template-start.ts, lib/template-ref.ts).
 *
 * The surfaces read one feature across TWO files: views/gallery.ts mounts and paints, and
 * views/gallery-templates.ts holds the overlays and every function over them (each takes
 * the mount's context first). So the scan below reads both and treats them as one source,
 * the way the split-view suites do.
 *
 * Run directly:  node --test shells/web/src/views/gallery-templates.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Source with comments removed, so prose cannot answer a question about code. */
function stripComments(src: string): string {
  const noBlocks = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlocks
    .split('\n')
    .map((line) => {
      const at = line.search(/(^|[^:])\/\//);
      return at === -1 ? line : line.slice(0, at === 0 ? 0 : at + 1);
    })
    .join('\n');
}

/** The source between `head` and the first `end` after it (for list/array bodies, where
 *  brace matching would catch an inline arrow body instead). */
function sliceBetween(src: string, head: string, end: string): string {
  const at = src.indexOf(head);
  assert.notEqual(at, -1, `expected to find \`${head}\` in gallery.ts`);
  const stop = src.indexOf(end, at + head.length);
  assert.notEqual(stop, -1, `expected \`${end}\` after \`${head}\``);
  return src.slice(at + head.length, stop);
}

/** The `{ … }` body that follows `head`, extracted by brace matching. */
function bodyAfter(src: string, head: string): string {
  const at = src.indexOf(head);
  assert.notEqual(at, -1, `expected to find \`${head}\` in gallery.ts`);
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  assert.fail(`unbalanced braces while extracting \`${head}\``);
}

const VIEW = stripComments(readFileSync(join(HERE, 'gallery.ts'), 'utf8'));
const SEAM = stripComments(readFileSync(join(HERE, 'gallery-templates.ts'), 'utf8'));
const CODE = `${VIEW}\n${SEAM}`;
const CSS = readFileSync(join(HERE, '..', 'styles', 'parts', 'gallery.css'), 'utf8');

test('both template overlays ride the ONE profile the mount already awaits', () => {
  // The hidden set is derived from the resolved `profile` exactly as hidden TOOLS are
  // (one line above it), and the person's own templates resolve INSIDE the same
  // Promise.all - concurrently with the profile read, not after it - so the first paint
  // waits on nothing it did not already wait on.
  assert.match(SEAM, /const hiddenTemplates = loadHiddenTemplates\(profile, defaultHiddenTemplateRefs\(\)\);/,
    'the hidden overlay seeds from the brand defaults, exactly as loadHiddenTools does for tools');
  assert.match(VIEW, /const gtpl = galleryTemplates\(host, profile, myTemplates, toolById, viewEl\);/,
    'and the mount builds the context once, from the profile and the list it just read');
  const all = sliceBetween(VIEW, 'const [savedEntriesRaw, profile, sessionSizes, pinnedTools, myTemplates] = await Promise.all([', '\n  ]);');
  assert.match(all, /host\.profile\.get\(\),/, 'the profile is one of the concurrent reads');
  assert.match(all, /createUserTemplateStore\(host\)\.list\(\)\.catch\(/,
    "the person's own templates resolve alongside it, and an unreadable store is not fatal");
  assert.equal((CODE.match(/createUserTemplateStore\(/g) ?? []).length, 1,
    'exactly one store read per mount - every surface below shares that one list');
});

test('the card line counts shipped-minus-hidden PLUS the person\'s own', () => {
  const line = bodyAfter(CODE, 'export function templateLine(gt: GalleryTemplates, tool: GalleryTool): string {');
  assert.match(line, /shippedTemplatesOf\(gt, tool\)\.length \+ myTemplatesOf\(gt, tool\.id\)\.length/,
    'the count is both kinds, and the shipped side is the visible ones');
  assert.match(line, /n === 0 \? '' :/, 'a tool with nothing to start from says nothing');
  assert.match(CODE, /\(tool\.templates \?\? \[\]\)\.filter\(tp => !gt\.hidden\.has\(shippedTemplateRef\(tool\.id, tp\.id\)\)\)/,
    'a hidden shipped template is filtered by its ref, never by name');
});

test('a "Start with" REPLACES the count, and never outlives its template', () => {
  const line = bodyAfter(CODE, 'export function templateLine(gt: GalleryTemplates, tool: GalleryTool): string {');
  const nameAt = line.indexOf('const name = startWithName(gt, tool.id);');
  assert.notEqual(nameAt, -1, 'the line asks what the tool starts with first');
  assert.ok(nameAt < line.indexOf('shippedTemplatesOf(gt, tool).length'),
    'the count is only reached when nothing is set - one line, never both');
  assert.match(line, /return tRaw\('Starts with \{name\}', \{ name \}\);/,
    'the line names the template it starts with');
  const resolve = bodyAfter(CODE, 'export function startWithName(gt: GalleryTemplates, toolId: string): string | null {');
  assert.match(resolve, /if \(start === START_BLANK\) return t\('Blank'\);/, "'blank' is a name too");
  assert.match(resolve, /ref\?\.kind === 'user'/, 'a user ref resolves against the one list read at mount');
  assert.match(resolve, /\?\? null;/,
    'a setting whose template no longer resolves reads as nothing set, so the card falls '
    + 'back to its count instead of naming something that is gone');
});

test('the About dialog lists the visible shipped tiles and the person\'s own, never the raw index', () => {
  const dialog = bodyAfter(CODE, 'function showInfoDialog(tool: GalleryTool | undefined, host: GalleryHost, darkTheme: boolean, tpl: InfoTemplates = NO_INFO_TEMPLATES): void {');
  assert.match(dialog, /const templates = tpl\.shipped;/,
    'the tiles come from the filtered list the mount built, not tool.templates');
  assert.ok(!/tool\.templates/.test(dialog),
    'nothing in the dialog may reach past the overlay to the raw index entry - that is how '
    + 'a hidden template gets back on screen');
  assert.match(dialog, /<h4 class="meta-sec-sub">\$\{t\('Yours'\)\}<\/h4>/,
    "the person's own follow the shipped ones under their own heading");
  assert.match(dialog, /href: `#\/tool\/\$\{escape\(tool\.id\)\}\?template=\$\{escape\(encodeURIComponent\(userTemplateRef\(ut\.id\)\)\)\}`/,
    'and deep-link as user:<id>, which the ?template= launcher resolves');
});

test('the "Start with this" chip is a sibling of the tile, and a real toggle', () => {
  const dialog = bodyAfter(CODE, 'function showInfoDialog(tool: GalleryTool | undefined, host: GalleryHost, darkTheme: boolean, tpl: InfoTemplates = NO_INFO_TEMPLATES): void {');
  // A <button> inside an <a> is not reachable as a control - the chip must sit beside
  // the link, which is why the tile grew an <li> wrapper.
  assert.match(dialog, /<\/a>\$\{startChip\(opts\.ref\)\}/,
    'the chip is emitted after the tile anchor closes, never inside it');
  assert.match(dialog, /void tpl\.setStart\(tpl\.start\(\) === ref \? null : ref\)\.then\(syncStart\);/,
    'clicking the chosen one goes back to asking - the chip is the whole toggle');
  assert.match(dialog, /modal\.el\.querySelector\('\.meta-start-clear'\)\?\.addEventListener\('click', \(\) => \{\s*void tpl\.setStart\(null\)\.then\(syncStart\);/,
    '…and the line says the same thing in words');
  const sync = bodyAfter(dialog, 'const syncStart = (): void => {');
  assert.match(sync, /const current = tpl\.start\(\);/,
    'the chips re-read the SETTING after every write, so the dialog cannot claim a state '
    + 'the profile does not hold');
  assert.match(sync, /btn\.setAttribute\('aria-pressed', on \? 'true' : 'false'\);/,
    'the chosen tile is announced, not only tinted');
});

test('a start-with change repaints the card behind the dialog', () => {
  const setStart = bodyAfter(CODE, 'export function infoTemplates(gt: GalleryTemplates, toolId: string): InfoTemplates {');
  assert.match(setStart, /await setStartWith\(gt\.host, toolId, value\);/,
    'the write goes through the shared handler, not a local profile poke');
  assert.match(setStart, /refreshTemplateLine\(gt, toolId\);/,
    'and the card underneath is repainted, or it keeps advertising the old count');
  const repaint = bodyAfter(CODE, 'export function refreshTemplateLine(gt: GalleryTemplates, toolId: string): void {');
  assert.match(repaint, /el\.textContent = line;/, 'the line is set as TEXT - a template name is the person\'s own words');
  assert.match(repaint, /if \(!line\) \{ el\?\.remove\(\); return; \}/,
    '…and a tool with nothing left to say loses the line entirely');
});

test('search finds a tool through the templates the person can see', () => {
  const fields = sliceBetween(VIEW, 'const searchFields = new Map<string, SearchField[]>(allTools.map(t => [', '.filter((s): s is string');
  assert.match(fields, /\.\.\.templateSearchTerms\(gtpl, t\),/,
    'the haystack takes the template names from the overlays, never from the index entry');
  const terms = bodyAfter(SEAM, 'export function templateSearchTerms(gt: GalleryTemplates, tool: GalleryTool): Array<string | undefined> {');
  assert.match(terms, /\.\.\.shippedTemplatesOf\(gt, tool\)\.flatMap\(/,
    'a hidden shipped template drops out of the haystack with its tile');
  assert.match(terms, /\.\.\.myTemplatesOf\(gt, tool\.id\)\.flatMap\(tp => \[tp\.name, tp\.description\]\)/,
    "…and the person's own names are in it, so their own words find the tool");
});

test('the chip reads as a filled pill, not an outlined one', () => {
  // House rule: no accent-coloured borders on rounded cards/pills - a tinted fill says
  // "chosen" instead.
  const chosen = CSS.slice(CSS.indexOf('.meta-look-start[aria-pressed="true"]'));
  const block = chosen.slice(0, chosen.indexOf('}'));
  assert.match(block, /background: hsl\(var\(--primary\) \/ 0?\.\d+\);/, 'the chosen chip is a tinted fill');
  assert.ok(!/border/.test(block), 'and carries no border of its own');
  assert.match(CSS, /\.meta-look-item \{[^}]*display: flex;/,
    'the tile and its chip stack as one grid cell');
});
