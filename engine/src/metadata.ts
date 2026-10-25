// SPDX-License-Identifier: MPL-2.0
/**
 * Export provenance: the generic authorship record embedded into every exported
 * media file (platform-agnostic; no format/DOM knowledge here).
 *
 * The engine assembles these fields from the host profile plus the tool manifest;
 * each shell's export bridge then maps them onto the format's native metadata
 * mechanism (PNG iTXt, JPEG EXIF, PDF info dict, SVG <metadata>, and so on). This is the
 * clean path from author to asset: provenance travels with the file, not the app.
 *
 * Scope: provenance (who/what made the file) PLUS user-asserted copyright/licence
 * when a tool's inputs supply them via `bindToMeta` (the artist declaring the IP of
 * their OWN work; see the claim tool). Those two are NEVER auto-derived
 * from the profile. Lolly does not assert ownership the user did not state. Personal
 * fields (author/contact) appear only if the user filled in their profile; the
 * "Lolly" software/source tags are always stamped.
 *
 * The design-system record (plans/319, approved under the provenance rule on the
 * condition that it is shown at the moment of export and named in the public
 * docs): which design system, published version and colourway drew the export.
 * It is written only when the caller hands over a token snapshot (the runtime
 * does, while the export panel's "Design system" card is ticked) and only the
 * fields the snapshot actually knows. With no snapshot every field stays absent,
 * so a record built without one is byte-identical to one built before the record
 * existed.
 *
 * The brand skills record (plan 323, approved on the same condition): which brand
 * skill revisions guided an agent-made piece. It is written only when an agent
 * declared the skills it read and followed (`ExportMetaOptions.brandSkills`, which
 * the runtime fills from `ExportOpts.brandSkills` while the record is on), never
 * inferred. The words are "guided by": a skill is guidance, and nothing here
 * checks the export against one. With no skills nothing is added anywhere.
 */
import type { ExportBrandSkill, ExportMeta, ExportThemeChoice, Profile, ProfileAPI, TokenAxisKind, TokensSnapshot } from './bridge/host-v1.ts';
import { TOKEN_AXIS_KINDS } from '@lolly-tools/core/host-v1';
import { isAgentSkillName } from '@lolly-tools/core/skill-frontmatter-v1';
import { canonicalJson } from './canonical-json.ts';
import { DESIGN_VERSION_LATEST } from './design-version.ts';
import { isDesignSystemId } from './design-system.ts';
import { modeAxis, readTokenAxes } from './token-axes.ts';
import { resolveTokenSelection } from './token-selection.ts';

/** The slice of the host bridge this module needs: an optional profile source. */
export interface MetadataHost {
  profile?: Pick<ProfileAPI, 'get'>;
}

/** The slice of the tool manifest used for attribution. */
export interface MetadataManifest {
  id?: string;
  name?: string;
  version?: string;
  /**
   * The theme-axis kinds this tool does not follow (plans/319 section 7, the
   * manifest `tokenAxes` map). An ignored kind is never recorded and never named in
   * the description, because the tool did not apply that axis.
   */
  tokenAxes?: Readonly<Record<string, string>>;
}

/** The slice of an input-model item buildExportMeta reads for bindToMeta merging. */
export interface MetadataInput {
  bindToMeta?: 'author' | 'contact' | 'description' | 'copyright' | 'license';
  value?: unknown;
}

/** What buildExportMeta may record beyond the profile and the manifest. */
export interface ExportMetaOptions {
  /**
   * The token snapshot of the render (`host.tokens.snapshot()`, read through the
   * runtime's scoped host so it carries the artefact's own theme choice). Present,
   * the design-system record is filled from it; absent or null, nothing is.
   */
  snapshot?: TokensSnapshot | null;
  /**
   * The brand skills an agent declared it followed for this piece (plan 323).
   * Recorded as given, after malformed entries are dropped; absent, empty or
   * null, nothing is. Independent of the snapshot: a host with no design system
   * still records the skills an agent was handed.
   */
  brandSkills?: readonly ExportBrandSkill[] | null;
}

