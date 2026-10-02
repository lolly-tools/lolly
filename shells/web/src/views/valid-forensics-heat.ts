// SPDX-License-Identifier: MPL-2.0
/**
 * The visual reading of AI evidence: heat over each sentence, marks on the
 * exact matched words, the classifier's chunk scores as their own layer, and an
 * inspector that says which observations touch the sentence or region a reader
 * picks. Heat comes from the engine (forensic/heat.ts) and is a reading aid,
 * never a probability; every label here says so where a number is shown.
 */
import { escape as escapeHtml } from '../utils.ts';
import { t } from '../i18n.ts';
import {
  forensicHeat,
  type ForensicGuidance,
  type ForensicHeatSegment,
  type ForensicPageHeat,
  type ForensicPage,
  type ForensicReport,
} from '../../../../engine/src/forensic.ts';

export interface ForensicLayers {
  heat: boolean;
  marks: boolean;
  model: boolean;
}
export const DEFAULT_LAYERS: ForensicLayers = { heat: true, marks: true, model: true };

/** What the reader has open: a sentence of the text, or a region of the page. */
export interface ForensicInspect {
  kind: 'segment' | 'region';
  index: number;
}

const e = (value: unknown) => escapeHtml(String(value));
const cache = new WeakMap<ForensicReport, Map<string, ForensicPageHeat>>();

/** The heat view of one page, computed once per report. */
export function pageHeat(report: ForensicReport, page: string): ForensicPageHeat {
  const pages = cache.get(report) ?? new Map<string, ForensicPageHeat>();
  cache.set(report, pages);
  const heat = pages.get(page) ?? forensicHeat(report, page);
  pages.set(page, heat);
  return heat;
}

export const guidanceLabel = (g: ForensicGuidance): string =>
  ({
    artifact: t('Specific artifact'),
    clue: t('Style clue'),
    context: t('Excluded: quoted or discussed'),
  })[g];

const GUIDANCE_RANK: Record<ForensicGuidance, number> = { artifact: 3, clue: 2, context: 1 };

/** How strongly the classifier layer draws a chunk: nothing below the model's
 *  measured floor, full at its chunk threshold. */
export function modelLevel(raw: number | undefined, threshold: number, floor: number): number {
  if (raw === undefined || raw < floor || !(threshold > floor)) return 0;
  return Math.max(0, Math.min(1, (raw - floor) / (threshold - floor)));
}

/** A sentence is worth opening when a pattern touches it or the classifier
 *  read its chunk at or above the floor, where the model layer starts to draw. */
const isWorthOpening = (s: ForensicHeatSegment, floor: number) =>
  s.signals.length > 0 || (s.model !== undefined && s.model >= floor);

/** One segment's text with marks on the matched words. Overlapping matches
 *  split into pieces; each piece takes its strongest signal's guidance. */
function segmentInner(text: string, segment: ForensicHeatSegment, selected: string): string {
  const cuts = new Set([segment.index, segment.index + segment.length]);
  for (const s of segment.signals)
    for (const span of s.spans) {
      cuts.add(span.index);
      cuts.add(span.index + span.length);
    }
  const points = [...cuts].sort((a, b) => a - b);
  let out = '';
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]!,
      to = points[i + 1]!;
    const covering = segment.signals.filter((s) =>
      s.spans.some((span) => span.index <= from && span.index + span.length >= to)
    );
    const piece = e(text.slice(from, to));
    if (!covering.length) {
      out += piece;
      continue;
    }
    const top = covering.reduce((a, b) =>
      GUIDANCE_RANK[b.guidance] > GUIDANCE_RANK[a.guidance] ||
      (GUIDANCE_RANK[b.guidance] === GUIDANCE_RANK[a.guidance] && b.strength > a.strength)
        ? b
        : a
    );
    const chosen = covering.some((s) => s.finding === selected);
    out += `<mark class="fh-mark fh-mark--${top.guidance}${chosen ? ' is-selected' : ''}" title="${e(covering.map((s) => s.label).join(' · '))}">${piece}</mark>`;
  }
  return out;
}

/**
 * The text with its layers. Only sentences that carry something are focusable,
 * so a keyboard walks the evidence rather than every sentence.
 */
