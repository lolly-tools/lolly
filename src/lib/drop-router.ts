// SPDX-License-Identifier: MPL-2.0
/**
 * Universal drop router - the "drop a file on the front door" seam (gallery +
 * dashboard roots, the welcome dialog's file-picker fallback, and the Android
 * share-target ingest - see initShareTargetIngest below). A SCOPED
 * drag-and-drop handler sniffs what landed and opens a chooser sheet offering
 * only the routes that genuinely apply:
 *
 *   design file (.fig/.penpot/.idml/.indd/SVG/zip) → Design, parsed to boxes
 *   token doc / .penpot / design-system pack zip → the Design System studio
 *   PDF / .ai   → edit as a design · pages → SVG library assets · compress ·
 *                 the Design System studio (a guidelines PDF's colours, marks
 *                 and embedded faces - plan 97 section 8)
 *   zipped tool folder → install it on this device and open it
 *   PowerPoint  → slides → SVG library assets · content → Markdown
 *   Word (.docx) → content → Markdown
 *   image/video/audio → the asset library · /verify (Content Credentials)
 *   unknown / C2PA-looking bytes → /verify
 *
 * A `.penpot` reaches TWO doors (Design and the studio), so both label
 * where they land rather than what they do (plan 97 section 14.9).
 *
 * Design files travel by the same one-shot in-memory handoff pattern
 * lib/verify-handoff.ts proves: the File is stashed here, we navigate to
 * #/tool/design, and free-canvas consumes it on mount
 * (takePendingDesignImport) through the exact code path of its Import panel.
 *
 * Deliberately light at module scope: the picker (storeUserUpload), pdf-import
 * and pptx-import chunks all load lazily at drop/choice time, so attaching the
 * router costs the gallery cold path nothing. The byte sniff here is a few
 * local magic-number checks (zip 'PK', '%PDF', '<svg', JUMBF/'c2pa' markers) - 
 * NOT a duplicate of design-import.ts's full format routing: real format
 * resolution (Penpot vs .fig vs IDML inside a zip, PDF page interpretation)
 * still happens solely in parseDesignFile once a design file reaches it.
 * design-import's own sniffers are module-private and ship in the heavy
 * kiwi/zstd chunk, which a JPEG drop should never pull in.
 *
 * House rules honoured: handlers attach to the given root only (never window/
 * document), preventDefault fires only for actual file drags, the chooser is
 * mountModal-based (via choiceDialog - Escape/backdrop close), and the DOM
 * cost is one hint pill per attached root.
 */

import { t, tRaw } from '../i18n.ts';
import { NAV_EVENTS } from '../utils.ts';
import { announce } from '../a11y.ts';
import { playSfx } from './sfx.ts';
import { choiceDialog, confirmDialog, closeConfirmDialogs } from '../components/confirm-dialog.ts';
import type { DialogChoice } from '../components/confirm-dialog.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import type { InstalledToolTrust } from './installed-tools.ts';
import { setPendingVerify } from './verify-handoff.ts';
import { deepLinkToHash } from './deep-link.ts';
import { tauriInvoke } from './nearby-boot.ts';
import type { PickerHost } from '../views/picker.ts';
import type { BeamPackHost } from './beam-pack.ts';
import type { Unzipped } from 'fflate';
import type { LollyPreview, LollySessionPreview } from './lolly-intake.ts';
import type { LollyFileContents } from './lolly-pack.ts';
import type { UserTemplate, UserTemplateHost } from './user-templates.ts';
import type { DesignSystemRegistry } from './design-system/registry.ts';

type PickerModule = typeof import('../views/picker.ts');

/** Everything the file-picker fallback should let through - a superset of the
 *  picker's UPLOAD_ACCEPT (that list deliberately excludes design formats). */
const UNIVERSAL_ACCEPT =
  '.fig,.penpot,.zip,.tar,.tgz,.gz,.svg,.idml,.indd,.pdf,.ai,.pptx,.docx,.xlsx,.csv,.tsv,.psd,.psb,.xcf,image/*,video/*,audio/*,' +
  '.mov,.json,.lottie,.mp3,.wav,.ogg,.m4a,.flac,.bmp,.ico,.cur,.svgz,.lolly';

// Extension fallbacks for files whose MIME type the OS didn't fill in.
const DESIGN_EXT_RE = /\.(fig|penpot|idml|indd|svg|zip)$/i;
// .bmp/.ico usually arrive with an image/* MIME (already accepted); the ext entries are
// the blank-MIME backstop. .svgz is media/library only (svgz-as-design would need a
// gunzip step in parseDesignFile).
const MEDIA_EXT_RE = /\.(png|apng|jpe?g|webp|gif|avif|heic|heif|svg|svgz|bmp|ico|cur|mp4|webm|mov|mp3|wav|ogg|oga|opus|m4a|aac|flac|mid|midi|mod|xm|it|s3m|stm|mtm|json|lottie)$/i;
// Plain archives the shell can explode into member assets. EXCLUDES the design
// bundles (.penpot/.fig/.idml/.indd) and the OOXML/OCF packages (.xlsx/.docx/.pptx/
// .epub/.odt) - those are zips too but route to their own readers. This is a cheap
// name gate for the chooser; the authoritative byte check (never shred an office
// file) lives in archive-ingest.readArchiveMembers, run when the user commits.
const ARCHIVE_EXT_RE = /\.(zip|tar|tar\.gz|tgz)$/i;
// A plain-text document (prose, markdown, code, config) - kept in step with picker.ts's
// TEXT_EXT_RE. These ingest to the library as type:'text' assets; without this a page-wide
// drop offered no "Add to your library" route (only media did), so a .txt looked unsupported.
const TEXT_DROP_RE = /\.(txt|md|markdown|text|js|jsx|mjs|cjs|ts|tsx|py|rb|go|rs|java|c|h|hpp|cc|cpp|cs|swift|kt|kts|php|pl|lua|sql|r|scala|sh|bash|zsh|fish|yaml|yml|toml|ini|cfg|conf|css|scss|less|html|htm|xml|vue|svelte|astro)$/i;
// The OOXML wordprocessing MIME (office-text.ts's DOCX_MIME), inlined so a plain
// image drop never pulls that module's fflate + engine chunk in just to sniff.
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PURE_DESIGN_EXT_RE = /\.(fig|penpot|idml|indd)$/i;
const CONTAINER_DOC_EXT_RE = /\.(xlsx|docx|pptx|epub|odt)$/i;
// Design-system shapes (plan 97 section 8). A Penpot project always carries a token
// document; the zip/JSON cases need evidence, below.
const PENPOT_EXT_RE = /\.penpot$/i;
const JSON_EXT_RE = /\.json$/i;
// A table of data by name or MIME. `.xlsx` is a zip and an office container, so it
// is gated here too, not left to the zip-magic design sniff (which used to claim
// it and error in Design); the Chart route decodes it sheet by sheet.
const DATA_DROP_RE = /\.(csv|tsv|xlsx)$/i;
const DATA_MIME_RE = /^(?:text\/(?:csv|tab-separated-values)|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)$/i;
// The engine's row-import cap (parseDataRows) - a bigger file is not a chart.
const DATA_MAX_BYTES = 8 * 1024 * 1024;
// A zipped tool folder: `tool.json` named in a local file header, at the archive root
// or one folder down (the "zip the folder" shape). Entry names sit in the clear even
// when bodies deflate, so this rides the same 64 KB head read as the other zip sniffs.
const TOOL_ZIP_HEAD_RE = /(?:^|[^\w./-])(?:[\w.-]+\/)?tool\.json/;
/** How much of a JSON drop the router is willing to parse just to decide which
 *  routes to OFFER. Bigger token documents still import fine through the
 *  studio's own source picker; they just don't get the shortcut here. */
export const TOKENS_SNIFF_MAX_BYTES = 4 * 1024 * 1024;

// ── one-shot handoff stashes (the verify-handoff pattern) ──────────────────────

let pendingDesign: { file: File; scenes: boolean } | null = null;

/** Is a design file waiting for Design to consume it? A PEEK, not a take: the tool
 *  view asks this before opening its launch-time template chooser, because a file
 *  arriving through the drop door already IS the document - a "pick a template" modal
 *  over it is the wrong question, and a template applied under a running import
 *  re-mounts the canvas and orphans the import (measured 2026-09-02). */
export function hasPendingDesignImport(): boolean {
  return pendingDesign !== null;
}

/** Consume the design file stashed by a drop route into Design - single use,
 *  cleared on read. free-canvas checks this on mount. `scenes` carries the
 *  "as timed scenes vs replace the board" choice the drop door offered
 *  (plans/104 section 337): the "Make a video from its frames" door sets it true. */
export function takePendingDesignImport(): { file: File; scenes: boolean } | null {
  const d = pendingDesign;
  pendingDesign = null;
  return d;
}

let pendingDesignSystemFile: File | null = null;

/** Arm the Design System studio's one-shot file handoff. Kept beside the take
 *  so Profile can wait until a file is actually chosen before creating its
 *  destination system (cancel must be a true no-op). */
export function setPendingDesignSystemFile(file: File): void {
  pendingDesignSystemFile = file;
}

/**
 * Consume the file stashed by the "Use as the design system" route - single use,
 * cleared on read, never written to disk. `views/start.ts` reads it on mount and
 * routes it by what it IS (a PDF opens the PDF source and scans it; a token
 * document, Penpot project or pack lands on the design-file card), so the studio
 * never asks a second time for a file the person already handed over.
 *
 * Every route below that reaches the studio arms it, including the PDF one - a
 * guidelines PDF is design-system material even though the sniff files it under
 * `pdf` (its colours, marks and embedded faces are the whole point of plan 97 section 8's
 * PDF source).
 */
export function takePendingDesignSystemFile(): File | null {
  const f = pendingDesignSystemFile;
  pendingDesignSystemFile = null;
  return f;
}

let pendingToolFile: { toolId: string; file: File } | null = null;

/** Consume a file stashed for a specific tool (e.g. compress-pdf). Single use;
 *  returns null when the stash belongs to a different tool. NOTE: views/tool.ts
 *  does not consume this yet - until it does, the compress route simply lands
 *  the user on the tool's own (empty) drop canvas. */
export function takePendingToolFile(toolId: string): File | null {
  if (pendingToolFile?.toolId !== toolId) return null;
  const f = pendingToolFile.file;
  pendingToolFile = null;
  return f;
}

let pendingConvertFile: File | null = null;

/** Consume a file sent directly to the dedicated Convert view. */
export function takePendingConvertFile(): File | null {
  const f = pendingConvertFile;
  pendingConvertFile = null;
  return f;
}

export type NativeUtilityTarget = 'strip-data' | 'convert' | 'redact';

/**
 * Direct desktop file-manager hand-off. Unlike openDropChooser this already
 * carries the person's chosen verb, so asking the generic "what should Lolly
 * do?" question again would discard that intent. The file is still only held
 * in memory and each destination consumes it once on mount.
 */
