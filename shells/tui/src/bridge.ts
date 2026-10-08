// SPDX-License-Identifier: MPL-2.0
/**
 * TUI capability bridge.
 *
 * The TUI is "the CLI bridge under an interactive transport" - same Node + jsdom
 * render path, same filesystem assets and in-memory state. So it REUSES the CLI's
 * `createCliBridge` verbatim (proving again that the engine/tools don't care which
 * shell they run in) with exactly one change: the CLI writes `host.log` to
 * stdout/stderr, which would corrupt Ink's managed screen - so we redirect it into
 * an in-memory buffer the UI can surface instead.
 */
import { JSDOM } from 'jsdom';
import { createCliBridge } from '../../cli/src/bridge.ts';
import { getProfile } from './store.ts';
import type { HostV1, Profile } from '@lolly-tools/core/host-v1';

export interface TuiBridge {
  host: HostV1;
  dom: JSDOM;
  /** Captured host.log lines (stdout is Ink's - never write there). */
  logs: string[];
}

export async function createTuiBridge(profile: Profile = {}): Promise<TuiBridge> {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="canvas"></div></body></html>');
  // The engine + Handlebars reach for these globals while hydrating/exporting a
  // template (same as the CLI runner). Ink's reconciler is terminal-only and never
  // reads them, so exposing a jsdom window is harmless here.
  const g = globalThis as unknown as { window?: unknown; document?: unknown; Element?: unknown };
  g.window = dom.window;
  g.document = dom.window.document;
  g.Element = dom.window.Element;

  const logs: string[] = [];
  const keep = (line: string): void => {
    logs.push(line);
    if (logs.length > 200) logs.shift();
  };
  // A rondocode song's report (plan 301) goes to the buffer too: the CLI's default
  // writes it to stderr, which would land on Ink's screen.
  const host = await createCliBridge({
    dom,
    profile,
    onAudioRun: (run) => {
      keep(`[info] Song "${run.name}": ${run.seconds.toFixed(2)} s rendered in the ${run.run.executionClass} execution class (${run.run.source} ${run.run.version}).`);
      for (const f of run.findings) keep(`[warn] Song "${run.name}": ${f.message}`);
    },
    onAudioRunFailed: (failure) => keep(`[warn] Song "${failure.name}" was not rendered: ${failure.message} (${failure.code})`),
  });
  // Read the persisted profile LIVE so bindToProfile inputs pre-fill from it and edits
  // in the Profile view take effect on the next tool mount (the CLI bridge would otherwise
  // pin the profile captured at boot).
  host.profile = {
    get: async (): Promise<Profile> => (await getProfile()) as Profile,
    subscribe: () => () => {},
  };
  host.log = (level: string, msg: string, ctx?: object): void => {
    keep(`[${level}] ${msg}${ctx ? ' ' + JSON.stringify(ctx) : ''}`);
  };

  // The CLI stubs the clipboard (headless render has nowhere to paste); an interactive
  // terminal DOES, so back it with the OS clipboard tool (pbcopy / wl-copy / xclip).
  host.clipboard = {
    async writeText(text: string): Promise<void> {
      const { copyToClipboard } = await import('./clipboard.ts');
      if (!(await copyToClipboard(text))) throw new Error('No system clipboard tool found');
    },
    async writeImage(): Promise<{ method: 'clipboard' | 'download' }> { throw new Error('Image clipboard unavailable in the terminal'); },
  };

  // host.capture is now real in the shared CLI bridge (backed by the same scoped Chromium),
  // so the TUI inherits it - no override needed. url-shot's export still routes straight to
  // captureUrl in engine-render.ts; this fulfils the 'capture' capability for hook callers.

  return { host, dom, logs };
}
