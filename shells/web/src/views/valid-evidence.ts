// SPDX-License-Identifier: MPL-2.0
/**
 * Verify's depth switch: Summary for a quick answer, Evidence for everything.
 *
 * Nothing is hidden from either reader; only the depth differs. Summary keeps
 * every disclosure closed. Evidence opens them all and adds what a forensic
 * reader wants to hand: the file's size, type and SHA-256, every time the file
 * records on one list, and the findings as JSON. The choice is kept on this
 * device.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { FileMetadata, VerifyFinding } from '@lolly/engine';
import '../styles/parts/valid-evidence.css';
import { escape as esc } from '../utils.ts';
import { announce } from '../a11y.ts';
import { t, tRaw } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { segHtml, syncSeg, wireSeg } from '../lib/seg.ts';
import { wireAddressRequests } from './valid-location.ts';
import { wireVerifyPreviews } from './valid-preview.ts';
import { wireHelpTips } from '../components/help-tip.ts';
import { mountStageAudio, wireStageAudio } from './valid-stage-audio.ts';

export type VerifyDepth = 'summary' | 'evidence';
const DEPTH_KEY = 'lolly-verify-depth';

/** The remembered depth. Summary for everyone until a reader chooses otherwise. */
export function readDepth(): VerifyDepth {
  try { return globalThis.localStorage?.getItem(DEPTH_KEY) === 'evidence' ? 'evidence' : 'summary'; } catch { return 'summary'; }
}
function writeDepth(depth: VerifyDepth): void {
  try { globalThis.localStorage?.setItem(DEPTH_KEY, depth); } catch { /* A private window keeps the choice for this page only. */ }
}

export interface RecordedTime { label: string; value: string; source: string }

interface TimesReport {
  claim?: { actions?: ReadonlyArray<{ action?: unknown; when?: unknown }> } | null;
  signer?: { notBefore?: unknown; notAfter?: unknown } | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 128).replace(/\p{Cc}/gu, ' ').trim() : '');

/** Every time the file records, each with the place it was read from, so a disagreement shows. */
export function recordedTimes(report: TimesReport, meta: FileMetadata | undefined): RecordedTime[] {
  const out: RecordedTime[] = [];
  for (const field of (meta?.fields ?? []).slice(0, 512)) {
    if (field.group !== 'timestamps') continue;
    const value = str(field.value);
    if (value) out.push({ label: str(field.label), value, source: str(field.source) || `${meta?.format ?? ''} ${field.label}`.trim() });
  }
  for (const action of (report.claim?.actions ?? []).slice(0, 64)) {
    const when = str(action.when);
    if (when) out.push({ label: str(action.action).replace(/^c2pa\./, '') || 'action', value: when, source: 'Content Credential action' });
  }
  const from = str(report.signer?.notBefore), to = str(report.signer?.notAfter);
  if (from) out.push({ label: 'Certificate valid from', value: from, source: 'Signer certificate' });
  if (to) out.push({ label: 'Certificate valid to', value: to, source: 'Signer certificate' });
  return out.slice(0, 96);
}

/** The findings as a reader would paste them into a report: filled words, no markup. */
export function findingsJson(fileName: string, findings: readonly VerifyFinding[]): string {
  const fill = (text: string, vars: Record<string, string | number>): string => text.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
  return JSON.stringify({
    file: fileName,
    findings: findings.map((f) => ({ id: f.id, state: f.state, strength: f.strength, word: fill(f.word, f.vars), detail: fill(f.detail, f.vars), names: f.names, evidence: f.evidence })),
  }, null, 2);
}

const extensionOf = (name: string): string => /\.([a-z0-9]{1,8})$/i.exec(name)?.[1]?.toLowerCase() ?? '';
const SAME_TYPE: Record<string, string> = { jpg: 'jpeg', jpe: 'jpeg', tif: 'tiff', htm: 'html', m4v: 'mp4', mov: 'mp4', m4a: 'mp4', apng: 'png', markdown: 'md', psb: 'psd' };