export function openFileInUtility(target: NativeUtilityTarget, file: File): void {
  if (target === 'convert') {
    pendingConvertFile = file;
    routeToConsumer('#/convert', /^#\/convert([?/]|$)/.test(window.location.hash));
    return;
  }
  pendingToolFile = { toolId: target, file };
  routeToConsumer(`#/tool/${target}`, onToolRoute(target));
}

let pendingToolSeed: { toolId: string; values: Record<string, unknown> } | null = null;

let pendingSpreadsheetFile: File | null = null;

/** Consume a spreadsheet handed to the universal opener - single use. The
 *  dedicated #/data utility owns worksheet selection, editing and download, so
 *  an OS-level "Open with Lolly" follows the same path as its gallery tile. */
export function takePendingSpreadsheetFile(): File | null {
  const f = pendingSpreadsheetFile;
  pendingSpreadsheetFile = null;
  return f;
}

/** Arm a one-shot initial-values seed for `toolId` - the layered-import route
 *  (psd-import) parses + stores layer assets BEFORE navigating, then stashes
 *  the block rows here; views/tool.ts folds them into initialValues on mount. */
export function setPendingToolSeed(toolId: string, values: Record<string, unknown>): void {
  pendingToolSeed = { toolId, values };
}

/** Consume the seed stashed for `toolId`. Single use; null for other tools. */
export function takePendingToolSeed(toolId: string): Record<string, unknown> | null {
  if (pendingToolSeed?.toolId !== toolId) return null;
  const v = pendingToolSeed.values;
  pendingToolSeed = null;
  return v;
}

// ── sniffing ───────────────────────────────────────────────────────────────────

export interface Sniff {
  design: boolean;
  pdf: boolean;
  pptx: boolean;
  media: boolean;
  c2pa: boolean;
  /** A layered bitmap (Photoshop PSD/PSB or GIMP XCF). */
  layers: boolean;
  /** A plain archive (.zip/.tar/.tar.gz) we can explode into member assets. */
  archive: boolean;
  /** A plain-text document (prose/markdown/code) that ingests to the library as a
   *  type:'text' asset - so a page-wide drop offers "Add to your library". */
  textDoc: boolean;
  /** Design-system material (plan 97 section 8): a DTCG/Tokens-Studio token document,
   *  a Penpot project, or a zip whose parts say design-system pack. Additive - 
   *  it never suppresses a route another flag already earned. */
  designSystem: boolean;
  /** A `.lolly` portable bundle. Its manifest later distinguishes a shared
   *  session, design-system pack or instance pack. It IS a zip, so it must be
   *  recognised before generic design/archive routes claim it. */
  lolly: boolean;
  /** A Word (.docx) document (plans/139): its route is content extraction. Optional,
   *  and an absent flag reads as false. */
  docx?: boolean;
  /** A plain `.zip` of a tool folder (`tool.json` + template + hooks): the sideload
   *  route, so an author can zip a folder and run it here without a monorepo clone.
   *  A head-read heuristic like `designSystem`; `readToolZip` is the authoritative
   *  read, run when the user picks the route. Optional, absent reads as false. */
  tool?: boolean;
  /** A table of data (.csv/.tsv/.xlsx): its primary route is the on-device
   *  Spreadsheet utility; Chart remains an optional second route.
   *  Optional, absent reads as false. */
  data?: boolean;
}

const isMediaFile = (f: File): boolean =>
  /^(image|video|audio)\//.test(f.type) || MEDIA_EXT_RE.test(f.name);

/**
 * True when a zip's head lists the parts a design-system container is made of.
 * A zip's LOCAL FILE HEADERS store entry names uncompressed, so a bounded head
 * read can name a zip's first entries even when their bodies are deflated - 
 * which is the whole reason this is affordable at drop time. The pairings
 * mirror what `design-system/sources/file.ts` keys on when it really opens the
 * archive: a Lolly pack (`manifest.json` + `tokens.json`), a Penpot project
 * (same pair, tokens per file), a loose token-set export (`$metadata.json` /
 * `$themes.json`). Deliberately a heuristic: the authoritative read happens in
 * the studio, and the cost of a wrong guess here is one extra route offered.
 * Pure - exported for the co-located test.
 */
export function zipListsDesignSystemParts(head: string): boolean {
  if (head.includes('$metadata.json') || head.includes('$themes.json')) return true;
  return head.includes('manifest.json') && head.includes('tokens.json');
}

/**
 * True when an already-parsed JSON object is shaped like a token document:
 * Tokens-Studio container keys, a DTCG `$value` leaf, or the legacy
 * Tokens-Studio `{ value, type }` leaf. `coerceTokensDoc` alone answers yes to
 * ANY JSON object (it only rejects arrays/primitives), so a dropped Lottie or
 * GeoJSON would otherwise be offered as a design system.
 *
 * Bounded on purpose - a fixed node/depth budget, so the check costs the same
 * on a 40-token file and on a huge unrelated document. A token doc puts its
 * leaves shallow, so the budget only ever truncates material we would not have
 * recognised anyway. Pure - exported for the co-located test.
 */
export function looksLikeTokenDoc(doc: unknown, maxNodes = 4000, maxDepth = 8): boolean {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) return false;
  const root = doc as Record<string, unknown>;
  // Own keys only, everywhere: a token set is user-supplied JSON, so an
  // inherited `value`/`type` must never pass for a token leaf.
  if (Object.hasOwn(root, '$themes') || Object.hasOwn(root, '$metadata')) return true;
  let budget = maxNodes;
  const stack: Array<{ node: Record<string, unknown>; depth: number }> = [{ node: root, depth: 0 }];
  while (stack.length) {
    const { node, depth } = stack.pop()!;
    if (budget-- <= 0) return false;
    if (Object.hasOwn(node, '$value')) return true;
    if (Object.hasOwn(node, 'value') && Object.hasOwn(node, 'type') && typeof node.type === 'string') return true;
    if (depth >= maxDepth) continue;
    for (const child of Object.values(node)) {
      if (typeof child === 'object' && child !== null && !Array.isArray(child)) {
        stack.push({ node: child as Record<string, unknown>, depth: depth + 1 });
      }
    }
  }
  return false;
}

/**
 * The JSON half of the design-system sniff: a `.json` drop small enough to
 * parse, whose first non-blank byte is `{` (the head read answers that without
 * touching the rest), that survives the engine's own `coerceTokensDoc` and then
 * looks like tokens. The engine import is lazy so a JPEG drop never pays for it.
 */
