// SPDX-License-Identifier: MPL-2.0
/**
 * Verify's Lolly block: what a credential records about a Lolly export, with
 * links back into the app.
 *
 * Every row is read from the credential's own export record and is drawn only
 * when the record holds the value. The heading keeps the report's honest middle
 * verdicts: made, likely made, or parts made.
 */
import { readDesignRecord } from '../../../../engine/src/metadata.ts';
import '../styles/parts/valid-lolly.css';
import { escape as esc, safeHref } from '../utils.ts';
import { docsHref, t, tRaw } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { LOLLY_MARK_SVG } from '../lib/lolly-mark.ts';
import { guidedByFact, madeWithFact, partnerFact } from '../lib/made-with.ts';
import { metadataLinkHtml } from './valid-links.ts';

export interface LollyBlockReport {
  madeWithLolly: boolean;
  likelyMadeWithLolly: boolean;
  partsMadeWithLolly: boolean;
  environment?: Readonly<Record<string, unknown>> | null;
  ingredients?: ReadonlyArray<{ rights?: unknown }>;
}

export interface LollyBlockOptions {
  /** The recorded tool, when this catalog holds a tool of that id or name. */
  tool?: { toolId: string; toolName: string } | undefined;
  /** The Lolly Imprint was read from the pixels. */
  imprint?: boolean;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.slice(0, 256).replace(/\p{Cc}/gu, ' ').trim() : '');

/** A link to a docs page. The address is built here from a fixed slug, and still passes the scheme guard. */
function docsLink(slug: string, label: string): string {
  const href = docsHref(slug);
  // nosemgrep: lolly-href-escape-is-not-scheme-validation - docsHref() builds this address from a fixed slug, and safeHref() has passed the result
  return safeHref(href) ? `<a class="vlb-link" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>` : esc(label);
}

const row = (label: string, body: string): string => `<div><dt>${t(label)}</dt><dd>${body}</dd></div>`;

/** The block, or '' when the credential does not record a Lolly export. */
export function lollyBlockHtml(report: LollyBlockReport, opts: LollyBlockOptions = {}): string {
  if (!report.madeWithLolly && !report.likelyMadeWithLolly && !report.partsMadeWithLolly) return '';
  const env = report.environment ?? {};
  const heading = report.madeWithLolly ? t('Made with Lolly') : report.likelyMadeWithLolly ? t('Likely made with Lolly') : t('Parts made with Lolly');
  const recorded = text(env.tool);
  const version = text(env.toolVersion);
  const rows: string[] = [];
  if (opts.tool) {
    rows.push(row('Tool', `<a class="vlb-link" href="#/tool/${esc(opts.tool.toolId)}">${icon('tool')}<span>${esc(opts.tool.toolName)}</span></a>${version ? `<span class="vlb-quiet">${esc(version)}</span>` : ''}`));
  } else if (recorded) {
    rows.push(row('Tool', `<span>${esc(recorded)}</span>${version ? `<span class="vlb-quiet">${esc(version)}</span>` : ''}<span class="vlb-quiet">${t('Not in this catalogue.')}</span><a class="vlb-link" href="#/tools">${t('Explore the tools here')}</a>`));
  }
  const system = madeWithFact(env);
  const page = readDesignRecord(env)?.brandPage;
  if (system) rows.push(row('Design system', `<span>${esc(system)}</span>${page ? metadataLinkHtml(page, t('Brand page')) : ''}`));
  const partner = partnerFact(env);
  if (partner) rows.push(row('Partner', `<span>${esc(partner)}</span>`));
  const guided = guidedByFact(env);
  if (guided) rows.push(row('Guided by', `<span>${esc(guided)}</span>`));
  const credited = (report.ingredients ?? []).filter((i) => !!i.rights).length;
  const features = [
    opts.imprint ? { label: t('Lolly Imprint read from the pixels'), slug: 'content-credentials-engineering' } : null,
    credited ? { label: tRaw(credited === 1 ? 'Credits for 1 source' : 'Credits for {n} sources', { n: credited }), slug: 'creative-rights' } : null,
    { label: t('What Verify checks'), slug: 'what-verify-checks' },
  ].filter((f): f is { label: string; slug: string } => !!f);
  return `<section class="vlb" data-finding-section="lolly" aria-label="${esc(heading)}">
    <h3 class="vlb-head"><span class="vlb-mark" aria-hidden="true">${LOLLY_MARK_SVG}</span><span>${esc(heading)}</span></h3>
    ${rows.length ? `<dl class="vlb-rows">${rows.join('')}</dl>` : ''}
    <ul class="vlb-features">${features.map((f) => `<li>${docsLink(f.slug, f.label)}</li>`).join('')}</ul>
  </section>`;
}
