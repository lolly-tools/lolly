// SPDX-License-Identifier: MPL-2.0
/** Readable evidence, located occurrences and review actions for Verify. */
import { escape as escapeHtml } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import { metricRing } from '../components/metric-ring.ts';
import { t } from '../i18n.ts';
import type {
  ForensicAnnotation,
  ForensicReport,
  ForensicOrigin,
  ForensicFinding,
} from '../../../../engine/src/forensic.ts';
import type { ForensicCollection } from './valid-forensics-collect.ts';
import {
  DEFAULT_LAYERS,
  heatReaderHtml,
  inspectorHtml,
  layerControlsHtml,
  pageHeat,
  regionHeatHtml,
  type ForensicInspect,
  type ForensicLayers,
} from './valid-forensics-heat.ts';
export interface ForensicViewState {
  collection: ForensicCollection;
  page: string;
  selected: string;
  location?: number;
  zoom?: number;
  filter: string;
  overlays: boolean;
  annotations: ForensicAnnotation[];
  history?: { report: ForensicReport; annotations: ForensicAnnotation[] }[];
  imported?: boolean;
  skippedModel?: boolean;
  message?: string;
  /** Which evidence layers the reader shows; the heat view's own state. */
  layers?: ForensicLayers;
  /** The sentence or region the reader opened in the inspector. */
  inspect?: ForensicInspect;
}
const e = (value: unknown) => escapeHtml(String(value));
const contribution = (f: ForensicFinding) =>
  f.contribution === 'context-excluded'
    ? t('Excluded from the evidence index')
    : f.contribution === 'specific-artifact'
      ? t('Specific text artifact')
      : t('Weak authorship clue');
const method = (value: string) =>
  ({
    'original-text': t('Original text'),
    'source-geometry': t('Source geometry'),
    'decoded-pixels': t('Image analysis'),
    ocr: t('Local OCR'),
    'local-classifier': t('Local text classifier'),
  })[value] ?? value;
