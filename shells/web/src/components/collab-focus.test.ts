// SPDX-License-Identifier: MPL-2.0
/*
 * collab-focus.ts - the two remote-focus decorations (plan 100 section 4.1, section 4.6, section 4.8).
 *
 * Run directly:  node --test shells/web/src/components/collab-focus.test.ts
 *
 * The fixture is a miniature of the real tool view: the sidebar markup
 * views/tool-inputs.ts emits (`.input-row` wrapping `[data-input-id]`,
 * `.blocks-input` holding `.block-item[data-block-index]`) and the canvas markup
 * `resolveCanvasAnnotations` leaves behind (`[data-canvas-input="<id>"]` and
 * `"<blocksId>:<index>"`). Every selector this module uses is therefore exercised
 * against the shapes it will actually meet, not against a shape invented here.
 *
 * The claims, in the order a regression would hurt:
 *
 *  1. THE CANVAS IS NEVER TOUCHED (section 4.6). Asserted the only way that means anything:
 *     the fixture's `.tool-canvas` innerHTML is captured and compared BYTE FOR BYTE
 *     after a full decorate/undecorate cycle. An export must be identical whether
 *     you are alone or in a room of six; a stray class or data attribute written
 *     into the render surface would not show up as a failure anywhere else, it would
 *     show up in somebody's PNG.
 *  2. THE SIDEBAR DECORATION ATTACHES AND FULLY DETACHES. Attaching is easy;
 *     leaving a row byte-identical afterwards (no class, no chip, not even an empty
 *     `style=""`) is what keeps a long session from silting up.
 *  3. A STABLE ROW ID FINDS THE RIGHT CARD. The wire carries an id, the DOM
 *     addresses an index, and the model's value order is the only honest bridge - 
 *     including when a concurrent insert has renumbered everything below it.
 *  4. MOST-RECENT WINS THE RING, EVERYONE IS IN THE STACK (section 4.6), and "most recent"
 *     means most recently MOVED, so a 15 s heartbeat cannot steal the ring.
 *
 * jsdom returns a zero rect from getBoundingClientRect, so the canvas-outline
 * geometry is driven through the module's injected measure seams - a test that
 * measured the real DOM here would assert 0 === 0 and prove nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><main id="view"></main></body></html>');
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

const { ROW_ID_FIELD } = await import('../lib/row-id.ts');
const {
  REMOTE_FOCUS_CLASS,
  blockRowIndex,
  createCollabFocus,
  parseFocus,
} = await import('./collab-focus.ts');
type Mod = typeof import('./collab-focus.ts');
type FocusPeer = Parameters<ReturnType<Mod['createCollabFocus']>['setPeers']>[0][number];

// ── fixture ───────────────────────────────────────────────────────────────────

/** The sidebar shapes views/tool-inputs.ts renders, trimmed to what is addressed. */
const SIDEBAR_HTML = `
  <label class="input-row">
    <span class="input-label"><span class="input-label-text">Headline</span></span>
    <input type="text" data-input-id="headline" value="Hello">
  </label>
  <div class="input-row" role="group">
    <span class="input-label"><span class="input-label-text">Scenes</span></span>
    <div class="blocks-input blocks-input--cards" data-input-id="scenes">
      <div class="blocks-list">
        <div class="block-item is-typed" data-block-index="0"><div class="block-fields"></div></div>
        <div class="block-item is-typed" data-block-index="1"><div class="block-fields"></div></div>
        <div class="block-item is-typed" data-block-index="2"><div class="block-fields"></div></div>
      </div>
    </div>
  </div>`;

/** What resolveCanvasAnnotations leaves on the render surface. */
const CANVAS_HTML =
  '<h1 data-canvas-input="headline">Hello</h1>'
  + '<section data-canvas-input="scenes:0">one</section>'
  + '<section data-canvas-input="scenes:1">two</section>';

interface Fixture {
  focus: ReturnType<Mod['createCollabFocus']>;
  sidebar: HTMLElement;
  canvas: HTMLElement;
  stage: HTMLElement;
  outer: HTMLElement;
  said: string[];
  rows(): HTMLElement[];
  rings(): HTMLElement[];
  setRows(rows: Array<Record<string, unknown>>): void;
  setStill(still: boolean): void;
}

