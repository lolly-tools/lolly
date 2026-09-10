// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { SavedStateData, WebStateAPI } from '../bridge/state.ts';
import type { RevisionCursor } from '../bridge/revision-records.ts';
import { createAutomaticHistory, type AutomaticHistory } from './automatic-history.ts';
import { flatExportNode } from './tool-action-helpers.ts';
import { markSyncDirty } from '../lib/sync-service.ts';
import { isCapturableCollabHistory, type CollabHistoryCapability } from '../lib/collab-history.ts';
import type { CollabSessionHandle } from '../lib/collab-session.ts';
import { createCollabHistoryCapture, type CollabHistoryCapture } from '../lib/collab-history-capture.ts';
import type { HistoryWireEntry } from '../collab/history-exchange.ts';
import { hasHistoryAdapter } from './tool-history-adapters.ts';
import { mountRevisionHistoryControl } from './tool-history-controls.ts';
export { historyParticipation, trackRevisionInput } from './tool-history-adapters.ts';

/** A browser entry remembers its local document without putting a device-local
 * slot in a copied Share URL. The actual document remains in host.state. */
export function localHistorySlot(state: HostV1['state'], toolId: string): string | undefined {
  const entry = window.history.state?.lollyHistory;
  if (!(state as WebStateAPI).history || (!hasHistoryAdapter(toolId) && entry?.explicit !== true)) return;
  return entry?.toolId === toolId && typeof entry.slot === 'string' ? entry.slot : undefined;
}

/** Photograph the rendered artboard without resizing the live stage, playing a
 * shutter, or re-running export hooks. The controller rejects a changed generation. */
async function capture(host: HostV1, canvas: HTMLElement | null): Promise<string | null> {
  const node = flatExportNode(canvas);
  if (!node || document.visibilityState === 'hidden') return null;
  const width = node.clientWidth || 600, height = node.clientHeight || 400;
  const scale = Math.min(360 / width, 280 / height, 1);
  const blob = await host.export.render(node, 'png', { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), embedMeta: false, thumbnail: true });
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
  });
}

export function mountActionHistory(opts: {
  enabled?: boolean; host: HostV1; toolId: string; el: HTMLElement; canvas: HTMLElement | null;
  initial?: RevisionCursor;
  getSlot(): string | null; setSlot(slot: string): void;
  takeFolder(): string | null | undefined;
  snapshot(): SavedStateData;
}): AutomaticHistory | undefined {
  const state = opts.host.state as WebStateAPI;
  if (!opts.enabled || !state.history) return undefined;
  const rememberSlot = (): void => {
    const slot = opts.getSlot();
    if (slot && opts.el.isConnected) window.history.replaceState({ ...window.history.state,
      lollyHistory: { toolId: opts.toolId, slot } }, '', location.href);
  };
  rememberSlot();
  const controller = createAutomaticHistory({
    history: state.history, initial: opts.initial, toolId: opts.toolId, getSlot: opts.getSlot, setSlot: opts.setSlot,
    snapshot: opts.snapshot, load: slot => state.load(slot), capture: () => capture(opts.host, opts.canvas),
    // A collab mount is excluded before this controller is created. Once a
    // transport adopts a handle it unregisters its factory, so checking the
    // registry here would incorrectly turn shared sessions into local history.
    allowed: () => true,
    failure: message => { void import('../lib/undo-toast.ts').then(({ showUndoToast }) => showUndoToast({
      message, actionLabel: 'History', undo: async () => {
        const { openHistoryPanel } = await import('../components/history-panel.ts');
        openHistoryPanel({ state, slot: opts.getSlot, controller, currentSnapshot: opts.snapshot });
      },
    })); },
    saved: () => {
      rememberSlot();
      markSyncDirty();
      const slot = opts.getSlot(), folder = opts.takeFolder();
      if (slot && folder) void import('../folders.ts').then(({ createFolderStore }) =>
        createFolderStore(opts.host as unknown as Parameters<typeof createFolderStore>[0]).moveItem(slot, folder, 'session')).catch(() => {});
    },
  });
  const onInput = (event: Event): void => {
    const target = event.target as HTMLElement;
    if (target.matches('[data-action="filename"], [data-action="format"], [data-action^="export-"], [data-action^="print-"], [data-action^="mark-"], [data-action="cmyk-profile"]')) controller.changed();
  };
  opts.el.addEventListener('input', onInput); opts.el.addEventListener('change', onInput);
  return { ...controller, async save(slot, data) {
    await controller.save(slot, data);
  }, dispose() {
    controller.dispose(); opts.el.removeEventListener('input', onInput); opts.el.removeEventListener('change', onInput);
  } };
}

/** Work supplies server revisions; only P2P has a client-owned capture log. */
export function mountCollabActionHistory(opts: {
  handle?: CollabSessionHandle | null; snapshot?: () => SavedStateData;
  toolId: string; slot?: string | null; open(): Promise<void>;
}): CollabHistoryCapture | undefined {
  const handle = opts.handle;
  if (!handle || !opts.snapshot || !isCapturableCollabHistory(handle.history)) return;
  return createCollabHistoryCapture({
    history: handle.history, snapshot: opts.snapshot, toolId: opts.toolId,
    documentId: opts.slot ?? `collab:${opts.toolId}`, actorId: handle.self.clientId,
    ...(handle.self.name ? { actorLabel: handle.self.name } : {}),
    failure: message => { void import('../lib/undo-toast.ts').then(({ showUndoToast }) => showUndoToast({
      message, actionLabel: 'History', undo: opts.open,
    })); },
  });
}

export function wireToolRevisionHistory(opts: {
  state: WebStateAPI; slot(): string | null; controller?: AutomaticHistory; collab?: CollabHistoryCapability; connected(): boolean;
  root?: HTMLElement;
  copyState?: WebStateAPI;
  currentSnapshot?: () => SavedStateData;
  collaborating?: boolean;
  peer?: { list(): Promise<readonly HistoryWireEntry[]>; fetch(revisionId: string): Promise<SavedStateData> };
}): { open(): Promise<void>; dispose(): void } {
  let close: (() => void) | undefined;
  const onPageHide = (): void => { void opts.controller?.flush(); };
  if (opts.controller) window.addEventListener('pagehide', onPageHide);
  const onHidden = (): void => { if (document.visibilityState === 'hidden') void opts.controller?.flush(); };
  if (opts.controller) document.addEventListener('visibilitychange', onHidden);
  const open = async (): Promise<void> => {
    const { openHistoryPanel } = await import('../components/history-panel.ts');
    if (opts.connected()) close = openHistoryPanel(opts);
  };
  const releaseControl = opts.root && (opts.controller || opts.collaborating || opts.collab)
    ? mountRevisionHistoryControl(opts.root, () => { void open(); }) : undefined;
  return {
    open,
    dispose() { close?.(); releaseControl?.(); document.removeEventListener('visibilitychange', onHidden); window.removeEventListener('pagehide', onPageHide); },
  };
}

/** Trash and undo move the document identity and its complete history together. */
export async function moveSessionSlot(host: Pick<HostV1, 'state' | 'log'>, from: string, to: string): Promise<boolean> {
  try {
    const state = host.state as WebStateAPI;
    if (state.history) { await state.history.move(from, to); return true; }
    const data = await state.load(from);
    if (!data) return false;
    const thumb = (await state.list().catch(() => [])).find(row => row.slot === from)?.thumb;
    await state.save(to, data, thumb);
    await state.delete(from);
    return true;
  } catch (error) { host.log?.('warn', 'projects: trash slot move failed', { from, to, error: String(error) }); return false; }
}
