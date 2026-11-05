// SPDX-License-Identifier: MPL-2.0
/**
 * The picker grid draws the chosen emoji set (plan 252).
 *
 * The component is `unicode-emoji-picker`, which draws every cell as a text node
 * in whatever emoji face the machine has. drawPackArtwork walks its OPEN shadow
 * root with the runtime's own pass, so a person picks the glyph they will
 * actually get. What this file pins is our half of that:
 *
 *   1. only the cells the component is showing are drawn, because every cell of
 *      every category is in the DOM from the first frame;
 *   2. a rebuild of the grid is noticed and draws the new cells, once per burst;
 *   3. closing the popover stops the watch, so nothing is drawn into a grid
 *      nobody can see;
 *   4. a pass that reports no artwork leaves the grid exactly as it was, because
 *      a wall of identical placeholders is not a picker;
 *   5. each cell's artwork keeps local ids of its own, so one cell's gradient
 *      cannot paint another's.
 *
 * The picker element is a stand-in with a real shadow root: it wants a browser,
 * and the subject here is our wiring, not their grid. The emoji pass is a fake
 * that writes the same placement markup the engine writes.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/components/emoji-picker.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const CARROT = '\u{1F955}';
const BURGER = '\u{1F354}';
const CAR = '\u{1F697}';
const BALLOON = '\u{1F388}';
const GRIN = '\u{1F600}';

/** The shadow DOM the real component builds, cut down to what we draw into. */
const SHADOW = `<style>.emoji.hidden{display:none}</style><div class="emoji-picker">
  <div class="tabs"><div class="tab"><button type="button">${GRIN}</button></div></div>
  <div class="emojis">
    <div class="emoji"><button type="button">${CARROT}</button></div>
    <div class="emoji lazy-load"><button type="button">${BURGER}</button></div>
    <div class="emoji hidden"><button type="button">${CAR}</button></div>
    <div class="emoji"><button type="button">${BALLOON}</button>
      <div class="variations"><div class="emoji"><button type="button">${BALLOON}</button></div></div></div>
  </div>
</div>`;

/** Install a jsdom global so the module can touch document, frames and observers. */
function mountDom(): { dom: JSDOM; anchor: HTMLElement } {
  const dom = new JSDOM('<!doctype html><body><button id="cell">x</button></body>', { pretendToBeVisual: true });
  const g = globalThis as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  g.HTMLElement = dom.window.HTMLElement;
  g.CustomEvent = dom.window.CustomEvent;
  g.MutationObserver = dom.window.MutationObserver;
  g.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  g.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  return { dom, anchor: dom.window.document.getElementById('cell') as HTMLElement };
}

/** Define the stand-in element for this window, once. */
function definePicker(dom: JSDOM): () => Promise<void> {
  return async (): Promise<void> => {
    if (dom.window.customElements.get('unicode-emoji-picker')) return;
    const base = dom.window.HTMLElement;
    class StandIn extends base {
      constructor() {
        super();
        const root = (this as unknown as HTMLElement).attachShadow({ mode: 'open' });
        root.innerHTML = SHADOW;
      }
      selectTab(): void {}
      focusContent(): void {}
    }
    dom.window.customElements.define('unicode-emoji-picker', StandIn);
  };
}

/** Every emoji character this fixture uses, so the fake pass can find them. */
const EMOJI = new RegExp(`[${CARROT}${BURGER}${CAR}${BALLOON}${GRIN}]`, 'gu');

/**
 * A stand-in for the runtime's pass: each emoji cluster becomes the same span the
 * engine writes, carrying artwork with a local id. Ids are numbered per call, as
 * the engine numbers them, so two cells drawn by two calls mint the same id and
 * the scoper has something real to fix.
 */
function fakePass(dom: JSDOM, opts: { replaced?: (call: number) => number | undefined } = {}) {
  const seen: unknown[] = [];
  const apply = async (node: unknown): Promise<unknown> => {
    const root = node as Node;
    seen.push(root);
    let replaced = 0;
    // The engine names a placement's local ids after the work item's place in the
    // tree it was handed, so ids differ inside one call and repeat across calls.
    let item = 0;
    const walk = (element: Node): void => {
      for (const child of Array.from(element.childNodes)) {
        if (child.nodeType === 3) {
          const text = child.textContent ?? '';
          EMOJI.lastIndex = 0;
          if (!EMOJI.test(text)) continue;
          EMOJI.lastIndex = 0;
          const id = `e${item++}p0-g`;
          const span = dom.window.document.createElement('span');
          span.innerHTML = text.replace(EMOJI, (glyph) =>
            `<span class="lolly-emoji" role="img" data-emoji="${glyph}">`
            + `<svg><linearGradient id="${id}"></linearGradient>`
            + `<path fill="url(#${id})"></path></svg>`
            + `<span class="lolly-emoji-text">${glyph}</span></span>`);
          replaced += span.querySelectorAll('.lolly-emoji').length;
          child.parentNode?.replaceChild(span, child);
        } else if (child.nodeType === 1 && !(child as Element).classList.contains('lolly-emoji')) {
          walk(child);
        }
      }
    };
    walk(root);
    const forced = opts.replaced?.(seen.length);
    return { present: true, replaced: forced ?? replaced, unresolved: 0, census: [] };
  };
  return { apply, get calls() { return seen.length; }, seen };
}

