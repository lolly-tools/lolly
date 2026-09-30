// SPDX-License-Identifier: MPL-2.0
import { updateRouteParams } from '../lib/url-state.ts';
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
import { historyParticipation, type HistoryManifest } from './tool-history-adapters.ts';
import { mountRevisionHistoryControl } from './tool-history-controls.ts';
import { t } from '../i18n.ts';
import { awaitsEmojiPins } from './tool-session-snapshot.ts';
export { historyParticipation, trackRevisionInput } from './tool-history-adapters.ts';

/** A browser entry remembers its local document without putting a device-local
 * slot in a copied Share URL. The actual document remains in host.state. */
export function localHistorySlot(state: HostV1['state'], manifest: HistoryManifest): string | undefined {
  const entry = window.history.state?.lollyHistory;
  if (!(state as WebStateAPI).history || (!historyParticipation(manifest, false).localHistory && entry?.explicit !== true)) return;
  return entry?.toolId === manifest.id && typeof entry.slot === 'string' ? entry.slot : undefined;
}

/** The Projects folder store over this host, loaded on first use. */
async function folderStore(host: HostV1) {
  const { createFolderStore } = await import('../folders.ts');
  return createFolderStore(host as unknown as Parameters<typeof createFolderStore>[0]);
}

/** Take a session out of whichever Projects folder holds it (plan 277 P1: a
 *  creation discarded by Leave without saving is no longer in Projects). */
export async function unfileSession(host: HostV1, slot: string): Promise<void> {
  await (await folderStore(host)).moveItem(slot, null);
}

/**
 * The most elements a checkpoint's preview photographs. The export render inlines the
 * computed style of every element and blocks the main thread while it does, at about
 * 3 ms per element in headless Chromium: 119 elements (Agenda) held it for 331 ms, a
 * 400-point line chart (1,836) for 5.6 s, and 12,000 (Contrast Check's palette view)
 * crashed the tab. A preview is optional, so a larger page keeps its checkpoints
 * without one.
 */
export const PREVIEW_MAX_ELEMENTS = 400;

/**
 * When a checkpoint's preview is taken. Each preview waits for the page to be left
 * alone for `quietMs` and then for the browser to be idle, and gives up if the
 * document changes meanwhile; after one is taken the next waits `intervalMs`, so a
 * person working steadily is photographed every few minutes, not at every checkpoint.
 * Mutable so a test can shorten the waits.
 */
export const PREVIEW_TIMING = { quietMs: 4000, idleTimeoutMs: 2000, intervalMs: 3 * 60_000 };

/** Resolve once the page has been quiet for `ms` and the browser is idle. */
function quietAndIdle(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(() => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => resolve(), { timeout: PREVIEW_TIMING.idleTimeoutMs });
    else resolve();
  }, ms));
}

/** PNG data URL of a canvas the size of a preview, or null where drawing is unavailable. */
function drawPreview(paint: (ctx: CanvasRenderingContext2D, width: number, height: number) => void): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = 360; canvas.height = 280;
  let ctx: CanvasRenderingContext2D | null = null;
  try { ctx = canvas.getContext('2d'); } catch { return null; }
  if (!ctx) return null;
  paint(ctx, canvas.width, canvas.height);
  try { return canvas.toDataURL('image/png'); } catch { return null; }
}

/**
 * A preview made of the document's own words: a tool with nothing to photograph
 * (Text keeps its document in its own workspace), or one whose picture the export
 * renderer cannot make (Jump's animated backdrop). Costs a few milliseconds.
 */
