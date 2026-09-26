// SPDX-License-Identifier: MPL-2.0
/** Real component renderers with local sample data. No profile writes or media. */
import { createAudioDock } from '../../../../packages/audio-dock/src/index.ts';
import { sessionTile, folderTile, CHECK_ICON } from '../folder-tiles.ts';
import { bulkBarHtml, syncBulkBar } from '../lib/bulk-bar.ts';
import { menuItemHtml } from '../lib/context-menu.ts';
import { renderBrandWheel } from '../lib/palette-wheel.ts';
import { icon } from '../lib/icons.ts';
import { COMPONENT_ARTWORK } from './components-data.ts';
import { formatTriggerHtml } from './export-format-picker.ts';

export function exportFieldsExample(): string {
  return `<div class="cl-export-fields"><div class="filename-extension"><input class="export-filename" value="colour-study" aria-label="Filename">${formatTriggerHtml('png', format => format.toUpperCase())}</div><div class="export-dims"><div class="dim-field">${icon('arrowsH', { className: 'dim-icon' })}<input type="number" data-action="export-width" value="1080" aria-label="Width"></div><div class="dim-field">${icon('arrowsV', { className: 'dim-icon' })}<input type="number" data-action="export-height" value="1080" aria-label="Height"></div><select class="dim-unit" aria-label="Units"><option>px</option><option>mm</option></select></div></div>`;
}

export function projectTilesExample(): string {
  return `<div class="cl-project-grid">${sessionTile({ slot: 'cl-gradient', toolId: 'gradient', label: 'Colour study', thumb: COMPONENT_ARTWORK.gradient, updatedAt: '2026-09-01T12:00:00Z' }, { toolName: 'Mesh gradient', selectable: true, selected: true, meta: { format: 'svg' } })}${folderTile({ id: 'cl-launch', name: 'Launch kit', items: ['a', 'b', 'c'] }, { memberPreviews: [{ thumb: COMPONENT_ARTWORK.gradient }, { thumb: COMPONENT_ARTWORK.icon }] })}</div>`;
}

export function catalogTileExample(selected = false): string {
  return `<div class="catalog cl-object-context${selected ? ' has-selection' : ''}">
    <div class="cat-tile${selected ? ' is-selected' : ''}">
      <button type="button" class="cat-check" data-select="cl-catalog" aria-pressed="${selected}" aria-label="Select catalog artwork">${CHECK_ICON}</button>
      <button type="button" class="cat-tile-open" aria-label="Artwork preview">
        <span class="cat-tile-fig"><img class="cat-thumb" src="${COMPONENT_ARTWORK.gradient}" alt="" loading="lazy"></span>
        <span class="cat-tile-cap"><span class="cat-tile-name">Colour study</span><span class="cat-tile-sub"><span class="cat-src cat-src--user">Yours</span> · SVG</span></span>
      </button>
    </div>
  </div>`;
}

/** The production card classes, with selection changes confined to the specimen. */
export function objectCardsExample(): string {
  const dot = (ref: string, label: string): string => `<button type="button" class="tile-check" data-select="${ref}" aria-pressed="false" aria-label="Select ${label}">${CHECK_ICON}</button>`;
  return `<div class="cl-object-demo">
    <p>Use the selection dots, or focus one and press Space.</p>
    <div class="cl-object-grid">
      <div><p class="cl-eyebrow">Assets</p>${catalogTileExample(true)}</div>
      <div><p class="cl-eyebrow">Tools</p><div class="gallery cl-object-context">
        <article class="gtile">
          ${dot('cl-tool', 'tool')}
          <button type="button" class="gtile-hero" aria-label="Tool preview"><img class="gtile-hero-img" src="${COMPONENT_ARTWORK.gradient}" alt="" loading="lazy"></button>
          <div class="gtile-body"><div class="gtile-cap"><span class="tool-card-icon" aria-hidden="true">${icon('image')}</span><span class="gtile-meta"><span class="gtile-name">Mesh gradient</span><p class="gtile-desc">Make a colour study.</p></span></div></div>
        </article>
      </div></div>
      <div><p class="cl-eyebrow">Utilities</p><div class="gallery cl-object-context">
        <article class="gtile gtile--utility">
          ${dot('cl-utility', 'utility')}
          <div class="gtile-body"><div class="gtile-cap"><span class="tool-card-icon" aria-hidden="true">${icon('scissors')}</span><span class="gtile-meta"><span class="gtile-name">Trim</span><p class="gtile-desc">Cut a clip on your device.</p></span></div></div>
        </article>
      </div></div>
      <div><p class="cl-eyebrow">Projects</p><div class="projects cl-object-context has-selection">
        ${sessionTile({ slot: 'cl-object-project', toolId: 'gradient', label: 'Colour study', thumb: COMPONENT_ARTWORK.gradient }, { selectable: true, selected: true, meta: { format: 'svg' } })}
      </div></div>
    </div>
    <output data-cl-object-status role="status">2 selected</output>
  </div>`;
}

