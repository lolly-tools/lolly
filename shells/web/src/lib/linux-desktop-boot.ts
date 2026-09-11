// SPDX-License-Identifier: MPL-2.0
/**
 * Desktop-integration boot (plans/174) - the web half of the native poll loop.
 *
 * The Tauri side (src-tauri/src/desktop_integration.rs) queues everything the
 * OS hands the app - a double-clicked .lolly, a lolly:// link, a hot-folder
 * arrival, a tray/search activation asking for a route - and this module
 * drains that queue every POLL_MS and routes each event. Poll, not push, on
 * purpose: it is the house Rust->JS pattern (nearby-boot.ts is the shape this
 * file mirrors, down to the injectable env for headless tests).
 *
 * File bytes come back through `desktop_read_file`, which the Rust side gates
 * to paths the desktop actually delivered - the webview's own fs scope stays
 * narrow. A delivered file then takes EXACTLY the drag-drop path
 * (drop-router's openDropChooser), so "double-click in Files" and "drop on the
 * window" are one behaviour, not two.
 */
import type { PickerHost } from '../views/picker.ts';
import { tauriInvoke, type TauriInvoke } from './nearby-boot.ts';
import { deepLinkToHash } from './deep-link.ts';

const POLL_MS = 1200;
const MAX_EVENTS_PER_POLL = 16;
const MAX_FILE_BYTES = 512 * 1024 * 1024; // mirrors MAX_RESTORE_ENTRY_BYTES

interface RawEvent { kind?: unknown; value?: unknown; target?: unknown }

export interface LinuxDesktopEnv {
  invoke: TauriInvoke;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (h: unknown) => void;
  navigate?: (hash: string) => void;
  openFiles?: (files: File[]) => Promise<void>;
  openUtilityFile?: (
    target: import('./drop-router.ts').NativeUtilityTarget,
    file: File,
  ) => Promise<void> | void;
}

// The lolly:// grammar lives in deep-link.ts, shared with the Android and iOS
// intakes; re-exported here because this module's test and callers named it first.
export { deepLinkToHash };

function fileNameOf(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? 'file';
  return base || 'file';
}

/** Drain-and-route one poll's worth of events. Exported for tests. */
export async function routeEvents(raw: unknown, env: LinuxDesktopEnv): Promise<void> {
  if (!Array.isArray(raw)) return;
  for (const e of (raw as RawEvent[]).slice(0, MAX_EVENTS_PER_POLL)) {
    const kind = typeof e?.kind === 'string' ? e.kind : '';
    const value = typeof e?.value === 'string' ? e.value : '';
    const target = typeof e?.target === 'string' ? e.target : '';
    if (!kind || !value) continue;
    try {
      if (kind === 'navigate') {
        // Only ever the app's own hash routes; the Rust side builds these, but
        // trust is not a substitute for a check.
        if (value.startsWith('#/')) env.navigate?.(value);
      } else if (kind === 'deepLink') {
        const hash = deepLinkToHash(value);
        if (hash) env.navigate?.(hash);
        else console.warn('[desktop] ignoring malformed deep link', value);
      } else if (kind === 'openFile' || kind === 'hotfolderFile' || kind === 'openUtilityFile') {
        const bytes = (await env.invoke('desktop_read_file', { path: value })) as unknown;
        if (!(bytes instanceof Array) && !(bytes instanceof Uint8Array)) continue;
        const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as number[]);
        if (u8.length === 0 || u8.length > MAX_FILE_BYTES) continue;
        const name = fileNameOf(value);
        const type = /\.lolly$/i.test(name) ? 'application/vnd.lolly+zip' : '';
        const file = new File([u8 as BlobPart], name, { type });
        if (kind === 'openUtilityFile') {
          if (target === 'strip-data' || target === 'convert' || target === 'redact') {
            await env.openUtilityFile?.(target, file);
          }
        } else {
          await env.openFiles?.([file]);
        }
      }
    } catch (err) {
      console.warn('[desktop] event routing failed', kind, err);
    }
  }
}

