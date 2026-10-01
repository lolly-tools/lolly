// SPDX-License-Identifier: MPL-2.0
/**
 * tool-history.ts under random edit, undo and redo sequences (plans/289
 * section 13, after Composa's SessionFuzzTests).
 *
 * The fixed-case suite (tool-history.test.ts) pins each rule on its own. This
 * one drives the model the way an editor does - Design's `boxes` moved, added
 * and deleted, a text field typed into, held drags, quick key repeats, undos and
 * redos in any order - from a seeded generator, and checks after every step
 * that the history and the document still agree:
 *
 *   - every undo hands back an entry whose `after` is what the input holds now,
 *     and every redo one whose `before` is what it holds now;
 *   - an edit that changes something always clears the redo stack;
 *   - undoing everything returns the document to where it started, and redoing
 *     everything returns it to where it was, with identical JSON;
 *   - the editor mutating its own state in place never reaches the history;
 *   - a structural edit (a row added or removed) never merges into another step.
 *
 * The same seeds always produce the same sequences. A failure message gives the
 * seed and the step, and running that seed again replays the failure exactly.
 *
 * Run directly:  node --test shells/web/src/views/tool-history.fuzz.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, COALESCE_MS } from './tool-history.ts';

type Box = { id: string; x: number; y: number; text: string };
type Doc = { boxes: Box[]; title: string; color: string };

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clone = <T>(v: T): T => structuredClone(v);
const json = (v: unknown) => JSON.stringify(v);

function run(seed: number, steps: number, limit = 100_000) {
  const rand = mulberry32(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const history = createHistory({ limit });
  const doc: Doc = { boxes: [{ id: 'b0', x: 0, y: 0, text: 'one' }], title: 'Untitled', color: '#000000' };
  const start = clone(doc);
  let now = 1_000;
  let nextBox = 1;
  let holding = false;
  // The last recorded edit, for the merging rule: same input, not structural,
  // nothing in between, and either a held pointer or inside the window.
  let last: { id: string; time: number; structural: boolean } | null = null;
  const where = (step: number, what: string) => `seed ${seed}, step ${step}: ${what}`;

  /** Make an edit the way the view does: read before, change the live state, record. */
  function edit(step: number, id: keyof Doc, change: () => void, label: string) {
    const before = clone(doc[id]);
    change();
    const after = doc[id];
    const outcome = history.record({ id, label, before: before as never, after: after as never }, now);
    if (outcome === 'ignored') return;
    assert.equal(history.sizes().redo, 0, where(step, 'a recorded edit clears redo'));
    const structural = id === 'boxes' && (before as Box[]).length !== (after as Box[]).length;
    if (structural) assert.equal(outcome, 'pushed', where(step, 'a structural edit is always its own step'));
    else if (last && last.id === id && !last.structural) {
      const merges = holding || now - last.time < COALESCE_MS;
      assert.equal(outcome, merges ? 'coalesced' : 'pushed', where(step, `a repeat edit to ${id} ${merges ? 'extends' : 'starts'} a step`));
    }
    last = { id, time: now, structural };
  }

  for (let step = 0; step < steps; step++) {
    now += rand() < 0.6 ? Math.floor(rand() * (COALESCE_MS - 1)) : COALESCE_MS + Math.floor(rand() * 2_000);
    const r = rand();
    if (r < 0.12) {
      const e = history.undo();
      if (e) {
        assert.equal(json(doc[e.id as keyof Doc]), json(e.after), where(step, `undo of ${e.id} starts from what it holds now`));
        (doc as Record<string, unknown>)[e.id] = clone(e.before);
        history.endGesture();
        last = null;
      } else {
        assert.equal(json(doc), json(start), where(step, 'nothing left to undo means the document is back at the start'));
      }
    } else if (r < 0.2) {
      const e = history.redo();
      if (e) {
        assert.equal(json(doc[e.id as keyof Doc]), json(e.before), where(step, `redo of ${e.id} starts from what it holds now`));
        (doc as Record<string, unknown>)[e.id] = clone(e.after);
        history.endGesture();
        last = null;
      }
    } else if (r < 0.26) {
      if (holding) { history.endHold(); holding = false; } else { history.beginHold(); holding = true; }
      last = null;
    } else if (r < 0.4 && doc.boxes.length) {
      const b = pick(doc.boxes);
      edit(step, 'boxes', () => { b.x += Math.round(rand() * 40 - 20) || 1; }, 'Move');
    } else if (r < 0.5) {
      edit(step, 'boxes', () => { doc.boxes.push({ id: `b${nextBox++}`, x: Math.round(rand() * 500), y: 0, text: 'new' }); }, 'Add');
    } else if (r < 0.58 && doc.boxes.length > 1) {
      const i = Math.floor(rand() * doc.boxes.length);
      edit(step, 'boxes', () => { doc.boxes.splice(i, 1); }, 'Delete');
    } else if (r < 0.7 && doc.boxes.length) {
      const b = pick(doc.boxes);
      edit(step, 'boxes', () => { b.text += pick(['a', 'b', ' ', '!']); }, 'Text');
    } else if (r < 0.85) {
      edit(step, 'title', () => { doc.title += pick(['x', 'y', 'z']); }, 'Title');
    } else if (r < 0.95) {
      edit(step, 'color', () => { doc.color = pick(['#000000', '#ff0000', '#30ba78', '#ffffff']); }, 'Colour');
    } else {
      history.endGesture();
      last = null;
    }
    if (limit < 100_000) assert.ok(history.sizes().undo <= limit, where(step, 'the undo stack stays within its limit'));
  }
  if (holding) history.endHold();
  return { history, doc, start };
}

for (const seed of [1, 7, 42, 2026, 99_991]) {
  test(`seed ${seed}: undo everything returns to the start, redo everything returns to the end`, () => {
    const { history, doc, start } = run(seed, 2_500);
    const end = clone(doc);
    for (let e = history.undo(); e; e = history.undo()) {
      assert.equal(json(doc[e.id as keyof Doc]), json(e.after));
      (doc as Record<string, unknown>)[e.id] = clone(e.before);
    }
    assert.equal(json(doc), json(start), 'undo all reaches the first state');
    for (let e = history.redo(); e; e = history.redo()) {
      assert.equal(json(doc[e.id as keyof Doc]), json(e.before));
      (doc as Record<string, unknown>)[e.id] = clone(e.after);
    }
    assert.equal(json(doc), json(end), 'redo all reaches the last state');
  });
}

test('a small limit keeps the newest steps, and each still undoes cleanly from where it is', () => {
  for (const seed of [3, 11]) {
    const { history, doc } = run(seed, 1_500, 25);
    assert.ok(history.sizes().undo <= 25);
    for (let e = history.undo(); e; e = history.undo()) {
      assert.equal(json(doc[e.id as keyof Doc]), json(e.after), `seed ${seed}: kept steps stay consistent`);
      (doc as Record<string, unknown>)[e.id] = clone(e.before);
    }
  }
});

test('the history never shares objects with the live document', () => {
  const history = createHistory();
  const boxes: Box[] = [{ id: 'a', x: 0, y: 0, text: 't' }];
  const before = clone(boxes);
  boxes[0]!.x = 10;
  history.record({ id: 'boxes', label: 'Move', before: before as never, after: boxes as never }, 0);
  boxes[0]!.x = 999; // the editor keeps going without recording
  boxes.push({ id: 'b', x: 1, y: 1, text: 'u' });
  const e = history.undo()!;
  assert.equal((e.after as unknown as Box[])[0]!.x, 10);
  assert.equal((e.after as unknown as Box[]).length, 1);
});
