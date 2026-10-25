// SPDX-License-Identifier: MPL-2.0
/**
 * catalog: the Swatches section as cards. One card per brand colour, opened,
 * selected, menued and downloaded the way an asset card is.
 *
 * A card is the asset card's own markup (`.cat-tile`, its selection dot, its
 * open button), so it takes the Assets layouts, the card size and the selected
 * look with no copy of them. The selection is a store of its own: the asset
 * selection's actions refuse an id they do not know, so a swatch never joins
 * one. Picking a swatch drops an asset selection and the other way round, so
 * one selection bar shows at a time.
 *
 * A selection downloads in the palette formats the section's own download row
 * offers, through the same exporters. Each format is checked against the
 * colours first (lib/swatch-export.ts `swatchFit`): a colour a format cannot
 * hold is left out and the menu lists the colour, rather than the file
 * quietly dropping the colour.
 *
 * Every function takes the shared `cat: CatCtx` first (see context.ts).
 */
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { icon } from '../../lib/icons.ts';
import { copyText } from '../../lib/copy-text.ts';
import { menuItemHtml } from '../../lib/context-menu.ts';
import { mountBodyPopover, pointAnchor } from '../../components/body-popover.ts';
import { bulkBarHtml, syncBulkBar, wireEscapeClearsSelection, type BulkBarConfig } from '../../lib/bulk-bar.ts';
import { wireTileSelect } from '../../lib/tile-select.ts';
import { saveFavouriteAssets } from '../../lib/asset-favourites.ts';
import { exportSwatches, paletteEntriesToSwatches, swatchFit } from '../../lib/swatch-export.ts';
import type { SwatchExportFormat, SwatchFit } from '../../lib/swatch-export.ts';
import { inkText, isLockedInk, paletteInDisplayOrder, swatchFacts, swatchFill } from '../../lib/swatches.ts';
import type { PaletteEntry } from '../../palette.ts';
import { CHECK_ICON, DOWNLOAD_ICON, STAR_ICON } from './shared.ts';
import { bindOp, type CatCtx } from './context.ts';
import './swatch-set.css';

/** The Swatches section: the part of the page the swatch gestures own. */
export const SWATCH_SECTION = '.cat-group[data-group="swatches"]';

/** The palette in panel order. A card's ref is its index here. */
export const swatchList = (cat: CatCtx): PaletteEntry[] => paletteInDisplayOrder(cat.palette);

const favKey = (cat: CatCtx, entry: PaletteEntry): string => cat.filters.swatchFavKey(entry.label);

/** One swatch card. */
export function cardHtml(cat: CatCtx, entry: PaletteEntry, index: number): string {
  const ref = String(index);
  const f = swatchFacts(entry);
  const sel = cat.swatchSelected.has(ref);
  const key = favKey(cat, entry);
  const flag = entry.spot ? 'SPOT' : Array.isArray(entry.cmyk) ? 'CMYK' : '';
  const name = escapeText(entry.label);
  return `
    <div class="cat-tile cat-swatch-tile${sel ? ' is-selected' : ''}${cat.favSet.has(key) ? ' is-fav' : ''}" data-swatch-ref="${ref}" data-fav-key="${escapeText(key)}">
      <button type="button" class="cat-check" data-swatch-select="${ref}" aria-pressed="${sel}" aria-label="${escapeText(tRaw('Select {name}', { name: entry.label }))}" title="${escapeText(t('Select'))}">${CHECK_ICON}</button>
      <button type="button" class="cat-tile-open" data-swatch-open="${ref}" aria-haspopup="dialog" aria-label="${escapeText(tRaw('View {name} details', { name: entry.label }))}">
        <span class="cat-tile-fig cat-swatch-fig" style="${swatchFill(f)}">${flag ? `<span class="plat-chip-flag">${flag}</span>` : ''}</span>
        <span class="cat-tile-cap">
          <span class="cat-tile-name" title="${name}">${name}</span>
          <span class="cat-tile-sub cat-swatch-value">${escapeText(f.lead)}</span>
          <span class="cat-tile-sub cat-swatch-ink${isLockedInk(entry) ? '' : ' is-generic'}">${escapeText(f.desc ? inkText(entry) : t('No colour'))}</span>
        </span>
      </button>
    </div>`;
}

