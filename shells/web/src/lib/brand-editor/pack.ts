// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: palette download, brand pack export and import.
 *
 * Every function takes the shared `bedit: BrandEditorCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `bedit.<module>.<fn>`. Extracted verbatim
 * from mountBrandEditor() by scripts/split-closure.ts.
 */
import type { Unzipped } from 'fflate';
import { exportSwatches } from '../swatch-export.ts';
import type { SwatchExportFormat } from '../swatch-export.ts';
import { applyChromeBrandVars } from '../../brand-vars.ts';
import { mountCataloguePanel, mountGradientsPanel, mountTokensPanel } from '../brand-studio-tabs.ts';
import { exportBrandPack, importBrandPack } from '../../brand-transfer.ts';
import { saveBlob } from '../../pro/zip.ts';
import { t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

// The brand's font.* role tokens, for the tokens-json export - so the faces a
// user assigned in the Type room travel with the palette (plans/173 slice 1).
// Only SET roles export: with none set the file has no font group, because
// exporting the platform default would claim SUSE as the user's own brand.
export const exportFonts = async (bedit: BrandEditorCtx): Promise<Array<{ role: string; families: string[] }>> => {
  const { tokens } = bedit;
  const out: Array<{ role: string; families: string[] }> = [];
  for (const role of ['brand', 'mono', 'display', 'italic']) {
    const v = await (tokens as { resolve?(ref: string): Promise<unknown> } | undefined)
      ?.resolve?.(`{font.${role}}`).catch(() => null);
    const fams = (Array.isArray(v) ? v : [v])
      .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      .map((f) => f.trim().replace(/^['"]+|['"]+$/g, ''));
    if (fams.length) out.push({ role, families: fams });
  }
  return out;
};
// The gradient stop picker's view of the palette: the same walkSwatches-fed
// `swatches` array the grid renders (kept fresh by both repaintPalette and
// the in-place recolour paths). Alias roles are excluded - a stop wearing a
// role would chain two aliases deep.
export const gradSwatches = (bedit: BrandEditorCtx): Array<{ ref: string; hex: string; label: string; group: string }> =>
  bedit.swatches.filter(s => s.hex && !s.isAlias && s.kind !== 'semantic')
    .map(s => ({ ref: `{${s.key}}`, hex: s.hex, label: s.name, group: s.group }));
// ── Share (brand pack in/out) - exposed on the handle; the host view owns
//    the buttons' placement (its persistent Import/Export action row).
export const exportPack = async (bedit: BrandEditorCtx): Promise<{ filename: string }> => {
  const { transferHost } = bedit;
  const { blob, filename, summary } = await exportBrandPack(transferHost);
  await saveBlob(blob, filename);
  announce(summary.fontFamilies === 1
    ? tRaw('Brand exported - {n} font family', { n: summary.fontFamilies })
    : tRaw('Brand exported - {n} font families', { n: summary.fontFamilies }));
  return { filename };
};
// Something replaced the installed tokens underneath us (a pack import, the
// host view's own JSON/SVG install path) - reload the doc and repaint every
// panel so the studio shows what's actually installed. The Generate wing's
// CONTROLS re-seed too (primary, shade count, ramp anchors, the preview):
// they were captured from the pre-import doc at mount, and leaving them stale
// would make Replace palette silently derive from the old brand.
export const reload = async (bedit: BrandEditorCtx): Promise<void> => {
  const { host, tokens } = bedit;
  tokens?.bust?.();
  bedit.doc = ((await tokens?.raw().catch(() => null)) as Record<string, unknown> | null) ?? bedit.doc;
  bedit.isUserBrand = true; // every reload() caller just installed on the user's behalf
  bedit.derive.reseedFromDoc();
  bedit.ramps.repaintPalette(); await bedit.type.paintFonts(); await bedit.logos.paintLogos(); void applyChromeBrandVars(host);
};
export const importPack = async (bedit: BrandEditorCtx, source: File | Unzipped): Promise<void> => {
  const { host, transferHost } = bedit;
  const summary = await importBrandPack(
    transferHost,
    typeof File !== 'undefined' && source instanceof File ? await source.arrayBuffer() : source as Unzipped,
  );
  await reload(bedit);
  if (summary.packTools > 0) {
    // An instance pack (plans/131) arrived tools + catalog entries beside the
    // brand: resync now so the gallery lists them without a reload/boot, then
    // re-merge the installed (sideloaded) tools over the fresh index - the
    // same order main.ts's boot path runs.
    void import('../../catalog/sync.ts')
      .then(({ syncCatalog }) => syncCatalog(host as unknown as Parameters<typeof syncCatalog>[0]))
      .then(() => import('../installed-tools.ts'))
      .then(({ mergeInstalledToolsIntoIndex }) => mergeInstalledToolsIntoIndex())
      .catch(() => { /* next boot's sync picks it up */ });
    announce(tRaw('Brand loaded - {name}: {n} tools installed', {
      name: summary.packName ?? t('instance pack'), n: summary.packTools,
    }));
  } else {
    announce(t('Brand loaded'));
  }
};
export function wirePaletteDownload(bedit: BrandEditorCtx): void {
  const { host, palErr, palFmtSel } = bedit;
  bedit.ramps.$('[data-be-pal-download]')?.addEventListener('click', async () => {
    if (palErr) palErr.hidden = true;
    try {
      const format = (palFmtSel?.value ?? 'tokens-json') as SwatchExportFormat;
      const fonts = format === 'tokens-json' ? await bedit.pack.exportFonts() : undefined;
      const { blob, filename } = exportSwatches(bedit.swatches, format, undefined, fonts?.length ? { fonts } : undefined);
      await saveBlob(blob, filename);
      announce(tRaw('Palette downloaded as {filename}', { filename }));
    } catch (err) {
      if (palErr) { palErr.textContent = String((err as { message?: unknown })?.message ?? err); palErr.hidden = false; }
    }
  });

  // ── The three studio panels that live outside this file ──────────────────
  // Token editors, gradients and catalogue uploads (brand-studio-tabs.ts) - 
  // each gets the same narrow context: the live doc (getter - the Colour tab
  // reassigns it on re-derive/import), the persist funnel, and its tab's notify.
  const studioCtx: BrandEditorCtx['studioCtx'] = {
    host,
    doc: () => bedit.doc as Record<string, unknown>,
    // The Tokens room's sliders write a clone (withRadiusToken/withSpaceToken), so
    // the room hands it back here: the editor's own document is the one every
    // room's persist() installs, and a write that skipped it was reverted by the
    // next save from anywhere else.
    setDoc: (next: Record<string, unknown>) => { bedit.doc = next; },
    persist: (immediate?: boolean) => bedit.state.persist(immediate),
    pushUndo: (label: string) => bedit.state.pushUndo(label),
    swatches: () => bedit.swatches,
    // The shipped starter's colour identities, so a panel can tell scaffolding
    // from a decision without a second comparison of its own (plan 182 section 12).
    starterIds: (): ReadonlySet<string> => bedit.starterSwatches,
    // The token workspace replaced the whole document in place: the Colours room
    // reseeds its controls and palette from the new document.
    onDocReplaced: () => { bedit.derive.reseedFromDoc(); bedit.ramps.repaintPalette(); },
  }; bedit.studioCtx = studioCtx;
  // (The fonts-manager panel that used to mount here is gone - plan 182 section
  // 6.4 leaves one file door, the compare stage's own drop zone.)
  const tokensMount = bedit.ramps.$('[data-be-tokens-mount]') as HTMLElement | null; bedit.tokensMount = tokensMount as BrandEditorCtx['tokensMount'];
  const tokensPanel = tokensMount ? mountTokensPanel(tokensMount, { ...studioCtx, notify: () => bedit.state.notify('tokens') }) : null; bedit.tokensPanel = tokensPanel;
  const gradsMount = bedit.ramps.$('[data-be-grads-mount]') as HTMLElement | null; bedit.gradsMount = gradsMount as BrandEditorCtx['gradsMount'];
}

export function wireGradientsPanel(bedit: BrandEditorCtx): void {
  const { cleanups, gradsMount, host, paletteHooks, paletteObservers, studioCtx, tokensPanel } = bedit;
  const gradsPanel = gradsMount ? mountGradientsPanel(gradsMount, {
    ...studioCtx, notify: () => bedit.state.notify('color'), primaryHex: bedit.derive.primaryHex, paletteHexes: bedit.derive.paletteHexes,
    paletteSwatches: bedit.pack.gradSwatches,
    resolveRef: bedit.state.resolveTokenRef,
    onPalette: (cb) => { paletteObservers.add(cb); return () => { paletteObservers.delete(cb); }; },
  }) : null; bedit.gradsPanel = gradsPanel;
  const catMount = bedit.ramps.$('[data-be-cat-mount]') as HTMLElement | null; bedit.catMount = catMount as BrandEditorCtx['catMount'];
  const catPanel = catMount ? mountCataloguePanel(catMount, { host, notify: () => bedit.state.notify('catalogue') }) : null; bedit.catPanel = catPanel;
  cleanups.push(() => { tokensPanel?.teardown(); gradsPanel?.teardown(); catPanel?.teardown(); });
  // Token/gradient groups ride the same doc the palette walks, so a re-derive
  // or pack import must repaint them too.
  paletteHooks.push(() => { tokensPanel?.render(); gradsPanel?.render(); });
  const themeObserver = new MutationObserver(() => {
    const theme = document.documentElement.dataset.theme || 'light';
    if (theme === bedit.currentTheme) return;
    bedit.currentTheme = theme;
    bedit.swatchEditor.closeEditor();
    bedit.ramps.repaintPalette();
  }); bedit.themeObserver = themeObserver;
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  cleanups.push(() => themeObserver.disconnect());
}

export function packOps(bedit: BrandEditorCtx) {
  return {
    exportFonts: bindOp(bedit, exportFonts),
    gradSwatches: bindOp(bedit, gradSwatches),
    exportPack: bindOp(bedit, exportPack),
    reload: bindOp(bedit, reload),
    importPack: bindOp(bedit, importPack),
    wirePaletteDownload: bindOp(bedit, wirePaletteDownload),
    wireGradientsPanel: bindOp(bedit, wireGradientsPanel),
  };
}
