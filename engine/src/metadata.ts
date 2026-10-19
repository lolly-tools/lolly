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
 */
import type { ExportMeta, ExportThemeChoice, Profile, ProfileAPI, TokenAxisKind, TokensSnapshot } from './bridge/host-v1.ts';
import { TOKEN_AXIS_KINDS } from '@lolly-tools/core/host-v1';
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
}

/** The design-system part of an export's metadata (plans/319). Every field is optional. */
export interface DesignRecord {
  designSystem?: { id: string; label: string };
  designVersion?: string;
  themes?: ExportThemeChoice[];
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
export function designRecordFrom(meta: Pick<ExportMeta, 'designSystem' | 'designVersion' | 'themes'> | null | undefined): DesignRecord {
  if (!meta) return {};
  return {
    ...(meta.designSystem ? { designSystem: { ...meta.designSystem } } : {}),
    ...(meta.designVersion ? { designVersion: meta.designVersion } : {}),
    ...(meta.themes?.length ? { themes: meta.themes.map(t => ({ ...t })) } : {}),
  };
}

/** True when the record holds nothing to write. */
export function isEmptyDesignRecord(record: DesignRecord | null | undefined): boolean {
  return !record || (!record.designSystem && !record.designVersion && !record.themes?.length);
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
 * an export writes them: "Acme · Version 2026-10 · Colourway: Persimmon". The web
 * shell builds the same line through its own translations. Empty for an empty record.
 */
export function designRecordWords(record: DesignRecord | null | undefined): string {
  if (!record) return '';
  const parts: string[] = [];
  if (record.designSystem) parts.push(record.designSystem.label);
  if (record.designVersion) parts.push(`Version ${record.designVersion}`);
  for (const t of record.themes ?? []) parts.push(`${themeChoiceLabel(t)}: ${t.name}`);
  return parts.join(' · ');
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
export function designRecordEnvironment(meta: Pick<ExportMeta, 'designSystem' | 'designVersion' | 'themes'> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (meta?.designSystem?.id) {
    out.designSystem = meta.designSystem.id;
    out.designSystemLabel = meta.designSystem.label || meta.designSystem.id;
  }
  if (meta?.designVersion) out.designVersion = meta.designVersion;
  if (meta?.themes?.length) out.themes = canonicalJson(meta.themes);
  return out;
}

/** The record as PDF keyword entries ("Design system: Acme", "Colourway: Persimmon"). */
export function designRecordKeywords(meta: Pick<ExportMeta, 'designSystem' | 'designVersion' | 'themes'> | null | undefined): string[] {
  if (!meta) return [];
  const out: string[] = [];
  if (meta.designSystem?.label) out.push(`Design system: ${meta.designSystem.label}`);
  if (meta.designVersion) out.push(`Design version: ${meta.designVersion}`);
  for (const t of meta.themes ?? []) out.push(`${themeChoiceLabel(t)}: ${t.name}`);
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
] as const;

/**
 * The record as RDF property elements (`<lolly:DesignSystem>acme</lolly:DesignSystem>`
 * and so on), one string per property, escaped for XML. The same flat values as the
 * credential's keys. Empty when there is nothing to record, so a writer that adds
 * the namespace only when this is non-empty stays byte-identical for every other export.
 */
export function designRecordXml(meta: Pick<ExportMeta, 'designSystem' | 'designVersion' | 'themes'> | null | undefined): string[] {
  const env = designRecordEnvironment(meta);
  return XML_PROPS.filter(([key]) => env[key]).map(([key, name]) => `<lolly:${name}>${xmlEsc(env[key]!)}</lolly:${name}>`);
}

/** The record an XMP packet or SVG metadata block carries in the `lolly:` namespace, or null. */
export function readDesignRecordXml(xml: string | null | undefined): DesignRecord | null {
  if (!xml?.includes('lolly:')) return null;
  const env: Record<string, string> = {};
  for (const [key, name] of XML_PROPS) {
    const m = new RegExp(`<lolly:${name}>([^<]{0,${MAX_THEMES_JSON}})</lolly:${name}>`).exec(xml);
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
  return isEmptyDesignRecord(out) ? null : out;
}

/** A recorded theme list as a `_themes` selection (`{ "colourway": "persimmon" }`). */
export function themesSelection(themes: readonly ExportThemeChoice[] | null | undefined): Record<string, string> | undefined {
  if (!themes?.length) return undefined;
  const out: Record<string, string> = {};
  for (const t of themes) out[t.group] = t.id;
  return out;
}
