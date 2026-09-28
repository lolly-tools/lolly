// SPDX-License-Identifier: MPL-2.0
/** Review a saved collection and deliver it through the existing batch job. */
import './studio3d-collection.css';
import { type InputModelItem, type InputValue, matchesShowIf } from '../../../../engine/src/inputs.ts';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import { safeFileName } from '@lolly-tools/core/file-v1';
import type { AssetRef } from '../../../../packages/core/src/host-v1.ts';
import {
  type StudioValues,
  studioCollectionRows,
  studioCollectionSize,
  studioSheetSize,
} from '../../../../engine/src/studio3d-collection.ts';
import { mountModal } from '../components/modal.ts';
import { t, tRaw } from '../i18n.ts';
import { isBatchRunActive, startBatchExport } from '../lib/batch-job.ts';
import { applyStudio, listStudios } from '../lib/studio-library.ts';
import { renderStudioCollection } from '../lib/studio3d/collection-preview.ts';
import { studioShaperFor } from '../lib/studio3d/mount.ts';
import { createUserTemplateStore } from '../lib/user-templates.ts';
import type { PanelEl, WebToolHost } from './tool.ts';
import { syncInputs } from './tool-inputs.ts';

const controls = new Set([
  'studio',
  'materialMode',
  'colorA',
  'colorB',
  'finishA',
  'finishB',
  'surfaceFinishes',
  'faceFinishA',
  'bevelFinishA',
  'sideFinishA',
  'faceFinishB',
  'bevelFinishB',
  'sideFinishB',
  'exposure',
  'collectionSize',
]);
const open = new WeakSet<Runtime>();

/**
 * Add several sources in one visit to the library: the picker stays open in collect
 * mode and every vector or model chosen becomes one row of the arrangement (or the
 * collection), named after the asset. The tool's hook sets the kind from the asset
 * and places new objects beside the others.
 */