/** Rects for the two annotated canvas nodes, keyed by their annotation. */
const ANCHOR_RECTS: Record<string, { left: number; top: number; width: number; height: number }> = {
  headline: { left: 210, top: 120, width: 300, height: 40 },
  'scenes:1': { left: 210, top: 200, width: 150, height: 60 },
};
const LAYER_RECT = { left: 200, top: 100, width: 400, height: 300 };

function mount(opts: { observe?: boolean } = {}): Fixture {
  const view = document.getElementById('view') as HTMLElement;
  view.innerHTML = `
    <div id="tool-layout">
      <aside class="tool-sidebar"><div id="tool-inputs" class="tool-inputs">${SIDEBAR_HTML}</div></aside>
      <div class="tool-stage" id="tool-stage">
        <div class="tool-canvas-outer" id="tool-canvas-outer">
          <div class="tool-canvas" id="tool-canvas">${CANVAS_HTML}</div>
        </div>
      </div>
    </div>`;
  const sidebar = document.getElementById('tool-inputs') as HTMLElement;
  const canvas = document.getElementById('tool-canvas') as HTMLElement;
  const stage = document.getElementById('tool-stage') as HTMLElement;
  const outer = document.getElementById('tool-canvas-outer') as HTMLElement;
  const said: string[] = [];
  let still = false;
  let rows: Array<Record<string, unknown>> = [
    { [ROW_ID_FIELD]: 'R0', text: 'one' },
    { [ROW_ID_FIELD]: 'R1', text: 'two' },
    { [ROW_ID_FIELD]: 'R2', text: 'three' },
  ];

  const focus = createCollabFocus({
    sidebar,
    canvas,
    getModel: () => [
      { id: 'headline', type: 'text', value: 'Hello' },
      { id: 'scenes', type: 'blocks', fields: [{ id: 'text' }], value: rows },
    ],
    announce: (m) => { said.push(m); },
    reducedMotion: () => still,
    observe: opts.observe === true,
    measureElement: (el) => ANCHOR_RECTS[el.dataset.canvasInput ?? ''] ?? { left: 0, top: 0, width: 0, height: 0 },
    measureLayer: () => LAYER_RECT,
  });

  return {
    focus,
    sidebar,
    canvas,
    stage,
    outer,
    said,
    rows: () => [...sidebar.querySelectorAll<HTMLElement>(`.${REMOTE_FOCUS_CLASS}`)],
    rings: () => [...(focus.el?.querySelectorAll<HTMLElement>('.collab-focus-box') ?? [])],
    setRows(next) { rows = next; },
    setStill(next) { still = next; },
  };
}

const peer = (id: string, name: string, color: string, focus: string | null, extra: Partial<FocusPeer> = {}): FocusPeer =>
  ({ id, name, color, focus, ...extra });

// ── 0. pure addressing ────────────────────────────────────────────────────────

test('parseFocus splits an input from a row at the LAST colon', () => {
  assert.deepEqual(parseFocus('headline'), { inputId: 'headline', rowId: null });
  assert.deepEqual(parseFocus('scenes:R2'), { inputId: 'scenes', rowId: 'R2' });
  // Greedy, matching views/tool.ts's own `^(.+):(\d+)$` canvas mapping - one
  // splitting convention for both directions.
  assert.deepEqual(parseFocus('a:b:R2'), { inputId: 'a:b', rowId: 'R2' });
  // Malformed shapes address the whole input rather than half a row.
  assert.deepEqual(parseFocus('scenes:'), { inputId: 'scenes:', rowId: null });
  assert.deepEqual(parseFocus(':R2'), { inputId: ':R2', rowId: null });
  for (const junk of [null, undefined, '', '   ']) assert.equal(parseFocus(junk), null);
});

