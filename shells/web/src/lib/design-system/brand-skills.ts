// SPDX-License-Identifier: MPL-2.0
/**
 * The web shell's half of brand skills (plan 323): which skills belong to the
 * active design system, how one is read and admitted before anything shows it,
 * and the small pure pieces the Skills room, the assets view, the design brief
 * and Share > Invite an agent all read.
 *
 * A catalog skill is the catalog design system's own guidance, so it belongs to
 * the shipped system, to the person's edit of it and to a system whose instance
 * is the catalog (hosted, or a pack that carries its instance). A system made on
 * this device owns only the skills stored under its own namespace
 * (`user/ds/<id>/skill/`). The generated baseline belongs to every system.
 *
 * Skill text is fetched through the asset bridge (skills are `core` tier, so the
 * catalog sync has already cached them) and admitted with the engine's own check
 * every time it is read, so a file that changed after validation is refused with
 * a reason rather than shown.
 *
 * DOM-free apart from the one HTML helper for the assets details sheet.
 */
import type { AssetQuery, AssetRef } from '@lolly-tools/core/host-v1';
import {
  brandSkillApplies, brandSkillIndexEntry, brandSkillMetaOf,
  type BrandSkillDisciplineV1, type BrandSkillIndexEntryV1, type BrandSkillMetaV1, type BrandSkillScopeV1,
} from '@lolly-tools/core/brand-skill-v1';
import type { BrandSkillCoverageRowV1, BrandSkillCoverageV1 } from '../../../../../engine/src/brand-skill.ts';
import type { DesignBriefAssetV1 } from '../../../../../engine/src/design-brief.ts';
import { designSystemNamespace, isDesignSystemId } from '../../../../../engine/src/design-system.ts';
import { instancePath } from '../instance.ts';
import { t } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import type { ActiveRecord } from './active.ts';

/** The host slice skills are read through. Structural: any caller's host fits. */
export interface BrandSkillHost {
  assets: {
    query(filter: AssetQuery): Promise<AssetRef[]>;
    get(id: string): Promise<AssetRef>;
    bytes?(target: AssetRef | string): Promise<Uint8Array>;
  };
  tokens?: unknown;
}

/** One skill of the active design system, with its catalog entry and index row. */
export interface ActiveBrandSkill {
  entry: BrandSkillIndexEntryV1;
  meta: BrandSkillMetaV1;
  ref: AssetRef;
  /** SKILL.md as the index lists it: a catalog path or an instance URL, never a blob URL. */
  url: string;
  license?: string;
}

/** A brand skill as Share hands it to an agent: a URL on this instance, with its revision. */
export interface AgentBrandSkillLink {
  name: string;
  label: string;
  discipline: BrandSkillDisciplineV1;
  revision: string;
  url: string;
}

/** Display labels for the disciplines. The brand's own heading stays the skill's label. */
export const DISCIPLINE_LABELS: Record<BrandSkillDisciplineV1, string> = {
  brand: 'Brand', voice: 'Voice', logo: 'Logo', colour: 'Colour', typography: 'Typography', layout: 'Layout',
  photography: 'Photography', illustration: 'Illustration', iconography: 'Iconography', motion: 'Motion',
  sound: 'Sound', interactive: 'Interactive', presentation: 'Presentation', 'data-visualisation': 'Data visualisation',
  print: 'Print', merchandise: 'Merchandise', environmental: 'Environmental', social: 'Social',
  accessibility: 'Accessibility', other: 'Other',
};

/** The catalog-entry shape `brandSkillIndexEntry` reads, rebuilt from a bridge AssetRef. */
export function skillEntryOfRef(ref: AssetRef): Record<string, unknown> {
  const meta = (ref.meta ?? {}) as Record<string, unknown>;
  return {
    id: ref.id,
    type: ref.type,
    ...(typeof meta.name === 'string' ? { name: meta.name } : {}),
    ...(ref.version ? { version: ref.version } : {}),
    meta: { skill: meta.skill },
    formats: [{
      format: ref.format,
      url: ref.url,
      ...(typeof meta.size === 'number' ? { size: meta.size } : {}),
      ...(typeof meta.originalChecksum === 'string' ? { checksum: meta.originalChecksum } : {}),
    }],
  };
}

