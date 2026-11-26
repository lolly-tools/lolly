// SPDX-License-Identifier: MPL-2.0
/**
 * Verify's answer: six findings in one fixed order, each a button that opens
 * its sentence and evidence and leads to the section that holds the detail.
 * The model is the engine's `verifyFindings`, so every shell gives the same answer.
 */
import { verifyFindings } from '@lolly/engine';
import type { FileMetadata, VerifyFinding, VerifyFindingId, VerifyFindingsInput, VerifyStrength } from '@lolly/engine';
import '../styles/parts/valid-findings.css';
import { escape as esc } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { icon, type IconName } from '../lib/icons.ts';
import { vendorMark } from './valid-vendors.ts';
import { metadataValueHtml } from './valid-links.ts';
import type { VerifyReport, Watermark } from './valid-verdict.ts';
import type { TextSignalPanel } from './valid-text.ts';

const SLOT: Record<VerifyFindingId, { label: string; icon: IconName; section: string }> = {
  credential: { label: 'Credential', icon: 'seal', section: '[data-finding-section="credential"]' },
  'made-with': { label: 'Made with', icon: 'tool', section: '.valid-origin-software' },
  ai: { label: 'AI', icon: 'aiSpark', section: '[data-finding-section="ai"]' },
  licence: { label: 'Licence', icon: 'badgeCheck', section: '.valid-origin-rights' },
  personal: { label: 'Personal data', icon: 'user', section: '.valid-meta, [data-finding-section="personal"]' },
  hidden: { label: 'Hidden content', icon: 'eye', section: '.valid-payload, [data-finding-section="hidden"]' },
};

const STRENGTH: Record<VerifyStrength, string> = {
  signed: 'Signed',
  unverified: 'Credential, not verified',
  stated: 'Stated in the file',
  hint: 'Hint',
  estimated: 'Estimated on this device',
  none: '',
};

export interface FindingsExtras {
  watermark?: Watermark | undefined;
  seal?: { found?: boolean; valid?: boolean } | undefined;
  madeHere?: boolean;
  textSignals?: TextSignalPanel | undefined;
}

/** The engine's input from what the view already holds for one file. */
export function findingsInput(report: VerifyReport, meta: FileMetadata | undefined, extras: FindingsExtras = {}): VerifyFindingsInput {
  const panel = extras.textSignals;
  return {
    report,
    meta,
    madeHere: !!extras.madeHere,
    imprint: !!extras.watermark?.present,
    seal: extras.seal ? { found: !!extras.seal.found, valid: !!extras.seal.valid } : undefined,
    text: panel ? {
      band: panel.band,
      signals: panel.rows.length,
      artifacts: panel.rows.filter((row) => row.tier === 'artifact').length,
      invisible: (panel.facts?.hidden ?? []).length,
      fromPixels: panel.pixelSourced,
      ...(panel.guessConfidence === 'high' && panel.guessFamily ? { family: panel.guessFamily } : {}),
    } : undefined,
  };
}

export function findingsFor(report: VerifyReport, meta: FileMetadata | undefined, extras: FindingsExtras = {}): VerifyFinding[] {
  return verifyFindings(findingsInput(report, meta, extras));
}

const word = (finding: VerifyFinding): string => tRaw(finding.word, finding.vars);
const sentence = (finding: VerifyFinding): string => tRaw(finding.detail, finding.vars);

/** Marks for the products a finding names. A mark identifies a product and says nothing about the claim. */
function marksHtml(finding: VerifyFinding): string {
  if (finding.id !== 'made-with' && finding.id !== 'ai' && finding.id !== 'credential') return '';
  // Only a mark that identifies the product is drawn here; an unknown name stays words.
  return finding.names.slice(0, 3).map((name) => vendorMark(name))
    .filter((mark, i) => mark.includes('data-vendor=') || /\blolly\b/i.test(finding.names[i]!))
    .map((mark) => `<span class="vf-mark">${mark}</span>`).join('');
}

