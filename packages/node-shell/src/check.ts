// SPDX-License-Identifier: MPL-2.0
/**
 * One check for a Design document, a `.lolly` or an export (plan 291, W1): the
 * implementation behind `lolly check` and the `lolly_check` MCP tool.
 *
 * `checkFile(bytes, name, opts)` returns a `CheckReportV1`
 * (schemas/check-report-v1.schema.json) with five families:
 *
 *   structure  `inspectDesignV1` over the document's layers.
 *   render     the mounted audit (clipping, contrast, font coverage) in the web shell,
 *              through the browser tier, the document opened there as a saved session
 *              with its pictures (`designChecksViaSession`). Without a browser,
 *              a built shell or a shell that has the hook, the family is `unavailable`
 *              and says why; the others still run.
 *   brand      `checkBrandDesign` and the pack's house rules, against the design system
 *              the caller resolved (`designSystem`). None resolved: `unavailable`.
 *   verify     the forensic rules. A document is read from its own geometry
 *              (`verifyDesignDocument`, no OCR, no pixels); an export from its file
 *              (`inspectForensicBytes`, OCR and the text classifier off unless `ocr`).
 *   fidelity   the result against a source deck or inventory (`checkFidelity`), when
 *              `source` is given.
 *
 * Exit codes follow `CHECK_EXIT`: 0 clean (info allowed), 5 warnings to review, 4 an
 * error finding (or any warning under `strict`), 3 `browser: 'require'` on a document
 * with no browser tier to render it (an export has no render family, so the
 * requirement does not apply there), 1 a family that crashed or an export with no page
 * that could be decoded. Findings are data in the report; nothing here writes to
 * stderr.
 *
 * A check never reads as clean on what it did not assess: an export page with no
 * text layer, read with OCR off, is a `verify.text.unread` warning, and pages or
 * artboards past the page cap are a `verify.pages-capped` warning, with
 * `input.pages` the document's own page count.
 *
 * House rules: a broken rule is an error only when the brand approved it and marked
 * it required, the same line `brand-rules.ts` draws for what is enforced. A draft
 * rule's findings are warnings, with the review state in the evidence.
 */
import { createHash } from 'node:crypto';
import {
  brandCheckCatalog,
  checkBrandDesign,
  checkDesignHouseRules,
  checkFidelity,
  checkFindingFromBrand,
  checkFindingFromDesign,
  checkFindingFromMounted,
  checkFindingsFromForensic,
  checkFindingsFromHouseRules,
  createTokenSet,
  designBrief,
  designLayerLookup,
  expandDesignAuthoringDocument,
  hasDesignAuthoring,
  imageDimensions,
  resolveBlockTokenBindings,
  readBlockTokenBindings,
  readBlockRunBindings,
  hasDesignColourRefs,
  resolveTokenSelection,
  stripAssetModifiers,
  verifyDesignDocument,
} from '@lolly/engine';
import type { DesignAuthoringNote, DesignBriefCatalogV1, ForensicCoverage } from '@lolly/engine';
import { inspectDesignV1 } from '@lolly-tools/core';
import type {
  CheckDesignSystemV1,
  CheckExitCodeV1,
  CheckFamily,
  CheckFamilyStateV1,
  CheckFidelityEditV1,
  CheckFidelityV1,
  CheckFindingV1,
  CheckInputKindV1,
  CheckInputV1,
  CheckOutcomeV1,
  CheckReportV1,
} from '@lolly-tools/core/check-v1';
import type { ContentInventoryV1 } from '@lolly-tools/core/content-inventory-v1';
import { brandSystemOf } from '../../../engine/src/brand-system.ts';

/** Read a deliberate-edits list (`--edits`, the MCP `edits` argument); every problem is listed. */
export { parseFidelityEdits } from '@lolly/engine';

/** What a fidelity run adds to its family reason: edits recorded, and a comparison cut short. */
function fidelityNote(compared: { complete: boolean; fidelity: CheckFidelityV1 }): string {
  const excepted = compared.fidelity.excepted?.length ?? 0;
  return (
    (excepted ? ` ${excepted === 1 ? '1 string is recorded as a deliberate edit' : `${excepted} strings are recorded as deliberate edits`} (excepted, not passed).` : '') +
    (compared.complete ? '' : ' The comparison stopped at one of its limits, so the family is partial (see fidelity.coverage.partial).')
  );
}

/** The CHECK_EXIT values, restated so this module needs no runtime import from core's contract file. */
const EXIT = { clean: 0, failed: 1, usage: 2, unavailable: 3, refused: 4, review: 5 } as const;
const FAMILIES: readonly CheckFamily[] = ['structure', 'render', 'brand', 'verify', 'fidelity'];

/** Largest input `checkFile` reads, as `inspectForensicBytes` allows. */
export const CHECK_MAX_INPUT_BYTES = 64_000_000;

/** The design system the brand family checks against, as resolved by the caller. */
export interface CheckDesignSystemInputV1 {
  /** The DTCG token document. */
  doc: unknown;
  origin: CheckDesignSystemV1['origin'];
  profile?: string;
  tokensAsset?: string;
}

/** What the page hook answered, or why it could not (from `designChecksViaSession`). */
export type CheckRenderAnswerV1 = { kind: 'answered'; value: unknown } | { kind: 'no-hook'; reason: string };

/**
 * What the render family hands the page (plan 291 W9): the document as a saved session,
 * pictures included, never in an address. A `.lolly` input is its own bytes; a JSON
 * document is packaged first.
 */
export interface CheckRenderSessionV1 {
  bytes: Uint8Array;
  /** The file name the app shows while it opens the file. */
  name: string;
  /** The theme choice per token group the editor opens in, from `theme`. Absent: the session's own. */
  tokenSelection?: Record<string, string>;
  /**
   * The design system the page resolves token links in, when the one checked against is
   * not the content profile's (`--file`, a terminal system), so the canvas the checks read
   * shows the colours the brand family judges. Absent: the page's own profile system.
   */
  designSystem?: unknown;
}

export interface CheckFileOptionsV1 {
  /** The design system for the brand family; null or absent leaves the family unavailable. */
  designSystem?: CheckDesignSystemInputV1 | null;
  /** Catalog facts (asset ids, icon themes, treatments, logos), so catalog ids are known assets. */
  catalog?: DesignBriefCatalogV1 | null;
  /** The token theme the document is composed in. */
  theme?: string;
  /**
   * Check the document in each of these themes (plan 291 W4): names, or `all` for every
   * theme the design system declares. The page is painted and linked colours resolve per
   * theme before the render, brand and Verify families read them, and each of their
   * findings carries `theme`; structure and fidelity run once. With one
   * name this is the same as `theme`.
   */
  themes?: readonly string[] | 'all';
  /** The deck the document recreates: an inventory already read, or the deck's bytes. */
  source?: ContentInventoryV1 | { bytes: Uint8Array; name: string };
  /**
   * Changes to the source's wording made on purpose (`--edits`, the MCP `edits`
   * argument). Their fidelity findings stay, as `info` marked excepted, never passed.
   */
  edits?: readonly CheckFidelityEditV1[];
  /** Decision D1: Verify clues are errors, and any warning refuses. */
  strict?: boolean;
  /** `auto` (default) tries the browser tier; `off` skips it; `require` exits 3 without one. */
  browser?: 'auto' | 'off' | 'require';
  /** Export pages to read, 1 to 100. Default 100. */
  pageCap?: number;
  /** Read the text of picture-only export pages with the cached OCR model. Off by default. */
  ocr?: boolean;
  signal?: AbortSignal;
  /** Runs the page hook over the document as a session. Default: `designChecksViaSession`. */
  renderChecks?: (session: CheckRenderSessionV1) => Promise<CheckRenderAnswerV1>;
  /** The Design tool's manifest. Default: the active profile's. */
  designManifest?: unknown;
  /**
   * Predict clipping from font metrics (the `text-measure` checker, plan 291 W5) when
   * the render family could not paint the document. Default true.
   */
  textMeasure?: boolean;
  /**
   * Who asks: `cli` (default) words the family reasons with `lolly check` flags,
   * `mcp` with the `lolly_check` arguments, so neither tells its caller to use an
   * option it does not have.
   */
  surface?: 'cli' | 'mcp';
  /**
   * A catalog picture's bytes by asset id (modifiers stripped), for the resolution check
   * (`design.image.low-resolution`). Null when the id has no raster file. Default: the file
   * the asset index of `catalog.profile` (else the active content profile) points at.
   */
  pictureBytes?: (id: string) => Uint8Array | null | undefined | Promise<Uint8Array | null | undefined>;
}

/** The sentences a family reason uses that depend on the surface asking. */
const SURFACE_WORDS = {
  cli: {
    noSource: 'No source given (--source=<deck or inventory>).',
    noDesignSystem: 'No design system resolved: no --file, no active terminal system and no content profile with a tokens asset.',
    unreadText: 'Rerun with --ocr to read the text in them.',
  },
  mcp: {
    noSource: 'No source given (pass source, a deck, or inventory, what lolly_read returned).',
    noDesignSystem: "No design system resolved: this server's content profile has no tokens asset.",
    unreadText: 'No text recognition runs on an MCP server; run lolly check with --ocr on the CLI to read the text in them.',
  },
} as const;

export type CheckInputErrorCode = 'input.unsupported' | 'input.unreadable' | 'input.too-large' | 'source.unreadable';

