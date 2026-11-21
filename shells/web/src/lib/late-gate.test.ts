// SPDX-License-Identifier: MPL-2.0
/**
 * lib/late-gate.ts - a sign-in gate that arrives after the first view painted.
 *
 * Boot paints before the probe answers only when the last answer here was "no control
 * plane" (org/probe.ts). These tests hold what must follow if the probe then reports a
 * gate: the view that painted is torn down and only the gate is left; a mount still in
 * flight that paints over the gate is replaced again; a cleanup that empties the view
 * or throws cannot leave the old view or lose the gate; no gate markup leaves the view
 * empty. The source checks hold main.ts to the wiring: navigate() refuses after the
 * gate and replaces a mount that settles over it, and the paint-first path listens for
 * the gate before it skips the wait.
 *
 * Run directly:  node --test shells/web/src/lib/late-gate.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createLateGate, type GateView } from './late-gate.ts';

/** Let queued microtasks (mutation observer deliveries among them) run, with no timer turn. */
async function microtasks(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function page() {
  const dom = new JSDOM('<!doctype html><html><head><title>Tools - Lolly</title></head><body><main id="view" class="gallery-view"><div class="gallery">tiles</div></main><dialog open id="d">welcome</dialog></body></html>');
  const doc = dom.window.document;
  const view = doc.getElementById('view') as unknown as GateView;
  const calls: string[] = [];
  const gate = createLateGate({
    view: () => view,
    reset: () => { calls.push('reset'); },
    settleChrome: () => { calls.push('chrome'); },
    viewClasses: () => ['gallery-view', 'tool-view'],
    snapshots: () => doc.querySelectorAll('body > .view-fade'),
  });
  /** What org/index.ts renderGate does: write the gate into the view. */
  const drawGate = (): Element => {
    view.innerHTML = '<section class="org-gate"><a class="btn" href="/login">Sign in</a></section>';
    doc.title = 'Sign in - Lolly';
    return view.querySelector('.org-gate')!;
  };
  return { doc, view, calls, gate, drawGate };
}

test('before a gate nothing is stopped', () => {
  const { gate, view } = page();
  assert.equal(gate.stopped(), false);
  gate.replace();
  assert.match(view.innerHTML, /tiles/, 'replace() does nothing without a gate');
});

test('a late gate tears down the painted view and leaves only the gate', () => {
  const { gate, view, calls, doc, drawGate } = page();
  let cleaned = 0;
  view._cleanup = () => { calls.push('cleanup'); cleaned++; };
  view._beforeLeave = () => true;
  const node = drawGate();
  gate.stop(node);
  assert.equal(gate.stopped(), true);
  assert.equal(cleaned, 1, 'the mounted view cleaned up once');
  assert.deepEqual(calls, ['reset', 'cleanup', 'chrome'], 'router state first, chrome after the cleanup released it');
  assert.equal(view._cleanup, undefined);
  assert.equal(view._beforeLeave, undefined, 'no leave guard can hold a later navigation');
  assert.equal(view.classList.contains('gallery-view'), false, 'scoping classes removed');
  assert.equal(view.children.length, 1);
  assert.equal(view.firstElementChild, node);
  assert.equal(doc.querySelector('dialog[open]'), null, 'dialogs the view opened are closed');
  assert.equal(doc.title, 'Sign in - Lolly');
});

test('a cleanup that empties the view, or throws, does not lose the gate', () => {
  const emptiesView = (view: GateView) => () => { view.replaceChildren(); };
  const throws = () => () => { throw new Error('teardown failed'); };
  for (const cleanup of [emptiesView, throws]) {
    const { gate, view, drawGate } = page();
    view._cleanup = cleanup(view);
    const node = drawGate();
    const error = console.error;
    console.error = () => {};
    try { gate.stop(node); } finally { console.error = error; }
    assert.equal(view.firstElementChild, node);
    assert.equal(view.children.length, 1);
  }
});

test('a mount still in flight that paints over the gate is replaced when it settles', () => {
  const { gate, view, doc, drawGate } = page();
  gate.stop(drawGate());
  // The gallery's mount resumes after an IndexedDB read and writes its markup.
  view.innerHTML = '<div class="gallery">saved work</div>';
  view.classList.add('gallery-view');
  let cleaned = false;
  view._cleanup = () => { cleaned = true; };
  doc.title = 'Tools - Lolly';
  // navigate() checks stopped() once the mount settles.
  assert.equal(gate.stopped(), true);
  gate.replace();
  assert.equal(cleaned, true, 'the late mount is cleaned up too');
  assert.equal(view.querySelector('.org-gate') !== null, true);
  assert.doesNotMatch(view.innerHTML, /saved work/);
  assert.equal(view.classList.contains('gallery-view'), false);
  assert.equal(doc.title, 'Sign in - Lolly', 'the gate title comes back');
});

test('a superseded mount that writes over the gate later is undone before the next frame', async () => {
  const { gate, view, drawGate } = page();
  const node = drawGate();
  gate.stop(node);
  // An older navigation's gallery mount resumes after an IndexedDB read and writes its
  // markup; its navigation was superseded, so navigate() never checks the gate for that mount.
  view.innerHTML = '<div class="gallery">saved work</div>';
  await microtasks();
  assert.equal(view.firstElementChild, node, 'the guard put the gate back in the same microtask checkpoint');
  assert.equal(view.childNodes.length, 1);
  view.append(view.ownerDocument.createTextNode('late text'));
  await microtasks();
  assert.equal(view.childNodes.length, 1, 'any write into the view is undone');
});

test('the snapshot of an outgoing view held by a cross-fade goes with the view', () => {
  const { gate, doc, drawGate } = page();
  const overlay = doc.createElement('div');
  overlay.className = 'view-fade projects-view';
  overlay.innerHTML = '<div class="project">saved work</div>';
  doc.body.append(overlay);
  gate.stop(drawGate());
  assert.equal(doc.querySelector('.view-fade'), null, 'no old view stays on screen above the gate');
});

test('a file dropped on the page after the gate reaches no intake', () => {
  const { gate, view, doc, drawGate } = page();
  const seen: string[] = [];
  // The gallery's intake listens on the router's view; a window listener stands for any other.
  for (const type of ['dragover', 'drop']) {
    view.addEventListener(type, () => seen.push(`view:${type}`));
    doc.defaultView!.addEventListener(type, () => seen.push(`window:${type}`));
  }
  view.dispatchEvent(new doc.defaultView!.Event('drop', { bubbles: true, cancelable: true }));
  assert.deepEqual(seen, ['view:drop', 'window:drop'], 'before the gate a drop reaches the intake');
  seen.length = 0;
  gate.stop(drawGate());
  for (const type of ['dragover', 'drop']) {
    const event = new doc.defaultView!.Event(type, { bubbles: true, cancelable: true });
    view.firstElementChild!.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true, `${type}: the browser does not open the file either`);
  }
  assert.deepEqual(seen, [], 'after the gate no handler sees the drag');
});

