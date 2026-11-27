// SPDX-License-Identifier: MPL-2.0
/**
 * Verify's report body: two columns of ranked sections under the answer.
 *
 * The left column is about what is in the file: the asset on its stage, then
 * AI, personal data and hidden content, so a finding that draws on the asset
 * sits right under the asset. The right column is about where the file came
 * from: its licence, what made the file, and its credential. Under 1024px the
 * two columns follow one another. The Summary and Evidence switch comes first,
 * level with the stage's own switch.
 *
 * Every section has the same head: an icon, a title, a help tip and how strong
 * the evidence is, stated once. The answer row above already gives each finding
 * in words, so a section leads with its evidence. The finding's sentence stays
 * only where nothing else in the section would say what was found.
 */
import type { VerifyFinding, VerifyFindingId, VerifyStrength } from '@lolly/engine';
import '../styles/parts/valid-layout.css';
import { escape as esc } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { icon, type IconName } from '../lib/icons.ts';
import { helpTip } from '../components/help-tip.ts';
import { strengthHtml } from './valid-vendors.ts';
import { aiRowHtml, evidenceRowsHtml, pixelCheckRowsHtml, type AiRowInput, type PixelChecks } from './valid-rows.ts';

export { offerDeepScan } from './valid-rows.ts';

interface SectionCopy { title: string; icon: IconName; tip: string }

/** One title, icon and explanation per finding. The explanation lives behind the help tip. */
export const SECTION: Record<VerifyFindingId, SectionCopy> = {
  credential: { title: 'Credential', icon: 'seal', tip: 'A Content Credential is a signed record inside the file. Signed means the bytes match what was signed. It shows who signed only when a recognised authority vouches for the signer.' },
  'made-with': { title: 'Made with', icon: 'tool', tip: 'The software and devices the file records. Metadata and hints can be edited, and software used earlier may still be listed.' },
  ai: { title: 'AI', icon: 'aiSpark', tip: 'A declaration in the metadata is real when present and easy to strip, so its absence shows nothing. Large AI makers also stamp invisible marks into pixels or sound that only they can read. Writing and design clues are checked on this device and are clues, not proof.' },
  licence: { title: 'Licence', icon: 'badgeCheck', tip: 'What the file states about its terms and where each statement was found. Lolly reports the statement and does not check permission.' },
  personal: { title: 'Personal data', icon: 'user', tip: 'Read from metadata that anyone can edit. The map is drawn on this device, and nothing is sent until you ask for an address. A link found in a file is unverified: review the address before opening.' },
  hidden: { title: 'Hidden content', icon: 'eye', tip: 'Data in the file that a viewer does not show: appended bytes, text covered by shapes, invisible characters.' },
};

/** The finding's one sentence, with its values filled in. */
export const findingSentence = (finding: VerifyFinding): string => tRaw(finding.detail, finding.vars);

/** A section's head: icon, title, help tip, then the strength of its evidence, once. */
export function sectionHeadHtml(id: VerifyFindingId, strength: VerifyStrength = 'none'): string {
  const copy = SECTION[id];
  const tip = helpTip(t(copy.tip));
  return `<h3 class="vs-head">${icon(copy.icon)}<span>${t(copy.title)}</span>${tip.button}${strengthHtml(strength)}</h3>${tip.pop}`;
}

/** Findings whose section draws no evidence of its own, so the sentence is the detail. */
const SENTENCE_STAYS = new Set(['credential:made-here', 'credential:seal', 'credential:imprint', 'made-with:lolly-imprint', 'ai:watermark']);

/**
 * One section of the report. `body` is markup the caller built. The finding's
 * sentence shows when the finding is an absence, when its section draws no
 * evidence, or when there is no body, so "nothing found" is a visible answer.
 */
export function sectionHtml(finding: VerifyFinding, body: string): string {
  const sentence = finding.tone === 'quiet' || !body.trim() || SENTENCE_STAYS.has(`${finding.id}:${finding.state}`);
  return `<section class="vs help-tip-host is-${finding.tone}" data-finding-section="${finding.id}" aria-label="${esc(t(SECTION[finding.id].title))}">
    ${sectionHeadHtml(finding.id, finding.strength)}
    ${sentence ? `<p class="vs-lede">${esc(findingSentence(finding))}</p>` : ''}
    ${body.trim() ? `<div class="vs-body">${body}</div>` : ''}
  </section>`;
}

/** The markup the view has already built, by where it belongs. */
export interface ReportParts {
  stage: string;
  /** The Summary and Evidence switch. */
  depth: string;
  /** The block Evidence adds: the file's size, type, hash and recorded times. */
  file: string;
  licence: string;
  madeWith: string;
  /** What the file declares about AI, for the section's first row. */
  aiDeclared: AiRowInput;
  ai: string;
  personal: string;
  credential: string;
  hidden: string;
  /** What was read from the pixels and the sound: watermark, Imprint, seal. */
  marks: string;
  /** The checks a reader can start on this file's pixels. */
  checks: PixelChecks;
  /** What ran, what did not, and the on-device note. */
  receipt: string;
}

/** The switch, then the two columns. `findings` must hold all six, in the engine's order. */
export function reportBodyHtml(findings: readonly VerifyFinding[], parts: ReportParts): string {
  const by = (id: VerifyFindingId): VerifyFinding => findings.find((f) => f.id === id)!;
  const ai = by('ai'), personal = by('personal'), hidden = by('hidden');
  // A personal detail the report already shows elsewhere is not listed again.
  const personalRows = evidenceRowsHtml(personal.evidence.filter((e) => !(e.label === 'Coordinates' && parts.personal.includes('data-request-address'))), personal.strength, parts.licence + parts.madeWith + parts.personal);
  const hiddenRows = evidenceRowsHtml(hidden.evidence.filter((e) => !(e.label === 'Appended data' && parts.hidden.trim())), hidden.strength);
  return `<div class="vf-body">
    ${parts.depth}
    <div class="vf-column vf-col-asset">
      ${parts.stage}
      ${sectionHtml(ai, aiRowHtml(parts.aiDeclared, ai.strength) + parts.ai)}
      ${sectionHtml(personal, personalRows + parts.personal)}
      ${sectionHtml(hidden, hiddenRows + parts.hidden + parts.marks + pixelCheckRowsHtml(parts.checks))}
    </div>
    <div class="vf-column vf-col-origin">
      ${parts.file}
      ${parts.licence}
      ${sectionHtml(by('made-with'), parts.madeWith)}
      ${sectionHtml(by('credential'), parts.credential)}
      ${parts.receipt}
    </div>
  </div>`;
}