/** An input the check cannot read, with a stable code a caller branches on. */
export class CheckInputError extends Error {
  readonly code: CheckInputErrorCode;
  constructor(code: CheckInputErrorCode, message: string) {
    super(message);
    this.name = 'CheckInputError';
    this.code = code;
  }
}

type Row = Record<string, unknown>;
const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const finite = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** Which input this is, by its name. */
export function checkInputKind(name: string): CheckInputKindV1 | null {
  const ext = name.toLowerCase().split('.').at(-1) ?? '';
  if (ext === 'lolly') return 'lolly';
  if (ext === 'json') return 'design';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'pptx') return 'pptx';
  if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) return 'image';
  return null;
}

interface DesignInput {
  boxes: unknown;
  textDocument?: unknown;
  /** Every input value the document carries, for the session the render family packages. */
  values: Record<string, unknown>;
  /** Uploaded media the file carries, by `user/media/<sha>` id. */
  media: Map<string, Uint8Array>;
  /** A `.lolly` input's own bytes, which the render family hands the page as they are. Dropped once authoring keys are lowered. */
  lolly?: Uint8Array;
  /** The theme choices the session was saved in (`__tokenSelection`), when it carries any. */
  tokenSelection?: Record<string, string>;
}

/** A session's saved `__tokenSelection`, when it is a plain map of strings. */
function savedTokenSelection(value: unknown): Record<string, string> | undefined {
  if (!record(value)) return undefined;
  const entries = Object.entries(value);
  if (!entries.length || entries.length > 64 || !entries.every(([, v]) => typeof v === 'string')) return undefined;
  return Object.fromEntries(entries) as Record<string, string>;
}

/**
 * The theme name a saved selection stands for in the design system checked against,
 * when it is not the default (plan 291 W4): a document saved in dark is checked in dark
 * unless a theme is asked for. Undefined when the selection is the default or no one
 * declared theme gives the same choices.
 */
function savedTheme(ds: CheckDesignSystemInputV1 | null, selection: Record<string, string> | undefined): string | undefined {
  if (!ds || !selection) return undefined;
  try {
    const key = (choices: Record<string, string>) => JSON.stringify(Object.entries(choices).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    const wanted = key(resolveTokenSelection(ds.doc, { selection }).choices);
    if (wanted === key(resolveTokenSelection(ds.doc, {}).choices)) return undefined;
    return themeNamesOf(ds.doc).find((name) => key(resolveTokenSelection(ds.doc, { theme: name }).choices) === wanted);
  } catch {
    return undefined;
  }
}

/** A Design document in any of the shapes `system check` accepts: a boxes array, `{boxes}`, `{values:{boxes}}`, a saved session. */
function designFromJson(bytes: Uint8Array): DesignInput {
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new CheckInputError('input.unreadable', 'This JSON could not be parsed.');
  }
  if (Array.isArray(raw)) return { boxes: raw, values: { boxes: raw }, media: new Map() };
  const top = record(raw) ? raw : {};
  const values = record(top.values) ? top.values : top;
  if (!Array.isArray(values.boxes))
    throw new CheckInputError('input.unsupported', 'Supply a Design document: a boxes array, an object with boxes, or Design input values.');
  // The authoring inputs may sit beside `values` as well as inside it (design-authoring-v1).
  for (const key of ['$styles', '$theme']) if (values[key] === undefined && top[key] !== undefined) values[key] = top[key];
  const tokenSelection = savedTokenSelection(values.__tokenSelection ?? top.__tokenSelection);
  return {
    boxes: values.boxes,
    ...(values.textDocument !== undefined ? { textDocument: values.textDocument } : {}),
    values: Object.fromEntries(Object.entries(values).filter(([k]) => !k.startsWith('__'))),
    media: new Map(),
    ...(tokenSelection ? { tokenSelection } : {}),
  };
}

async function designFromLolly(bytes: Uint8Array): Promise<DesignInput> {
  const { readLollyFile } = await import('./lolly-file.ts');
  let contents: ReturnType<typeof readLollyFile>;
  try {
    contents = readLollyFile(bytes);
  } catch (err) {
    throw new CheckInputError('input.unreadable', err instanceof Error ? err.message : String(err));
  }
  const tool = contents.manifest.tool?.id;
  if (tool && tool !== 'design')
    throw new CheckInputError('input.unsupported', `This .lolly holds a ${tool} session; lolly check reads Design documents and exports.`);
  const session = contents.session;
  if (!Array.isArray(session.boxes)) throw new CheckInputError('input.unsupported', 'This .lolly carries no Design boxes.');
  const tokenSelection = savedTokenSelection(session.__tokenSelection);
  const media = new Map<string, Uint8Array>();
  // `lolly package` and pack_lolly name an upload by its sha256 (`user/media/<sha>`).
  for (const [path, part] of contents.files) {
    const m = /^assets\/uploads\/([0-9a-f]{64})\.[a-z0-9]+$/.exec(path);
    if (m) media.set(`user/media/${m[1]}`, part);
  }
  // The web shell's pack (lolly-pack.ts) writes an upload at a label path and links it
  // to its `user/upload/...` id only through the manifest row's `path`.
  for (const entry of Array.isArray(contents.manifest.assets) ? contents.manifest.assets : []) {
    if (entry?.kind !== 'asset' || typeof entry.id !== 'string' || typeof entry.path !== 'string') continue;
    const id = stripAssetModifiers(entry.id);
    const part = contents.files.get(entry.path);
    if (id.startsWith('user/') && part && !media.has(id)) media.set(id, part);
  }
  return {
    boxes: session.boxes,
    ...(session.textDocument !== undefined ? { textDocument: session.textDocument } : {}),
    values: Object.fromEntries(Object.entries(session).filter(([k]) => !k.startsWith('__'))),
    media,
    lolly: bytes,
    ...(tokenSelection ? { tokenSelection } : {}),
  };
}

type LoweredDesign = { doc: DesignInput; notes: DesignAuthoringNote[]; rows: number | null } | { invalid: { path: string; message: string } };

/**
 * The document with its authoring keys (design-authoring-v1: `$in`, `$style`, `$points`,
 * `$stack` and the rest) lowered to stored rows, the same lowering `lolly package` and
 * the MCP tools run, with text styles taken from the design system the brand family
 * checks against. A document with no authoring key is returned as it is. A key that
 * cannot be lowered is returned as its JSON pointer and message.
 */
function lowerDesignAuthoring(doc: DesignInput, ds: CheckDesignSystemInputV1 | null, opts: CheckFileOptionsV1): LoweredDesign {
  if (!hasDesignAuthoring(doc.values)) return { doc, notes: [], rows: null };
  let brief: unknown = null;
  if (ds) {
    try {
      brief = designBrief(ds.doc, opts.catalog ?? null);
    } catch {
      brief = null;
    }
  }
  try {
    // The brand's tokens lower colour references (plan 291 W4); the first theme checked caches the literals.
    const firstTheme = opts.theme ?? (Array.isArray(opts.themes) ? opts.themes[0] : undefined);
    let tokens: ReturnType<typeof createTokenSet> | null = null;
    if (ds) {
      try {
        tokens = createTokenSet(ds.doc, firstTheme ? { theme: firstTheme } : {});
      } catch {
        tokens = null;
      }
    }
    const lowered = expandDesignAuthoringDocument({ values: doc.values }, {
      brief,
      ...(opts.theme ? { theme: opts.theme } : firstTheme ? { theme: firstTheme } : {}),
      ...(tokens ? { tokens } : {}),
      ...(opts.themes !== undefined ? { themes: opts.themes } : {}),
    });
    const values = lowered.values;
    // The file's own bytes hold the unlowered rows, so the page gets the lowered ones.
    const { lolly: _unlowered, ...rest } = doc;
    return {
      doc: { ...rest, boxes: lowered.rows, values, ...(values.textDocument !== undefined ? { textDocument: values.textDocument } : {}) },
      notes: lowered.notes,
      rows: lowered.rows.length,
    };
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    const m = /^(\/[^:]*): ([\s\S]*)$/.exec(text);
    // The input's own shape is `{values: ...}` only for a saved session; a pointer points at the rows the caller wrote.
    const path = m ? m[1]!.replace(/^\/values(?=\/|$)/, '') || '/' : '/';
    return { invalid: { path, message: m ? m[2]! : text } };
  }
}

/** The structure finding for authoring that could not be lowered, naming the row when the pointer reaches one. */
function authoringInvalid(invalid: { path: string; message: string }, boxes: unknown): CheckFindingV1 {
  const index = /^\/boxes\/(\d+)(?:\/|$)/.exec(invalid.path);
  const row = index && Array.isArray(boxes) ? boxes[Number(index[1])] : undefined;
  const layerId = record(row) && typeof row.id === 'string' && row.id ? row.id : undefined;
  return {
    code: 'design.authoring.invalid',
    family: 'structure',
    severity: 'error',
    // The pointer goes in the message too: the text report prints no path.
    message: `The authoring keys could not be lowered to layers: ${invalid.path}: ${invalid.message}`,
    path: invalid.path,
    ...(layerId ? { layerId } : {}),
    suggestion: 'Fix the key at this path; the design-authoring-v1 schema lists every authoring key and macro field.',
    origin: { checker: 'design-authoring', id: 'authoring.invalid' },
  };
}

