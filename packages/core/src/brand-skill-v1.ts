// SPDX-License-Identifier: MPL-2.0
/**
 * Brand skills (plan 323): a brand's standards for one discipline, written as an Agent
 * Skill and carried as a design-system asset of `type: "skill"`.
 *
 * A skill is guidance the brand wrote. It is read by people and agents and never yields a
 * pass or a fail. The executable layer stays `BrandSystemV1.rules`, which may cite a skill
 * as its source. The catalog record lives in the asset's `meta.skill`; this module is the
 * one reader of it, shared by the validator, the engine, the shells and the MCP server.
 */
import { isAgentSkillName, SKILL_DESCRIPTION_MAX } from './skill-frontmatter-v1.ts';

/** The disciplines a brand skill can declare. The brand's own heading stays the display label. */
export const BRAND_SKILL_DISCIPLINES = [
  'brand', 'voice', 'logo', 'colour', 'typography', 'layout', 'photography', 'illustration', 'iconography',
  'motion', 'sound', 'interactive', 'presentation', 'data-visualisation', 'print', 'merchandise',
  'environmental', 'social', 'accessibility', 'other',
] as const;
export type BrandSkillDisciplineV1 = (typeof BRAND_SKILL_DISCIPLINES)[number];

/** `public` ships wherever the catalog ships; `internal` stays out of every static catalog. */
export const BRAND_SKILL_AUDIENCES = ['public', 'internal'] as const;
export type BrandSkillAudienceV1 = (typeof BRAND_SKILL_AUDIENCES)[number];

/** Approval is the brand's statement. It does not mean Lolly checked anything. */
export const BRAND_SKILL_STATUSES = ['draft', 'approved'] as const;
export type BrandSkillStatusV1 = (typeof BRAND_SKILL_STATUSES)[number];

export const BRAND_SKILL_MEDIA = ['print', 'screen', 'video', 'audio'] as const;

/** The same limits tool skills keep (docs/tool-skills.md). */
export const BRAND_SKILL_MAX_BYTES = 65536;
export const BRAND_SKILL_FILES_MAX_BYTES = 524288;
export const BRAND_SKILL_MAX_REFERENCES = 16;

/** A reference file: one level deep, under `references/`, text formats only. */
export function isBrandSkillReference(path: unknown): path is string {
  return typeof path === 'string' && /^references\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.(?:md|json|csv|txt)$/.test(path);
}

/** One reference file as the catalog index lists it, checked like a format. */
export interface BrandSkillFileV1 {
  path: string;
  url: string;
  checksum: string;
  size: number;
}

/** What a skill is for, so the right skills reach an open tool or an asset family. */
export interface BrandSkillAppliesToV1 {
  /** Tool ids. */
  tools?: string[];
  /** Tool categories. */
  categories?: string[];
  /** Export formats (`pdf`, `svg`, `mp4`). */
  formats?: string[];
  media?: Array<(typeof BRAND_SKILL_MEDIA)[number]>;
  /** Asset families as id prefixes ending in `/` (`suse/icons/`), the notion pack.json uses. */
  families?: string[];
}

/** An external link in the skill that the owner approved as meaning a catalog asset. */
export interface BrandSkillReferenceMapV1 {
  url: string;
  asset: string;
}

/** The catalog record of one brand skill: the asset's `meta.skill`. */
export interface BrandSkillMetaV1 {
  /** The Agent Skills name: unique within the design system. */
  name: string;
  description: string;
  discipline: BrandSkillDisciplineV1;
  audience: BrandSkillAudienceV1;
  status: BrandSkillStatusV1;
  /** The brand's own revision label (`1.0`), apart from the catalog SemVer. */
  skillRevision: string;
  /** Who answers for the skill, in the brand's own words. */
  owner?: string;
  /** When the owner last reviewed it (YYYY-MM-DD). */
  reviewed?: string;
  /** What changed in this revision, in the owner's words. */
  revisionNote?: string;
  /** Who maintains the text when it is not the brand team (`lolly`). */
  maintainer?: string;
  appliesTo?: BrandSkillAppliesToV1;
  references?: BrandSkillReferenceMapV1[];
  files?: BrandSkillFileV1[];
  /** True on the baseline Lolly writes from the design brief. */
  generated?: boolean;
}