async function looksLikeTokensFile(file: File, head: string): Promise<boolean> {
  const jsonish = JSON_EXT_RE.test(file.name) || /^(application|text)\/json$/.test(file.type);
  if (!jsonish || file.size > TOKENS_SNIFF_MAX_BYTES) return false;
  // Leading whitespace, or a UTF-8 BOM (latin1-decoded to EF BB BF), then '{'.
  if (!/^[\s\uFEFF\u00EF\u00BB\u00BF]*\{/.test(head)) return false;
  try {
    const { coerceTokensDoc } = await import('@lolly/engine');
    const { doc } = coerceTokensDoc(JSON.parse(await file.text()));
    return !!doc && looksLikeTokenDoc(doc);
  } catch {
    return false; // unreadable or not JSON after all - no route, no error
  }
}

/**
 * Classify one file by name/MIME plus (when `deep`) a bounded head read - 64 KB,
 * enough for the zip/PDF/SVG magic and a C2PA marker scan, never the whole file.
 */
async function sniffFile(file: File, deep: boolean, picker: PickerModule): Promise<Sniff> {
  const pptx = picker.isPptxUpload(file);
  // Name/MIME only, the same gate office-text's looksLikeDocxFile applies - a .docx is
  // a zip, so without this the generic design route claims it (and errors in Design).
  const docx = /\.docx$/i.test(file.name) || file.type === DOCX_MIME;
  let head: Uint8Array | null = null;
  if (deep) {
    try {
      head = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer());
    } catch { /* unreadable - fall back to name/MIME only */ }
  }
  // latin1 keeps a 1:1 byte↔char mapping, so regex offsets equal byte offsets.
  const text = head ? new TextDecoder('latin1').decode(head) : '';
  // "%PDF" within the first 1 KB (the spec permits a little leading junk) - 
  // mirrors design-import's isPdf window without pulling its chunk in.
  const pdf = picker.isPdfUpload(file) || text.slice(0, 1028).includes('%PDF');
  const zipMagic = !!head && head.length >= 4
    && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  const svgText = /<svg[\s>]/i.test(text.slice(0, 4096));
  // A .lolly is a zip; recognise it by extension so the generic design/archive routes
  // (which zip-magic would otherwise trigger) never claim it - it opens directly. Also
  // accept the canonical MIME (LOLLY_MIME) for a share that arrives typed but with a
  // mangled name (e.g. Android ACTION_SEND of application/vnd.lolly+zip).
  const lolly = /\.lolly$/i.test(file.name) || file.type === 'application/vnd.lolly+zip';
  // JUMBF box type / C2PA manifest label / PNG caBX chunk - a heuristic "this
  // carries Content Credentials" signal, not a verification (that's /verify's job).
  const c2pa = /jumb|c2pa|caBX/.test(text);
  // Layered bitmaps: '8BPS' (PSD/PSB) or 'gimp xcf ' at offset 0 - the same
  // prefix check as the engine's sniffLayeredRaster, inlined so a JPEG drop
  // never pulls the engine chunk. Extension fallback for a blank OS MIME.
  const layers = head
    ? ((head[0] === 0x38 && head[1] === 0x42 && head[2] === 0x50 && head[3] === 0x53)
      || text.startsWith('gimp xcf '))
    : /\.(psd|psb|xcf)$/i.test(file.name);
  const data = !lolly && (DATA_DROP_RE.test(file.name) || DATA_MIME_RE.test(file.type));
  const design = !lolly && !pdf && !pptx && !docx && !layers && !data && (DESIGN_EXT_RE.test(file.name) || zipMagic || svgText);
  // A plain archive: a zip/tar by name, or PK-magic bytes that aren't a design
  // bundle. Design bundles and office/OCF packages (zips too) are excluded so the
  // "unpack" route never competes for a .penpot or shreds a .xlsx.
  const archive = !lolly && !layers && !PURE_DESIGN_EXT_RE.test(file.name) && !CONTAINER_DOC_EXT_RE.test(file.name)
    && (ARCHIVE_EXT_RE.test(file.name) || (zipMagic && !DESIGN_EXT_RE.test(file.name)));
  // Design-system material (plan 97 section 8), sniffed LAST and only on the deep
  // (single-file) path - the route is a single-file journey, and every flag
  // above is computed exactly as it was before this one existed. A .penpot is
  // one by extension; a zip needs its parts named; a .json has to parse.
  const designSystem = !lolly && deep && !pdf && !pptx && !docx && !layers
    && (PENPOT_EXT_RE.test(file.name)
      ? true
      : zipMagic || /\.zip$/i.test(file.name)
        ? zipListsDesignSystemParts(text)
        : await looksLikeTokensFile(file, text));
  // A zipped tool folder. Deep (single-file) path only, like the design-system sniff,
  // and never for a container the office/OCF readers own. A zip whose tool.json sits
  // past the head read simply doesn't get the route offered - the cost of a miss is
  // one route, and no real tool folder is 64 KB of headers deep.
  const tool = deep && !lolly && !pdf && !pptx && !docx && !layers
    && !CONTAINER_DOC_EXT_RE.test(file.name)
    && (zipMagic || /\.zip$/i.test(file.name))
    && TOOL_ZIP_HEAD_RE.test(text);
  // A plain-text document (prose/markdown/code) that no richer route claimed - it
  // ingests to the library as a type:'text' asset, so the "Add to your library" route
  // must be offered for it too, not only for media.
  const textDoc = !design && !pdf && !pptx && !layers && !archive && !lolly && !designSystem
    && (TEXT_DROP_RE.test(file.name) || /^text\//i.test(file.type));
  // A PSD/XCF often carries an image/* MIME - the layered routes own it, not
  // the plain media ones (the library route still exists, as a flatten).
  return { design, pdf, pptx, docx, media: isMediaFile(file) && !layers, c2pa, layers, archive, designSystem, lolly, textDoc, tool, data };
}

const toolExists = (id: string): boolean =>
  ((window as { __toolIndex?: { tools?: Array<{ id: string }> } }).__toolIndex?.tools ?? [])
    .some((tool) => tool.id === id);

// ── what the sheet offers, and what it says (pure) ─────────────────────────────
// Extracted from openDropChooser so the routing decisions can be pinned by a node
// test: which routes appear, which one LEADS, and which sentence names the
// destination. Everything below is a function of the sniff - no DOM, no navigation.

/** The chooser's surroundings: how many files, whether they can all be ingested
 *  as media, and which tools this build actually has. */
export interface ChooserContext {
  single: boolean;
  count: number;
  allIngestable: boolean;
  has: (toolId: string) => boolean;
}

/**
 * The routes on offer, in the order they are shown, with exactly one marked
 * `primary` (the highlighted default).
 *
 * A note on the archive route: it leads for a plain zip, because exploding it
 * into member assets is what a dropped archive usually means. It must NOT lead
 * for a zip the sniff positively identified as a design-system pack - unpacking
 * that shreds it into loose library files, which is the opposite of installing
 * it, and it is the one archive whose real destination we know (plan 97 section 14.9:
 * a door names where it lands). So the studio goes first there, and unpack
 * stays available underneath.
 */
export function dropChooserChoices(s: Sniff, ctx: ChooserContext): DialogChoice[] {
  const { single, allIngestable, has } = ctx;
  const choices: DialogChoice[] = [];
  const packZip = single && s.archive && s.designSystem;
  // A zipped tool folder: installing it is the only route that treats the zip as
  // what it is. Unpacking one scatters a template and a hooks file into the asset
  // library, so the install door leads and unpack stays underneath - the same rule
  // the design-system pack follows.
  const toolZip = single && !!s.tool;
  if (toolZip) {
    choices.push({ id: 'install-tool', label: t('Install this tool'), primary: true });
  }
  if (single && s.layers && has('darkroom')) {
    choices.push({ id: 'layers', label: t('Open as layers'), primary: true });
  }
  if (single && s.layers && has('design')) {
    choices.push({ id: 'design', label: t('Edit in Design') });
  }
  if (single && s.layers) {
    choices.push({ id: 'flatten', label: t('Add the flattened image to your library') });
  }
  if (packZip) {
    choices.push({ id: 'design-system', label: t('Use as the design system'), primary: !toolZip });
  }
  // A plain archive leads with "unpack": a dropped .zip/.tar explodes into member
  // assets, each re-imported through the normal library path. Kept above the design
  // route so a data zip isn't primarily offered to Design (where it errors).
  if (single && s.archive) {
    choices.push({ id: 'unpack', label: t('Unpack archive to your library'), primary: !packZip && !toolZip });
  }
  // A deck (.pptx) is a design document too: its slides come in as editable
  // artboards or as timed scenes, the same doors a PDF gets (Andy, 2026-09-02).
  if (single && (s.design || s.pdf || s.pptx) && has('design')) {
    choices.push({ id: 'design', label: t('Edit in Design'), primary: !s.archive });
  }
  // The Design System studio door, next to the Design one so the two
  // .penpot destinations read as a pair (plan 97 section 14.9). It leads only when no
  // earlier route already claimed the call-to-action, so nothing above it moves.
  if (single && s.designSystem && !packZip) {
    choices.push({
      id: 'design-system',
      label: t('Use as the design system'),
      primary: !choices.some((c) => c.primary),
    });
  }
  // Frames → timed scenes: the same design/PDF sniff can open in Design as a video
  // sequence, each frame a timed scene (free-canvas's scene-mode import consumes the
  // stash on mount). The other half of the section 337 "as scenes vs replace the board" choice.
  if (single && (s.design || s.pdf || s.pptx) && has('design')) {
    choices.push({ id: 'sequence', label: t('Make a video from its frames') });
  }
  // A .penpot can carry per-shape export marks; the ingest bakes them through an
  // offscreen Design render, so the route needs that tool. Whether the zip
  // really is a marked-up Penpot file resolves inside the ingest (it throws a
  // user-ready message otherwise).
  if (single && s.design && has('design')) {
    choices.push({ id: 'exports', label: t('Add its marked exports to your library') });
  }
  if (single && s.pdf) {
    choices.push({ id: 'library', label: t('Add pages to your library') });
    // A guidelines PDF is the richest design-system file most teams have - its
    // artwork carries the marks and the palette, and it embeds the real font
    // programs (plan 97 section 8's PDF source). It sits with the other "what is inside
    // this document" routes and never LEADS: a PDF's first meaning is a document,
    // and the sniff cannot tell guidelines from an invoice. The guard is
    // defensive - `sniffFile` never reports `designSystem` for a PDF, so the
    // branch above cannot have offered this door, but a door offered twice in one
    // sheet would be a worse bug than one line of belt and braces.
    if (!choices.some((c) => c.id === 'design-system')) {
      choices.push({ id: 'design-system', label: t('Use as the design system') });
    }
    if (has('compress-pdf')) choices.push({ id: 'compress', label: t('Compress this PDF') });
  }
  // An office file gives up its pictures OR its content. Both routes are offered here, in
  // ONE sheet: the deck ingest's own chooser is skipped when this one already asked
  // (ingestPptxAsSvgAssets's `chooser: false`), so no route shows two dialogs.
  if (single && s.pptx) {
    // Leads only when Design is not here to lead (a build without the tool).
    choices.push({ id: 'library', label: t('Add slides to your library'), primary: !choices.some((c) => c.primary) });
    choices.push({ id: 'extract', label: t('Extract content (Markdown)') });
  }
  // A Word document has no picture route - its content IS the file.
  if (single && s.docx) {
    choices.push({ id: 'extract', label: t('Extract content (Markdown)'), primary: true });
  }
  // A table opens in the dedicated on-device spreadsheet utility. Chart stays
  // beside it when present, but never steals an OS-level spreadsheet open.
  if (single && s.data) {
    choices.push({ id: 'spreadsheet', label: t('Open in Spreadsheet'), primary: !choices.some((c) => c.primary) });
    if (ctx.has('chart')) choices.push({ id: 'chart', label: t('Chart the data') });
  }
  if ((single && (s.media || s.textDoc) && !s.pdf && !s.pptx) || (!single && allIngestable)) {
    choices.push({ id: 'library', label: t('Add to your library'), primary: choices.length === 0 });
  }
  const unknown = single && !s.design && !s.pdf && !s.pptx && !s.media && !s.textDoc && !s.data;
  // Provenance applies to media, to anything carrying C2PA-looking bytes, to a text
  // document (the verify view reads its AI-writing signals), to unknown formats - and
  // as the last resort when no other route landed.
  if (s.media || s.c2pa || unknown || s.textDoc || choices.length === 0) {
    choices.push({ id: 'verify', label: t('Check Content Credentials') });
  }
  return choices;
}

/**
 * The sentence above the routes. The ladder is ordered by how much it tells the
 * user: "an archive" says almost nothing, so a zip the sniff can actually name
 * (a design-system pack) is named first - otherwise the file's real destination
 * never appears in the copy at all.
 */
export function dropChooserMessage(s: Sniff, name: string, ctx: ChooserContext): string {
  if (!ctx.single) return t('{n} files are ready to import.', { n: ctx.count });
  if (s.layers) return tRaw('“{name}” is a layered image (Photoshop/GIMP).', { name });
  if (s.pdf) return tRaw('“{name}” is a PDF or Illustrator document.', { name });
  if (s.pptx) return tRaw('“{name}” is a PowerPoint deck.', { name });
  if (s.docx) return tRaw('“{name}” is a Word document.', { name });
  // Two doors, so the sentence names both destinations rather than leaving
  // "design file" to stand for either of them (plan 97 section 14.9).
  if (s.designSystem && s.design && ctx.has('design')) {
    return tRaw('“{name}” can open in Design or install as the design system.', { name });
  }
  if (s.designSystem) return tRaw('“{name}” looks like a design system.', { name });
  if (s.tool) return tRaw('“{name}” looks like a Lolly tool folder.', { name });
  if (s.archive) return tRaw('“{name}” is an archive.', { name });
  if (s.data) return tRaw('“{name}” is a table of data.', { name });
  if (s.design) return tRaw('“{name}” looks like a design file.', { name });
  if (s.media) return tRaw('“{name}” is ready to import.', { name });
  return tRaw('“{name}” isn’t a format Lolly can import directly.', { name });
}

// ── the chooser sheet ──────────────────────────────────────────────────────────

/**
 * Sniff the dropped/picked file(s) and offer the applicable routes. Built on
 * choiceDialog (mountModal + .btn primitives; Escape/backdrop cancel). Multi-file
 * drops keep only the batch routes (library / verify) - the design and PDF routes
 * are single-file journeys.
 */
/** Open a dropped/shared `.lolly`: inspect its manifest, describe the operation, then
 *  route the one selected payload through its canonical verified reader. Lazy imports
 *  keep the pack/ingest code off the drop cold path. */
/** True when unzipped `.lolly` parts are a BRAND/INSTANCE pack (plans/131)
 *  rather than a saved session - same container, routed by manifest format.
 *  Pure - exported for the co-located test. */
export function isBrandPackParts(manifest: { format?: unknown } | null): boolean {
  return manifest?.format === 'lolly-brand';
}

/**
 * A brand/instance `.lolly` opened from the Open button (or dropped anywhere):
 * create a separate named design system, import into its namespace, and switch
 * to it. Existing systems remain. An instance pack additionally replaces the
 * single installed brand-workspace tool/catalog overlay and its instance base;
 * the manifest preflight states that device-wide effect before this is called.
 */
async function importBrandLollyDrop(
  file: File, files: Unzipped, host: PickerHost,
): Promise<void> {
  const bt = await import('../brand-transfer.ts');
  const { readJson } = await import('./bundle.ts');
  const manifest = readJson(files, 'manifest.json') as {
    label?: string; pack?: { publisher?: string; version?: string; instance?: string };
  } | null;
  const label = manifest?.label || file.name.replace(/\.lolly$/i, '');

  // A brand file is a NEW named design system, not a destructive synonym for
  // "overwrite whichever system happens to be active". The preview already
  // obtained explicit consent; create the destination only now, after that
  // choice, and remove it again if the verified importer refuses the bundle.
  const [{ createDesignSystem, removeDesignSystem }, { switchDesignSystem }] = await Promise.all([
    import('./design-system/manage.ts'), import('./design-system/switch.ts'),
  ]);
  const record = await createDesignSystem(host as unknown as Parameters<typeof createDesignSystem>[0], {
    label,
    source: {
      kind: 'file', fileName: file.name,
      ...(manifest?.pack?.publisher ? { publisher: manifest.pack.publisher } : {}),
      ...(manifest?.pack?.version ? { version: manifest.pack.version } : {}),
      ...(manifest?.pack?.instance ? { instance: manifest.pack.instance } : {}),
      signature: 'unsigned',
    },
  });
  try {
    const summary = await bt.importBrandPack(
      { host: host as unknown as Parameters<typeof bt.importBrandPack>[0]['host'], storage: localStorage },
      files,
      { target: { system: record.id }, activateInstance: true },
    );
    await (host as unknown as { designSystems: DesignSystemRegistry }).designSystems.put({
      ...record,
      source: {
        kind: 'file', fileName: file.name,
        ...(manifest?.pack?.publisher ? { publisher: manifest.pack.publisher } : {}),
        ...(manifest?.pack?.version ? { version: manifest.pack.version } : {}),
        ...(summary.packInstance ? { instance: summary.packInstance } : {}),
        signature: summary.packSignature ?? 'unsigned',
      },
      ...(summary.theme ? { appearance: { theme: summary.theme } } : {}),
    });
    await switchDesignSystem(host as unknown as Parameters<typeof switchDesignSystem>[0], record.id, { noRemount: true });
    playSfx('drop');
    if (summary.packInstance) {
      // The pack chose where community content comes from - that IS the
      // instance choice, so the first-run chooser must not re-ask.
      const { markInstanceChoiceMade } = await import('./instance-choice.ts');
      await markInstanceChoiceMade();
    }
    if (summary.packTools > 0) {
      const { syncCatalog } = await import('../catalog/sync.ts');
      await syncCatalog(host as unknown as Parameters<typeof syncCatalog>[0]).catch(() => { /* next boot */ });
      const it = await import('./installed-tools.ts');
      await it.mergeInstalledToolsIntoIndex().catch(() => { /* boot merge covers it */ });
      announce(tRaw('Brand switched to “{name}” - {n} tools installed.', { name: label, n: summary.packTools }));
    } else {
      announce(tRaw('Added and switched to “{name}”.', { name: label }));
    }
    // Brand intake finishes at the switcher: it shows that the previous systems
    // remain and gives a stable place to open/edit the one that just arrived.
    if (summary.contentSessions || summary.contentAssets || summary.contentToolsSkipped) announce(tRaw('Brand imported: {sessions} sessions, {assets} files. {skipped} tools were not installed.', { sessions: summary.contentSessions ?? 0, assets: summary.contentAssets ?? 0, skipped: summary.contentToolsSkipped ?? 0 }));
    const hash = '#/profile?focus=design-systems-section';
    routeToConsumer(hash, window.location.hash === hash);
  } catch (err) {
    await removeDesignSystem(host as unknown as Parameters<typeof removeDesignSystem>[0], record.id).catch(() => {});
    announce(tRaw('Could not load this brand file: {message}', { message: (err as Error).message }), { assertive: true });
  }
}

function intakeBytesLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  const mb = n / (1024 * 1024);
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

/** How many templates a share manifest declares (plans/226 section 4.7). Read off the raw
 *  manifest the streaming preview already holds, so the intake can say a file brings
 *  starting points without inflating `templates.json` to find out. */
function declaredTemplateCount(manifest: Record<string, unknown>): number {
  const block = manifest.templates;
  if (!block || typeof block !== 'object') return 0;
  const n = Number((block as { count?: unknown }).count);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function previewFacts(preview: LollyPreview): string {
  const size = intakeBytesLabel(preview.fileBytes);
  const pace = preview.sizeBand === 'large'
    ? t(' This is a large bundle; keep Lolly open while it verifies and imports it.')
    : preview.sizeBand === 'medium'
      ? t(' It may take a moment to verify on this device.')
      : '';
  if (preview.kind === 'session') {
    const templates = declaredTemplateCount(preview.manifest);
    const content = [
      preview.embeddedAssets === 1 ? t('1 embedded file') : t('{n} embedded files', { n: preview.embeddedAssets }),
      preview.referencedAssets ? (preview.referencedAssets === 1 ? t('1 external reference') : t('{n} external references', { n: preview.referencedAssets })) : null,
      preview.includesDesignSystem ? t('a design system') : null,
      preview.includesTool ? t('the tool itself') : null,
      templates === 0 ? null : templates === 1 ? t('1 template') : t('{n} templates', { n: templates }),
    ].filter(Boolean).join(' · ');
    const tool = preview.toolId ? tRaw(' for {tool}', { tool: preview.toolId }) : '';
    return tRaw('“{name}” is a {size} shared design{tool}. Opening it adds a new Project and {content}; it does not replace existing work.{pace}', {
      name: preview.label, size, tool, content, pace,
    });
  }
  const content = [
    preview.tokens ? t('tokens') : null,
    preview.fontFiles ? (preview.fontFiles === 1 ? t('1 font file') : t('{n} font files', { n: preview.fontFiles })) : null,
    preview.logos ? (preview.logos === 1 ? t('1 logo') : t('{n} logos', { n: preview.logos })) : null,
    preview.localSessions ? t('{n} saved sessions', { n: preview.localSessions }) : null,
    preview.localAssets ? t('{n} selected files', { n: preview.localAssets }) : null,
    preview.localTools ? t('{n} included tools (asked before installing)', { n: preview.localTools }) : null,
    preview.versions ? (preview.versions === 1 ? t('1 published version') : t('{n} published versions', { n: preview.versions })) : null,
  ].filter(Boolean).join(' · ') || t('design-system material');
  if (preview.kind === 'instance') {
    return tRaw('“{name}” is a {size} brand workspace: {content}, {tools} tools and {assets} catalogue assets. It is added as a design system and replaces any previously loaded brand-workspace tools and catalogue.{pace}', {
      name: preview.label, size, content, tools: preview.tools, assets: preview.catalogAssets, pace,
    });
  }
  return tRaw('“{name}” is a {size} design-system pack: {content}. It is added as a separate design system and your existing systems remain.{pace}', {
    name: preview.label, size, content, pace,
  });
}

async function storageFact(preview: LollyPreview): Promise<string> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (typeof estimate?.quota !== 'number' || typeof estimate.usage !== 'number') return '';
    const free = Math.max(0, estimate.quota - estimate.usage);
    // Session manifests declare the carried payload bytes. Brand manifests do
    // not, so their compressed size is the only honest lower-bound available.
    const needed = preview.kind === 'session'
      ? Math.max(preview.fileBytes, preview.embeddedBytes)
      : preview.fileBytes;
    if (free >= needed * 1.25) return '';
    return tRaw(' This device reports {free} free; the import needs at least about {needed}, so it may be refused without changing existing work.', {
      free: intakeBytesLabel(free), needed: intakeBytesLabel(needed),
    });
  } catch { return ''; }
}