test('blockRowIndex maps a stable row id through the model value order', () => {
  const item = {
    id: 'scenes',
    type: 'blocks',
    fields: [{ id: 'text' }],
    value: [{ [ROW_ID_FIELD]: 'R0' }, { [ROW_ID_FIELD]: 'R1' }, { [ROW_ID_FIELD]: 'R2' }],
  };
  assert.equal(blockRowIndex(item, 'R2'), 2);
  assert.equal(blockRowIndex(item, 'nope'), -1);
  assert.equal(blockRowIndex(null, 'R0'), -1);
  // The numeric fallback is for a peer that still speaks in indices (a build from
  // before row ids, or a session whose lazy migration has not run).
  assert.equal(blockRowIndex(item, '1'), 1);
  assert.equal(blockRowIndex(item, '9'), -1);

  // A canvas collection uses the tool's OWN declared id field, not the hidden one - 
  // the rowIdField rule, so a row born on the canvas and one born in the sidebar
  // resolve identically.
  const canvasItem = {
    id: 'boxes',
    type: 'blocks',
    fields: [{ id: 'id' }, { id: 'x' }],
    canvas: { idField: 'id' },
    value: [{ id: 'B0' }, { id: 'B1' }],
  };
  assert.equal(blockRowIndex(canvasItem, 'B1'), 1);
});

// ── 1. the canvas is never touched ────────────────────────────────────────────

test('a full decorate/undecorate cycle leaves the render surface byte-identical', () => {
  const f = mount();
  const before = f.canvas.innerHTML;

  f.focus.setPeers([
    peer('p1', 'Priya', '#4ea1ff', 'headline'),
    peer('p2', 'Sam', '#ffb03a', 'scenes:R1'),
  ]);
  assert.equal(f.rings().length, 2, 'both peers are outlined on the canvas');
  assert.equal(f.canvas.innerHTML, before, 'and NOTHING was written into the canvas to do it');

  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'scenes:R1')]);
  f.focus.reanchor();
  f.focus.setPeers([]);
  assert.equal(f.canvas.innerHTML, before, 'still identical after churn + a re-anchor');

  f.focus.dispose();
  assert.equal(f.canvas.innerHTML, before, 'and after teardown');
});

test('the outline layer is a SIBLING of the canvas, never a child', () => {
  const f = mount();
  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'headline')]);
  const layer = f.focus.el;
  assert.ok(layer, 'a canvas with a parent gets a layer');
  assert.equal(f.canvas.contains(layer), false, 'presence chrome never enters the export stage (section 4.6)');
  assert.equal(layer.parentElement, f.stage,
    'it hangs off .tool-stage - the anchor collab.css describes, and the one that is not '
    + 'clipped by .tool-canvas-outer\'s overflow:hidden');
  assert.ok(layer.classList.contains('collab-canvas-layer'), 'the class the shared sheet styles');
  assert.equal(f.canvas.querySelectorAll('.collab-focus-box').length, 0);
  f.focus.dispose();
  assert.equal(f.stage.querySelector('.collab-canvas-layer'), null, 'and dispose takes it away again');
});

test('canvas outlines anchor from the annotated element rects', () => {
  const f = mount();
  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'headline')]);
  const ring = f.rings()[0]!;
  // 3px of breathing room on every side, rebased onto the layer's own origin.
  assert.equal(ring.style.transform, 'translate3d(7px, 17px, 0)');
  assert.equal(ring.style.width, '306px');
  assert.equal(ring.style.height, '46px');
  assert.equal(ring.style.getPropertyValue('--collab-color'), '#4ea1ff');
  assert.equal(ring.querySelector('.collab-focus-box-label')?.textContent, 'Priya',
    'the name rides the outline - colour is never the only differentiator (section 4.8)');

  // A blocks row resolves through the SAME index mapping the sidebar uses, so both
  // decorations point at the same row.
  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'scenes:R1')]);
  assert.equal(f.rings()[0]!.style.transform, 'translate3d(7px, 97px, 0)');
  f.focus.dispose();
});

test('a focus with no rendered canvas region simply gets no outline', () => {
  const f = mount();
  // "scenes:R2" is a real row, but the template only annotated rows 0 and 1.
  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'scenes:R2')]);
  assert.equal(f.rings().length, 0, 'no anchor, no outline - and no thrown error');
  assert.equal(f.rows().length, 1, 'the sidebar still shows who is where');
  f.focus.dispose();
});

