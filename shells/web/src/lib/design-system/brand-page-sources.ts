// SPDX-License-Identifier: MPL-2.0
/**
 * What the web shell hands `buildBrandPage`: the active design system's tokens,
 * logos, fonts, public skills, the documents its house rules run on, examples and
 * outlined specimens. The engine decides what goes public. This file only reads, and
 * says what it could not read, so a file that failed is a held row and not a gap.
 *
 * Bytes come through the asset bridge, the same path a brand package uses. Examples
 * come through the same `brandExample` frames the Usage room proves, drawn as SVG with
 * their text outlined and nothing written into the file. An internal skill's text is
 * never read: only its name goes in, so the engine can count the skill.
 */
import type { AssetRef, TextAPI, TokenResolveOptions } from '@lolly-tools/core/host-v1';
import type { BrandPageHeldV1 } from '@lolly-tools/core/brand-page-v1';
import {
  brandPageOutlines, buildBrandPage,
  type BrandPageAssetInputV1, type BrandPageBuildV1, type BrandPageDocumentInputV1, type BrandPageExampleInputV1,
  type BrandPageFontInputV1, type BrandPageInputV1, type BrandPageOutlineV1, type BrandPageSkillInputV1,
} from '../../../../../engine/src/brand-page.ts';
import { redistribution } from '../../../../../engine/src/asset-rights.ts';
import { baselineBrandSkill } from '../../../../../engine/src/brand-skill.ts';
import { designBrief, type DesignBriefAssetV1 } from '../../../../../engine/src/design-brief.ts';
import { DEFAULT_DESIGN_SYSTEM_ID, SHIPPED_DESIGN_SYSTEM_ID } from '../../../../../engine/src/design-system.ts';
import { axisOfKind, modeAxis, readTokenAxes } from '../../../../../engine/src/token-axes.ts';
import type { InputValue } from '../../../../../engine/src/inputs.ts';
import { resolveVectorFont } from '../../bridge/font-registry.ts';
import { brandFontStack } from '../../brand-vars.ts';
import { getTool, renderRowToBlob } from '../../pro/render-export.ts';
import { readFontEmbedding } from '../font-utils.ts';
import { fetchTemplateSeed } from '../template-source.ts';
import { listLogos } from '../brand-logos.ts';
import { listUserFonts, type UserFontsHost } from '../../user-fonts.ts';
import { briefSkillAssets, listOfferedBrandSkills, readBrandSkillFiles, skillBelongsTo } from './brand-skills.ts';
import { brandExample, EXAMPLE_TEXT } from './brand-examples.ts';
import { createDraftHost } from './draft-host.ts';
import { usageSystem, type UsageHost } from './usage-model.ts';
import type { BrandExample } from '../../../../../engine/src/brand-rules.ts';

const VECTOR_FIRST = ['svg', 'png', 'webp', 'jpg', 'jpeg'];
const FONT_FORMATS = new Set(['woff2', 'woff', 'otf', 'ttf']);
const RULE_DOCUMENTS = ['poster', 'slide-deck', 'pull-quote'];
/** The same three frames the terminal draws, with the labels the page uses. */
const EXAMPLES: ReadonlyArray<{ id: string; name: string; example: BrandExample }> = [
  { id: 'poster', name: 'Poster', example: 'brand-poster' },
  { id: 'slide-title', name: 'Title slide', example: 'brand-slide-title' },
  { id: 'slide-content', name: 'Content slide', example: 'brand-slide-content' },
];

/** The studio's host: the same one the Usage room and the Logos room read. */
export type BrandPageHost = UsageHost & UserFontsHost;

/** What one read of the active design system found. */
export interface BrandPageSources {
  name: string;
  id: string;
  tokens: Record<string, unknown>;
  logos: BrandPageAssetInputV1[];
  fonts: BrandPageFontInputV1[];
  skills: BrandPageSkillInputV1[];
  documents: BrandPageDocumentInputV1[];
  catalogAssets: DesignBriefAssetV1[];
  held: BrandPageHeldV1[];
  /** The system is managed, so its manager decides whether it is published. */
  managed: boolean;
}

