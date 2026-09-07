// SPDX-License-Identifier: MPL-2.0
/**
 * The browsable component library (#/components).
 *
 * A dev/design surface, off every hot path (lazy-loaded). It renders the shell's
 * components - a "Primitives" section for the shared layer a multi-wave refactor
 * shipped (buttons.css, chips.css, lib/seg.ts, lib/icons.ts, mountModal,
 * mountZoomHud, mountViewTopbar, swatchTile, setTheme, wireTabs, sessionRow,
 * mountBodyPopover, backPillHtml, setupMobileSheet, staggerReveal, wireTileSelect,
 * .section-card, .note/.field-input), then the remaining
 * common-primitive families, then per-view - from the specimen data in
 * components-data.ts (originally generated from the component-audit workflow;
 * hand-maintained since the refactor landed; the written analysis + per-rec
 * shipped status is plans/76-component-audit.md). Each specimen is shown live where
 * the component is a pure render function, as a static markup sample where it's
 * only CSS, and as a labelled source snippet or a labelled design fixture where it needs the host bridge to run.
 *
 * Specimen data is HAND-MAINTAINED, so two guards in primitive-guards.test.ts
 * (R7) keep it from drifting away from the shell it documents: every `defined:`
 * path must resolve to a real file, and every class in a `css:` list must still
 * be live somewhere. `defined:` carries a path and the symbol name, never a line
 * number - those rotted on 65 of 70 entries before they were dropped.
 *
 * Category navigation and search make the inventory browsable. Downloads are
 * local .penpot archives with reusable components and applied design tokens.
 * The library never mutates app or brand state.
 *
 * Specimens are styled by the real part sheets, imported below so each looks
 * exactly as it does in situ.
 */

import '../styles/parts/components-lib.css';
// The specimens borrow the app's own stylesheets. The globally-@imported parts
// (components, gallery, topbar, catalog, dialogs, featured, folders, projects,
// saved-list - see styles/app.css) are already present; these view-local sheets
// are not on the landing bundle, so pull them in for the samples that need them.
import '../styles/parts/platform.css';
import '../styles/parts/dashboard.css';
import '../styles/parts/brand-studio.css';
import '../styles/parts/tool.css';
import '../styles/parts/tool-chrome.css';
import '../styles/parts/storage.css';
import '../styles/parts/profile.css';
import '../styles/parts/start.css';
import '../styles/parts/multi-edit.css';
import '../styles/parts/valid.css';
import '../styles/parts/editor.css'; // .stage-nav (the tool canvas's zoom HUD) - for the Zoom HUD live specimen
// The Design workspace's own sheets are lazy view chunks (they ride the free-canvas
// route), so without these three imports its four specimens rendered with no
// styles at all - bare buttons, an unframed navigator, an empty export sheet.
import '../styles/parts/design-navigator.css';
import '../styles/parts/design-inspector.css';
import '../styles/parts/timeline.css';
import '../pro/pro.css';

import { t } from '../i18n.ts';
import { escape } from '../utils.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { COMPONENT_SECTIONS as AUDIT_SECTIONS, COMPONENT_ARTWORK, type Specimen } from './components-data.ts';
import { audioDockExample, contextMenuExample, editableWheelExample, exportFieldsExample, projectTilesExample, selectionBarExample } from './components-examples.ts';
import { SVG as canvasIcons, icon as canvasIcon } from './free-canvas-icons.ts';

