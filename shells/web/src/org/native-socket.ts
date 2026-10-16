// SPDX-License-Identifier: MPL-2.0
/** Native HTTP carries the session; the WebView socket receives a one-use room ticket. */
import { getInstanceBase, hasInstanceSession, instanceFetch } from '../lib/instance.ts';
import { isTauriShell } from '../lib/native-shell.ts';

export async function nativeSocketProtocols(base: string, sessionId: string): Promise<string[] | null> {
  if (!isTauriShell() || !hasInstanceSession() || !base || base !== getInstanceBase()) return null;
  const response = await instanceFetch(`${base}/api/v1/collab/sessions/${encodeURIComponent(sessionId)}/socket-ticket`, { method: 'POST' });
  if (!response.ok) return null;
  const body = await response.json() as { ticket?: unknown };
  if (base !== getInstanceBase() || !hasInstanceSession()) return null;
  if (typeof body.ticket !== 'string' || !/^[a-f0-9]{64}$/.test(body.ticket)) return null;
  return ['lolly-collab-v1', `lolly-ticket.${body.ticket}`];
}
