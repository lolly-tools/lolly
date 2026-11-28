// SPDX-License-Identifier: MPL-2.0
/**
 * Verify's answer: six findings in one fixed order, each a button that opens
 * its sentence and evidence and leads to the section that holds the detail.
 * The model is the engine's `verifyFindings`, so every shell gives the same answer.
 */
import { verifyFindings } from '@lolly/engine';
import type { FileMetadata, VerifyFinding, VerifyFindingId, VerifyFindingsInput } from '@lolly/engine';
import '../styles/parts/valid-findings.css';
import { escape as esc } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { icon, type IconName } from '../lib/icons.ts';
import { strengthHtml, vendorMark } from './valid-vendors.ts';
import type { VerifyReport, Watermark } from './valid-verdict.ts';
import type { TextSignalPanel } from './valid-text.ts';
import { showOnStage, wireStage } from './valid-stage.ts';

const SLOT: Record<VerifyFindingId, { label: string; icon: IconName }> = {
  credential: { label: 'Credential', icon: 'seal' },
  'made-with': { label: 'Made with', icon: 'tool' },
  ai: { label: 'AI', icon: 'aiSpark' },
  licence: { label: 'Licence', icon: 'badgeCheck' },
  personal: { label: 'Personal data', icon: 'user' },
  hidden: { label: 'Hidden content', icon: 'eye' },
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

/** Marks for the products a finding names. A mark identifies a product and says nothing about the claim. */
function marksHtml(finding: VerifyFinding): string {
  if (finding.id !== 'made-with' && finding.id !== 'ai' && finding.id !== 'credential') return '';
  // Only a mark that identifies the product is drawn here; an unknown name stays words.
  return finding.names.slice(0, 3).map((name) => vendorMark(name))
    .filter((mark, i) => mark.includes('data-vendor=') || /\blolly\b/i.test(finding.names[i]!))
    .map((mark) => `<span class="vf-mark">${mark}</span>`).join('');
}

function slotHtml(finding: VerifyFinding): string {
  const slot = SLOT[finding.id];
  return `<li><button type="button" class="vf-slot is-${finding.tone}" data-finding="${finding.id}" data-finding-state="${esc(finding.state)}" title="${esc(tRaw(finding.detail, finding.vars))}">
    <span class="vf-slot-label">${icon(slot.icon)}<span>${t(slot.label)}</span></span>
    <span class="vf-slot-word">${marksHtml(finding)}<strong>${esc(word(finding))}</strong></span>
    ${strengthHtml(finding.strength)}
  </button></li>`;
}

/** The findings row. A slot leads to its section in the report and shows the finding on the asset. */
export function findingsHtml(findings: readonly VerifyFinding[]): string {
  return `<div class="vf-findings" data-findings><ul class="vf-slots">${findings.map(slotHtml).join('')}</ul></div>`;
}

/** Small glyphs for a collapsed file row, in the same slot order. */
export function findingsMiniHtml(findings: readonly VerifyFinding[]): string {
  return `<span class="vf-mini">${findings.filter((f) => f.tone !== 'quiet').map((f) => `<span class="vf-mini-slot is-${f.tone}" title="${esc(`${t(SLOT[f.id].label)}: ${word(f)}`)}">${icon(SLOT[f.id].icon)}</span>`).join('')}</span>`;
}

function openSection(target: HTMLElement, bringIntoView: HTMLElement = target): void {
  for (let el: HTMLElement | null = target; el; el = el.parentElement) {
    if (el instanceof HTMLDetailsElement) el.open = true;
  }
  const inner = target.matches('details') ? target : target.querySelector('details');
  if (inner instanceof HTMLDetailsElement) inner.open = true;
  bringIntoView.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.a11yMotion === 'reduce' ? 'auto' : 'smooth' });
  target.classList.remove('vf-flash');
  void target.offsetWidth;
  target.classList.add('vf-flash');
}

export function wireFindings(root: HTMLElement): void {
  // The findings drive the stage, so one call wires both.
  wireStage(root);
  root.addEventListener('click', (event) => {
    const slot = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-finding]') : null;
    const result = slot?.closest<HTMLElement>('.valid-result');
    if (!slot || !result) return;
    const id = slot.dataset.finding as VerifyFindingId;
    // A finding that draws on the asset brings the asset into view; any other leads to its section.
    const drawn = showOnStage(result, id);
    const target = result.querySelector<HTMLElement>(`[data-finding-section="${id}"]`);
    if (target) openSection(target, (drawn && result.querySelector<HTMLElement>('[data-stage]')) || target);
  });
}