/** The record fields of an export's metadata, as the readers and writers below take them. */
export type DesignRecordFields = Pick<ExportMeta, 'designSystem' | 'designVersion' | 'themes' | 'brandSkills'>;

/** The design-system part of an export's metadata (plans/319). Every field is optional. */
export interface DesignRecord {
  designSystem?: { id: string; label: string };
  designVersion?: string;
  themes?: ExportThemeChoice[];
  /** The brand skills that guided an agent-made piece (plan 323). */
  brandSkills?: ExportBrandSkill[];
}

/** What an export would write about its design system, shown before anything is written. */
export interface MadeWithPreview {
  record: DesignRecord;
  /** The description as it will read with the record on. */
  description: string;
  /** The description as it will read with the record off. */
  plainDescription: string;
}

/** The XMP and SVG namespace the record's properties live in. */
export const LOLLY_XMP_NS = 'https://lolly.tools/ns/export/1.0/';

/** Bounds: a label is text a person typed, and a foreign credential is arbitrary bytes. */
const MAX_LABEL = 200;
const MAX_NAME = 120;
const MAX_VERSION = 64;
const MAX_GROUP = 64;
const MAX_THEMES = 16;
const MAX_THEMES_JSON = 8192;
const MAX_BRAND_SKILLS = 16;
const MAX_BRAND_SKILLS_JSON = 8192;
const MAX_SKILL_ID = 200;
/** A catalog asset id (schemas/asset.schema.json), the form a skill's id takes. */
const SKILL_ID_RE = /^[a-z0-9]+(?:\/[a-z0-9][a-z0-9-]*)+$/;
/** A brand skill's `skillRevision` (brand-skill-v1 validateBrandSkillMeta). */
const SKILL_REVISION_RE = /^[A-Za-z0-9._-]{1,32}$/;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n) : s);
const text = (v: unknown, n: number): string => (typeof v === 'string' ? clip(v.trim(), n) : '');
/** A design-system id as recorded: the trimmed value when it reads as one, else ''. */
const designSystemIdOf = (v: unknown): string => {
  const id = typeof v === 'string' ? v.trim() : '';
  return isDesignSystemId(id) ? id : '';
};

export async function buildExportMeta(
  host: MetadataHost | null | undefined,
  manifest: MetadataManifest | null | undefined,
  profile?: Profile | null,
  inputs?: ReadonlyArray<MetadataInput> | null,
  opts?: ExportMetaOptions,
): Promise<ExportMeta> {
  // The runtime already resolved the profile at mount; callers pass it through to
  // avoid a redundant lookup. Fall back to fetching when omitted.
  let p: Profile = {};
  if (profile == null) {
    try { p = (await host?.profile?.get()) ?? {}; } catch { p = {}; }
  } else {
    p = profile;
  }

  const clean = (s: string | null | undefined): string => (s == null ? '' : String(s).trim());
  // Personal details are embedded only when the user has opted in
  // (Profile → "Use my details"). The platform/tool attribution always stays.
  const optedIn = p.useDetails === true;
  const author  = optedIn ? [clean(p.firstname), clean(p.lastname)].filter(Boolean).join(' ') : '';
  const contact = optedIn ? [clean(p.email), clean(p.phone)].filter(Boolean).join(' · ') : '';
  const tool    = clean(manifest?.name) || clean(manifest?.id);
  const toolId  = clean(manifest?.id);
  const toolVersion = clean(manifest?.version);
  const record = opts?.snapshot ? designRecordOf(opts.snapshot, manifest) : {};
  const brandSkills = brandSkillRecords(opts?.brandSkills);

  // The colourway joins the tool's name, never the design system's label: the
  // label stays in the record. With no tool name there is nothing to qualify.
  const description = ['Made with https://lolly.tools', tool && `: ${toolCredit({ tool, ...record })}`, author && `by ${author}`]
    .filter(Boolean).join(' ');

  const meta: ExportMeta = {
    software: 'Lolly',
    // The tool's own page in the canonical share form (/t/<id>, engine/src/tool-url.ts)
    // when the id is known, else the site root. An identifier only - no inputs ride here.
    source: toolId ? `https://lolly.tools/t/${toolId}` : 'https://lolly.tools',
    tool,
    ...(toolId ? { toolId } : {}),
    ...(toolVersion ? { toolVersion } : {}),
    author,                                                   // '' if not opted in
    contact,                                                  // '' if none
    description,
    ...record,
    // Beside the design-system record, never in the description: the description
    // is the one-line credit, and the skills are a record of guidance.
    ...(brandSkills.length ? { brandSkills } : {}),
  };

  // bindToMeta: a tool's own inputs supply/override provenance fields: the artist's
  // explicit author/copyright/licence declaration for their OWN work. Trimmed string
  // values; empty ones are skipped so a blank input never wipes a profile default.
  // copyright/license have no profile source, so they only ever arrive this way.
  // A bound description replaces the default text whole, colourway included: those
  // are the author's own words and gain nothing.
  if (inputs) {
    for (const i of inputs) {
      const field = i.bindToMeta;
      if (!field) continue;
      const v = clean(i.value == null ? '' : String(i.value));
      if (v) meta[field] = v;
    }
  }
  return meta;
}

