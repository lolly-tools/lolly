// SPDX-License-Identifier: MPL-2.0
import { LIVE_LIMITS, type LiveReplyV1 } from '@lolly-tools/core';
import type { LiveInvitation } from '@lolly-tools/core/live-invite-v1';

async function responseText(response: Response): Promise<string> {
  if (!response.body) throw new Error('The relay returned no response.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIVE_LIMITS.maxReplyBytes) throw new Error('The relay reply exceeds 16 MB.');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString('utf8');
}

/** A capability copied from Share, carried in headers rather than request URLs. */
export async function remoteLiveRequest(invitation: LiveInvitation, id: number, method: string, params?: Record<string, unknown>): Promise<LiveReplyV1> {
  const body = JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
  if (Buffer.byteLength(body) > LIVE_LIMITS.maxRequestBytes) throw new Error('The request exceeds 4 MB.');
  const response = await fetch(`${invitation.base}/rpc`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${invitation.token}` },
    body, redirect: 'error', signal: AbortSignal.timeout(65_000),
  });
  const value = await responseText(response);
  if (!response.ok) throw new Error(response.status === 401 ? 'This invitation has expired or ended. Ask the person for another invitation.' : `The relay refused the request (${response.status}).`);
  const reply = JSON.parse(value) as LiveReplyV1;
  if (reply.jsonrpc !== '2.0' || reply.id !== id) throw new Error('The relay returned a mismatched reply.');
  return reply;
}

export async function closeRemoteLive(invitation: LiveInvitation): Promise<void> {
  await fetch(`${invitation.base}/mcp`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000), headers: { 'content-type': 'application/json', authorization: `Bearer ${invitation.token}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'tools/call', params: { name: 'lolly_live_disconnect', arguments: {} } }) });
}