/** An authoring note (a colour chosen by contrast, a theme with no brief) as an info finding. */
function authoringNoteFinding(note: DesignAuthoringNote): CheckFindingV1 {
  return {
    code: `design.${note.code}`,
    family: 'structure',
    severity: 'info',
    message: note.message,
    path: note.path.replace(/^\/values(?=\/|$)/, '') || '/',
    origin: { checker: 'design-authoring', id: note.code },
  };
}

/** Every asset id a visible row points at (image, video, poster and the like). */
function assetIdsOf(boxes: unknown): string[] {
  const out: string[] = [];
  if (!Array.isArray(boxes)) return out;
  for (const row of boxes) {
    if (!record(row) || row.hidden === true || row.hidden === 'true') continue;
    for (const value of Object.values(row)) {
      const id = typeof value === 'string' ? value : record(value) && typeof value.id === 'string' ? value.id : '';
      if (id.startsWith('user/') || id.startsWith('data:')) out.push(id.startsWith('data:') ? 'data:' : id);
    }
  }
  return out;
}

const zero = (): Omit<CheckFamilyStateV1, 'state'> => ({ error: 0, warn: 0, info: 0 });
const familyState = (state: CheckFamilyStateV1['state'], reason?: string): CheckFamilyStateV1 => ({
  state,
  ...(reason ? { reason } : {}),
  ...zero(),
});

/** One sentence from the forensic coverage that did not complete, so a partial read is said out loud. */
function coverageNote(coverage: readonly ForensicCoverage[]): string {
  const open = coverage.filter((c) => c.state !== 'completed');
  if (!open.length) return '';
  const seen = new Map<string, { reason: string; pages: number }>();
  for (const c of open) {
    const key = `${c.collector}:${c.state}`;
    const entry = seen.get(key);
    if (entry) entry.pages += 1;
    else seen.set(key, { reason: `${c.collector} ${c.state}: ${c.reason}`, pages: 1 });
  }
  return [...seen.values()]
    .slice(0, 4)
    .map((e) => (e.pages > 1 ? `${e.reason} (${plural(e.pages, 'page')})` : e.reason))
    .join(' ');
}

/** A house rule finding is an error only for a rule the brand approved and marked required. */
function enforceHouseRules(findings: CheckFindingV1[], doc: unknown): CheckFindingV1[] {
  const rules = new Map((brandSystemOf(doc)?.rules ?? []).map((r) => [r.id, r]));
  return findings.map((f) => {
    if (f.origin.checker !== 'house-rules' || f.severity !== 'error') return f;
    const rule = rules.get(f.origin.id);
    if (rule?.review.state === 'approved') return f;
    return { ...f, severity: 'warn', evidence: { ...f.evidence, review: rule?.review.state ?? 'unknown' } };
  });
}

/** The design system's `{token}` colours, for Verify's card and strip paint. */
function colourResolver(doc: unknown, theme?: string): ((value: string) => string | null) | undefined {
  if (!doc) return undefined;
  let set: ReturnType<typeof createTokenSet>;
  try {
    set = createTokenSet(doc, theme ? { theme } : {});
  } catch {
    return undefined;
  }
  return (value) => {
    if (!value.startsWith('{')) return null;
    const resolved = set.resolve(value);
    return typeof resolved === 'string' ? resolved : null;
  };
}

/**
 * The inventory inside what a caller saved or was handed: the inventory itself, the
 * `lolly read --json` envelope (`{command: 'read', result}`), or the structured
 * result `lolly_read` returns (`{inventory, inventoryDelivery}`).
 */
export function unwrapContentInventory(raw: unknown): unknown {
  if (!record(raw) || raw.version === 'lolly/content-inventory-v1') return raw;
  if (raw.command === 'read' && record(raw.result)) return raw.result;
  if (record(raw.inventory) && (raw.inventoryDelivery !== undefined || raw.counts !== undefined)) return raw.inventory;
  return raw;
}

/**
 * What is wrong with a value offered as a content inventory, as JSON pointers with a
 * reason: every field the fidelity comparison reads, held to the shape
 * schemas/content-inventory-v1.schema.json gives each field. Empty when the value can be compared.
 */
export function contentInventoryProblems(value: unknown): string[] {
  const out: string[] = [];
  const need = (ok: boolean, path: string, what: string): boolean => {
    if (!ok) out.push(`${path} ${what}`);
    return ok;
  };
  const isStr = (v: unknown): v is string => typeof v === 'string';
  if (!need(record(value), '/', 'must be an object')) return out;
  const inv = value as Row;
  need(inv.version === 'lolly/content-inventory-v1', '/version', 'must be "lolly/content-inventory-v1"');
  if (need(record(inv.source), '/source', 'must be an object')) {
    const src = inv.source as Row;
    need(isStr(src.name), '/source/name', 'must be a string');
    for (const key of ['width', 'height', 'slides'] as const) need(typeof src[key] === 'number', `/source/${key}`, 'must be a number');
  }
  for (const key of ['media', 'warnings'] as const) need(Array.isArray(inv[key]), `/${key}`, 'must be an array');
  if (need(Array.isArray(inv.slides), '/slides', 'must be an array'))
    (inv.slides as unknown[]).forEach((item, i) => {
      const at = `/slides/${i}`;
      if (!need(record(item), at, 'must be an object')) return;
      const slide = item as Row;
      need(Number.isInteger(slide.number), `${at}/number`, 'must be an integer');
      if (need(Array.isArray(slide.text), `${at}/text`, 'must be an array'))
        (slide.text as unknown[]).forEach((entry, j) => {
          const t = `${at}/text/${j}`;
          if (!need(record(entry), t, 'must be an object')) return;
          const frame = entry as Row;
          for (const key of ['objectId', 'role', 'class', 'plain'] as const) need(isStr(frame[key]), `${t}/${key}`, 'must be a string');
          if (frame.readingIndex !== undefined) need(Number.isInteger(frame.readingIndex), `${t}/readingIndex`, 'must be an integer');
          const box = frame.box;
          if (need(record(box), `${t}/box`, 'must be an object'))
            for (const key of ['x', 'y', 'width', 'height'] as const) need(typeof (box as Row)[key] === 'number', `${t}/box/${key}`, 'must be a number');
        });
      if (need(Array.isArray(slide.tables), `${at}/tables`, 'must be an array'))
        (slide.tables as unknown[]).forEach((table, j) => {
          need(
            record(table) && isStr(table.objectId) && Array.isArray(table.rows) && table.rows.every((r) => Array.isArray(r) && r.every(isStr)),
            `${at}/tables/${j}`,
            'must have an objectId and rows of strings'
          );
        });
      const notes = slide.notes;
      if (notes !== null && need(record(notes), `${at}/notes`, 'must be null or an object')) {
        const n = notes as Row;
        need(isStr(n.text), `${at}/notes/text`, 'must be a string');
        need(
          Array.isArray(n.paragraphs) && n.paragraphs.every((p) => record(p) && Array.isArray(p.lines) && p.lines.every(isStr)),
          `${at}/notes/paragraphs`,
          'must be paragraphs of string lines'
        );
      }
      for (const key of ['pictures', 'charts', 'objects'] as const) need(Array.isArray(slide[key]), `${at}/${key}`, 'must be an array');
    });
  return out;
}