/** The characters this shadow root now draws as artwork. jsdom's selector engine
 *  does not match an attribute value holding an astral character, so the read is
 *  done in JavaScript rather than in a selector. */
function drawnGlyphs(picker: HTMLElement): string[] {
  return [...picker.shadowRoot!.querySelectorAll('.lolly-emoji')]
    .map((span) => span.getAttribute('data-emoji') ?? '');
}

/** Let microtasks, timers and one animation frame run. */
const settle = (ms = 60): Promise<void> => new Promise((done) => setTimeout(done, ms));

/** The stand-in element, mounted in the document with its grid built. */
async function mountPicker(dom: JSDOM): Promise<HTMLElement> {
  await definePicker(dom)();
  const picker = dom.window.document.createElement('unicode-emoji-picker') as unknown as HTMLElement;
  dom.window.document.body.append(picker);
  return picker;
}

const drawn = (picker: HTMLElement, selector: string): number =>
  picker.shadowRoot!.querySelectorAll(`${selector} .lolly-emoji`).length;

// -- what gets drawn ---------------------------------------------------------

test('the visible cells and the tab strip are drawn, the rest are left alone', async () => {
  const { dom } = mountDom();
  const { drawPackArtwork } = await import('./emoji-picker.ts');
  const picker = await mountPicker(dom);
  const pass = fakePass(dom);

  const run = drawPackArtwork(picker, pass);
  await run.ready;

  assert.equal(drawn(picker, '.tabs'), 1, 'the tab strip glyph is artwork too');
  assert.equal(drawn(picker, '.emojis > .emoji:not(.hidden):not(.lazy-load)'), 3,
    'both visible cells, plus the variation inside one of them');
  assert.equal(drawn(picker, '.emoji.lazy-load'), 0, 'a cell scrolled out of view costs nothing');
  assert.equal(drawn(picker, '.emoji.hidden'), 0, 'another category costs nothing');
  // The characters survive, which is what a pick and a screen reader still read.
  assert.equal(picker.shadowRoot!.querySelector('.emojis > .emoji button')!.textContent, CARROT);
  run.stop();
});

test('a cell that scrolls into view is drawn on the next burst, once', async () => {
  const { dom } = mountDom();
  const { drawPackArtwork } = await import('./emoji-picker.ts');
  const picker = await mountPicker(dom);
  const pass = fakePass(dom);
  const run = drawPackArtwork(picker, pass);
  await run.ready;
  const afterFirst = pass.calls;

  assert.equal(drawnGlyphs(picker).includes(BURGER), false, 'not drawn while it is off screen');

  picker.shadowRoot!.querySelector('.emoji.lazy-load')!.classList.remove('lazy-load');
  await settle();

  assert.equal(drawnGlyphs(picker).filter((glyph) => glyph === BURGER).length, 1,
    'the cell that became visible is drawn');
  assert.equal(pass.calls, afterFirst + 1, 'one more pass, for the one cell that changed');

  await settle();
  assert.equal(pass.calls, afterFirst + 1, 'and the grid settles rather than redrawing itself');
  run.stop();
});

test('a rebuilt grid is drawn again, in one burst', async () => {
  const { dom } = mountDom();
  const { drawPackArtwork } = await import('./emoji-picker.ts');
  const picker = await mountPicker(dom);
  const pass = fakePass(dom);
  const run = drawPackArtwork(picker, pass);
  await run.ready;
  const afterFirst = pass.calls;

  // What a version change does: the whole grid is replaced with fresh cells.
  const grid = picker.shadowRoot!.querySelector('.emojis')!;
  grid.innerHTML = `<div class="emoji"><button type="button">${CARROT}</button></div>`
    + `<div class="emoji"><button type="button">${CAR}</button></div>`;
  await settle();

  assert.equal(drawn(picker, '.emojis > .emoji'), 2, 'the new cells are drawn');
  assert.equal(pass.calls, afterFirst + 2, 'two new cells, two passes, one burst');
  run.stop();
});

