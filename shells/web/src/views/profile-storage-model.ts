// SPDX-License-Identifier: MPL-2.0
/**
 * The /profile storage meter's data model, plus the two renderers that read it
 * straight through: the screen-reader reconciliation sentence and the saved-session
 * rows. Split out of views/profile.ts so the meter's shape is one file rather than
 * a stretch of the view's mount function.
 */

import { BATCH_SLOT_PREFIX } from '../lib/batch-slots.ts';
import { relativeTime, fmtBytes, sessionRow } from '../folder-tiles.ts';
import { t, tRaw } from '../i18n.ts';
// Aliased on import: a bare `escape` shadows the deprecated global of that name.
import { escape as escapeHtml } from '../utils.ts';
import type { AssetRef, StateEntry } from '@lolly-tools/core/host-v1';

/** A saved session as the web state bridge lists it - StateEntry plus the
 *  export filename and the thumbnail this view renders. */
export interface SessionEntry extends StateEntry {
  filename?: string | null;
  thumb?: string | null;
}

export interface PreviewsMeasure { bytes: number; count: number; available: boolean }

export interface StorageModel {
  sessions: { bytes: number; count: number; sizes: Record<string, number>; list: SessionEntry[] };
  images: { bytes: number; count: number; list: AssetRef[] };
  cache: { bytes: number };
  fileHistory?: { bytes: number };
  previews: PreviewsMeasure;
  /** Tools pinned "available offline" - their cached FILE bytes (lib/offline-pins.ts).
   *  Their prefetched catalog asset blobs are counted by the `cache` slice. */
  pins: { bytes: number; count: number };
  /** The on-device voice models (Kokoro, later Whisper) in the speech Cache
   *  Storage buckets - filled by the 'speech' offline part OR the Script-audio
   *  dialog's consent download, so this measures the caches, not a record. */
  speech: { bytes: number; files: number };
  /** On-device AI image models in their IndexedDB stores - filled by the matching
   *  offline part OR the Upscale / Remove-background dialogs' on-demand download, so
   *  these measure the stores, not a record (twin of `speech`). */
  upscale: { bytes: number; files: number };
  matte: { bytes: number; files: number };
  ocr: { bytes: number; files: number };
  /** The reword model's slice of the shared transformers bucket (plans/127) -
   *  filled by the 'reword' offline part OR the humanize panel's consent
   *  download, so this measures the cache, not a record (twin of `speech`). */
  reword: { bytes: number; files: number };
  /** The AI-text detector's slice (plans/126 WP-A) - filled by the verify /
   *  catalog panel's consent download (cache-measured, twin of `reword`). */
  aiDetect: { bytes: number; files: number };
  /** The durable-credential encoder in the shared `trustmark-models` store -
   *  filled by the 'durable' offline part OR the first durable export, so this
   *  measures the store, not a record. Scoped to its own key: the deep-scan
   *  decoders sharing that store stay in the meter's "Other" remainder. */
  durable: { bytes: number; files: number };
  measured: number;
  hasEstimate: boolean;
  usage: number | null;
  quota: number | null;
  overshoot: boolean;
  other: number;
  total: number;
}

/** What a session row needs from the mounted view: the tool-name lookup and the
 *  placeholder glyph for a session with no thumbnail. */
export interface SessionRowContext {
  toolNameOf(id: string): string;
  placeholderIcon: string;
}

// Approximate, theme-agnostic byte formatting (KB/MB/GB) shared by the meter.
export const fmtPct = (usage: number, quota: number | null): string => {
  if (!quota) return '0%';
  const p = (usage / quota) * 100;
  if (p < 0.1) return '<0.1%';
  return p < 10 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
};

// The one-read screen-reader overview (the bar itself stays interactive, not role=img).
export function reconciliationSentence(m: StorageModel): string {
  const parts = [
    `Saved sessions ${fmtBytes(m.sessions.bytes)}`,
    `My images ${fmtBytes(m.images.bytes)}`,
    `Asset cache ${fmtBytes(m.cache.bytes)}`,
  ];
  if (m.previews.available) parts.push(`Tool previews ${fmtBytes(m.previews.bytes)}`);
  if (m.fileHistory?.bytes) parts.push(`File results & versions ${fmtBytes(m.fileHistory.bytes)}`);
  if (m.pins.count) parts.push(`Available offline ${fmtBytes(m.pins.bytes)}`);
  if (m.speech.bytes) parts.push(`Voice models ${fmtBytes(m.speech.bytes)}`);
  if (m.upscale.bytes) parts.push(`Upscaling models ${fmtBytes(m.upscale.bytes)}`);
  if (m.matte.bytes) parts.push(`Background removal ${fmtBytes(m.matte.bytes)}`);
  if (m.ocr.bytes) parts.push(`Text recognition ${fmtBytes(m.ocr.bytes)}`);
  if (m.durable.bytes) parts.push(`Durable credential ${fmtBytes(m.durable.bytes)}`);
  let s = m.hasEstimate
    ? `Using ${fmtBytes(m.total)}: ${parts.join(', ')}`
    : `Measured ${fmtBytes(m.measured)}: ${parts.join(', ')}`;
  if (m.hasEstimate && m.other > 0) s += `, and about ${fmtBytes(m.other)} of other app data and overhead`;
  s += (m.hasEstimate && m.quota) ? ` - ${fmtPct(m.usage!, m.quota)} of your ${fmtBytes(m.quota)} device budget.` : '.';
  return s;
}

// One selectable, deletable session row. Largest-first by default. Built on
// folder-tiles.ts's sessionRow() - the shared row primitive behind this
// Storage manager list AND the gallery's per-tool history list
// (component-audit rec 6). Only this view's chrome (the select checkbox, the
// inline "batch" tag, the classes its own stylesheet keys off) lives here.
export function renderSessRow(s: SessionEntry, bytes: number, ctx: SessionRowContext): string {
  const isBatch = String(s.slot).startsWith(BATCH_SLOT_PREFIX);
  const label = s.label || s.filename || ctx.toolNameOf(s.toolId);
  const subtitle = ctx.toolNameOf(s.toolId) + (s.updatedAt ? ` · ${relativeTime(s.updatedAt)}` : '');
  return sessionRow(s, {
    rowClass: 'store-sess',
    rowAttrs: `data-slot="${escapeHtml(s.slot)}"`,
    thumbClass: 'store-sess-thumb',
    thumbImgAttrs: 'loading="lazy"',
    emptyThumbContent: ctx.placeholderIcon,
    emptyThumbClass: 'is-placeholder',
    selectClass: 'store-sess-check',
    selectLabel: tRaw('Select {name}', { name: label }),
    metaClass: 'store-sess-meta',
    titleClass: 'store-sess-label',
    title: label,
    batchTag: isBatch ? t('batch') : undefined,
    batchTagClass: 'store-sess-tag',
    subClass: 'store-sess-sub',
    subtitle,
    sizeBytes: bytes,
    deleteAttr: `data-del-session="${escapeHtml(s.slot)}"`,
    deleteClass: 'store-sess-del',
    deleteLabel: tRaw('Delete {name}', { name: label }),
  });
}

export function sessionRowsHtml(m: StorageModel, sort: string, ctx: SessionRowContext): string {
  const sizes = m.sessions.sizes;
  const rows = [...m.sessions.list];
  if (sort === 'recent') rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  else rows.sort((a, b) => (sizes[b.slot] || 0) - (sizes[a.slot] || 0));
  if (!rows.length) return `<li class="storage-empty">${t('No saved sessions yet.')}</li>`;
  return rows.map(s => renderSessRow(s, sizes[s.slot] || 0, ctx)).join('');
}