export function heatReaderHtml(
  report: ForensicReport,
  page: ForensicPage,
  opts: { selected: string; layers: ForensicLayers; inspect?: ForensicInspect }
): string {
  const heat = pageHeat(report, page.id);
  const threshold = heat.model?.threshold ?? 1;
  const floor = heat.model?.floor ?? threshold;
  const hasModel = !!heat.model;
  const layers = [
    opts.layers.heat ? 'heat' : '',
    opts.layers.marks ? 'marks' : '',
    hasModel && opts.layers.model ? 'model' : '',
  ]
    .filter(Boolean)
    .join(' ');
  let end = 0,
    body = '';
  heat.segments.forEach((segment, i) => {
    body += e(page.text.slice(end, segment.index));
    const open = isWorthOpening(segment, floor);
    const inspected = opts.inspect?.kind === 'segment' && opts.inspect.index === i;
    const level = modelLevel(segment.model, threshold, floor);
    const over = segment.model !== undefined && segment.model >= threshold;
    const style = `--heat:${segment.heat.toFixed(3)};--model-level:${level.toFixed(3)}`;
    const label = t('Sentence {n}: {count} signals', { n: i + 1, count: segment.signals.length });
    body += `<span class="fh-seg${segment.heat > 0 ? ' is-lit' : ''}${inspected ? ' is-inspected' : ''}${over ? ' is-over' : ''}" data-seg="${i}" style="${style}"${open ? ` data-forensic="segment" role="button" tabindex="0" aria-label="${label}"` : ''}>${segmentInner(page.text, segment, opts.selected)}</span>`;
    end = segment.index + segment.length;
  });
  body += e(page.text.slice(end));
  // Minimap columns, one cell per sentence sized by its length: heat, and the
  // classifier's chunk level in a second column when the page was scored in chunks.
  const column = (kind: 'heat' | 'model') =>
    `<div class="fh-strip fh-strip--${kind}" aria-hidden="true">${heat.segments
      .map(
        (s, i) =>
          `<i data-forensic="segment" data-seg="${i}" style="--heat:${s.heat.toFixed(3)};--model-level:${modelLevel(s.model, threshold, floor).toFixed(3)};flex-grow:${Math.max(1, s.length)}"></i>`
      )
      .join('')}</div>`;
  const strip = heat.segments.length ? column('heat') + (hasModel ? column('model') : '') : '';
  const whole = heat.document.length
    ? `<div class="fh-whole"><span>${t('Whole-text signals')}</span>${heat.document
        .map(
          (s) =>
            `<button type="button" class="btn fh-chip fh-chip--${s.guidance}" data-forensic="select" data-finding="${e(s.finding)}">${e(s.label)}</button>`
        )
        .join('')}</div>`
    : '';
  return `<div class="fh-reader" data-layers="${layers}">
    ${whole}
    <div class="fh-body${hasModel ? ' has-model' : ''}">${strip}<pre class="forensic-text fh-text">${body || t('Text on this page has not been recovered.')}</pre></div>
  </div>`;
}

export function layerControlsHtml(layers: ForensicLayers, hasModel: boolean): string {
  const toggle = (key: keyof ForensicLayers, label: string, swatch: string) =>
    `<label class="fh-layer"><input type="checkbox" data-forensic-layer="${key}"${layers[key] ? ' checked' : ''}><i class="fh-swatch fh-swatch--${swatch}" aria-hidden="true"></i>${label}</label>`;
  return `<div class="fh-layers" role="group" aria-label="${t('Evidence layers')}">
    ${toggle('heat', t('Heat'), 'heat')}
    ${toggle('marks', t('Matched words'), 'clue')}
    ${hasModel ? toggle('model', t('Classifier chunks'), 'model') : ''}
    <span class="fh-key"><i class="fh-swatch fh-swatch--artifact" aria-hidden="true"></i>${t('Specific artifact')}<i class="fh-swatch fh-swatch--clue" aria-hidden="true"></i>${t('Style clue')}<i class="fh-swatch fh-swatch--context" aria-hidden="true"></i>${t('Excluded')}</span>
  </div>`;
}

const strengthBar = (value: number, label: string) =>
  `<span class="fh-bar" role="img" aria-label="${label}" title="${label}"><i style="--v:${Math.max(0, Math.min(1, value)).toFixed(3)}"></i></span>`;

function signalRows(
  signals: { finding: string; label: string; guidance: ForensicGuidance; strength: number }[]
): string {
  return signals
    .map(
      (s) =>
        `<li><span class="fh-chip fh-chip--${s.guidance}">${e(guidanceLabel(s.guidance))}</span><strong>${e(s.label)}</strong>${strengthBar(s.strength, t('Signal strength {n} of 100. A reading aid, not a probability.', { n: Math.round(s.strength * 100) }))}<button type="button" class="btn" data-forensic="select" data-finding="${e(s.finding)}">${t('Show finding')}</button></li>`
    )
    .join('');
}

/** The card that answers "why is this lit": every signal, its guidance level and
 *  strength, and the classifier's raw chunk score against its threshold. */