function slotHtml(finding: VerifyFinding, fileIndex: number): string {
  const slot = SLOT[finding.id];
  const strength = STRENGTH[finding.strength];
  return `<li><button type="button" class="vf-slot is-${finding.tone}" data-finding="${finding.id}" data-finding-state="${esc(finding.state)}" aria-expanded="false" aria-controls="vf-detail-${fileIndex}">
    <span class="vf-slot-label">${icon(slot.icon)}<span>${t(slot.label)}</span></span>
    <span class="vf-slot-word">${marksHtml(finding)}<strong>${esc(word(finding))}</strong></span>
    ${strength ? `<span class="vf-slot-strength is-${finding.strength}">${t(strength)}</span>` : ''}
  </button></li>`;
}

function detailHtml(finding: VerifyFinding): string {
  const rows = finding.evidence.slice(0, 12);
  return `<div class="vf-detail-pane" data-finding-pane="${finding.id}" hidden>
    <p class="vf-detail-sentence">${esc(sentence(finding))}</p>
    ${rows.length ? `<dl class="vf-evidence">${rows.map((e) => `<div><dt>${esc(t(e.label))}</dt><dd>${metadataValueHtml(e.value)}</dd><dd class="vf-evidence-source"><span class="vf-slot-strength is-${e.strength}">${t(STRENGTH[e.strength])}</span>${esc(e.source)}</dd></div>`).join('')}</dl>` : ''}
    <button type="button" class="btn vf-detail-jump" data-finding-jump="${finding.id}">${icon('chevronDown')}<span>${t('Show the detail')}</span></button>
  </div>`;
}

/** The findings row and the one detail region its slots open. */
export function findingsHtml(findings: readonly VerifyFinding[], fileIndex: number): string {
  return `<div class="vf-findings" data-findings>
    <ul class="vf-slots">${findings.map((f) => slotHtml(f, fileIndex)).join('')}</ul>
    <div class="vf-detail" id="vf-detail-${fileIndex}" aria-live="polite">${findings.map(detailHtml).join('')}</div>
  </div>`;
}

/** Small glyphs for a collapsed file row, in the same slot order. */
export function findingsMiniHtml(findings: readonly VerifyFinding[]): string {
  return `<span class="vf-mini">${findings.filter((f) => f.tone !== 'quiet').map((f) => `<span class="vf-mini-slot is-${f.tone}" title="${esc(`${t(SLOT[f.id].label)}: ${word(f)}`)}">${icon(SLOT[f.id].icon)}</span>`).join('')}</span>`;
}

function openSection(target: HTMLElement): void {
  for (let el: HTMLElement | null = target; el; el = el.parentElement) {
    if (el instanceof HTMLDetailsElement) el.open = true;
  }
  const inner = target.matches('details') ? target : target.querySelector('details');
  if (inner instanceof HTMLDetailsElement) inner.open = true;
  target.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.a11yMotion === 'reduce' ? 'auto' : 'smooth' });
  target.classList.remove('vf-flash');
  void target.offsetWidth;
  target.classList.add('vf-flash');
}

export function wireFindings(root: HTMLElement): void {
  root.addEventListener('click', (event) => {
    const el = event.target instanceof Element ? event.target : null;
    const slot = el?.closest<HTMLButtonElement>('[data-finding]');
    const box = el?.closest<HTMLElement>('[data-findings]');
    if (slot && box) {
      const id = slot.dataset.finding!;
      const wasOpen = slot.getAttribute('aria-expanded') === 'true';
      box.querySelectorAll<HTMLElement>('[data-finding]').forEach((b) => { b.setAttribute('aria-expanded', String(b === slot && !wasOpen)); });
      box.querySelectorAll<HTMLElement>('[data-finding-pane]').forEach((pane) => { pane.hidden = wasOpen || pane.dataset.findingPane !== id; });
      return;
    }
    const jump = el?.closest<HTMLElement>('[data-finding-jump]');
    if (!jump) return;
    const result = jump.closest<HTMLElement>('.valid-result');
    const target = result?.querySelector<HTMLElement>(SLOT[jump.dataset.findingJump as VerifyFindingId].section);
    if (target) openSection(target);
  });
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const box = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-findings]') : null;
    const open = box?.querySelector<HTMLElement>('[data-finding][aria-expanded="true"]');
    if (!box || !open) return;
    open.setAttribute('aria-expanded', 'false');
    box.querySelectorAll<HTMLElement>('[data-finding-pane]').forEach((pane) => { pane.hidden = true; });
    open.focus();
  });
}
