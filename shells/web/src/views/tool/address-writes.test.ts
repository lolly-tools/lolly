// SPDX-License-Identifier: MPL-2.0
/**
 * The tool's address is written once its paints settle, and everything that reads or
 * leaves the address flushes a write still settling first.
 *
 * A paint used to rewrite the address on every frame: two whole-document encodes and a
 * replaceState as long as the document. session.ts now writes once the paints go quiet
 * (lib/url-state.ts settledWrite). Share and Copy link run here against the real docked
 * Share panel. render.ts, session.ts and exporting.ts cannot be imported under plain Node
 * (their import chains reach the bridge), so their wiring is pinned in the source, the
 * same way exporting-studio.test.ts pins the export path.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/tool/address-writes.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.test/design?bx=a' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
globalThis.CustomEvent = dom.window.CustomEvent as unknown as typeof CustomEvent;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(0), 0)) as unknown as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
dom.window.matchMedia = ((media: string) => ({ matches: false, media, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof dom.window.matchMedia;
globalThis.matchMedia = dom.window.matchMedia; // the desktop column, where the Share panel docks

const { mountExportShare } = await import('../export-share.ts');
const { mergeRouteParams, replaceRouteUrl, settledWrite } = await import('../../lib/url-state.ts');

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');

/** The body of a top-level function, up to the next top-level declaration. */
function functionBody(source: string, name: string): string {
  const start = source.search(new RegExp(`^export (?:async )?function ${name}\\b`, 'm'));
  assert.ok(start >= 0, `${name} is declared`);
  const rest = source.slice(start + 1);
  const next = rest.search(/^(?:export )?(?:async )?function |^\/\*\*/m);
  return next < 0 ? rest : rest.slice(0, next);
}

/** Record every address write, in order. */
function watchWrites(): { writes: string[]; restore: () => void } {
  const writes: string[] = [];
  const history = dom.window.history;
  const original = history.replaceState.bind(history);
  history.replaceState = (state: unknown, unused: string, url?: string | URL | null) => {
    writes.push(new URL(String(url), location.href).search);
    original(state, unused, url);
  };
  return { writes, restore: () => { history.replaceState = original; } };
}

test('opening Share and pressing Copy link write a settling address first', () => {
  dom.window.history.replaceState(null, '', '/design?bx=a');
  const root = document.createElement('div');
  root.innerHTML = '<button type="button" data-action="copy-url">Share</button>';
  document.body.replaceChildren(root);
  const watch = watchWrites();
  let edit = 'b';
  const pending = settledWrite(() => replaceRouteUrl(mergeRouteParams(location.href, { bx: edit })), 400);
  const unmount = mountExportShare(root, () => ({ toolId: 'design', baseParts: [`bx=${edit}`], currentFormat: 'png' }));
  try {
    pending.schedule();
    root.querySelector<HTMLButtonElement>('[data-action="copy-url"]')!.click();
    assert.deepEqual(watch.writes, ['?bx=b', '?bx=b&_dialog=share'], 'the edit is written before Share writes its own key');
    assert.equal(pending.pending(), false);

    edit = 'c';
    pending.schedule();
    const copy = document.querySelector<HTMLButtonElement>('.share-copy-btn');
    assert.ok(copy, 'the docked panel holds the Copy link button');
    copy.click();
    assert.equal(watch.writes.at(-1), '?bx=c&_dialog=share', 'Copy link writes the settling edit at once');
    assert.equal(pending.pending(), false);
  } finally {
    pending.cancel();
    unmount();
    watch.restore();
    document.body.replaceChildren();
  }
});

test('a paint schedules the address; direct writes and the first write go out at once', () => {
  const render = read('views/tool/render.ts');
  assert.match(render, /tview\.session\.scheduleSyncUrl\(\);/);
  assert.doesNotMatch(render, /tview\.session\.syncUrl\(/, 'no paint writes the address on every frame');
  const session = read('views/tool/session.ts');
  const schedule = functionBody(session, 'scheduleSyncUrl');
  assert.match(schedule, /if \(isIframeMode\(\) \|\| tview\.mountLifecycle\.disposed\) return;/, 'a paint after unmount writes nothing');
  assert.match(schedule, /if \(tview\.barSeq\.v === 0\) \{\s*writeAddress\(tview\);/, 'the mount\'s first write is not delayed');
  assert.match(schedule, /settledWrite\(\(\) => writeAddress\(tview\), ADDRESS_SETTLE_MS\)/);
  assert.match(schedule, /tview\.mountLifecycle\.add\('settled address write', write\.cancel\)/, 'a write never outlives its mount');
  assert.match(session, /const ADDRESS_SETTLE_MS = 400;/);
  // syncUrl (export settings, the theme switch, the emoji set) still writes now, and its
  // write drops the settling one it makes redundant.
  assert.match(functionBody(session, 'syncUrl'), /return writeAddress\(tview\);/);
  assert.match(session, /function dropSettling\(tview: ToolViewCtx, written: boolean\): boolean \{\s*if \(written\) settledAddress\.get\(tview\)\?\.cancel\(\);/);
  // The Share meter's whole-document cost runs only while a meter is on screen.
  assert.match(session, /tview\.urlGauge\?\.costWhenShown\(\(\) => costShareMeter\(tview\)\);/);
});

test('export, Share, Shrink URL, leaving the tool and address readers flush a settling write first', () => {
  const exporting = functionBody(read('views/tool/exporting.ts'), 'exportUnscaledRaw');
  const flushedAt = exporting.indexOf('flushAddressWrites();');
  assert.ok(flushedAt > exporting.indexOf('tview.render.flushRender();'), 'after the last paint');
  assert.ok(flushedAt < exporting.indexOf('tview.stageZoom?.suspend()'), 'before the capture starts');
  const shared = read('views/tool/shared.ts');
  const share = functionBody(shared, 'showShareDialog');
  assert.ok(share.indexOf('flushAddressWrites();') >= 0 && share.indexOf('flushAddressWrites();') < share.indexOf("dispatchEvent(new CustomEvent('lolly:share-open'"));
  const shrink = functionBody(shared, 'shrinkUrl');
  assert.ok(shrink.indexOf('flushAddressWrites();') < shrink.indexOf('window.location.search'), 'Shrink URL shrinks the latest state');
  const nav = functionBody(read('nav.ts'), 'navigateTo');
  assert.ok(nav.indexOf('flushAddressWrites();') < nav.indexOf('history.pushState'), 'the entry being left keeps its latest state');
  const back = read('components/back-pill.ts');
  const leave = back.slice(back.indexOf('function leave('), back.indexOf('window.history.back();'));
  assert.match(leave, /flushAddressWrites\(\);/, 'so does the back pill\'s history step');
  const query = functionBody(read('views/tool/stage-layout.ts'), 'currentQuery');
  assert.match(query, /^[^\n]*\n\s*flushAddressWrites\(\);/, 'the present and full-screen writers read the latest query');
  assert.match(read('lib/collab-live-mount.ts'), /currentQuery\(\) \{\s*if \(typeof window === 'undefined'\) return '';[^\n]*\n[^\n]*\n\s*flushAddressWrites\(\);/, 'starting a collab carries the latest edit');
});

test('no tool view module writes history directly around the guarded address writer', () => {
  const here = join(SRC, 'views', 'tool');
  for (const file of readdirSync(here).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
    const source = readFileSync(join(here, file), 'utf8');
    assert.doesNotMatch(source, /history\.replaceState\(/, `${file} goes through replaceRouteUrl, which cannot throw into a paint`);
  }
});