async function importCarriedDesignSystem(
  file: File, preview: LollySessionPreview, contents: LollyFileContents, host: PickerHost,
): Promise<void> {
  if (!contents.designSystem || typeof contents.designSystem !== 'object' || Array.isArray(contents.designSystem)) {
    announce(t('This shared design does not carry a design system.'), { assertive: true });
    return;
  }
  const [{ createDesignSystem, removeDesignSystem }, { switchDesignSystem }, { installUserTokens }] = await Promise.all([
    import('./design-system/manage.ts'), import('./design-system/switch.ts'), import('../bridge/tokens.ts'),
  ]);
  const label = preview.designSystemLabel || `${preview.label} design system`;
  const record = await createDesignSystem(host as unknown as Parameters<typeof createDesignSystem>[0], {
    label,
    source: {
      kind: 'file', fileName: file.name,
      ...(preview.creator ? { publisher: preview.creator } : {}),
      signature: 'unsigned',
    },
  });
  try {
    await installUserTokens(host as unknown as Parameters<typeof installUserTokens>[0], contents.designSystem, { system: record.id, label });
    await switchDesignSystem(host as unknown as Parameters<typeof switchDesignSystem>[0], record.id, { noRemount: true });
    announce(tRaw('Added and switched to “{name}”.', { name: label }));
    const hash = '#/start';
    routeToConsumer(hash, window.location.hash === hash);
  } catch (err) {
    await removeDesignSystem(host as unknown as Parameters<typeof removeDesignSystem>[0], record.id).catch(() => {});
    throw err;
  }
}

/** What to do with a carried template whose name is already taken for that tool. */
export type TemplateCollision = 'replace' | 'keep-both' | null;

/** Asks the person about one name collision; `null` skips that template. Injected so the
 *  registration is testable headlessly - the default asks through the app's choice dialog. */
export type TemplateCollisionAsk = (incoming: UserTemplate, existing: UserTemplate) => Promise<TemplateCollision>;

const askTemplateCollision: TemplateCollisionAsk = async (incoming) => {
  const choice = await choiceDialog({
    title: t('You already have this template'),
    message: tRaw('A template called “{name}” is already saved for this tool.', { name: incoming.name }),
    choices: [
      { id: 'replace', label: t('Replace'), primary: true },
      { id: 'keep-both', label: t('Keep both') },
    ],
    tag: 'lolly-template-import',
  });
  return choice === 'replace' || choice === 'keep-both' ? choice : null;
};

