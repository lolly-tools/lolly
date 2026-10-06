// SPDX-License-Identifier: MPL-2.0
import { LIVE_PROTOCOL } from '@lolly-tools/core';
import { createLiveSession, type LiveEditor, type LiveSession } from './live-agent.ts';
import type { AgentRoster } from './agent-collaborators.ts';
import type { SiteEditorSource } from './site-tools-context.ts';

/** Site tools are another transport for the same editor session and its human controls. */
export function createSiteEditor(factory: () => Promise<LiveEditor>, roster: Pick<AgentRoster, 'join'>, current: () => boolean): SiteEditorSource {
  let session: LiveSession | null = null;
  let joined: ReturnType<AgentRoster['join']> | null = null;
  let starting: Promise<void> | null = null;
  let closed = false, requestId = 0;
  const check = () => { if (closed || !current()) throw new Error('This browser agent was disconnected. Open the document again to reconnect.'); };
  const close = () => { closed = true; session?.close(); joined?.remove(); joined = null; };
  const request = async (method: string, params: Record<string, unknown>): Promise<unknown> => {
    check();
    const reply = JSON.parse(await session!.handle(JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }))) as { result?: unknown; error?: { message: string } };
    check();
    if (reply.error) throw new Error(reply.error.message);
    return reply.result;
  };
  const start = async () => {
    const editor = await factory(); check();
    session = createLiveSession(editor, { onActivity(event) {
      joined?.update({ phase: session?.paused() ? 'paused' : 'idle', activity: event.note || event.method,
        ...(event.change ? { change: event.change } : {}) });
    } });
    try {
      joined = roster.join('Browser agent', { disconnect: close, pause: value => session?.pause(value) });
      await request('hello', { protocol: LIVE_PROTOCOL, client: 'Browser agent' });
    } catch (error) { close(); throw error; }
  };
  return {
    close,
    state: () => ({ closed, connected: !!session?.connected(), paused: !!session?.paused() }),
    async request(method, params) {
      check();
      starting ??= start(); await starting; check();
      return request(method, params);
    },
  };
}