/** The publisher's choices, kept apart from what was read. */
export interface BrandPageChoices {
  statement: string;
  contact: string;
  origin: string;
  madeWith: boolean;
  include: string[];
}

export const EMPTY_CHOICES: BrandPageChoices = { statement: '', contact: '', origin: '', madeWith: true, include: [] };

/** A logo the publisher may include: no licence is on record and no lock holds the logo back. */
export function includableLogos(logos: readonly BrandPageAssetInputV1[]): BrandPageAssetInputV1[] {
  return logos.filter(logo => logo.brandLock !== true && !redistribution({ license: logo.license, rights: logo.rights }).travels);
}

const metaOf = (ref: AssetRef): Record<string, unknown> => (ref.meta ?? {}) as Record<string, unknown>;
const nameOf = (ref: AssetRef): string | undefined => {
  const name = metaOf(ref).name;
  return typeof name === 'string' && name.trim() ? name : undefined;
};
const rightsOf = (meta: Record<string, unknown>): Pick<BrandPageAssetInputV1, 'license' | 'rights' | 'attribution'> => ({
  ...(typeof meta.license === 'string' ? { license: meta.license } : {}),
  ...(meta.rights !== undefined ? { rights: meta.rights as BrandPageAssetInputV1['rights'] } : {}),
  ...(typeof meta.attribution === 'string' ? { attribution: meta.attribution } : {}),
});

/** The best drawing of a catalog logo the bridge can give: vector first. */
async function logoFile(assets: BrandPageHost['assets'], ref: AssetRef): Promise<{ format: string; bytes: Uint8Array } | null> {
  if (!assets.bytes) return null;
  for (const format of VECTOR_FIRST) {
    try {
      const file = await assets.get(ref.id, { format });
      if (file.format === format) return { format, bytes: await assets.bytes(file) };
    } catch { /* this format is not on record: try the next */ }
  }
  return null;
}

async function readLogos(host: BrandPageHost, refs: readonly AssetRef[], allowManaged: boolean, held: BrandPageHeldV1[]): Promise<BrandPageAssetInputV1[]> {
  const { assets } = host;
  const out: BrandPageAssetInputV1[] = [];
  const lockOf = (meta: Record<string, unknown>): { brandLock?: boolean } => meta.brandLock === true && !allowManaged ? { brandLock: true } : {};
  for (const ref of refs) {
    const meta = metaOf(ref);
    const tags = Array.isArray(meta.tags) ? meta.tags.filter((tag): tag is string => typeof tag === 'string') : [];
    if (!tags.includes('logo') || meta.deprecated === true) continue;
    const name = nameOf(ref);
    const file = await logoFile(assets, ref).catch(() => null);
    if (!file) { held.push({ item: name ?? ref.id, reason: 'Lolly could not read this logo.', kind: 'unknown' }); continue; }
    out.push({ id: ref.id, format: file.format, bytes: file.bytes, tags, ...(name ? { name } : {}), ...rightsOf(meta), ...lockOf(meta) });
  }
  // Marks the person added to this system. A shipped system's own marks were read above.
  const seen = new Set(out.map(logo => logo.id));
  const slots = await listLogos(host).catch(() => []);
  for (const slot of slots) {
    if (seen.has(slot.assetId)) continue;
    seen.add(slot.assetId);
    try {
      const ref = await assets.get(slot.assetId);
      if (!assets.bytes) throw new Error('This host cannot read bytes.');
      const meta = metaOf(ref);
      out.push({ id: slot.assetId, name: slot.label, format: ref.format, bytes: await assets.bytes(ref), tags: ['logo'], ...rightsOf(meta), ...lockOf(meta) });
    } catch {
      held.push({ item: slot.label, reason: 'Lolly could not read this logo.', kind: 'unknown' });
    }
  }
  return out;
}

