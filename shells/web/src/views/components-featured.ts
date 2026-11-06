// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { mountFeaturedRow, type FeaturedEntry, type FeaturedRowHandle, type FeaturedViewMode } from '../components/featured-row.ts';
import { coverFormats } from '../lib/featured-render.ts';
import { galleryPreviewLooks } from '../lib/gallery-preview.ts';
import { segHtml } from '../lib/seg.ts';
import type { GalleryTool } from './gallery.ts';

export function featuredRowExample(): string {
  return `<div class="cl-featured-demo">
    <div class="cl-featured-controls">${segHtml('cl-featured-view', [
      { id: 'gallery', label: 'Filmstrip' }, { id: 'coverflow', label: 'Cover Flow' },
    ], 'coverflow', 'Featured layout')}</div>
    <div data-cl-featured-mount></div>
  </div>`;
}

/** Use the mounted pack's curation and the gallery's active-brand render path. */
function featuredEntries(): FeaturedEntry[] {
  const index = (window.__toolIndex ?? window.__toolIndexSlim) as { tools: GalleryTool[] } | undefined;
  const tools = index?.tools.filter(tool => tool.listed !== false) ?? [];
  const curated = tools.filter(tool => tool.featured?.order != null);
  return (curated.length ? curated : tools)
    .slice().sort((a, b) => (a.featured?.order ?? 999) - (b.featured?.order ?? 999))
    .slice(0, 6).map(tool => {
      const iconHero = tool.category === 'utility';
      return {
        id: tool.id, name: tool.name, icon: tool.icon, version: tool.version,
        formats: coverFormats(tool), status: tool.status, galleryPreview: !iconHero,
        examples: iconHero ? undefined : galleryPreviewLooks(tool),
        featured: { ...tool.featured, blurb: tool.featured?.blurb ?? tool.description, ...(iconHero ? { variants: undefined } : {}) },
      };
    });
}

export function wireFeaturedRowExample(stage: HTMLElement, host: HostV1): () => void {
  const mount = stage.querySelector<HTMLElement>('[data-cl-featured-mount]')!;
  const buttons = [...stage.querySelectorAll<HTMLButtonElement>('[data-be-seg="cl-featured-view"] button')];
  const entries = featuredEntries();
  if (!entries.length) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = 'No tools are available in this catalog.';
    mount.append(note);
    buttons.forEach(button => { button.disabled = true; });
    return () => {};
  }
  const controller = new AbortController();
  let row: FeaturedRowHandle | undefined;
  const show = (mode: FeaturedViewMode): void => {
    // The gallery remounts too: filmstrip opts out of motion at mount time.
    row?.destroy();
    row = mountFeaturedRow(mount, entries, host, {
      viewMode: mode, staticStrip: mode === 'gallery', ariaLabel: 'Featured tools',
    });
    buttons.forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.val === mode)); });
  };
  buttons.forEach(button => { button.addEventListener('click', () => {
    if (button.getAttribute('aria-pressed') === 'true') return;
    show(button.dataset.val as FeaturedViewMode);
  }, { signal: controller.signal }); });
  show('coverflow');
  return () => { controller.abort(); row?.destroy(); };
}