/** The index row of a bridge AssetRef, or null when it is not a usable skill. */
export function skillIndexEntryOfRef(ref: AssetRef): BrandSkillIndexEntryV1 | null {
  return ref.type === 'skill' ? brandSkillIndexEntry(skillEntryOfRef(ref)) : null;
}

/**
 * Whether a skill asset belongs to the active design system (see the module note).
 * No registry (an older host) means the catalog is the only system there is.
 */
export function skillBelongsTo(ref: Pick<AssetRef, 'id' | 'source'>, record: ActiveRecord | null): boolean {
  if (ref.source === 'user' || ref.id.startsWith('user/')) {
    if (!record || !isDesignSystemId(record.id)) return false;
    const ns = designSystemNamespace(record.id);
    return !!ns && ref.id.startsWith(`${ns}skill/`);
  }
  if (!record) return true;
  const source = record.source;
  if (source.kind === 'shipped' || source.kind === 'hosted') return true;
  if (source.kind === 'file') return !!source.instance;
  return source.kind === 'local' && source.from === 'shipped';
}

/** The order the room and the brief list skills in: the brand team's overall skill first. */
function rank(entry: BrandSkillIndexEntryV1): number {
  return (entry.discipline === 'brand' ? 0 : 2) + (entry.maintainer || entry.generated ? 1 : 0);
}

/** The active design system's skills, best first. Unusable entries are left out. */
export function activeSkillsOf(refs: readonly AssetRef[], record: ActiveRecord | null): ActiveBrandSkill[] {
  const out: ActiveBrandSkill[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    if (ref.type !== 'skill' || seen.has(ref.id) || !skillBelongsTo(ref, record)) continue;
    const entry = skillIndexEntryOfRef(ref);
    const meta = brandSkillMetaOf(skillEntryOfRef(ref));
    if (!entry || !meta) continue;
    seen.add(ref.id);
    const license = (ref.meta as { license?: unknown } | undefined)?.license;
    out.push({ entry, meta, ref, url: ref.url, ...(typeof license === 'string' ? { license } : {}) });
  }
  return out.sort((a, b) => rank(a.entry) - rank(b.entry) || a.entry.name.localeCompare(b.entry.name));
}

/** Reads the active record the way active.ts does, without importing the tokens bridge. */
async function activeRecordOf(host: BrandSkillHost): Promise<ActiveRecord | null> {
  const tokens = host.tokens as { activeRecord?(): Promise<ActiveRecord | null> } | undefined;
  try { return (await tokens?.activeRecord?.()) ?? null; } catch { return null; }
}

/** The active design system's skills, read from the asset bridge. Empty when nothing answers. */
export async function listActiveBrandSkills(host: BrandSkillHost): Promise<ActiveBrandSkill[]> {
  let refs: AssetRef[];
  try { refs = await host.assets.query({ type: 'skill' }); } catch { return []; }
  return activeSkillsOf(refs, await activeRecordOf(host));
}

/** The brief rows for the active skills, so `designBrief` lists them without bodies. */
export function briefSkillAssets(skills: readonly ActiveBrandSkill[]): DesignBriefAssetV1[] {
  return skills.map((s) => ({
    id: s.ref.id, type: 'skill', name: s.entry.label, skill: s.entry,
    ...(s.license ? { license: s.license } : {}),
  }));
}

/** The catalog facts a web brief adds: the active skills, or null when there are none. */
export async function briefSkillCatalog(host: BrandSkillHost): Promise<{ assets: DesignBriefAssetV1[] } | null> {
  const skills = await listActiveBrandSkills(host);
  return skills.length ? { assets: briefSkillAssets(skills) } : null;
}

