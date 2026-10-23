// SPDX-License-Identifier: MPL-2.0
/**
 * The Node half of brand skills (plan 323): the active content profile's `skill` assets,
 * read from its catalog on disk, for the CLI (`lolly system skills`, `lolly system skill`)
 * and the MCP server (`lolly://design-system/skill/{name}`).
 *
 * Every skill is admitted again on read, with the same engine check an upload passes, so
 * a file edited on disk after validation is refused rather than served. The baseline
 * skill is generated from the profile's design brief on request; it is never stored.
 *
 * Audience: `internal` skills are listed and read only when the caller says it may see
 * them (`audience: 'all'`). The local CLI and stdio MCP read the developer's own pack on
 * disk and pass `all`; hosted surfaces pass `public`.
 *
 * Reads files and nothing else: no network, no clock.
 */

import { readFileSync } from 'node:fs';

import {
  admitBrandSkill, baselineBrandSkill, brandSkillCoverage, brandSkillCoverageFacts, brandSkillFreshness,
  classifyBrandSkillLinks, designBrief, exportBrandSkillFolder, licenceProfile, measureSvgFamily,
  normaliseLicence, spreadExemplars,
} from '@lolly/engine';
import type {
  AdmittedBrandSkillV1, BrandSkillCoverageV1, BrandSkillExportModeV1, BrandSkillExportV1, BrandSkillFreshnessV1,
} from '@lolly/engine';
import { brandSkillIndexEntry, brandSkillMetaOf } from '@lolly-tools/core/brand-skill-v1';
import type { BrandSkillIndexEntryV1, BrandSkillMetaV1 } from '@lolly-tools/core/brand-skill-v1';

import { contentRoots, contentUrlFile, type ContentRoots } from './content-roots.ts';
import { readProfileBriefCatalog, readProfileTokenDocument, type ProfileSourceOptsV1 } from './design-brief.ts';
import { assetsOf, type IndexAsset } from './rebrand/design-system.ts';

export type BrandSkillAudienceScopeV1 = 'public' | 'all';

export interface BrandSkillReadOptsV1 extends ProfileSourceOptsV1 {
  /** Which audiences the caller may see: `public` on hosted surfaces, `all` on the developer's own machine. */
  audience?: BrandSkillAudienceScopeV1;
}

type CatalogAsset = IndexAsset & {
  name?: string; description?: string; version?: string; license?: string; brandLock?: boolean;
  meta?: Record<string, unknown>; formats?: Array<{ format?: string; url?: string; checksum?: string; size?: number }>;
};

/** One skill of the active profile, admitted from disk. */
export interface ProfileBrandSkillV1 {
  entry: BrandSkillIndexEntryV1;
  meta: BrandSkillMetaV1;
  asset: CatalogAsset;
  skill: AdmittedBrandSkillV1;
}

export interface ProfileBrandSkillListV1 {
  profile: string;
  label?: string;
  skills: BrandSkillIndexEntryV1[];
  baseline: { name: string; description: string; generated: true };
  /** How many skills the audience scope left out, so a hosted listing says so. */
  withheld: number;
}

function rootsFor(opts: ProfileSourceOptsV1): ContentRoots | null {
  try {
    return contentRoots({
      ...(opts.profile !== undefined ? { profile: opts.profile } : {}),
      ...(opts.root !== undefined ? { root: opts.root } : {}),
    });
  } catch {
    return null;
  }
}

function catalogAssets(roots: ContentRoots): CatalogAsset[] {
  try { return assetsOf(roots) as CatalogAsset[]; } catch { return []; }
}

function visible(meta: BrandSkillMetaV1, audience: BrandSkillAudienceScopeV1): boolean {
  return audience === 'all' || meta.audience === 'public';
}

function brief(opts: ProfileSourceOptsV1) {
  const tokens = readProfileTokenDocument(opts);
  const catalog = readProfileBriefCatalog({ ...opts, skillAudience: 'all' });
  return designBrief(tokens?.doc ?? null, catalog, tokens?.label ? { name: tokens.label } : {});
}