test('a dialog something under way opens on the page after the gate is closed and removed before it paints', async () => {
  const { gate, doc, drawGate } = page();
  gate.stop(drawGate());
  // A file chooser whose module was still loading when the gate arrived.
  const chooser = doc.createElement('dialog');
  chooser.setAttribute('open', '');
  chooser.textContent = 'Open this file in';
  doc.body.append(chooser);
  const wrapped = doc.createElement('div');
  wrapped.innerHTML = '<dialog open>nested</dialog>';
  doc.body.append(wrapped);
  await microtasks();
  assert.equal(chooser.isConnected, false, 'the late chooser is gone');
  assert.equal(wrapped.querySelector('dialog'), null, 'and so is a dialog inside something added late');
  assert.equal(doc.querySelectorAll('dialog[open]').length, 0, 'no dialog is open over the gate');
  assert.ok(doc.querySelector('#view > .org-gate'), 'the gate stays');
});

test('a gate reported with no markup leaves the view empty, never as it was', () => {
  const { gate, view } = page();
  gate.stop(null);
  assert.equal(gate.stopped(), true);
  assert.equal(view.children.length, 0);
  assert.doesNotMatch(view.innerHTML, /tiles/);
});

test('the markup handed over first is the one kept; a later report changes nothing', () => {
  const { gate, view, drawGate } = page();
  const node = drawGate();
  gate.stop(node);
  gate.stop(null);
  assert.equal(view.firstElementChild, node);
});

// ── main.ts wiring ───────────────────────────────────────────────────────────

const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
const navigateBody = main.slice(main.indexOf('async function navigate('), main.indexOf('function arriveAt('));
const bootBody = main.slice(main.indexOf('async function boot('));

test('navigate() refuses every route once the gate has the view', () => {
  const top = navigateBody.slice(0, navigateBody.indexOf('const route = parseRoute()'));
  assert.match(top, /if \(lateGate\.stopped\(\)\) return;/);
});

