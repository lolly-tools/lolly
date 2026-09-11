// SPDX-License-Identifier: MPL-2.0
/**
 * The Versions panel - what it says, what it refuses, and what a press writes
 * (plan 97 section 6a, M7).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/rooms/versions.test.ts"
 *
 * jsdom supplies the DOM. The host is an in-memory asset store the REAL
 * `installUserTokens` and the real versions-io write through, because the two
 * things worth pinning here are both orderings the panel does not own: a publish
 * writes the version asset BEFORE the head's ledger, and a head write goes
 * through the studio's installer rather than round the side of it. Stubbing
 * versions-io out would have tested the panel against a fiction of itself.
 *
 * The other half is the copy. A version is permanent, so the panel has to say so
 * before the press, name a removal as breaking, and never print a user's own
 * label or note as markup - all three are asserted rather than left to review.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="panel"></div></body></html>', {
  url: 'http://localhost/#/start?area=versions',
  pretendToBeVisual: true,
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);

const { versionsHtml, mountVersionsRoom, hasPublishableSystem } = await import('./versions.ts');
import type { VersionsModel } from './versions.ts';
import { USER_TOKENS_ID } from '../../../bridge/tokens.ts';
import { readVersionIndex, withVersionIndex } from '../versions.ts';
import type { VersionEntry } from '../versions.ts';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const DOC = { color: { brand: { primary: { $type: 'color', $value: '#ff6600' } } } };

function entry(over: Partial<VersionEntry> = {}): VersionEntry {
  return { slug: 'v1', label: 'v1', date: '2026-08-01T10:00:00.000Z', checksum: 'abc', ...over };
}

function model(over: Partial<VersionsModel> = {}): VersionsModel {
  return {
    publishable: true,
    index: { versions: [], active: null },
    draftLabel: '',
    draftNote: '',
    ahead: null,
    compat: { first: true, baseline: '', added: [], changed: [], removed: [], assets: [] },
    storage: { versions: 0, frozen: 0, bytes: 0 },
    restored: null,
    ...over,
  };
}

interface Rec {
  id: string; type: string; format?: string; blob: Blob;
  version?: string; meta?: Record<string, unknown>;
}

/** An in-memory user-asset store the real bridge chokepoint can write through. */
function fakeHost(head: unknown = null) {
  const store = new Map<string, Rec>();
  const writes: string[] = [];
  const put = (id: string, doc: unknown): void => {
    store.set(id, { id, type: 'tokens', format: 'json', blob: new Blob([JSON.stringify(doc)]), version: '1.0.0' });
  };
  if (head !== null) put(USER_TOKENS_ID, head);
  const host = {
    assets: {
      async _uploadUserAsset(rec: Rec) { writes.push(rec.id); store.set(rec.id, rec); },
      async _getBlob(id: string) { return store.get(id)?.blob ?? null; },
      async _getUserRecord(id: string) { return store.get(id) ?? null; },
      async _exportUserAssets() { return [...store.values()]; },
    },
    tokens: {
      async raw() {
        const blob = store.get(USER_TOKENS_ID)?.blob;
        return blob ? JSON.parse(await blob.text()) : null;
      },
      bust() { /* nothing memoised in the fake */ },
      async isLocked() { return false; },
    },
  };
  return { host, store, writes, put };
}

function panel(): HTMLElement {
  const el = document.querySelector<HTMLElement>('#panel')!;
  el.innerHTML = '';
  return el;
}