// ─── The design-system record ────────────────────────────────────────────────

/**
 * The record a snapshot supports. Pure and deterministic: the same snapshot and
 * manifest give the same record on every host.
 *
 * - The design system is the snapshot's `system`, id and label as the host names
 *   them.
 * - The version is recorded when it is a published version, never for the
 *   edit head (`latest`, `head`).
 * - A theme choice is recorded for every group with more than one option, except
 *   the light/dark group (`modeAxis`), whose choice the pixels already show, and
 *   except a kind the tool ignores through its manifest `tokenAxes`. The choice is
 *   the snapshot's resolved one, so a canonical colourway nobody picked is still
 *   recorded: it is what drew the export.
 */
export function designRecordOf(snapshot: TokensSnapshot | null | undefined, manifest?: MetadataManifest | null): DesignRecord {
  if (!snapshot) return {};
  const out: DesignRecord = {};
  // Only an id that reads as a design-system id is recorded, so a Recreate link
  // built from the record is always a valid `ds=`.
  const system = snapshot.system;
  const id = designSystemIdOf(system?.id);
  if (id) out.designSystem = { id, label: text(system?.label, MAX_LABEL) || id };
  const version = text(snapshot.version, MAX_VERSION);
  if (version && version !== DESIGN_VERSION_LATEST && version !== 'head') out.designVersion = version;
  const themes = recordedThemes(snapshot, manifest);
  if (themes.length) out.themes = themes;
  return out;
}

function recordedThemes(snapshot: TokensSnapshot, manifest?: MetadataManifest | null): ExportThemeChoice[] {
  const doc = snapshot.document;
  if (!doc || typeof doc !== 'object') return [];
  let axes: ReturnType<typeof readTokenAxes>['axes'];
  try { axes = readTokenAxes(doc).axes; } catch { return []; }
  if (!axes.length) return [];
  const mode = modeAxis(axes);
  const ignored = new Set(Object.entries(manifest?.tokenAxes ?? {}).filter(([, v]) => v === 'ignore').map(([k]) => k));
  // The snapshot's own choices, completed by the resolver for any group they do not
  // name, so a partial map still records the option that actually drew the export.
  const held = snapshot.selection?.choices;
  let choices: Record<string, string>;
  try {
    choices = resolveTokenSelection(doc, held && Object.keys(held).length ? { selection: held } : {}).choices;
  } catch { return []; }
  const out: ExportThemeChoice[] = [];
  for (const axis of axes) {
    if (out.length >= MAX_THEMES) break;
    if (axis === mode || axis.options.length < 2) continue;
    if (axis.kind && ignored.has(axis.kind)) continue;
    const option = axis.options.find(o => o.id === choices[axis.group]);
    if (!option) continue;
    out.push({
      group: clip(axis.group, MAX_GROUP),
      ...(axis.kind ? { kind: axis.kind } : {}),
      id: clip(option.id, MAX_NAME),
      name: clip(option.name, MAX_NAME) || clip(option.id, MAX_NAME),
    });
  }
  return out;
}