/** The cheap listing an agent reads first: no bodies. */
export interface BrandSkillIndexEntryV1 {
  id: string;
  name: string;
  label: string;
  description: string;
  discipline: BrandSkillDisciplineV1;
  audience: BrandSkillAudienceV1;
  status: BrandSkillStatusV1;
  skillRevision: string;
  version: string;
  owner?: string;
  reviewed?: string;
  maintainer?: string;
  appliesTo?: BrandSkillAppliesToV1;
  generated?: boolean;
  /** Bytes of SKILL.md plus its references. */
  size?: number;
  /** The SRI checksum of SKILL.md, as recorded in the index. */
  checksum?: string;
  references?: string[];
}

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const nonEmpty = (v: unknown, max = 200): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const stringList = (v: unknown, test: (s: string) => boolean): boolean =>
  Array.isArray(v) && v.length > 0 && v.length <= 64 && v.every((s) => typeof s === 'string' && test(s));

/** Every problem with a `meta.skill` record, in plain words. Empty when it is usable. */
export function validateBrandSkillMeta(meta: unknown): string[] {
  if (!record(meta)) return ['meta.skill must be an object.'];
  const errors: string[] = [];
  if (!isAgentSkillName(meta.name)) errors.push('name must be 1 to 64 lowercase letters, digits and single hyphens.');
  if (!nonEmpty(meta.description, SKILL_DESCRIPTION_MAX)) errors.push(`description must be 1 to ${SKILL_DESCRIPTION_MAX} characters.`);
  if (!(BRAND_SKILL_DISCIPLINES as readonly unknown[]).includes(meta.discipline)) errors.push(`discipline must be one of ${BRAND_SKILL_DISCIPLINES.join(', ')}.`);
  if (!(BRAND_SKILL_AUDIENCES as readonly unknown[]).includes(meta.audience)) errors.push('audience must be public or internal.');
  if (!(BRAND_SKILL_STATUSES as readonly unknown[]).includes(meta.status)) errors.push('status must be draft or approved.');
  if (typeof meta.skillRevision !== 'string' || !/^[A-Za-z0-9._-]{1,32}$/.test(meta.skillRevision)) errors.push('skillRevision must be 1 to 32 letters, digits, dots, hyphens or underscores.');
  for (const key of ['owner', 'maintainer'] as const) if (meta[key] !== undefined && !nonEmpty(meta[key], 120)) errors.push(`${key} must be a short name.`);
  if (meta.revisionNote !== undefined && !nonEmpty(meta.revisionNote, 500)) errors.push('revisionNote must be 1 to 500 characters.');
  if (meta.reviewed !== undefined && (typeof meta.reviewed !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(meta.reviewed))) errors.push('reviewed must be a YYYY-MM-DD date.');
  if (meta.generated !== undefined && meta.generated !== true) errors.push('generated is either true or left out.');
  if (meta.appliesTo !== undefined) {
    const a = meta.appliesTo;
    if (!record(a) || !Object.keys(a).length) errors.push('appliesTo must name at least one of tools, categories, formats, media or families.');
    else {
      for (const key of Object.keys(a)) if (!['tools', 'categories', 'formats', 'media', 'families'].includes(key)) errors.push(`appliesTo.${key} is not a known key.`);
      if (a.tools !== undefined && !stringList(a.tools, (s) => /^[a-z0-9][a-z0-9-]*$/.test(s))) errors.push('appliesTo.tools must list tool ids.');
      if (a.categories !== undefined && !stringList(a.categories, (s) => /^[a-z0-9][a-z0-9-]*$/.test(s))) errors.push('appliesTo.categories must list category ids.');
      if (a.formats !== undefined && !stringList(a.formats, (s) => /^[a-z0-9][a-z0-9.+-]*$/.test(s))) errors.push('appliesTo.formats must list export formats.');
      if (a.media !== undefined && !stringList(a.media, (s) => (BRAND_SKILL_MEDIA as readonly string[]).includes(s))) errors.push(`appliesTo.media must list ${BRAND_SKILL_MEDIA.join(', ')}.`);
      if (a.families !== undefined && !stringList(a.families, (s) => /^[a-z0-9]+(?:\/[a-z0-9][a-z0-9-]*)*\/$/.test(s))) errors.push('appliesTo.families must list asset id prefixes ending in "/".');
    }
  }
  if (meta.references !== undefined && (!Array.isArray(meta.references) || meta.references.some((r) => !record(r) || typeof r.url !== 'string' || !/^https?:\/\//.test(r.url) || typeof r.asset !== 'string' || !r.asset))) {
    errors.push('references must list { url, asset } pairs with an http(s) url.');
  }
  if (meta.files !== undefined) {
    if (!Array.isArray(meta.files) || meta.files.length > BRAND_SKILL_MAX_REFERENCES) errors.push(`files must list at most ${BRAND_SKILL_MAX_REFERENCES} references.`);
    else {
      const seen = new Set<string>();
      for (const f of meta.files) {
        if (!record(f) || !isBrandSkillReference(f.path) || typeof f.url !== 'string' || typeof f.checksum !== 'string' || typeof f.size !== 'number') {
          errors.push('each file needs a references/ path, a url, a checksum and a size.');
          continue;
        }
        if (seen.has(f.path)) errors.push(`file ${f.path} is listed twice.`);
        seen.add(f.path);
      }
    }
  }
  return errors;
}

/** The skill record of a catalog asset entry, or null when it is not a usable skill. */
export function brandSkillMetaOf(asset: unknown): BrandSkillMetaV1 | null {
  if (!record(asset) || asset.type !== 'skill' || !record(asset.meta)) return null;
  const meta = asset.meta.skill;
  return validateBrandSkillMeta(meta).length ? null : meta as unknown as BrandSkillMetaV1;
}

/** The index row of one catalog skill asset, or null when the entry is not a usable skill. */
export function brandSkillIndexEntry(asset: unknown): BrandSkillIndexEntryV1 | null {
  const meta = brandSkillMetaOf(asset);
  if (!meta || !record(asset) || typeof asset.id !== 'string') return null;
  const formats = Array.isArray(asset.formats) ? asset.formats.filter(record) : [];
  const entry = formats.find((f) => f.format === 'md') ?? formats[0];
  const files = meta.files ?? [];
  const size = (typeof entry?.size === 'number' ? entry.size : 0) + files.reduce((n, f) => n + f.size, 0);
  return {
    id: asset.id,
    name: meta.name,
    label: typeof asset.name === 'string' && asset.name.trim() ? asset.name : meta.name,
    description: meta.description,
    discipline: meta.discipline,
    audience: meta.audience,
    status: meta.status,
    skillRevision: meta.skillRevision,
    version: typeof asset.version === 'string' ? asset.version : '0.0.0',
    ...(meta.owner ? { owner: meta.owner } : {}),
    ...(meta.reviewed ? { reviewed: meta.reviewed } : {}),
    ...(meta.maintainer ? { maintainer: meta.maintainer } : {}),
    ...(meta.appliesTo ? { appliesTo: meta.appliesTo } : {}),
    ...(meta.generated ? { generated: true } : {}),
    ...(size ? { size } : {}),
    ...(typeof entry?.checksum === 'string' ? { checksum: entry.checksum } : {}),
    ...(files.length ? { references: files.map((f) => f.path) } : {}),
  };
}

/** What a skill is being matched against: the open tool, an export or an asset family. */
export interface BrandSkillScopeV1 {
  tool?: string;
  category?: string;
  format?: string;
  medium?: string;
  /** An asset id; matched against `appliesTo.families` prefixes. */
  asset?: string;
}

/**
 * Whether a skill applies to a scope. The overall `brand` skill always applies. A skill
 * with no `appliesTo` applies only when it is asked for by name, so a photography skill
 * does not ride along with every QR code.
 */
export function brandSkillApplies(entry: Pick<BrandSkillIndexEntryV1, 'discipline' | 'appliesTo'>, scope: BrandSkillScopeV1): boolean {
  if (entry.discipline === 'brand') return true;
  const a = entry.appliesTo;
  if (!a) return false;
  return !!(scope.tool && a.tools?.includes(scope.tool))
    || !!(scope.category && a.categories?.includes(scope.category))
    || !!(scope.format && a.formats?.includes(scope.format))
    || !!(scope.medium && (a.media as readonly string[] | undefined)?.includes(scope.medium))
    || !!(scope.asset && a.families?.some((prefix) => scope.asset!.startsWith(prefix)));
}

/**
 * The skills a static catalog may carry. Internal skills never reach one: a statically
 * hosted catalog is public whatever profile built the catalog.
 */
export function isPublicBrandSkillAsset(asset: unknown): boolean {
  if (!record(asset) || asset.type !== 'skill') return true;
  const meta = record(asset.meta) && record(asset.meta.skill) ? asset.meta.skill : null;
  return meta?.audience === 'public';
}
