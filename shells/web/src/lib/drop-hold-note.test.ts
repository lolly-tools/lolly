// SPDX-License-Identifier: MPL-2.0
// The note for a file dropped while Lolly is still loading: what it says for each
// outcome, and when it shows and goes (lib/drop-hold-note.ts).
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://instance.test/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'localStorage']) Reflect.set(globalThis, key, Reflect.get(dom.window, key));

const { HELD_NOTE_DELAY_MS, OUTCOME_NOTE_MS, dropNoteText, showDropHoldNote } = await import('./drop-hold-note.ts');
const note = (): string | null => document.querySelector('.drop-hold-note')?.textContent ?? null;

test('each outcome reads in plain words, naming the file or counting several', () => {
  assert.equal(dropNoteText({ kind: 'held', files: ['notes.txt'] }), 'Still loading. Lolly will open notes.txt when this page is ready.');
  assert.equal(dropNoteText({ kind: 'held', files: ['a.png', 'b.png'] }), 'Still loading. Lolly will open 2 files when this page is ready.');
  assert.equal(dropNoteText({ kind: 'busy', held: ['notes.txt'], files: ['logo.svg'] }), 'Lolly will open notes.txt first. Drop logo.svg again after that.');
  assert.equal(dropNoteText({ kind: 'left', files: ['notes.txt'] }), 'Lolly did not open notes.txt, because you left the page before it had loaded. Drop the file again to open it here.');
  assert.equal(dropNoteText({ kind: 'failed', files: ['notes.txt'] }), 'Lolly did not open notes.txt, because the page did not finish loading.');
  assert.equal(dropNoteText({ kind: 'unclaimed', files: ['notes.txt'] }), 'Nothing on this page can open notes.txt.');
  assert.equal(dropNoteText({ kind: 'done' }), '');
});

test('a waiting drop shows after a short wait, a refusal shows at once and gives way back, and the note goes when the drop opens', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    showDropHoldNote({ kind: 'held', files: ['notes.txt'] });
    assert.equal(note(), null, 'nothing flashes for a drop the page takes within a moment');
    mock.timers.tick(HELD_NOTE_DELAY_MS);
    assert.match(note()!, /^Still loading\./);
    assert.equal(document.querySelector('.drop-hold-note')!.getAttribute('role'), 'status', 'read out by a screen reader');
    showDropHoldNote({ kind: 'busy', held: ['notes.txt'], files: ['logo.svg'] });
    assert.match(note()!, /^Lolly will open notes\.txt first\./);
    mock.timers.tick(OUTCOME_NOTE_MS);
    assert.match(note()!, /^Still loading\./, 'back to the drop that is still waiting');
    showDropHoldNote({ kind: 'done' });
    assert.equal(note(), null);
  } finally { mock.timers.reset(); }
});

test('a drop that was not opened is said once, then the note goes', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    showDropHoldNote({ kind: 'held', files: ['notes.txt'] });
    showDropHoldNote({ kind: 'left', files: ['notes.txt'] });
    assert.match(note()!, /^Lolly did not open notes\.txt/);
    mock.timers.tick(OUTCOME_NOTE_MS);
    assert.equal(note(), null);
  } finally { mock.timers.reset(); }
});
