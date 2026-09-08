// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollabHistoryCapture } from './collab-history-capture.ts';
import { createP2PCollabHistory } from '../collab/rtc-history.ts';

/** A hand-driven clock + single-slot timer, so cadence is asserted, never waited on. */
function harness() {
  let t = 0;
  let armed: { fn: () => void; at: number } | undefined;
  let title = 'draft';
  const history = createP2PCollabHistory({ role: 'writer', host: true });
  const capture = createCollabHistoryCapture({
    history, documentId: 'doc', toolId: 'design', actorId: 'peer-1',
    snapshot: () => ({ title }),
    now: () => t,
    setTimer: (fn, ms) => { armed = { fn, at: t + ms }; return armed; },
    clearTimer: () => { armed = undefined; },
  });
  return {
    history, capture,
    edit(next: string) { title = next; capture.changed(); },
    advance(ms: number) {
      t += ms;
      if (armed && t >= armed.at) { const fn = armed.fn; armed = undefined; fn(); }
    },
    armedIn: () => (armed ? armed.at - t : null),
  };
}

test('an edit checkpoints after a two-second idle, capturing the converged snapshot', async () => {
  const h = harness();
  h.edit('one');
  assert.equal(h.armedIn(), 2000, 'a fresh edit arms the short idle');
  h.advance(2000);
  const page = await h.history.list();
  assert.equal(page.entries.length, 1);
  assert.deepEqual(await h.history.read(page.entries[0]!.id), { title: 'one' });
});

test('a burst of edits collapses into one capture, not one per keystroke', async () => {
  const h = harness();
  h.edit('a'); h.advance(500);
  h.edit('ab'); h.advance(500);
  h.edit('abc');
  h.advance(2000);
  const page = await h.history.list();
  assert.equal(page.entries.length, 1);
  assert.deepEqual(await h.history.read(page.entries[0]!.id), { title: 'abc' });
});

test('continuous work still checkpoints by the minute; a later edit waits the interval', async () => {
  const h = harness();
  // Edit every 1.5s: the idle timer never fires on its own, but the minute cap does.
  for (let i = 0; i < 60; i++) { h.edit(`e${i}`); h.advance(1500); }
  const first = (await h.history.list()).entries.length;
  assert.ok(first >= 1, 'continuous work is checkpointed by the minute cap');
  // Right after a capture, the next edit waits the full minute, not two seconds.
  h.edit('after');
  assert.ok((h.armedIn() ?? 0) > 2000, 'the min-interval floor holds after a capture');
});

test('flush captures pending work immediately; a clean flush is a no-op', async () => {
  const h = harness();
  h.capture.flush();
  assert.equal((await h.history.list()).entries.length, 0, 'nothing pending, nothing captured');
  h.edit('pending');
  h.capture.flush();
  assert.equal((await h.history.list()).entries.length, 1, 'the editor-exit boundary flushes');
});

test('dispose stops capture, and an armed timer never fires afterwards', async () => {
  const h = harness();
  h.edit('one');
  h.capture.dispose();
  h.advance(5000);
  assert.equal((await h.history.list()).entries.length, 0);
  h.edit('two'); // changed() after dispose is inert
  h.advance(5000);
  assert.equal((await h.history.list()).entries.length, 0);
});