/** Let the panel's read chain (several awaits deep) settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 12; i++) await new Promise(r => { setTimeout(r, 0); });
}

// ── Pure render ──────────────────────────────────────────────────────────────

test('the resting state is a line, not an empty panel', () => {
  assert.match(versionsHtml(null), /ds-v-loading/);
});

test('permanence is stated before anything can be pressed', () => {
  const html = versionsHtml(model());
  assert.ok(html.includes('A version is a permanent, named copy of the design system.'),
    'the honesty line leads the panel');
  assert.ok(html.includes('Publishing cannot be undone.'),
    'the publish form says so again beside the button');
  assert.ok(!/Delete|Remove version/i.test(html), 'v1 offers no delete, so it advertises none');
});

test('with nothing published the list says so and the storage line is absent', () => {
  const html = versionsHtml(model());
  assert.ok(html.includes('Nothing has been published yet.'));
  assert.ok(!html.includes('ds-v-storage'), 'no versions means no storage to be honest about');
});

test('with no head document the panel invites nothing', () => {
  const html = versionsHtml(model({ publishable: false }));
  assert.ok(html.includes('There is nothing to publish yet.'));
  assert.ok(!html.includes('data-ds-v-publish'), 'and offers no publish control at all');
});

test('a label and a note are escaped, never markup', () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const html = versionsHtml(model({
    index: { versions: [entry({ label: hostile, note: hostile })], active: null },
  }));
  assert.ok(!html.includes('<img'), 'the label never reaches the sink as a tag');
  assert.ok(html.includes('&lt;img'), 'it is shown, escaped');
  assert.equal(html.split('&lt;img').length - 1, 2, 'both the label and the note are escaped');
});

test('the compat card leads with removals and names them as breaking', () => {
  const html = versionsHtml(model({
    index: { versions: [entry({ label: 'v1' })], active: 'v1' },
    compat: {
      first: false, baseline: 'v1',
      added: ['color.new'], changed: ['color.brand.primary'], removed: ['color.gone'],
      assets: [{ id: 'user/logo/primary', kind: 'replaced' }],
    },
  }));
  const removed = html.indexOf('1 removed.');
  const changed = html.indexOf('1 changed');
  const added = html.indexOf('1 added');
  assert.ok(removed >= 0 && changed > removed && added > changed,
    'removed → changed → added: the breaking half is not something to scroll past');
  assert.ok(html.includes('A tool naming it will lose it.'), 'and it says what breaking means');
  assert.ok(html.includes('user/logo/primary replaced'), 'a replaced pin is named');
});

test('the active version wears a pill and offers no second activate', () => {
  const html = versionsHtml(model({
    index: { versions: [entry({ slug: 'v1', label: 'v1' }), entry({ slug: 'v2', label: 'v2' })], active: 'v2' },
  }));
  assert.equal(html.split('data-ds-v-activate=').length - 1, 1, 'only the inactive row can be activated');
  assert.ok(html.includes('data-ds-v-activate="v1"'));
  assert.ok(html.includes('data-ds-v-follow'), 'and following the latest again is offered');
  assert.equal(html.split('data-ds-v-restore=').length - 1, 2, 'either version can be restored from');
});

test('the newest version is first', () => {
  const html = versionsHtml(model({
    index: { versions: [entry({ slug: 'v1', label: 'v1' }), entry({ slug: 'v2', label: 'v2' })], active: null },
  }));
  assert.ok(html.indexOf('data-ds-v-restore="v2"') < html.indexOf('data-ds-v-restore="v1"'));
});

test('editing ahead is stated with its count', () => {
  const html = versionsHtml(model({
    index: { versions: [entry()], active: 'v1' },
    ahead: { label: 'v1', changes: 3 },
  }));
  assert.ok(html.includes('Editing ahead of v1. 3 changes since it was published.'));
});

test('storage is reported with the fact that none of it can be removed', () => {
  const html = versionsHtml(model({
    index: { versions: [entry()], active: null },
    storage: { versions: 1, frozen: 2, bytes: 4096 },
  }));
  assert.ok(html.includes('1 published version'));
  assert.ok(html.includes('2 preserved files'));
  assert.ok(html.includes('4.0 KB'));
  assert.ok(html.includes('A version cannot be deleted yet.'));
});

// ── hasPublishableSystem ─────────────────────────────────────────────────────

test('the rail entry is offered only once there is something to publish', async () => {
  const bare = fakeHost();
  assert.equal(await hasPublishableSystem({ host: bare.host as never }), false,
    'a studio that has installed nothing of its own shows no versioning at all');

  const own = fakeHost(DOC);
  assert.equal(await hasPublishableSystem({ host: own.host as never }), true);
});

test('a ledger alone is enough - the versions must stay reachable', async () => {
  const h = fakeHost();
  // The head document is a catalogue's, not this device's, but it carries a
  // ledger: the panel is the only way to those versions, so it is offered.
  h.host.tokens.raw = async () => withVersionIndex(DOC, { versions: [entry()], active: null });
  assert.equal(await hasPublishableSystem({ host: h.host as never }), true);
});

// ── Mount ────────────────────────────────────────────────────────────────────

test('the name field is the gate: an unslugifiable name cannot be published', async () => {
  const { host } = fakeHost(DOC);
  const el = panel();
  const room = mountVersionsRoom(el, { host: host as never });
  await settle();

  const input = el.querySelector<HTMLInputElement>('[data-ds-v-label]')!;
  const buttons = [...el.querySelectorAll<HTMLButtonElement>('[data-ds-v-publish]')];
  assert.equal(buttons.length, 2, 'publish-and-activate, and publish only');
  assert.ok(buttons.every(b => b.disabled), 'a blank name publishes nothing');
  assert.match(el.querySelector('[data-ds-v-slugline]')!.textContent!, /letters or numbers/);

  input.value = '!!!';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.ok(buttons.every(b => b.disabled), 'and neither does punctuation');

  input.value = 'Jupiter 2';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.ok(buttons.every(b => !b.disabled));
  assert.match(el.querySelector('[data-ds-v-slugline]')!.textContent!, /jupiter-2/,
    'and the slug tools will use is shown before the press');
  room.teardown();
});

test('a name already published is refused in words, not after the fact', async () => {
  const { host } = fakeHost(withVersionIndex(DOC, { versions: [entry({ slug: 'v1', label: 'v1' })], active: null }));
  const el = panel();
  const room = mountVersionsRoom(el, { host: host as never });
  await settle();

  const input = el.querySelector<HTMLInputElement>('[data-ds-v-label]')!;
  input.value = 'v1';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.match(el.querySelector('[data-ds-v-slugline]')!.textContent!, /already used/);
  assert.ok([...el.querySelectorAll<HTMLButtonElement>('[data-ds-v-publish]')].every(b => b.disabled));
  room.teardown();
});

test('publish writes the version asset first, then the ledger, and says one sentence', async () => {
  const { host, writes, store } = fakeHost(DOC);
  const said: string[] = [];
  const el = panel();
  const room = mountVersionsRoom(el, { host: host as never, notify: (m) => { said.push(m); } });
  await settle();

  const input = el.querySelector<HTMLInputElement>('[data-ds-v-label]')!;
  input.value = 'v1';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  el.querySelector<HTMLButtonElement>('[data-ds-v-publish="active"]')!.click();
  await settle();

  assert.deepEqual(writes, [`${USER_TOKENS_ID}/v1`, USER_TOKENS_ID],
    'the payload lands before the ledger names it - the other order would list a version nothing can load');
  const head = JSON.parse(await store.get(USER_TOKENS_ID)!.blob.text());
  const index = readVersionIndex(head);
  assert.equal(index.versions.length, 1);
  assert.equal(index.versions[0]!.label, 'v1');
  assert.equal(index.active, 'v1', 'publish and make active did both');
  assert.deepEqual(said, ['Published v1 and made it active.']);

  // …and the panel now shows it, with the form reset to the next suggestion.
  assert.ok(el.textContent!.includes('Active'));
  assert.equal(el.querySelector<HTMLInputElement>('[data-ds-v-label]')!.value, 'v2',
    'the next name follows the convention the last publish established');
  room.teardown();
});

test('head writes go through the studio installer, never round the side of it', async () => {
  const { host, store } = fakeHost(DOC);
  const actions: string[] = [];
  const el = panel();
  const room = mountVersionsRoom(el, {
    host: host as never,
    install: async (doc, action) => {
      actions.push(action);
      store.set(USER_TOKENS_ID, {
        id: USER_TOKENS_ID, type: 'tokens', format: 'json',
        blob: new Blob([JSON.stringify(doc)]), version: '1.0.0',
      });
    },
  });
  await settle();

  const input = el.querySelector<HTMLInputElement>('[data-ds-v-label]')!;
  input.value = 'v1';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  el.querySelector<HTMLButtonElement>('[data-ds-v-publish="only"]')!.click();
  await settle();
  assert.deepEqual(actions, ['publish-version']);

  const head = JSON.parse(await store.get(USER_TOKENS_ID)!.blob.text());
  assert.equal(readVersionIndex(head).active, null, 'publish only did not activate');

  el.querySelector<HTMLButtonElement>('[data-ds-v-activate="v1"]')!.click();
  await settle();
  assert.deepEqual(actions, ['publish-version', 'activate-version']);
  room.teardown();
});

test('a restore offers its undo, and the undo is the studio own step back', async () => {
  const { host, store } = fakeHost(DOC);
  let undone = 0;
  const el = panel();
  const room = mountVersionsRoom(el, {
    host: host as never,
    undo: async () => { undone++; return true; },
    install: async (doc) => {
      store.set(USER_TOKENS_ID, {
        id: USER_TOKENS_ID, type: 'tokens', format: 'json',
        blob: new Blob([JSON.stringify(doc)]), version: '1.0.0',
      });
    },
  });
  await settle();

  const input = el.querySelector<HTMLInputElement>('[data-ds-v-label]')!;
  input.value = 'v1';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  el.querySelector<HTMLButtonElement>('[data-ds-v-publish="only"]')!.click();
  await settle();

  el.querySelector<HTMLButtonElement>('[data-ds-v-restore="v1"]')!.click();
  await settle();
  assert.ok(el.textContent!.includes('Restored the latest from v1.'));
  const undoBtn = el.querySelector<HTMLButtonElement>('[data-ds-v-undo]');
  assert.ok(undoBtn, 'the way back is offered where the action happened');

  undoBtn!.click();
  await settle();
  assert.equal(undone, 1);
  assert.equal(el.querySelector('[data-ds-v-undo]'), null,
    'and it is gone once spent, so it can never step back over somebody else edit');
  room.teardown();
});

test('the restored ledger survives the restore - the list is not what got replaced', async () => {
  const { host, store } = fakeHost(DOC);
  const el = panel();
  const room = mountVersionsRoom(el, {
    host: host as never,
    install: async (doc) => {
      store.set(USER_TOKENS_ID, {
        id: USER_TOKENS_ID, type: 'tokens', format: 'json',
        blob: new Blob([JSON.stringify(doc)]), version: '1.0.0',
      });
    },
  });
  await settle();
  const input = el.querySelector<HTMLInputElement>('[data-ds-v-label]')!;
  input.value = 'v1';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  el.querySelector<HTMLButtonElement>('[data-ds-v-publish="only"]')!.click();
  await settle();

  el.querySelector<HTMLButtonElement>('[data-ds-v-restore="v1"]')!.click();
  await settle();
  const head = JSON.parse(await store.get(USER_TOKENS_ID)!.blob.text());
  assert.equal(readVersionIndex(head).versions.length, 1, 'restoring never deletes the thing restored from');
  room.teardown();
});

test('a failure is a sentence in the panel, not a thrown promise', async () => {
  const { host } = fakeHost(DOC);
  host.assets._uploadUserAsset = async () => { throw new Error('Storage is full.'); };
  const said: Array<[string, boolean]> = [];
  const el = panel();
  const room = mountVersionsRoom(el, { host: host as never, notify: (m, e) => { said.push([m, !!e]); } });
  await settle();

  const input = el.querySelector<HTMLInputElement>('[data-ds-v-label]')!;
  input.value = 'v1';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  el.querySelector<HTMLButtonElement>('[data-ds-v-publish="active"]')!.click();
  await settle();

  const err = el.querySelector<HTMLElement>('[data-ds-v-err]')!;
  assert.equal(err.hidden, false);
  assert.equal(err.textContent, 'Storage is full.');
  assert.equal(err.getAttribute('role'), 'alert', 'so writing it is already the announcement');
  assert.deepEqual(said, [],
    'and it is NOT also pushed through the rail: one string, one live region, said once');
  room.teardown();
});

test('a studio with nothing in it mounts, says so, and does not throw', async () => {
  const { host } = fakeHost();
  const el = panel();
  const room = mountVersionsRoom(el, { host: host as never });
  await settle();
  assert.ok(el.textContent!.includes('There is nothing to publish yet.'));
  assert.equal(el.querySelector('[data-ds-v-publish]'), null);
  room.teardown();
});

test('collapse folds an open disclosure and reports it, so Esc has a rung here', async () => {
  const { host } = fakeHost(DOC);
  const el = panel();
  const room = mountVersionsRoom(el, { host: host as never });
  await settle();
  assert.equal(room.collapse(), false, 'nothing open, so Esc falls through to the view');

  el.insertAdjacentHTML('beforeend', '<details open><summary>x</summary></details>');
  assert.equal(room.collapse(), true);
  assert.equal(el.querySelector<HTMLDetailsElement>('details')!.open, false);
  room.teardown();
});

test('a repaint keeps focus and does not eat a half-typed name', async () => {
  const { host, store } = fakeHost(DOC);
  const el = panel();
  const room = mountVersionsRoom(el, {
    host: host as never,
    install: async (doc) => {
      store.set(USER_TOKENS_ID, {
        id: USER_TOKENS_ID, type: 'tokens', format: 'json',
        blob: new Blob([JSON.stringify(doc)]), version: '1.0.0',
      });
    },
  });
  await settle();

  const input = el.querySelector<HTMLInputElement>('[data-ds-v-label]')!;
  input.value = 'half typed';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  input.focus();
  room.refresh();
  await settle();

  const after = el.querySelector<HTMLInputElement>('[data-ds-v-label]')!;
  assert.equal(after.value, 'half typed', 'a refresh from anywhere must not clear the field');
  assert.equal(document.activeElement, after, 'and it keeps the caret');
  room.teardown();
});

/**
 * Run `fn` with the HTML focus fixup rule in force.
 *
 * jsdom does not implement it: `b.focus(); b.disabled = true;` leaves `b` as
 * `document.activeElement`, where a real browser blurs it to `<body>`. That gap
 * matters here - the panel disables every `.ds-v-btn` the instant a press
 * lands, so in a browser the control that was pressed loses focus BEFORE the
 * repaint asks where focus was, and a guard test run without this rule exercises
 * a state that never occurs.
 */
