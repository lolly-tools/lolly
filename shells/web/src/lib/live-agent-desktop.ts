// SPDX-License-Identifier: MPL-2.0
/**
 * The desktop app's side of `live-v1` (plans/289 D1). With Allow AI control on, the
 * app listens on loopback (shells/tauri-desktop/src-tauri/src/live_server.rs) and an
 * agent's local MCP server connects with the token from `live.json`, no code needed.
 * This module is the page's half: it long-polls `live_next`, answers each request
 * through a live session, and hands the reply back with `live_reply`.
 *
 * Allow AI control is a device setting, off until the person turns it on, kept in
 * `localStorage` like the shell's other device preferences (never tool state).
 */

import { LIVE_ERRORS, liveError } from '@lolly-tools/core';
import type { TauriInvoke } from './nearby-boot.ts';
import { createLiveSession, type LiveEditor, type LiveSession, type LiveSessionOpts } from './live-agent.ts';

const PREF_KEY = 'lolly-allow-ai-control';
const POLL_MS = 20_000;

export function allowAiControl(): boolean {
  try { return localStorage.getItem(PREF_KEY) === '1'; } catch { return false; }
}

export function setAllowAiControlPref(on: boolean): void {
  try { if (on) localStorage.setItem(PREF_KEY, '1'); else localStorage.removeItem(PREF_KEY); } catch { /* best effort */ }
}

/** Turn the app's listener on or off; resolves to the port while on. */
export async function setListener(invoke: TauriInvoke, on: boolean): Promise<number | null> {
  const port = await invoke('live_set', { on });
  return typeof port === 'number' ? port : null;
}

export interface DesktopServing {
  session(): LiveSession;
  /** Close this session (the person's Disconnect); later requests are refused until `renew`. */
  disconnect(): void;
  /** A fresh session, so an agent the person disconnected may connect again. */
  renew(): void;
  /** Stop answering (the view closed). The listener stays as the setting says. */
  stop(): void;
}

/** Serve one open editor until `stop`. */
export function serveDesktop(invoke: TauriInvoke, editor: () => LiveEditor, opts: LiveSessionOpts = {}): DesktopServing {
  let session = createLiveSession(editor(), opts);
  let stopped = false;
  void (async () => {
    while (!stopped) {
      let next: unknown;
      try {
        next = await invoke('live_next', { timeoutMs: POLL_MS });
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      const req = next as { seq?: unknown; text?: unknown } | null;
      if (!req || typeof req.seq !== 'number' || typeof req.text !== 'string') continue;
      // A request that arrived as the view closed still gets an answer, not a 60 s wait.
      const reply = stopped
        ? JSON.stringify(liveError(null, LIVE_ERRORS.notReady, 'The Design document was closed.'))
        : await session.handle(req.text);
      try { await invoke('live_reply', { seq: req.seq, text: reply }); } catch { /* the agent will time out */ }
    }
  })();
  return {
    session: () => session,
    disconnect: () => session.close(),
    renew: () => { session.close(); session = createLiveSession(editor(), opts); },
    stop: () => { stopped = true; session.close(); },
  };
}
