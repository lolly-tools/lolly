// SPDX-License-Identifier: MPL-2.0
/**
 * The candidate tray's surface (plan 97 section 8, M2) - what it renders, and what a
 * press actually commits.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/tray-ui.test.ts"
 *
 * jsdom supplies the DOM; the tray is a plain in-memory stand-in for the real
 * model (tray.ts has its own suite), and every ctx handler is a counting double.
 * The counting is the point: the whole invariant this module has to keep is
 * "one add is one token", which is only visible in HOW MANY calls a press makes,
 * not in what comes back from them.
 *
 * `pretendToBeVisual` is required, not decorative: announce() (a11y.ts) defers
 * its live-region write to requestAnimationFrame, which jsdom only supplies
 * under that flag.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div class="start"></div></body></html>', {
  url: 'http://localhost/#/start',
  pretendToBeVisual: true,
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);

/** jsdom has no matchMedia, so the viewport is a switch we hold: `phone` decides
 *  whether the tray mounts as a dock or as a sheet. One object per query, with a
 *  LIVE `matches` getter, because the module and the sheet driver each keep the
 *  list they were handed at mount and both must see the same answer. */
let phone = false;
const lists = new Map<string, MediaQueryList>();
dom.window.matchMedia = ((query: string) => {
  let list = lists.get(query);
  if (!list) {
    const target = Object.assign(new dom.window.EventTarget(), {
      media: query,
      addListener() { /* legacy alias, unused */ },
      removeListener() { /* legacy alias, unused */ },
    });
    // defineProperty, not an object literal: Object.assign would COPY the
    // getter's value once and the switch would be frozen at mount time.
    Object.defineProperty(target, 'matches', { get: () => phone });
    list = target as unknown as MediaQueryList;
    lists.set(query, list);
  }
  return list;
}) as typeof window.matchMedia;

const { trayHtml, mountTrayUi, isFetchableFamily } = await import('./tray-ui.ts');
import type { Candidate, CandidateType, Tray } from './tray.ts';
import type { ColorEntry } from './add-color.ts';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function candidate(type: CandidateType, value: string, over: Partial<Candidate> = {}): Candidate {
  return {
    id: `${type}-${value}`,
    type,
    value,
    provenance: { kind: 'image', label: 'shot.png' },
    state: 'pending',
    ...over,
  };
}

/** The model's shape without its persistence - the surface only ever reads
 *  list() and writes through markAdded/dismiss. */
function fakeTray(initial: Candidate[] = []): Tray & { calls: string[] } {
  let items = initial.map((c) => ({ ...c }));
  const listeners = new Set<() => void>();
  const calls: string[] = [];
  const notify = (): void => { for (const cb of listeners) cb(); };
  return {
    calls,
    async load() { /* nothing stored */ },
    list: () => items,
    async add(incoming) { items = [...items, ...incoming]; notify(); return incoming.length; },
    async markAdded(id) {
      calls.push(`markAdded:${id}`);
      const c = items.find((x) => x.id === id);
      if (c) c.state = 'added';
      notify();
    },
    async dismiss(id) {
      calls.push(`dismiss:${id}`);
      const c = items.find((x) => x.id === id);
      if (c) c.state = 'dismissed';
      notify();
    },
    async clearSource(label) { items = items.filter((c) => c.provenance.label !== label); notify(); },
    subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  };
}

function shell(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.start')!;
  el.innerHTML = '';
  return el;
}

/** Let the click handlers' promise chains settle. */
const settle = (): Promise<void> => new Promise((r) => { setTimeout(r, 0); });

// ── Pure render ──────────────────────────────────────────────────────────────

