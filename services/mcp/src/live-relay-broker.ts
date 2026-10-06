// SPDX-License-Identifier: MPL-2.0
import { randomBytes } from 'node:crypto';
import type { WebSocket } from 'ws';
import { LIVE_ERRORS, LIVE_LIMITS, LIVE_PROTOCOL, liveError, type LiveReplyV1, type LiveRequestV1 } from '@lolly-tools/core';
import type { LiveStatus } from './live-bridge.ts';

const secret = (): string => randomBytes(32).toString('base64url');
interface Pending { resolve(reply: LiveReplyV1): void; timer: NodeJS.Timeout }
export interface InvitationGrant {
  documentId: string;
  origin: string;
  permission: 'edit' | 'read';
  token: string;
  editorToken: string;
  expiresAt: number;
  client: string;
  editor?: LiveStatus['editor'];
  socket?: WebSocket;
  pending: Map<number, Pending>;
  tail: Promise<void>;
  waiting: number;
  seq: number;
}

/** Each capability addresses one editor socket; there is no shared active tab. */
export class LiveRelayBroker {
  private readonly grants = new Map<string, InvitationGrant>();
  private readonly editors = new Map<string, InvitationGrant>();
  private readonly expiry: NodeJS.Timeout;
  private readonly now: () => number;
  constructor(now: () => number = Date.now) {
    this.now = now;
    this.expiry = setInterval(() => this.sweep(), 30_000);
    this.expiry.unref();
  }
  mint(documentId: string, origin: string, permission: 'edit' | 'read'): InvitationGrant {
    this.sweep();
    if (this.grants.size >= 1000) throw new Error('The relay is full. Try again later.');
    const grant: InvitationGrant = { documentId, origin, permission, token: secret(), editorToken: secret(), expiresAt: this.now() + 10 * 60_000, client: '', pending: new Map(), tail: Promise.resolve(), waiting: 0, seq: 0 };
    this.grants.set(grant.token, grant); this.editors.set(grant.editorToken, grant);
    return grant;
  }
  get(token: string): InvitationGrant | undefined {
    const grant = this.grants.get(token);
    if (grant && grant.expiresAt > this.now()) return grant;
    if (grant) this.revoke(grant);
    return undefined;
  }
  attach(token: string, origin: string, socket: WebSocket): InvitationGrant | undefined {
    const grant = this.editors.get(token);
    if (!grant || grant.origin !== origin || grant.socket || !this.get(grant.token)) return undefined;
    this.editors.delete(token); grant.socket = socket;
    socket.on('message', bytes => {
      let reply: LiveReplyV1;
      try { reply = JSON.parse(bytes.toString()); } catch { this.revoke(grant); return; }
      if (reply.jsonrpc !== '2.0' || typeof reply.id !== 'number') return;
      const pending = grant.pending.get(reply.id);
      if (!pending) return;
      grant.pending.delete(reply.id); clearTimeout(pending.timer); pending.resolve(reply);
    });
    socket.on('close', () => this.revoke(grant));
    socket.on('error', () => this.revoke(grant));
    return grant;
  }
  status(grant: InvitationGrant): LiveStatus {
    return { state: grant.client && grant.socket ? 'connected' : 'pairing', surface: 'web', ...(grant.editor ? { editor: grant.editor } : {}) };
  }
  request(grant: InvitationGrant, request: LiveRequestV1): Promise<LiveReplyV1> {
    if (grant.waiting >= 64) return Promise.resolve(liveError(request.id, LIVE_ERRORS.limit, 'The document already has 64 requests waiting.'));
    grant.waiting++;
    const pending = grant.tail.then(() => this.dispatch(grant, request));
    grant.tail = pending.then(() => {}, () => {}).finally(() => { grant.waiting--; });
    return pending;
  }
  revoke(grant: InvitationGrant): void {
    this.grants.delete(grant.token); this.editors.delete(grant.editorToken);
    for (const [id, pending] of grant.pending) { clearTimeout(pending.timer); pending.resolve(liveError(id, LIVE_ERRORS.notReady, 'The invitation ended.')); }
    grant.pending.clear();
    const socket = grant.socket; grant.socket = undefined;
    if (socket && socket.readyState < 2) socket.close(1000, 'Invitation ended');
  }
  dispose(): void { clearInterval(this.expiry); for (const grant of this.grants.values()) this.revoke(grant); }
  private sweep(): void { for (const grant of this.grants.values()) if (grant.expiresAt <= this.now()) this.revoke(grant); }
  private async dispatch(grant: InvitationGrant, request: LiveRequestV1): Promise<LiveReplyV1> {
    if (!this.get(grant.token) || !grant.socket || grant.socket.readyState !== 1) return liveError(request.id, LIVE_ERRORS.notReady, 'The document is no longer connected. Ask the person for another invitation.');
    if (request.method === 'hello') {
      const client = typeof request.params?.client === 'string' ? request.params.client.trim().slice(0, 60) : 'AI agent';
      if (request.params?.protocol !== LIVE_PROTOCOL || !client || Array.from(client).some(ch => { const code = ch.codePointAt(0)!; return code < 32 || (code >= 127 && code <= 159); })) return liveError(request.id, LIVE_ERRORS.invalidParams, 'hello needs live-v1 and a readable client name.');
      if (grant.client && grant.client !== client) return liveError(request.id, LIVE_ERRORS.refused, 'This invitation already belongs to another agent. Ask for a new invitation.');
    } else if (!grant.client) return liveError(request.id, LIVE_ERRORS.notReady, 'Connect with hello first.');
    if (grant.permission === 'read' && ['document.apply', 'history.undo'].includes(request.method)) return liveError(request.id, LIVE_ERRORS.refused, 'This invitation allows reading only.');
    const documentId = request.params?.documentId;
    if (documentId !== undefined && documentId !== grant.documentId) return liveError(request.id, LIVE_ERRORS.refused, 'This invitation belongs to a different document.');
    if (grant.client) grant.expiresAt = this.now() + LIVE_LIMITS.idleMs;
    const id = ++grant.seq;
    const reply = await new Promise<LiveReplyV1>(resolve => {
      const timer = setTimeout(() => { grant.pending.delete(id); resolve(liveError(id, LIVE_ERRORS.notReady, 'The editor did not answer. Read the document before retrying an edit, using the same transactionId.')); }, 60_000);
      grant.pending.set(id, { resolve, timer });
      grant.socket!.send(JSON.stringify({ ...request, id, params: { ...request.params, ...(request.method === 'hello' ? {} : { documentId: grant.documentId }) } }), error => {
        if (error) { clearTimeout(timer); grant.pending.delete(id); resolve(liveError(id, LIVE_ERRORS.notReady, 'Could not reach the editor.')); }
      });
    });
    if (request.method === 'hello' && !reply.error) {
      const result = reply.result as { documentId?: unknown; tool?: string; engine?: string };
      if (result?.documentId !== grant.documentId) { this.revoke(grant); return liveError(request.id, LIVE_ERRORS.refused, 'The editor document did not match the invitation.'); }
      if (!grant.client) grant.expiresAt = this.now() + LIVE_LIMITS.idleMs;
      grant.client = String(request.params?.client ?? 'AI agent').trim().slice(0, 60);
      grant.editor = { tool: result.tool ?? '', engine: result.engine ?? '', documentId: grant.documentId };
    }
    return { ...reply, id: request.id };
  }
}