/** Only the record's own fields of a meta, for a caller that shows or compares them. */
export function designRecordFrom(meta: DesignRecordFields | null | undefined): DesignRecord {
  if (!meta) return {};
  return {
    ...(meta.designSystem ? { designSystem: { ...meta.designSystem } } : {}),
    ...(meta.designVersion ? { designVersion: meta.designVersion } : {}),
    ...(meta.themes?.length ? { themes: meta.themes.map(t => ({ ...t })) } : {}),
    ...(meta.brandSkills?.length ? { brandSkills: meta.brandSkills.map(s => ({ ...s })) } : {}),
  };
}

/** True when the record holds nothing to write. */
export function isEmptyDesignRecord(record: DesignRecord | null | undefined): boolean {
  return !record || (!record.designSystem && !record.designVersion && !record.themes?.length && !record.brandSkills?.length);
}

/** The colourway a record names, if any. */
export function recordedColourway(meta: Pick<ExportMeta, 'themes'> | null | undefined): ExportThemeChoice | undefined {
  return meta?.themes?.find(t => t.kind === 'colourway');
}

/**
 * The tool's name as the description and the PDF proof credit print it:
 * "Chart (Persimmon colourway)" when the record holds a colourway, else the bare
 * name. Empty when there is no tool name.
 */
export function toolCredit(meta: Pick<ExportMeta, 'tool' | 'themes'> | null | undefined): string {
  const tool = meta?.tool ?? '';
  if (!tool) return '';
  const colourway = recordedColourway(meta);
  return colourway ? `${tool} (${colourway.name} colourway)` : tool;
}

/**
 * The record as one plain English line, the words the CLI and the TUI show before
 * an export writes them: "Acme · Version 2026-10 · Colourway: Persimmon", ending
 * in "Guided by: acme-brand 1.0" when an agent declared brand skills. The web
 * shell builds the same line through its own translations. Empty for an empty
 * record. `skills: false` leaves the brand skills out, for a caller that names
 * them on a line of their own or compares design systems only.
 */
export function designRecordWords(record: DesignRecord | null | undefined, opts: { skills?: boolean } = {}): string {
  if (!record) return '';
  const parts: string[] = [];
  if (record.designSystem) parts.push(record.designSystem.label);
  if (record.designVersion) parts.push(`Version ${record.designVersion}`);
  for (const t of record.themes ?? []) parts.push(`${themeChoiceLabel(t)}: ${t.name}`);
  const guided = opts.skills === false ? '' : guidedByWords(record.brandSkills);
  if (guided) parts.push(`Guided by: ${guided}`);
  return parts.join(' · ');
}

/**
 * The brand skills a record names, as "acme-brand 1.0, acme-photography 1.2": each
 * skill's name and revision, in the recorded order. Empty when there are none.
 */
export function guidedByWords(skills: readonly ExportBrandSkill[] | null | undefined): string {
  return (skills ?? []).map(brandSkillLabel).join(', ');
}

/** One brand skill as people read it: its name and revision ("acme-brand 1.0"). */
export function brandSkillLabel(skill: Pick<ExportBrandSkill, 'name' | 'revision'>): string {
  return `${skill.name} ${skill.revision}`;
}

/** A theme group's heading in a record line: "Colourway" for a colourway, else the group's own id. */
export function themeChoiceLabel(choice: Pick<ExportThemeChoice, 'group' | 'kind'>): string {
  if (choice.kind === 'colourway') return 'Colourway';
  return choice.group || 'Theme';
}

/**
 * The record as flat scalar keys for the `tools.lolly.export` credential
 * assertion. Verify keeps only scalar values from that assertion, so the theme
 * choices travel as one canonical JSON string. Empty when the record is.
 */
export function designRecordEnvironment(meta: DesignRecordFields | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (meta?.designSystem?.id) {
    out.designSystem = meta.designSystem.id;
    out.designSystemLabel = meta.designSystem.label || meta.designSystem.id;
  }
  if (meta?.designVersion) out.designVersion = meta.designVersion;
  if (meta?.themes?.length) out.themes = canonicalJson(meta.themes);
  // The same reason as the themes: Verify keeps scalars, so the list is one JSON
  // string. Re-checked here, so a hand-built meta cannot write an unbounded value.
  const skills = brandSkillRecords(meta?.brandSkills);
  if (skills.length) out.brandSkills = canonicalJson(skills);
  return out;
}