/** Stash for the desktop accent colour (plans/174 #7) - read once at boot, and
 *  surfaced as a seed elsewhere without this module wandering into the brand
 *  studio. `null` = no portal / no accent / not Linux. */
export function desktopAccent(): string | null {
  const v = (globalThis as { __desktopAccent?: unknown }).__desktopAccent;
  return typeof v === 'string' ? v : null;
}

// ── hot folder (plans/174 #9) ────────────────────────────────────────────────
// The path is DEVICE-local state (a filesystem path on this machine), so it
// lives in localStorage rather than the synced profile - syncing it to a phone
// would be nonsense. This module owns the key; profile.ts calls the helpers.
export const HOTFOLDER_KEY = 'lolly-hotfolder';

export function hotFolderPath(): string | null {
  try { return localStorage.getItem(HOTFOLDER_KEY); } catch { return null; }
}

export async function setHotFolder(path: string | null): Promise<void> {
  const invoke = tauriInvoke();
  if (!invoke) throw new Error('desktop only');
  await invoke('desktop_hotfolder_set', { path });
  try {
    if (path) localStorage.setItem(HOTFOLDER_KEY, path);
    else localStorage.removeItem(HOTFOLDER_KEY);
  } catch { /* storage blocked - the watcher still runs this session */ }
}

/** Install the poll loop. Called from main.ts's Tauri-only boot gate; safe to
 *  call in any environment (no Tauri global -> no-op). */
export function installLinuxDesktopBoot(host: PickerHost, env?: Partial<LinuxDesktopEnv>): () => void {
  const invoke = env?.invoke ?? tauriInvoke();
  if (!invoke) return () => {};
  const full: LinuxDesktopEnv = {
    invoke,
    setInterval: env?.setInterval ?? ((fn, ms) => window.setInterval(fn, ms)),
    clearInterval: env?.clearInterval ?? ((h) => window.clearInterval(h as number)),
    navigate: env?.navigate ?? ((hash) => { location.hash = hash; }),
    openFiles:
      env?.openFiles ??
      (async (files) => {
        const m = await import('./drop-router.ts');
        await m.openDropChooser(files, host);
      }),
    openUtilityFile:
      env?.openUtilityFile ??
      (async (target, file) => {
        const m = await import('./drop-router.ts');
        m.openFileInUtility(target, file);
      }),
  };
  // One accent read at boot - not a subscription; the pref surface that wants
  // live updates can poll desktop_read_accent itself.
  void invoke('desktop_read_accent')
    .then((hex) => {
      if (typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
        (globalThis as { __desktopAccent?: string }).__desktopAccent = hex;
      }
    })
    .catch(() => {});
  let handle: unknown;
  let draining = false;
  let dead = false;
  const tick = (): void => {
    if (draining || dead) return; // a slow file read must not stack drains
    draining = true;
    void invoke('desktop_poll_events')
      .then((raw) => routeEvents(raw, full))
      .catch((e: unknown) => {
        // The MOBILE shells carry __TAURI_INTERNALS__ too, but not these
        // commands - Tauri rejects an unregistered command by name. One such
        // rejection means this whole surface is absent on this shell, so the
        // loop retires itself instead of knocking every 1200ms forever.
        if (/desktop_poll_events/.test(String((e as Error)?.message ?? e))) {
          dead = true;
          full.clearInterval!(handle);
        }
      })
      .finally(() => { draining = false; });
  };
  // Re-arm a remembered hot folder - the Rust watcher dies with the process.
  const saved = hotFolderPath();
  if (saved) void invoke('desktop_hotfolder_set', { path: saved }).catch(() => {});
  handle = full.setInterval!(tick, POLL_MS);
  tick();
  return () => full.clearInterval!(handle);
}