export async function addStudioSources(
  runtime: Runtime,
  host: WebToolHost,
  endGesture: () => void
): Promise<number> {
  const values = () => Object.fromEntries(runtime.getModel().map((item) => [item.id, item.value]));
  const list = values().source === 'collection' ? 'subjects' : 'objects';
  const limit = list === 'subjects' ? 24 : 16;
  let added = 0;
  if (!host.assets.pick) return 0;
  // The host's picker takes the web-only collect options; the core type names the rest.
  const options: Record<string, unknown> = {
    title: list === 'subjects' ? 'Add items to the collection' : 'Add objects to the scene',
    types: ['vector', 'model'],
    allowUpload: true,
    initialTab: 'library',
    collect: {
      assetsOnly: true,
      folderName: list === 'subjects' ? 'the collection' : 'the scene',
      guided: {
        hint:
          list === 'subjects'
            ? 'Choose SVG artwork or 3D models; each becomes an item of the collection. Select Done when you have them all.'
            : 'Choose SVG artwork or 3D models; each becomes an object placed beside the others. Select Done when you have them all.',
      },
      tools: [],
      onAsset: async (ref: AssetRef) => {
        if (ref.type !== 'vector' && ref.type !== 'model')
          return { ok: false, label: 'Only SVG artwork and 3D models can join the scene.' };
        const rows = Array.isArray(values()[list]) ? (values()[list] as InputValue[]) : [];
        if (rows.length >= limit) return { ok: false, label: `The ${list === 'subjects' ? 'collection' : 'scene'} holds up to ${limit}.` };
        const name = String(ref.meta?.name ?? ref.id.replace(/^.*\//, '')).replace(/\.[a-z0-9]+$/i, '');
        // A newcomer matches the size of what is already there, so the group stays a group.
        const scales = rows
          .map((row) => Number((row as Record<string, unknown>).scale))
          .filter((n) => Number.isFinite(n) && n > 0)
          .sort((a, b) => a - b);
        const scale = list === 'objects' ? (scales[Math.floor(scales.length / 2)] ?? 0.6) : undefined;
        endGesture();
        await runtime.setInput(list, [
          ...rows,
          {
            name,
            kind: ref.type === 'model' ? 'model' : 'artwork',
            asset: ref.id,
            ...(scale ? { scale } : {}),
          } as InputValue,
        ]);
        endGesture();
        added++;
        return { ok: true, label: `Added ${name}` };
      },
      onSession: async () => false,
      onOpenTool: () => {},
      onQuickAddTool: async () => false,
    },
  };
  await host.assets.pick(options as Parameters<NonNullable<typeof host.assets.pick>>[0]);
  return added;
}

/** Fits one line to a width, ending in three dots when it has to be cut. */
function fitLine(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}...`).width > width) cut = cut.slice(0, -1);
  return `${cut}...`;
}

/**
 * The contact sheet as one picture: every tile in a grid at the size it was previewed,
 * its name under it, and the collection named in the top corner. The tiles are the
 * previews already on screen, so the file says exactly what the review said, and the
 * drawing is plain 2D canvas work with no second trip to the GPU.
 */
async function drawContactSheet(
  tiles: { name: string; blob: Blob }[],
  size: { width: number; height: number },
  title: string
): Promise<Blob> {
  const columns = Math.max(1, Math.min(6, Math.ceil(Math.sqrt(tiles.length))));
  const rows = Math.ceil(tiles.length / columns);
  const gap = 24;
  const label = Math.max(20, Math.round(size.height * 0.12));
  const type = Math.max(11, Math.round(label * 0.6));
  const head = Math.round(type * 2.6);
  const canvas = document.createElement('canvas');
  canvas.width = gap * 2 + columns * size.width + (columns - 1) * gap;
  canvas.height = gap * 2 + head + rows * (size.height + label) + (rows - 1) * gap;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This device cannot draw the contact sheet.');
  const family = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#182920';
  ctx.font = `600 ${Math.round(type * 1.25)}px ${family}`;
  ctx.fillText(fitLine(ctx, title, canvas.width - gap * 2), gap, gap);
  for (const [index, tile] of tiles.entries()) {
    const bitmap = await createImageBitmap(tile.blob);
    try {
      const x = gap + (index % columns) * (size.width + gap);
      const y = gap + head + Math.floor(index / columns) * (size.height + label + gap);
      ctx.drawImage(bitmap, x, y, size.width, size.height);
      ctx.font = `${type}px ${family}`;
      ctx.fillStyle = '#182920';
      ctx.fillText(fitLine(ctx, tile.name, size.width), x, y + size.height + Math.round(label * 0.2));
    } finally {
      bitmap.close();
    }
  }
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The contact sheet could not be saved.'))),
      'image/png'
    )
  );
}

/** `changed` is the tool view's automatic-history signal: applying a saved studio writes
 *  through applyPatch, round the setInput wrapper that normally reports an edit. */
export function openStudioCollection(runtime: Runtime, host: WebToolHost, changed?: () => void): void {
  if (open.has(runtime)) return;
  open.add(runtime);
  let closed = false,
    timer = 0,
    generation = 0;
  let abort = new AbortController(),
    work = Promise.resolve();
  let unsubscribe = () => {};
  const urls = new Set<string>();
  const releaseImages = () => {
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
  };
  const dialog = mountModal(
    `<header><h2>Review collection</h2><button type="button" data-studio-close aria-label="Close collection review">Close</button></header>
    <p>Change the shared look here. Edit an item to adjust its framing. Save the studio to keep the whole collection together.</p>
    <div class="studio-collection-layout"><div><div data-studio-collection-studio hidden></div><div data-studio-collection-controls class="tool-inputs"></div></div>
      <div><p data-studio-collection-status role="status">Preparing previews...</p><div data-studio-collection-grid></div></div></div>
    <footer><span data-studio-collection-sizes>Previews use 8 samples. Exports use the saved render quality and start at the beginning of the animation loop.</span>
      <button type="button" data-studio-sheet-download disabled>${t('Download sheet')}</button>
      <button type="button" data-studio-set-export disabled>Export PNG set</button></footer>`,
    {
      className: 'studio-collection-dialog',
      ariaLabel: 'Review studio collection',
      onClose: () => {
        closed = true;
        generation++;
        clearTimeout(timer);
        abort.abort();
        unsubscribe();
        panel._inputsDispose?.();
        releaseImages();
        open.delete(runtime);
      },
    }
  );
  const panel = dialog.el.querySelector<PanelEl>('[data-studio-collection-controls]')!;
  const grid = dialog.el.querySelector<HTMLElement>('[data-studio-collection-grid]')!;
  const status = dialog.el.querySelector<HTMLElement>('[data-studio-collection-status]')!;
  const exporting = dialog.el.querySelector<HTMLButtonElement>('[data-studio-set-export]')!;
  const sheeting = dialog.el.querySelector<HTMLButtonElement>('[data-studio-sheet-download]')!;
  const sizes = dialog.el.querySelector<HTMLElement>('[data-studio-collection-sizes]')!;
  const studioSlot = dialog.el.querySelector<HTMLElement>('[data-studio-collection-studio]')!;
  let previous: InputModelItem[] | null = null,
    lastKey = '',
    lastModel = '',
    snapshot: StudioValues | null = null;
  /** The rendered tiles of the sheet on screen, in item order, for the one-file download. */
  let tiles: { name: string; blob: Blob }[] = [];
  let tileSize = { width: 0, height: 0 };
  const readValues = (): StudioValues =>
    Object.fromEntries(runtime.getModel().map((item) => [item.id, item.value]));
  const read = async (url: string, signal: AbortSignal): Promise<Uint8Array> => {
    signal.throwIfAborted();
    if (!host.assets.bytes) throw new Error('Asset bytes are unavailable in this app.');
    const bytes = await host.assets.bytes(url);
    signal.throwIfAborted();
    return bytes;
  };
  const refresh = (values: StudioValues, resolved: StudioValues) => {
    abort.abort();
    abort = new AbortController();
    const signal = abort.signal,
      gen = ++generation;
    exporting.disabled = true;
    sheeting.disabled = true;
    snapshot = null;
    status.textContent = 'Updating previews...';
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      work = work
        .catch(() => {})
        .then(async () => {
          if (closed || gen !== generation) return;
          releaseImages();
          grid.replaceChildren();
          tiles = [];
          try {
            const rows = studioCollectionRows(resolved),
              size = studioCollectionSize(values);
            // Both numbers are stated: what the contact sheet draws and what a delivered
            // file will be, because they are no longer the same size.
            tileSize = studioSheetSize(size);
            sizes.textContent = tRaw(
              'Previews render at {pw} by {ph} pixels with 8 samples. Each exported image is {w} by {h} at the saved render quality, from the start of the animation loop.',
              { pw: tileSize.width, ph: tileSize.height, w: size.width, h: size.height }
            );
            const cards = rows.map((row) => {
              const card = document.createElement('article');
              const image = document.createElement('div');
              image.className = 'studio-collection-image';
              image.style.aspectRatio = `${size.width} / ${size.height}`;
              const name = document.createElement('h3');
              name.textContent = row.name;
              const detail = document.createElement('p');
              detail.textContent = row.ownFraming ? 'Own framing' : 'Shared framing';
              const edit = document.createElement('button');
              edit.type = 'button';
              edit.textContent = `Edit ${row.name}`;
              edit.onclick = () => {
                void runtime.setInput('activeSubject', row.index + 1);
                dialog.close();
              };
              card.append(image, name, detail, edit);
              grid.append(card);
              return { image, detail };
            });
            let done = 0,
              failed = 0;
            await renderStudioCollection(rows, read, signal, size, (row, result) => {
              if (closed || gen !== generation) return;
              const card = cards[row.index]!;
              if (result instanceof Error) {
                failed++;
                card.detail.textContent = result.message;
                card.detail.setAttribute('role', 'alert');
              } else {
                const url = URL.createObjectURL(result);
                urls.add(url);
                const img = document.createElement('img');
                img.src = url;
                img.alt = `${row.name}, rendered in this studio`;
                card.image.append(img);
                tiles.push({ name: row.name, blob: result });
              }
              status.textContent = `Rendered ${++done} of ${rows.length}`;
            }, studioShaperFor(host));
            if (closed || gen !== generation) return;
            status.textContent = failed
              ? `${failed} item(s) need attention before export.`
              : `${rows.length} previews ready. All share this studio.`;
            if (!failed) {
              snapshot = structuredClone(values);
              exporting.disabled = false;
            }
            sheeting.disabled = !tiles.length;
          } catch (error) {
            if (!closed && gen === generation && !signal.aborted)
              status.textContent = (error as Error).message;
          }
        });
    }, 250);
  };
  unsubscribe = runtime.subscribe(() => {
    if (closed) return;
    const model = runtime.getModel();
    const values = readValues();
    previous = syncInputs(
      panel,
      model
        .filter((item) => controls.has(item.id) && matchesShowIf(item.showIf, values))
        .map((item) => ({ ...item, showIf: undefined })),
      previous,
      runtime,
      host,
      () => {},
      '3d-studio'
    );
    if (values.source !== 'collection') {
      dialog.close();
      return;
    }
    const modelKey = JSON.stringify(values);
    if (modelKey !== lastModel) {
      lastModel = modelKey;
      abort.abort();
      generation++;
      clearTimeout(timer);
      snapshot = null;
      exporting.disabled = true;
      status.textContent = 'Updating previews...';
    }
    // Read the same settled marker as the main renderer, including resolved asset URLs.
    const key = runtime.getHydrated();
    if (key !== lastKey) {
      lastKey = key;
      const template = document.createElement('template');
      template.innerHTML = key;
      const marker = template.content.querySelector<HTMLElement>('[data-lolly-studio]');
      if (marker?.dataset.lollyStudio) {
        const resolved = JSON.parse(marker.dataset.lollyStudio) as { values: StudioValues };
        refresh(structuredClone(values), resolved.values);
      }
    }
  });
  dialog.el.querySelector<HTMLButtonElement>('[data-studio-close]')!.onclick = () => dialog.close();
  exporting.onclick = () => {
    if (!snapshot || closed) return;
    if (isBatchRunActive()) {
      status.textContent = 'Wait for the current batch export to finish.';
      return;
    }
    const values = structuredClone(snapshot),
      size = studioCollectionSize(values);
    const rows = studioCollectionRows(values).map((row) => ({
      toolId: '3d-studio',
      values: row.values,
      filename: row.filename,
      format: 'png',
      outWidth: size.width,
      outHeight: size.height,
    }));
    const name = String(values.collectionName || 'Studio collection').slice(0, 120);
    startBatchExport(`Rendering ${name}`, async (job) => {
      const { runBatchWithProgress } = await import('../pro/run-overlay.ts');
      return runBatchWithProgress(host, rows, { job, format: 'png', zipBaseName: name });
    });
    status.textContent =
      'PNG set queued. Progress and cancellation are available in the job notification.';
  };
  sheeting.onclick = () => {
    if (closed || !tiles.length) return;
    const drawn = tiles.slice(),
      size = { ...tileSize };
    const name = String(readValues().collectionName || 'Studio collection').slice(0, 120);
    sheeting.disabled = true;
    status.textContent = t('Drawing the contact sheet...');
    void drawContactSheet(drawn, size, name)
      .then(async (blob) => {
        await host.export.download(blob, safeFileName(`${name} contact sheet.png`));
        if (closed) return;
        status.textContent = tRaw('Contact sheet saved: {count} items on one page.', {
          count: drawn.length,
        });
      })
      .catch((error: unknown) => {
        if (!closed) status.textContent = (error as Error).message;
      })
      .finally(() => {
        if (!closed) sheeting.disabled = false;
      });
  };
  // A saved studio (the Studio library) writes its whole look into the shared values;
  // the previews then refresh through the ordinary subscription, like any other edit.
  void (async () => {
    try {
      const saved = await listStudios(createUserTemplateStore(host), '3d-studio');
      if (closed || !saved.length) return;
      const label = document.createElement('label');
      label.className = 'studio-collection-pick';
      label.textContent = t('Studio');
      const select = document.createElement('select');
      select.append(new Option(t('Keep the current look'), ''));
      for (const studio of saved) select.append(new Option(studio.name, studio.id));
      select.onchange = () => {
        const chosen = saved.find((studio) => studio.id === select.value);
        if (!chosen) return;
        status.textContent = tRaw('Applying {name}...', { name: chosen.name });
        void applyStudio(runtime, chosen, changed).catch((error: unknown) => {
          if (!closed) status.textContent = (error as Error).message;
        });
      };
      label.append(' ', select);
      studioSlot.replaceChildren(label);
      studioSlot.hidden = false;
    } catch {
      // A profile that cannot list saved studios simply offers none.
    }
  })();
}
