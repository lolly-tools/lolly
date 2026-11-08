// SPDX-License-Identifier: MPL-2.0
/** Brand findings share the export check panel and the tool's normal undo path. */
import { applyBrandFix, checkBrandDesign, type BrandCheckCatalogOpts, type BrandFinding } from '../../../../engine/src/brand-check.ts';
import { checkGuestMarks, type GuestMarkMeasure, type GuestMarkUnmeasured } from '../../../../engine/src/partner-kit-check.ts';
import { partnerKitLogoIds } from '../../../../engine/src/partner-kit.ts';
import type { PartnerKitTreatmentV1, PartnerKitV1 } from '@lolly-tools/core/partner-kit-v1';
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
/** A treatment in a sentence a person reads. */
function treatmentWord(value: string): string {
  const words: Record<PartnerKitTreatmentV1, string> = { colour: t('full colour'), mono: t('one colour'), reverse: t('reversed'), 'on-photo': t('on a photo') };
  return words[value as PartnerKitTreatmentV1] ?? value;
}

/** The treatments a kit allows, as "A, B or C". */
function allowedWords(expected: string | undefined): string {
  const words = (expected ?? '').split(',').map((w) => w.trim()).filter(Boolean).map(treatmentWord);
  return words.length > 1 ? tRaw('{list} or {last}', { list: words.slice(0, -1).join(', '), last: words[words.length - 1]! }) : (words[0] ?? '');
}

/** A partner mark finding (`checkGuestMarks`, plans/82 M8) in the reader's language. */
export function markFindingText(f: BrandFinding): string {
  const company = f.company ?? '';
  if (f.rule === 'min-size') {
    // A logo placed only roughly (its proportions unknown) is at most this high.
    const words = { company, value: f.value ?? '', expected: f.expected ?? '' };
    return / is at most /.test(f.message ?? '')
      ? tRaw('{company}’s mark is at most {value} high; the kit asks for at least {expected}.', words)
      : tRaw('{company}’s mark is {value} high; the kit asks for at least {expected}.', words);
  }
  if (f.rule === 'clear-space') {
    const others = Math.max(0, (f.related?.length ?? 1) - 1);
    if (!others) return tRaw('“{name}” sits inside {company}’s clear space.', { name: f.value ?? '', company });
    return others === 1
      ? tRaw('“{name}” and 1 other layer sit inside {company}’s clear space.', { name: f.value ?? '', company })
      : tRaw('“{name}” and {count} other layers sit inside {company}’s clear space.', { name: f.value ?? '', count: others, company });
  }
  if (f.rule === 'treatment' && f.value === 'recoloured') return tRaw('{company}’s mark is recoloured; the kit allows {allowed}.', { company, allowed: allowedWords(f.expected) });
  if (f.rule === 'treatment' && f.value === 'on-photo') return tRaw('{company}’s mark sits on a photo; the kit allows {allowed}.', { company, allowed: allowedWords(f.expected) });
  if (f.rule === 'treatment') return tRaw('{company}’s mark is drawn in {treatment}; the kit allows {allowed}.', { company, treatment: treatmentWord(f.value ?? ''), allowed: allowedWords(f.expected) });
  return f.message ?? '';
}

/**
 * What the partner kit check could not measure (`unmeasured`, plans/82 M8), one sentence
 * per code in the reader's language. Each count is its own singular or plural sentence,
 * written as whole t() literals so the translation extractor sees both forms.
 */