/** A free name for the "Keep both" branch: "Name", then "Name 2", "Name 3"… */
function freeTemplateName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${name} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${name} ${Date.now()}`;
}

/**
 * Register the templates a `.lolly` handed over into this device's own store
 * (plans/226 section 4.7). Ids are re-minted by the store on save, so a shared template
 * is a copy, never a claim on the sender's record.
 *
 * Collisions are per (toolId, name), case-insensitively, because that pair is what the
 * chooser shows: Replace overwrites the seed and the note of the template already here
 * (keeping its id, so a "Start with" pointing at it survives), Keep both saves a sibling
 * under the next free numbered name, and a dismissed dialog skips that one template and
 * moves on. `from` is dropped - it names a template ref on the SENDER's device, which
 * would read as a false ancestry here.
 */
export async function importCarriedTemplates(
  templates: readonly UserTemplate[],
  host: UserTemplateHost,
  ask: TemplateCollisionAsk = askTemplateCollision,
): Promise<{ added: number; replaced: number; skipped: number }> {
  const out = { added: 0, replaced: 0, skipped: 0 };
  if (!templates.length) return out;
  const { createUserTemplateStore } = await import('./user-templates.ts');
  const store = createUserTemplateStore(host);
  for (const tpl of templates) {
    const mine = await store.list(tpl.toolId);
    const existing = mine.find(t => t.name.trim().toLowerCase() === tpl.name.trim().toLowerCase());
    let name = tpl.name;
    if (existing) {
      const choice = await ask(tpl, existing);
      if (!choice) { out.skipped++; continue; }
      if (choice === 'replace') {
        await store.replace(existing.id, tpl.values);
        await store.describe(existing.id, tpl.description ?? '');
        out.replaced++;
        continue;
      }
      name = freeTemplateName(tpl.name, new Set(mine.map(t => t.name.trim().toLowerCase())));
    }
    await store.save({
      toolId: tpl.toolId,
      name,
      values: tpl.values,
      ...(tpl.description ? { description: tpl.description } : {}),
      ...(tpl.designSystem ? { designSystem: tpl.designSystem } : {}),
    });
    out.added++;
  }
  return out;
}

/** The Templates collection in Projects - where a template import takes the person. */
const TEMPLATES_HASH = '#/p/__templates__';

/** Announce what was registered and offer the way to it. The session is saved either
 *  way, so this toast is about the templates only. */
async function announceTemplateImport(result: { added: number; replaced: number; skipped: number }): Promise<void> {
  const n = result.added + result.replaced;
  if (!n) return;
  const message = n === 1 ? t('1 template added') : tRaw('{n} templates added', { n });
  announce(message);
  const { showUndoToast } = await import('./undo-toast.ts');
  showUndoToast({
    message,
    actionLabel: t('Manage'),
    // The action-toast shape: `undo` is the offered action, and there is no deferred
    // commit - the templates are already saved.
    undo: () => { routeToConsumer(TEMPLATES_HASH, window.location.hash === TEMPLATES_HASH); },
  });
}

/**
 * The one `.lolly` intake used by Open, drag/drop, native document-open and the
 * contextual Design System picker. The context may recommend a capability, but
 * only the manifest decides which capabilities exist.
 */
export async function openLollyFile(
  file: File, host: PickerHost,
  opts: { preferred?: 'session' | 'design-system' } = {},
): Promise<void> {
  try {
    announce(tRaw('Inspecting {name}…', { name: file.name }));
    const intake = await import('./lolly-intake.ts');
    const preview = await intake.peekLollyFile(file);
    const storage = await storageFact(preview);
    const choices: DialogChoice[] = preview.kind === 'session'
      ? [
          { id: 'open-session', label: t('Open shared design'), primary: opts.preferred !== 'design-system' || !preview.includesDesignSystem },
          ...(preview.includesDesignSystem
            ? [{ id: 'use-design-system', label: t('Add its design system'), primary: opts.preferred === 'design-system' }] : []),
        ]
      : [{ id: 'use-brand', label: preview.kind === 'instance' ? t('Install brand workspace') : t('Add design system'), primary: true }];
    const chosen = await choiceDialog({
      title: preview.kind === 'session' ? t('Shared design')
        : preview.kind === 'instance' ? t('Brand workspace') : t('Design system'),
      message: previewFacts(preview) + storage, choices, tag: 'lolly-intake',
    });
    if (!chosen) return;
    announce(tRaw('Verifying {name}…', { name: file.name }));
    const loaded = await intake.loadLollyFile(file, preview);

    if (loaded.kind !== 'session') {
      await importBrandLollyDrop(file, loaded.files, host);
      return;
    }
    if (chosen === 'use-design-system') {
      await importCarriedDesignSystem(file, preview as LollySessionPreview, loaded.contents, host);
      return;
    }
    const lp = await import('./lolly-pack.ts');
    // A .lolly may carry the tool itself (plans/114 Wave 7). Provision it - behind a
    // "do you trust the author?" gate - BEFORE landing the session, so the session can
    // open. `available` is whether the session's tool can load here afterwards.
    const available = await provisionLollyTool(loaded.contents, lp);
    announce(loaded.contents.manifest.counts.assets
      ? t('Importing {n} files…', { n: loaded.contents.manifest.counts.assets })
      : t('Saving the shared design…'));
    const res = await lp.ingestLollyFile(loaded.contents, host as unknown as BeamPackHost, {
      onProgress: (progress) => announce(progress.phase === 'assets'
        ? t('Importing file {current} of {total}…', { current: progress.current, total: progress.total })
        : t('Saving the shared design…')),
    });
    playSfx('drop');
    // A file that carries templates was shared AS a template (lib/template-share.ts), so
    // its starting points are the point of it. Register them, then land on the Templates
    // collection rather than opening the copy of the document that came along for the
    // ride: the session is saved in Projects either way, and the person's next move here
    // is to use or manage the template, not to edit the sender's copy.
    if (loaded.contents.templates.length) {
      const result = await importCarriedTemplates(loaded.contents.templates, host);
      if (result.added + result.replaced) {
        routeToConsumer(TEMPLATES_HASH, window.location.hash === TEMPLATES_HASH);
        // The templates are already saved, so a toast that cannot render must never
        // report back as an import failure.
        await announceTemplateImport(result).catch(() => {});
        return;
      }
      // Every one was declined, so there is nothing new to show: fall through and open
      // the document that came with them, exactly as an ordinary share does.
    }
    if (available) {
      announce(tRaw('Opened {name}', { name: file.name }));
      const hash = `#/tool/${res.toolId}?slot=${encodeURIComponent(res.slot)}`;
      routeToConsumer(hash, window.location.hash === hash);
    } else {
      // The tool wasn't installed (declined / unsupported), so opening it would 404.
      // The session is saved regardless - it waits in Projects for when the tool is added.
      announce(tRaw('Saved “{name}” to your projects. Its tool isn’t installed here, so it can’t open yet.', { name: file.name }), { assertive: true });
    }
  } catch (err) {
    announce(tRaw('Could not open this .lolly file: {message}', { message: (err as Error).message }), { assertive: true });
  }
}

// Backwards-compatible private spelling for the existing drop/open call sites.
const importLollyDrop = openLollyFile;

/**
 * Provision a `.lolly`'s carried tool, if any, before its session lands. Returns whether
 * the session's tool can load here afterwards:
 *   - no carried tool → true (the session resolves its tool from the catalog, as always);
 *   - the tool is already here (catalog or installed) → true, nothing to do;
 *   - carried + not here → a "do you trust the author?" confirm (its code runs unsandboxed);
 *     Trust ⇒ install + surface it (true); Decline / unsupported (module hooks) ⇒ false.
 */
export async function provisionLollyTool(parsed: LollyFileContents, lp: typeof import('./lolly-pack.ts')): Promise<boolean> {
  const tool = lp.extractBundledTool(parsed);
  if (!tool) return true;   // travels by reference - same as before Wave 7

  const it = await import('./installed-tools.ts');
  const idx = (window as unknown as { __toolIndex?: { tools?: Array<{ id: string; _installed?: boolean }> } }).__toolIndex;
  const inCatalog = !!idx?.tools?.some(t => t.id === tool.id && t._installed !== true);
  if (inCatalog || (await it.isToolInstalled(tool.id))) return true;   // already have it

  const manifest = JSON.parse(new TextDecoder().decode(tool.files['tool.json'] ?? new Uint8Array())) as ToolManifest;
  const by = parsed.manifest.creator?.name || parsed.manifest.creator?.org;
  if (!await confirmToolTrust(manifest, by)) return false;
  return installSideloadedTool(manifest, tool.files, tool.trust, {
    ...(tool.version ? { version: tool.version } : {}),
    ...(parsed.manifest.engineVersion ? { engineVersion: parsed.manifest.engineVersion } : {}),
  });
}

/**
 * The consent gate every sideload shares: name the tool, name its author when the file
 * says who that is, and say plainly that installing it runs the tool's own code here.
 * A dropped tool zip carries no signature and no author block, so it asks with exactly
 * this wording and an empty `by` - one dialog, one sentence, whatever the source.
 */
async function confirmToolTrust(manifest: ToolManifest, by?: string): Promise<boolean> {
  const name = (manifest as { name?: string }).name || manifest.id;
  return confirmDialog({
    title: tRaw('Trust this tool?'),
    message: tRaw('This file includes a tool - “{name}”{by} - that isn’t installed here. Opening it runs the tool’s own code on your device. Only install it if you trust where this file came from.',
      { name, by: by ? tRaw(' by {who}', { who: by }) : '' }),
    confirmLabel: tRaw('Trust & install'),
    danger: true,
  });
}

/** Write an already-consented-to tool into the device-local install store and surface it
 *  in the tool index. Returns whether it is now installed; a refusal (module hooks, no
 *  Cache Storage) is announced with its own message, never thrown. */
async function installSideloadedTool(
  manifest: ToolManifest,
  files: Record<string, Uint8Array>,
  trust: InstalledToolTrust,
  extra: { version?: string; engineVersion?: string } = {},
): Promise<boolean> {
  const it = await import('./installed-tools.ts');
  try {
    await it.installTool({ manifest, files, trust, ...extra });
    await it.mergeInstalledToolsIntoIndex();
    return true;
  } catch (err) {
    const msg = err instanceof it.UnsupportedToolError
      ? err.message
      : tRaw('Could not install the tool: {message}', { message: (err as Error).message });
    announce(msg, { assertive: true });
    return false;
  }
}

// ── a zipped tool folder (the drive-by author's loop) ─────────────────────────

/** A tool folder read out of a dropped zip: the parsed manifest plus every file keyed
 *  tool-dir-relative, exactly the shape `installTool` (and the loader) expect. */
export interface ToolZipContents {
  manifest: ToolManifest;
  files: Record<string, Uint8Array>;
}

/**
 * The tool-dir prefix inside a dropped zip: `''` when `tool.json` sits at the archive
 * root, `'<folder>/'` when the archive holds exactly ONE top-level folder and the
 * manifest is inside it (what every OS produces from "compress this folder"), and null
 * when neither - two top-level folders is ambiguous, and no tool.json is not a tool.
 * Pure; `names` must already have the OS junk filtered out, or a macOS zip's `__MACOSX`
 * tree reads as a second top-level folder.
 */
