// SPDX-License-Identifier: MPL-2.0
/**
 * lib/live-agent-desktop.ts: the page's long poll against a stand-in for the app's
 * three commands (the listener itself is tested in Rust, live_server.rs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serveDesktop } from './live-agent-desktop.ts';
import type { LiveEditor } from './live-agent.ts';

const editor = (): LiveEditor => ({
  tool: 'design', engine: 'test', surface: 'desktop', rows: () => [{ id: 'a' }], size: () => ({ width: 1, height: 1 }), selection: () => [],
  fieldDefault: (_i, f) => f, commit: async () => null, topEntry: () => null, undo() {}, look: async () => ({ svg: '<svg/>', width: 1, height: 1 }),
});

/** The app's side: a queue of requests for live_next and the replies live_reply got. */
function fakeApp() {
  const queue: Array<{ seq: number; text: string }> = [];
  const replies = new Map<number, string>();
  let wake: (() => void) | null = null;
  const invoke = async (cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
    if (cmd === 'live_next') {
      if (!queue.length) await new Promise<void>((r) => { wake = r; setTimeout(r, 50); });
      return queue.shift() ?? null;
    }
    if (cmd === 'live_reply') { replies.set(args!.seq as number, args!.text as string); return null; }
    if (cmd === 'live_set') return 4242;
    throw new Error(`unexpected ${cmd}`);
  };
  let seq = 0;
  const send = async (method: string, params?: unknown): Promise<any> => {
    const id = ++seq;
    queue.push({ seq: id, text: JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }) });
    (wake as (() => void) | null)?.();
    for (let i = 0; i < 100 && !replies.has(id); i++) await new Promise((r) => setTimeout(r, 5));
    return JSON.parse(replies.get(id)!);
  };
  return { invoke, send };
}

test('requests from the app are answered through the session, and Disconnect holds until renew', async () => {
  const app = fakeApp();
  const seen: string[] = [];
  const serving = serveDesktop(app.invoke, editor, { onActivity: (e) => seen.push(e.method) });
  assert.equal((await app.send('hello', { protocol: 'live-v1', client: 'Desk agent' })).result.surface, 'desktop');
  assert.equal((await app.send('document.get')).result.rows.length, 1);
  assert.equal(serving.session().client(), 'Desk agent');
  assert.equal(serving.session().connected(), true);
  serving.disconnect();
  assert.match((await app.send('hello', { protocol: 'live-v1' })).error.message, /disconnected this agent/);
  serving.renew();
  assert.ok((await app.send('hello', { protocol: 'live-v1' })).result);
  serving.stop();
  assert.deepEqual(seen.slice(0, 1), ['hello']);
});

test('a request that arrives as the view closes is answered, not left to time out', async () => {
  const app = fakeApp();
  const serving = serveDesktop(app.invoke, editor);
  await app.send('hello', { protocol: 'live-v1' });
  serving.stop();
  const late = await app.send('document.get');
  assert.match(late.error.message, /Design document was closed/);
});