test('navigate() replaces a superseded mount that settles after the gate', () => {
  const superseded = navigateBody.match(/navigation !== navigationSeq\) \{ fade\?\.commit\(\); if \(lateGate\.stopped\(\)\) lateGate\.replace\(\); return; \}/g) ?? [];
  assert.equal(superseded.length, 2, 'in the failure path and after the mount settles');
  assert.match(main, /snapshots: \(\) => document\.querySelectorAll\('body > \.view-fade'\)/, 'the cross-fade snapshots are handed to the gate');
});

test('navigate() replaces a mount that settled, or failed, over the gate', () => {
  assert.match(navigateBody, /if \(lateGate\.stopped\(\)\) \{ lateGate\.replace\(\); return; \}/, 'in the failure path');
  assert.match(navigateBody, /if \(lateGate\.stopped\(\)\) \{ fade\?\.commit\(\); lateGate\.replace\(\); return; \}/, 'after the mount settles');
  const settled = navigateBody.indexOf('if (lateGate.stopped()) { fade?.commit(); lateGate.replace(); return; }');
  assert.ok(settled < navigateBody.indexOf('noteMountedView(route.name)'), 'before the view is announced as mounted');
});

test('boot paints before the probe only on a remembered clean answer, and listens for the gate first', () => {
  const at = bootBody.indexOf('const paintBeforeProbe = cleanAnswerRemembered();');
  assert.ok(at > 0, 'the rule reads the remembered answer');
  assert.ok(bootBody.lastIndexOf('await initInstanceBase();', at) > bootBody.lastIndexOf('createBridge()', at), 'after the instance base has loaded');
  const block = bootBody.slice(at, bootBody.indexOf('if (org?.gate)', at));
  assert.match(block, /onGateShown\(gate => lateGate\.stop\(gate\)\);/, 'the gate stops the view in the task that draws it');
  assert.match(block, /orgPromise\.then\(late => \{ if \(late\?\.gate\) lateGate\.stop\(null\);/, 'and the answer stops it even with no markup');
  assert.match(block, /const org = paintBeforeProbe \? null : await orgPromise;/, 'every other case waits as before');
});

test('only the browse routes mount before the probe answers; every other route waits for the answer', () => {
  assert.match(main, /const ROUTES_BEFORE_PROBE: ReadonlySet<RouteName> = new Set<RouteName>\(\['gallery', 'utilities', 'docs'\]\);/);
  const wait = navigateBody.indexOf('if (probeAnswerPending && !ROUTES_BEFORE_PROBE.has(route.name)) {');
  assert.ok(wait > 0, 'navigate() holds the other routes');
  assert.ok(wait < navigateBody.indexOf("case 'tool':"), 'before any view mounts');
  const block = navigateBody.slice(wait, navigateBody.indexOf('if (!ROUTES[route.name].beforeWebGpu)', wait));
  assert.match(block, /await probeAnswerPending;/);
  // Unconditional, after the wait: a navigation paused elsewhere (the tool-open paint wait) when the
  // answer arrived finds probeAnswerPending already cleared and must still not mount.
  assert.match(block, /\}\n[^\n]*\n[^\n]*\n {2}if \(lateGate\.stopped\(\)\) \{ fade\?\.commit\(\); lateGate\.replace\(\); return; \}/, 'and never mounts over a gate');
  assert.match(bootBody, /probeAnswerPending = orgPromise\.then\(late => \{ if \(late\?\.gate\) lateGate\.stop\(null\); probeAnswerPending = null; \}\);/);
  assert.doesNotMatch(main, /location\.reload\(\)[^\n]*gate|reloadIntoGate/, 'a late gate stays: no reload that a failing probe could turn back into dormancy');
});

test('the footer Open chooser waits for the gate decision and never opens over a gate', () => {
  assert.match(bootBody, /const chooserReady = routesListening\.then\(\(\) => orgDecided\)\.then\(decided =>\s*\(decided\?\.gate \|\| lateGate\.stopped\(\) \? new Promise<never>\(\(\) => \{\}\) : undefined\)\);/);
  assert.match(bootBody, /if \(lateGate\.stopped\(\)\) return;\s*openDropFilePicker\(host as unknown as Parameters<typeof openDropFilePicker>\[0\], \{ ready: chooserReady \}\);/);
});

test('the steps that waited for the gate decision still do', () => {
  assert.match(bootBody, /orgDecided\.then\(decided => \{ if \(!decided\?\.gate\) void maybeApplyNewerAtBoot/);
  assert.match(bootBody, /orgDecided\.then\(decided => \(decided\?\.gate \? null : import\('\.\/lib\/drop-router\.ts'\)\)\)/);
  assert.match(bootBody, /void orgDecided\.then\(decided => \{\s*if \(decided\?\.gate\) return;[\s\S]*?installSiteTools/);
});