async function withFocusFixup(fn: () => Promise<void>): Promise<void> {
  const proto = dom.window.HTMLButtonElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'disabled')!;
  Object.defineProperty(proto, 'disabled', {
    ...desc,
    set(this: HTMLButtonElement, v: boolean) {
      // Blur BEFORE the flag lands: jsdom refuses to blur an element it already
      // considers unfocusable, so the other order silently does nothing.
      if (v && document.activeElement === this) this.blur();
      desc.set!.call(this, v);
    },
  });
  try { await fn(); } finally { Object.defineProperty(proto, 'disabled', desc); }
}

test('the focus fixup rule really is what a browser does, and jsdom really does not', () => {
  // The premise of the harness above, asserted rather than assumed - if a future
  // jsdom implements the rule, withFocusFixup becomes a no-op and the two tests
  // below quietly stop testing anything.
  const b = document.createElement('button');
  document.body.appendChild(b);
  b.focus();
  b.disabled = true;
  assert.equal(document.activeElement, b, 'jsdom keeps focus on a disabled button');
  b.remove();
});

test('a press does not drop keyboard focus on the document (browser focus fixup)', async () => {
  const { host, store } = fakeHost(DOC);
  const el = panel();
  const room = mountVersionsRoom(el, {
    host: host as never,
    install: async (doc) => {
      store.set(USER_TOKENS_ID, {
        id: USER_TOKENS_ID, type: 'tokens', format: 'json',
        blob: new Blob([JSON.stringify(doc)]), version: '1.0.0',
      });
    },
  });
  await settle();
  await withFocusFixup(async () => {
    const input = el.querySelector<HTMLInputElement>('[data-ds-v-label]')!;
    input.value = 'v1';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    const btn = el.querySelector<HTMLButtonElement>('[data-ds-v-publish="only"]')!;
    btn.focus();
    btn.click();
    // The press disables its own control, so by here a browser has already
    // blurred it - the panel has to have remembered where it was.
    assert.equal(document.activeElement, document.body, 'the premise: focus is gone mid-action');
    await settle();

    const landed = document.activeElement as HTMLElement;
    assert.notEqual(landed, document.body, 'and it comes back');
    assert.ok(el.contains(landed), 'inside the panel');
    assert.equal((landed as HTMLButtonElement).disabled ?? false, false, 'never on a dead control');
  });
  room.teardown();
});