// ── Selection ─────────────────────────────────────────────────────────────────

export const count = (cat: CatCtx): number => cat.swatchSelected.size;

/** The selected swatches, in panel order. */
export function selectedEntries(cat: CatCtx): PaletteEntry[] {
  return swatchList(cat).filter((_, i) => cat.swatchSelected.has(String(i)));
}

function paint(cat: CatCtx): void {
  for (const tile of cat.viewEl.querySelectorAll<HTMLElement>('.cat-swatch-tile')) {
    const on = cat.swatchSelected.has(tile.dataset.swatchRef ?? '');
    tile.classList.toggle('is-selected', on);
    tile.querySelector('.cat-check')?.setAttribute('aria-pressed', String(on));
  }
}

/** Make the selection exactly `refs`, repaint the cards in place and sync the bar. */
export function setSelection(cat: CatCtx, refs: Iterable<string>): void {
  const size = swatchList(cat).length;
  cat.swatchSelected.clear();
  for (const ref of refs) if (Number(ref) >= 0 && Number(ref) < size) cat.swatchSelected.add(ref);
  // One selection at a time: picking a swatch drops an asset selection.
  if (cat.swatchSelected.size && cat.selected.size) cat.bulk.handleBulk('clear');
  paint(cat);
  syncBar(cat);
}

export function toggle(cat: CatCtx, ref: string): void {
  const next = new Set(cat.swatchSelected);
  if (next.has(ref)) next.delete(ref); else next.add(ref);
  setSelection(cat, next);
}

/** A click on a card's selection dot: Shift extends from the anchor, else toggles. */
export function onDot(cat: CatCtx, ref: string, shiftKey: boolean): void {
  cat.swatchSelect.onDotClick(ref, shiftKey, () => toggle(cat, ref));
}

export function clear(cat: CatCtx): void {
  cat.swatchSelected.clear();
  cat.swatchSelect.resetAnchor();
  paint(cat);
  syncBar(cat);
}

// ── The selection bar ─────────────────────────────────────────────────────────

const allFavourite = (cat: CatCtx, entries: PaletteEntry[]): boolean =>
  entries.length > 0 && entries.every(entry => cat.favSet.has(favKey(cat, entry)));

/** The asset selection bar's component and skin, with the swatch actions. */
export function barConfig(cat: CatCtx): BulkBarConfig {
  return {
    // Its own prefix, with the asset bar's skin (styles/parts/asset-shared.css), so
    // `.cat-bulkbar` still finds exactly one bar.
    prefix: 'cat-swatchbar',
    // The shared sync sets `.has-selection` from this bar's count alone; syncBar
    // then sets it for either selection.
    rootSelector: '.catalog',
    count: () => cat.swatchSelected.size,
    actions: [
      { id: 'swatch-download', icon: DOWNLOAD_ICON, label: () => t('Download as…'), title: () => t('Save the selected colours as a palette file') },
      { id: 'swatch-copy', icon: icon('clipboard'), label: () => t('Copy hex'), title: () => t('Copy the hex of each selected colour, one per line') },
      { id: 'swatch-fav', icon: STAR_ICON, label: () => (allFavourite(cat, selectedEntries(cat)) ? t('Unfavourite') : t('Favourite')) },
      { id: 'swatch-lab', icon: icon('flask'), label: () => t('Open in Colour Lab'), hidden: () => cat.swatchSelected.size !== 1 },
    ],
  };
}

export const barHtml = (cat: CatCtx): string => bulkBarHtml(cat.swatchBarCfg);

/** Reflect the selection into the bar, and reserve room for whichever bar shows. */
export function syncBar(cat: CatCtx): void {
  syncBulkBar(cat.viewEl, cat.swatchBarCfg);
  cat.viewEl.querySelector('.catalog')?.classList.toggle('has-selection', cat.selected.size > 0 || cat.swatchSelected.size > 0);
}

/** Bind the bar's buttons. Per render: render() writes a fresh bar. */
export function wireBar(cat: CatCtx): void {
  cat.viewEl.querySelector<HTMLElement>('.cat-swatchbar')?.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLElement>('[data-bulk]');
    if (button) handle(cat, button.dataset.bulk!, button);
  });
}

