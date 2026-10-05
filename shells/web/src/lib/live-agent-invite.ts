// SPDX-License-Identifier: MPL-2.0
import { LIVE_LIMITS } from '@lolly-tools/core';
import { liveInvitationUrl } from '@lolly-tools/core/live-invite-v1';
import { createLiveSession, type LiveEditor, type LiveSessionOpts } from './live-agent.ts';

interface InviteOptions extends LiveSessionOpts { onEnd?(): void }
export interface HostedAgentInvitation { url: string; expiresAt: number; session: ReturnType<typeof createLiveSession>; disconnect(): void }

/** Invite one remote collaborator into this mounted document, then answer its edits. */
export async function inviteAgent(editor: LiveEditor, base: string, permission: 'edit' | 'read', opts: InviteOptions = {}): Promise<HostedAgentInvitation> {
  if (!editor.documentId) throw new Error('This editor has no document identity.');
  if (permission === 'edit' && editor.readOnly?.()) throw new Error('This document allows reading only.');
  const response = await fetch(`${base}/invitations`, {
    method: 'POST', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(10_000), headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ documentId: editor.documentId, permission }),
  });
  if (!response.ok) throw new Error(response.status === 429 ? 'Too many invitations. Try again in a minute.' : 'Agent invitations are not available on this instance.');
  const value = await response.json() as { token: string; editorToken: string; expiresAt: number };
  const url = liveInvitationUrl(base, value.token);
  if (!/^[a-zA-Z0-9_-]{43}$/.test(value.editorToken) || !Number.isFinite(value.expiresAt)) throw new Error('The instance returned an invalid invitation.');
  const address = new URL(`${base}/editor`); address.protocol = address.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(address.href);
  let ended = false, connected = false;
  let expiry: ReturnType<typeof setTimeout>;
  let timeout: ReturnType<typeof setTimeout>;
  let rejectAttach: (error: Error) => void = () => {};
  const session = createLiveSession({ ...editor, owner: editor.owner ?? editor, readOnly: () => permission === 'read' || !!editor.readOnly?.() }, {
    ...opts,
    onActivity(event) {
      if (event.method === 'hello' && !connected) { connected = true; clearTimeout(expiry); expiry = setTimeout(disconnect, LIVE_LIMITS.idleMs); }
      opts.onActivity?.(event);
    },
  });
  function disconnect(): void {
    if (ended) return;
    ended = true; clearTimeout(timeout); clearTimeout(expiry); session.close(); socket.close(1000, 'Invitation ended');
    rejectAttach(new Error('The agent invitation ended.')); opts.onEnd?.();
  }
  const attached = new Promise<void>((resolve, reject) => {
    rejectAttach = reject;
    timeout = setTimeout(() => { reject(new Error('The instance did not connect the invitation.')); disconnect(); }, 10_000);
    socket.addEventListener('open', () => socket.send(JSON.stringify({ editorToken: value.editorToken })));
    socket.addEventListener('message', event => {
      if (typeof event.data !== 'string' || event.data.length > LIVE_LIMITS.maxRequestBytes) { disconnect(); return; }
      let frame: { type?: string; documentId?: string };
      try { frame = JSON.parse(event.data); } catch { disconnect(); return; }
      if (frame.type === 'attached') {
        if (frame.documentId !== editor.documentId) { disconnect(); return; }
        clearTimeout(timeout); resolve(); return;
      }
      void session.handle(event.data).then(reply => { if (!ended && socket.readyState === WebSocket.OPEN) socket.send(reply); });
    });
    socket.addEventListener('close', disconnect);
    socket.addEventListener('error', disconnect);
  });
  expiry = setTimeout(disconnect, Math.max(0, value.expiresAt - Date.now()));
  await attached;
  return { url, expiresAt: value.expiresAt, session, disconnect };
}
