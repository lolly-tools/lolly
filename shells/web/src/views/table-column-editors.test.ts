// SPDX-License-Identifier: MPL-2.0
/**
 * The `columnEditors` contract, end to end: manifest key, rendered cell, popover.
 *
 * A tool author writes `columnEditors: ["text", "url", "emoji"]` on a `table`
 * input and expects three things to hold, which is what this file pins:
 *
 *   1. BOTH schema copies accept the key and reject an editor name that is not in
 *      the enum. The copies are kept byte-identical by tests/lolly-tools-core.ts,
 *      so this exercises each one's real VALIDATOR instead of re-comparing them.
 *   2. The sidebar renders the right control per column, and an `emoji` column's
 *      cell is a BUTTON whose native `value` carries the cell - which is what
 *      lets the table wiring keep reading a row off `.table-cell` values without
 *      knowing anything about editors.
 *   3. The popover writes the picked emoji and gets out of the way: on a pick, on
 *      Escape, and on an outside press even when something upstream stops
 *      propagation (the reason the outside listener is on the CAPTURE phase).
 *
 * The picker web component itself is stubbed. It wants a browser, and what needs
 * testing here is our wiring around it, not their grid.
 *
 * Run directly:  node --test shells/web/src/views/table-column-editors.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { validateManifest } from '../../../../engine/src/validate.ts';
import { validateTool } from '../../../../packages/core/src/index.ts';
import { tableBodyCellHtml, tableColumnEditor, wantsGhostRow } from './table-cells.ts';

// ── 1. schema, through both real validators ──────────────────────────────────

/** A minimal table tool, with whatever columnEditors the caller wants to try. */
function manifest(columnEditors: unknown): Record<string, unknown> {
  return {
    id: 'link-list',
    name: 'Link list',
    version: '1.0.0',
    engineVersion: '^1.0.0',
    status: 'official',
    render: { width: 800, height: 600, formats: ['png'] },
    inputs: [{ id: 'rows', type: 'table', columnEditors }],
  };
}

test('both schema copies accept columnEditors on a table input', () => {
  const m = manifest(['text', 'url', 'emoji']);
  assert.equal(validateManifest(m).valid, true, JSON.stringify(validateManifest(m).errors));
  assert.equal(validateTool(m).valid, true, JSON.stringify(validateTool(m).errors));
});

test('both schema copies reject an editor name outside the enum', () => {
  const m = manifest(['text', 'emojii']); // typo
  assert.equal(validateManifest(m).valid, false, 'engine schema must reject an unknown editor');
  assert.equal(validateTool(m).valid, false, 'core schema must reject an unknown editor');
});

test('columnEditors is optional - an ordinary table manifest still validates', () => {
  const m = { ...manifest(undefined) };
  delete (m.inputs as Array<Record<string, unknown>>)[0]!.columnEditors;
  assert.equal(validateManifest(m).valid, true);
  assert.equal(validateTool(m).valid, true);
});

// ── 2. the rendered cell ─────────────────────────────────────────────────────

test('a column with no entry, or an unknown one, edits as plain text', () => {
  assert.equal(tableColumnEditor(undefined, 0), 'text');
  assert.equal(tableColumnEditor(['emoji'], 1), 'text');
  assert.equal(tableColumnEditor(['nonsense'], 0), 'text');
  assert.equal(tableColumnEditor(['text', 'url', 'emoji'], 2), 'emoji');
});

const COLUMNS = ['Label', 'Link', 'Icon'];

test('a text column is the plain textarea cell, with no keyboard hints', () => {
  const html = tableBodyCellHtml('hello', 0, 0, COLUMNS, 'text', 'rows:t:0:0');
  assert.match(html, /<textarea class="table-cell"/);
  assert.match(html, /data-field-id="rows:t:0:0"/);
  assert.ok(!html.includes('inputmode'), 'a text cell must not ask for a special keyboard');
  assert.ok(!html.includes('data-emoji-cell'));
});