/** A source inventory from what the caller gave. */
async function sourceInventory(source: NonNullable<CheckFileOptionsV1['source']>, signal?: AbortSignal): Promise<ContentInventoryV1> {
  if (!('bytes' in source)) {
    const inventory = unwrapContentInventory(source);
    const problems = contentInventoryProblems(inventory);
    if (problems.length) throw new CheckInputError('source.unreadable', `The source is not a content inventory: ${problems.slice(0, 3).join('; ')}.`);
    return inventory as ContentInventoryV1;
  }
  if (/\.json$/i.test(source.name)) {
    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder().decode(source.bytes));
    } catch {
      throw new CheckInputError('source.unreadable', `${source.name} could not be parsed as JSON.`);
    }
    const inventory = unwrapContentInventory(raw);
    const problems = contentInventoryProblems(inventory);
    if (problems.length)
      throw new CheckInputError(
        'source.unreadable',
        `${source.name} is not a content inventory, nor the output of lolly read --json: ${problems.slice(0, 3).join('; ')}.`
      );
    return inventory as ContentInventoryV1;
  }
  const { readContentInventory } = await import('./content-inventory.ts');
  try {
    return (await readContentInventory({ bytes: source.bytes, name: source.name, ...(signal ? { signal } : {}) })).inventory;
  } catch (err) {
    throw new CheckInputError('source.unreadable', `The source ${source.name} could not be read: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * An export's own inventory as Design rows, so fidelity compares a PDF or PPTX with
 * its source the way it compares a document: one artboard per page, one text row per
 * text frame, the page's notes on the artboard.
 */
export function inventoryAsBoxes(inventory: ContentInventoryV1): Row[] {
  const rows: Row[] = [];
  const w = inventory.source.width || 1920;
  const h = inventory.source.height || 1080;
  for (const slide of inventory.slides) {
    const frame = `page-${slide.number}`;
    const x0 = (slide.number - 1) * (w + 100);
    rows.push({
      id: frame, kind: 'frame', name: `Page ${slide.number}`, x: x0, y: 0, w, h, order: slide.number - 1,
      // The authoring form: a blank line between paragraphs, a no-break space for an empty line inside one.
      ...(slide.notes ? { notes: slide.notes.paragraphs.map((p) => p.lines.map((l, k) => (l.trim() === '' && k > 0 && k < p.lines.length - 1 ? ' ' : l)).join('\n')).join('\n\n') } : {}),
    });
    for (const text of slide.text)
      rows.push({
        id: `${frame}-${text.objectId}`, kind: 'text', frame, plainText: true, text: text.plain,
        x: x0 + text.box.x * w, y: text.box.y * h, w: text.box.width * w, h: text.box.height * h,
        // The reader's order: a PDF reads one row per line, and its columns interleave by height.
        ...(text.readingIndex !== undefined ? { readingIndex: text.readingIndex } : {}),
      });
    for (const table of slide.tables)
      rows.push({ id: `${frame}-${table.objectId}`, kind: 'text', frame, plainText: true, text: table.rows.map((r) => r.join(' ')).join('\n'), x: x0, y: h, w, h: 1 });
  }
  return rows;
}

interface RenderOutcome {
  state: CheckFamilyStateV1;
  findings: CheckFindingV1[];
  /**
   * True when the family is unavailable because there is no browser tier to run it
   * (no browser, no web shell, no page hook): the one case `browser: 'require'`
   * turns into exit 3. A document that could not be packaged for the page is not this.
   */
  tierMissing?: boolean;
}

const tierMissing = (reason: string): RenderOutcome => ({ state: familyState('unavailable', reason), findings: [], tierMissing: true });

/**
 * The render family in every theme checked (plan 291 M4): with one theme (or none) the
 * page is opened once, as before; with several, once per theme in that theme, each
 * finding tagged with the theme it was painted in. The first run whose page could not
 * run stands for the family, since the others would not run either.
 */
async function renderFamilyInThemes(
  themes: ReadonlyArray<string | undefined>,
  opts: CheckFileOptionsV1,
  run: (opts: CheckFileOptionsV1) => Promise<RenderOutcome | { failed: string }>,
): Promise<RenderOutcome | { failed: string }> {
  if (themes.length < 2) return run(opts);
  const findings: CheckFindingV1[] = [];
  const reasons: string[] = [];
  for (const theme of themes) {
    const outcome = await run({ ...opts, theme });
    if (isFailed(outcome)) return { failed: `In the ${theme} theme: ${outcome.failed}` };
    if (outcome.state.state !== 'ran') return outcome;
    findings.push(...inThemeFindings(outcome.findings, theme));
    reasons.push(`In the ${theme} theme: ${outcome.state.reason ?? ''}`.trim());
  }
  return { state: familyState('ran', reasons.join(' ')), findings };
}

/**
 * The document as the session the render family hands the page (plan 291 W9): a plain
 * `.lolly` input as it is, anything else packaged with every picture it carries (its
 * uploads by id, its `data:` pictures as uploads).
 */
async function renderSession(input: DesignInput, name: string): Promise<{ bytes: Uint8Array; name: string }> {
  const stem = name.replace(/\.[^.]+$/, '') || 'document';
  if (input.lolly) {
    const { openRouteRefusal } = await import('./open-session.ts');
    if (openRouteRefusal(input.lolly) === null) return { bytes: input.lolly, name: `${stem}.lolly` };
  }
  const { packageDesignSession } = await import('./open-session.ts');
  const assets = [...input.media].map(([key, bytes]) => ({ key, bytes, name: key }));
  const packed = await packageDesignSession(input.values, { label: stem, assets });
  return { bytes: packed.bytes, name: `${stem}.lolly` };
}

/** The `_themes` choice that opens the editor in `theme`, from the design system checked against. */
function themeSelection(ds: CheckDesignSystemInputV1 | null, theme: string | undefined): Record<string, string> | undefined {
  if (!theme || !ds) return undefined;
  const choices = resolveTokenSelection(ds.doc, { theme }).choices;
  return Object.keys(choices).length ? choices : undefined;
}

async function renderFamily(input: DesignInput, opts: CheckFileOptionsV1, lookup: LayerLookup, layers: number, name: string, ds: CheckDesignSystemInputV1 | null): Promise<RenderOutcome> {
  const mode = opts.browser ?? 'auto';
  if (mode === 'off') return { state: familyState('skipped', 'The browser tier was turned off for this run.'), findings: [] };
  const assets = assetIdsOf(input.boxes);
  let session: CheckRenderSessionV1;
  try {
    session = { ...(await renderSession(input, name)) };
    const tokenSelection = themeSelection(ds, opts.theme);
    if (tokenSelection) session.tokenSelection = tokenSelection;
    if (ds && ds.origin !== 'profile' && ds.doc && typeof ds.doc === 'object') session.designSystem = ds.doc;
  } catch (err) {
    return { state: familyState('unavailable', `The document could not be packaged for the web shell: ${err instanceof Error ? err.message : String(err)}`), findings: [] };
  }
  let answer: CheckRenderAnswerV1;
  try {
    const run = opts.renderChecks ?? (async (s: CheckRenderSessionV1) => (await import('./webshell-render.ts')).designChecksViaSession(s.bytes, {
      name: s.name, ...(s.tokenSelection ? { tokenSelection: s.tokenSelection } : {}),
      ...(s.designSystem !== undefined ? { designSystem: s.designSystem } : {}),
    }));
    answer = await run(session);
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    return tierMissing(`The browser tier could not run: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (answer.kind === 'no-hook') return tierMissing(answer.reason);
  const value = answer.value;
  if (!record(value) || value.format !== 'lolly-design-check-page' || value.version !== 1 || !record(value.mounted) || !Array.isArray(value.mounted.findings))
    return tierMissing('The web shell did not open this document in the Design editor.');
  const mounted = value.mounted as { findings: unknown[]; checked?: Record<string, unknown>; manualContrastReview?: unknown };
  // The session carries every picture the input holds; an upload the input only names
  // paints empty, and text over it is a visual check.
  const missing = uncarriedPictures(input.boxes, lookup, new Set(input.media.keys()));
  const findings = mounted.findings
    .filter(record)
    .map((f) => checkFindingFromMounted(overMissingPicture(f as unknown as MountedFindingInput, missing, lookup), lookup));
  const checked = record(mounted.checked) ? mounted.checked : {};
  const notes = [
    `Checked ${plural(Number(checked.overflow) || 0, 'text layer')} for clipping, ${Number(checked.contrast) || 0} for contrast and ${Number(checked.fonts) || 0} for font coverage.`,
  ];
  if (session.tokenSelection && opts.theme) notes.push(`The editor was opened in the ${opts.theme} theme.`);
  if (session.designSystem !== undefined) notes.push(`The page resolved linked colours in the ${ds?.origin === 'file' ? '--file' : 'terminal'} design system this check uses.`);
  if (value.settled === false) notes.push('The canvas had not settled when the checks ran, so layers still painting may be missing.');
  if (typeof value.layers === 'number' && value.layers !== layers)
    notes.push(`The web shell saw ${plural(value.layers, 'layer')} where this document has ${layers}.`);
  // A photo look rides on the id (`user/media/<sha256>?treatment=<look>`); the bytes are the base id's.
  const uploads = new Set(assets.filter((id) => id.startsWith('user/')).map((id) => stripAssetModifiers(id)));
  const dangling = [...uploads].filter((id) => !input.media.has(id)).length;
  if (dangling)
    notes.push(`${plural(dangling, 'uploaded picture')} named by this document ${dangling === 1 ? 'is' : 'are'} not in the input and painted empty; text over a missing picture is listed for a visual check.`);
  return { state: familyState('ran', notes.join(' ')), findings };
}

/**
 * Text units the `text-measure` checker measures in one check, summed over the layers
 * (four times the longest single text), so a check with no browser tier, as on a hosted
 * server, stays inside the function's time. Layers past it are not measured, and the
 * family's note says how many.
 */
export const TEXT_MEASURE_CHECK_MAX_UNITS = 262144;

/**
 * The `text-measure` checker (plan 291 W5): every plain text layer laid out from its
 * faces' metrics (`measureDesignRowsReport`), the mounted audit's rule applied to the
 * predicted `scrollHeight`. A layer that shrinks its text to fit is not judged, since
 * the canvas draws it smaller, and neither is one holding characters its face has no
 * glyph for (`uncovered`), since the canvas draws those in a fallback font.
 */
async function textMeasureFamily(
  input: DesignInput,
  ds: CheckDesignSystemInputV1 | null,
  opts: CheckFileOptionsV1,
  lookup: LayerLookup,
): Promise<{ findings: CheckFindingV1[]; note: string }> {
  if (!Array.isArray(input.boxes)) return { findings: [], note: '' };
  const { measureDesignRowsReport, measureFontsFromTokens } = await import('./text-measure.ts');
  // The rows unfiltered: each index, and the /boxes pointer built from it, is the row's place in boxes.
  const rows: readonly unknown[] = input.boxes;
  const fonts = ds ? measureFontsFromTokens(ds.doc, opts.theme) : undefined;
  const report = await measureDesignRowsReport(rows, {
    ...(fonts ? { fonts } : {}),
    ...(opts.signal ? { signal: opts.signal } : {}),
    maxUnits: TEXT_MEASURE_CHECK_MAX_UNITS,
  });
  const findings: CheckFindingV1[] = [];
  let judged = 0;
  let fallback = 0;
  for (const { layerId, index, measure } of report.measured) {
    const row = rows[index] as Record<string, unknown>;
    const text = String(row.text ?? '');
    if (!text.trim() || measure.notes.some((n) => n.includes('fitText'))) continue;
    if (measure.uncovered?.length) {
      fallback++;
      continue;
    }
    judged++;
    if (!measure.overflow?.clipped) continue;
    const name = (typeof row.name === 'string' && row.name) || text.trim().slice(0, 32) || layerId;
    const base = checkFindingFromMounted({
      id: 'design.text.overflow',
      severity: 'warn',
      path: `/boxes/${index}/text`,
      evidence: { name },
      message: '',
      layerId,
    }, lookup);
    findings.push({
      ...base,
      evidence: {
        ...base.evidence,
        scrollHeight: measure.scrollHeight,
        clientHeight: measure.box?.clientHeight ?? null,
        lines: measure.lineCount,
        nearEdge: measure.nearEdge,
      },
      origin: { checker: 'text-measure', id: 'design.text.overflow', method: 'harfbuzz-css-greedy' },
    });
  }
  const unmeasured = report.skipped.filter((s) => !/hidden/.test(s.reason));
  const why = unmeasured.find((s) => /font file/.test(s.reason))?.reason ?? unmeasured[0]?.reason ?? '';
  const note = `Clipping was predicted from font metrics instead (text-measure): ${plural(judged, 'plain text layer')} measured, ${findings.length} clipped`
    + `${fallback ? `, ${plural(fallback, 'layer')} not judged (its face has no glyph for some characters, which the canvas draws in a fallback font)` : ''}`
    + `${unmeasured.length ? `, ${plural(unmeasured.length, 'layer')} not measured (${why.replace(/[.;]\s.*$|\.$/, '')})` : ''}; contrast and font coverage need the browser tier.`;
  return { findings, note };
}

/** How many times larger than its pixel size a raster may be drawn before it reads as soft. */
export const IMAGE_MAX_UPSCALE = 2;
/** Distinct pictures one check reads for their pixel size. */
const IMAGE_RESOLUTION_MAX_PICTURES = 500;
const RASTER_FORMATS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

/** A raster's pixel size from its header (PNG, JPEG, GIF, WebP); null for an SVG or anything else. */
function rasterSize(bytes: Uint8Array): { w: number; h: number } | null {
  const b = bytes;
  const raster =
    (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) ||
    (b[0] === 0xff && b[1] === 0xd8) ||
    (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) ||
    (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50);
  if (!raster) return null;
  const size = imageDimensions(b);
  return size && size.w > 0 && size.h > 0 ? size : null;
}

/** The default catalog reader: the raster file an asset's index entry points at, in the profile's content roots. */
async function catalogPictureReader(profile: string | undefined): Promise<(id: string) => Uint8Array | null> {
  const { contentRoots, contentUrlFile, readAssetIndex } = await import('./content-roots.ts');
  const { readFileSync, statSync } = await import('node:fs');
  let roots: ReturnType<typeof contentRoots>;
  let byId: Map<string, Row>;
  try {
    roots = contentRoots(profile ? { profile } : {});
    byId = new Map(readAssetIndex(roots).assets.filter(record).map((a) => [String(a.id), a as Row]));
  } catch {
    return () => null;
  }
  return (id) => {
    const formats = byId.get(id)?.formats;
    const file = Array.isArray(formats)
      ? formats.find((f): f is Row => record(f) && typeof f.url === 'string' && RASTER_FORMATS.has(String(f.format).toLowerCase()))
      : undefined;
    const path = file ? contentUrlFile(String(file.url), roots) : null;
    if (!path) return null;
    try {
      return statSync(path).size <= CHECK_MAX_INPUT_BYTES ? new Uint8Array(readFileSync(path)) : null;
    } catch {
      return null;
    }
  };
}

/**
 * The `image-resolution` checker (plan 291 M3b): each visible picture layer whose picture
 * is an upload the file carries or a catalog raster, its pixel size read from the bytes,
 * judged against the size the layer draws it at on the artboard. `contain` draws it at the
 * smaller of the two box-to-pixel ratios, `cover` and `fill` at the larger, `none` at 1
 * and `scale-down` at the contain ratio capped at 1, each times the framing zoom. Drawn at more than `IMAGE_MAX_UPSCALE` times its size, it is a warning. An
 * SVG has no pixel size and is never judged; an upload the input only names, a placeholder
 * key and a URL have no bytes here and are left out.
 */
async function imageResolutionFindings(
  input: DesignInput,
  opts: CheckFileOptionsV1,
  lookup: LayerLookup,
): Promise<{ findings: CheckFindingV1[]; measured: number; unread: number }> {
  if (!Array.isArray(input.boxes)) return { findings: [], measured: 0, unread: 0 };
  let reader: ((id: string) => Uint8Array | null | undefined | Promise<Uint8Array | null | undefined>) | undefined = opts.pictureBytes;
  const sizes = new Map<string, { w: number; h: number } | null>();
  // Refs with no bytes to read at all (an upload the input carries no bytes for, a catalog
  // id the profile does not hold), as against an SVG or a file that is not a raster.
  const noBytes = new Set<string>();
  const sizeOf = async (ref: string): Promise<{ w: number; h: number } | null> => {
    if (sizes.has(ref)) return sizes.get(ref)!;
    if (sizes.size >= IMAGE_RESOLUTION_MAX_PICTURES) return null;
    let bytes: Uint8Array | null | undefined;
    if (ref.startsWith('user/')) bytes = input.media.get(ref);
    else {
      reader ??= await catalogPictureReader(opts.catalog?.profile);
      bytes = await reader(ref);
    }
    const size = bytes ? rasterSize(bytes) : null;
    if (!bytes) noBytes.add(ref);
    sizes.set(ref, size);
    return size;
  };
  const findings: CheckFindingV1[] = [];
  let measured = 0;
  let unread = 0;
  for (const [index, row] of input.boxes.entries()) {
    if (!record(row) || typeof row.id !== 'string' || row.hidden === true || row.hidden === 'true') continue;
    const raw = typeof row.image === 'string' ? row.image : record(row.image) && typeof row.image.id === 'string' ? row.image.id : '';
    // A data: or http(s) URL, a blob, a `photo:cover` placeholder and a `{token}` have no bytes to read here.
    if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('{') || raw.startsWith('/')) continue;
    // A treatment or other `?` modifier points at the same bytes, on an upload as on a catalog id.
    const ref = stripAssetModifiers(raw);
    const w = finite(row.w);
    const h = finite(row.h);
    if (w <= 0 || h <= 0) continue;
    const size = await sizeOf(ref);
    if (!size) {
      if (noBytes.has(ref)) unread += 1;
      continue;
    }
    measured += 1;
    // The renderer's object-fit set (design-renderer.js FITS); anything else draws as contain.
    const fit = row.fit === 'cover' || row.fit === 'fill' || row.fit === 'none' || row.fit === 'scale-down' ? row.fit : 'contain';
    const sx = w / size.w;
    const sy = h / size.h;
    const framing = record(row.imageFraming) ? row.imageFraming : null;
    const zoom = framing ? Math.max(1, finite(framing.zoom, 100)) / 100 : 1;
    // `none` draws the picture at its own size, and `scale-down` never draws the picture larger.
    const fitted = fit === 'none' ? 1 : fit === 'scale-down' ? Math.min(1, sx, sy) : fit === 'contain' ? Math.min(sx, sy) : Math.max(sx, sy);
    const scale = fitted * zoom;
    if (!(scale > IMAGE_MAX_UPSCALE + 1e-9)) continue;
    const shown = Math.round(scale * 100) / 100;
    const name = (typeof row.name === 'string' && row.name) || row.id;
    const place = lookup.get(row.id);
    findings.push({
      code: 'design.image.low-resolution',
      family: 'structure',
      severity: 'warn',
      message: `“${name}” draws a ${size.w} x ${size.h} px picture at ${shown} times its size, so it will look soft.`,
      needs: 'review',
      path: `/boxes/${index}/image`,
      layerId: row.id,
      ...(place?.artboardId ? { artboardId: place.artboardId } : {}),
      ...(place ? { box: place.box } : {}),
      evidence: {
        name,
        pixelWidth: size.w,
        pixelHeight: size.h,
        drawnWidth: Math.round(size.w * scale),
        drawnHeight: Math.round(size.h * scale),
        scale: shown,
        fit,
        source: ref.startsWith('user/') ? 'upload' : 'catalog',
      },
      suggestion: `Use a picture at least ${Math.ceil((size.w * scale) / IMAGE_MAX_UPSCALE)} px wide, or draw this one smaller.`,
      origin: { checker: 'image-resolution', id: 'design.image.low-resolution', method: 'decoded-header' },
    });
  }
  return { findings, measured, unread };
}