/** The profile's skills, without bodies, plus the generated baseline's name. */
export function listProfileBrandSkills(opts: BrandSkillReadOptsV1 = {}): ProfileBrandSkillListV1 | null {
  const roots = rootsFor(opts);
  if (!roots) return null;
  const audience = opts.audience ?? 'public';
  const all = catalogAssets(roots).filter((a) => a.type === 'skill' && a.deprecated !== true);
  const skills: BrandSkillIndexEntryV1[] = [];
  let withheld = 0;
  for (const a of all) {
    const meta = brandSkillMetaOf(a);
    const entry = brandSkillIndexEntry(a);
    if (!meta || !entry) continue;
    if (visible(meta, audience)) skills.push(entry); else withheld++;
  }
  const section = brief(opts).skills;
  const order = new Map(section.index.map((e, i) => [e.id, i]));
  skills.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return {
    profile: roots.profile, ...(roots.label ? { label: roots.label } : {}), skills,
    baseline: { name: section.baseline.name, description: section.baseline.description, generated: true }, withheld,
  };
}

/** Reads and admits one skill by its Agent Skills name, or null when the profile has none visible by that name. */
export async function readProfileBrandSkill(name: string, opts: BrandSkillReadOptsV1 = {}): Promise<ProfileBrandSkillV1 | null> {
  const roots = rootsFor(opts);
  if (!roots) return null;
  const audience = opts.audience ?? 'public';
  const assets = catalogAssets(roots);
  const asset = assets.find((a) => a.type === 'skill' && a.deprecated !== true && brandSkillMetaOf(a)?.name === name);
  if (!asset) {
    const generated = baselineFor(name, opts);
    return generated;
  }
  const meta = brandSkillMetaOf(asset)!;
  if (!visible(meta, audience)) return null;
  const entry = brandSkillIndexEntry(asset)!;
  const url = asset.formats?.find((f) => f.format === 'md')?.url;
  const file = url ? contentUrlFile(url, roots) : null;
  if (!file) throw new Error(`The skill ${asset.id} has no file in the ${roots.profile} catalog.`);
  const files: Record<string, Uint8Array> = { 'SKILL.md': readFileSync(file) };
  for (const ref of meta.files ?? []) {
    const path = contentUrlFile(ref.url, roots);
    if (!path) throw new Error(`The skill ${asset.id} lists ${ref.path}, which is not in the catalog.`);
    files[ref.path] = readFileSync(path);
  }
  const admitted = await admitBrandSkill(files);
  if (!admitted.ok) throw new Error(`The skill ${asset.id} was refused: ${admitted.reason}`);
  return { entry, meta, asset, skill: admitted.skill };
}

function baselineFor(name: string, opts: ProfileSourceOptsV1): Promise<ProfileBrandSkillV1 | null> | null {
  const b = brief(opts);
  if (b.skills.baseline.name !== name) return null;
  const { meta, markdown } = baselineBrandSkill(b as unknown as Record<string, unknown>);
  return admitBrandSkill({ 'SKILL.md': new TextEncoder().encode(markdown) }).then((admitted) => {
    if (!admitted.ok) throw new Error(`The generated baseline was refused: ${admitted.reason}`);
    const id = `generated/skill/${meta.name}`;
    const entry: BrandSkillIndexEntryV1 = {
      id, name: meta.name, label: `${b.name} baseline (generated)`, description: meta.description, discipline: meta.discipline,
      audience: meta.audience, status: meta.status, skillRevision: meta.skillRevision, version: '0.0.0', maintainer: 'lolly', generated: true,
      size: admitted.skill.size,
    };
    return { entry, meta, asset: { id, type: 'skill', name: entry.label, version: '0.0.0' }, skill: admitted.skill };
  });
}

/** What a skill says against what the profile's design system declares and checks. */
export function profileBrandSkillCoverage(skill: ProfileBrandSkillV1, opts: ProfileSourceOptsV1 = {}): BrandSkillCoverageV1 {
  return brandSkillCoverage(skill.skill.parsed.body, brandSkillCoverageFacts(brief(opts)));
}