export function wireObjectCardsExample(stage: HTMLElement): void {
  const sync = (): void => {
    const selected = stage.querySelectorAll('.is-selected').length;
    for (const context of stage.querySelectorAll('.cl-object-context')) context.classList.toggle('has-selection', selected > 0);
    const status = stage.querySelector('[data-cl-object-status]');
    if (status) status.textContent = `${selected} selected`;
  };
  sync();
  stage.addEventListener('click', event => {
    const dot = (event.target as Element).closest<HTMLButtonElement>('button[data-select]');
    const tile = dot?.closest<HTMLElement>('.cat-tile, .gtile, .folder-tile');
    if (!dot || !tile) return;
    dot.setAttribute('aria-pressed', String(tile.classList.toggle('is-selected')));
    sync();
  });
}

export function selectionBarExample(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'cl-selection-demo';
  const config = { prefix: 'projects-bulkbar', rootSelector: '.cl-selection-demo', count: () => 3,
    actions: [{ id: 'download', label: 'Download', icon: icon('download') }, { id: 'move', label: 'Move', icon: icon('folder') }] };
  root.innerHTML = bulkBarHtml(config);
  syncBulkBar(root, config);
  return root;
}

export function contextMenuExample(): string {
  // This is an in-flow specimen, not an open application menu. Keep ordinary
  // button semantics so assistive technology does not enter a modal menu mode.
  return `<div class="folder-menu" role="group" aria-label="Project actions">${menuItemHtml('open', icon('folder'), 'Open')}${menuItemHtml('duplicate', icon('duplicate'), 'Duplicate')}${menuItemHtml('download', icon('download'), 'Download')}${menuItemHtml('delete', icon('trash'), 'Delete', { danger: true })}</div>`.replaceAll(' role="menuitem"', '');
}

export function editableWheelExample(): string {
  return `<div class="cl-color-panel">${renderBrandWheel([
    { idx: 0, hex: '#30ba78', label: 'Jungle' }, { idx: 1, hex: '#2453ff', label: 'Klein' },
    { idx: 2, hex: '#fe7c3f', label: 'Persimmon' }, { idx: 3, hex: '#efefef', label: 'Mist' },
  ])}</div>`;
}

export function audioDockExample(): HTMLElement {
  // The real shell, captured in its paused state. Audio, placement persistence,
  // dragging and global keyboard listeners are disposed before it is presented.
  const dock = createAudioDock({ host: {
    isPlaying: () => false, togglePlay() {}, next() {}, prev() {},
    onChange: () => () => {}, nowPlaying: () => ({ title: 'A little focus', subtitle: 'Neurospicy · Ambient', kind: 'music' }),
    currentTime: () => 42, duration: () => 180, seek() {},
  }, capabilities: { music: true }, collapse: 'full' });
  const preview = dock.el.cloneNode(true) as HTMLElement;
  dock.destroy();
  return preview;
}