type MountedFindingInput = Parameters<typeof checkFindingFromMounted>[0];
type LayerLookup = ReturnType<typeof designLayerLookup>;

/**
 * Picture layers showing an uploaded picture the input does not carry (`carried` lists
 * the ones it does). The page paints those empty.
 */
function uncarriedPictures(boxes: unknown, lookup: LayerLookup, carried: ReadonlySet<string> = new Set()): Array<{ index: number; artboardId?: string; box: { x: number; y: number; width: number; height: number } }> {
  if (!Array.isArray(boxes)) return [];
  const out: Array<{ index: number; artboardId?: string; box: { x: number; y: number; width: number; height: number } }> = [];
  for (const row of boxes) {
    if (!record(row) || typeof row.id !== 'string' || row.hidden === true || row.hidden === 'true') continue;
    const ref = typeof row.image === 'string' ? row.image : record(row.image) && typeof row.image.id === 'string' ? row.image.id : '';
    if (!ref.startsWith('user/') || carried.has(stripAssetModifiers(ref))) continue;
    const place = lookup.get(row.id);
    if (place) out.push(place);
  }
  return out;
}

/**
 * The mounted audit reads a ratio for text over a picture only when the picture is
 * not there: with it painted, the audit asks for a visual check, and the render family
 * then measures the pixels under the text (contrast-sample.ts). A picture the input
 * names but does not carry paints empty in the browser tier, so a low ratio over one,
 * read or measured, is reported as a visual check.
 */