test('outline nodes are pooled by identity across roster churn', () => {
  const f = mount();
  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'headline')]);
  const first = f.rings()[0];
  assert.equal(f.focus.stats().pooled, 0);

  f.focus.setPeers([]);
  assert.equal(f.rings().length, 0);
  assert.equal(f.focus.stats().pooled, 1, 'released to the free list, not to the GC');

  f.focus.setPeers([peer('p2', 'Sam', '#ffb03a', 'headline')]);
  assert.equal(f.rings()[0], first, 'the next peer takes the very same node back');
  assert.equal(f.rings()[0]?.querySelector('.collab-focus-box-label')?.textContent, 'Sam');
  f.focus.dispose();
});

// ── 2. the sidebar decoration ─────────────────────────────────────────────────

test('a remote focus rings its sidebar row, and leaves no trace when it goes', () => {
  const f = mount();
  const row = f.sidebar.querySelector<HTMLElement>('.input-row')!;
  const before = row.outerHTML;

  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'headline')]);
  assert.ok(row.classList.contains(REMOTE_FOCUS_CLASS));
  assert.equal(row.style.getPropertyValue('--collab-color'), '#4ea1ff');
  const chip = row.querySelector<HTMLElement>('.collab-focus-chip')!;
  assert.equal(chip.textContent, 'Priya');
  assert.equal(row.querySelector('[data-collab-chips]')?.getAttribute('aria-hidden'), 'true',
    'the row is a <label>: visible chip text would be absorbed into the control\'s '
    + 'accessible name, so the chips are hidden from AT and announce() carries the news');

  f.focus.setPeers([]);
  assert.equal(row.outerHTML, before,
    'a row that was decorated is indistinguishable from one that never was - no class, '
    + 'no chip, not even an empty style=""');
  f.focus.dispose();
});

test('a blocks row focus rings the right card, and follows a renumbering', () => {
  const f = mount();
  const cards = [...f.sidebar.querySelectorAll<HTMLElement>('.block-item')];

  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'scenes:R2')]);
  assert.equal(f.rows().length, 1);
  assert.equal(f.rows()[0], cards[2], 'the stable id resolved to card #2 through the model');

  // A peer inserts a row at the top. The id did not move; every INDEX below it did,
  // and the sidebar re-rendered with a fourth card. Re-deriving the mapping on each
  // apply (rather than caching it) is what keeps the ring on the row the
  // collaborator is actually in.
  f.setRows([
    { [ROW_ID_FIELD]: 'NEW', text: 'inserted' },
    { [ROW_ID_FIELD]: 'R0' }, { [ROW_ID_FIELD]: 'R1' }, { [ROW_ID_FIELD]: 'R2' },
  ]);
  const list = f.sidebar.querySelector<HTMLElement>('.blocks-list')!;
  list.innerHTML = [0, 1, 2, 3]
    .map(i => `<div class="block-item is-typed" data-block-index="${i}"><div class="block-fields"></div></div>`)
    .join('');
  f.focus.reanchor();
  const renumbered = [...f.sidebar.querySelectorAll<HTMLElement>('.block-item')];
  assert.equal(f.rows()[0], renumbered[3], 'the ring moved with the row, not with the index');
  f.focus.dispose();
});

test('a row inside a decorated row keeps its own chips', () => {
  // `.block-item` lives INSIDE the `.input-row` of its blocks input, so both can be
  // decorated at once - one peer on the whole input, another on a single card. A
  // descendant search for "the chip stack" from the outer row finds the inner card's
  // and rebuilds it with the wrong names (or deletes it); the stacks are direct
  // children for exactly that reason.
  const f = mount();
  f.focus.setPeers([
    peer('p1', 'Priya', '#4ea1ff', 'scenes'),      // the whole input
    peer('p2', 'Sam', '#ffb03a', 'scenes:R1'),     // one card inside it
  ]);
  const outer = f.sidebar.querySelectorAll<HTMLElement>('.input-row')[1]!;
  const card = f.sidebar.querySelectorAll<HTMLElement>('.block-item')[1]!;
  assert.ok(outer.classList.contains(REMOTE_FOCUS_CLASS) && card.classList.contains(REMOTE_FOCUS_CLASS));
  assert.deepEqual(
    [...outer.children].filter(c => c.hasAttribute('data-collab-chips'))
      .flatMap(s => [...s.children].map(c => c.textContent)),
    ['Priya'],
    'the outer row shows only its own occupant');
  assert.deepEqual(
    [...card.children].filter(c => c.hasAttribute('data-collab-chips'))
      .flatMap(s => [...s.children].map(c => c.textContent)),
    ['Sam'],
    'and the nested card keeps its own');

  // Releasing the OUTER one must not strip the inner card.
  f.focus.setPeers([peer('p2', 'Sam', '#ffb03a', 'scenes:R1')]);
  assert.equal(outer.classList.contains(REMOTE_FOCUS_CLASS), false);
  assert.equal(card.querySelector('.collab-focus-chip')?.textContent, 'Sam');
  f.focus.dispose();
});