/** The switch and the block Evidence adds, for the head of the findings column. */
export function evidenceHeadHtml(findings: readonly VerifyFinding[], report: TimesReport & { format?: string | null }, meta: FileMetadata | undefined, fileName: string, fileIndex: number): string {
  const depth = readDepth();
  const times = recordedTimes(report, meta);
  const ext = extensionOf(fileName);
  const read = report.format ?? '';
  const differs = !!ext && !!read && (SAME_TYPE[ext] ?? ext) !== read;
  return `<div class="ve-head">
    ${segHtml('verify-depth', [{ id: 'summary', label: t('Summary') }, { id: 'evidence', label: t('Evidence') }], depth, t('How much to show'), { attr: 'data-verify-depth' })}
  </div>
  <section class="ve-extra" data-evidence-only data-evidence-file="${fileIndex}" aria-label="${esc(t('The file'))}"${depth === 'evidence' ? '' : ' hidden'}>
    <dl class="ve-facts">
      <div><dt>${t('File')}</dt><dd>${esc(fileName)}</dd></div>
      <div><dt>${t('Size')}</dt><dd data-evidence-size>${t('Not read yet')}</dd></div>
      <div><dt>${t('Type read from the bytes')}</dt><dd>${esc(read || t('Not recognised'))}${differs ? `<span class="ve-note">${esc(tRaw('The name ends in .{ext}', { ext }))}</span>` : ''}</dd></div>
      <div class="ve-wide"><dt>SHA-256</dt><dd><code data-evidence-sha>${t('Not read yet')}</code></dd></div>
    </dl>
    ${times.length ? `<h4 class="ve-title">${icon('clock')}<span>${t('Times the file records')}</span></h4>
    <table class="ve-times"><tbody>${times.map((row) => `<tr><th scope="row">${esc(row.label)}</th><td><code>${esc(row.value)}</code></td><td>${esc(row.source)}</td></tr>`).join('')}</tbody></table>` : ''}
    <p class="ve-actions"><button type="button" class="btn" data-copy-evidence="${esc(findingsJson(fileName, findings))}" data-copy-done="${esc(t('Findings copied'))}">${icon('duplicate')}<span>${t('Copy findings as JSON')}</span></button></p>
  </section>`;
}

const hex = (bytes: ArrayBuffer): string => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sizeWords = (n: number): string => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`) + ` (${n.toLocaleString('en')} bytes)`;

/** Fill in the size and the hash of one file's Evidence block. Read once, on this device. */
async function fillIdentity(block: HTMLElement, file: File): Promise<void> {
  if (block.dataset.evidenceFilled) return;
  block.dataset.evidenceFilled = 'true';
  const size = block.querySelector<HTMLElement>('[data-evidence-size]');
  if (size) size.textContent = sizeWords(file.size);
  const sha = block.querySelector<HTMLElement>('[data-evidence-sha]');
  if (!sha) return;
  try {
    sha.textContent = hex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
  } catch {
    sha.textContent = t('Could not be read');
    delete block.dataset.evidenceFilled;
  }
}

/** Put every report under `root` at one depth. Evidence opens each disclosure; Summary closes the ones it opened. */
export function applyDepth(root: HTMLElement, depth: VerifyDepth, fileAt: (index: number) => File | undefined): void {
  syncSeg(root, depth, 'data-verify-depth');
  for (const result of root.querySelectorAll<HTMLElement>('.valid-result')) {
    if (result.dataset.vfDepth === depth) continue;
    // A report starts with the raw metadata closed in Summary: the sections above already say what matters.
    if (!result.dataset.vfDepth && depth === 'summary') result.querySelectorAll<HTMLDetailsElement>('.vf-column details.valid-meta[open]').forEach((d) => { d.open = false; });
    result.dataset.vfDepth = depth;
    for (const block of result.querySelectorAll<HTMLElement>('[data-evidence-only]')) {
      block.hidden = depth !== 'evidence';
      const file = depth === 'evidence' ? fileAt(Number(block.dataset.evidenceFile)) : undefined;
      if (file) void fillIdentity(block, file);
    }
    for (const details of result.querySelectorAll<HTMLDetailsElement>('.vf-column details')) {
      if (depth === 'evidence' && !details.open) { details.open = true; details.dataset.vfOpened = 'true'; }
      else if (depth === 'summary' && details.dataset.vfOpened) { details.open = false; delete details.dataset.vfOpened; }
    }
  }
}

/**
 * Wire the parts of a report that need the file or the clipboard: previews,
 * address requests, the copy buttons, the depth switch and the waveform of a
 * sound file.
 */
export function wireReportParts(root: HTMLElement, host: Pick<HostV1, 'clipboard' | 'audio'>, fileAt: (index: number) => File | undefined): void {
  wireVerifyPreviews(root, fileAt);
  wireAddressRequests(root);
  wireStageAudio(root);
  wireHelpTips(root);
  root.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-copy-evidence]') : null;
    if (!button) return;
    host.clipboard.writeText(button.dataset.copyEvidence ?? '')
      .then(() => announce(button.dataset.copyDone ?? t('Link copied')), () => announce(t('Could not copy link')));
  });
  wireSeg(root, {
    attr: 'data-verify-depth',
    onChange: (value) => {
      const depth: VerifyDepth = value === 'evidence' ? 'evidence' : 'summary';
      writeDepth(depth);
      applyDepth(root, depth, fileAt);
      announce(depth === 'evidence' ? t('Evidence: every section is open.') : t('Summary: sections are closed.'));
    },
  });
  // A report drawn after the choice was made takes the same depth.
  // Reports are drawn into a list under the root, so the whole subtree is watched;
  // one pass per burst of changes, and each step skips what it has already done.
  let queued = false;
  const settle = (): void => { queued = false; applyDepth(root, readDepth(), fileAt); mountStageAudio(root, host, fileAt); };
  const later = (): void => { if (!queued) { queued = true; queueMicrotask(settle); } };
  if (typeof MutationObserver === 'function') new MutationObserver(later).observe(root, { childList: true, subtree: true });
  settle();
}