/** A selection action, from the bar or the bulk menu. */
export function handle(cat: CatCtx, action: string, anchor?: HTMLElement | null): void {
  const entries = selectedEntries(cat);
  if (action === 'clear') clear(cat);
  else if (action === 'swatch-download') openDownloadMenu(cat, entries, anchor ?? cat.viewEl.querySelector<HTMLElement>('.cat-swatchbar [data-bulk="swatch-download"]'));
  else if (action === 'swatch-copy') void copyHex(entries);
  else if (action === 'swatch-fav') void favourite(cat, entries);
  else if (action === 'swatch-lab' && entries[0]) openInLab(entries[0]);
}

async function copyHex(entries: PaletteEntry[]): Promise<void> {
  const values = entries.map(entry => swatchFacts(entry)).filter(f => f.desc).map(f => f.hex.toUpperCase());
  if (!values.length) { announce(t('Transparent has no colour to copy.')); return; }
  if (await copyText(values.join('\n'))) announce(values.length === 1 ? tRaw('Copied {v}', { v: values[0]! }) : tRaw('Copied {n} hex values', { n: values.length }));
  else announce(t('Copy failed'), { assertive: true });
}

/** Favourite or unfavourite them all (all starred → unstar all), with one profile write. */
async function favourite(cat: CatCtx, entries: PaletteEntry[]): Promise<void> {
  if (!entries.length) return;
  const on = !allFavourite(cat, entries);
  const keys = new Set(entries.map(entry => favKey(cat, entry)));
  for (const key of keys) { if (on) cat.favSet.add(key); else cat.favSet.delete(key); }
  if (cat.profile) await saveFavouriteAssets(cat.host, cat.profile, cat.favSet);
  if (!cat.mounted) return;
  for (const key of keys) cat.sections.reflectFavInGrid(key, on);
  cat.sections.refreshFavStrip();
  syncBar(cat);
  announce(on ? t('{n} added to favourites', { n: keys.size }) : t('{n} removed from favourites', { n: keys.size }));
}

function openInLab(entry: PaletteEntry): void {
  const f = swatchFacts(entry);
  if (f.desc) location.hash = `#/lab?c=${encodeURIComponent(f.subject)}`;
}

// ── Downloads ─────────────────────────────────────────────────────────────────

const plural = (n: number): string => (n === 1 ? t('1 colour') : tRaw('{n} colours', { n }));

/** A list of names as this page's language writes one ("A, B and C"). */
const listOf = (items: string[]): string => {
  try { return new Intl.ListFormat(document.documentElement.lang || undefined, { type: 'conjunction' }).format(items); }
  catch { return items.join(', '); }
};

/** What the menu says it leaves out, writes approximately or writes without its
 *  print values, and in which formats. */
export function fitNotes(fits: { label: string; fit: SwatchFit }[]): string[] {
  const names = (pick: (fit: SwatchFit) => PaletteEntry[]): string =>
    listOf([...new Set(fits.flatMap(f => pick(f.fit)).map(entry => entry.label))]);
  const formats = (has: (fit: SwatchFit) => boolean): string[] => fits.filter(f => has(f.fit)).map(f => t(f.label));
  const notes: string[] = [];
  const none = names(fit => fit.skipped.filter(s => s.reason === 'no-colour').map(s => s.entry));
  const seeThrough = names(fit => fit.skipped.filter(s => s.reason === 'translucent').map(s => s.entry));
  const odd = names(fit => fit.skipped.filter(s => s.reason === 'unreadable').map(s => s.entry));
  if (none) notes.push(tRaw('Left out: {names}, which has no colour to save.', { names: none }));
  if (seeThrough) notes.push(tRaw('Left out of formats without transparency: {names}.', { names: seeThrough }));
  if (odd) notes.push(tRaw('Left out: {names}, whose value is not a colour these formats read.', { names: odd }));
  const fallback = formats(fit => fit.approximated.length > 0);
  if (fallback.length) {
    notes.push(tRaw('{formats} save {names} as the sRGB fallback. The other formats keep the wider colour.', {
      formats: listOf(fallback), names: names(fit => fit.approximated),
    }));
  }
  const withPrint = formats(fit => fit.printDropped.length === 0);
  if (formats(fit => fit.printDropped.length > 0).length) {
    notes.push(tRaw('The CMYK and spot values of {names} go into {formats} only.', {
      names: names(fit => fit.printDropped), formats: listOf(withPrint),
    }));
  }
  return notes;
}