/**
 * The record as PDF keyword entries ("Design system: Acme", "Colourway: Persimmon",
 * then one "Guided by: acme-brand 1.0" per brand skill).
 */
export function designRecordKeywords(meta: DesignRecordFields | null | undefined): string[] {
  if (!meta) return [];
  const out: string[] = [];
  if (meta.designSystem?.label) out.push(`Design system: ${meta.designSystem.label}`);
  if (meta.designVersion) out.push(`Design version: ${meta.designVersion}`);
  for (const t of meta.themes ?? []) out.push(`${themeChoiceLabel(t)}: ${t.name}`);
  for (const s of brandSkillRecords(meta.brandSkills)) out.push(`Guided by: ${brandSkillLabel(s)}`);
  return out;
}

/**
 * Export formats whose bytes hold none of an export's own metadata (plans/319): the
 * text and data formats, HTML, and the vector and bitmap formats with no description
 * field. A file in one of them carries no description, and carries the design-system
 * record only in a Content Credential, on the formats that can hold one.
 */
const METADATA_FREE_FORMATS: ReadonlySet<string> = new Set([
  'html', 'html-fragment', 'md', 'txt', 'js', 'json', 'csv', 'ics', 'vcf', 'srt', 'vtt', 'css', 'scss', 'gpl',
  'eps', 'eps-cmyk', 'emf', 'wmf', 'dxf', 'bmp', 'ico',
]);

/**
 * Where an export in `format` writes the design-system record (plans/319), for a
 * shell that shows the record before the export. `'file'`: the format's own
 * metadata carries the record and the description. `'credential'`: only the Content
 * Credential the export will stamp carries the record, and no description is
 * written. `null`: the file will carry no part of the record. `credential` says whether this
 * export stamps a credential that the format can hold.
 */
export function designRecordCarrier(format: string, credential: boolean): 'file' | 'credential' | null {
  if (!METADATA_FREE_FORMATS.has(format.toLowerCase())) return 'file';
  return credential ? 'credential' : null;
}

/** Every PDF keyword an export writes: the producing app, the tool's page, the contact, then the record. */
export function pdfKeywords(meta: ExportMeta | null | undefined): string[] {
  if (!meta) return [];
  return [meta.software, meta.source, meta.contact, ...designRecordKeywords(meta)].filter(Boolean) as string[];
}

const xmlEsc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const xmlUnesc = (s: string): string => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** The record's XMP and SVG property names, in the `lolly:` namespace (LOLLY_XMP_NS). */
const XML_PROPS = [
  ['designSystem', 'DesignSystem'],
  ['designSystemLabel', 'DesignSystemLabel'],
  ['designVersion', 'DesignVersion'],
  ['themes', 'Themes'],
  ['brandSkills', 'BrandSkills'],
] as const;

/**
 * The record as RDF property elements (`<lolly:DesignSystem>acme</lolly:DesignSystem>`
 * and so on), one string per property, escaped for XML. The same flat values as the
 * credential's keys. Empty when there is nothing to record, so a writer that adds
 * the namespace only when this is non-empty stays byte-identical for every other export.
 */
export function designRecordXml(meta: DesignRecordFields | null | undefined): string[] {
  const env = designRecordEnvironment(meta);
  return XML_PROPS.filter(([key]) => env[key]).map(([key, name]) => `<lolly:${name}>${xmlEsc(env[key]!)}</lolly:${name}>`);
}

/** The record an XMP packet or SVG metadata block carries in the `lolly:` namespace, or null. */
export function readDesignRecordXml(xml: string | null | undefined): DesignRecord | null {
  if (!xml?.includes('lolly:')) return null;
  const env: Record<string, string> = {};
  for (const [key, name] of XML_PROPS) {
    const max = key === 'brandSkills' ? MAX_BRAND_SKILLS_JSON : MAX_THEMES_JSON;
    const m = new RegExp(`<lolly:${name}>([^<]{0,${max}})</lolly:${name}>`).exec(xml);
    if (m) env[key] = xmlUnesc(m[1]!);
  }
  return readDesignRecord(env);
}