test('a url column stays a text cell but asks for the URL keyboard', () => {
  const html = tableBodyCellHtml('https://suse.com', 0, 1, COLUMNS, 'url', 'rows:t:0:1');
  assert.match(html, /<textarea class="table-cell"/, 'still a text cell - a URL is typed, not picked');
  assert.match(html, /inputmode="url"/);
  assert.match(html, /autocapitalize="off"/);
  assert.match(html, /autocorrect="off"/);
  assert.match(html, /spellcheck="false"/);
});

test('an emoji column is a button whose native value carries the cell', () => {
  const html = tableBodyCellHtml('🎈', 2, 2, COLUMNS, 'emoji', 'rows:t:2:2');
  assert.match(html, /<button type="button" class="table-cell table-cell--emoji" data-emoji-cell/);
  assert.match(html, /value="🎈"/, 'read() collects a row off .table-cell values - the button must carry one');
  assert.match(html, /data-field-id="rows:t:2:2"/, 'focus restore finds the cell by field id');
  assert.match(html, /aria-label="Icon, row 3"/);
});

test('an empty emoji cell offers something to press', () => {
  const html = tableBodyCellHtml('', 0, 2, COLUMNS, 'emoji', 'rows:t:0:2');
  assert.match(html, /table-emoji-empty/);
  assert.match(html, /value=""/);
});

test('cell values are escaped in every editor', () => {
  const nasty = '"><img src=x onerror=alert(1)>';
  for (const editor of ['text', 'url', 'emoji'] as const) {
    const html = tableBodyCellHtml(nasty, 0, 0, COLUMNS, editor, 'rows:t:0:0');
    assert.ok(!html.includes('<img'), `${editor} cell leaked raw markup`);
  }
  // A column heading reaches the aria-label, so it is escaped too.
  const head = tableBodyCellHtml('x', 0, 0, ['"><script>'], 'text', 'rows:t:0:0');
  assert.ok(!head.includes('<script>'), 'column heading leaked into the label');
});

// ── 3. the popover ───────────────────────────────────────────────────────────

/** Install a jsdom global so the popover module can touch document/window. */
function mountDom(): { dom: JSDOM; anchor: HTMLElement } {
  const dom = new JSDOM('<!doctype html><body><button id="cell">x</button></body>', { pretendToBeVisual: true });
  const g = globalThis as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  g.HTMLElement = dom.window.HTMLElement;
  g.CustomEvent = dom.window.CustomEvent;
  g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  return { dom, anchor: dom.window.document.getElementById('cell') as HTMLElement };
}

/** The picker element is never really defined here - our wiring is the subject. */
const stubDefine = async (): Promise<void> => {};

test('a pick writes the emoji and takes the popover away', async () => {
  const { dom, anchor } = mountDom();
  const { openEmojiPopover } = await import('../components/emoji-picker.ts');
  const picked: string[] = [];
  const pop = await openEmojiPopover(anchor, (e) => picked.push(e), { defineElement: stubDefine });

  const picker = pop.querySelector('unicode-emoji-picker');
  assert.ok(picker, 'the popover mounts a picker');
  assert.equal(picker!.getAttribute('version'), '17.0', 'Unicode Emoji 17.0, not the component default');

  picker!.dispatchEvent(new dom.window.CustomEvent('emoji-pick', { detail: { emoji: '🥕' } }));
  assert.deepEqual(picked, ['🥕']);
  assert.equal(pop.isConnected, false, 'the popover closes on a pick');
});

test('Escape closes it and hands focus back to the cell', async () => {
  const { dom, anchor } = mountDom();
  const { openEmojiPopover } = await import('../components/emoji-picker.ts');
  const pop = await openEmojiPopover(anchor, () => {}, { defineElement: stubDefine });

  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(pop.isConnected, false);
  assert.equal(dom.window.document.activeElement, anchor);
});

test('an outside press closes it even when something upstream stops propagation', async () => {
  const { dom, anchor } = mountDom();
  const { openEmojiPopover } = await import('../components/emoji-picker.ts');
  const pop = await openEmojiPopover(anchor, () => {}, { defineElement: stubDefine });

  const elsewhere = dom.window.document.createElement('div');
  dom.window.document.body.append(elsewhere);
  // Exactly what a canvas control-point layer does for its own drag handling. A
  // bubble-phase outside-closer never runs after this; a capture-phase one does.
  elsewhere.addEventListener('pointerdown', (e) => e.stopPropagation());
  elsewhere.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
  assert.equal(pop.isConnected, false, 'the outside listener must be on the capture phase');
});