test('a failed press puts focus back beside the alert it has to be read with', async () => {
  const { host } = fakeHost(DOC);
  host.assets._uploadUserAsset = async () => { throw new Error('Storage is full.'); };
  const el = panel();
  const room = mountVersionsRoom(el, { host: host as never });
  await settle();
  await withFocusFixup(async () => {
    const input = el.querySelector<HTMLInputElement>('[data-ds-v-label]')!;
    input.value = 'v1';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    const btn = el.querySelector<HTMLButtonElement>('[data-ds-v-publish="active"]')!;
    btn.focus();
    btn.click();
    await settle();
    // The error path never repaints, so nothing else would ever re-seat focus:
    // without the restore the user is left on <body>, unable to Shift+Tab back to
    // the role="alert" from anywhere they know.
    assert.equal(el.querySelector<HTMLElement>('[data-ds-v-err]')!.hidden, false);
    assert.notEqual(document.activeElement, document.body);
    assert.ok(el.contains(document.activeElement as HTMLElement));
  });
  room.teardown();
});

test('a refused name is exposed to assistive tech, not just coloured', async () => {
  const { host } = fakeHost(withVersionIndex(DOC, { versions: [entry({ slug: 'v1', label: 'v1' })], active: null }));
  const el = panel();
  const room = mountVersionsRoom(el, { host: host as never });
  await settle();

  const input = el.querySelector<HTMLInputElement>('[data-ds-v-label]')!;
  const type = (v: string): void => {
    input.value = v;
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };
  type('');
  assert.equal(input.getAttribute('aria-invalid'), 'true', 'a blank name is a refusal, and says so');
  type('v1');
  assert.equal(input.getAttribute('aria-invalid'), 'true', 'so is a name already published');
  type('v2');
  assert.equal(input.getAttribute('aria-invalid'), 'false');

  // The publish buttons carry the permanence sentence, since there is no confirm
  // step and no undo after the press.
  const permanent = el.querySelector<HTMLElement>('.ds-v-permanent')!;
  assert.ok(permanent.id, 'the sentence is addressable');
  for (const btn of el.querySelectorAll<HTMLButtonElement>('[data-ds-v-publish]')) {
    assert.equal(btn.getAttribute('aria-describedby'), permanent.id);
  }
  room.teardown();
});