function fontFacts(bytes: Uint8Array): { embedding?: string } {
  const permission = readFontEmbedding(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer).permission;
  return permission === 'unknown' ? {} : { embedding: permission };
}

async function readFonts(host: BrandPageHost, refs: readonly AssetRef[], held: BrandPageHeldV1[]): Promise<BrandPageFontInputV1[]> {
  const { assets } = host;
  const out: BrandPageFontInputV1[] = [];
  for (const ref of refs) {
    if (ref.type !== 'font' || !FONT_FORMATS.has(ref.format) || !assets.bytes) continue;
    const meta = metaOf(ref);
    const family = typeof meta.family === 'string' ? meta.family : nameOf(ref);
    if (!family) continue;
    try {
      const bytes = await assets.bytes(ref);
      out.push({
        family, format: ref.format, bytes, ...fontFacts(bytes), ...rightsOf(meta),
        ...(typeof meta.weight === 'string' || typeof meta.weight === 'number' ? { weight: String(meta.weight) } : {}),
        ...(typeof meta.style === 'string' ? { style: meta.style } : {}),
      });
    } catch { held.push({ item: `${family} font file`, reason: 'Lolly could not read this file.', kind: 'unknown' }); }
  }
  const userFonts = await listUserFonts(host).catch(() => []);
  for (const family of userFonts) {
    for (const id of family.assetIds) {
      try {
        const ref = await assets.get(id);
        if (!assets.bytes || !FONT_FORMATS.has(ref.format)) continue;
        const meta = metaOf(ref);
        const bytes = await assets.bytes(ref);
        out.push({
          family: family.family, format: ref.format, bytes, ...fontFacts(bytes), ...rightsOf(meta),
          ...(typeof meta.weight === 'string' || typeof meta.weight === 'number' ? { weight: String(meta.weight) } : {}),
          ...(typeof meta.style === 'string' ? { style: meta.style } : {}),
        });
      } catch { held.push({ item: `${family.family} font file`, reason: 'Lolly could not read this file.', kind: 'unknown' }); }
    }
  }
  return out;
}

async function readSkills(host: BrandPageHost, doc: unknown, name: string, held: BrandPageHeldV1[]): Promise<{ skills: BrandPageSkillInputV1[]; assets: DesignBriefAssetV1[] }> {
  const active = await listOfferedBrandSkills(host);
  const skills: BrandPageSkillInputV1[] = [];
  for (const skill of active) {
    const { entry } = skill;
    // Only the name of a skill that is not public, so the page can count the skill. Its text is never read.
    if (entry.audience !== 'public') { skills.push({ name: entry.name, audience: entry.audience, files: {} }); continue; }
    try {
      const files = await readBrandSkillFiles(host, skill);
      skills.push({ name: entry.name, label: entry.label, audience: 'public', discipline: entry.discipline, description: entry.description, files });
    } catch { held.push({ item: `${entry.label} skill`, reason: 'Lolly could not read this skill.', kind: 'unknown' }); }
  }
  const assets = briefSkillAssets(active.filter(skill => skill.entry.audience === 'public'));
  const brief = designBrief(doc, { assets }, { name });
  const baseline = baselineBrandSkill(brief);
  skills.push({
    name: baseline.meta.name, label: 'Baseline, generated from the tokens', audience: 'public', discipline: 'brand',
    description: brief.skills.baseline.description, files: { 'SKILL.md': baseline.markdown },
  });
  return { skills, assets };
}

async function readDocuments(): Promise<BrandPageDocumentInputV1[]> {
  const out: BrandPageDocumentInputV1[] = [];
  for (const id of RULE_DOCUMENTS) {
    const seed = await fetchTemplateSeed('design', id).catch(() => null) as { boxes?: unknown; background?: unknown } | null;
    if (Array.isArray(seed?.boxes)) out.push({ id: `design/${id}`, boxes: seed.boxes, background: seed.background ?? '{color.semantic.surface}' });
  }
  return out;
}