test('stopping ends the watch, so a later change draws nothing', async () => {
  const { dom } = mountDom();
  const { drawPackArtwork } = await import('./emoji-picker.ts');
  const picker = await mountPicker(dom);
  const pass = fakePass(dom);
  const run = drawPackArtwork(picker, pass);
  await run.ready;
  const afterFirst = pass.calls;

  run.stop();
  run.stop(); // twice is safe
  picker.shadowRoot!.querySelector('.emoji.lazy-load')!.classList.remove('lazy-load');
  await settle();

  assert.equal(pass.calls, afterFirst, 'no pass runs after the watch is stopped');
  assert.equal(drawnGlyphs(picker).includes(BURGER), false);
});

test('a pass that draws no artwork leaves the grid exactly as it was', async () => {
  const { dom } = mountDom();
  const { drawPackArtwork } = await import('./emoji-picker.ts');
  const picker = await mountPicker(dom);
  // What the runtime reports with no set chosen, or none on the device at all.
  const pass = fakePass(dom, { replaced: () => 0 });

  const run = drawPackArtwork(picker, pass);
  await run.ready;

  assert.equal(pass.calls, 1, 'one probe, and nothing else');
  assert.equal(picker.shadowRoot!.querySelectorAll('.lolly-emoji').length, 0,
    'the probe runs over a detached copy, so the live grid is untouched');
  assert.equal(picker.shadowRoot!.querySelector('.emojis > .emoji button')!.textContent, CARROT);

  // And the watch is stopped, rather than probing again on every scroll.
  picker.shadowRoot!.querySelector('.emoji.lazy-load')!.classList.remove('lazy-load');
  await settle();
  assert.equal(pass.calls, 1);
  run.stop();
});

test('a tab the set does not carry is drawn on its own, not written off with the strip', async () => {
  // The strip used to count as finished as soon as it held ONE placement, so a set
  // covering some tab glyphs and not others left the rest showing the machine's
  // font for the life of the popover. Each tab is its own target now.
  const { dom } = mountDom();
  const { drawPackArtwork } = await import('./emoji-picker.ts');
  const picker = await mountPicker(dom);
  const strip = picker.shadowRoot!.querySelector('.tabs')!;
  strip.innerHTML = `<div class="tab"><button type="button">${GRIN}</button></div>`
    + `<div class="tab"><button type="button">${CAR}</button></div>`;
  // One tab arrives already drawn, exactly as a half-finished strip looks.
  strip.firstElementChild!.innerHTML = '<span class="lolly-emoji" data-emoji="x"></span>';

  const pass = fakePass(dom);
  const run = drawPackArtwork(picker, pass);
  await run.ready;

  assert.equal(drawnGlyphs(picker).includes(CAR), true, 'the tab that was still text is drawn');
  assert.equal(drawn(picker, '.tabs'), 2, 'both tabs carry artwork now');
  run.stop();
});

test('a set chosen while the grid is open redraws the cells that were already drawn', async () => {
  const { dom } = mountDom();
  const { drawPackArtwork } = await import('./emoji-picker.ts');
  const picker = await mountPicker(dom);
  const pass = fakePass(dom);
  // What the runtime's own revert does: the kept characters come back, so the next
  // apply draws them from the new set instead of skipping a finished cell.
  const revert = async (node: unknown): Promise<unknown> => {
    for (const span of (node as Element).querySelectorAll('.lolly-emoji')) {
      span.replaceWith(dom.window.document.createTextNode(span.getAttribute('data-emoji') ?? ''));
    }
    return undefined;
  };
  let announce: (() => void) | null = null;
  const run = drawPackArtwork(picker, {
    apply: pass.apply,
    revert,
    onSetChange: (fn) => { announce = fn; return () => { announce = null; }; },
  });
  await run.ready;
  const afterFirst = pass.calls;
  assert.equal(typeof announce, 'function', 'the pass is asked to say when the set changes');

  announce!();
  await settle();

  assert.ok(pass.calls > afterFirst, 'the drawn cells are walked again rather than skipped');
  assert.equal(drawnGlyphs(picker).includes(CARROT), true, 'and they are artwork again afterwards');
  run.stop();
  assert.equal(announce, null, 'stopping unsubscribes, so a later change reaches nothing');
});