test('every plural in this panel is a literal the translation extractor can see', async () => {
  // scripts/translate.ts scans for a quote immediately after `t(`, so `t(cond ? a
  // : b)` ships English in all 26 locales - and nothing else in the repo would
  // catch it, since the fallback list is hand-maintained.
  const src = (await readFile(new URL('./versions.ts', import.meta.url), 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '')     // prose about t() is not a call
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const bad = [...src.matchAll(/(^|[^A-Za-z0-9_$.])(t|tRaw)\(\s*([^'"\s])/g)]
    .map(m => src.slice(Math.max(0, m.index), m.index + 60).split('\n')[0]);
  assert.deepEqual(bad, [], 'each of these has to become two whole t() calls, one per plural form');
});

test('the diff disclosures look like disclosures and are real touch targets', async () => {
  // `display: flex` on a <summary> removes its native marker in every engine, so
  // one has to be drawn back - otherwise the only way into the removed/changed/
  // added paths reads as a plain bold sentence. And the panel's own rule is that
  // every control is 44px; these toggles are controls.
  const css = await readFile(new URL('../../../styles/parts/start.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('.ds-v-diff-sum {'), css.indexOf('.ds-v-paths,'));
  assert.match(block, /min-height:\s*44px/);
  assert.match(block, /list-style:\s*none/);
  assert.match(block, /::-webkit-details-marker\s*\{\s*display:\s*none/);
  assert.match(block, /\.ds-v-diff-sum::before/);
  assert.match(block, /\.ds-v-diff\[open\]\s*>\s*\.ds-v-diff-sum::before/, 'and it turns when open');
  // The name field's refusal is not colour alone either.
  assert.match(css, /\.ds-v-slugline\.is-error::before\s*\{\s*content:/);
});

test('focus lands somewhere real when the control that was pressed goes away', async () => {
  const { host, store } = fakeHost(DOC);
  const el = panel();
  const room = mountVersionsRoom(el, {
    host: host as never,
    install: async (doc) => {
      store.set(USER_TOKENS_ID, {
        id: USER_TOKENS_ID, type: 'tokens', format: 'json',
        blob: new Blob([JSON.stringify(doc)]), version: '1.0.0',
      });
    },
  });
  await settle();
  const input = el.querySelector<HTMLInputElement>('[data-ds-v-label]')!;
  // A free name, so the next suggestion is blank and the publish buttons come
  // back DISABLED - the worst case for a naive "focus what was pressed".
  input.value = 'jupiter';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  const btn = el.querySelector<HTMLButtonElement>('[data-ds-v-publish="only"]')!;
  btn.focus();
  btn.click();
  await settle();

  const landed = document.activeElement as HTMLElement;
  assert.notEqual(landed, document.body, 'a keyboard user is never dropped on the document');
  assert.ok(el.contains(landed), 'and stays inside the panel');
  assert.equal((landed as HTMLButtonElement).disabled ?? false, false, 'never on a dead control');
  room.teardown();
});

test('teardown stops the panel answering presses', async () => {
  const { host, writes } = fakeHost(DOC);
  const el = panel();
  const room = mountVersionsRoom(el, { host: host as never });
  await settle();
  const input = el.querySelector<HTMLInputElement>('[data-ds-v-label]')!;
  input.value = 'v1';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  room.teardown();
  el.querySelector<HTMLButtonElement>('[data-ds-v-publish="active"]')!.click();
  await settle();
  assert.deepEqual(writes, [], 'a torn-down panel writes nothing');
});
