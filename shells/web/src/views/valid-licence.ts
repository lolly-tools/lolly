// SPDX-License-Identifier: MPL-2.0
/**
 * Verify's licence band: the terms a file declares, first in the findings column.
 *
 * It reports what the file states and where each statement was found. It never
 * says the terms are true or that a use is permitted: every band ends with
 * "Declared terms. Permission to reuse is not verified." Two statements that
 * name different licences are listed side by side and never merged. NonCommercial
 * and NoDerivatives are named as stated conditions and are not interpreted.
 */
import { licenceDisplayName, licenceProfile, normaliseLicence, publicLocator, verifyRights } from '@lolly/engine';
import type { FileMetadata, VerifyFindingsReport, VerifyRights, VerifyStrength } from '@lolly/engine';
import '../styles/parts/valid-licence.css';
import { escape as esc } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { metadataLinkHtml } from './valid-links.ts';
import { rowStrengthHtml } from './valid-vendors.ts';
import { sectionHeadHtml } from './valid-layout.ts';

/** One plain sentence per licence element. The last two are named and not interpreted. */
const CONDITION: Record<string, string> = {
  Attribution: 'Credit the creator.',
  ShareAlike: 'Share adaptations under the same licence.',
  NoticeRetention: 'Keep the licence notice with copies.',
  ReservedFontName: 'Do not reuse a reserved font name.',
  NonCommercial: 'NonCommercial is a stated condition.',
  NoDerivatives: 'NoDerivatives is a stated condition.',
};

export interface LicenceStatement {
  /** The licence's display name when known, else the statement as recorded. */
  name: string;
  id: string | null;
  /** A public address for the licence text, when one is known or was recorded. */
  url: string;
  /** Creative Commons element marks, in the licence's own order. */
  marks: string[];
  conditions: string[];
  /** A reviewed profile covers this licence. False means the conditions are recorded and not interpreted. */
  reviewed: boolean;
  /** A credit is welcome and is not a condition (a dedication or a public domain mark). */
  courtesyCredit: boolean;
  where: Array<{ source: string; strength: VerifyStrength }>;
}

export interface LicenceBand {
  state: 'none' | 'stated' | 'disagree';
  statements: LicenceStatement[];
  creator: string;
  credit: string;
  /** Licences the file's recorded sources carry, with how many sources carry each. */
  sources: Array<{ name: string; count: number }>;
  sourceCount: number;
  /** A line a reader can paste where the work is used, or '' when no licence is known. */
  creditLine: string;
}

type BandReport = VerifyFindingsReport & { title?: unknown };

const clean = (value: unknown): string => (typeof value === 'string' ? value.slice(0, 512).replace(/\p{Cc}/gu, ' ').trim() : '');

function ccMarks(id: string | null): string[] {
  if (!id) return [];
  if (id === 'CC0-1.0') return ['0'];
  if (id === 'CC-PDDC') return ['PD'];
  const m = /^CC-(BY)(?:-(NC))?(?:-(SA|ND))?-\d/.exec(id);
  return m ? [m[1]!, m[2], m[3]].filter((x): x is string => !!x) : [];
}

function statement(right: VerifyRights): LicenceStatement {
  const profile = licenceProfile(right.id);
  return {
    name: right.name,
    id: right.id,
    url: publicLocator(profile?.url ?? right.url ?? ''),
    marks: ccMarks(right.id),
    conditions: profile?.conditions ?? [],
    reviewed: !!profile?.reviewed,
    courtesyCredit: !!profile?.courtesyCredit,
    where: right.evidence.map((e) => ({ source: e.source, strength: e.strength })),
  };
}

const CREATOR_LABEL = /^(?:Author|Artist|Creator|By-line)$/;
const CREDIT_LABEL = /^Credit(?: line)?$/;

/** The band's model: what is declared, where, and by whom. Pure. */
export function licenceBand(report: BandReport, meta: FileMetadata | undefined, fileName = ''): LicenceBand {
  const rights = verifyRights(report, meta);
  // Known licences lead; a free-text statement that sits beside one stays listed after.
  const statements = [...rights.filter((r) => r.id), ...rights.filter((r) => !r.id)].map(statement);
  const known = new Set(statements.filter((s) => s.id).map((s) => s.id));
  const fields = meta?.fields ?? [];
  const creator = clean(report.licence?.attributionName) || clean(fields.find((f) => CREATOR_LABEL.test(f.label))?.value);
  const credit = clean(report.licence?.credit) || clean(fields.find((f) => CREDIT_LABEL.test(f.label))?.value);
  const counts = new Map<string, number>();
  let sourceCount = 0;
  for (const ingredient of (report.ingredients ?? []).slice(0, 256)) {
    const declared = clean(ingredient.rights?.license);
    if (!declared) continue;
    sourceCount++;
    const normal = normaliseLicence(declared);
    const name = normal.id ? licenceDisplayName(normal.id) : declared;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const lead = statements[0];
  const title = clean(report.title) || fileName;
  const creditLine = lead?.id && known.size === 1
    ? [title && creator ? `${title} by ${creator}.` : creator ? `By ${creator}.` : title ? `${title}.` : '', `${lead.name}${lead.url ? ` (${lead.url})` : ''}`].filter(Boolean).join(' ')
    : '';
  return {
    state: !statements.length ? 'none' : known.size > 1 ? 'disagree' : 'stated',
    statements,
    creator,
    credit,
    sources: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1)),
    sourceCount,
    creditLine,
  };
}