/** An absolute URL for a catalog path on this instance (`location.origin` unless an instance is set). */
export function instanceUrl(path: string, href: string = typeof location === 'undefined' ? 'http://localhost/' : location.href): string {
  return new URL(instancePath(path), href).href;
}

/** At most this many brand skills ride in one set of agent instructions. */
export const AGENT_BRAND_SKILLS_MAX = 8;

/**
 * The skills Share hands an agent for one open tool: the overall brand skill always,
 * then the ones whose `appliesTo` matches the tool. Public catalog skills only: an
 * internal skill never appears in copied text, and a skill stored on this device has
 * no URL another machine could open.
 */
export function agentBrandSkillLinks(skills: readonly ActiveBrandSkill[], scope: BrandSkillScopeV1, href?: string): AgentBrandSkillLink[] {
  return skills
    .filter((s) => s.entry.audience === 'public' && s.ref.source !== 'user' && !s.ref.id.startsWith('user/'))
    .filter((s) => /^(?:\/|https?:\/\/)/i.test(s.url))
    .filter((s) => brandSkillApplies(s.entry, scope))
    .slice(0, AGENT_BRAND_SKILLS_MAX)
    .map((s) => ({ name: s.entry.name, label: s.entry.label, discipline: s.entry.discipline, revision: s.entry.skillRevision, url: instanceUrl(s.url, href) }));
}

/** The brand skills for one open tool, read from the active design system. */
export async function agentBrandSkills(host: BrandSkillHost, scope: BrandSkillScopeV1): Promise<AgentBrandSkillLink[]> {
  return agentBrandSkillLinks(await listActiveBrandSkills(host), scope);
}