import { designSystemCardHtml } from '../lib/design-system/design-systems-card.ts';
import { colorFieldHtml, wireColorField } from '../components/color-field.ts';
import { renderPaletteWheel, wirePaletteWheel } from '../lib/palette-wheel.ts';
import { renderBrandSeal, sealColors } from '../lib/brand-seal.ts';
import { swatch, swatchTile } from '../lib/swatches.ts';
import { genAiPill } from '../lib/genai-pill.ts';
import { lollyBadge } from '../lib/lolly-badge.ts';
import { viewToggle } from '../components/view-toggle.ts';
import { themeSegmentHtml } from '../components/theme-toggle.ts';
import { soundSwitchHtml } from '../components/sound-toggle.ts';
import { helpTip } from '../components/help-tip.ts';
import { footerNav, gallerySearchBox } from '../components/footer-nav.ts';
import { confirmDialog, choiceDialog, noticeDialog, promptDialog } from '../components/confirm-dialog.ts';
import { openShareDialog } from '../components/share-dialog.ts';
import { palettePreviewSvgs } from '../lib/palette-preview.ts';
import { categoryGlyph } from '../lib/category-icons.ts';
import { catalogSummaryBody } from '../lib/catalog-summary.ts';
import { fmtBadge, dimBadge, rowCountBadge, sessionRow, type SessionEntry } from '../folder-tiles.ts';
import { controlHtml } from '../pro/controls.ts';
import { stepsHtml, inputsDigestHtml } from './valid.ts';
import type { PaletteEntry } from '../palette.ts';
import { segHtml } from '../lib/seg.ts';
import { icon, iconNames, ICON_METAPHORS, type IconMetaphor } from '../lib/icons.ts';
import { mountZoomHud } from '../components/zoom-hud.ts';
import { viewTopbarHtml } from '../components/view-topbar.ts';
import { mountBodyPopover, type BodyPopoverHandle } from '../components/body-popover.ts';
import { backPillHtml, backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { customSliderHtml, mountCustomSlider } from '../components/custom-slider.ts';
import { mountThemeFab } from '../components/theme-toggle.ts';
import { listLollyUiTokens } from '../lib/lolly-ui-tokens.ts';
import { offerDownloadRecovery } from '../lib/download-recovery.ts';
import { componentFixture } from './components-fixtures.ts';
import { copyText, importInfo, markupOf, tokensUsedBy } from './components-reference.ts';

// A demo palette for the colour specimens (not the live brand).
const DEMO: PaletteEntry[] = [
  { hex: '#30ba78', label: 'Jungle', cmyk: [74, 0, 60, 0], group: 'Brand' },
  { hex: '#0c322c', label: 'Pine', cmyk: [80, 30, 55, 60], group: 'Brand' },
  { hex: '#2453ff', label: 'Klein', cmyk: [86, 68, 0, 0], group: 'Spectrum' },
  { hex: '#fe7c3f', label: 'Persimmon', cmyk: [0, 60, 78, 0], group: 'Spectrum' },
  { hex: '#efefef', label: 'Mist', cmyk: [0, 0, 0, 6], group: 'Neutral' },
  { hex: '#1b1b1b', label: 'Ink', cmyk: [0, 0, 0, 92], group: 'Neutral' },
];

// A live-openable dialog trigger - the honest sample for an imperative component.
function triggerButton(label: string, onClick: () => void): HTMLElement {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn btn--primary'; b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/** The live renderers, keyed by the `live` tag in components-data.ts. Each returns
 *  an HTML string or a node; a `wire` runs after it's inserted. Only pure/wired
 *  components with a safe render path are here - everything else falls back to a
 *  markup sample or a source snippet. */
const previewPopovers = new Set<BodyPopoverHandle>();

const LIVE: Record<string, { render: () => string | HTMLElement; wire?: (stage: HTMLElement) => void }> = {
  projectTiles: { render: projectTilesExample },
  contextMenu: { render: contextMenuExample },
  selectionBar: { render: selectionBarExample },
  editableWheel: { render: editableWheelExample },
  audioDock: { render: audioDockExample },
  exportFields: { render: exportFieldsExample },
  designSystems: { render: () => `<div class="cl-ds-preview">${[
    { id: 'forest', label: 'Forest studio', colors: ['#0c322c', '#30ba78', '#90ebcd', '#fe7c3f', '#202174'] },
    { id: 'orchid', label: 'Orchid', colors: ['#31072f', '#ad24ba', '#f7dcf2', '#a2afff', '#161319'] },
  ].map(r => designSystemCardHtml({ id: r.id, label: r.label, ns: `user/ds/${r.id}/`, headId: `user/ds/${r.id}/tokens/brand`, source: { kind: 'local' }, locked: false, createdAt: 0, lastUsedAt: 0 }, 'forest', 6400, { font: 'var(--font-brand)', colors: r.colors })).join('')}</div>` },
  colorField: { render: () => `<div class="cl-color-panel">${colorFieldHtml('cl-color', '#30ba78', { inline: true, palette: true })}</div>`, wire: s => wireColorField(s) },
  colorFine: { render: () => `<div class="cl-color-panel">${colorFieldHtml('cl-color-fine', '#fe7c3f', { inline: true, dials: false })}</div>`, wire: s => wireColorField(s) },
  colorValue: { render: () => `<div class="cl-color-panel">${colorFieldHtml('cl-color-value', '#2453ff', { inline: true, dials: false })}</div>`, wire: s => wireColorField(s) },
  colorAdvanced: { render: () => `<div class="cl-color-advanced">${colorFieldHtml('cl-color-advanced', '#30ba78', { inline: true, modes: true })}</div>`, wire: s => wireColorField(s) },
  colorTriggers: { render: () => `<div class="cl-color-triggers"><div><p class="cl-eyebrow">Named colours</p>${colorFieldHtml('cl-named-1', '#93290b', { name: 'Persimmon 2' })}${colorFieldHtml('cl-named-2', '#fe7c3f', { name: 'Persimmon' })}</div><div><p class="cl-eyebrow">Compact controls</p><div class="cl-color-compact">${colorFieldHtml('cl-compact-1', '#2453ff', { label: 'Fill' })}${colorFieldHtml('cl-compact-2', '#000000', { label: 'Stroke' })}</div></div></div>`, wire: s => wireColorField(s) },
  wheel: { render: () => `<div style="width:320px;max-width:100%">${renderPaletteWheel(DEMO.map(p => ({ hex: p.hex, label: p.label })))}</div>`, wire: (s) => wirePaletteWheel(s) },
  seal: { render: () => renderBrandSeal(sealColors(DEMO), 128) },
  swatchCard: { render: () => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;width:100%">${swatch(DEMO[0]!)}${swatch({ ...DEMO[1]!, spot: { name: 'PANTONE 5535 C' } })}</div>` },
  palettePreview: {
    render: () => `<div class="cl-scenes">${palettePreviewSvgs(['#2453ff', '#30ba78', '#fe7c3f', '#e11d48']).map((scene, i) => `<div data-cl-scene="${i}"${i ? ' hidden' : ''}>${scene.svg}</div>`).join('')}${segHtml('cl-scene', [{ id: '0', label: 'Poster' }, { id: '1', label: 'Chart' }, { id: '2', label: 'UI card' }], '0', 'Palette preview')}</div>`,
    wire: stage => stage.querySelectorAll<HTMLButtonElement>('.view-seg-btn').forEach((button, index) => { button.addEventListener('click', () => {
      stage.querySelectorAll<HTMLElement>('[data-cl-scene]').forEach((scene, i) => { scene.hidden = i !== index; });
      stage.querySelectorAll('.view-seg-btn').forEach((other, i) => { other.setAttribute('aria-pressed', String(i === index)); });
    }); }),
  },
  genai: { render: () => `${genAiPill('full')} ${genAiPill('partial')} ${genAiPill('full', true)}` },
  lollyBadge: { render: () => `${lollyBadge('sm')} ${lollyBadge('lg')}` },
  viewToggle: { render: () => viewToggle('tools') },
  // Rendered in its in-flow form (no .home-full) so the specimen sits in the stage
  // rather than pinning itself to the viewport corner.
  backPill: { render: () => backPillHtml({ class: '' }) },
  themeSeg: { render: () => themeSegmentHtml() },
  soundSwitch: { render: () => soundSwitchHtml() },
  footerNav: { render: () => footerNav({ searchHtml: gallerySearchBox({ placeholder: t('Search'), ariaLabel: t('Search') }) }) },
  catGlyph: { render: () => `<span style="display:inline-flex;gap:.7rem;align-items:center">${['logos', 'photos', 'swatches', 'fonts'].map(categoryGlyph).join('')}</span>` },
  catSummary: { render: () => catalogSummaryBody([
    { id: 'qr-code', category: 'utility', status: 'official' },
    { id: 'brand-lockup', category: 'designer', status: 'experimental' },
    { id: 'icon', category: 'utility', status: 'official' },
  ], [{ type: 'vector' }, { type: 'vector' }, { type: 'palette' }, { type: 'tokens' }]) },
  tileBadges: { render: () => `<span class="tile-badges">${fmtBadge('svg')}${dimBadge(512, 512, 'px')}${rowCountBadge(8)}</span>` },
  dialogTriggers: {
    render: () => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:.5rem;flex-wrap:wrap';
      wrap.append(
        triggerButton(t('Confirm…'), () => { void confirmDialog({ title: t('Delete swatch?'), message: t('This can’t be undone.'), confirmLabel: t('Delete') }); }),
        triggerButton(t('Choose…'), () => { void choiceDialog({ title: t('Export as'), message: t('Pick a format'), choices: [{ id: 'png', label: 'PNG' }, { id: 'svg', label: 'SVG' }] as never }); }),
        triggerButton(t('Notice…'), () => { void noticeDialog({ title: t('Heads up'), message: t('A sample notice.') }); }),
        triggerButton(t('Prompt…'), () => { void promptDialog({ title: t('Name this'), message: t('Give it a name'), placeholder: t('e.g. Jungle') }); }),
      );
      return wrap;
    },
  },
  shareTrigger: { render: () => triggerButton(t('Share…'), () => { openShareDialog({ toolId: 'qr-code', baseParts: ['url=https%3A%2F%2Fsuse.com'], currentFormat: 'png', title: t('Share this tool') }); }) },
  helpTip: {
    render: () => { const h = helpTip(t('Chroma is how vivid a colour is - grey at the centre, vivid at the rim.'), { href: '#/components', text: t('Learn more') }); return `<span class="help-tip-host" style="display:inline-flex;align-items:center;gap:.4rem">${t('Chroma')} ${h.button}${h.pop}</span>`; },
  },
  proControl: { render: () => `<div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">${controlHtml({ type: 'select', options: [{ value: 'a', label: 'Option A' }, { value: 'b', label: 'Option B' }] } as never, 'a' as never, '')}${controlHtml({ type: 'number' } as never, 42 as never, '')}</div>` },
  validSteps: { render: () => stepsHtml({ history: [
    { action: 'c2pa.created', when: '2026-07-01T09:00:00Z', softwareAgent: 'Lolly', digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCreation' },
    { action: 'c2pa.color_adjustments', when: '2026-07-02T11:00:00Z', softwareAgent: 'Adobe Photoshop' },
  ] } as never) },
  validInputs: { render: () => inputsDigestHtml({ Background: '#1a1a2e', Headline: 'Ship it', Size: '1080×1080' }) },

  // ── Primitives-section live renderers (component audit recs 1/5/6/8/11/12) ──
  seg: { render: () => segHtml('cl-stored', [{ id: 'lch', label: 'LCH' }, { id: 'hex', label: 'Hex' }, { id: 'rgb', label: 'RGB' }], 'hex', t('Stored as')), wire: stage => {
    stage.querySelectorAll<HTMLButtonElement>('.view-seg-btn').forEach(button => { button.addEventListener('click', () => {
      stage.querySelectorAll('.view-seg-btn').forEach(other => { other.setAttribute('aria-pressed', String(other === button)); });
    }); });
  } },
  icons: {
    render: () => `<div class="cl-icon-grid">${iconNames.map(name => `<div class="cl-icon-cell">${icon(name, { size: 20 })}<span>${escape(name)}</span></div>`).join('')}</div>`,
  },
  zoomHud: {
    render: () => {
      const wrap = document.createElement('div');
      wrap.className = 'cl-zoomhud-demo';
      const hudEl = document.createElement('div');
      hudEl.className = 'stage-nav';
      wrap.appendChild(hudEl);
      let pct = 100;
      const hud = mountZoomHud(hudEl, {
        ariaLabel: t('Zoom'),
        classes: { btn: 'stage-nav-btn', pct: 'stage-nav-pct', fit: 'stage-nav-fit' },
        onZoom: (dir) => { pct = Math.max(25, Math.min(400, pct + dir * 25)); hud.setReadout(`${pct}%`); hud.setValue(pct); },
        onFit: () => { pct = 100; hud.setReadout(t('Fit')); hud.setValue(pct); },
        initialReadout: '100%',
        min: 25, max: 400,
      });
      return wrap;
    },
  },
  sessionRow: {
    render: () => {
      const entry: SessionEntry = { slot: 'qr-code:171', toolId: 'qr-code', label: t('Launch QR'), thumb: COMPONENT_ARTWORK.gradient, updatedAt: '2026-07-09T10:00:00Z' };
      const galleryRow = sessionRow(entry, {
        rowClass: 'saved-row', thumbClass: 'saved-thumb', metaClass: 'saved-label',
        titleTag: 'h4', title: entry.label ?? '', subtitle: t('3 Jul 14:20'),
        openClass: 'saved-resume', openAttrs: 'data-cl-noop', openLabel: t('Resume'),
        deleteAttr: 'data-cl-noop', deleteClass: 'saved-delete', deleteLabel: t('Delete'),
      });
      const profileRow = sessionRow(entry, {
        rowClass: 'store-sess', thumbClass: 'store-sess-thumb', metaClass: 'store-sess-meta', titleClass: 'store-sess-label',
        title: entry.label ?? '', subtitle: t('QR Code · 2d ago'),
        selectClass: 'store-sess-check', selectLabel: t('Select'),
        sizeBytes: 20480,
        deleteAttr: 'data-cl-noop', deleteClass: 'store-sess-del', deleteLabel: t('Delete'),
      });
      return `<ul class="saved-list" style="width:100%;max-width:340px;list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.5rem">${galleryRow}${profileRow}</ul>`;
    },
  },
  viewTopbar: { render: () => viewTopbarHtml({ active: 'tools', profile: { firstname: 'Alex' } }) },
  swatchTile: {
    render: () => `<div style="display:flex;gap:1.2rem;flex-wrap:wrap;align-items:center">
      <div style="display:flex;gap:.4rem">${DEMO.slice(0, 4).map((p, i) => swatchTile({ label: p.label, hex: p.hex, locked: i === 1 }, { idx: i })).join('')}</div>
      <div style="display:flex;gap:.3rem">${DEMO.slice(0, 4).map((p, i) => swatchTile({ label: p.label, hex: p.hex }, { size: 'sm', idx: i })).join('')}</div>
    </div>`,
  },
  customSlider: {
    render: () => `<div class="cl-slider-demo">${customSliderHtml({ min: 0, max: 100, step: 5, value: 40, unit: '%', label: t('Opacity') })}<output class="cl-slider-readout" aria-live="off">40%</output></div>`,
    wire: (stage) => {
      const el = stage.querySelector<HTMLElement>('.custom-slider');
      const out = stage.querySelector<HTMLElement>('.cl-slider-readout');
      if (!el || !out) return;
      mountCustomSlider(el, { onInput: v => { out.textContent = `${v}%`; }, onCommit: v => { out.textContent = `${v}%`; } });
    },
  },
  // The Design workspace, in the shapes its own views build (free-canvas's toolBtn,
  // design-navigator's buildFrameRow, design-inspector's section head, the
  // timeline's btn()) - real classes and real glyphs, laid out in flow by the
  // stage rules in components-lib.css instead of pinned to a stage edge.
  designToolbar: {
    render: () => `<div class="fc-toolbar" role="toolbar" aria-label="${escape(t('Design tools'))}">
      <button type="button" class="fc-btn is-armed" aria-label="${escape(t('Select'))}" aria-pressed="true">${canvasIcon(canvasIcons.pointer)}</button>
      <button type="button" class="fc-btn" aria-label="${escape(t('Pen'))}">${icon('penTool', { size: 18 })}</button>
      <button type="button" class="fc-btn" aria-label="${escape(t('Add a box'))}">${canvasIcon(canvasIcons.add)}</button>
      <button type="button" class="fc-btn" aria-label="${escape(t('Image'))}">${icon('image', { size: 18 })}</button>
      <span class="fc-sep" aria-hidden="true"></span>
      <button type="button" class="fc-btn" aria-label="${escape(t('Layers'))}">${icon('layersStack', { size: 18 })}</button>
      <button type="button" class="fc-btn" aria-label="${escape(t('Fit artboard'))}">${icon('fitArtboard', { size: 18 })}</button>
    </div>`,
  },
  designColumns: {
    render: () => `<div class="cl-design-columns">
      <aside class="fc-nav" aria-label="${escape(t('Navigator'))}">
        <div class="fc-nav-head"><span class="fc-nav-title">${t('Artboards')}</span></div>
        <div class="fc-nav-list" role="listbox" aria-label="${escape(t('Artboards'))}">
          <div class="fc-nav-row" role="option" aria-selected="true"><span class="fc-nav-thumb" aria-hidden="true"></span><span class="fc-nav-idx">1</span><span class="fc-nav-main"><span class="fc-nav-name">${t('Cover')}</span></span></div>
          <div class="fc-nav-row" role="option" aria-selected="false"><span class="fc-nav-thumb" aria-hidden="true"></span><span class="fc-nav-idx">2</span><span class="fc-nav-main"><span class="fc-nav-name">${t('Agenda')}</span></span></div>
        </div>
      </aside>
      <aside class="fc-insp" aria-label="${escape(t('Inspector'))}">
        <section class="fc-insp-sec"><button type="button" class="fc-insp-head" aria-expanded="true">${icon('box', { size: 16 })}<span>${t('Object')}</span><i class="fc-insp-caret" aria-hidden="true"></i></button>
          <div class="fc-insp-rows"><div class="fc-insp-chips"><span class="fc-insp-chip"><i>W</i>1080</span><span class="fc-insp-chip"><i>H</i>1080</span><span class="fc-insp-chip"><i>X</i>0</span><span class="fc-insp-chip"><i>Y</i>0</span></div></div></section>
        <section class="fc-insp-sec"><button type="button" class="fc-insp-head" aria-expanded="false">${icon('sliders', { size: 16 })}<span>${t('Appearance')}</span><i class="fc-insp-caret" aria-hidden="true"></i></button></section>
      </aside>
    </div>`,
  },
  timelineBar: {
    render: () => `<section class="tl-panel" aria-label="${escape(t('Timeline'))}">
      <div class="tl-bar">
        <button type="button" class="tl-btn tl-play" aria-label="${escape(t('Play'))}">${icon('play', { size: 16 })}</button>
        <span class="tl-time">00:00.0</span>
        <button type="button" class="tl-btn tl-add" aria-label="${escape(t('Add to the timeline'))}">${icon('plus', { size: 16 })}</button>
        <button type="button" class="tl-btn is-active" aria-pressed="true" aria-label="${escape(t('Snap'))}">${icon('keyframe', { size: 16 })}</button>
      </div>
      <div class="tl-group"><button type="button" class="tl-group-head" aria-expanded="true"><span class="tl-group-icon" aria-hidden="true">${icon('clock', { size: 14 })}</span><span class="tl-group-label">${t('Animate')}</span><i class="tl-group-caret" aria-hidden="true"></i></button>
        <div class="tl-group-body"><div class="tl-group-chips"><span class="tl-group-chip">${t('Fade in')}</span><span class="tl-group-chip">${t('Rise')}</span></div></div></div>
      <div class="tl-tracks"><div class="tl-tracks-inner"><div class="tl-lanes"><div class="tl-lane tl-lane-seq"><span class="tl-lane-label">Artboards</span><div class="tl-clip tl-clip-seq is-selected" data-kind="image" style="left:8%;width:38%"><span class="tl-clip-label">Cover · 4s</span></div><div class="tl-clip tl-clip-seq" data-kind="image" style="left:48%;width:44%"><span class="tl-clip-label">Agenda · 5s</span></div></div></div></div></div>
    </section>`,
  },
  exportSheet: {
    render: () => `<div class="export-popup" role="group" aria-label="${escape(t('Export'))}">
      <div class="export-popup-head"><span class="export-popup-title">${t('Export')}</span><button type="button" class="export-popup-close" aria-label="${escape(t('Close'))}">&#x2715;</button></div>
      <div class="export-popup-body"><div class="tool-actions"><div class="export-actions-dock"><div class="export-action-buttons"><button type="button" class="btn">${t('Copy')}</button><button type="button" class="btn">${t('Save')}</button><button type="button" class="btn">${t('Share')}</button></div><div class="export-action-buttons"><button type="button" class="btn btn--primary" data-action="download">${t('Download')}</button></div></div>${exportFieldsExample()}</div></div>
    </div>`,
  },
  bodyPopover: {
    render: () => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn--primary'; b.textContent = t('Open menu…');
      let popover: BodyPopoverHandle | null = null;
      b.addEventListener('click', () => {
        popover ??= mountBodyPopover(b, (el) => {
          el.innerHTML = [t('Recolour'), t('Duplicate'), t('Delete')]
            .map(label => `<button type="button" class="cl-popover-demo-item">${escape(label)}</button>`).join('');
          return el.querySelector<HTMLElement>('.cl-popover-demo-item');
        }, { className: 'cl-popover-demo', ariaLabel: t('Demo menu') });
        previewPopovers.add(popover);
        popover.isOpen() ? popover.close() : popover.open();
      });
      return b;
    },
  },
};

// How a specimen is actually shown - not its nature, but what the card displays,
// so the tag never promises interaction for an unwired render function.
// Interactive specimens have safe local wiring; host-only states are fixtures.
type Mode = 'live' | 'sample' | 'fixture' | 'source';
function renderMode(s: Specimen): Mode {
  if (s.live && LIVE[s.live]) return LIVE[s.live]!.wire || ['zoomHud', 'dialogTriggers', 'shareTrigger', 'bodyPopover'].includes(s.live) ? 'live' : 'sample';
  if (s.markup) return 'sample';
  if (componentFixture(s)) return 'fixture';
  return 'source';
}
const MODE_LABEL: Record<Mode, string> = { live: 'Interactive', sample: 'Static sample', fixture: 'Design fixture', source: 'Recipe' };

/** The card title: the specimen name with every parenthesised aside removed.
 *  Depth-aware, because the asides nest - `(.view-seg via segHtml())` - and a
 *  one-level regex left a stray `)` on four titles. */
export function displayName(s: Specimen): string {
  let out = '';
  let depth = 0;
  for (const ch of s.name) {
    if (ch === '(') { depth++; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); continue; }
    if (depth === 0) out += ch;
  }
  return out.replace(/\s{2,}/g, ' ').replace(/ - canonical$/, '').trim();
}
const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const USE_CASES: Record<string, [string, string]> = {
  'Colour tools': ['#/start?area=color', 'Colour studio'],
  'Design workspace': ['#/design', 'Design workspace'],
  'Dashboard & Brand studio': ['#/start', 'Brand studio'],
  'Profile': ['#/profile', 'Profile'],
  'Gallery': ['#/', 'Tool gallery'],
  'Catalog': ['#/c', 'Catalogue'],
  'Projects / folders': ['#/p', 'Projects'],
  'Export panel': ['#/design', 'Design workspace'],
};
function useCaseLink(title: string): string {
  const reference = USE_CASES[title];
  return reference ? `<a class="cl-text-link" href="${reference[0]}" target="_blank" rel="noopener">Open ${reference[1]} ↗</a>` : '';
}

function specimenShell(s: Specimen, idx: number): string {
  const mode = renderMode(s);
  const wide = ['designSystems', 'colorAdvanced', 'designColumns', 'timelineBar', 'footerNav', 'icons', 'viewTopbar', 'sessionRow'].includes(s.live || '');
  const summary = s.description?.split(/(?<=\.)\s/)[0] || 'A shared part of the Lolly interface.';
  return `<article class="cl-card${wide ? ' cl-card--wide' : ''}" data-cl-card="${idx}" aria-labelledby="cl-name-${idx}">
    <div class="cl-card-top"><h3 class="cl-name" id="cl-name-${idx}">${escape(displayName(s))}</h3><span class="cl-kind cl-kind--${mode}">${MODE_LABEL[mode]}</span></div>
    <div class="cl-stage" data-cl-stage="${idx}" data-cl-preview="${escape(s.live || 'markup')}"></div>
    <div class="cl-meta">
      <p class="cl-desc">${escape(summary)}</p>
      ${s.eg?.length ? `<div class="cl-eg">${s.eg.slice(0, 3).map(e => `<span>${escape(e)}</span>`).join('')}</div>` : ''}
      <details class="cl-details cl-ref" data-cl-ref="${idx}"><summary>Use this component</summary>
        <p>${escape(s.description || '')}</p>
        ${mode === 'fixture' ? '<p class="cl-ref-note">A design fixture: drawn for this library to show the shape. The real part needs the app around it, so the markup below is the fixture, not the production component.</p>' : ''}
        <p class="cl-src">${escape(s.defined || '')}</p>
        <div class="cl-ref-body" data-cl-ref-body hidden></div>
        <p class="cl-ref-status" role="status" aria-live="polite"></p>
      </details>
    </div>
    <footer class="cl-card-footer" data-export-hide>
      <button type="button" class="btn cl-download" data-cl-download="${idx}" aria-label="Download ${escape(displayName(s))} as .penpot">${icon('download', { size: 16 })}<span>Download as .penpot</span></button>
      <p class="cl-download-status" role="status" aria-live="polite"></p>
    </footer>
  </article>`;
}

function foundationsHtml(): string {
  const colors = [['surface.canvas', 'Canvas'], ['text.default', 'Ink'], ['action.primary', 'Action'], ['surface.muted', 'Quiet']];
  return `<section class="cl-section cl-foundations" id="cl-foundations">
    <div class="cl-section-head"><div><p class="cl-eyebrow">01 / Foundations</p><h2>A shared visual language.</h2></div><a href="#/components?section=cl-tokens" data-cl-jump="cl-tokens" class="cl-text-link">Explore all tokens ↗</a></div>
    <p class="cl-section-intro">Purposeful colour. Expressive type. A consistent rhythm from the smallest control to the whole page.</p>
    <div class="cl-foundation-grid">
      <article class="cl-foundation"><span class="cl-eyebrow">Colour / semantic</span><div class="cl-colors">${colors.map(([path, name]) => `<div><span style="background:var(--ui-color-${path!.replaceAll('.', '-')})" aria-hidden="true"></span><strong>${name}</strong><code>${path}</code></div>`).join('')}</div><p>Choose a role, then let the active theme supply the colour.</p></article>
      <article class="cl-foundation"><span class="cl-eyebrow">Typography / hierarchy</span><div class="cl-type-specimen">Aa<span>Good type.<br>Clear intent.</span></div><div class="cl-type-scale"><span>64 Display</span><span>28 Heading</span><span>18 Lead</span><span>12 Caption</span></div><p>One family, deliberate changes in size and weight. Large-text preferences scale the hierarchy.</p></article>
      <article class="cl-foundation"><span class="cl-eyebrow">Space & shape / rhythm</span><div class="cl-rhythm">${[2, 4, 8, 16, 24].map(n => `<div><span style="height:${n * 2}px"></span><code>${n}</code></div>`).join('')}<span class="cl-radius-demo">r</span></div><p>Spacing follows the brand rhythm. Controls, panels and floating surfaces each have a named radius.</p></article>
    </div>
  </section>`;
}

function auditHtml(): string {
  return `<section class="cl-section cl-audit" id="cl-audit"><div class="cl-section-head"><div><p class="cl-eyebrow">03 / UI & UX audit</p><h2>Clarity, at every scale.</h2></div><span class="cl-section-kind">7 September 2026</span></div>
    <p class="cl-section-intro">A review of this library’s structure, component coverage and design handoff. Implementation findings are separated from checks that still need a browser.</p>
    <div class="cl-audit-grid">
      <article><span class="cl-audit-state">Updated</span><h3>Hierarchy & density</h3><p>Long implementation notes competed with the component itself. Colour tools and the Design workspace lead the collection, with names above previews and usage notes available on demand.</p></article>
      <article><span class="cl-audit-state">Updated</span><h3>Findability & wayfinding</h3><p>A long inventory needs more than jump pills. Search spans names, descriptions and CSS hooks; category navigation, preview filters and a visible result count narrow the collection.</p></article>
      <article><span class="cl-audit-state">Updated</span><h3>Tokens & handoff</h3><p>The semantic token tree now includes an editorial type hierarchy, section spacing and a 44px action target. Each download contains a reusable component, native text and shapes, and applied colour, type and radius tokens.</p></article>
      <article><span class="cl-audit-state cl-audit-state--open">Browser checked</span><h3>Interaction & accessibility</h3><p>Library actions have visible focus, labelled controls, keyboard navigation and announced download results. Interactive samples and static fixtures are labelled separately. Desktop and phone layouts have been visually checked in light, dark and brand themes. Native Penpot structure is tested; live Penpot import remains a separate check.</p></article>
    </div>
    <div class="cl-audit-grid">
      <article><span class="cl-audit-state">Unified</span><h3>One colour control, four views</h3><p>Named rows, centred compact swatches, a scrollable palette and fine-tuning now share the colour field. HSL is the default; OKLCH is one tab away. The advanced editor keeps the full colour-space registry.</p></article>
      <article><span class="cl-audit-state cl-audit-state--open">Next to consolidate</span><h3>Triggers, tabs & popovers</h3><p>Move the remaining legacy buttons to the shared button primitive, share segment styling while preserving tab and radio semantics, and bring Projects view-options onto the shared popover lifecycle. Swatch cards and editable tiles should share colour data but retain their distinct jobs.</p></article>
    </div>
    <details class="cl-details cl-audit-followup"><summary>Remaining product work & export boundaries</summary><ul><li>Legacy button class families remain in production. Continue migration when their owning view is rewritten; the shared button primitive remains canonical.</li><li>The Projects view-options popover still has a separate implementation.</li><li>Static fixtures show a design state, not the host-dependent workflow. Motion, focus traps, camera and storage need integration testing in their real views.</li><li>Penpot downloads preserve editable text, surfaces and token bindings. Layout is captured at the current preview size; CSS behaviour is not a Penpot prototype. Linear and radial gradients stay editable; conic gradients become colour paths and clipped surfaces become masks. Tiled backgrounds and complex SVG effects may be simplified. Any simplifications are reported beneath the download.</li><li>Font families remain editable; custom fonts must also be available in Penpot.</li></ul></details>
  </section>`;
}

function tokenExplorerHtml(): string {
  const tokens = listLollyUiTokens();
  return `<section class="cl-section" id="cl-tokens"><div class="cl-section-head"><div><p class="cl-eyebrow">02 / Design tokens</p><h2>Decisions you can edit.</h2></div><button class="btn cl-token-export" type="button">Download tokens.json</button></div>
    <p class="cl-section-intro">${tokens.length} semantic roles connect the interface to its foundations. The .penpot files also carry the component’s measured values as applied tokens.</p>
    <details class="cl-token-browser"><summary>Browse the complete token reference <span>${tokens.length} roles</span></summary>
      <label class="cl-search cl-token-search">${icon('search', { size: 18 })}<input type="search" placeholder="Find a token…" aria-label="Find a design token"></label>
      <div class="cl-token-table"><table><caption class="sr-only">Lolly semantic design tokens</caption><thead><tr><th scope="col">Token / CSS variable</th><th scope="col">Type</th><th scope="col">Default value / reference</th></tr></thead><tbody>${tokens.map(tok => `<tr data-cl-token="${escape(tok.path.join('.') + ' ' + tok.type)}"><th scope="row"><code>lolly.ui.${tok.path.join('.')}</code><small>--ui-${tok.path.join('-')}</small></th><td>${escape(tok.type)}</td><td><code>${escape(typeof tok.value === 'string' ? tok.value : JSON.stringify(tok.value))}</code></td></tr>`).join('')}</tbody></table><p class="cl-token-empty" hidden>No matching tokens.</p></div>
    </details><p class="cl-token-status" role="status"></p>
  </section>`;
}

const sectionId = (title: string): string => 'cl-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function sectionLink(id: string, label: string, metaphor: IconMetaphor, count?: number): string {
  return `<a href="#/components?section=${id}" data-cl-jump="${id}">${icon(ICON_METAPHORS[metaphor], { size: 18, className: 'cl-nav-icon' })}<span class="cl-nav-label">${escape(label)}</span><span class="cl-nav-meta"${count == null ? ' aria-hidden="true"' : ''}>${count ?? '↗'}</span></a>`;
}