export function toolZipRoot(names: string[]): string | null {
  if (names.includes('tool.json')) return '';
  const tops = new Set(names.map((n) => n.split('/')[0]!));
  if (tops.size !== 1) return null;
  const top = [...tops][0]!;
  return names.includes(`${top}/tool.json`) ? `${top}/` : null;
}

/**
 * Read a dropped `.zip` of a tool folder, refusing anything the running engine would
 * refuse anyway. `unzipAsync`'s guard rejects a bomb before a single entry inflates
 * (its default caps are already the strictest policy in the shell, and a tool folder is
 * kilobytes). Then the two gates `loadTool` applies, in ITS order and with its wording:
 * the engine-compatibility floor first, because a tool built for a newer engine usually
 * also carries manifest vocabulary this build's schema has never heard of, and the
 * schema error would read as a broken tool rather than an engine it needs.
 *
 * Every refusal throws a user-ready Error. Exported for the co-located test.
 */
export async function readToolZip(bytes: Uint8Array): Promise<ToolZipContents> {
  const [{ unzipAsync }, { isIgnoredUploadName }, { safeToolRelPath }] = await Promise.all([
    import('./zip.ts'), import('./archive-ingest.ts'), import('./installed-tools.ts'),
  ]);
  const entries = await unzipAsync(bytes);
  const names = Object.keys(entries).filter((n) => !n.endsWith('/') && !isIgnoredUploadName(n));
  // `safeToolRelPath` SILENTLY rewrites an absolute path and drops a traversing one,
  // which is right for bytes a `.lolly`'s integrity map already vouched for. A zip off
  // the internet gets no such benefit of the doubt: refuse the archive whole.
  for (const n of names) {
    if (n.startsWith('/') || /^[a-z]:/i.test(n) || n.split(/[\\/]/).includes('..')) {
      throw new Error(`This zip has an unsafe file path (${n}).`);
    }
  }
  const root = toolZipRoot(names);
  if (root === null) {
    throw new Error('This zip isn’t a tool folder. It needs a tool.json at the top level, or inside a single folder.');
  }
  const files: Record<string, Uint8Array> = {};
  for (const n of names) {
    if (!n.startsWith(root)) continue;   // a sibling of the tool folder, not part of it
    const rel = safeToolRelPath(n.slice(root.length));
    if (rel) files[rel] = entries[n]!;
  }
  let manifest: ToolManifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(files['tool.json']!)) as ToolManifest;
  } catch (err) {
    throw new Error(`This tool’s tool.json isn’t valid JSON: ${(err as Error).message}`);
  }
  const { validateManifest, satisfiesRange, ENGINE_VERSION } = await import('@lolly/engine');
  const id = typeof manifest?.id === 'string' ? manifest.id : 'tool';
  const range = typeof (manifest as { engineVersion?: unknown })?.engineVersion === 'string'
    ? manifest.engineVersion : null;
  if (range !== null && !satisfiesRange(ENGINE_VERSION, range)) {
    throw new Error(`"${id}" requires engine ${range}, but this build implements ${ENGINE_VERSION} - refusing to load`);
  }
  const { valid, errors } = validateManifest(manifest);
  if (!valid) {
    throw new Error(`Manifest for "${id}" failed validation: ${errors.slice(0, 3).map((e) => `${e.path} ${e.message}`).join('; ')}`);
  }
  return { manifest, files };
}

/**
 * The "Install this tool" route: a zipped tool folder becomes an installed tool on THIS
 * device and opens. Nothing is uploaded - the zip is read in the page, and the files go
 * to the same device-local store a `.lolly`'s carried tool uses, through the same
 * consent gate and the same installer.
 *
 * A reinstall (the author's edit-zip-drop loop) asks to replace instead of asking to
 * trust: they accepted that dialog for this tool id already, and two dialogs in a row
 * where the second says the tool "isn't installed here" would be false as well as slow.
 */
async function installToolZipDrop(file: File): Promise<void> {
  let parsed: ToolZipContents;
  try {
    parsed = await readToolZip(new Uint8Array(await file.arrayBuffer()));
  } catch (err) {
    announce(tRaw('Could not install this tool: {message}', { message: (err as Error).message }), { assertive: true });
    return;
  }
  const { manifest } = parsed;
  const id = manifest.id;
  const it = await import('./installed-tools.ts');
  const idx = (window as unknown as { __toolIndex?: { tools?: Array<{ id: string; _installed?: boolean }> } }).__toolIndex;
  if (idx?.tools?.some((t) => t.id === id && t._installed !== true)) {
    // mergeInstalledEntries lets the catalog copy win on a shared id, so installing this
    // one would leave no trace anywhere. Say that, rather than appear to do nothing.
    announce(tRaw('“{id}” is already a catalogue tool here, and an installed tool never replaces one. Give yours its own id.', { id }), { assertive: true });
    return;
  }
  if (await it.isToolInstalled(id)) {
    const ok = await confirmDialog({
      title: t('Replace the installed copy?'),
      message: tRaw('“{id}” is already installed on this device. Installing this zip replaces it, and runs the new code.', { id }),
      confirmLabel: t('Replace'),
      danger: true,
    });
    if (!ok) return;
  } else if (!await confirmToolTrust(manifest)) {
    return;
  }
  const engineVersion = (manifest as { engineVersion?: string }).engineVersion;
  if (!await installSideloadedTool(manifest, parsed.files, 'custom', {
    ...(manifest.version ? { version: manifest.version } : {}),
    ...(engineVersion ? { engineVersion } : {}),
  })) return;
  playSfx('drop');
  announce(tRaw('Installed “{name}”.', { name: (manifest as { name?: string }).name || id }));
  routeToConsumer(`#/tool/${id}`, onToolRoute(id));
}

/** Hooks a view can hang on the chooser (plans/133 WP-6): `onStored` receives the
 *  ids of every asset the library routes stored, so the Projects view can file a
 *  drop into the folder the user is looking at. */
export interface DropChooserHooks {
  onStored?: (ids: string[]) => void;
}

