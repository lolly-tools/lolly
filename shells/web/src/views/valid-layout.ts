// SPDX-License-Identifier: MPL-2.0
/**
 * Verify's report body: two columns of ranked sections under the answer.
 *
 * The left column is about what is in the file: the asset on its stage, then
 * AI, personal data and hidden content, so a finding that draws on the asset
 * sits right under the asset. The right column is about where the file came
 * from: its licence, what made the file, and its credential. Under 1024px the
 * two columns follow one another.
 *
 * Every section has the same head: an icon, a title and a help tip. The tip
 * holds the explanation a first-time reader needs, so the page itself stays
 * short for someone who reads these every day. Under the head comes the
 * finding's one sentence, then the detail.
 */
import type { VerifyFinding, VerifyFindingId } from '@lolly/engine';
import '../styles/parts/valid-layout.css';
import { escape as esc } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { icon, type IconName } from '../lib/icons.ts';
import { helpTip } from '../components/help-tip.ts';

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

/**
 * One section of the report. `body` is markup the caller built; a section with
 * no body still shows its sentence, so "nothing found" is a visible answer.
 */
export function sectionHtml(finding: VerifyFinding, body: string, opts: { lede?: boolean } = {}): string {
  const copy = SECTION[finding.id];
  const tip = helpTip(t(copy.tip));
  return `<section class="vs help-tip-host is-${finding.tone}" data-finding-section="${finding.id}" aria-label="${esc(t(copy.title))}">
    <h3 class="vs-head">${icon(copy.icon)}<span>${t(copy.title)}</span>${tip.button}</h3>${tip.pop}
    ${opts.lede === false ? '' : `<p class="vs-lede">${esc(findingSentence(finding))}</p>`}
    ${body.trim() ? `<div class="vs-body">${body}</div>` : ''}
  </section>`;
}

/** The markup the view has already built, by where it belongs. */
export interface ReportParts {
  stage: string;
  /** The Summary and Evidence switch with the block Evidence adds. */
  depth: string;
  licence: string;
  madeWith: string;
  ai: string;
  personal: string;
  credential: string;
  hidden: string;
  /** Checks on the pixels and the sound: deep scan, Imprint, seal. */
  marks: string;
  /** What ran, what did not, and the on-device note. */
  receipt: string;
}

/** The two columns. `findings` must hold all six, in the engine's order. */
export function reportBodyHtml(findings: readonly VerifyFinding[], parts: ReportParts): string {
  const by = (id: VerifyFindingId): VerifyFinding => findings.find((f) => f.id === id)!;
  return `<div class="vf-body">
    <div class="vf-column vf-col-asset">
      ${parts.stage}
      ${sectionHtml(by('ai'), parts.ai)}
      ${sectionHtml(by('personal'), parts.personal)}
      ${sectionHtml(by('hidden'), parts.hidden + parts.marks)}
    </div>
    <div class="vf-column vf-col-origin">
      ${parts.depth}
      ${parts.licence}
      ${sectionHtml(by('made-with'), parts.madeWith)}
      ${sectionHtml(by('credential'), parts.credential)}
      ${parts.receipt}
    </div>
  </div>`;
}