test('trayHtml groups by type in a fixed order and omits empty groups', () => {
  const html = trayHtml([
    candidate('name', 'Acme'),
    candidate('font', 'Inter'),
    candidate('color', '#7c3aed'),
  ], { canSetName: true, canInstallFont: true });

  const order = [...html.matchAll(/data-ds-tray-group="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['color', 'font', 'name'], 'groups render colour → font → name');
  assert.ok(!html.includes('data-ds-tray-group="logo"'), 'an empty group is not rendered at all');
  assert.ok(!html.includes('data-ds-tray-group="asset"'));
  assert.equal(trayHtml([]), '', 'an empty tray renders nothing');
});

test('trayHtml escapes a hostile provenance label and a hostile value', () => {
  const html = trayHtml([
    candidate('color', '#fff" onload="alert(1)', {
      provenance: { kind: 'image', label: '<img src=x onerror=alert(1)>', detail: '"><script>' },
    }),
  ]);
  assert.ok(!html.includes('<img src=x'), 'the provenance label never reaches the sink as markup');
  assert.ok(!html.includes('<script>'), 'nor does the provenance detail');
  assert.ok(html.includes('&lt;img src=x'), 'it is escaped, not dropped');
  assert.ok(!/style="background:#fff"\s+onload/.test(html), 'the value cannot break out of the style attribute');
  assert.ok(html.includes('&quot;'), 'the quote in the value is escaped');
});

test('trayHtml renders no Add for a candidate type with no handler', () => {
  const html = trayHtml([candidate('logo', 'mark.svg'), candidate('asset', 'poster.png')]);
  assert.ok(!html.includes('data-ds-tray-add'), 'logo and asset have no producer, so no dead button');
  assert.equal([...html.matchAll(/data-ds-tray-dismiss/g)].length, 2, 'both rows keep Dismiss');

  const name = trayHtml([candidate('name', 'Acme')]);
  assert.ok(!name.includes('data-ds-tray-add'), 'a name has no Add when the handler was not passed');
  assert.ok(trayHtml([candidate('name', 'Acme')], { canSetName: true }).includes('data-ds-tray-add'),
    'and does when it was');
});

test('trayHtml offers Install from Google only for a family we can fetch', () => {
  const known = trayHtml([candidate('font', 'Inter')], { canInstallFont: true });
  assert.ok(known.includes('data-ds-tray-add'), 'a fetchable family is addable');
  assert.ok(known.includes('Install from Google'));

  const unknown = trayHtml([candidate('font', 'Bespoke Grotesk Pro')], { canInstallFont: true });
  assert.ok(!unknown.includes('data-ds-tray-add'), 'an unfetchable family gets no Add');
  assert.ok(unknown.includes('No source we can fetch yet'), 'it says what WE have, not what exists');

  assert.ok(isFetchableFamily('inter'), 'family matching ignores case');
  assert.ok(!isFetchableFamily('Bespoke Grotesk Pro'));
});

test('trayHtml offers Add all only when a group has more than one addable row', () => {
  const one = trayHtml([candidate('color', '#111111')]);
  assert.ok(!one.includes('data-ds-tray-all'), 'a single row is its own Add all');

  const two = trayHtml([candidate('color', '#111111'), candidate('color', '#222222')]);
  assert.ok(two.includes('data-ds-tray-all="color"'));

  const logos = trayHtml([candidate('logo', 'a.svg'), candidate('logo', 'b.svg')]);
  assert.ok(!logos.includes('data-ds-tray-all'), 'nothing addable in the group, nothing to add all of');
});

// ── Mount ────────────────────────────────────────────────────────────────────

test('an Add calls addColors once for that candidate and marks it added', async () => {
  const tray = fakeTray([candidate('color', '#7c3aed'), candidate('color', '#111111')]);
  const added: ColorEntry[][] = [];
  const el = shell();
  const ui = mountTrayUi(el, { tray, addColors: (e) => { added.push(e); return e.length; } });
  ui.open();

  el.querySelector<HTMLElement>('[data-ds-tray-add="color-#7c3aed"]')!.click();
  await settle();

  assert.equal(added.length, 1, 'one press, one call');
  assert.deepEqual(added[0], [{ value: '#7c3aed', hex: '#7c3aed' }], 'one entry per call - one add is one token');
  assert.deepEqual(tray.calls, ['markAdded:color-#7c3aed']);
  assert.equal(ui.count(), 1, 'the added candidate is no longer pending');
  ui.teardown();
});

test('Add all adds n colours in n separate calls and marks each one', async () => {
  const tray = fakeTray([
    candidate('color', '#111111'), candidate('color', '#222222'), candidate('color', '#333333'),
  ]);
  const added: ColorEntry[][] = [];
  const el = shell();
  const ui = mountTrayUi(el, { tray, addColors: (e) => { added.push(e); return e.length; } });
  ui.open();

  el.querySelector<HTMLElement>('[data-ds-tray-all="color"]')!.click();
  await settle();

  assert.equal(added.length, 3, 'three candidates, three calls - never one batched call');
  assert.ok(added.every((call) => call.length === 1));
  assert.deepEqual(tray.calls, ['markAdded:color-#111111', 'markAdded:color-#222222', 'markAdded:color-#333333']);
  assert.equal(ui.count(), 0);
  ui.teardown();
});

test('a failed add leaves the candidate pending', async () => {
  const tray = fakeTray([candidate('font', 'Inter')]);
  const el = shell();
  const ui = mountTrayUi(el, {
    tray,
    addColors: () => 0,
    installFont: async () => { throw new Error('offline'); },
  });
  ui.open();

  el.querySelector<HTMLElement>('[data-ds-tray-add="font-Inter"]')!.click();
  await settle();

  assert.deepEqual(tray.calls, [], 'nothing was marked added');
  assert.equal(ui.count(), 1, 'the candidate is still there to try again');
  ui.teardown();
});

test('Dismiss removes the row, and the subscription is what repaints', async () => {
  const tray = fakeTray([candidate('color', '#111111'), candidate('color', '#222222')]);
  const el = shell();
  const ui = mountTrayUi(el, { tray, addColors: () => 1 });
  ui.open();
  assert.equal(el.querySelectorAll('.ds-tray-row').length, 2);

  el.querySelector<HTMLElement>('[data-ds-tray-dismiss="color-#111111"]')!.click();
  await settle();

  assert.deepEqual(tray.calls, ['dismiss:color-#111111']);
  assert.equal(el.querySelectorAll('.ds-tray-row').length, 1, 'the repaint came off the model, not the click');
  assert.equal(el.querySelector<HTMLElement>('.ds-tray-row')!.dataset.dsTrayRow, 'color-#222222');
  ui.teardown();
});

test('a model change from anywhere else repaints the open tray', async () => {
  const tray = fakeTray([candidate('color', '#111111')]);
  const el = shell();
  const ui = mountTrayUi(el, { tray, addColors: () => 1 });
  ui.open();
  assert.equal(el.querySelectorAll('.ds-tray-row').length, 1);

  await tray.add([candidate('font', 'Inter')]); // a scan landing while the tray is open
  assert.equal(el.querySelectorAll('.ds-tray-row').length, 2);
  assert.equal(ui.count(), 2);
  ui.teardown();
});

test('the tray closes itself when its last candidate leaves', async () => {
  const tray = fakeTray([candidate('color', '#111111')]);
  const opens: boolean[] = [];
  const el = shell();
  const ui = mountTrayUi(el, { tray, addColors: () => 1, onOpenChange: (o) => opens.push(o) });
  ui.open();
  assert.equal(ui.isOpen(), true);

  el.querySelector<HTMLElement>('[data-ds-tray-dismiss="color-#111111"]')!.click();
  await settle();

  assert.equal(ui.isOpen(), false, 'an empty tray is not advertised');
  assert.deepEqual(opens, [true, false], 'and the view is told, for the bottom-edge single-owner rule');
  ui.teardown();
});

test('close and collapse: Escape is consumed only when the tray took it', () => {
  const tray = fakeTray([candidate('color', '#111111')]);
  const el = shell();
  const ui = mountTrayUi(el, { tray, addColors: () => 1 });

  assert.equal(ui.collapse(), false, 'a closed tray never swallows Escape');
  ui.open();
  assert.equal(ui.isOpen(), true);
  assert.equal(ui.collapse(), true, 'an open dock closes');
  assert.equal(ui.isOpen(), false);

  ui.toggle();
  assert.equal(ui.isOpen(), true);
  ui.close();
  assert.equal(ui.isOpen(), false);
  ui.teardown();
});

test('on a phone the sheet driver attaches, and Escape folds before it closes', () => {
  phone = true;
  try {
    const tray = fakeTray([candidate('color', '#111111')]);
    const el = shell();
    const ui = mountTrayUi(el, { tray, addColors: () => 1 });

    assert.equal(el.getAttribute('data-ds-tray-sheet'), null, 'a closed tray drives nothing');
    ui.open();
    assert.equal(el.getAttribute('data-ds-tray-sheet'), 'half', 'the sheet opens half up, not buried');

    assert.equal(ui.collapse(), true, 'the first Escape folds the sheet');
    assert.equal(el.getAttribute('data-ds-tray-sheet'), 'peek');
    assert.equal(ui.isOpen(), true, 'folding is not closing - the tray stays reachable');
    assert.equal(ui.collapse(), false, 'a peeking sheet hands Escape on to whatever is behind it');

    ui.close();
    assert.equal(el.getAttribute('data-ds-tray-sheet'), null, 'closing detaches the driver and its state');
    ui.teardown();
  } finally {
    phone = false;
  }
});

// ── Focus (every action destroys the control that ran it) ────────────────────

test('an Add keeps focus in the list: on the same row when it survives, on its successor when it does not', async () => {
  const tray = fakeTray([
    candidate('color', '#111111'), candidate('color', '#222222'), candidate('color', '#333333'),
  ]);
  const el = shell();
  const ui = mountTrayUi(el, { tray, addColors: () => 1 });
  ui.open();

  // Dismiss the middle row from the keyboard: its own button is gone after the
  // repaint, so focus must land on whatever took that position - never <body>.
  const middle = el.querySelector<HTMLElement>('[data-ds-tray-dismiss="color-#222222"]')!;
  middle.focus();
  middle.click();
  await settle();

  assert.notEqual(document.activeElement, document.body, 'focus was not thrown to the top of the document');
  assert.equal(
    (document.activeElement as HTMLElement).dataset.dsTrayDismiss, 'color-#333333',
    'the row that took its place holds focus',
  );

  // An Add on the LAST remaining row: nothing takes its position, so focus falls
  // back to the row before it rather than off the panel.
  const last = el.querySelector<HTMLElement>('[data-ds-tray-add="color-#333333"]')!;
  last.focus();
  last.click();
  await settle();
  assert.notEqual(document.activeElement, document.body);
  assert.ok(el.contains(document.activeElement), 'focus is still inside the tray');
  ui.teardown();
});

test('opening from the toggle moves focus in, and closing hands it back', async () => {
  const tray = fakeTray([candidate('color', '#111111')]);
  const el = shell();
  const toggle = document.createElement('button');
  toggle.type = 'button';
  document.body.appendChild(toggle);
  const ui = mountTrayUi(el, { tray, addColors: () => 1, toggle });

  assert.equal(toggle.getAttribute('aria-controls'), ui.panelId, 'the disclosure pair is programmatic');
  assert.equal(el.querySelector('.ds-tray')!.id, ui.panelId, 'and it names the panel that exists');

  toggle.focus();
  ui.toggle();
  assert.ok(el.querySelector('.ds-tray')!.contains(document.activeElement), 'the press lands focus in the panel');

  ui.toggle();
  assert.equal(document.activeElement, toggle, 'closing returns focus to the control that opened it');

  ui.teardown();
  assert.equal(toggle.getAttribute('aria-controls'), null, 'a torn-down panel is not still named');
  toggle.remove();
});

test('a scan-driven open never steals focus', () => {
  const tray = fakeTray([candidate('color', '#111111')]);
  const el = shell();
  const elsewhere = document.createElement('input');
  document.body.appendChild(elsewhere);
  const ui = mountTrayUi(el, { tray, addColors: () => 1 });

  elsewhere.focus();
  ui.open(); // what keepInTray does - the source dialog may still be open
  assert.equal(document.activeElement, elsewhere, 'the tray opened around the person, not over them');
  ui.teardown();
  elsewhere.remove();
});

test('an empty tray never opens, however it is asked', () => {
  const tray = fakeTray([candidate('color', '#111111')]);
  const opens: boolean[] = [];
  const el = shell();
  const ui = mountTrayUi(el, { tray, addColors: () => 1, onOpenChange: (o) => opens.push(o) });

  // Everything already added: the model reports nothing pending, which is the
  // state a rescan of an exhausted source lands in.
  void tray.markAdded('color-#111111');
  assert.equal(ui.count(), 0);

  ui.open();
  assert.equal(ui.isOpen(), false, 'open() refuses - the guard in render() only fires on an OPEN tray');
  ui.toggle();
  assert.equal(ui.isOpen(), false, 'and so does the toggle');
  assert.deepEqual(opens, [], 'the view is never told to resync a panel that did not appear');
  assert.equal(el.querySelector<HTMLElement>('.ds-tray')!.hidden, true);
  ui.teardown();
});

test('a colour the add path refuses says so, and the candidate stays', async () => {
  const tray = fakeTray([candidate('color', '#111111')]);
  const el = shell();
  const ui = mountTrayUi(el, { tray, addColors: () => 0 });   // nothing landed
  ui.open();

  el.querySelector<HTMLElement>('[data-ds-tray-add="color-#111111"]')!.click();
  await settle();
  await new Promise((r) => { requestAnimationFrame(() => r(null)); }); // announce() defers a frame

  assert.deepEqual(tray.calls, [], 'a refusal is not an add');
  assert.equal(ui.count(), 1, 'the candidate is still there to try again');
  const live = [...document.querySelectorAll('[data-a11y-live]')].map((n) => n.textContent).join(' ');
  assert.match(live, /could not be added/, 'a press that reports nothing added is not silent');
  ui.teardown();
});

test('a provenance chip carries its full label as a title, detail or not', () => {
  const plain = trayHtml([candidate('color', '#111111', {
    provenance: { kind: 'file', label: 'a-very-long-export-file-name-from-2026.tokens.json' },
  })]);
  assert.match(plain, /title="a-very-long-export-file-name-from-2026\.tokens\.json"/,
    'the clipped chip is recoverable without a detail');

  const detailed = trayHtml([candidate('color', '#111111', {
    provenance: { kind: 'image', label: 'shot.png', detail: 'fill' },
  })]);
  assert.match(detailed, /title="shot\.png \(fill\)"/);
});

test('teardown unsubscribes and leaves nothing in the shell', async () => {
  const tray = fakeTray([candidate('color', '#111111')]);
  const el = shell();
  const ui = mountTrayUi(el, { tray, addColors: () => 1 });
  ui.open();
  assert.ok(el.querySelector('.ds-tray'));

  ui.teardown();
  assert.equal(el.querySelector('.ds-tray'), null, 'the panel is removed');
  assert.equal(el.querySelector('.ds-tray-grip'), null, 'and so is its sibling grip');

  // A late model change must not paint into a torn-down mount.
  await assert.doesNotReject(tray.add([candidate('color', '#222222')]));
  assert.equal(el.querySelector('.ds-tray'), null);
});