/** Bytes from a catalog path on this instance, refusing an error response. */
async function fetchCatalogBytes(path: string, fetcher: typeof fetch, what: string): Promise<Uint8Array> {
  const response = await fetcher(instancePath(path));
  if (!response.ok) throw new Error(t('{what} could not be read.', { what }));
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * The files of one catalog skill: SKILL.md through the asset bridge (the cached
 * core-tier bytes), plus each reference the record lists. On a first visit the
 * core prefetch may still be running, and the bridge refuses an uncached asset;
 * the catalog path is then fetched directly, as the assets details sheet does.
 */
export async function readBrandSkillFiles(host: BrandSkillHost, skill: ActiveBrandSkill, fetcher: typeof fetch = fetch): Promise<Record<string, Uint8Array>> {
  let bytes: Uint8Array;
  try {
    const ref = await host.assets.get(skill.ref.id);
    bytes = host.assets.bytes ? await host.assets.bytes(ref) : await fetchCatalogBytes(ref.url, fetcher, skill.entry.label);
  } catch (error) {
    if (skill.ref.source === 'user' || !/^(?:\/|https?:\/\/)/i.test(skill.url)) throw error;
    bytes = await fetchCatalogBytes(skill.url, fetcher, skill.entry.label);
  }
  const files: Record<string, Uint8Array> = { 'SKILL.md': bytes };
  for (const file of skill.meta.files ?? []) files[file.path] = await fetchCatalogBytes(file.url, fetcher, file.path);
  return files;
}

/** The coverage rows, grouped the way the room shows them. */
export interface GroupedCoverage {
  checked: BrandSkillCoverageRowV1[];
  conflicts: BrandSkillCoverageRowV1[];
  agree: BrandSkillCoverageRowV1[];
  guidance: BrandSkillCoverageRowV1[];
}

/** A quoted skill line as the room shows it: no list marker, heading hashes, emphasis
 *  marks or table pipes (a table row reads as its cells separated by middle dots). */
export function coverageLineText(text: string): string {
  const row = text.trim();
  if (row.startsWith('|')) return row.replace(/^\|\s*|\s*\|$/g, '').split(/\s*\|\s*/).filter(Boolean).join(' · ').replace(/\*\*|__|`/g, '');
  return text.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+|>\s*|#{1,6}\s+)/, '').replace(/\*\*|__|`/g, '').trim();
}

/**
 * One row per quoted line and status. The engine reports each declared font family
 * on its own row, so a line naming three families would otherwise show three times;
 * here their details join and their colour values merge.
 */
export function mergeCoverageRows(rows: readonly BrandSkillCoverageRowV1[]): BrandSkillCoverageRowV1[] {
  const out: BrandSkillCoverageRowV1[] = [];
  const byKey = new Map<string, BrandSkillCoverageRowV1>();
  for (const row of rows) {
    const key = `${row.status}|${row.line}|${row.text}`;
    const hit = byKey.get(key);
    if (!hit) {
      const fresh = { ...row, ...(row.values ? { values: [...row.values] } : {}) };
      byKey.set(key, fresh);
      out.push(fresh);
      continue;
    }
    if (row.detail && !hit.detail.includes(row.detail)) hit.detail = `${hit.detail} ${row.detail}`.trim();
    if (row.values?.length) {
      const values = hit.values ?? [];
      for (const v of row.values) if (!values.includes(v)) values.push(v);
      hit.values = values;
    }
  }
  return out;
}

export function groupCoverage(coverage: Pick<BrandSkillCoverageV1, 'rows'>): GroupedCoverage {
  const out: GroupedCoverage = { checked: [], conflicts: [], agree: [], guidance: [] };
  for (const row of mergeCoverageRows(coverage.rows)) {
    if (row.status === 'checked') out.checked.push(row);
    else if (row.status === 'conflict' || row.status === 'not-in-tokens') out.conflicts.push(row);
    else if (row.status === 'agree') out.agree.push(row);
    else out.guidance.push(row);
  }
  return out;
}

/**
 * "Copy as one file": the exported SKILL.md (which carries its source and revision
 * in its frontmatter) with each reference appended under a heading of its path, for
 * a chat window that takes no skill folders.
 */
export function skillAsOneFile(files: Record<string, string | Uint8Array>): string {
  const text = (v: string | Uint8Array): string => (typeof v === 'string' ? v : new TextDecoder().decode(v));
  const entry = files['SKILL.md'];
  const parts = [entry === undefined ? '' : text(entry).replace(/\s+$/, '')];
  for (const path of Object.keys(files).filter((p) => p.startsWith('references/')).sort()) {
    parts.push(`## ${path}\n\n${text(files[path]!).replace(/\s+$/, '')}`);
  }
  return `${parts.join('\n\n')}\n`;
}

/** What the room says about who answers for a skill. */
export function skillSteward(entry: Pick<BrandSkillIndexEntryV1, 'owner' | 'maintainer' | 'generated'>): string {
  if (entry.generated) return t('Generated by Lolly');
  if (entry.owner) return t('Owned by {name}', { name: entry.owner });
  if (entry.maintainer === 'lolly') return t('Maintained by Lolly');
  if (entry.maintainer) return t('Maintained by {name}', { name: entry.maintainer });
  return '';
}

/** The details sheet's rows for a skill asset: discipline, status, audience, revision and steward. */
export function skillDetailRows(ref: AssetRef): string {
  const entry = skillIndexEntryOfRef(ref);
  if (!entry) return '';
  const row = (label: string, value: string): string => (value ? `<div><dt>${escapeText(label)}</dt><dd>${escapeText(value)}</dd></div>` : '');
  const href = `#/start?area=skills&skill=${encodeURIComponent(entry.id)}`;
  return row(t('Discipline'), t(DISCIPLINE_LABELS[entry.discipline]))
    + row(t('Status'), entry.status === 'approved' ? t('Approved by the brand') : t('Draft'))
    + row(t('Audience'), entry.audience === 'internal' ? t('Internal') : t('Public'))
    + row(t('Revision'), entry.skillRevision)
    + row(t('Steward'), skillSteward(entry))
    + `<div><dt>${escapeText(t('Skill'))}</dt><dd><a href="${escapeText(href)}">${escapeText(t('Open in Skills'))}</a></dd></div>`;
}