/** The format menu for these swatches. A format that can hold none of them is
 *  offered disabled with the reason; one that holds only some says how many. */
export function openDownloadMenu(cat: CatCtx, entries: PaletteEntry[], anchor?: HTMLElement | null): void {
  cat.actionsPopover?.close();
  if (!entries.length) return;
  const fits = cat.SWATCH_DOWNLOADS.map(d => ({ ...d, fit: swatchFit(entries, d.fmt) }));
  const fallback = pointAnchor(cat.viewEl.getBoundingClientRect().left + 24, 100);
  const popover = mountBodyPopover(anchor ?? fallback, el => {
    const rows = fits.map(({ fmt, label, fit }) => {
      const part = fit.kept.length && fit.kept.length < entries.length ? ` · ${tRaw('{n} of {m}', { n: fit.kept.length, m: entries.length })}` : '';
      return menuItemHtml(fmt, DOWNLOAD_ICON, `${t(label)}${part}`, { reason: fit.kept.length ? '' : t('None of these colours fit this format.') });
    }).join('');
    const notes = fitNotes(fits).map(note => `<p class="cat-swatch-menu-note">${escapeText(note)}</p>`).join('');
    el.innerHTML = `<p class="folder-menu-head">${escapeText(plural(entries.length))}</p>${rows}${notes}`;
    const items = [...el.querySelectorAll<HTMLButtonElement>('button')];
    el.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    });
    el.addEventListener('click', event => {
      const row = (event.target as Element).closest<HTMLElement>('[data-act]');
      if (!row || row.getAttribute('aria-disabled') === 'true') return;
      popover.close();
      void download(cat, entries, row.dataset.act as SwatchExportFormat);
    });
    return el.querySelector<HTMLElement>('button:not([aria-disabled="true"])') ?? items[0] ?? null;
  }, { className: 'folder-menu', ariaLabel: t('Download as'), container: anchor?.closest<HTMLDialogElement>('dialog') ?? undefined });
  cat.actionsPopover = popover;
  popover.open();
}

/** Save these swatches in one format: only the colours the format holds go in. */
export async function download(cat: CatCtx, entries: PaletteEntry[], format: SwatchExportFormat): Promise<void> {
  const { kept } = swatchFit(entries, format);
  if (!kept.length) return;
  const name = entries.length === 1 ? entries[0]!.label : 'Lolly brand selection';
  try {
    const { blob, filename } = exportSwatches(paletteEntriesToSwatches(kept), format, name);
    await cat.host.export.download(blob, filename);
    announce(tRaw('Palette downloaded as {filename}', { filename }));
  } catch { announce(t('Couldn’t export the palette.')); }
}

// ── Context menus ─────────────────────────────────────────────────────────────

export const isBulkTarget = (cat: CatCtx, ref: string): boolean => cat.swatchSelected.size > 1 && cat.swatchSelected.has(ref);

/** One card's menu. */
export function menuHtml(cat: CatCtx, ref: string): string {
  const entry = swatchList(cat)[Number(ref)];
  if (!entry) return '';
  const f = swatchFacts(entry);
  return [
    menuItemHtml('swatch-open', icon('externalLink'), t('Details')),
    menuItemHtml('swatch-copy', icon('clipboard'), tRaw('Copy {v}', { v: f.lead }), { reason: f.desc ? '' : t('Transparent has no colour to copy.') }),
    menuItemHtml('swatch-share', icon('link'), t('Copy link')),
    menuItemHtml('swatch-download', icon('download'), t('Download as…')),
    menuItemHtml('swatch-fav', icon('star'), cat.favSet.has(favKey(cat, entry)) ? t('Remove from favourites') : t('Add to favourites')),
    menuItemHtml('swatch-select', icon('check'), cat.swatchSelected.has(ref) ? t('Deselect') : t('Select')),
    f.desc ? menuItemHtml('swatch-lab', icon('flask'), t('Open in Colour Lab')) : '',
  ].join('');
}