export function inspectorHtml(
  report: ForensicReport,
  page: ForensicPage,
  inspect: ForensicInspect | undefined
): string {
  if (!inspect) return '';
  const heat = pageHeat(report, page.id);
  const threshold = heat.model?.threshold ?? 1;
  const floor = heat.model?.floor ?? threshold;
  if (inspect.kind === 'region') {
    const region = heat.regions[inspect.index];
    if (!region) return '';
    return `<section class="fh-inspector" aria-label="${t('Signals in this region')}" tabindex="-1">
      <div class="fh-inspector-head"><h3>${t('Region on page {page}', { page: page.id })}</h3><button type="button" class="btn" data-forensic="inspect-close" aria-label="${t('Close')}">${t('Close')}</button></div>
      <p class="fh-heat-line">${t('Heat')} ${strengthBar(region.heat, t('Heat {n} of 100. A reading aid, not a probability.', { n: Math.round(region.heat * 100) }))}</p>
      <ul class="fh-signals">${signalRows(region.signals)}</ul>
    </section>`;
  }
  const segment = heat.segments[inspect.index];
  if (!segment) return '';
  const raw = segment.model;
  const model =
    raw !== undefined && heat.model
      ? `<div class="fh-model"><p>${t('Classifier chunk score')} <strong>${raw.toFixed(2)}</strong> · ${t('over threshold at {n}, drawn from {floor}', { n: threshold.toFixed(2), floor: floor.toFixed(2) })}</p><span class="fh-gauge" style="--v:${raw.toFixed(3)};--t:${threshold.toFixed(3)}" role="img" aria-label="${t('Raw score {raw}; threshold {threshold}. A raw model output, not a probability.', { raw: raw.toFixed(2), threshold: threshold.toFixed(2) })}"><i></i><b></b></span><p class="forensic-muted">${t('A raw model output for about 55 words around this sentence, not a probability. Short passages score more widely than whole documents.')}</p></div>`
      : '';
  const steps = heat.segments
    .map((s, i) => (isWorthOpening(s, floor) ? i : -1))
    .filter((i) => i >= 0);
  const at = steps.indexOf(inspect.index);
  return `<section class="fh-inspector" aria-label="${t('Signals in this sentence')}" tabindex="-1">
    <div class="fh-inspector-head"><h3>${t('Sentence {n} of {total}', { n: inspect.index + 1, total: heat.segments.length })}</h3><div class="fh-steps"><button type="button" class="btn" data-forensic="segment-step" data-step="-1"${at <= 0 ? ' disabled' : ''}>${t('Previous')}</button><button type="button" class="btn" data-forensic="segment-step" data-step="1"${at < 0 || at >= steps.length - 1 ? ' disabled' : ''}>${t('Next')}</button><button type="button" class="btn" data-forensic="inspect-close">${t('Close')}</button></div></div>
    <blockquote class="fh-quote">${e(page.text.slice(segment.index, segment.index + segment.length))}</blockquote>
    <p class="fh-heat-line">${t('Heat')} ${strengthBar(segment.heat, t('Heat {n} of 100. A reading aid, not a probability.', { n: Math.round(segment.heat * 100) }))}</p>
    ${segment.signals.length ? `<ul class="fh-signals">${signalRows(segment.signals)}</ul>` : `<p class="forensic-muted">${t('No located pattern in this sentence.')}</p>`}
    ${model}
  </section>`;
}

/** The next or previous sentence worth opening, for the inspector's arrows. */
export function stepSegment(report: ForensicReport, page: string, from: number, step: number): number {
  const heat = pageHeat(report, page);
  const threshold = heat.model?.threshold ?? 1;
  const floor = heat.model?.floor ?? threshold;
  for (let i = from + step; i >= 0 && i < heat.segments.length; i += step)
    if (isWorthOpening(heat.segments[i]!, floor)) return i;
  return from;
}

/** Page regions with heat, for drawing over an image or a rendered page. */
export function regionHeatHtml(
  report: ForensicReport,
  page: ForensicPage,
  inspect: ForensicInspect | undefined
): string {
  if (!(page.width > 0 && page.height > 0)) return '';
  return pageHeat(report, page.id)
    .regions.map((r, i) => {
      const b = r.box,
        x = Math.max(0, Math.min(100, (b.x / page.width) * 100)),
        y = Math.max(0, Math.min(100, (b.y / page.height) * 100));
      const width = Math.max(0, Math.min(100, ((b.x + b.width) / page.width) * 100) - x),
        height = Math.max(0, Math.min(100, ((b.y + b.height) / page.height) * 100) - y);
      if (!width || !height) return '';
      const top = r.signals.reduce<(typeof r.signals)[number] | undefined>(
        (a, s) => (!a || GUIDANCE_RANK[s.guidance] > GUIDANCE_RANK[a.guidance] ? s : a),
        undefined
      );
      return `<button type="button" class="fh-region fh-region--${top?.guidance ?? 'clue'}${inspect?.kind === 'region' && inspect.index === i ? ' is-inspected' : ''}" data-forensic="region" data-region="${i}" style="left:${x}%;top:${y}%;width:${width}%;height:${height}%;--heat:${r.heat.toFixed(3)}" aria-label="${t('{count} signals here: {labels}', { count: r.signals.length, labels: r.signals.map((s) => s.label).join(', ') })}"></button>`;
    })
    .join('');
}