/** Read the active design system. `allowManaged` is the manager's yes, which lifts a brand lock. */
export async function readBrandPageSources(host: BrandPageHost, opts: { allowManaged?: boolean } = {}): Promise<BrandPageSources | null> {
  const snapshot = await host.tokens.snapshot?.().catch(() => null);
  const doc = snapshot?.document;
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  const record = await host.tokens.activeRecord?.().catch(() => null) ?? null;
  const name = record?.label || snapshot?.system?.label || 'Design system';
  // Catalog material belongs to this page only when the catalog's system is the one active.
  const catalog = skillBelongsTo({ id: 'catalog', source: 'library' }, record) ? await host.assets.query({}).catch(() => []) : [];
  const tokensLocked = catalog.some(ref => ref.type === 'tokens' && metaOf(ref).brandLock === true);
  const managed = record?.locked === true || tokensLocked;
  const allowManaged = opts.allowManaged === true;
  const held: BrandPageHeldV1[] = [];
  const [logos, fonts, skillRead, documents] = await Promise.all([
    readLogos(host, catalog, allowManaged, held),
    readFonts(host, catalog, held),
    readSkills(host, doc, name, held),
    readDocuments(),
  ]);
  // The shipped and first-install slots are not names: the engine reads the document's own identity instead.
  const ownId = record?.id && record.id !== SHIPPED_DESIGN_SYSTEM_ID && record.id !== DEFAULT_DESIGN_SYSTEM_ID ? record.id : '';
  return {
    name, id: ownId, tokens: doc as Record<string, unknown>,
    logos, fonts, skills: skillRead.skills, documents, catalogAssets: skillRead.assets, held, managed,
  };
}

/** The first mode and the canonical colourway, as the terminal draws them. */
function exampleSelection(doc: unknown): { mode: string; options: TokenResolveOptions } {
  const axes = readTokenAxes(doc).axes;
  const colourAxis = axisOfKind(axes, 'colourway');
  const mode = modeAxis(axes);
  const selection: Record<string, string> = {
    ...(mode?.options[0] ? { [mode.group]: mode.options[0].id } : {}),
    ...(colourAxis ? { [colourAxis.group]: colourAxis.canonical } : {}),
  };
  return { mode: mode?.options[0]?.id ?? 'light', options: { selection } };
}

/**
 * Draw the page's examples. A logo appears only when the page may publish it: an
 * example must not carry artwork the page holds back. A frame that cannot be drawn is
 * a held row. The file carries no credential, imprint or metadata, because it is a
 * picture on a page and not an export of someone's work.
 */
export async function drawBrandPageExamples(
  host: BrandPageHost, sources: BrandPageSources, include: readonly string[], signal: AbortSignal,
): Promise<{ examples: BrandPageExampleInputV1[]; held: BrandPageHeldV1[] }> {
  const usable = (id: unknown): boolean => {
    const logo = sources.logos.find(row => row.id === id);
    if (!logo || logo.brandLock === true) return false;
    return include.includes(logo.id) || redistribution({ license: logo.license, rights: logo.rights }).travels;
  };
  const examples: BrandPageExampleInputV1[] = [];
  const held: BrandPageHeldV1[] = [];
  const { mode, options } = exampleSelection(sources.tokens);
  const system = usageSystem(sources.tokens, sources.name);
  for (const row of EXAMPLES) {
    signal.throwIfAborted();
    try {
      const example = await brandExample(row.example, sources.tokens, system, mode, EXAMPLE_TEXT, options);
      await getTool(example.toolId);
      const framed = (example.values.boxes ?? []) as Array<Record<string, unknown>>;
      const values = { ...example.values, boxes: framed.filter(box => box.id !== 'brand-device' || usable(box.image)) } as Record<string, InputValue>;
      const draft = createDraftHost(host, example.renderDoc, options);
      const render = draft.export.render;
      draft.export.render = async (node, format, renderOptions) => {
        if (node instanceof HTMLElement) {
          node.style.setProperty('--font-brand', brandFontStack(example.family, 'sans-serif') ?? 'sans-serif');
          node.style.setProperty('--font-display', 'var(--font-brand)');
          await document.fonts.ready;
        }
        return render(node, format, renderOptions);
      };
      const result = await renderRowToBlob({ toolId: example.toolId, values }, draft, {
        format: 'svg', width: example.width, height: example.height, watermark: false, embedMeta: false, c2pa: false, imprint: false, madeWith: false, signal,
      });
      examples.push({ id: row.id, name: row.name, svg: await result.blob.text() });
    } catch (error) {
      signal.throwIfAborted();
      held.push({ item: `${row.name} example`, reason: `Lolly could not draw this example: ${String((error as Error)?.message ?? error).slice(0, 200)}`, kind: 'unknown' });
    }
  }
  return { examples, held };
}