test('an unresolvable row falls back to ringing the whole blocks input', () => {
  const f = mount();
  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'scenes:GHOST')]);
  const decorated = f.rows();
  assert.equal(decorated.length, 1);
  assert.ok(decorated[0]!.classList.contains('input-row'),
    '"somebody is working in here" is the useful half when the exact row cannot be found');
  f.focus.dispose();
});

test('an unknown input id decorates nothing at all', () => {
  const f = mount();
  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'not-an-input')]);
  assert.equal(f.rows().length, 0);
  assert.equal(f.rings().length, 0);
  f.focus.dispose();
});

test('an away peer drops its decorations but keeps its roster seat', () => {
  const f = mount();
  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'headline')]);
  assert.equal(f.rows().length, 1);
  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'headline', { away: true })]);
  assert.equal(f.rows().length, 0, 'a hidden tab\'s ring is stale information, not presence (section 11.4)');
  assert.equal(f.rings().length, 0);
  f.focus.dispose();
});

// ── 3. two people, one row ────────────────────────────────────────────────────

test('most-recent owns the ring; everybody shows in the chip stack', () => {
  const f = mount();
  f.focus.setPeers([
    peer('p1', 'Priya', '#4ea1ff', 'headline'),
    peer('p2', 'Sam', '#ffb03a', 'headline'),
  ]);
  const row = f.rows()[0]!;
  assert.equal(row.style.getPropertyValue('--collab-color'), '#ffb03a', 'Sam arrived on the row second');
  const chips = [...row.querySelectorAll('.collab-focus-chip')].map(c => c.textContent);
  assert.deepEqual(chips, ['Sam', 'Priya'], 'most recent first, and nobody is dropped');

  // Priya moves away and comes back: she is now the most recent.
  f.focus.setPeers([
    peer('p1', 'Priya', '#4ea1ff', 'scenes:R0'),
    peer('p2', 'Sam', '#ffb03a', 'headline'),
  ]);
  f.focus.setPeers([
    peer('p1', 'Priya', '#4ea1ff', 'headline'),
    peer('p2', 'Sam', '#ffb03a', 'headline'),
  ]);
  assert.equal(f.rows()[0]!.style.getPropertyValue('--collab-color'), '#4ea1ff');

  // A heartbeat restating the same presence must NOT reshuffle the ring: "most
  // recent" means most recently MOVED, not most recently heard from (section 4.7).
  f.focus.setPeers([
    peer('p2', 'Sam', '#ffb03a', 'headline'),
    peer('p1', 'Priya', '#4ea1ff', 'headline'),
  ]);
  assert.equal(f.rows()[0]!.style.getPropertyValue('--collab-color'), '#4ea1ff',
    'the ring stayed with Priya, who actually moved last');
  f.focus.dispose();
});

// ── 4. re-application, a11y, teardown ─────────────────────────────────────────

test('reanchor re-decorates a sidebar the shell has rebuilt underneath it', () => {
  const f = mount();
  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'headline')]);
  assert.equal(f.rows().length, 1);

  // What renderInputs does on every keystroke: the whole panel's innerHTML is
  // replaced, so the decorated node is now detached and its replacement is clean.
  f.sidebar.innerHTML = SIDEBAR_HTML;
  assert.equal(f.rows().length, 0);
  f.focus.reanchor();
  assert.equal(f.rows().length, 1, 'the decoration is re-applied against the new nodes');
  assert.equal(f.rows()[0]!.querySelector('.collab-focus-chip')?.textContent, 'Priya');

  // …and the stale sweep is by QUERY, so it finds rows this module never saw.
  f.focus.setPeers([]);
  assert.equal(f.rows().length, 0);
  f.focus.dispose();
});