export function forensicPanelHtml(index: number, origins: ForensicOrigin[] = []): string {
  return `<section class="forensic" data-forensic-index="${index}" data-forensic-origins="${e(JSON.stringify(origins))}" aria-label="${t('AI evidence')}"><h2>${t('AI evidence')}</h2><p class="forensic-intro">${t('Writing and design clues. Checked on this device.')}</p><button type="button" class="btn btn--primary" data-forensic="inspect">${t('Inspect AI evidence')}</button><div data-forensic-content></div></section>`;
}
export function forensicVisibleFindings(state: ForensicViewState): ForensicFinding[] {
  return state.collection.report.findings.filter(
    (f) =>
      state.filter === 'all' ||
      (state.filter === 'excluded'
        ? f.contribution === 'context-excluded'
        : f.modality === state.filter)
  );
}
function textPreview(state: ForensicViewState): string {
  const page = state.collection.report.pages.find((p) => p.id === state.page);
  if (!page) return '';
  return heatReaderHtml(state.collection.report, page, {
    selected: state.selected,
    layers: state.layers ?? DEFAULT_LAYERS,
    ...(state.inspect ? { inspect: state.inspect } : {}),
  });
}
function findingDetail(state: ForensicViewState, selected: ForensicFinding): string {
  const location = selected.locations[state.location ?? 0];
  const occurrence = selected.observations?.find((o) =>
    o.locations.some((l) => JSON.stringify(l) === JSON.stringify(location))
  );
  const measurements = occurrence?.measurements ?? selected.measurements;
  const confidence = occurrence?.confidence ?? selected.confidence;
  const rows = Object.entries(measurements)
    .map(
      ([key, value]) =>
        `<dt>${e(key.replace(/([a-z])([A-Z])/g, '$1 $2'))}</dt><dd>${e(typeof value === 'number' ? Number(value.toFixed(3)) : value)}</dd>`
    )
    .join('');
  return `<section class="forensic-detail" aria-label="${t('Selected evidence')}">
    <h3>${e(selected.label)}</h3><p>${e(selected.rule === 'fingernail-card' && measurements.edge ? `A rounded container has a solid accent on its ${measurements.edge} edge.` : selected.detail)}</p>
    <p class="forensic-contribution">${e(contribution(selected))}</p>
    <dl class="forensic-match"><div><dt>${t('Match')}</dt><dd>${selected.confidenceBasis === 'observed' ? t('Observed directly') : metricRing(confidence * 100, String(Math.round(confidence * 100)), t('Feature detection confidence, not AI probability.'))}</dd></div><div><dt>${t('Method')}</dt><dd>${e(method(occurrence?.method ?? selected.method))}</dd></div></dl>
    <p class="forensic-muted">${t('Pattern match describes detection of the feature, not the chance that AI made the file.')}</p>
    <div class="forensic-locations" aria-label="${t('Evidence locations')}">${selected.locations.map((l, i) => `<button type="button" class="btn" data-forensic="location" data-location="${i}" aria-pressed="${i === (state.location ?? 0)}">${t('Location')} ${i + 1} · ${t('page')} ${e(l.page)}</button>`).join('')}</div>
    <details class="forensic-measurements"><summary>${t('Measurements')}</summary><dl>${rows}</dl><p>${t('Rule')} <code>${e(selected.rule)} / ${e(selected.version)}</code></p>${location ? `<p>${location.span ? `${t('Characters')} ${location.span.index}–${location.span.index + location.span.length}` : ''}${location.box ? `${t('Page coordinates')} (${[location.box.x, location.box.y, location.box.width, location.box.height].map((n) => Number(n.toFixed(1))).join(', ')})` : ''}</p>` : ''}${selected.observations && selected.observations.length > 1 ? `<details><summary>${t('All occurrences')}</summary><pre>${e(JSON.stringify(selected.observations, null, 2))}</pre></details>` : ''}</details>
    <h4>${t('Alternatives')}</h4><p>${selected.alternatives.map(e).join(' ')}</p>
    <details class="forensic-review"><summary>${t('Review')}</summary><p>${t('Notes stay separate from the original assessment.')}</p><label>${t('Reason')} <select class="field-select" data-forensic-annotation><option value="brand-requirement">${t('Required brand pattern')}</option><option value="quoted-example">${t('Quoted example')}</option><option value="misdetected">${t('Misdetected region')}</option></select></label><label>${t('Review note')} <textarea class="field-input" data-forensic-note maxlength="1000" rows="3"></textarea></label><button type="button" class="btn" data-forensic="annotate">${t('Save')}</button></details>
    ${state.annotations
      .filter((a) => a.finding === selected.id)
      .map(
        (a) =>
          `<p class="forensic-note">${e({ 'brand-requirement': t('Required brand pattern'), 'quoted-example': t('Quoted example'), misdetected: t('Misdetected region') }[a.kind])}: ${e(a.note)}</p>`
      )
      .join('')}
  </section>`;
}
export function forensicWorkspaceHtml(state: ForensicViewState): string {
  const { report, previews, pageCount } = state.collection;
  const page = report.pages.find((p) => p.id === state.page),
    selected = report.findings.find((f) => f.id === state.selected);
  const findings = forensicVisibleFindings(state),
    preview = page && previews.get(page.id);
  const unreadText = report.coverage.some(
    (c) => c.collector === 'ocr' && c.state === 'unavailable'
  );
  const missingModel = report.coverage.some(
    (c) => c.collector === 'text-model' && c.state === 'unavailable'
  );
  const failed = report.coverage.filter((c) => c.state === 'failed' || c.state === 'cancelled');
  const partial = report.coverage.some((c) =>
    ['partial', 'failed', 'cancelled', 'unavailable'].includes(c.state)
  );
  const bands = {
    none: t('None'),
    weak: t('Weak'),
    notable: t('Notable'),
    strong: t('Strong'),
  };
  const layers = state.layers ?? DEFAULT_LAYERS;
  const overlays =
    page && page.width > 0 && page.height > 0 && preview && state.overlays
      ? (layers.heat ? regionHeatHtml(report, page, state.inspect) : '') +
        findings
          .filter((f) => !layers.heat || f.id === state.selected)
          .flatMap((f) =>
            f.locations.map((l, i) => {
              if (l.page !== page.id || !l.box) return '';
              const b = l.box,
                x = Math.max(0, Math.min(100, (b.x / page.width) * 100)),
                y = Math.max(0, Math.min(100, (b.y / page.height) * 100));
              const width = Math.max(0, Math.min(100, ((b.x + b.width) / page.width) * 100) - x),
                height = Math.max(0, Math.min(100, ((b.y + b.height) / page.height) * 100) - y);
              if (!width || !height) return '';
              return `<button type="button" class="forensic-region ${f.id === state.selected ? 'is-related' : ''} ${f.id === state.selected && i === (state.location ?? 0) ? 'is-selected' : ''}" data-forensic="select" data-finding="${e(f.id)}" data-location="${i}" aria-label="${e(`${f.label}, location ${i + 1}, page ${page.id}`)}" style="left:${x}%;top:${y}%;width:${width}%;height:${height}%"></button>`;
            })
          )
          .join('')
      : '';
  return `${state.imported ? `<p class="forensic-notice">${t('Imported report: its hashes match this file; its conclusions have not been recomputed.')}</p>` : ''}${state.message ? `<p role="status" class="forensic-notice">${e(state.message)}</p>` : ''}
    <dl class="forensic-summary"><div><dt>${t('Probability')}</dt><dd>${metricRing(report.likelihood.state === 'calibrated' ? report.likelihood.probability * 100 : null, report.likelihood.state === 'calibrated' ? `${Math.round(report.likelihood.probability * 100)}%` : '?', t('AI probability requires calibration for this kind of file.'))}<span>${report.likelihood.state === 'calibrated' ? t('Calibrated') : t('Unestimated')}</span></dd></div><div><dt>${t('Evidence')}</dt><dd>${metricRing(report.evidence.score, String(report.evidence.score), t('Evidence strength: {score} out of 100. This is a clue index, not AI probability.', { score: report.evidence.score }))}<span>${e(bands[report.evidence.band])}<small>${report.evidence.families} ${t('families')}</small></span></dd></div><div><dt>${t('Coverage')}</dt><dd>${metricRing(pageCount > 0 ? report.pages.length / pageCount * 100 : null, `${report.pages.length}/${pageCount}`, t('Pages inspected. Some checks may still be unavailable.'))}<span>${partial ? t('Partial') : t('Complete')}<small>${t('pages')}</small></span></dd></div></dl>
    <div class="forensic-coverage-notice"><p>${unreadText ? t('Text unread. Enable OCR in More.') : failed.length ? t('Some checks did not finish. See Coverage.') : t('Clues are not proof of authorship.')}</p>${unreadText ? `<button type="button" class="btn" data-forensic="ocr">${t('Read text with local OCR')}</button>` : ''}${missingModel && !state.skippedModel ? `<p>${t('Text classifier unavailable. Download or skip.')}</p><button type="button" class="btn" data-forensic="model">${t('Download text classifier')}</button><button type="button" class="btn" data-forensic="skip-model">${t('Skip text classifier')}</button>` : ''}</div>
    <details class="forensic-basis"><summary>${t('Method')}</summary><p>${report.likelihood.state === 'unavailable' ? e(report.likelihood.reason) : e(report.likelihood.population)}</p><p>${t('Repeated patterns count as one family. The index measures clues, not probability. Filters and review notes do not change that index.')}</p><p>${t('Declared origin')}: ${report.origins?.length ? report.origins.map((o) => e(`${o.kind}, ${o.source}, integrity ${o.integrity}, ${o.scope}`)).join('; ') : t('No AI origin declaration recorded')}. ${t('Declarations are separate from inferred evidence.')}</p></details>
    ${report.pages.length ? `<div class="forensic-toolbar forensic-navigation"><label>${t('Page')} <select class="field-select" data-forensic-page>${report.pages.map((p) => `<option value="${e(p.id)}" ${p.id === state.page ? 'selected' : ''}>${e(p.id)}${p.source === 'ocr' ? ` · ${t('OCR')}` : ''}</option>`).join('')}</select></label>${preview ? `<label><input type="checkbox" data-forensic-overlays ${state.overlays ? 'checked' : ''}> ${t('Regions')}</label><label>${t('Zoom')} <input type="range" data-forensic-zoom min="100" max="250" value="${state.zoom ?? 100}" aria-label="${t('Preview zoom')}"><output data-forensic-zoom-value>${state.zoom ?? 100}%</output></label>` : ''}${page ? layerControlsHtml(layers, !!pageHeat(report, page.id).model) : ''}</div>` : ''}
    <div class="forensic-workspace"><div class="forensic-preview-scroll">${preview ? `<div class="forensic-preview" style="width:${state.zoom ?? 100}%"><img src="${e(preview)}" alt="${e(`Inspected page ${state.page}`)}" draggable="false">${overlays}</div><details class="forensic-transcript"><summary>${t('Text')}</summary>${textPreview(state)}</details>` : textPreview(state)}</div>
    <div class="forensic-evidence"><div class="forensic-evidence-heading"><h3>${t('Findings')}</h3><label>${t('Show')} <select class="field-select" data-forensic-filter aria-label="${t('Evidence filter')}">${Object.entries(
      {
        all: t('All'),
        text: t('Text'),
        layout: t('Layout'),
        excluded: t('Excluded'),
      }
    )
      .map(
        ([value, label]) =>
          `<option value="${value}" ${state.filter === value ? 'selected' : ''}>${e(label)}</option>`
      )
      .join('')}</select></label></div>
    ${page ? inspectorHtml(report, page, state.inspect) : ''}<ul class="forensic-findings">${findings.map((f) => `<li><button type="button" data-forensic="select" data-finding="${e(f.id)}" aria-pressed="${f.id === state.selected}"><strong>${e(f.label)}</strong><span>${e(contribution(f))} · ${f.locations.length} ${f.locations.length === 1 ? t('location') : t('locations')}</span></button></li>`).join('') || `<li class="forensic-empty">${t('No matching findings in the inspected portions. Check coverage for unread content.')}</li>`}</ul>${selected && findings.includes(selected) ? findingDetail(state, selected) : ''}</div></div>
    <details class="forensic-coverage"><summary>${t('Coverage')}</summary><table><thead><tr><th>${t('Collector')}</th><th>${t('Page')}</th><th>${t('State')}</th><th>${t('Scope or limitation')}</th></tr></thead><tbody>${report.coverage.map((c) => `<tr><td>${e(c.collector)}<small>${e(c.version)}</small></td><td>${e(c.page ?? 'document')}</td><td>${e(c.state)}</td><td>${e(c.reason)}${c.ranges ? `<details><summary>${t('Inspected character ranges')}</summary>${c.ranges.map((r) => `${r.index}+${r.length}`).join(', ')}</details>` : ''}</td></tr>`).join('')}</tbody></table>${report.models.map((m) => `<details><summary>${e(m.model)} · ${t('raw classifier windows')}</summary><table><thead><tr><th>${t('Characters')}</th><th>${t('Tokens')}</th><th>${t('Raw score')}</th></tr></thead><tbody>${m.windows.map((w) => `<tr><td>${w.index}+${w.length}</td><td>${w.tokens}</td><td>${w.rawScore.toFixed(4)}</td></tr>`).join('')}</tbody></table></details>`).join('')}<p>${e(report.limitations.join(' '))}</p><p>${t('File SHA-256')} <code>${e(report.artifactSha256)}</code></p><p>${t('Report SHA-256')} <code>${e(report.reportSha256)}</code></p></details>
    ${state.history?.length ? `<details><summary>${t('History')} (${state.history.length})</summary>${state.history.map((h) => `<p><code>${e(h.report.reportSha256)}</code> · ${h.report.pages.length} ${t('pages')} · ${h.annotations.length} ${t('review notes')}</p>`).join('')}</details>` : ''}
    <div class="forensic-toolbar forensic-actions"><button type="button" class="btn" data-forensic="inspect">${report.pages.length < pageCount && report.pages.length < 100 ? t('Inspect more pages') : t('Retry inspection')}</button><button type="button" class="btn" data-forensic="json">${t('Export JSON evidence')}</button><button type="button" class="btn" data-forensic="readable">${t('Export readable evidence')}</button><label class="btn forensic-reload">${t('Reload evidence')}<input type="file" data-forensic-reload accept="application/json,.json" aria-label="${t('Reload evidence')}"></label></div><p class="forensic-muted">${t('Exports include recovered text and review notes. Nothing is saved automatically.')}</p>`.replaceAll('<summary>', '<summary class="section-card-summary verify-disclosure"><span>')
    .replaceAll('</summary>', `</span><span class="section-card-chev">${icon('chevronDown')}</span></summary>`);
}
export function readableForensicReport(
  report: ForensicReport,
  annotations: ForensicAnnotation[]
): string {
  return [
    `# AI evidence assessment`,
    `File SHA-256: ${report.artifactSha256}`,
    `Report SHA-256: ${report.reportSha256}`,
    `Rules: ${report.version}`,
    `Origin declarations (separate from inference): ${JSON.stringify(report.origins)}`,
    `Estimated AI involvement: ${report.likelihood.state === 'calibrated' ? report.likelihood.probability : 'Not estimable'}`,
    `Evidence strength: ${report.evidence.band}; ${report.evidence.score}/100 heuristic index`,
    ...report.findings.map(
      (f) =>
        `\n## ${f.label}\n${f.detail}\nContribution: ${f.contribution}\nPattern confidence: ${f.confidence} (${f.confidenceBasis})\nMethod: ${f.method} / ${f.version}\nLocations: ${JSON.stringify(f.locations)}\nMeasurements: ${JSON.stringify(f.measurements)}\nOccurrences: ${JSON.stringify(f.observations ?? [])}\nAlternatives: ${f.alternatives.join(' ')}`
    ),
    `\n## Coverage\n${report.coverage.map((c) => `${c.collector} / ${c.page ?? 'document'}: ${c.state}. ${c.reason}`).join('\n')}`,
    `\n## Classifier windows\n${JSON.stringify(report.models, null, 2)}`,
    `\n## Review notes\n${JSON.stringify(annotations, null, 2)}`,
    `\n## Recovered text\n${report.pages.map((p) => `Page ${p.id} (${p.source})\n${p.text}`).join('\n\n')}`,
    `\n${report.limitations.join('\n')}`,
  ].join('\n\n');
}
