// SPDX-License-Identifier: MPL-2.0
/**
 * Verify's stage: the asset itself, large, beside the findings column.
 *
 * A finding can be shown on the asset. The stage owns two views, the asset and
 * the map, and one small interface, `showOnStage(result, findingId)`, so a
 * reader that adds an overlay never touches the layout. The AI evidence panel
 * draws its page view (heat, regions, zoom) into the stage's host; until that
 * arrives, or when a file has none, the plain preview stands there.
 */
import type { FileMetadata, VerifyFindingId } from '@lolly/engine';
import '../styles/parts/valid-stage.css';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { segHtml, syncSeg, wireSeg } from '../lib/seg.ts';
import { metadataLinkHtml } from './valid-links.ts';
import { renderLocator } from './valid-context.ts';
import { mediaPreviewHtml, type VerifyPreview } from './valid-preview.ts';

export type StageView = 'asset' | 'map';

/** The event a stage sends when a finding is shown, for readers that draw on the asset. */
export const STAGE_SHOW_EVENT = 'lolly:verify-stage-show';
export interface StageShowDetail { finding: VerifyFindingId; fileIndex: number }

const gpsOf = (meta?: FileMetadata): { lat: number; lon: number } | undefined => {
  const gps = meta?.gps;
  return gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lon) && Math.abs(gps.lat) <= 90 && Math.abs(gps.lon) <= 180 ? gps : undefined;
};

/** True when the file records a place the stage can show. */
export const stageHasMap = (meta?: FileMetadata): boolean => !!gpsOf(meta);

function mapPaneHtml(meta: FileMetadata, gps: { lat: number; lon: number }): string {
  return `<div class="vf-stage-pane vf-stage-map" data-stage-pane="map" hidden>
    ${renderLocator(gps.lat, gps.lon)}
    <div class="vf-stage-caption">
      <p><strong>${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}</strong><span>${t('Recorded in the file. Map drawn on this device.')}</span></p>
      <div class="vf-stage-actions">${meta.mapUrl ? metadataLinkHtml(meta.mapUrl, t('Open map')) : ''}<button type="button" class="btn" data-request-address data-lat="${gps.lat.toFixed(5)}" data-lon="${gps.lon.toFixed(5)}">${icon('mapPin')}<span>${t('Request address')}</span></button></div>
    </div>
  </div>`;
}

export function stageHtml(preview: VerifyPreview | undefined, meta: FileMetadata | undefined, fileIndex: number): string {
  const gps = gpsOf(meta);
  const views = gps ? segHtml('verify-stage', [
    { id: 'asset', label: t('Asset'), icon: icon('image') },
    { id: 'map', label: t('Map'), icon: icon('mapPin') },
  ], 'asset', t('Shown on the stage'), { attr: 'data-stage-view-pick', extraClass: 'vf-stage-views' }) : '';
  return `<div class="vf-stage" data-stage="${fileIndex}" data-stage-view="asset" aria-label="${esc(t('The asset'))}" role="group">
    ${views}
    <div class="vf-stage-pane" data-stage-pane="asset">
      <div class="vf-stage-media" data-stage-media>${mediaPreviewHtml(preview, fileIndex)}</div>
      <div class="vf-stage-forensic" data-forensic-host="${fileIndex}" hidden></div>
    </div>
    ${gps && meta ? mapPaneHtml(meta, gps) : ''}
  </div>`;
}

function setView(stage: HTMLElement, view: StageView): void {
  const has = !!stage.querySelector(`[data-stage-pane="${view}"]`);
  const next: StageView = has ? view : 'asset';
  stage.dataset.stageView = next;
  stage.querySelectorAll<HTMLElement>('[data-stage-pane]').forEach((pane) => { pane.hidden = pane.dataset.stagePane !== next; });
  syncSeg(stage, next, 'data-stage-view-pick');
}

/** Which view shows a finding. Every finding that has no view of its own shows the asset. */
const VIEW_FOR: Partial<Record<VerifyFindingId, StageView>> = { personal: 'map' };

/** Show a finding on the stage of one report. Readers that draw on the asset hear the event. */
export function showOnStage(result: HTMLElement, finding: VerifyFindingId): void {
  const stage = result.querySelector<HTMLElement>('[data-stage]');
  if (!stage) return;
  setView(stage, VIEW_FOR[finding] ?? 'asset');
  stage.dispatchEvent(new CustomEvent<StageShowDetail>(STAGE_SHOW_EVENT, { bubbles: true, detail: { finding, fileIndex: Number(stage.dataset.stage) } }));
}

export function wireStage(root: HTMLElement): void {
  wireSeg(root, {
    attr: 'data-stage-view-pick',
    onChange: (value, button) => {
      const stage = button.closest<HTMLElement>('[data-stage]');
      if (stage) setView(stage, value === 'map' ? 'map' : 'asset');
    },
  });
}