test('a focus handoff is spoken, a heartbeat is not', () => {
  const f = mount();
  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'headline')]);
  assert.deepEqual(f.said, ['Priya is editing Headline'],
    'the visible label, not the raw input id - and via announce(), because the chips are aria-hidden');

  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'headline')]);
  assert.equal(f.said.length, 1, 'restating the same focus says nothing');

  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'scenes:R1')]);
  assert.equal(f.said.length, 2);
  assert.match(f.said[1]!, /^Priya is editing /);
  f.focus.dispose();
});

test('reduced motion removes the outline transition rather than the outline', () => {
  const f = mount();
  f.setStill(true);
  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'headline')]);
  assert.equal(f.rings()[0]?.style.transition, 'none',
    'rings do not move on their own, so section 4.8 only has to stop them SLIDING when they '
    + 're-anchor - and the inline mirror covers the injected preference seam, which is '
    + 'the one thing collab.css\'s own two gates cannot see');
  assert.equal(f.rings().length, 1, 'the presence itself is never hidden');

  f.setStill(false);
  f.focus.reanchor();
  assert.equal(f.rings()[0]?.style.transition, '',
    'and it hands the property back to the sheet rather than pinning a value');
  f.focus.dispose();
});

test('dispose clears every decoration and is idempotent', () => {
  const f = mount();
  const rowBefore = f.sidebar.innerHTML;
  const canvasBefore = f.canvas.innerHTML;
  f.focus.setPeers([
    peer('p1', 'Priya', '#4ea1ff', 'headline'),
    peer('p2', 'Sam', '#ffb03a', 'scenes:R1'),
  ]);

  f.focus.dispose();
  assert.equal(f.sidebar.innerHTML, rowBefore, 'the sidebar is handed back exactly as it was found');
  assert.equal(f.canvas.innerHTML, canvasBefore);
  assert.equal(f.focus.el, null);
  assert.deepEqual(f.focus.stats(), { rings: 0, pooled: 0, rows: 0 });

  f.focus.dispose();
  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'headline')]);
  f.focus.reanchor();
  assert.equal(f.rows().length, 0, 'inert after teardown');
});

test('a throwing getModel degrades to no blocks mapping, never to a broken frame', () => {
  const view = document.getElementById('view') as HTMLElement;
  view.innerHTML = `<div id="tool-inputs">${SIDEBAR_HTML}</div>`;
  const sidebar = document.getElementById('tool-inputs') as HTMLElement;
  const focus = createCollabFocus({
    sidebar,
    getModel: () => { throw new Error('model read blew up'); },
    reducedMotion: () => false,
    announce: () => {},
    observe: false,
  });
  focus.setPeers([{ id: 'p1', name: 'Priya', color: '#4ea1ff', focus: 'scenes:R1' }]);
  assert.equal(sidebar.querySelectorAll(`.${REMOTE_FOCUS_CLASS}`).length, 1,
    'the row-level fallback still names the input a collaborator is working in');
  assert.equal(focus.el, null, 'and with no canvas there is simply no outline layer');
  focus.dispose();
});

// ── the sheet, and the re-anchor trigger nothing else fires ───────────────────