/** The engine's link classes for a skill, against the profile's catalog. */
export function profileBrandSkillLinks(skill: ProfileBrandSkillV1, opts: ProfileSourceOptsV1 = {}) {
  const roots = rootsFor(opts);
  const assets = roots ? catalogAssets(roots) : [];
  return classifyBrandSkillLinks(skill.skill.parsed.links, assets.map((a) => ({
    id: a.id, ...(a.type ? { type: a.type } : {}),
    formats: (a.formats ?? []).filter((f) => f.format && f.url).map((f) => ({ format: f.format!, url: f.url! })),
  })), skill.meta);
}

/** May an asset's bytes be copied into an exported folder? The rule `.lolly` packs follow. */
export function brandSkillRedistribution(asset: CatalogAsset): { travels: boolean; reason: string } {
  if (asset.brandLock === true) return { travels: false, reason: 'this brand pack is authoritative, so its bytes stay in the catalog' };
  if (!asset.license) return { travels: false, reason: 'licence not recorded' };
  const normalised = normaliseLicence(asset.license);
  const profile = normalised?.id ? licenceProfile(normalised.id) : null;
  if (!profile?.reviewed) return { travels: false, reason: `${normalised?.id ?? asset.license} is recorded and not yet interpreted` };
  if (profile.redistributeSource !== 'permitted-with-notices') return { travels: false, reason: `${profile.name} does not record permission to pass on the source file` };
  return { travels: true, reason: '' };
}

export interface BrandSkillExportOptsV1 extends BrandSkillReadOptsV1 {
  mode?: BrandSkillExportModeV1;
  /** The instance origin linked mode points at (`https://lolly.tools`). */
  origin?: string;
  /** Copy assets whose licence or brand lock would hold them back: the owner's stated choice. */
  includeLicensed?: boolean;
  /** Exemplars for a skill that governs an asset family. */
  exemplars?: number;
  /** Bundled assets budget in bytes. */
  budget?: number;
}

