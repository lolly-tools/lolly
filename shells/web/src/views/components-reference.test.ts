// SPDX-License-Identifier: MPL-2.0
/**
 * The reference block of a component card (views/components-reference.ts): the import
 * line a person copies is made only from functions the specimen gives, and every one of
 * those is a real export of the file the specimen points at. Before this guard the block
 * printed `import { … } from '…'` for 48 cards, a line nobody could use.
 *
 * Run with node --import ./tests/css-stub.mjs --test <this file>.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import type { Specimen } from './components-data.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node'] as const) {
  Object.defineProperty(globalThis, key, { value: (dom.window as unknown as Record<string, unknown>)[key], configurable: true, writable: true });
}
const { definedPath, importInfo, symbolsOf } = await import('./components-reference.ts');
const { COMPONENT_SECTIONS } = await import('./components-data.ts');
const specimens = COMPONENT_SECTIONS.flatMap(section => section.items);
const REPO = new URL('../../../../', import.meta.url);

test('the functions a specimen gives are read from its asides, each once, in order', () => {
  const of = (name: string, defined = ''): string[] => symbolsOf({ name, defined } as Specimen);
  assert.deepEqual(of('Zoom HUD (mountZoomHud)'), ['mountZoomHud']);
  assert.deepEqual(of('Segmented control (.view-seg via segHtml())'), ['segHtml'], 'a nested bracket is read too');
  assert.deepEqual(of('View topbar (viewTopbarHtml / mountViewTopbar)'), ['viewTopbarHtml', 'mountViewTopbar']);
  assert.deepEqual(of('Bulk-action bar (bulkBarHtml/syncBulkBar)'), ['bulkBarHtml', 'syncBulkBar']);
  assert.deepEqual(of('View loading', 'shells/web/src/components/view-loading.ts (beginViewLoading)'), ['beginViewLoading'], 'the aside after the path');
  assert.deepEqual(of('Palette wheel (read-only + editable)'), [], 'ordinary words are not functions');
  assert.deepEqual(of('Colour-space mode tabs (.color-mode-tabs)'), [], 'nor is a class');
  assert.deepEqual(of('Icon registry (lib/icons.ts)'), [], 'nor a path');
  assert.deepEqual(of('mountModal in the title (mountModal)'), ['mountModal'], 'only the asides are read, and each name once');
});

test('the path a card points at never carries the aside that gives its function', () => {
  assert.equal(definedPath({ name: 'x', defined: 'shells/web/src/components/view-loading.ts (beginViewLoading)' } as Specimen), 'shells/web/src/components/view-loading.ts');
  assert.equal(definedPath({ name: 'x', defined: 'shells/web/src/lib/genai-pill.ts / styles/parts/chips.css' } as Specimen), 'shells/web/src/lib/genai-pill.ts');
  assert.equal(definedPath({ name: 'x' } as Specimen), null);
});

test('an import line is written only for the functions a specimen gives, and never with a placeholder', () => {
  let lines = 0;
  for (const s of specimens) {
    const info = importInfo(s);
    if (!symbolsOf(s).length) { assert.equal(info.line, null, `${s.name} gives no function, so no import line`); continue; }
    const path = definedPath(s);
    if (!path || path.endsWith('.css')) { assert.equal(info.line, null, s.name); continue; }
    lines++;
    assert.match(info.line!, /^import \{ [A-Za-z_$][\w$]*(?:, [A-Za-z_$][\w$]*)* \} from '[^' ()]+\.ts';$/, s.name);
    assert.doesNotMatch(info.line!, /…/, s.name);
  }
  assert.ok(lines >= 12, `at least a dozen cards carry a real import line (${lines})`);
});

test('every function a specimen gives is exported by the file the specimen points at', () => {
  for (const s of specimens) {
    const symbols = symbolsOf(s);
    const path = definedPath(s);
    if (!symbols.length || !path || path.endsWith('.css')) continue;
    const file = new URL(path, REPO);
    assert.ok(existsSync(file), `${s.name}: ${path} is on disk`);
    const source = readFileSync(file, 'utf8');
    for (const symbol of symbols) {
      const exported = new RegExp(`export\\s+(?:async\\s+)?(?:function\\*?|const|let|class)\\s+${symbol}\\b|export\\s*\\{[^}]*\\b${symbol}\\b`).test(source);
      assert.ok(exported, `${s.name}: ${path} exports ${symbol}`);
    }
  }
});