function overMissingPicture(finding: MountedFindingInput, missing: ReturnType<typeof uncarriedPictures>, lookup: LayerLookup): MountedFindingInput {
  if (finding.id !== 'design.text.contrast-low' || !missing.length) return finding;
  const text = lookup.get(finding.layerId);
  if (!text) return finding;
  const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const under = missing.some((p) => p.index < text.index && p.artboardId === text.artboardId && overlaps(p.box, text.box));
  if (!under) return finding;
  return {
    id: 'design.text.contrast-review',
    severity: 'info',
    path: finding.path,
    evidence: { name: finding.evidence.name, reason: 'complex-background' },
    message: finding.message,
    layerId: finding.layerId,
  };
}

/**
 * Exit code and outcome from the families and findings. `requiredTierMissing` is true only
 * for a document whose render family found no browser tier to run on, the one case
 * `browser: 'require'` exits 3 for; an export has no render family to require.
 */
function verdict(
  families: Record<CheckFamily, CheckFamilyStateV1>,
  findings: readonly CheckFindingV1[],
  strict: boolean,
  requiredTierMissing: boolean
): { outcome: CheckOutcomeV1; exitCode: CheckExitCodeV1 } {
  if (FAMILIES.some((f) => families[f].state === 'failed')) return { outcome: 'failed', exitCode: EXIT.failed };
  if (requiredTierMissing) return { outcome: 'failed', exitCode: EXIT.unavailable };
  const errors = findings.some((f) => f.severity === 'error');
  const warns = findings.some((f) => f.severity === 'warn');
  if (errors || (strict && warns)) return { outcome: 'refused', exitCode: EXIT.refused };
  if (warns) return { outcome: 'review', exitCode: EXIT.review };
  return { outcome: 'clean', exitCode: EXIT.clean };
}

/** Run a family, turning a crash into a `failed` state with the error in the reason. */
async function guarded<T>(signal: AbortSignal | undefined, run: () => Promise<T>): Promise<T | { failed: string }> {
  try {
    return await run();
  } catch (err) {
    if (signal?.aborted) throw err;
    if (err instanceof CheckInputError) throw err;
    return { failed: err instanceof Error ? err.message : String(err) };
  }
}
const isFailed = (v: unknown): v is { failed: string } => record(v) && typeof v.failed === 'string' && Object.keys(v).length === 1;

/** Pages a forensic read left out, from its `pages` coverage ("100/300 pages inspected."). */
function pagesTotal(coverage: readonly ForensicCoverage[], read: number): number {
  for (const c of coverage) {
    if (c.collector !== 'pages') continue;
    const m = /(\d+)\/(\d+) (?:pages|slides) inspected/.exec(c.reason);
    if (m) return Math.max(read, Number(m[2]));
  }
  return read;
}

/** A finding for the pages or artboards Verify did not read, so a cap is never read as clean. */
function pagesCapped(read: number, total: number, unit: 'page' | 'artboard'): CheckFindingV1 {
  return {
    code: 'verify.pages-capped',
    family: 'verify',
    severity: 'warn',
    message: `Verify read ${read} of ${plural(total, unit)}; the other ${total - read} ${total - read === 1 ? 'was' : 'were'} not checked.`,
    needs: 'unknown',
    evidence: { read, total },
    suggestion: unit === 'page' ? 'Raise the page cap (up to 100), or check the file in parts.' : 'Raise the page cap (up to 100), or check the document in parts.',
    origin: { checker: 'forensic', id: 'pages-capped' },
  };
}

/** The layout collectors that decode a page: when every one could not, nothing was read. */
const LAYOUT_COLLECTORS = new Set(['pixel-layout', 'source-layout']);

/**
 * Why no page of an export could be decoded, or null when one could: every layout
 * collector unavailable or failed and no text read. An image that is not an image
 * (empty, garbage, a PDF renamed .png) is then a failed check, never a clean one.
 */
function undecodable(report: { pages: ReadonlyArray<{ text: string }>; coverage: readonly ForensicCoverage[] }): string | null {
  if (report.pages.some((p) => p.text.trim())) return null;
  const layout = report.coverage.filter((c) => LAYOUT_COLLECTORS.has(c.collector));
  if (layout.length && !layout.every((c) => c.state === 'unavailable' || c.state === 'failed')) return null;
  const reasons = [...new Set(layout.map((c) => c.reason))].slice(0, 2).join('; ');
  return `No page of this file could be decoded${reasons ? ` (${reasons})` : ''}, so nothing was checked.`;
}

/** The Design colour fields a token link resolves into (plan 291 W4); a link on any other field is left as stored. */
const LINKED_COLOUR_FIELDS = ['bg', 'fg', 'stroke', 'shadowColor'].map((id) => ({ id, type: 'color' as const }));

/** Design's own `background` default (community/design/tool.json), the canvas a frameless document sits on. */
const DESIGN_CANVAS_BACKGROUND = '{color.semantic.surface}';

/**
 * The rows with every linked colour resolved in `theme` (the design system's default
 * when absent), so a family reads what that theme paints. Rows with no link and no
 * reference come back as they were.
 */
export function boxesInTheme(boxes: unknown, doc: unknown, theme: string | undefined): unknown {
  if (!Array.isArray(boxes)) return boxes;
  const rows = boxes as Parameters<typeof resolveBlockTokenBindings>[0];
  const linked = rows.some((row) => record(row) && typeof row.tokenLinks === 'string' && row.tokenLinks.length > 2);
  if (!linked && !hasDesignColourRefs(rows, LINKED_COLOUR_FIELDS.map((f) => f.id))) return boxes;
  let set: ReturnType<typeof createTokenSet>;
  try {
    set = createTokenSet(doc, theme ? { theme } : {});
  } catch {
    return boxes;
  }
  return resolveBlockTokenBindings(rows, 'tokenLinks', LINKED_COLOUR_FIELDS, set);
}

/**
 * A token link that did not resolve in the theme checked, and a run colour reference
 * left as written: the layer paints its cached colour there, which may be another
 * theme's. One warning per layer, naming the references.
 */