const fileName = (url: string): string => (url.split(/[?#]/)[0]!.split('/').pop() ?? 'asset').replace(/[^A-Za-z0-9._-]+/g, '-');

/**
 * An Agent Skills folder for one profile skill. Bundled mode copies the catalog assets
 * the skill links to and, for a skill that governs an asset family, an even spread of
 * exemplars plus a measured draft profile, within a budget and only where the licence
 * allows (or the owner says so). Linked mode points at the instance instead.
 */
export async function exportProfileBrandSkill(name: string, opts: BrandSkillExportOptsV1 = {}): Promise<BrandSkillExportV1 | null> {
  const skill = await readProfileBrandSkill(name, opts);
  if (!skill) return null;
  const roots = rootsFor(opts)!;
  const assets = catalogAssets(roots);
  const byId = new Map(assets.map((a) => [a.id, a]));
  const mode = opts.mode ?? 'linked';
  const links = profileBrandSkillLinks(skill, opts);
  const bundle: Record<string, { file: string; bytes: Uint8Array }> = {};
  const heldBack: Array<{ asset: string; reason: string }> = [];
  const extras: Record<string, string | Uint8Array> = {};
  let budget = opts.budget ?? 4 * 1024 * 1024;
  // Each asset is copied once and held back once, however often the skill links to the asset.
  const taken = new Map<string, { file: string; bytes: Uint8Array } | null>();
  const take = (asset: CatalogAsset): { file: string; bytes: Uint8Array } | null => {
    if (taken.has(asset.id)) return taken.get(asset.id)!;
    const got = copy(asset);
    taken.set(asset.id, got);
    return got;
  };
  const copy = (asset: CatalogAsset): { file: string; bytes: Uint8Array } | null => {
    const url = asset.formats?.find((f) => f.url)?.url;
    const path = url ? contentUrlFile(url, roots) : null;
    if (!url || !path) { heldBack.push({ asset: asset.id, reason: 'no file in this catalog' }); return null; }
    const rights = brandSkillRedistribution(asset);
    if (!rights.travels && !opts.includeLicensed) { heldBack.push({ asset: asset.id, reason: rights.reason }); return null; }
    const bytes = readFileSync(path);
    if (bytes.length > budget) { heldBack.push({ asset: asset.id, reason: 'over the bundle budget' }); return null; }
    budget -= bytes.length;
    return { file: fileName(url), bytes };
  };
  if (mode === 'bundled') {
    for (const link of links) {
      if (link.kind !== 'asset' || !link.asset || bundle[link.asset]) continue;
      const asset = byId.get(link.asset);
      if (!asset) { if (!heldBack.some((h) => h.asset === link.asset)) heldBack.push({ asset: link.asset, reason: 'not in this catalog' }); continue; }
      const got = take(asset);
      if (got) bundle[link.asset] = got;
    }
  }
  for (const family of skill.meta.appliesTo?.families ?? []) {
    const members = assets.filter((a) => a.id.startsWith(family) && a.deprecated !== true);
    if (!members.length) continue;
    const picks = spreadExemplars(members.map((a) => a.id), opts.exemplars ?? 12);
    const listed: Array<{ id: string; name?: string; file?: string; url?: string }> = [];
    for (const id of picks) {
      const asset = byId.get(id)!;
      const url = asset.formats?.find((f) => f.url)?.url;
      if (mode === 'bundled') {
        const linked = bundle[id];
        if (linked) { listed.push({ id, ...(asset.name ? { name: asset.name } : {}), file: `assets/${linked.file}` }); continue; }
        const got = take(asset);
        if (got) { extras[`assets/exemplars/${got.file}`] = got.bytes; listed.push({ id, ...(asset.name ? { name: asset.name } : {}), file: `assets/exemplars/${got.file}` }); continue; }
      }
      listed.push({ id, ...(asset.name ? { name: asset.name } : {}), ...(url && opts.origin ? { url: `${opts.origin.replace(/\/+$/, '')}${url}` } : {}) });
    }
    const svgs = members.flatMap((a) => {
      const f = a.formats?.find((x) => x.format === 'svg' && x.url);
      const path = f?.url ? contentUrlFile(f.url, roots) : null;
      try { return path ? [readFileSync(path, 'utf8')] : []; } catch { return []; }
    });
    const slug = family.replace(/\/+$/, '').replace(/[^a-z0-9]+/g, '-');
    extras[`references/exemplars-${slug}.json`] = `${JSON.stringify({ family, count: members.length, exemplars: listed }, null, 2)}\n`;
    if (svgs.length) {
      extras[`references/conformance-${slug}.json`] = `${JSON.stringify({
        format: 'lolly-conformance-draft', version: 1, family,
        note: 'Measured from the family as shipped, by text patterns over the SVG sources. A draft for the skill\'s owner to review against the skill: it is not a rule, and a family that disagrees with its skill is a finding, not an error.',
        measured: measureSvgFamily(svgs),
      }, null, 2)}\n`;
    }
  }
  return exportBrandSkillFolder({
    markdown: skill.skill.markdown, references: skill.skill.references, meta: skill.meta,
    asset: {
      id: skill.asset.id, version: skill.asset.version ?? '0.0.0',
      ...(skill.asset.name ? { name: skill.asset.name } : {}),
      ...(skill.asset.license ? { license: skill.asset.license } : {}),
      ...(skill.asset.formats?.[0]?.url ? { url: skill.asset.formats[0].url } : {}),
    },
    system: { ...(roots.label ? { label: roots.label } : {}), id: roots.profile },
    sha256: skill.skill.sha256, mode, ...(opts.origin ? { origin: opts.origin } : {}),
    links, bundle, heldBack, extras, coverage: profileBrandSkillCoverage(skill, opts),
  });
}

/** Compares an exported SKILL.md with the profile's current skill of the same asset id. */
export async function profileBrandSkillFreshness(markdown: string, opts: BrandSkillReadOptsV1 = {}): Promise<BrandSkillFreshnessV1> {
  const roots = rootsFor(opts);
  const empty = brandSkillFreshness(markdown, null);
  if (!roots || !empty.asset) return empty;
  const asset = catalogAssets(roots).find((a) => a.id === empty.asset && a.type === 'skill');
  const name = asset ? brandSkillMetaOf(asset)?.name : undefined;
  const current = name ? await readProfileBrandSkill(name, { ...opts, audience: opts.audience ?? 'all' }) : null;
  return brandSkillFreshness(markdown, current ? { id: current.entry.id, skillRevision: current.entry.skillRevision, version: current.entry.version, sha256: current.skill.sha256 } : null);
}