test('the module injects its own sheet, and every class it writes is defined there', () => {
  const f = mount();
  f.focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'headline')]);

  const focusSheet = document.getElementById('lolly-collab-focus-css');
  const overlaySheet = document.getElementById('lolly-collab-overlay-css');
  assert.ok(focusSheet, 'the component carries its own <style>, like collab-pill.ts');
  assert.ok(overlaySheet, 'and ensures the shared layer\'s sheet, since a BORROWED layer '
    + 'never goes through collab-overlay.ts\'s own mount path');
  const css = (focusSheet.textContent ?? '') + (overlaySheet.textContent ?? '');

  // The regression this pins: every one of these once existed only as a string in
  // the module. `.collab-focus-box` as a default block div paints no border and no
  // colour, but `.collab-focus-box-label` DOES paint its textContent - so the
  // visible result was raw peer names stacked in normal flow over the stage, each
  // inline translate3d offsetting from the previous ring's height.
  const written = new Set<string>([
    ...[...f.rows()].flatMap(el => [...el.classList]),
    ...[...f.sidebar.querySelectorAll('*')].flatMap(el => [...el.classList]),
    ...[...(f.focus.el?.querySelectorAll('*') ?? [])].flatMap(el => [...el.classList]),
    ...(f.focus.el ? [...f.focus.el.classList] : []),
  ].filter(c => c.startsWith('collab-') || c === REMOTE_FOCUS_CLASS));
  assert.ok(written.has(REMOTE_FOCUS_CLASS) && written.has('collab-focus-chip')
    && written.has('collab-focus-box') && written.has('collab-focus-box-label'),
    'the fixture actually produced all four decorations');
  for (const name of written) {
    assert.ok(css.includes(`.${name}`), `.${name} is written onto a node but never styled`);
  }
  // The chip stack is addressed by attribute, not class, and carries the placement
  // the module used to state inline - which is why the offset can be a11y-scaled.
  assert.ok(css.includes('[data-collab-chips]'), 'the chip stack has a rule of its own');
  assert.match(css, /\[data-collab-chips\] \{[^}]*inset-block-start: calc\(-9px \* var\(--a11y-fs\)\)/);
  // section 4.8: chrome type rides the largeText multiplier, never a bare px.
  assert.ok(!/font-size: \d/.test(css), 'every font-size is a --a11y-fs multiple');
  // Minor, but it is the whole reason a per-ROW chip lands on the right card:
  // .block-item has no position of its own (tool.css), so the stack would otherwise
  // resolve against the enclosing .input-row and every peer's chip would pile up on
  // the collection header.
  assert.match(css, /\.block-item\.is-remote-focus \{[^}]*position: relative/);

  f.focus.dispose();
});

test('a canvas zoom re-anchors the rings, though it fires no event of its own', async () => {
  const view = document.getElementById('view') as HTMLElement;
  view.innerHTML = `
    <div id="tool-inputs">${SIDEBAR_HTML}</div>
    <div class="tool-stage" id="tool-stage">
      <div class="tool-canvas-outer" id="tool-canvas-outer">
        <div class="tool-canvas" id="tool-canvas">${CANVAS_HTML}</div>
      </div>
    </div>`;
  const sidebar = document.getElementById('tool-inputs') as HTMLElement;
  const canvas = document.getElementById('tool-canvas') as HTMLElement;
  const outer = document.getElementById('tool-canvas-outer') as HTMLElement;

  let zoom = 1;
  const focus = createCollabFocus({
    sidebar,
    canvas,
    getModel: () => [{ id: 'headline', type: 'text', value: 'Hello' }],
    announce: () => {},
    reducedMotion: () => false,
    observe: true,
    measureElement: () => ({ left: 200 * zoom, top: 100 * zoom, width: 300, height: 40 }),
    measureLayer: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  });
  focus.setPeers([peer('p1', 'Priya', '#4ea1ff', 'headline')]);
  const ring = focus.el?.querySelector<HTMLElement>('.collab-focus-box');
  assert.ok(ring, 'the fixture rings the annotated headline');
  assert.equal(ring.style.transform, 'translate3d(197px, 97px, 0)', 'anchored at 1x');

  // What views/tool-stage-nav.ts actually does for Cmd-wheel zoom, pinch, Space-drag
  // pan and every HUD key: a transform on `.tool-canvas-outer`, and NO event. No
  // scroll offset changes, the window does not resize, and the observed border box
  // is identical - so the module's other three triggers are all silent, and every
  // ring used to sit at its pre-zoom position until an unrelated model change.
  zoom = 2;
  outer.style.transform = 'translate(4px, 0px) scale(2)';
  await new Promise(r => setTimeout(r, 60));

  assert.equal(ring.style.transform, 'translate3d(397px, 197px, 0)',
    'the ring followed the zoom instead of being stranded');
  assert.equal(focus.stats().rings, 1, 'and it is the same pooled node, re-measured');

  focus.dispose();
  zoom = 3;
  outer.style.transform = 'scale(3)';
  await new Promise(r => setTimeout(r, 60));
  assert.equal(focus.stats().rings, 0, 'a disposed decorator hears nothing further');
});