function tokenLinkFindings(boxes: unknown, lookup: LayerLookup, theme: string | undefined): CheckFindingV1[] {
  if (!Array.isArray(boxes)) return [];
  const out: CheckFindingV1[] = [];
  boxes.forEach((row, index) => {
    if (!record(row)) return;
    const bad: string[] = [];
    for (const [field, link] of Object.entries(readBlockTokenBindings(row.tokenLinks))) {
      if (!link.custom && (link.status === 'unresolved' || link.status === 'incompatible')) bad.push(`${field} ${link.ref}`);
    }
    for (const link of Object.values(readBlockRunBindings(row.tokenLinks))) {
      if (!link.custom && (link.status === 'unresolved' || link.status === 'incompatible')) bad.push(`a run ${link.ref}`);
    }
    if (typeof row.text === 'string') for (const m of row.text.matchAll(/\{[^|{}]*(@[^\s|{}]+)[^|{}]*\|/g)) bad.push(`a run {${m[1]!.slice(1)}}`);
    if (!bad.length) return;
    const layerId = typeof row.id === 'string' && row.id ? row.id : undefined;
    const artboardId = layerId ? lookup.get(layerId)?.artboardId : undefined;
    out.push({
      code: 'brand.token-link.unresolved',
      family: 'brand',
      severity: 'warn',
      message: `${bad.length === 1 ? 'A colour reference does' : `${bad.length} colour references do`} not resolve${theme ? ` in the ${theme} theme` : ''}, so the layer paints the colour it cached: ${bad.join(', ')}.`,
      path: `/boxes/${index}/tokenLinks`,
      ...(layerId ? { layerId } : {}),
      ...(artboardId ? { artboardId } : {}),
      suggestion: 'Point the reference at a token the design system declares in every theme, or set the colour directly.',
      origin: { checker: 'brand-check', id: 'token-link.unresolved' },
    });
  });
  return out;
}

/** The findings of one theme of a multi-theme check, each saying which. */
function inThemeFindings(list: CheckFindingV1[], theme: string | undefined): CheckFindingV1[] {
  return theme ? list.map((f) => ({ ...f, theme })) : list;
}

/**
 * The themes a document is checked in: `themes` (every declared one for `all`), else
 * `theme`, else the design system's default (`[undefined]`). Unknown names are refused.
 */
function themesToCheck(ds: CheckDesignSystemInputV1 | null, opts: CheckFileOptionsV1): Array<string | undefined> {
  if (opts.themes === undefined) return [opts.theme];
  if (opts.theme !== undefined) throw new CheckInputError('input.unsupported', 'Give one theme or a list of themes, not both.');
  if (!ds) throw new CheckInputError('input.unsupported', 'Checking a document in more than one theme needs a design system, and none was resolved.');
  const declared = themeNamesOf(ds.doc);
  const wanted = opts.themes === 'all' ? declared : [...new Set(opts.themes)];
  if (!wanted.length) throw new CheckInputError('input.unsupported', 'The design system declares no themes to check the document in.');
  for (const name of wanted) {
    if (!declared.includes(name))
      throw new CheckInputError('input.unsupported', `The design system has no theme "${name}"; its themes are ${declared.join(', ') || 'none'}.`);
  }
  return wanted;
}

/** The themes a token document declares, by name; empty when it declares none or cannot be read. */
function themeNamesOf(doc: unknown): string[] {
  try {
    return createTokenSet(doc, {}).themes().map((t) => t.name).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Check one file. Throws `CheckInputError` for an input or source it cannot read;
 * everything else, a crash in one family included, is in the report.
 */
export async function checkFile(bytes: Uint8Array, name: string, asked: CheckFileOptionsV1 = {}): Promise<CheckReportV1> {
  let opts = asked;
  if (bytes.length > CHECK_MAX_INPUT_BYTES) throw new CheckInputError('input.too-large', `${name} is larger than the 64 MB check limit.`);
  if (opts.pageCap !== undefined && (!Number.isInteger(opts.pageCap) || opts.pageCap < 1 || opts.pageCap > 100))
    throw new CheckInputError('input.unsupported', 'The page cap must be a whole number from 1 to 100.');
  const kind = checkInputKind(name);
  if (!kind) throw new CheckInputError('input.unsupported', `lolly check reads a Design document (.json), a .lolly, or an export (.pdf, .pptx, .png, .jpg, .webp, .svg); ${name} is none of these.`);
  const words = SURFACE_WORDS[opts.surface ?? 'cli'];
  const strict = opts.strict === true;
  const isDocument = kind === 'design' || kind === 'lolly';
  const ds = isDocument ? (opts.designSystem ?? null) : null;
  if (ds && opts.theme) {
    const themes = themeNamesOf(ds.doc);
    if (themes.length && !themes.includes(opts.theme))
      throw new CheckInputError('input.unsupported', `The design system has no theme "${opts.theme}"; its themes are ${themes.join(', ')}.`);
  }
  // Validated as asked; a theme the document was saved in may stand in for "none" below.
  if (isDocument) themesToCheck(ds, opts);
  const families = Object.fromEntries(FAMILIES.map((f) => [f, familyState('skipped')])) as Record<CheckFamily, CheckFamilyStateV1>;
  const findings: CheckFindingV1[] = [];
  const input: CheckInputV1 = { kind, name, sha256: sha256(bytes) };
  let fidelity: CheckFidelityV1 | undefined;
  let designSystem: CheckReportV1['designSystem'];
  let requiredTierMissing = false;
  const source = opts.source ? await sourceInventory(opts.source, opts.signal) : undefined;

  const take = (family: CheckFamily, state: CheckFamilyStateV1, list: CheckFindingV1[]): void => {
    families[family] = state;
    findings.push(...list);
  };

  const read = isDocument ? (kind === 'lolly' ? await designFromLolly(bytes) : designFromJson(bytes)) : null;
  // A document saved in a theme other than the default is checked in it when no theme
  // was asked for (plan 291 W4), by every family, the render family included.
  const saved = opts.theme === undefined && opts.themes === undefined ? savedTheme(ds, read?.tokenSelection) : undefined;
  if (saved) opts = { ...opts, theme: saved };
  const checkThemes = isDocument ? themesToCheck(ds, opts) : [opts.theme];
  const multiTheme = checkThemes.length > 1;
  const lowered = read ? lowerDesignAuthoring(read, ds, opts) : null;
  if (lowered && 'invalid' in lowered) {
    // Nothing else can be checked: the layers the authoring describes could not be built.
    designSystem = ds ? { origin: ds.origin, ...(ds.profile ? { profile: ds.profile } : {}), ...(ds.tokensAsset ? { tokensAsset: ds.tokensAsset } : {}) } : null;
    take('structure', familyState('ran', 'Stopped at the authoring keys, which could not be lowered to layers.'), [authoringInvalid(lowered.invalid, read?.values.boxes)]);
    const stopped = 'The document\'s authoring keys could not be lowered to layers (design.authoring.invalid), so there was nothing to check.';
    for (const family of ['render', 'brand', 'verify', 'fidelity'] as const) families[family] = familyState('skipped', stopped);
  } else if (lowered) {
    // Plan 291 W4: linked colours resolve in the theme checked, so a family reads the
    // colours that theme paints; a document with no link is untouched.
    const inTheme = (theme: string | undefined): unknown => (ds ? boxesInTheme(lowered.doc.boxes, ds.doc, theme) : lowered.doc.boxes);
    const doc = { ...lowered.doc, boxes: inTheme(checkThemes[0]) };
    const structure = inspectDesignV1(doc.boxes);
    input.artboards = structure.artboards.length;
    const lookup = designLayerLookup(doc.boxes);
    const authored = lowered.rows === null ? '' : ` The authoring keys were lowered first, to ${plural(lowered.rows, 'stored row')}; finding paths point at those rows.`;
    const savedNote = saved ? ` The document was saved in the ${saved} theme, so every family checked it in that theme.` : '';
    take(
      'structure',
      familyState('ran', `Inspected ${plural(structure.layers.length, 'layer')} on ${plural(structure.artboards.length, 'artboard')}.${authored}${savedNote}`),
      [...lowered.notes.map(authoringNoteFinding), ...structure.findings.map(checkFindingFromDesign)],
    );
    // Pictures drawn past their pixel size (plan 291 M3b). A crash here is said in the
    // structure reason and leaves the family's other findings standing.
    const pictures = await guarded(opts.signal, () => imageResolutionFindings(doc, opts, lookup));
    if (isFailed(pictures)) families.structure.reason = `${families.structure.reason} Picture resolution could not be checked: ${pictures.failed}`;
    else {
      findings.push(...pictures.findings);
      if (pictures.measured)
        families.structure.reason = `${families.structure.reason} Measured ${plural(pictures.measured, 'picture layer')} for resolution against the size ${pictures.measured === 1 ? 'it draws its picture' : 'they draw their pictures'} at.`;
      if (pictures.unread)
        families.structure.reason = `${families.structure.reason} ${pictures.unread === 1 ? 'One picture layer has' : `${pictures.unread} picture layers have`} no picture bytes to read here, so ${pictures.unread === 1 ? 'its' : 'their'} resolution was not checked.`;
    }

    designSystem = ds ? { origin: ds.origin, ...(ds.profile ? { profile: ds.profile } : {}), ...(ds.tokensAsset ? { tokensAsset: ds.tokensAsset } : {}) } : null;
    if (!ds) {
      families.brand = familyState('unavailable', `${words.noDesignSystem}${opts.theme ? ` The theme "${opts.theme}" was not checked against one.` : ''}`);
    } else {
      const lists: CheckFindingV1[] = [];
      const reasons: string[] = [];
      let failed: string | null = null;
      for (const theme of checkThemes) {
        const boxes = inTheme(theme);
        const brand = await guarded(opts.signal, async () => {
          const result = checkBrandDesign(boxes, ds.doc, { ...(theme ? { theme } : {}), ...brandCheckCatalog(opts.catalog ?? null) });
          const rules = checkDesignHouseRules(boxes, brandSystemOf(ds.doc)?.rules ?? [], ds.doc, {
            ...(theme ? { theme } : {}),
            ...(opts.catalog ? { catalog: opts.catalog } : {}),
            // A document with no frames sits on its canvas background (Design's default
            // when the document does not set one), read in this theme.
            background: lowered.doc.values.background ?? DESIGN_CANVAS_BACKGROUND,
          });
          const list = [
            ...result.findings.map((f) => checkFindingFromBrand(f, lookup)),
            ...enforceHouseRules(checkFindingsFromHouseRules(rules, lookup), ds.doc),
          ];
          const notes = [
            `Compared ${plural(result.checked.colors, 'colour value')}, ${plural(result.checked.fonts, 'font choice')} and ${plural(result.checked.assets, 'asset id')}; checked ${plural(rules.checked, 'house rule')}.`,
          ];
          if (theme && !multiTheme) notes.push(`Theme: ${theme}.`);
          const uploads = result.uploads;
          if (uploads) notes.push(`${plural(uploads, 'uploaded picture')} ${uploads === 1 ? 'is' : 'are'} not catalog assets and ${uploads === 1 ? 'was' : 'were'} not reviewed.`);
          if (result.coverage.truncated) notes.push('The document has more layers than the brand check reads; the rest were not compared.');
          if (result.notAssessed.length) notes.push(`Not assessed: ${result.notAssessed.join(', ')}.`);
          return { state: familyState('ran', notes.join(' ')), list };
        });
        if (isFailed(brand)) {
          failed = multiTheme ? `In the ${theme} theme: ${brand.failed}` : brand.failed;
          break;
        }
        lists.push(...inThemeFindings([...brand.list, ...tokenLinkFindings(boxes, lookup, theme)], multiTheme ? theme : undefined));
        reasons.push(multiTheme ? `In the ${theme} theme: ${brand.state.reason ?? ''}`.trim() : brand.state.reason ?? '');
      }
      if (failed !== null) families.brand = familyState('failed', failed);
      else take('brand', familyState('ran', reasons.join(' ')), lists);
    }

    {
      const lists: CheckFindingV1[] = [];
      const reasons: string[] = [];
      let failed: string | null = null;
      for (const theme of checkThemes) {
        const boxes = inTheme(theme);
        const verify = await guarded(opts.signal, async () => {
          const resolveColor = colourResolver(ds?.doc, theme);
          const result = await verifyDesignDocument(boxes, {
            bytes,
            strict,
            ...(doc.textDocument !== undefined ? { textDocument: doc.textDocument } : {}),
            ...(resolveColor ? { resolveColor } : {}),
            ...(opts.pageCap ? { pageCap: opts.pageCap } : {}),
          });
          const note = coverageNote(result.coverage);
          const read = result.report.pages.length;
          const total = Math.max(read, structure.artboards.length);
          return {
            state: familyState('ran', `Read ${plural(read, 'artboard')} from the document's own geometry (no OCR, no pixels).${note ? ` ${note}` : ''}`),
            list: [...result.findings, ...(read < total ? [pagesCapped(read, total, 'artboard')] : [])],
          };
        });
        if (isFailed(verify)) {
          failed = multiTheme ? `In the ${theme} theme: ${verify.failed}` : verify.failed;
          break;
        }
        lists.push(...inThemeFindings(verify.list, multiTheme ? theme : undefined));
        reasons.push(multiTheme ? `In the ${theme} theme: ${verify.state.reason ?? ''}`.trim() : verify.state.reason ?? '');
      }
      if (failed !== null) families.verify = familyState('failed', failed);
      else take('verify', familyState('ran', reasons.join(' ')), lists);
    }

    const render = await renderFamilyInThemes(checkThemes, opts, (o) => guarded(opts.signal, () => renderFamily(doc, o, lookup, structure.layers.length, name, ds)));
    if (isFailed(render)) families.render = familyState('failed', render.failed);
    else {
      take('render', render.state, render.findings);
      if (opts.browser === 'require' && render.tierMissing) {
        requiredTierMissing = true;
        families.render.reason = `${families.render.reason ?? ''} The browser tier was required, so the check exits 3.`.trim();
      }
    }
    // With no painted canvas, clipping is still predicted from the faces' metrics. The
    // family keeps its state, since the mounted audit did not run; the reason says what did.
    if ((families.render.state === 'skipped' || families.render.state === 'unavailable') && opts.textMeasure !== false) {
      const measured = await guarded(opts.signal, () => textMeasureFamily(doc, ds, opts, lookup));
      const before = (families.render.reason ?? '').trim();
      const lead = before && !/[.!?]$/.test(before) ? `${before}.` : before;
      if (isFailed(measured)) families.render.reason = `${lead} Clipping could not be predicted from font metrics: ${measured.failed}`.trim();
      else {
        findings.push(...measured.findings);
        families.render.reason = `${lead} ${measured.note}`.trim();
      }
    }

    if (source) {
      const result = await guarded(opts.signal, async () => {
        const compared = checkFidelity(source, doc.boxes, {
          ...(doc.textDocument !== undefined ? { textDocument: doc.textDocument } : {}),
          ...(opts.edits ? { edits: opts.edits } : {}),
        });
        return { compared, reason: `Compared ${plural(source.slides.length, 'source slide')} of ${source.source.name} with ${plural(compared.fidelity.slides.result, 'artboard')}.${fidelityNote(compared)}` };
      });
      if (isFailed(result)) families.fidelity = familyState('failed', result.failed);
      else {
        fidelity = result.compared.fidelity;
        take('fidelity', familyState('ran', result.reason), result.compared.findings);
      }
    } else families.fidelity = familyState('skipped', words.noSource);
  } else {
    const notDesign = 'An export carries no Design layers; this family reads a Design document or a .lolly.';
    families.structure = familyState('skipped', notDesign);
    families.render = familyState(
      'skipped',
      opts.browser === 'require' ? `${notDesign} The browser tier was required, which applies to a document only, so the requirement was not applied here.` : notDesign
    );
    families.brand = familyState('skipped', opts.theme ? `${notDesign} The theme "${opts.theme}" applies to a document only.` : notDesign);
    // Plan 291 M4: a .pptx paints its colours on the slides, so the brand family reads
    // them there (fills, outlines, text runs and grounds) against one theme.
    const pptxDs = kind === 'pptx' ? (opts.designSystem ?? null) : null;
    if (kind === 'pptx' && !pptxDs) families.brand = familyState('unavailable', words.noDesignSystem);
    if (pptxDs) {
      const themes = themeNamesOf(pptxDs.doc);
      if (opts.theme && themes.length && !themes.includes(opts.theme))
        throw new CheckInputError('input.unsupported', `The design system has no theme "${opts.theme}"; its themes are ${themes.join(', ')}.`);
      designSystem = { origin: pptxDs.origin, ...(pptxDs.profile ? { profile: pptxDs.profile } : {}), ...(pptxDs.tokensAsset ? { tokensAsset: pptxDs.tokensAsset } : {}) };
      const { pptxBrandFindings } = await import('./check-pptx-brand.ts');
      const brand = await guarded(opts.signal, () => pptxBrandFindings(bytes, pptxDs.doc, opts.theme));
      if (isFailed(brand)) families.brand = familyState('failed', brand.failed);
      else take('brand', familyState('ran', brand.reason), brand.findings);
    }
    const verify = await guarded(opts.signal, async () => {
      const { inspectForensicBytes } = await import('./forensic.ts');
      const report = await inspectForensicBytes(bytes, name, {
        pageCap: opts.pageCap ?? 100,
        classifier: false,
        ocr: opts.ocr === true,
        ...(opts.signal ? { signal: opts.signal } : {}),
      });
      const read = report.pages.length;
      const total = pagesTotal(report.coverage, read);
      input.pages = total;
      const crashed = report.coverage.find((c) => c.collector === 'assessment' && c.state === 'failed');
      if (crashed) return { failed: crashed.reason };
      const blank = undecodable(report);
      if (blank) return { failed: blank };
      const note = coverageNote(report.coverage);
      const models = opts.ocr ? 'OCR on, text classifier off' : 'OCR and the text classifier off';
      const list = report.findings.flatMap((f) => checkFindingsFromForensic(f, { strict }));
      // A page with no text layer, read with OCR off, had no text checks at all: a
      // clean verdict there would claim more than was assessed.
      const ocrSkipped = new Set(report.coverage.filter((c) => c.collector === 'ocr' && c.state === 'skipped').map((c) => c.page ?? ''));
      const unread = opts.ocr ? [] : report.pages.filter((p) => !p.text.trim() && (ocrSkipped.has(p.id) || ocrSkipped.has('')));
      if (unread.length) {
        const pages = unread.map((p) => p.id);
        list.push({
          code: 'verify.text.unread',
          family: 'verify',
          severity: 'warn',
          message: `${plural(unread.length, 'page')} ${unread.length === 1 ? 'carries' : 'carry'} no text layer, so the text checks did not run on ${unread.length === 1 ? 'it' : 'them'}. ${words.unreadText}`,
          needs: 'unknown',
          ...(unread.length === 1 ? { page: pages[0] } : {}),
          evidence: { pages: pages.length > 20 ? `${pages.slice(0, 20).join(', ')} and ${pages.length - 20} more` : pages.join(', ') },
          origin: { checker: 'forensic', id: 'text.unread' },
        });
      }
      if (read < total) list.push(pagesCapped(read, total, 'page'));
      return {
        state: familyState('ran', `Read ${plural(read, 'page')}${read < total ? ` of ${total}` : ''} from the file (${models}).${note ? ` ${note}` : ''}`),
        list,
      };
    });
    if (isFailed(verify)) families.verify = familyState('failed', verify.failed);
    else take('verify', verify.state, verify.list);

    if (source && kind !== 'image') {
      // A PDF carries no speaker notes, so their absence there is not a finding.
      const notes = kind === 'pptx';
      const result = await guarded(opts.signal, async () => {
        const { readContentInventory } = await import('./content-inventory.ts');
        const own = (await readContentInventory({ bytes, name, ...(opts.signal ? { signal: opts.signal } : {}) })).inventory;
        const compared = checkFidelity(source, inventoryAsBoxes(own), { notes, ...(opts.edits ? { edits: opts.edits } : {}) });
        const reason =
          `Compared ${plural(source.slides.length, 'source slide')} of ${source.source.name} with ${plural(compared.fidelity.slides.result, 'page')} of ${name}.` +
          (notes ? '' : ' Speaker notes were not compared: a PDF does not carry them.') +
          fidelityNote(compared);
        return { compared, reason };
      });
      if (isFailed(result)) families.fidelity = familyState('failed', result.failed);
      else {
        fidelity = result.compared.fidelity;
        take('fidelity', familyState('ran', result.reason), result.compared.findings);
      }
    } else families.fidelity = familyState('skipped', source ? 'A picture has no text frames to compare with a source.' : words.noSource);
  }

  for (const f of findings) families[f.family][f.severity] += 1;
  const summary = {
    error: findings.filter((f) => f.severity === 'error').length,
    warn: findings.filter((f) => f.severity === 'warn').length,
    info: findings.filter((f) => f.severity === 'info').length,
  };
  const { outcome, exitCode } = verdict(families, findings, strict, requiredTierMissing);
  return {
    format: 'lolly-check',
    version: 1,
    input,
    outcome,
    exitCode,
    strict,
    families,
    summary,
    findings,
    ...(fidelity ? { fidelity } : {}),
    ...(designSystem !== undefined ? { designSystem } : {}),
  };
}