export function unmeasuredText(entry: GuestMarkUnmeasured, company: string): string {
  const count = entry.count ?? 1;
  const one = count === 1;
  const words = { company, count };
  switch (entry.code) {
    case 'reverse': return tRaw('Reversed use of {company}’s mark is not measured: the logo for dark surfaces is the reverse.', words);
    case 'mm-in-pixels': return tRaw('{company}’s minimum size in millimetres is not measured: this piece is measured in pixels.', words);
    case 'layer-tree': return tRaw('The layer tree could not be read, so {company}’s marks were placed without artboards, groups or paint order.', words);
    case 'layer-limit': return tRaw('Layers past the first {limit} were not measured against {company}’s kit.', { company, limit: entry.limit ?? 0 });
    case 'not-drawn': return one
      ? tRaw('One of {company}’s marks draws no picture as written, so the mark was not measured.', words)
      : tRaw('{count} of {company}’s marks draw no picture as written, so those marks were not measured.', words);
    case 'size': return one
      ? tRaw('The drawn height of one of {company}’s marks is not measured: the logo’s proportions are not known.', words)
      : tRaw('The drawn height of {count} of {company}’s marks is not measured: the logo’s proportions are not known.', words);
    case 'clear-space': return one
      ? tRaw('The clear space of one of {company}’s marks is not measured: the logo’s proportions are not known, and a layer lies where the clear space may reach.', words)
      : tRaw('The clear space of {count} of {company}’s marks is not measured: the logo’s proportions are not known, and a layer lies where the clear space may reach.', words);
    case 'ground': return one
      ? tRaw('Whether one of {company}’s marks sits on a photo is not measured: what lies beneath is translucent, covers only part of the mark or depends on the logo’s proportions.', words)
      : tRaw('Whether {count} of {company}’s marks sit on a photo is not measured: what lies beneath is translucent, covers only part of the mark or depends on the logo’s proportions.', words);
    case 'treatment': return one
      ? tRaw('The treatment of one of {company}’s marks is not measured: the catalog does not say what colours its theme or treatment gives.', words)
      : tRaw('The treatment of {count} of {company}’s marks is not measured: the catalog does not say what colours their theme or treatment gives.', words);
    case 'surface': return one
      ? tRaw('The colours of one of {company}’s marks are not measured: the mark follows the surface beneath.', words)
      : tRaw('The colours of {count} of {company}’s marks are not measured: the marks follow the surface beneath.', words);
    case 'size-unmodelled': return one
      ? tRaw('The drawn height of one of {company}’s marks is not measured: the mark moves, is placed by a layout or uses a setting this check does not read.', words)
      : tRaw('The drawn height of {count} of {company}’s marks is not measured: the marks move, are placed by a layout or use a setting this check does not read.', words);
    case 'clear-space-unmodelled': return one
      ? tRaw('The clear space of one of {company}’s marks is not measured: the mark or a layer near the mark uses a shape, turn, mask, stroke, effect, layout or movement this check does not read.', words)
      : tRaw('The clear space of {count} of {company}’s marks is not measured: the marks or layers near them use a shape, turn, mask, stroke, effect, layout or movement this check does not read.', words);
    case 'ground-unmodelled': return one
      ? tRaw('Whether one of {company}’s marks sits on a photo is not measured: the mark or a layer beneath the mark uses a layout, movement, mask, blend or effect this check does not read.', words)
      : tRaw('Whether {count} of {company}’s marks sit on a photo is not measured: the marks or layers beneath them use a layout, movement, mask, blend or effect this check does not read.', words);
    case 'treatment-unmodelled': return one
      ? tRaw('The colours of one of {company}’s marks are not measured: a blend mixes the mark with what lies beneath.', words)
      : tRaw('The colours of {count} of {company}’s marks are not measured: a blend mixes the marks with what lies beneath.', words);
    case 'work-limit': return one
      ? tRaw('One of {company}’s marks was not measured: this piece has more layers and marks than the check compares.', words)
      : tRaw('{count} of {company}’s marks were not measured: this piece has more layers and marks than the check compares.', words);
    case 'custom-css': return tRaw('This piece’s own CSS can restyle any layer, and the check for {company}’s kit reads each layer without that CSS.', words);
    case 'findings-limit': return one
      ? tRaw('One more finding for {company}’s kit is not shown.', words)
      : tRaw('{count} more findings for {company}’s kit are not shown.', words);
  }
}

/** What the brand check compared. Each count is its own singular or plural phrase,
 *  written as two whole t() literals so the translation extractor sees both forms. */