/** The web shell's fonts through the shape the shared outline drawer reads. */
function outlineText(text: TextAPI): TextAPI {
  return {
    ...text,
    toPath: text.toPath.bind(text),
    fontUrl: async (family: string, opts?: { weight?: number }) => {
      const font = await resolveVectorFont({ fontFamily: `"${family}"`, fontWeight: String(opts?.weight ?? 400), fontStyle: 'normal' }, 'Aa');
      if (!font || font.face?.family?.toLowerCase() !== family.toLowerCase()) return null;
      return { url: font.url, ...(font.variations ? { variations: font.variations } : {}) };
    },
  } as TextAPI;
}

/** The brand's name and a specimen per family, as outlines, so a face can be seen without its file. */
export async function drawBrandPageOutlines(host: BrandPageHost, sources: BrandPageSources): Promise<{ outlines: BrandPageOutlineV1[]; held: BrandPageHeldV1[] }> {
  const seen = new Set<string>();
  const brief = designBrief(sources.tokens, { assets: sources.catalogAssets }, { name: sources.name });
  const faces = (brief.fonts ?? []).flatMap(font => {
    const family = String(font.value).split(',')[0]!.trim().replace(/^['"]|['"]$/g, '');
    if (!family || seen.has(family)) return [];
    seen.add(family);
    return [{ family, display: font.path === 'font.display' }];
  });
  if (!host.text) return { outlines: [], held: faces.map(face => ({ item: `Specimen of ${face.family}`, reason: 'This build cannot draw text as outlines.', kind: 'unknown' as const })) };
  const outlines = await brandPageOutlines(outlineText(host.text), sources.name, faces);
  const held = faces
    .filter(face => !outlines.some(outline => outline.family === face.family && outline.role === 'specimen'))
    .map(face => ({ item: `Specimen of ${face.family}`, reason: 'Lolly has no file for this face on this device, so the page gives the name with no drawing.', kind: 'unknown' as const }));
  return { outlines, held };
}

/** Build the folder from what was read and what the publisher chose. Pure: same input, same bytes. */
export function assembleBrandPage(
  sources: BrandPageSources,
  choices: BrandPageChoices,
  drawn: { examples?: BrandPageExampleInputV1[]; outlines?: BrandPageOutlineV1[]; held?: BrandPageHeldV1[] } = {},
): Promise<BrandPageBuildV1> {
  const statement = choices.statement.trim(), contact = choices.contact.trim(), origin = choices.origin.trim();
  const input: BrandPageInputV1 = {
    tokens: sources.tokens,
    catalog: { assets: sources.catalogAssets },
    name: sources.name,
    ...(sources.id ? { id: sources.id } : {}),
    ...(/^https?:\/\//i.test(origin) ? { origin } : {}),
    ...(statement || contact ? { usage: { ...(statement ? { statement } : {}), ...(contact ? { contact } : {}) } } : {}),
    logos: sources.logos,
    fonts: sources.fonts,
    skills: sources.skills,
    documents: sources.documents,
    examples: drawn.examples ?? [],
    outlines: drawn.outlines ?? [],
    include: choices.include,
    held: [...sources.held, ...(drawn.held ?? [])],
    madeWith: choices.madeWith,
  };
  return buildBrandPage(input);
}