// A `<dialog>` renders in the browser's top layer, which escapes the stage's
// `contain` - a markup sample with a bare <dialog> would cover the whole page.
// Reduce it to an in-flow element (its own classes still style the chrome) so it
// previews as a contained card. Overlays that merely use `position: fixed` are
// already trapped by the stage's containment and need no help.
function neutralizeMarkup(html: string): string {
  const contained = html.replace(/<dialog\b/gi, '<div data-cl-dialog').replace(/<\/dialog>/gi, '</div>');
  return /^\s*<th\b/i.test(contained) ? `<table class="pro-grid"><thead><tr>${contained}</tr></thead></table>` : contained;
}

export async function mountComponents(viewEl: HTMLElement, host: HostV1, _params?: string): Promise<void> {
  document.title = 'Components - Lolly';
  let active = true;
  let clearDownloadRecovery = (): void => {};
  const resetDownloadRecovery = (): void => {
    clearDownloadRecovery();
    clearDownloadRecovery = () => {};
  };
  (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    active = false;
    resetDownloadRecovery();
    previewPopovers.forEach(popover => { popover.close(); });
    previewPopovers.clear();
  };
  viewEl.classList.add('cl-view', 'components-view');

  // A flat, ordered list of every specimen with the section it belongs to - so the
  // stage-fill loop can address each by index without re-walking the tree.
  const flat: Specimen[] = AUDIT_SECTIONS.flatMap(sec => sec.items);
  let n = 0;
  const jump = AUDIT_SECTIONS.map(sec => sectionLink(sectionId(sec.title), sec.title, sec.metaphor, sec.items.length)).join('');
  const interactive = flat.filter(s => renderMode(s) === 'live').length;
  viewEl.innerHTML = `
    ${backHomeHtml({ class: 'home-full cl-back' })}<div class="gallery-topright"></div>
    <header class="cl-head">
      <div class="cl-head-copy"><p class="cl-eyebrow">Lolly / Design system</p><h1 class="cl-title">Small parts.<br><span>Distinctly Lolly.</span></h1>
      <p class="cl-sub">Colour instruments, tactile controls and creative workspaces. Try the parts, inspect their tokens, and take them into Penpot.</p>
      <div class="cl-head-actions"><a class="btn btn--primary" href="#/components?section=cl-inventory" data-cl-jump="cl-inventory">Explore components ${icon('arrowRight', { size: 16 })}</a><button type="button" class="btn cl-export-penpot" data-export-hide>Download visible collection</button></div>
      <p class="cl-export-status" role="status" aria-live="polite"></p></div>
      <a class="cl-cover" href="#/components?section=cl-colour-tools" data-cl-jump="cl-colour-tools" aria-label="Explore colour tools"><div class="cl-cover-top"><span>COLOUR IS A GOOD PLACE TO START</span>${icon('arrowRight', { size: 18 })}</div><div class="cl-cover-art" aria-hidden="true">${palettePreviewSvgs(DEMO.map(p => p.hex))[0]?.svg ?? ''}</div><div class="cl-cover-bottom"><span>One palette. Many possibilities.</span><span>Explore ↗</span></div></a>
    </header>
    <div class="cl-stats"><div><strong>${flat.length}</strong><span>Component specimens</span></div><div><strong>${AUDIT_SECTIONS.length}</strong><span>Component families</span></div><div><strong>${listLollyUiTokens().length}</strong><span>Semantic tokens</span></div><div><strong>${interactive}</strong><span>Interactive previews</span></div></div>
    <div class="cl-layout">
      <aside class="cl-sidebar"><p class="cl-eyebrow">In this library</p><nav aria-label="Library sections">${jump}<div class="cl-nav-divider"></div>${sectionLink('cl-foundations', 'Foundations', 'foundations')}${sectionLink('cl-tokens', 'Design tokens', 'tokens')}${sectionLink('cl-audit', 'UI & UX audit', 'audit')}</nav><div class="cl-sidebar-note"><strong>Take a part. Make it yours.</strong><p>Import any .penpot download from your Penpot dashboard. Open Assets for the component and Tokens for its values.</p></div></aside>
      <main class="cl-library" data-lolly-ui-library>
        <section class="cl-inventory" id="cl-inventory"><div class="cl-section-head"><div><p class="cl-eyebrow">The collection</p><h2>Made for making.</h2></div></div>
          <div class="cl-toolbar"><label class="cl-search">${icon('search', { size: 18 })}<input type="search" class="cl-search-input" placeholder="Find a component, pattern or CSS hook…" aria-label="Search components"></label><label class="cl-filter-label"><span>Preview</span><select class="cl-mode-filter" aria-label="Filter by preview type"><option value="all">All previews</option><option value="live">Interactive</option><option value="sample">Static samples</option><option value="fixture">Design fixtures</option></select></label></div>
          <p class="cl-result-count" role="status" aria-live="polite">Showing ${flat.length} components</p>
          <div class="cl-empty" hidden><h3>No components found.</h3><p>Try another name, CSS hook or preview type.</p><button class="btn cl-reset" type="button">Clear filters</button></div>
          ${AUDIT_SECTIONS.map((sec, i) => `<section class="cl-section cl-component-section" id="${sectionId(sec.title)}"><div class="cl-section-head"><h2><span class="cl-section-number">${String(i + 1).padStart(2, '0')}</span>${escape(sec.title)}</h2><span class="cl-section-kind">${sec.items.length} specimens · ${sec.group === 'common' ? 'Shared' : 'In context'}</span>${useCaseLink(sec.title)}</div>${sec.blurb && sec.title === 'Colour tools' ? `<p class="cl-section-intro">${escape(sec.blurb)}</p>` : ''}<div class="cl-grid">${sec.items.map(item => specimenShell(item, n++)).join('')}</div></section>`).join('')}
        </section>
        ${foundationsHtml()}${tokenExplorerHtml()}<details class="cl-audit-disclosure"><summary>About the library & export fidelity</summary>${auditHtml()}</details>
        <footer class="cl-page-footer"><strong>Lolly, by design.</strong><span>One system. Room for expression.</span></footer>
      </main>
    </div>`;

  // Fill each stage. A live component renders through its LIVE renderer; a markup
  // specimen drops in its sample; a host-bound one shows its source snippet. Any
  // throw shows the error rather than a silent empty box - this is a component
  // surface; failures are the point of looking.
  flat.forEach((item, i) => {
    const stage = viewEl.querySelector<HTMLElement>(`[data-cl-stage="${i}"]`);
    if (!stage) return;
    try {
      if (item.live && LIVE[item.live]) {
        const spec = LIVE[item.live]!;
        const out = spec.render();
        if (typeof out === 'string') stage.innerHTML = out;
        else stage.appendChild(out);
        spec.wire?.(stage);
      } else if (item.markup || componentFixture(item)) {
        stage.innerHTML = neutralizeMarkup(item.markup || componentFixture(item)!);
      } else if (item.code) {
        // Needs the host bridge to run - show the call as a source snippet.
        stage.classList.add('cl-stage--plain');
        stage.innerHTML = `<code class="cl-code">${escape(item.code)}</code>`;
      } else {
        stage.innerHTML = `<span class="cl-broken">no sample</span>`;
      }
      if (item.defined?.includes('profile.ts') || item.defined?.includes('storage')) {
        const context = document.createElement('div');
        context.className = 'cl-preview-context profile-view';
        context.append(...stage.childNodes);
        stage.append(context);
      }
      // A custom profile may omit the gradient preview. Keep demo imagery local
      // and useful in that case, without retrying a failed fallback indefinitely.
      // A specimen's own headings (a fixture's <h4>, a topbar's <h1>) read to a
      // screen reader as sections of the library itself - the outline showed an
      // H1 "This build" and H2s "Delete swatch?", "SUSE", "Storage". The tags stay
      // (the part sheets select on them); only the heading role goes.
      stage.setAttribute('role', 'group');
      stage.setAttribute('aria-label', `Preview: ${displayName(item)}`);
      stage.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => { h.setAttribute('role', 'presentation'); });
      stage.querySelectorAll<HTMLImageElement>('img').forEach(img => {
        const fallback = (): void => {
          if (img.getAttribute('src') === COMPONENT_ARTWORK.icon) return;
          img.src = COMPONENT_ARTWORK.icon;
          img.alt = 'Lolly primary icon';
          img.classList.remove('cl-example-cover');
        };
        img.addEventListener('error', fallback, { once: true });
        if (img.complete && !img.naturalWidth) fallback();
      });
    } catch (err) {
      stage.innerHTML = `<span class="cl-broken">render failed: ${escape(String((err as Error)?.message ?? err))}</span>`;
    }
  });

  // The one nav affordance - now the shared back pill, which already names and
  // returns to the view you arrived from (and falls back to the gallery on a cold
  // deep link), so this view no longer decides that for itself.
  mountBackPill(viewEl);
  // The always-home escape (a dev/design surface is deep-linkable, so it needs a
  // way to the main app) plus the theme cycle - genuinely useful here for eyeing
  // a specimen in light, dark and brand.
  mountHomeFab(viewEl);
  mountThemeFab(viewEl.querySelector('.gallery-topright'), host);

  // The reference block fills the first time it opens: the rendered markup, the
  // import or stylesheet, and the tokens the matching rules read. On demand, so
  // 142 cards cost nothing until one is wanted.
  const tokenSearch = viewEl.querySelector<HTMLInputElement>('.cl-token-search input')!;
  const fillReference = (details: HTMLDetailsElement): void => {
    const idx = Number(details.dataset.clRef);
    const body = details.querySelector<HTMLElement>('[data-cl-ref-body]');
    const stage = viewEl.querySelector<HTMLElement>(`[data-cl-stage="${idx}"]`);
    const spec = flat[idx];
    if (!body || !stage || !spec || body.dataset.filled) return;
    body.dataset.filled = '1';
    const { html, truncated } = markupOf(stage);
    const info = importInfo(spec);
    const tokens = tokensUsedBy(stage);
    const block = (title: string, inner: string, copy?: string): string =>
      `<section class="cl-ref-sec"><div class="cl-ref-head"><span class="cl-eyebrow">${title}</span>${copy !== undefined ? `<button type="button" class="btn btn--sm cl-copy" data-cl-copy="${escape(copy)}">${icon('duplicate', { size: 14 })}<span>Copy</span></button>` : ''}</div>${inner}</section>`;
    const parts: string[] = [];
    if (info.line) parts.push(block('Import', `<pre><code>${escape(info.line)}</code></pre>`, info.line));
    if (info.call) parts.push(block('Call', `<pre><code>${escape(info.call)}</code></pre>`, info.call));
    if (info.stylesheet || info.classes.length) {
      parts.push(block('Classes', `${info.stylesheet ? `<p class="cl-ref-sheet"><code>${escape(info.stylesheet)}</code></p>` : ''}${info.classes.length ? `<div class="cl-ref-chips">${info.classes.map(c => `<code>${escape(c)}</code>`).join('')}</div>` : ''}`, info.classes.length ? info.classes.join(' ') : undefined));
    }
    if (html) parts.push(block('Markup', `<pre><code>${escape(html)}</code></pre>${truncated ? '<p class="cl-ref-note">Trimmed for length - the copy holds the same text.</p>' : ''}`, html));
    if (tokens.length) {
      parts.push(block('Tokens it reads', `<div class="cl-ref-chips">${tokens.map(v => v.startsWith('--ui-')
        ? `<button type="button" class="cl-token-chip" data-cl-token-jump="${escape(v.slice(2).replaceAll('-', '.').replace(/^ui\./, ''))}" title="Find in the token table"><code>${escape(v)}</code></button>`
        : `<code>${escape(v)}</code>`).join('')}</div><p class="cl-ref-note">Read from the stylesheet rules this sample matches. <code>--ui-</code> tokens are in the table below; the rest come from the active brand.</p>`));
    }
    body.innerHTML = parts.join('') || '<p class="cl-ref-note">Nothing to copy: this preview is a source recipe.</p>';
    body.hidden = false;
  };
  viewEl.querySelectorAll<HTMLDetailsElement>('details[data-cl-ref]').forEach(details => {
    details.addEventListener('toggle', () => { if (details.open) fillReference(details); });
  });
  viewEl.addEventListener('click', event => {
    const target = event.target as Element;
    const copyBtn = target.closest<HTMLButtonElement>('[data-cl-copy]');
    if (copyBtn) {
      const status = copyBtn.closest('.cl-ref')?.querySelector<HTMLElement>('.cl-ref-status');
      void copyText(copyBtn.dataset.clCopy || '').then(ok => { if (status) status.textContent = ok ? 'Copied.' : 'Copy failed - select the text and copy it yourself.'; });
      return;
    }
    const jump = target.closest<HTMLButtonElement>('[data-cl-token-jump]');
    if (jump) {
      tokenSearch.value = jump.dataset.clTokenJump || '';
      tokenSearch.dispatchEvent(new Event('input'));
      const browser = viewEl.querySelector<HTMLDetailsElement>('.cl-token-browser');
      if (browser) browser.open = true;
      viewEl.querySelector<HTMLElement>('#cl-tokens')?.scrollIntoView({ block: 'start' });
      tokenSearch.focus({ preventScroll: true });
    }
  });

  const search = viewEl.querySelector<HTMLInputElement>('.cl-search-input')!;
  const mode = viewEl.querySelector<HTMLSelectElement>('.cl-mode-filter')!;
  const cards = [...viewEl.querySelectorAll<HTMLElement>('[data-cl-card]')];
  const filter = (): void => {
    const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let count = 0;
    cards.forEach((card, i) => {
      const s = flat[i]!;
      const haystack = [s.name, s.description, s.css, s.defined, ...(s.eg || [])].join(' ').toLowerCase();
      card.hidden = !terms.every(term => haystack.includes(term)) || (mode.value !== 'all' && renderMode(s) !== mode.value);
      if (!card.hidden) count++;
    });
    viewEl.querySelectorAll<HTMLElement>('.cl-component-section').forEach(section => { section.hidden = !section.querySelector('.cl-card:not([hidden])'); });
    viewEl.querySelector('.cl-result-count')!.textContent = `Showing ${count} of ${flat.length} components`;
    viewEl.querySelector<HTMLElement>('.cl-empty')!.hidden = count !== 0;
  };
  search.addEventListener('input', filter); mode.addEventListener('change', filter);
  viewEl.querySelector('.cl-reset')?.addEventListener('click', () => { search.value = ''; mode.value = 'all'; filter(); search.focus(); });
  viewEl.querySelectorAll<HTMLElement>('[data-cl-jump]').forEach(link => { link.addEventListener('click', event => {
    event.preventDefault();
    const target = viewEl.querySelector<HTMLElement>(`#${link.dataset.clJump}`);
    if (!target) return;
    target.closest<HTMLDetailsElement>('.cl-audit-disclosure')?.setAttribute('open', '');
    if (target.hidden) { search.value = ''; mode.value = 'all'; filter(); }
    target.scrollIntoView({ block: 'start' });
    target.tabIndex = -1; target.focus({ preventScroll: true });
    viewEl.querySelectorAll('[data-cl-jump]').forEach(a => { a.removeAttribute('aria-current'); });
    link.setAttribute('aria-current', 'location');
  }); });
  // A specimen's links and submit controls must not navigate away from the
  // library or mutate app state. Live renderers own their explicit local wiring.
  viewEl.querySelectorAll<HTMLElement>('.cl-stage').forEach(stage => {
    stage.addEventListener('click', e => { if ((e.target as Element).closest('a')) e.preventDefault(); });
    stage.addEventListener('submit', e => e.preventDefault());
  });
  let exporting = false;
  const runDownload = async (button: HTMLButtonElement, indexes: number[], status: HTMLElement): Promise<void> => {
    if (exporting) return;
    if (!indexes.length) { status.textContent = 'Choose at least one visible component.'; return; }
    exporting = true;
    resetDownloadRecovery();
    const buttons = [...viewEl.querySelectorAll<HTMLButtonElement>('[data-cl-download], .cl-export-penpot, .cl-token-export')];
    buttons.forEach(b => { b.disabled = true; });
    button.setAttribute('aria-busy', 'true');
    status.textContent = `Building ${indexes.length === 1 ? 'editable component' : indexes.length + ' editable components'}…`;
    try {
      const { buildComponentDownload } = await import('../lib/component-capture.ts');
      const { blob, filename, notes } = await buildComponentDownload(indexes.map(i => ({ name: displayName(flat[i]!), node: viewEl.querySelector<HTMLElement>(`[data-cl-stage="${i}"]`)! })), indexes.length === 1 ? `lolly-${String(indexes[0]! + 1).padStart(3, '0')}-${slug(displayName(flat[indexes[0]!]!))}` : 'lolly-component-library');
      if (!active) return;
      const savedMessage = 'Saved. Import the file in Penpot to edit its component and tokens.' + (notes.length ? ' ' + notes.join(' ') : '');
      status.textContent = 'File ready. Check your browser’s downloads, then import the file in Penpot.' + (notes.length ? ' ' + notes.join(' ') : '');
      clearDownloadRecovery = offerDownloadRecovery(status, blob, filename, savedMessage);
      await host.export.download(blob, filename);
    } catch (error) {
      const failure = `Download failed. ${error instanceof Error ? error.message : String(error)} Please try again. `;
      if (status.querySelector('.cl-download-recovery')) status.prepend(failure);
      else status.textContent = failure;
    } finally {
      exporting = false; buttons.forEach(b => { b.disabled = false; }); button.removeAttribute('aria-busy');
    }
  };
  viewEl.querySelectorAll<HTMLButtonElement>('[data-cl-download]').forEach(button => { button.addEventListener('click', () => {
    void runDownload(button, [Number(button.dataset.clDownload)], button.closest('.cl-card-footer')!.querySelector<HTMLElement>('.cl-download-status')!);
  }); });
  const exportButton = viewEl.querySelector<HTMLButtonElement>('.cl-export-penpot')!;
  exportButton.addEventListener('click', () => { void runDownload(exportButton, cards.flatMap((card, i) => card.hidden ? [] : [i]), viewEl.querySelector<HTMLElement>('.cl-export-status')!); });
  tokenSearch.addEventListener('input', event => {
    const query = (event.target as HTMLInputElement).value.trim().toLowerCase();
    let count = 0;
    viewEl.querySelectorAll<HTMLElement>('[data-cl-token]').forEach(row => { row.hidden = !row.dataset.clToken!.includes(query); if (!row.hidden) count++; });
    viewEl.querySelector<HTMLElement>('.cl-token-empty')!.hidden = count > 0;
  });
  viewEl.querySelector<HTMLButtonElement>('.cl-token-export')!.addEventListener('click', async event => {
    if (exporting) return;
    exporting = true;
    const button = event.currentTarget as HTMLButtonElement;
    const status = viewEl.querySelector<HTMLElement>('.cl-token-status')!;
    const buttons = [...viewEl.querySelectorAll<HTMLButtonElement>('[data-cl-download], .cl-export-penpot, .cl-token-export')];
    buttons.forEach(b => { b.disabled = true; });
    button.setAttribute('aria-busy', 'true');
    resetDownloadRecovery();
    status.textContent = 'Building tokens…';
    try {
      const [{ readComponentTokenValues }, { componentTokenDocument }] = await Promise.all([import('../lib/component-capture.ts'), import('../lib/component-penpot.ts')]);
      const tokens = componentTokenDocument(readComponentTokenValues(viewEl));
      if (!active) return;
      const blob = new Blob([JSON.stringify(tokens, null, 2)], { type: 'application/json' });
      const filename = 'lolly-ui.tokens.json';
      status.textContent = 'Tokens ready with the current theme’s semantic colours. Check your browser’s downloads.';
      clearDownloadRecovery = offerDownloadRecovery(status, blob, filename, 'Tokens saved.');
      await host.export.download(blob, filename);
    } catch (error) {
      const failure = `Token download failed: ${String(error)} `;
      if (status.querySelector('.cl-download-recovery')) status.prepend(failure);
      else status.textContent = failure;
    }
    finally { exporting = false; buttons.forEach(b => { b.disabled = false; }); button.removeAttribute('aria-busy'); }
  });
  const initialSection = new URLSearchParams(_params || '').get('section');
  if (initialSection && /^cl-[a-z0-9-]+$/.test(initialSection)) viewEl.querySelector(`#${initialSection}`)?.scrollIntoView();
}
