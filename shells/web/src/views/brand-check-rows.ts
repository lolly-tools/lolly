// SPDX-License-Identifier: MPL-2.0
/** Brand findings share the export check panel and the tool's normal undo path. */
import { applyBrandFix, checkBrandDesign, type BrandCheckCatalogOpts, type BrandFinding } from '../../../../engine/src/brand-check.ts';
import { brandCheckCatalog } from '../../../../engine/src/design-brief.ts';
import type { AssetQuery, AssetRef, TokensSnapshot } from '@lolly-tools/core/host-v1';
import { t, tRaw } from '../i18n.ts';
import type { PreflightRow } from './export-preflight.ts';

function findingText(f: BrandFinding): string {
  const fields: Record<string, string> = { bg: t('fill'), fg: t('text colour'), stroke: t('stroke'), font: t('font'), image: t('image') };
  const field = fields[f.field ?? ''] ?? t('value');
  if (f.kind === 'reference' && f.field === 'image') return tRaw('“{name}”: the icon theme or photo treatment in {value} is not declared in this design system.', { name: f.label, value: f.value ?? '' });
  if (f.kind === 'reference') return tRaw('“{name}”: {value} does not resolve to a colour in this design system.', { name: f.label, value: f.value ?? '' });
  if (f.kind === 'coverage') return t('No readable composition was available for brand checks.');
  if (f.status === 'unknown') return tRaw('“{name}”: the {field} could not be compared with the selected design system.', { name: f.label, field });
  if (f.kind === 'asset') return tRaw('“{name}”: this image is outside the design system’s declared asset IDs. It may be intentional.', { name: f.label });
  return tRaw('“{name}”: {field} {value} is outside this design system. Suggested: {suggestion}.', { name: f.label, field, value: f.value ?? '', suggestion: f.suggestion ?? '' });
}
/** The slice of the web host the catalog facts come from; every part is optional. */
export interface BrandCatalogHost {
  assets?: {
    query?(filter: AssetQuery): Promise<Pick<AssetRef, 'id'>[]>;
    _iconThemes?(): Promise<unknown[]>;
    _photoTreatments?(): Promise<unknown[]>;
  };
}

/**
 * The catalog facts `lolly check` gives the brand check, read from the web host: every
 * catalog asset id, and the icon themes and photo treatments its palette assets declare.
 * A catalog icon (`suse/icons/brain?theme=ember`) is then a known asset here as it is in
 * the CLI. A part the host cannot answer is left out, so its modifiers are not judged.
 */
export async function hostBrandCatalog(host: BrandCatalogHost | undefined): Promise<BrandCheckCatalogOpts> {
  const assets = host?.assets;
  const safe = async <T>(read: (() => Promise<T[]>) | undefined): Promise<T[]> => {
    if (!read) return [];
    try { const out = await read(); return Array.isArray(out) ? out : []; } catch { return []; }
  };
  const [refs, themes, treatments] = await Promise.all([
    safe(assets?.query ? () => assets.query!({ includeDeprecated: true }) : undefined),
    safe(assets?._iconThemes ? () => assets._iconThemes!() : undefined),
    safe(assets?._photoTreatments ? () => assets._photoTreatments!() : undefined),
  ]);
  return brandCheckCatalog({
    assets: refs.filter((r) => typeof r?.id === 'string').map((r) => ({ id: r.id })),
    iconThemes: { themes },
    photoTreatments: { treatments },
  });
}

export async function brandCheckRows(options: {
  boxes: () => unknown;
  snapshot: () => Promise<TokensSnapshot | undefined>;
  write: (boxes: Record<string, unknown>[]) => unknown | Promise<unknown>;
  theme?: string;
  /** Catalog facts (asset ids, icon themes, photo treatments), as `hostBrandCatalog` reads them. */
  catalog?: () => Promise<BrandCheckCatalogOpts>;
}): Promise<PreflightRow[]> {
  let snapshot: TokensSnapshot | undefined;
  try { snapshot = await options.snapshot(); } catch { snapshot = undefined; }
  const doc = snapshot?.document;
  if (!doc) return [{ id: 'brand.unavailable', tone: 'gap', text: t('The design system could not be read. Brand values have not been checked.') }];
  const catalogFacts = async (): Promise<BrandCheckCatalogOpts> => {
    try { return (await options.catalog?.()) ?? {}; } catch { return {}; }
  };
  const catalog = await catalogFacts();
  const report = checkBrandDesign(options.boxes(), doc, { theme: snapshot?.selection.theme ?? options.theme, ...catalog });
  const rows: PreflightRow[] = report.findings.slice(0, 60).map(f => ({
    id: f.id, tone: f.status === 'unknown' ? 'gap' : 'note', text: findingText(f),
    ...(f.fix ? { action: {
      label: f.kind === 'font' ? t('Use brand font') : tRaw('Use {colour}', { colour: f.suggestion ?? '' }),
      run: async () => {
        const snapshot = await options.snapshot();
        const boxes = options.boxes();
        const current = checkBrandDesign(boxes, snapshot?.document, { theme: snapshot?.selection.theme ?? options.theme, ...(await catalogFacts()) });
        const stillOffered = current.findings.some(item => JSON.stringify(item.fix) === JSON.stringify(f.fix));
        const next = stillOffered ? applyBrandFix(boxes, f.fix!) : null;
        if (!next) throw new Error(t('This item changed. Close and reopen the checks to review it again.'));
        await options.write(next);
      },
    } } : {}),
  }));
  if (snapshot?.system?.label) rows.unshift({ id: 'brand.system', tone: 'note', text: tRaw('Design system: {name}', { name: snapshot.system.label }) });
  rows.push({ id: 'brand.coverage', tone: 'gap', text: tRaw('Compared {colors} colour values, {fonts} font choices and {assets} asset IDs. Gradients, effects, nested content and subjective quality were not assessed.', report.checked) });
  if (report.coverage.truncated || report.findings.length > 60) rows.push({ id: 'brand.limit', tone: 'gap', text: t('Some items are not shown. Review the rest after these items.') });
  return rows;
}
