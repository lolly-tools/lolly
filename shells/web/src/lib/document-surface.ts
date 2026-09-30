// SPDX-License-Identifier: MPL-2.0
/** `window.lolly` + postMessage transport for plan 189's read-only document
 * verbs. The mounted view supplies operations so this module stays lifecycle-
 * neutral and testable without a DOM. Requests are answered only for the senders
 * `isTrustedSender` accepts. */
import { isTrustedSender, type MessageHost } from './message-sender.ts';

export interface DocumentSurface {
  compile(inputs?: Record<string, unknown>): Promise<unknown>;
  inspect(document?: unknown): Promise<unknown>;
  measure(document?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  diff(a: unknown, b: unknown): Promise<unknown>;
}
interface SurfaceWindow extends MessageHost {
  lolly?: { document?: DocumentSurface; ui?: unknown };
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

export function installDocumentSurface(win: SurfaceWindow, surface: DocumentSurface): () => void {
  win.lolly = { ...win.lolly, document: surface };
  const onMessage = (event: MessageEvent): void => {
    const request = event.data as { type?: unknown; id?: unknown; verb?: unknown; args?: unknown[] } | null;
    if (!request || request.type !== 'lolly:document' || typeof request.id !== 'string' || !['compile', 'inspect', 'measure', 'diff'].includes(String(request.verb))) return;
    if (!isTrustedSender(event, win)) return;
    const source = event.source as { postMessage?: (message: unknown, targetOrigin: string) => void } | null;
    if (!source?.postMessage) return;
    const verb = request.verb as keyof DocumentSurface;
    // The reply is addressed to the sender's own origin, never '*'.
    const origin = event.origin;
    Promise.resolve((surface[verb] as (...args: unknown[]) => Promise<unknown>)(...(Array.isArray(request.args) ? request.args : [])))
      .then((value) => source.postMessage?.({ type: 'lolly:document:result', id: request.id, ok: true, value }, origin))
      .catch((error) => source.postMessage?.({ type: 'lolly:document:result', id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) }, origin));
  };
  win.addEventListener('message', onMessage);
  return () => {
    win.removeEventListener('message', onMessage);
    if (win.lolly?.document === surface) delete win.lolly.document;
  };
}