export async function openDropChooser(
  files: File[],
  host: PickerHost,
  opts: { superseded?: () => boolean; source?: 'drop' | 'share-target' } & DropChooserHooks = {},
): Promise<void> {
  if (!files.length) return;
  const picker = await import('../views/picker.ts');
  const single = files.length === 1;
  const first = files[0]!;
  const s = await sniffFile(first, single, picker);
  // A newer share superseded this one while the picker chunk / head read was in
  // flight - don't mount a stale chooser next to (or after) the replacement's.
  if (opts.superseded?.()) return;

  // `.lolly` is a container family, so it owns a manifest-first preflight of its
  // own: session, design system and instance pack have different consequences.
  if (s.lolly) { await importLollyDrop(first, host); return; }
  const allIngestable = files.every(
    (f) => isMediaFile(f) || picker.isPdfUpload(f) || picker.isPptxUpload(f)
      || TEXT_DROP_RE.test(f.name) || /^text\//i.test(f.type),
  );

  const ctx: ChooserContext = { single, count: files.length, allIngestable, has: toolExists };
  const choices = dropChooserChoices(s, ctx);
  const message = dropChooserMessage(s, first.name, ctx);

  const chosen = await choiceDialog({
    title: single ? t('What should Lolly do with this file?') : t('What should Lolly do with these files?'),
    message,
    choices,
    // Scopes closeConfirmDialogs so a rapid next drop/share only supersedes a
    // still-open chooser of THIS kind - never an unrelated confirm/prompt dialog
    // open elsewhere in the app (see initShareTargetIngest's poll()).
    tag: 'drop-chooser',
  });
  if (!chosen) return;

  switch (chosen) {
    case 'layers': {
      // Parse + store per-layer assets BEFORE navigating (the dialog for
      // flat-vs-grouped lives inside), then arm the seed and go.
      try {
        const { importLayeredFileAsSeed } = await import('../views/psd-import.ts');
        const seed = await importLayeredFileAsSeed(host, first, {
          warn: (m: string) => announce(m, { assertive: true }),
        });
        if (!seed) break; // user cancelled the flat/grouped dialog
        setPendingToolSeed('darkroom', seed);
        playSfx('drop');
        routeToConsumer('#/tool/darkroom', onToolRoute('darkroom'));
      } catch (err) {
        announce(tRaw('Import failed: {message}', { message: (err as Error).message }), { assertive: true });
      }
      break;
    }
    case 'flatten': {
      try {
        const { ingestLayeredFileFlattened } = await import('../views/psd-import.ts');
        await ingestLayeredFileFlattened(host, first);
        playSfx('drop');
        announce(t('Added 1 file to your library.'));
      } catch (err) {
        announce(tRaw('Upload failed: {message}', { message: (err as Error).message }), { assertive: true });
      }
      break;
    }
    case 'design':
      pendingDesign = { file: first, scenes: false };
      routeToConsumer('#/tool/design', onToolRoute('design'));
      break;
    case 'sequence':
      // "Make a video from its frames" - the same design opens in Design, but each
      // frame becomes a timed scene (plans/104 section 337; Sequence Studio's old home for
      // this route retired into Design).
      pendingDesign = { file: first, scenes: true };
      routeToConsumer('#/tool/design', onToolRoute('design'));
      break;
    case 'design-system':
      // The studio's own import flow owns the parsing - colours, fonts, logos,
      // the semantic-mapping review and the PDF scan all live there - so this
      // route hands over the FILE and names the source it needs. views/start.ts
      // consumes the stash on mount (takePendingDesignSystemFile) and opens the
      // stage that file wants; the `?source=` is what it falls back to if the
      // stash has already been spent.
      pendingDesignSystemFile = first;
      routeToConsumer(
        s.pdf ? '#/start?source=pdf' : '#/start?source=file',
        /^#\/start([?/]|$)/.test(window.location.hash),
      );
      break;
    case 'compress':
      pendingToolFile = { toolId: 'compress-pdf', file: first };
      routeToConsumer('#/tool/compress-pdf', onToolRoute('compress-pdf'));
      break;
    case 'spreadsheet':
      pendingSpreadsheetFile = first;
      routeToConsumer('#/data', /^#\/data([?/]|$)/.test(window.location.hash));
      break;
    case 'chart': {
      // Rows → Chart's data field (a longtext taking CSV/TSV): the decode is the
      // field's own data-source one (xlsx → CSV, a sheet picker when there is more
      // than one sheet), then the one-shot seed the tool view folds into its
      // initial values on mount. Cancelling the sheet picker cancels the route.
      if (first.size > DATA_MAX_BYTES) {
        announce(t('That file is too big to chart - the limit is 8 MB.'), { assertive: true });
        break;
      }
      const { bytesToFieldTextInteractive } = await import('./data-source.ts');
      const text = await bytesToFieldTextInteractive(new Uint8Array(await first.arrayBuffer()), first.name, announce);
      if (text == null) break;
      setPendingToolSeed('chart', { data: text });
      routeToConsumer('#/tool/chart', onToolRoute('chart'));
      break;
    }
    case 'verify':
      setPendingVerify({ files });
      routeToConsumer('#/verify', /^#\/(verify|valid|v)([?/]|$)/.test(window.location.hash));
      break;
    case 'library':
      await ingestToLibrary(files, host, picker, opts.onStored, opts.source);
      break;
    case 'extract':
      await extractOfficeMarkdown(first, host);
      break;
    case 'unpack': {
      // Explode the archive to its members, then feed them through the SAME library
      // ingest as any multi-file drop. readArchiveMembers refuses an office/OCF
      // package (never shreds a .xlsx) and enforces the member/byte caps.
      try {
        const { readArchiveMembers } = await import('./archive-ingest.ts');
        const bytes = new Uint8Array(await first.arrayBuffer());
        const members = readArchiveMembers(bytes, first.name);
        const memberFiles = members.map(
          (m) => new File([m.bytes as BlobPart], m.name.split('/').pop() || m.name),
        );
        await ingestToLibrary(memberFiles, host, picker, opts.onStored, opts.source);
      } catch (err) {
        announce(tRaw('Upload failed: {message}', { message: (err as Error).message }), { assertive: true });
      }
      break;
    }
    case 'exports':
      await ingestExportsToLibrary(first, host);
      break;
    case 'install-tool':
      await installToolZipDrop(first);
      break;
  }
}

// ── routing that survives the shell's same-route dedup ────────────────────────

/** True when the CURRENT location is already inside tool `id` - either routing
 *  form (the #/tool/<id> hash, or the canonical /t/<id> path the tool view's
 *  syncUrl rewrites the address bar to). Tool ids are [a-z0-9-], regex-safe. */
const onToolRoute = (id: string): boolean =>
  new RegExp(`^#/tool/${id}([?/]|$)`).test(window.location.hash)
  || new RegExp(`^/t/${id}([?/]|$)`).test(window.location.pathname);

/** Navigate to `hash`. Every stash this router arms is consumed at MOUNT time
 *  (free-canvas / views/tool.ts / valid.ts), but main.ts's navigate() dedupes a
 *  hash change resolving to the already-mounted route - and a share can arrive
 *  while the user is ALREADY inside the destination view. In that case ask the
 *  shell for a forced remount via its 'lolly:remount' seam so the stash is
 *  still consumed; plain drops (gallery/dashboard only) never hit it. */
function routeToConsumer(hash: string, alreadyThere: boolean): void {
  if (window.location.hash !== hash) window.location.hash = hash;
  if (alreadyThere) window.dispatchEvent(new Event('lolly:remount'));
}

/**
 * The library route - the same sequential ingest loop as lib/upload-dropzone.ts:
 * PDFs/decks convert page(s)/slide(s) to SVG assets via their lazy chunks,
 * everything else stores through storeUserUpload (downscale/sanitise/credential-
 * preserve). Sequential on purpose: parallel decodes of a big drop spike memory.
 */
async function ingestToLibrary(files: File[], host: PickerHost, picker: PickerModule, onStored?: (ids: string[]) => void, source?: string): Promise<void> {
  // Drop a folder extracted from a macOS zip and its `._` AppleDouble stubs / .DS_Store
  // arrive as ordinary File drops; skip them so they never become blank "BIN" assets.
  // (The 'unpack' path's members are already filtered in readArchiveMembers; this also
  // covers the direct 'library' multi-file drop.)
  const { isIgnoredUploadName } = await import('./archive-ingest.ts');
  files = files.filter((f) => !isIgnoredUploadName(f.name));
  const ids: string[] = [];
  for (const file of files) {
    try {
      if (picker.isPdfUpload(file)) {
        const { ingestPdfAsSvgAssets } = await import('../views/pdf-import.ts');
        ids.push(...(await ingestPdfAsSvgAssets(host, file, {
          mode: 'multi',
          warn: (m: string) => announce(m, { assertive: true }),
        })).map(r => r.id));
      } else if (picker.isPptxUpload(file)) {
        const { ingestPptxAsSvgAssets } = await import('../views/pptx-import.ts');
        ids.push(...(await ingestPptxAsSvgAssets(host, file, {
          mode: 'multi',
          // The chooser above already asked slides-vs-content, so the deck ingest
          // must not ask again (one dialog per drop).
          chooser: false,
          warn: (m: string) => announce(m, { assertive: true }),
        })).map(r => r.id));
      } else {
        ids.push((await picker.storeUserUpload(host, file, { sourceHint: source ?? 'drop' })).id);
      }
    } catch (err) {
      // Cap/quota errors carry a user-ready message; prefix only the rest.
      announce(
        (err as { code?: unknown }).code
          ? (err as Error).message
          : tRaw('Upload failed: {message}', { message: (err as Error).message }),
        { assertive: true },
      );
    }
  }
  const stored = ids.length;
  if (!stored) return;
  playSfx('drop');
  announce(stored === 1
    ? t('Added 1 file to your library.')
    : t('Added {n} files to your library.', { n: stored }));
  onStored?.(ids);
}

/**
 * The extract route - a .pptx or .docx hands over its CONTENT: a `.md`, or a zip of
 * the markdown plus its `media/` files when the document carried images. Identical
 * bytes to what #/convert and the deck ingest produce for the same file (all three
 * call office-text's extractor), which loads lazily here - it pulls fflate and the
 * engine readers.
 */
async function extractOfficeMarkdown(file: File, host: PickerHost): Promise<void> {
  try {
    const { officeToMarkdown, markdownDownload } = await import('./office-text.ts');
    const content = await officeToMarkdown(new Uint8Array(await file.arrayBuffer()), file.name);
    const base = file.name.replace(/\.(pptx|docx)$/i, '').trim() || 'document';
    await host.export.download(
      markdownDownload(content, `${base}.md`),
      `${base}.${content.media.length ? 'zip' : 'md'}`,
    );
    playSfx('drop');
  } catch (err) {
    announce(tRaw('Upload failed: {message}', { message: (err as Error).message }), { assertive: true });
  }
}

// The exports route - every shape marked for export in Penpot becomes stored
// library assets at its marked formats and scales. The heavy design-import chunk
// loads lazily, same as the PDF/deck routes above.
async function ingestExportsToLibrary(file: File, host: PickerHost): Promise<void> {
  try {
    const { ingestPenpotExportsAsAssets } = await import('../views/design-import.ts');
    const refs = await ingestPenpotExportsAsAssets(
      host as unknown as Parameters<typeof ingestPenpotExportsAsAssets>[0],
      file,
      { warn: (m: string) => announce(m, { assertive: true }) },
    );
    if (!refs.length) return;
    playSfx('drop');
    announce(refs.length === 1
      ? t('Added 1 export to your library.')
      : t('Added {n} exports to your library.', { n: refs.length }));
  } catch (err) {
    announce(
      (err as { code?: unknown }).code
        ? (err as Error).message
        : tRaw('Upload failed: {message}', { message: (err as Error).message }),
      { assertive: true },
    );
  }
}

// ── scoped drag-and-drop attachment ────────────────────────────────────────────

// One live attachment per root: same-route re-mounts (the gallery re-mounts
// after a catalog sync) replace theirs instead of stacking listeners.
const ATTACHED = new WeakMap<HTMLElement, () => void>();

/**
 * Attach the drop router to a view root. Only file drags are handled (text/image
 * drags keep their browser defaults untouched); while one hovers, the root gains
 * `.is-file-drag` and a small hint pill (styled by the view's own stylesheet).
 * The shell reuses one #view element across routes, so the attachment tears
 * itself down on any navigation - a tool view can never inherit it. Returns the
 * teardown for callers that want it earlier.
 */
export function attachDropRouter(rootEl: HTMLElement, host: PickerHost, hooks: DropChooserHooks = {}): () => void {
  ATTACHED.get(rootEl)?.();
  const ac = new AbortController();
  const { signal } = ac;
  let depth = 0;
  let hint: HTMLElement | null = null;

  const isFileDrag = (e: DragEvent): boolean => !!e.dataTransfer?.types?.includes('Files');
  const showHint = (on: boolean): void => {
    if (on) {
      if (!hint) {
        hint = document.createElement('div');
        hint.className = 'drop-hint';
        hint.setAttribute('aria-hidden', 'true');
        hint.textContent = t('Drop to import');
      }
      // (Re-)append: a same-route innerHTML repaint may have orphaned the pill.
      if (!hint.isConnected) rootEl.appendChild(hint);
    } else {
      depth = 0;
    }
    rootEl.classList.toggle('is-file-drag', on);
  };

  rootEl.addEventListener('dragenter', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    depth++;
    showHint(true);
  }, { signal });
  rootEl.addEventListener('dragover', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault(); // required, or the drop never fires
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }, { signal });
  rootEl.addEventListener('dragleave', (e) => {
    if (!isFileDrag(e)) return;
    // A depth counter tracks enter/leave across child nodes so the hint
    // doesn't flicker as the pointer crosses them.
    if (--depth <= 0) showHint(false);
  }, { signal });
  rootEl.addEventListener('drop', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    showHint(false);
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length) void openDropChooser(files, host, hooks);
  }, { signal });

  const teardown = (): void => {
    ac.abort();
    hint?.remove();
    rootEl.classList.remove('is-file-drag');
    NAV_EVENTS.forEach((ev) => window.removeEventListener(ev, teardown));
    if (ATTACHED.get(rootEl) === teardown) ATTACHED.delete(rootEl);
  };
  NAV_EVENTS.forEach((ev) => window.addEventListener(ev, teardown));
  ATTACHED.set(rootEl, teardown);
  return teardown;
}

/**
 * No-drag fallback (the welcome dialog's "Bring your design" tile): a native
 * file picker that feeds the same chooser. The input is parked on <body> and
 * removed on change/cancel.
 */
export function openDropFilePicker(host: PickerHost): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = UNIVERSAL_ACCEPT;
  input.style.display = 'none';
  document.body.appendChild(input);
  const done = (): void => input.remove();
  input.addEventListener('change', () => {
    const files = [...(input.files ?? [])];
    done();
    if (files.length) void openDropChooser(files, host);
  });
  input.addEventListener('cancel', done);
  input.click();
}

// ── Android share-target ingest (ACTION_SEND → the same chooser) ──────────────

/** The share-target half of the `LollyShare` JS interface the Android shell's
 *  MainActivity registers (the same object carries the export share-OUT verb
 *  shareFile used by tauri-mobile's export override - hence the per-verb
 *  feature-detect in initShareTargetIngest, not a bare `window.LollyShare`
 *  check). Poll returns a JSON stash descriptor, or '' when nothing pends. */