test('a press inside the popover leaves it open', async () => {
  const { dom, anchor } = mountDom();
  const { openEmojiPopover } = await import('../components/emoji-picker.ts');
  const pop = await openEmojiPopover(anchor, () => {}, { defineElement: stubDefine });

  pop.querySelector('unicode-emoji-picker')!.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
  assert.equal(pop.isConnected, true);
});

test('opening a second cell replaces the first popover rather than stacking', async () => {
  const { dom, anchor } = mountDom();
  const { openEmojiPopover } = await import('../components/emoji-picker.ts');
  const first = await openEmojiPopover(anchor, () => {}, { defineElement: stubDefine });
  const second = await openEmojiPopover(anchor, () => {}, { defineElement: stubDefine });
  assert.equal(first.isConnected, false);
  assert.equal(second.isConnected, true);
  assert.equal(dom.window.document.querySelectorAll('.emoji-pop').length, 1);
});

// ── placement, including the phone case ──────────────────────────────────────

test('the popover opens under the cell when there is room', async () => {
  const { placeEmojiPopover } = await import('../components/emoji-picker.ts');
  const at = placeEmojiPopover({ left: 40, top: 100, bottom: 130 }, { width: 427, height: 420 },
    { width: 1280, height: 900 });
  assert.deepEqual(at, { left: 40, top: 134 });
});

test('it flips above the cell rather than off the bottom', async () => {
  const { placeEmojiPopover } = await import('../components/emoji-picker.ts');
  const at = placeEmojiPopover({ left: 40, top: 600, bottom: 630 }, { width: 427, height: 420 },
    { width: 1280, height: 900 });
  assert.equal(at.top, 176, '600 - 4 - 420');
});

test('on a 393px phone it stays inside the screen with its 8px margins', async () => {
  const { placeEmojiPopover } = await import('../components/emoji-picker.ts');
  // The picker is 369px wide at the phone font size; the cell sits near the right
  // edge, which is the case that used to push a popover off-screen.
  const at = placeEmojiPopover({ left: 300, top: 200, bottom: 240 }, { width: 369, height: 400 },
    { width: 393, height: 852 });
  assert.ok(at.left >= 8, 'never past the left margin');
  assert.ok(at.left + 369 <= 393 - 8, `right edge ${at.left + 369} must clear 385`);
  assert.ok(at.top >= 8 && at.top + 400 <= 852 - 8, 'and inside vertically');
});

// ── The waiting placeholder row ───────────────────────────────────────────────
// A blank row is always ready for the next entry: it opens an empty table, and it
// reappears under the last row as soon as that row holds anything. It stands down
// only when the last row is itself blank - that row already is the placeholder.
// The row never reaches the value while untouched (the wiring's read() drops an
// all-empty ghost), which is what keeps an untyped placeholder out of the share
// link - the same contract as jump's cleared defaults.

test('an empty table gets the placeholder as its entry point', () => {
  assert.equal(wantsGhostRow([]), true);
});

test('a filled last row grows a fresh placeholder beneath it', () => {
  assert.equal(wantsGhostRow([['suse.com', 'SUSE', '']]), true);
  assert.equal(wantsGhostRow([['a', '', ''], ['', '', 'X']]), true, 'any cell counts');
});

test('a blank last row IS the placeholder - no second one', () => {
  assert.equal(wantsGhostRow([['suse.com', 'SUSE', ''], ['', '', '']]), false);
  assert.equal(wantsGhostRow([['a'], ['  ']]), false, 'whitespace is blank');
});

test('the placeholder cell renders at the next row index with the column editor', () => {
  // Row index = rows.length, so when typing makes it real the rebuilt cell keeps
  // the same data-field-id and the caret survives the repaint.
  const html = tableBodyCellHtml('', 1, 2, ['URL', 'Name', 'Emoji'], 'emoji', 'links:t:1:2');
  assert.ok(html.includes('data-field-id="links:t:1:2"'));
  assert.ok(html.includes('data-emoji-cell'), 'an emoji column keeps its picker button');
});