export function wordsPreview(words: readonly string[]): string | null {
  const text = words.map(word => word.trim()).filter(Boolean).join('\n');
  if (!text) return null;
  return drawPreview((ctx, width, height) => {
    const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
    // Large enough to read on a Projects tile, which shows the preview at half size.
    ctx.fillStyle = '#1b1f23'; ctx.font = `24px ${family}`; ctx.textBaseline = 'top';
    const pad = 24, lineHeight = 32, maxWidth = width - 2 * pad;
    let y = pad;
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > maxWidth) {
          ctx.fillText(line, pad, y); y += lineHeight; line = word;
          if (y > height - pad - lineHeight) return;
        } else line = next;
      }
      ctx.fillText(line, pad, y); y += lineHeight;
      if (y > height - pad - lineHeight) return;
    }
  });
}

/**
 * The words a words preview shows: the first longtext input that holds prose (not a
 * JSON value a tool keeps for itself), else the first two such text inputs.
 */
export function documentWords(inputs: readonly { id: string; type?: string }[], values: ReadonlyMap<string, unknown>): string[] {
  const prose = (input: { id: string }): string => {
    const value = values.get(input.id);
    const text = typeof value === 'string' ? value.trim() : '';
    return text && !/^[[{]/.test(text) ? text : '';
  };
  const long = inputs.filter(input => input.type === 'longtext').map(prose).find(Boolean);
  if (long) return [long];
  return inputs.filter(input => input.type === 'text').map(prose).filter(Boolean).slice(0, 2);
}

/** Photograph the rendered artboard without resizing the live stage, playing a
 * shutter, or re-running export hooks. The controller rejects a changed generation.
 * Where there is no artboard, or the photograph fails, the document's words stand in. */
async function capture(host: HostV1, canvas: HTMLElement | null, words?: () => readonly string[]): Promise<string | null> {
  if (document.visibilityState === 'hidden') return null;
  const node = flatExportNode(canvas);
  const fallback = (): string | null => (words ? wordsPreview(words()) : null);
  if (!node) return fallback();
  if (node.getElementsByTagName('*').length > PREVIEW_MAX_ELEMENTS) return null;
  const width = node.clientWidth || 600, height = node.clientHeight || 400;
  const scale = Math.min(360 / width, 280 / height, 1);
  let blob: Blob;
  try {
    blob = await host.export.render(node, 'png', { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), embedMeta: false, thumbnail: true });
  } catch { return fallback(); }
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
  });
}

/**
 * The automatic-history controller for one mounted tool. `el` is the export bar, whose
 * format, size and print controls are part of the document; a tool with no bar (Text
 * keeps its own workspace chrome) passes null. The browser entry remembers the slot
 * only while this controller is mounted: until dispose, and while the bar (else the
 * canvas) is still in the page.
 */