interface LollyShareBridge {
  sharedFilePoll(): string;
  sharedFileChunk(i: number): string;
  sharedFileConsumed(): void;
}

/**
 * Decode the Android bridge's base64 chunks (1 MiB of raw bytes each) into one
 * contiguous buffer. `read` is injected so chunks stream straight off the JS
 * interface without first materialising a string[]. Whitespace is stripped
 * before decode (android.util.Base64.DEFAULT wraps lines; browsers' forgiving
 * base64 tolerates that, Node's atob historically didn't). Pure - exported for
 * the co-located test.
 */
export function assembleShareChunks(count: number, read: (i: number) => string): Uint8Array<ArrayBuffer> {
  const parts: Uint8Array[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const bin = atob(read(i).replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
    parts.push(bytes);
    total += bytes.length;
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

/**
 * Android share-target ingest: MainActivity stashes an ACTION_SEND stream and
 * exposes it over `LollyShare`; a share arriving while the WebView is alive
 * also dispatches 'lolly-share-target' on window. Feature-detected on the poll
 * verb, so everywhere except the Android app this is a cheap no-op. A pending
 * share runs through the exact chooser a dropped file gets - the sheet is
 * body-mounted (mountModal) and every route is a hash navigation (or a forced
 * remount, see routeToConsumer), so it works from whichever view the share
 * lands on. Rapid successive shares: latest wins - a still-open chooser from
 * the previous share is dismissed (closeConfirmDialogs, scoped to the
 * 'drop-chooser' tag every openDropChooser sheet carries, so an unrelated
 * confirm/prompt dialog open elsewhere in the app is never swept up in it) or,
 * if its sniff is still in flight, superseded before it mounts; choosers are
 * never queued.
 * Call once at boot, after the first view has mounted (main.ts).
 */
export function initShareTargetIngest(host: PickerHost): void {
  const bridge = (window as unknown as { LollyShare?: Partial<LollyShareBridge> }).LollyShare;
  if (typeof bridge?.sharedFilePoll !== 'function'
    || typeof bridge.sharedFileChunk !== 'function'
    || typeof bridge.sharedFileConsumed !== 'function') return;
  const share = bridge as LollyShareBridge;
  let seq = 0;
  const poll = (): void => {
    const raw = share.sharedFilePoll();
    if (!raw) return;
    let file: File | null = null;
    try {
      const meta = JSON.parse(raw) as { name?: string; mime?: string; chunks?: number };
      const bytes = assembleShareChunks(meta.chunks ?? 0, (i) => share.sharedFileChunk(i));
      file = new File([bytes], meta.name || 'shared-file', { type: meta.mime || '' });
    } catch { /* malformed stash - still consumed below so it can't wedge future polls */ }
    share.sharedFileConsumed();
    if (!file) return;
    const mine = ++seq;
    closeConfirmDialogs('drop-chooser');
    void openDropChooser([file], host, { superseded: () => mine !== seq, source: 'share-target' });
  };
  window.addEventListener('lolly-share-target', poll);
  poll(); // cold start: the launching intent was stashed before this JS booted
}

// ── installed-PWA handoffs (share target, protocol handler) ───────────────────

/** The service worker's share-target inbox (public/sw.js SHARE_CACHE - keep the
 *  two literals in sync) and the header it stamps each parked file's name into. */
const SHARE_CACHE = 'lolly-share-inbox';
const SHARE_NAME_HEADER = 'x-lolly-share-name';

/**
 * Read one query param off the launch URL and strip it from the address bar.
 * The installed-app handoffs can only speak through that URL (a share target
 * POSTs and the worker redirects; a protocol handler opens `/?deep-link=…`), and
 * a param left in place would re-fire on reload and ride along in every copied
 * link. Returns null when the param is not there.
 */
function takeLaunchParam(name: string): string | null {
  const search = window.location.search;
  if (!search) return null;
  const params = new URLSearchParams(search);
  const value = params.get(name);
  if (value === null) return null;
  params.delete(name);
  const rest = params.toString();
  try {
    window.history.replaceState(
      window.history.state, '',
      `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`,
    );
  } catch { /* the param stays in the bar; the handoff itself already happened */ }
  return value;
}

/**
 * The web share-target intake: an OS share sheet posted files to this installed
 * app, the service worker parked them in SHARE_CACHE and redirected here (see
 * public/sw.js receiveShare). Drain the stash, rebuild each File from its parked
 * response, and open the SAME chooser a dropped file gets.
 *
 * Drains unconditionally rather than only when the redirect's param is there: a
 * browser is free to reshape that redirect, and a share sitting unclaimed in the
 * bucket is the user's file gone missing. The stash is emptied as it is read, so
 * a boot with nothing shared costs one cache open and stops.
 *
 * Call once at boot, after the first view has mounted (main.ts) - the same
 * placement, and for the same reason, as initShareTargetIngest.
 */
export async function initShareTargetFileIntake(host: PickerHost): Promise<void> {
  takeLaunchParam('share-target');
  if (typeof caches === 'undefined') return;
  const files: File[] = [];
  try {
    const cache = await caches.open(SHARE_CACHE);
    for (const key of await cache.keys()) {
      const held = await cache.match(key);
      await cache.delete(key);
      if (!held) continue;
      const raw = held.headers.get(SHARE_NAME_HEADER) ?? '';
      let name = 'shared-file';
      try { name = decodeURIComponent(raw) || name; } catch { name = raw || name; }
      files.push(new File([await held.blob()], name, { type: held.headers.get('content-type') ?? '' }));
    }
  } catch { return; /* no Cache Storage, or a partial read - nothing to hand over */ }
  if (!files.length) return;
  closeConfirmDialogs('drop-chooser');
  await openDropChooser(files, host, { source: 'share-target' });
}

/** The App-Link half of the `LollyShare` interface (plan 171): MainActivity
 *  stashes a tapped ACTION_VIEW link, consumed on read. */
interface LollyLinkBridge {
  pendingDeepLink(): string;
}

/** Route one OS-delivered link. An https lolly.tools link (Android App Links)
 *  re-mounts exactly what the browser would have shown - the SPA router owns the
 *  path+query+hash grammar, packed z/zx links included. A lolly:// link goes
 *  through the shared scheme mapper and is refused, with a warn, when it names no
 *  route the app owns. */
export function routeDeliveredLink(raw: string): void {
  // `web+lolly:` is the same link in the spelling a browser gives an installed
  // PWA (manifest protocol_handlers); deepLinkToHash reads both.
  if (/^(?:web\+)?lolly:/i.test(raw)) {
    const hash = deepLinkToHash(raw);
    if (hash) routeToConsumer(hash, window.location.hash === hash);
    else console.warn('[deep-link] ignoring malformed lolly:// link', raw);
    return;
  }
  let u: URL;
  try { u = new URL(raw); } catch { return; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return;
  void import('../nav.ts').then((m) => m.navigateTo(u.pathname + u.search + u.hash));
}

const MOBILE_LINK_POLL_MS = 1200;
const MAX_MOBILE_OPEN_BYTES = 48 * 1024 * 1024;

interface MobileOpenedFile {
  name?: unknown;
  mime?: unknown;
  bytes?: unknown;
}

function mobileOpenedFile(raw: unknown): File | null {
  if (!raw || typeof raw !== 'object') return null;
  const opened = raw as MobileOpenedFile;
  const name = typeof opened.name === 'string' && opened.name ? opened.name : 'shared.lolly';
  const mime = typeof opened.mime === 'string' ? opened.mime : '';
  const bytes = opened.bytes;
  if (!Array.isArray(bytes) && !(bytes instanceof Uint8Array)) return null;
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as number[]);
  if (u8.length === 0 || u8.length > MAX_MOBILE_OPEN_BYTES) return null;
  return new File([u8 as BlobPart], name, { type: mime });
}

/**
 * Deep-link and document-open intake for the native shells. Android: a tapped
 * https://lolly.tools/t/… (or /design) App Link or lolly:// link is stashed by
 * MainActivity on the LollyShare bridge; an ACTION_VIEW .lolly document uses that
 * bridge's existing shared-file slot and is handled by initShareTargetIngest.
 * iOS: the Rust side queues links and captures an opened document's bounded bytes
 * while its file URL is live. This drains that queue on the desktop poll loop's
 * cadence and sends the file through the exact chooser a drop uses. It retires on
 * the first "no such command" rejection - the desktop shell carries the Tauri
 * internals too, but has its own queue (linux-desktop-boot.ts), so one rejection
 * says this whole surface is absent. Feature-detected throughout, so a no-op in
 * the browser. Call once at boot (main.ts).
 *
 * The browser has a fourth source: an installed PWA registers `web+lolly:`
 * (manifest protocol_handlers - a web app may only claim a `web+` scheme) and the
 * launch arrives as `/?deep-link=web+lolly://…`. That is read first, before any
 * native bridge check, because it is the one source a plain browser tab can have.
 */
export function initDeepLinkIntake(host: PickerHost): void {
  const handed = takeLaunchParam('deep-link');
  if (handed) routeDeliveredLink(handed);
  const bridge = (window as unknown as { LollyShare?: Partial<LollyLinkBridge> }).LollyShare;
  if (typeof bridge?.pendingDeepLink === 'function') {
    const link = bridge as LollyLinkBridge;
    const poll = (): void => {
      const raw = link.pendingDeepLink();
      if (raw) routeDeliveredLink(raw);
    };
    window.addEventListener('lolly-deep-link', poll);
    poll(); // cold start: the launching intent was stashed before this JS booted
    return;
  }
  const invoke = tauriInvoke();
  if (!invoke) return;
  let handle = 0;
  let draining = false;
  const tick = (): void => {
    if (draining) return;
    draining = true;
    void invoke('mobile_poll_events')
      .then(async (raw) => {
        if (!Array.isArray(raw)) return;
        for (const e of raw as Array<{ kind?: unknown; value?: unknown }>) {
          if (e?.kind === 'deepLink' && typeof e.value === 'string') routeDeliveredLink(e.value);
          if (e?.kind === 'openFileError' && typeof e.value === 'string') {
            announce(tRaw('Could not read “{name}”, or it exceeds the 48 MB mobile document-open limit. Try Open inside Lolly for a larger file.', { name: e.value }), { assertive: true });
          }
          if (e?.kind === 'openFile' && typeof e.value === 'string' && /^\d+$/.test(e.value)) {
            const file = mobileOpenedFile(await invoke('mobile_take_open_file', { token: e.value }));
            if (!file) continue;
            closeConfirmDialogs('drop-chooser');
            await openDropChooser([file], host, { source: 'share-target' });
          }
        }
      })
      .catch((e: unknown) => {
        if (/mobile_poll_events/.test(String((e as Error)?.message ?? e))) window.clearInterval(handle);
      })
      .finally(() => { draining = false; });
  };
  handle = window.setInterval(tick, MOBILE_LINK_POLL_MS);
  tick();
}