export function coverageText(checked: { colors: number; fonts: number; assets: number }): string {
  const { colors, fonts, assets } = checked;
  return tRaw('Compared {colors}, {fonts} and {assets}. Gradients, effects, nested content and subjective quality were not assessed.', {
    colors: colors === 1 ? t('1 colour value') : tRaw('{n} colour values', { n: colors }),
    fonts: fonts === 1 ? t('1 font choice') : tRaw('{n} font choices', { n: fonts }),
    assets: assets === 1 ? t('1 asset ID') : tRaw('{n} asset IDs', { n: assets }),
  });
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
  /** The partner kit the piece carries (plans/82 M8): its marks are measured, and its colours and logos are the guest's own. */
  partner?: () => { kit: PartnerKitV1; measure: GuestMarkMeasure } | null | Promise<{ kit: PartnerKitV1; measure: GuestMarkMeasure } | null>;
}): Promise<PreflightRow[]> {
  let partner: { kit: PartnerKitV1; measure: GuestMarkMeasure } | null = null;
  try { partner = (await options.partner?.()) ?? null; } catch { partner = null; }
  const guest = partner ? { guest: { colours: partner.kit.colours.map((c) => c.value), assets: partnerKitLogoIds(partner.kit) } } : {};
  const marks = partner ? checkGuestMarks(options.boxes(), partner.kit, partner.measure) : null;
  const markRows: PreflightRow[] = marks ? marks.findings.slice(0, 60).map((f) => ({ id: f.id, tone: 'note' as const, text: markFindingText(f) })) : [];
  // What the kit states and the check could not measure is said, never passed in silence,
  // one row per code in the reader's language.
  if (partner && marks) {
    for (const entry of marks.unmeasured) markRows.push({ id: `brand.mark.not-measured.${entry.code}`, tone: 'gap', text: unmeasuredText(entry, partner.kit.label) });
  }
  let snapshot: TokensSnapshot | undefined;
  try { snapshot = await options.snapshot(); } catch { snapshot = undefined; }
  const doc = snapshot?.document;
  if (!doc) return [...markRows, { id: 'brand.unavailable', tone: 'gap', text: t('The design system could not be read. Brand values have not been checked.') }];
  const catalogFacts = async (): Promise<BrandCheckCatalogOpts> => {
    try { return (await options.catalog?.()) ?? {}; } catch { return {}; }
  };
  const catalog = await catalogFacts();
  const report = checkBrandDesign(options.boxes(), doc, { theme: snapshot?.selection.theme ?? options.theme, ...catalog, ...guest });
  const rows: PreflightRow[] = report.findings.slice(0, 60).map(f => ({
    id: f.id, tone: f.status === 'unknown' ? 'gap' : 'note', text: findingText(f),
    ...(f.fix ? { action: {
      label: f.kind === 'font' ? t('Use brand font') : tRaw('Use {colour}', { colour: f.suggestion ?? '' }),
      run: async () => {
        const snapshot = await options.snapshot();
        const boxes = options.boxes();
        const current = checkBrandDesign(boxes, snapshot?.document, { theme: snapshot?.selection.theme ?? options.theme, ...(await catalogFacts()), ...guest });
        const stillOffered = current.findings.some(item => JSON.stringify(item.fix) === JSON.stringify(f.fix));
        const next = stillOffered ? applyBrandFix(boxes, f.fix!) : null;
        if (!next) throw new Error(t('This item changed. Close and reopen the checks to review it again.'));
        await options.write(next);
      },
    } } : {}),
  }));
  rows.unshift(...markRows);
  if (snapshot?.system?.label) rows.unshift({ id: 'brand.system', tone: 'note', text: tRaw('Design system: {name}', { name: snapshot.system.label }) });
  rows.push({ id: 'brand.coverage', tone: 'gap', text: coverageText(report.checked) });
  if (report.coverage.truncated || report.findings.length > 60) rows.push({ id: 'brand.limit', tone: 'gap', text: t('Some items are not shown. Review the rest after these items.') });
  return rows;
}