const marksHtml = (marks: readonly string[]): string => marks.length
  ? `<span class="vl-marks" aria-hidden="true">${marks.map((m) => `<span class="vl-mark">${esc(m)}</span>`).join('')}</span>` : '';

const RANK: readonly VerifyStrength[] = ['signed', 'unverified', 'stated', 'hint', 'estimated'];

/** The strongest evidence any statement rests on. */
export function bandStrength(band: LicenceBand): VerifyStrength {
  const found = band.statements.flatMap((s) => s.where.map((w) => w.strength));
  return RANK.find((s) => found.includes(s)) ?? 'none';
}

/** Where a statement was found. A source that matches the answer slot shows its strength only at Evidence depth. */
function whereHtml(s: LicenceStatement, stated: VerifyStrength): string {
  return `<ul class="vl-where" aria-label="${esc(t('Where this was found'))}">${s.where.slice(0, 8).map((w) => `<li>${rowStrengthHtml(w.strength, stated)}<span class="vl-source">${esc(w.source)}</span></li>`).join('')}</ul>`;
}

function statementHtml(s: LicenceStatement, stated: VerifyStrength): string {
  const conditions = s.conditions.map((c) => CONDITION[c]).filter((c): c is string => !!c);
  return `<div class="vl-statement">
    <p class="vl-name">${marksHtml(s.marks)}<strong>${esc(s.name.length > 160 ? `${s.name.slice(0, 157)}…` : s.name)}</strong></p>
    ${conditions.length ? `<ul class="vl-conditions">${conditions.map((c) => `<li>${t(c)}</li>`).join('')}</ul>` : ''}
    ${s.id && !s.reviewed ? `<p class="vl-quiet">${t('Lolly records these conditions and does not interpret them.')}</p>` : ''}
    ${s.courtesyCredit ? `<p class="vl-quiet">${t('A credit is welcome and is not a condition.')}</p>` : ''}
    ${whereHtml(s, stated)}
    ${s.url ? `<p class="vl-link">${metadataLinkHtml(s.url, t('Read the licence'))}</p>` : ''}
  </div>`;
}

/**
 * The band, first in the findings column. Always drawn, so an absence is visible.
 * `slot` is the strength the Licence answer slot states. The heading repeats a
 * strength only when the band's differs from the slot's, or when no slot is given.
 */
export function licenceBandHtml(report: BandReport, meta: FileMetadata | undefined, fileName = '', slot?: VerifyStrength): string {
  const band = licenceBand(report, meta, fileName);
  const own = bandStrength(band);
  const stated = slot ?? own;
  const head = sectionHeadHtml('licence', slot === own ? 'none' : own);
  const sources = band.sourceCount
    ? `<p class="vl-sources">${esc(tRaw(band.sourceCount === 1 ? '1 source: {list}' : '{n} sources: {list}', { n: band.sourceCount, list: band.sources.map((s) => `${s.count} ${s.name}`).join(', ') }))}</p>` : '';
  if (band.state === 'none') {
    return `<section class="vl-band vs help-tip-host is-none" data-finding-section="licence" aria-label="${esc(t('Licence'))}">${head}
      <p class="vl-quiet">${t('No licence recorded. That does not mean free to use.')}</p>${sources}</section>`;
  }
  const who = band.creator || band.credit
    ? `<dl class="vl-who">${band.creator ? `<div><dt>${t('Creator')}</dt><dd>${esc(band.creator)}</dd></div>` : ''}${band.credit ? `<div><dt>${t('Credit line')}</dt><dd>${esc(band.credit)}</dd></div>` : ''}</dl>` : '';
  return `<section class="vl-band vs help-tip-host is-${band.state}" data-finding-section="licence" aria-label="${esc(t('Licence'))}">${head}
    ${band.state === 'disagree' ? `<p class="vl-disagree">${t('Two statements disagree. Each is listed as recorded.')}</p>` : ''}
    <div class="vl-statements">${band.statements.slice(0, 6).map((s) => statementHtml(s, stated)).join('')}</div>
    ${who}${sources}
    ${band.creditLine ? `<p class="vl-actions"><button type="button" class="btn" data-copy-evidence="${esc(band.creditLine)}" data-copy-done="${esc(t('Credit line copied'))}">${icon('duplicate')}<span>${t('Copy credit line')}</span></button></p>` : ''}
    <p class="vl-quiet">${t('Declared terms. Permission to reuse is not verified.')}</p>
  </section>`;
}