test('a set chosen after the probe gave up starts the grid again', async () => {
  // The first-run order in the character browser: the panel is opened with no set
  // chosen, so the probe reports nothing and the watch goes down, and only THEN is
  // a set picked in the Emoji section. A teardown would have made that unreachable.
  const { dom } = mountDom();
  const { drawPackArtwork } = await import('./emoji-picker.ts');
  const picker = await mountPicker(dom);
  let drawing = false;
  const pass = fakePass(dom, { replaced: () => (drawing ? undefined : 0) });
  let announce: (() => void) | null = null;
  const run = drawPackArtwork(picker, {
    apply: pass.apply,
    revert: async () => undefined,
    onSetChange: (fn) => { announce = fn; return () => { announce = null; }; },
  });
  await run.ready;
  assert.equal(picker.shadowRoot!.querySelectorAll('.lolly-emoji').length, 0, 'nothing drew');

  drawing = true;
  announce!();
  await settle();

  assert.ok(picker.shadowRoot!.querySelector('.lolly-emoji'), 'the chosen set draws now');
  run.stop();
});

test('a pass with no revert cannot redraw, and reports that by doing nothing', async () => {
  const { dom } = mountDom();
  const { drawPackArtwork } = await import('./emoji-picker.ts');
  const picker = await mountPicker(dom);
  const pass = fakePass(dom);
  const run = drawPackArtwork(picker, pass);
  await run.ready;
  const afterFirst = pass.calls;

  run.redraw();
  await settle();
  assert.equal(pass.calls, afterFirst, 'nothing is reverted, so nothing is redrawn');
  run.stop();
});

test('an element with no shadow root is left alone, with no observer to stop', async () => {
  const { dom } = mountDom();
  const { drawPackArtwork } = await import('./emoji-picker.ts');
  const pass = fakePass(dom);
  const plain = dom.window.document.createElement('div') as unknown as HTMLElement;
  const run = drawPackArtwork(plain, pass);
  await run.ready;
  assert.equal(pass.calls, 0);
  run.stop();
});

// -- local ids ---------------------------------------------------------------

test('each cell keeps local ids of its own, so one gradient cannot paint another cell', async () => {
  const { dom } = mountDom();
  const { drawPackArtwork } = await import('./emoji-picker.ts');
  const picker = await mountPicker(dom);
  const pass = fakePass(dom);
  const run = drawPackArtwork(picker, pass);
  await run.ready;

  const ids = [...picker.shadowRoot!.querySelectorAll('[id]')].map((element) => element.id);
  assert.equal(ids.length, 4, 'the tab glyph, both cells and the variation each carry one');
  assert.equal(new Set(ids).size, ids.length, `ids must be unique inside one shadow root: ${ids.join(', ')}`);
  for (const path of picker.shadowRoot!.querySelectorAll('path')) {
    const reference = (path.getAttribute('fill') ?? '').slice(5, -1);
    assert.ok(ids.includes(reference), `a reference must name an id in this shadow root: ${reference}`);
    assert.equal(path.closest('.lolly-emoji')!.querySelector(`[id="${reference}"]`) !== null, true,
      'and it must be the one in its own placement');
  }
  run.stop();
});

test('scoping ids twice changes nothing', async () => {
  const { dom } = mountDom();
  const { scopeArtworkIds } = await import('./emoji-picker.ts');
  const cell = dom.window.document.createElement('div');
  cell.innerHTML = '<svg><linearGradient id="e0p0-g"></linearGradient>'
    + '<clipPath id="e0p0-c"></clipPath><path fill="url(#e0p0-g)" clip-path="url(#e0p0-c)"></path>'
    + '<use href="#e0p0-c"></use></svg>';

  scopeArtworkIds(cell, 'c7');
  const once = cell.innerHTML;
  assert.match(once, /id="c7-e0p0-g"/);
  assert.match(once, /fill="url\(#c7-e0p0-g\)"/);
  assert.match(once, /clip-path="url\(#c7-e0p0-c\)"/);
  assert.match(once, /href="#c7-e0p0-c"/);

  scopeArtworkIds(cell, 'c7');
  assert.equal(cell.innerHTML, once, 'a redraw must not stack tag on tag');
});

// -- the two entry points ----------------------------------------------------

test('the popover draws its grid, and closing it stops the watch', async () => {
  const { dom, anchor } = mountDom();
  const { openEmojiPopover } = await import('./emoji-picker.ts');
  const pass = fakePass(dom);

  const pop = await openEmojiPopover(anchor, () => {}, {
    defineElement: definePicker(dom),
    emoji: { apply: pass.apply },
  });
  await settle();
  const picker = pop.querySelector('unicode-emoji-picker') as unknown as HTMLElement;
  assert.ok(picker.shadowRoot!.querySelector('.lolly-emoji'), 'the open popover shows artwork');
  const afterOpen = pass.calls;

  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  picker.shadowRoot!.querySelector('.emoji.lazy-load')!.classList.remove('lazy-load');
  await settle();
  assert.equal(pass.calls, afterOpen, 'a closed popover draws nothing more');
});