/** The menu over a multi-selection, mirroring the bar. */
export function bulkMenuHtml(cat: CatCtx): string {
  return `<p class="folder-menu-head">${t('{n} selected', { n: cat.swatchSelected.size })}</p>`
    + `<div class="folder-menu-list" role="menu" aria-label="${escapeText(t('Selection actions'))}">${[
      menuItemHtml('swatch-download', icon('download'), t('Download as…')),
      menuItemHtml('swatch-copy', icon('clipboard'), t('Copy hex')),
      menuItemHtml('swatch-fav', icon('star'), allFavourite(cat, selectedEntries(cat)) ? t('Unfavourite') : t('Favourite')),
    ].join('')}</div>`;
}

/** A picked menu row. `ref` is null for the bulk menu. */
export function onMenuAction(cat: CatCtx, action: string, ref: string | null): void {
  if (ref === null) { handle(cat, action); return; }
  const entry = swatchList(cat)[Number(ref)];
  if (!entry) return;
  const tile = cat.viewEl.querySelector<HTMLElement>(`.cat-swatch-tile[data-swatch-ref="${CSS.escape(ref)}"]`);
  if (action === 'swatch-open') cat.swatches.openSwatch(Number(ref));
  else if (action === 'swatch-copy') void copyHex([entry]);
  else if (action === 'swatch-share') {
    void copyText(cat.swatches.swatchLink(entry.label)).then(ok => announce(ok ? t('Link copied') : t('Couldn’t copy the link'), { assertive: !ok }));
  }
  else if (action === 'swatch-download') openDownloadMenu(cat, [entry], tile);
  else if (action === 'swatch-fav') void cat.userAssets.toggleFavourite(favKey(cat, entry));
  else if (action === 'swatch-select') toggle(cat, ref);
  else if (action === 'swatch-lab') openInLab(entry);
}

// ── Mount ─────────────────────────────────────────────────────────────────────

/**
 * The selection gestures, once per mount against the persistent view element:
 * the selection dots, Shift-range, the marquee and the keyboard model, all from
 * the shared lib/tile-select.ts, limited to the Swatches section. Returns the
 * teardown for the view's cleanup.
 */
export function wire(cat: CatCtx): () => void {
  cat.swatchBarCfg = barConfig(cat);
  const { viewEl } = cat;
  cat.swatchSelect = wireTileSelect({
    host: viewEl,
    tiles: () => [...viewEl.querySelectorAll<HTMLElement>('.cat-swatch-tile')],
    refOf: (tile) => tile.dataset.swatchRef!,
    current: () => new Set(cat.swatchSelected),
    setRefs: (refs) => setSelection(cat, refs),
    clear: () => clear(cat),
    owns: (el) => !!el.closest(SWATCH_SECTION),
    noStart: 'button, a, input, label, textarea, select, dialog, .cat-tile, .cat-bulkbar, .cat-swatchbar, .cat-swatch-downloads',
    keyboard: {},
  });
  const unwireEscape = wireEscapeClearsSelection({
    active: () => cat.mounted && cat.swatchSelected.size > 0,
    clear: () => clear(cat),
  });
  return () => { cat.swatchSelect.destroy(); unwireEscape(); };
}

export function swatchSetOps(cat: CatCtx) {
  return {
    swatchList: bindOp(cat, swatchList),
    cardHtml: bindOp(cat, cardHtml),
    count: bindOp(cat, count),
    selectedEntries: bindOp(cat, selectedEntries),
    setSelection: bindOp(cat, setSelection),
    toggle: bindOp(cat, toggle),
    onDot: bindOp(cat, onDot),
    clear: bindOp(cat, clear),
    barHtml: bindOp(cat, barHtml),
    syncBar: bindOp(cat, syncBar),
    wireBar: bindOp(cat, wireBar),
    handle: bindOp(cat, handle),
    openDownloadMenu: bindOp(cat, openDownloadMenu),
    download: bindOp(cat, download),
    isBulkTarget: bindOp(cat, isBulkTarget),
    menuHtml: bindOp(cat, menuHtml),
    bulkMenuHtml: bindOp(cat, bulkMenuHtml),
    onMenuAction: bindOp(cat, onMenuAction),
    wire: bindOp(cat, wire),
  };
}