// ─── Reading a record back ───────────────────────────────────────────────────

/** A theme-choice list from its JSON form, bounded and shape-checked. Malformed entries are dropped. */
export function parseThemeChoices(raw: unknown): ExportThemeChoice[] {
  if (typeof raw !== 'string' || !raw || raw.length > MAX_THEMES_JSON) return [];
  let list: unknown;
  try { list = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(list)) return [];
  const out: ExportThemeChoice[] = [];
  for (const item of list.slice(0, MAX_THEMES)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.group !== 'string' || typeof r.id !== 'string' || !r.id) continue;
    const kind = typeof r.kind === 'string' && (TOKEN_AXIS_KINDS as readonly string[]).includes(r.kind) ? r.kind as TokenAxisKind : undefined;
    out.push({
      group: clip(r.group, MAX_GROUP),
      ...(kind ? { kind } : {}),
      id: clip(r.id, MAX_NAME),
      name: text(r.name, MAX_NAME) || clip(r.id, MAX_NAME),
    });
  }
  return out;
}

/**
 * A brand skills list, bounded and shape-checked: at most 16 entries, the first
 * of each id kept, and an entry dropped unless its id reads as an asset id, its
 * name as an Agent Skills name, its revision as a skill revision and its hash as
 * a SHA-256 digest (64 hex characters; a `sha256:` prefix and upper case are
 * normalised away). Used on the way in from an agent and on the way back from a
 * foreign file alike, so both hold the same shape. Never invents an entry.
 */
export function brandSkillRecords(raw: unknown): ExportBrandSkill[] {
  if (!Array.isArray(raw)) return [];
  const out: ExportBrandSkill[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (out.length >= MAX_BRAND_SKILLS) break;
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id.trim() : '';
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    const revision = typeof r.revision === 'string' ? r.revision.trim() : '';
    const sha256 = typeof r.sha256 === 'string' ? r.sha256.trim().toLowerCase().replace(/^sha256:/, '') : '';
    if (id.length > MAX_SKILL_ID || !SKILL_ID_RE.test(id) || seen.has(id)) continue;
    if (!isAgentSkillName(name) || !SKILL_REVISION_RE.test(revision) || !SHA256_HEX_RE.test(sha256)) continue;
    seen.add(id);
    out.push({ id, name, revision, sha256 });
  }
  return out;
}

/** A brand skills list from its JSON form (the credential key, the `lolly:BrandSkills` property). */
export function parseBrandSkills(raw: unknown): ExportBrandSkill[] {
  if (typeof raw !== 'string' || !raw || raw.length > MAX_BRAND_SKILLS_JSON) return [];
  let list: unknown;
  try { list = JSON.parse(raw); } catch { return []; }
  return brandSkillRecords(list);
}

/**
 * The record a credential's export assertion carries (the keys
 * `designRecordEnvironment` writes), or null when it carries none. The id must
 * read as a design-system id, so a Recreate link built from it is a valid `ds=`.
 */
export function readDesignRecord(env: Readonly<Record<string, unknown>> | null | undefined): DesignRecord | null {
  if (!env) return null;
  const out: DesignRecord = {};
  const id = designSystemIdOf(env.designSystem);
  if (id) out.designSystem = { id, label: text(env.designSystemLabel, MAX_LABEL) || id };
  const version = text(env.designVersion, MAX_VERSION);
  if (version && version !== DESIGN_VERSION_LATEST && version !== 'head') out.designVersion = version;
  const themes = parseThemeChoices(env.themes);
  if (themes.length) out.themes = themes;
  const brandSkills = parseBrandSkills(env.brandSkills);
  if (brandSkills.length) out.brandSkills = brandSkills;
  return isEmptyDesignRecord(out) ? null : out;
}

/** A recorded theme list as a `_themes` selection (`{ "colourway": "persimmon" }`). */
export function themesSelection(themes: readonly ExportThemeChoice[] | null | undefined): Record<string, string> | undefined {
  if (!themes?.length) return undefined;
  const out: Record<string, string> = {};
  for (const t of themes) out[t.group] = t.id;
  return out;
}