test('a caller that hands in no pass gets the grid the component drew', async () => {
  const { dom, anchor } = mountDom();
  const { openEmojiPopover } = await import('./emoji-picker.ts');
  const pop = await openEmojiPopover(anchor, () => {}, { defineElement: definePicker(dom) });
  await settle();
  const picker = pop.querySelector('unicode-emoji-picker') as unknown as HTMLElement;
  assert.equal(picker.shadowRoot!.querySelectorAll('.lolly-emoji').length, 0);
  assert.equal(picker.shadowRoot!.querySelector('.emojis > .emoji button')!.textContent, CARROT);
});

test('the browsing surface draws too, and its cleanup stops the watch', async () => {
  const { dom } = mountDom();
  const { mountEmojiBrowser } = await import('./emoji-picker.ts');
  const pass = fakePass(dom);
  const container = dom.window.document.createElement('div');
  dom.window.document.body.append(container);

  const cleanup = await mountEmojiBrowser(container, () => {}, {
    defineElement: definePicker(dom),
    emoji: { apply: pass.apply },
  });
  await settle();
  const picker = container.querySelector('unicode-emoji-picker') as unknown as HTMLElement;
  assert.ok(picker.shadowRoot!.querySelector('.lolly-emoji'), 'the character browser shows artwork');
  const afterMount = pass.calls;

  cleanup();
  await settle();
  assert.equal(pass.calls, afterMount);
});

// -- the callers hand the pass in --------------------------------------------
// tool-inputs.ts and text/characters.ts cannot be imported outside Vite (their
// sibling specifiers are `.js`), which is why block-live-rows.test.ts reads them
// as source too. What matters is the wiring, and the wiring is one line each.

const source = (path: string): string =>
  readFileSync(resolve(import.meta.dirname, '..', path), 'utf8');

test('sidebar cells and the text workspace use the shared runtime picker adapter', () => {
  const inputs = source('views/tool-inputs.ts');
  assert.match(inputs, /wireEmojiCells\(root, host, runtime,/);
  assert.match(inputs, /btn\.textContent = emoji;[\s\S]{0,200}?drawEmojiCells\(\);/);
  assert.match(inputs, /runtime\.applyEmojiToDom\?\.\(wrap, \{ track: false, idScope \}\)/);
  assert.match(source('components/input-emoji.ts'), /emojiPickerOptions\(host, runtime\)/);
  assert.match(source('views/text.ts'), /emojiPickerOptions\(host, runtime\)/);
  assert.match(source('views/text/characters.ts'), /mountEmojiBrowser\([\s\S]{0,200}?options/);
  const adapter = source('lib/emoji-picker-options.ts');
  assert.match(adapter, /applyEmojiToDom\(node, \{ track: false, idScope: 'p' \}\)/);
  assert.match(adapter, /revertEmojiDom\(node\)/);
  assert.match(adapter, /setEmojiStyle\(style\)/);
});

// -- the chunk stays lazy ----------------------------------------------------

test('the picker module imports no engine emoji module at the top level', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'emoji-picker.ts'), 'utf8');
  const imports = source.match(/^import .*$/gm) ?? [];
  assert.equal(imports.some((line) => /emoji-(dom|pack|style|inline|svg|treatment)/.test(line)), false,
    'the pass arrives from the caller, so this chunk never pulls the engine tables onto the page');
});

test('panel scrolling while the picker downloads retains the requested popover', async () => {
  const { dom, anchor } = mountDom();
  const { openEmojiPopover, closeEmojiPopover } = await import('./emoji-picker.ts');
  let release!: () => void;
  const loading = new Promise<void>(resolve => { release = resolve; });
  const opened = openEmojiPopover(anchor, () => {}, { defineElement: async () => { await loading; await definePicker(dom)(); } });
  try {
    anchor.focus();
    dom.window.dispatchEvent(new dom.window.Event('scroll'));
    assert.ok(dom.window.document.querySelector('.emoji-pop')?.isConnected);
    release();
    const pop = await opened;
    assert.ok(pop.querySelector('unicode-emoji-picker'));
    dom.window.dispatchEvent(new dom.window.Event('resize'));
    assert.ok(pop.isConnected);
  } finally { release(); closeEmojiPopover(); dom.window.close(); }
});