export function mountActionHistory(opts: {
  enabled?: boolean; host: HostV1; toolId: string; el: HTMLElement | null; canvas: HTMLElement | null;
  initial?: RevisionCursor;
  getSlot(): string | null; setSlot(slot: string): void;
  takeFolder(): string | null | undefined;
  snapshot(): SavedStateData;
  /** The runtime's emoji state feed, so a write made before the chosen set's artwork
   *  pins arrived is followed by one that carries them. */
  onEmojiChange?(listener: (state: { assets?: readonly unknown[] }) => void): () => void;
  /** The document's words, for a preview when there is no artboard to photograph. */
  previewWords?(): readonly string[];
}): AutomaticHistory | undefined {
  const state = opts.host.state as WebStateAPI;
  if (!opts.enabled || !state.history) return undefined;
  let live = true;
  const mounted = (): boolean => live && ((opts.el ?? opts.canvas)?.isConnected ?? true);
  const rememberSlot = (): void => {
    const slot = opts.getSlot();
    if (slot && mounted()) window.history.replaceState({ ...window.history.state,
      lollyHistory: { toolId: opts.toolId, slot } }, '', location.href);
    if (slot && mounted()) updateRouteParams({ slot });
  };
  rememberSlot();
  // The pins of the chosen emoji set arrive when the Emoji section has resolved its
  // artwork, which can be after the first write (plan 277 P4, phase 0 finding 1). A
  // write that went out without them is noted here, and the pins arriving count as a
  // change, so the next write carries what the document's credential cites. Nothing
  // is noted before the first write, so opening a tool still files nothing.
  let pinlessWrite = false;
  const snapshot = (): SavedStateData => {
    const data = opts.snapshot();
    if (awaitsEmojiPins(data)) pinlessWrite = true;
    return data;
  };
  // A preview after a checkpoint waits for the person to pause, and is skipped when
  // they carry on or when one was taken a short while ago (see PREVIEW_TIMING).
  let changes = 0, lastPreview = 0;
  const preview = async (): Promise<string | null> => {
    if (lastPreview && Date.now() - lastPreview < PREVIEW_TIMING.intervalMs) return null;
    const seen = changes;
    await quietAndIdle(PREVIEW_TIMING.quietMs);
    if (!live || changes !== seen) return null;
    const shot = await capture(opts.host, opts.canvas, opts.previewWords);
    if (shot) lastPreview = Date.now();
    return shot;
  };
  const controller = createAutomaticHistory({
    history: state.history, initial: opts.initial, toolId: opts.toolId, getSlot: opts.getSlot, setSlot: opts.setSlot,
    snapshot, load: slot => state.load(slot), capture: preview,
    // An explicit save never depends on history: when history cannot record the
    // document, the record is written the way a tool without history writes a save.
    store: (slot, data) => state.save(slot, data),
    // A collab mount is excluded before this controller is created. Once a
    // transport adopts a handle it unregisters its factory, so checking the
    // registry here would incorrectly turn shared sessions into local history.
    allowed: () => true,
    failure: message => { void import('../lib/undo-toast.ts').then(({ showUndoToast }) => showUndoToast({
      message, actionLabel: t('History'), undo: async () => {
        const { openHistoryPanel } = await import('../components/history-panel.ts');
        openHistoryPanel({ state, slot: opts.getSlot, controller, currentSnapshot: opts.snapshot });
      },
    })); },
    saved: () => {
      rememberSlot();
      markSyncDirty();
      const slot = opts.getSlot(), folder = opts.takeFolder();
      if (slot && folder) void folderStore(opts.host).then(store => store.moveItem(slot, folder, 'session')).catch(() => {});
    },
  });
  const changed = (): void => { changes++; controller.changed(); };
  const onInput = (event: Event): void => {
    const target = event.target as HTMLElement;
    if (target.matches('[data-action="filename"], [data-action="format"], [data-action^="export-"], [data-action^="print-"], [data-action^="mark-"], [data-action="cmyk-profile"]')) changed();
  };
  opts.el?.addEventListener('input', onInput); opts.el?.addEventListener('change', onInput);
  const offEmoji = opts.onEmojiChange?.(emoji => {
    if (!pinlessWrite || !emoji.assets?.length) return;
    pinlessWrite = false;
    changed();
  });
  return { ...controller, changed, async save(slot, data) {
    if (awaitsEmojiPins(data)) pinlessWrite = true;
    return controller.save(slot, data);
  }, dispose() {
    live = false;
    controller.dispose(); offEmoji?.();
    opts.el?.removeEventListener('input', onInput); opts.el?.removeEventListener('change', onInput);
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
      message, actionLabel: t('History'), undo: opts.open,
    })); },
  });
}

export function wireToolRevisionHistory(opts: {
  state: WebStateAPI; slot(): string | null; controller?: AutomaticHistory; collab?: CollabHistoryCapability; connected(): boolean;
  root?: HTMLElement;
  /** The view draws History in an editor top bar of its own (Design, Org Chart). */
  editorBar?: boolean;
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
    ? mountRevisionHistoryControl(opts.root, () => { void open(); }, { editorBar: opts.editorBar === true }) : undefined;
  return {
    open,
    dispose() { close?.(); releaseControl?.(); document.removeEventListener('visibilitychange', onHidden); window.removeEventListener('pagehide', onPageHide); },
  };
}
