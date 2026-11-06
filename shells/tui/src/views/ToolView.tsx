// SPDX-License-Identifier: MPL-2.0
/**
 * Tool view - a full-screen HARD-PANEL dashboard (web UI's sidebar + cards): an
 * "Inputs" panel beside an "Export settings" panel and a "Preview" panel. TAB moves
 * focus between the Inputs and Export panels; the focused panel is highlighted and
 * takes j/k + edit. Every panel has an explicit width/height so nothing shakes.
 *
 * Export settings (edit like inputs): format · width · height · unit · filename ·
 * folder - the same knobs as the web export dialog. Keys: Tab switch panel · j/k move ·
 * Enter/e edit · ←/→ cycle (format/unit/select) · space toggle boolean · x export ·
 * s save project · p preview · esc back.
 *
 * A `blocks` input is enterable: select it → Enter drills into a ROW list (j/k moves
 * rows, a adds, d deletes, [ ] reorders, one level of nesting with < >) → Enter on a
 * row drills into its FIELDS (edit text/number/color, toggle booleans, ←/→ cycles
 * selects) → esc backs out a level. The whole block array is written back via
 * runtime.setInput per row/field edit (see setField/addRow). This also makes an
 * editor-layout tool's box TEXT editable (its `boxes` blocks input carries `text`).
 * All rendered inside the SAME fixed-size Inputs panel, so nothing shakes.
 *
 * A `table` input (engine 1.78 - battlecards, any spreadsheet-shaped tool) is enterable
 * the same way, but as a real GRID rather than a field list: Enter drills into the cells
 * (h/j/k/l or arrows move, row -1 is the heading row), Enter/e edits a cell, a/A add a
 * row/column, d/D delete one, i imports a CSV/TSV/Markdown file (the engine's
 * parseTableText, the same importer `--<id>-data=table.csv` uses in the CLI).
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { MultilineInput } from '../components/MultilineInput.tsx';
import { join, basename, dirname, extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { isToolUrl, parseDataRows, parseTableText, c2paDefaultOn, imprintDefaultOn, isImprintFormat, isImprintContainerFormat, designRecordWords } from '@lolly/engine';
import type { ProvenanceManifest } from '@lolly/engine';
import { loadAssets } from '../catalog.ts';
import type { AssetRow } from '../catalog.ts';
import { filterAssets, assetEmoji, assetDetail } from '../lib/asset-list.ts';
import { loadFavourites, loadHidden, sortFavouritesFirst } from '../lib/asset-favourites.ts';
import { expandHome, NotAPictureError, resolveAssetRef as resolveAsset, resolveRowPictures } from '../lib/asset-ref.ts';
import { mountTool, setDocumentTokenSelection, renderSvg, exportToFile, exportableFormats, currentQuery, modelValues, isTransform, isCaptureTool, setCanvasSizeFrom, LinkPasswordError } from '../engine-render.ts';
import { madeWithRowText } from '../made-with-row.ts';
import { matchedExportFormat } from '@lolly-tools/node-shell/raster';
import type { Runtime, Manifest } from '../engine-render.ts';
import { svgToCells } from '../terminal-image.ts';
import type { Cell } from '../terminal-image.ts';
import { htmlToRuns } from '../html-render.ts';
import type { Run } from '../html-render.ts';
import { createInteractive, isInteractiveHtml } from '../interactive-canvas.ts';
import type { InteractiveCanvas, Focusable } from '../interactive-canvas.ts';
import { copyToClipboard } from '../clipboard.ts';
import { buildMockup } from '../ascii-mockup.ts';
import { useTermSize } from '../hooks.ts';
import { cliRecipe, editInputValues, inputValuesJson, terminalReportLines } from '../terminal-workflows.ts';
import { readTerminalBrand, type TerminalBrand } from '../brand-theme.ts';
import { BrandStrip } from '../components/BrandStrip.tsx';
import { describeEnvironment, formatReadiness } from '../../../cli/src/environment.ts';
import { validateDocument } from '@lolly/engine';
import { theme, setTerminalAppearance, setTerminalBrand, setBrandAccents, brandAccentsEnabled } from '../theme.ts';
import { Panel } from '../components/Panel.tsx';
import { Footer, footerLines } from '../components/Footer.tsx';
import type { Shortcut } from '../components/Footer.tsx';
import { saveSession, slug, defaultExportDir, getProfile, setProfile } from '../store.ts';
import { fmtEmoji } from '../emoji.ts';
import type { TuiBridge } from '../bridge.ts';
import { deriveBlockKeys, blockParentIndex, blockTreeOrder, nestingActive, nestingConfig } from '../lib/block-tree.ts';
import type { BlockRow, TreeEntry } from '../lib/block-tree.ts';
import * as tbl from '../lib/table-edit.ts';
import { matchesShowIf } from '../../../../engine/src/inputs.ts';
import { emojiParams } from '../../../../engine/src/emoji-style.ts';
import { personalShareFields } from '../../../../engine/src/share-privacy.ts';
import { presentInputs, inputFocus } from '../input-presentation.ts';
import type { SavedSession } from '../store.ts';
import type { BlockFieldSpec, BlocksNesting, InputValue, TableValue, ShowIf } from '../../../../engine/src/inputs.ts';

interface ModelItem {
  id: string;
  type: string;
  label?: string;
  value: unknown;
  showIf?: ShowIf;
  group?: string;
  help?: string;
  required?: boolean;
  options?: Array<{ value: string; label?: string; showIf?: ShowIf }>;
  control?: string;
  // blocks presentation members carried verbatim by the engine model.
  fields?: BlockFieldSpec[];
  nesting?: BlocksNesting;
  addMenu?: { field: string; label?: string };
  canvas?: Record<string, unknown>;
  labelledFields?: boolean;
  // number-input bounds - drive the ←/→ slider (see NUMBER handling below).
  min?: number;
  max?: number;
  step?: number;
}

/** One "+ Add" choice for a blocks input (a discriminator value or a canvas kind). */
interface AddKind { id: string; label: string; seed?: BlockRow }

type Mode = 'browse' | 'editing' | 'editml' | 'naming' | 'addkind' | 'picking' | 'importing' | 'linkPassword' | 'shareReview' | 'confirmExit' | 'actions' | 'report' | 'reviewEdit';
type Focus = 'inputs' | 'export' | 'preview';
/** Block sub-editor position: `field < 0` ⇒ ROW list; `field >= 0` ⇒ one row's FIELDS. */
type BlockNav = { row: number; field: number };
/** Table grid cursor: `row === -1` ⇒ the heading row, `row >= 0` ⇒ a body row. */
type TableNav = { row: number; col: number };
const TEXTUAL = new Set(['text', 'longtext', 'url', 'number', 'color', 'date', 'time', 'datetime-local']);
const FIELD_TEXTUAL = new Set(['text', 'longtext', 'url', 'number', 'color']);
// Path-style inputs edited by typing a filesystem path (file) or an asset id / lolly.tools
// URL (asset). Not plain text - commit() resolves them (load bytes / resolve the ref).
const EDITABLE_PATH = new Set(['file', 'asset']);

/** Best-effort MIME from an extension - mirrors the CLI's file-input loader. */
function mimeForFile(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    case '.svg': return 'image/svg+xml';
    case '.heic': case '.heif': return 'image/heic';
    case '.avif': return 'image/avif';
    case '.tif': case '.tiff': return 'image/tiff';
    case '.pdf': return 'application/pdf';
    case '.json': return 'application/json';
    default: return 'application/octet-stream';
  }
}
const UNITS = ['px', 'mm', 'cm', 'in', 'pt'];
// Content Credentials (C2PA) validity choices; 0 = off. Stamped into the export as its
// last byte-operation (svg/raster/pdf that have a C2PA container).
const C2PA_DAYS = [0, 7, 30, 90, 365];
// Raster formats the durable (neural TrustMark) credential can ride in - mirrors the
// web shell's isDurableFmt (views/tool-actions.ts). The embed itself runs in the web
// shell's export path, so a durable export always routes via the Tier-B browser.
const DURABLE_FMTS = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff'];
type ExportKey = 'format' | 'width' | 'height' | 'unit' | 'dpi' | 'filename' | 'folder' | 'madewith' | 'c2pa' | 'imprint' | 'durable' | 'password' | 'bleed' | 'marks' | 'pressProfile';
// Export-settings rows. `cycle` fields step with ←/→; `text` fields open an editor.
const EXPORT_FIELDS: Array<{ key: ExportKey; label: string; kind: 'cycle' | 'text' }> = [
  { key: 'format', label: 'Format', kind: 'cycle' },
  { key: 'width', label: 'Width', kind: 'text' },
  { key: 'height', label: 'Height', kind: 'text' },
  { key: 'unit', label: 'Unit', kind: 'cycle' },
  { key: 'dpi', label: 'DPI', kind: 'text' },
  { key: 'filename', label: 'Filename', kind: 'text' },
  { key: 'folder', label: 'Folder', kind: 'text' },
  // The design-system record (plans/319): shown with the exact words it writes, so it
  // is visible at the moment of export, and toggled off per export like the marks.
  { key: 'madewith', label: 'Design system', kind: 'cycle' },
  { key: 'c2pa', label: 'C2PA', kind: 'cycle' },
  { key: 'imprint', label: 'Imprint', kind: 'cycle' },
  { key: 'durable', label: 'Durable', kind: 'cycle' },
  { key: 'password', label: 'Password', kind: 'text' },
  { key: 'bleed', label: 'Bleed', kind: 'text' },
  { key: 'marks', label: 'Print marks', kind: 'text' },
  { key: 'pressProfile', label: 'Press profile', kind: 'text' },
];

const TOOL_SHORTCUTS: Shortcut[] = [{ key: 'tab', label: 'panel' }, { key: 'j/k', label: 'move' }, { key: '⏎/e', label: 'edit' },
       { key: '←→', label: 'cycle' }, { key: 'x', label: 'export' }, { key: 's', label: 'save' },
       { key: 'y', label: 'share' }, { key: '?', label: 'actions' }, { key: 'u/r', label: 'undo/redo' }, { key: 'p', label: 'preview' }, { key: 'esc', label: 'back' }];

/** Map a parsed `?c2pa=` setting to a C2PA_DAYS index. On-with-no-lifetime (`?c2pa`) and
 *  an unrecognised bucket both fall to the 30-day default; an explicit off → 0.
 *
 *  ABSENT is not off: `null` is the "nobody said" case, and the answer to that is the
 *  engine's one policy (c2paDefaultOn - render.c2pa:false and privacy:'on-device' opt a
 *  tool out), the same call the web shell and the CLI make. Read from the manifest here
 *  rather than re-derived, so the three surfaces cannot drift again. */
function c2paIndexFromSetting(c: { on: boolean; days: number | null } | null, manifest?: ProvenanceManifest): number {
  if (!c) return manifest && c2paDefaultOn(manifest) ? C2PA_DAYS.indexOf(30) : 0;
  if (!c.on) return 0;
  const i = c.days != null ? C2PA_DAYS.indexOf(c.days) : -1;
  return i > 0 ? i : C2PA_DAYS.indexOf(30);
}

/** A single-line terminal input can't carry a real newline, so a literal `\n` typed
 *  into a longtext field becomes a line break on commit (a lone `\` before other chars
 *  is left alone). Lets multi-paragraph body copy be entered in the TUI. */
function unescapeNewlines(s: string): string {
  return s.replace(/\\n/g, '\n');
}

/** Concatenate every <style> block's text out of an HTML string (for the swatch var map). */
function styleFrom(html: string): string {
  const out: string[] = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1] ?? '');
  return out.join('\n');
}

/** Human byte size for a transform utility's before→after result line. */
function fmtBytes(n?: number): string {
  if (n === undefined || !Number.isFinite(n)) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function ToolView({ toolId, query, values, fromLink = false, session, bridge, onBack }: { session?: SavedSession; toolId: string; query?: string; values?: Record<string, unknown>; fromLink?: boolean; bridge: TuiBridge; onBack: () => void }) {
  const { cols, rows } = useTermSize();
  const { suspendTerminal } = useApp();
  const [actionSearch, setActionSearch] = useState('');
  const [actionIndex, setActionIndex] = useState(0);
  const [report, setReport] = useState<{ title: string; lines: Array<{ id: string; text: string }> }>({ title: '', lines: [] });
  const [reportScroll, setReportScroll] = useState(0);
  const reviewedShare = useRef<string | null>(null);
  const pendingEdit = useRef<{ values: Record<string, unknown>; base: string } | null>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [documentThemes, setDocumentThemes] = useState<Array<{ name: string; group: string | null; id?: string; swatch?: string }>>([]);
  const [brand, setBrand] = useState<TerminalBrand | null>(null);
  const [model, setModel] = useState<ModelItem[]>([]);
  const [focus, setFocus] = useState<Focus>('inputs');
  const [sel, setSel] = useState(0);
  const [scroll, setScroll] = useState(0);
  const [exportSel, setExportSel] = useState(0);
  const [mode, setMode] = useState<Mode>('browse');
  const [draft, setDraft] = useState('');
  const [unlock, setUnlock] = useState<{ password?: string; attempt: number }>({ attempt: 0 });
  const saved = useRef(session ? { slot: session.slot, label: session.label, revision: session.updatedAt } : null);
  const cleanQuery = useRef<string | null>(null);
  const leaveAfterSave = useRef(false);
  const saving = useRef(false);
  const exporting = useRef(false);
  const [importId, setImportId] = useState('');   // blocks input awaiting a CSV/JSON import path
  // Block sub-editor state. `blk === null` → normal input list.
  const [blk, setBlk] = useState<BlockNav | null>(null);
  // Table grid editor state. `grid === null` → normal input list.
  const [grid, setGrid] = useState<TableNav | null>(null);
  const [chooser, setChooser] = useState<{ kinds: AddKind[]; sel: number } | null>(null);
  // Catalog asset picker (opened with ⏎ on an `asset` input). `assets` is lazy-loaded
  // the first time the picker opens; `pick` is the transient picker state; `pickTarget`
  // is the input id being filled.
  const [assets, setAssets] = useState<AssetRow[] | null>(null);
  const [pick, setPick] = useState<{ query: string; sel: number; searching: boolean } | null>(null);
  const [pickTarget, setPickTarget] = useState<{ type: 'input' | 'field'; id: string } | null>(null);
  const [pickPrefs, setPickPrefs] = useState<{ favs: Set<string>; hidden: Set<string> }>({ favs: new Set(), hidden: new Set() });
  // Export settings.
  const [fmtIdx, setFmtIdx] = useState(0);
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [unitIdx, setUnitIdx] = useState(0);
  const [dpi, setDpi] = useState('300');
  const [c2paIdx, setC2paIdx] = useState(0);
  const linkC2paOff = useRef(false);
  const [imprintOn, setImprintOn] = useState(true);    // Lolly Imprint (pixel watermark) - on by default, opt-out per export
  const [madeWithOn, setMadeWithOn] = useState(true);  // design-system record (plans/319) - on by default, opt-out per export
  const [madeWithLine, setMadeWithLine] = useState(''); // the words that record writes, '' when there is nothing to record
  const [durableOn, setDurableOn] = useState(false);   // opt-in durable (TrustMark) credential - raster only, Tier-B
  const [filename, setFilename] = useState('');
  const [password, setPassword] = useState('');   // standard PDF open-password (from ?password= or typed)
  const [linkKnobs, setLinkKnobs] = useState<string[]>([]);   // export knobs a share link pre-set (shown in the panel)
  // Print-prep params a link carried (bleed/marks/imprint/CMYK press). The TUI has no UI
  // rows for them, but they're threaded into the export dims so a colleague's print-ready
  // link still exports print-ready - matching the CLI (which reads them from the URL).
  const [linkPrint, setLinkPrint] = useState<{ bleed?: string; marks?: string; pressProfile?: string }>({});
  const [outDir, setOutDir] = useState(defaultExportDir());
  const [showImage, setShowImage] = useState(false);
  const [previewScroll, setPreviewScroll] = useState(0);   // line offset when the preview is focused
  const [cells, setCells] = useState<Cell[][] | null>(null);
  // Last transform export's input/output byte counts → the before→after result headline.
  const [lastExport, setLastExport] = useState<{ in?: number; out: number } | null>(null);
  // Rendered content lines for a text-based utility (color-palette/text-helper/…).
  const [htmlRuns, setHtmlRuns] = useState<Run[][] | null>(null);
  // ASCII layout mockup for a DESIGNER tool (badge/signage/lockup/chart/diagram): a
  // box-drawing wireframe of its composition, shown by default; `p` flips to the raster.
  const [mockup, setMockup] = useState<string[] | null>(null);
  // Interactive canvas: a text/DOM utility (text-helper, color-palette) whose OWN script
  // runs in a jsdom so its buttons/tabs/fields are actually usable in the terminal. `ic`
  // is the live DOM; `icSel` is the focused control; `icEdit` is the control being typed
  // into; `icRev` bumps to force a re-render after any interaction. Held in a ref too so
  // the input handler reaches the current instance without re-subscribing.
  const [ic, setIc] = useState<InteractiveCanvas | null>(null);
  const [icSel, setIcSel] = useState(0);
  const [icEdit, setIcEdit] = useState<Element | null>(null);
  const [icRev, setIcRev] = useState(0);
  const icRef = useRef<InteractiveCanvas | null>(null); icRef.current = ic;
  const focusablesRef = useRef<Focusable[]>([]);
  const lastIcSelRef = useRef(-1);   // auto-scroll only when the selected control CHANGES
  const [status, setStatus] = useState('Loading…');
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState('');   // last-generated share link (shown in preview)
  const [rev, setRev] = useState(0);
  // Undo/redo: a stack of full input-model snapshots (values are already resolved, so a
  // restore is just replaying setInput - no re-mount, no asset re-resolution). `restoring`
  // guards refresh() from recording the restore itself as a new edit.
  const histRef = useRef<{ stack: Array<{ q: string; snap: Array<{ id: string; value: unknown }>; themes?: Record<string, string> }>; idx: number }>({ stack: [], idx: -1 });
  const restoringRef = useRef(false);
  // matchExportFormat: while unlocked, the export format tracks the flagged input's
  // uploaded file format (web parity). A ?format= link or a manual Format cycle locks it.
  const fmtLockedRef = useRef(false);

  // Preview priority (utility = the output is all there is): a utility tool's result
  // is its PRIMARY pane - auto-shown, and shown even on a narrow terminal - while a
  // designer tool keeps the preview low-priority/opt-in. Subtypes render differently:
  // a file-transform (strip-data/compress-pdf) and a capture (url-shot) show a TEXT
  // result summary, not a half-block raster (a raster is the wrong medium for them).
  const isUtility = (manifest as { category?: string } | null)?.category === 'utility';
  const transform = manifest ? isTransform(manifest) : false;   // strip-data, compress-pdf
  const capture = manifest ? isCaptureTool(manifest) : false;   // url-shot
  // A text-based / interactive utility (text-helper, color-palette, countdown-timer):
  // its rendered HTML content is the point - render that as terminal text, not a raster.
  const htmlDoc = isUtility && !transform && !capture;
  // Interactive = the doc utility's own script is running in a jsdom, so its controls are
  // live. The focused-control list is recomputed each render (DOM order is stable) and
  // stashed for the input handler.
  const interactive = !!ic;
  const focusables: Focusable[] = interactive ? ic!.focusables() : [];
  focusablesRef.current = focusables;
  const icSelClamped = focusables.length ? Math.min(icSel, focusables.length - 1) : 0;
  const icCurrent = focusables[icSelClamped] ?? null;
  const rasterPreview = !transform && !capture && !htmlDoc;     // only these emit a usable <svg>
  // The user's own file for a transform utility (drives the before→after summary).
  const fileRef = model.find(m => m.type === 'file')?.value as { name?: string; size?: number } | null | undefined;

  const stacked = cols < 80;
  const blockItem = blk && model[sel]?.type === 'blocks' ? model[sel]! : null;
  const gridItem = grid && model[sel]?.type === 'table' ? model[sel]! : null;
  const footerShortcuts: Shortcut[] = mode === 'editml'
    ? [{ key: '⏎', label: 'new line' }, { key: '←→↑↓', label: 'move' }, { key: '^A/^E', label: 'home/end' }, { key: 'esc', label: 'save' }]
    : mode === 'picking'
    ? [{ key: 'j/k', label: 'move' }, { key: '/', label: 'search' }, { key: '⏎', label: 'choose' }, { key: 'esc', label: 'cancel' }]
    : mode === 'addkind'
    ? [{ key: 'j/k', label: 'move' }, { key: '⏎', label: 'add' }, { key: 'esc', label: 'cancel' }]
    : gridItem && grid
      ? [{ key: 'hjkl', label: 'cell' }, { key: '⏎/e', label: 'edit' }, { key: 'a/A', label: 'add row/col' },
         { key: 'd/D', label: 'del row/col' }, { key: 'i', label: 'import' }, { key: 'esc', label: 'back' }]
    : blockItem && blk && blk.field < 0
      ? [{ key: 'j/k', label: 'row' }, { key: '⏎', label: 'open' }, { key: 'a', label: 'add' }, { key: 'd', label: 'del' }, { key: '[ ]', label: 'move' },
         ...(nestingActive(blockItem, topValues()) ? [{ key: '< >', label: 'nest' }] : []), { key: 'esc', label: 'back' }]
    : blockItem && blk
      ? [{ key: 'j/k', label: 'field' }, { key: '⏎/e', label: 'edit' }, { key: '←→', label: 'cycle' }, { key: 'spc', label: 'toggle' }, { key: 'esc', label: 'back' }]
    : focus === 'preview' && interactive
      ? [{ key: 'j/k', label: 'scroll' }, { key: '←→', label: 'control' }, { key: '⏎/e', label: 'use' }, { key: 'tab', label: 'panel' }, { key: 'esc', label: 'back' }]
    : focus === 'preview'
      ? [{ key: 'j/k', label: 'scroll' }, { key: 'g/G', label: 'top/end' }, { key: 'tab', label: 'panel' }, { key: 'p', label: 'image' }, { key: 'esc', label: 'back' }]
    : TOOL_SHORTCUTS;

  const footerH = Math.max(footerLines(footerShortcuts, undefined, cols), footerLines(TOOL_SHORTCUTS, undefined, cols));
  const bodyH = Math.max(6, rows - 2 - footerH - (brand ? 1 : 0));
  const inputsW = stacked ? cols : Math.max(30, Math.min(46, Math.floor(cols * 0.44)));
  const rightW = stacked ? cols : cols - inputsW;
  // A utility shows its result even on a narrow (stacked) terminal, so the stacked column
  // splits the space below Export between a compact Inputs panel and the result panel.
  // Every height is a deterministic fn of dims + isUtility. When they can't all fit (very
  // short terminal), the body containers clip (overflow:hidden) so the prompt/footer are
  // never overdrawn - the fixed-Panel no-shake invariant holds either way.
  const stackedUtil = stacked && isUtility;
  // For a stacked utility, cap Export so Inputs (≥4) + Preview (≥3) still get room.
  const exportH = Math.min(EXPORT_FIELDS.length + 5, Math.max(4, bodyH - 5), stackedUtil ? Math.max(6, bodyH - 7) : Infinity);
  const stackInputsH = Math.max(4, Math.min(Math.max(4, bodyH - exportH - 3), model.length * 2 + 3));
  const inputsH = stacked ? (stackedUtil ? stackInputsH : bodyH - exportH) : bodyH;
  const previewH = Math.max(3, stacked ? (stackedUtil ? bodyH - exportH - inputsH : bodyH - exportH) : bodyH - exportH);
  const visibleInputs = Math.max(1, Math.floor((inputsH - 3) / 2));
  // A settings-less doc utility (Text Helper, Colour Palette) is nothing BUT its content,
  // so give it the whole screen: the content panel spans the full width with a compact
  // Export strip beneath. The rendered HTML wraps to the full width and scrolls when
  // focused (Tab → Content).
  const docFull = htmlDoc && model.length === 0;
  // A settings-less doc utility gives its Content pane the WHOLE screen while you read or
  // scroll it: the Export strip collapses to a one-line summary until you Tab onto it (then
  // it expands and the content shrinks). So a tall palette scrolls without the export
  // controls taking up the view.
  const exportCollapsed = docFull && focus !== 'export';
  const docExportH = exportCollapsed ? 3 : exportH;
  const contentW = docFull ? cols : rightW;
  const contentH = docFull ? Math.max(3, bodyH - docExportH) : previewH;
  const previewCols = Math.max(8, contentW - 4);
  const previewRows = Math.max(3, contentH - 3);
  // Interactive mode reserves the bottom line for the focused-control status readout.
  const previewContentRows = interactive ? Math.max(2, previewRows - 1) : previewRows;
  // The preview/content pane is a Tab stop when it's actually showing something.
  const previewFocusable = (!stacked || stackedUtil) && (htmlDoc || transform || capture || showImage);

  const formats = manifest ? exportableFormats(manifest) : [];
  const fmt = formats[Math.min(fmtIdx, Math.max(0, formats.length - 1))] ?? 'svg';
  const unit = UNITS[Math.min(unitIdx, UNITS.length - 1)] ?? 'px';
  const name = (manifest as { name?: string })?.name ?? toolId;
  const outName = filename || slug(name);
  const outPath = join(outDir, `${outName}.${fmt}`);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const m = await mountTool(toolId, bridge.host, query ?? '', values, { fromLink, linkPassword: unlock.password, emojiStamp: session?.emoji });
        if (!alive) return;
        if (session?.rightsDecisions) m.runtime.setRightsDecisions(session.rightsDecisions);
        setRuntime(m.runtime); setManifest(m.manifest);
        const themes = await bridge.host.tokens?.themes().catch(() => []) ?? [];
        setDocumentThemes(await Promise.all(themes.map(async choice => {
          const selection = { ...m.runtime.tokenSelection, [choice.group ?? '']: choice.id ?? choice.name };
          const palette = await readTerminalBrand(bridge.host, selection).catch(() => null);
          return { ...choice, swatch: palette?.primary };
        })));
        if (!alive) return;
        const mdl = presentInputs(m.runtime.getModel()) as unknown as ModelItem[];
        setModel(mdl);
        histRef.current = { stack: [], idx: -1 }; recordSnapshot(m.runtime);   // baseline for undo
        setBlk(null); setChooser(null); setLastExport(null); setPreviewScroll(0);
        // A utility's result IS the tool - auto-show its preview/summary. Designer tools
        // keep the preview opt-in (p). A settings-less doc utility (Text Helper …) IS its
        // content, so land focus on the (full-screen) Content pane; else Inputs, or Export
        // when there's nothing to edit.
        const util = (m.manifest as { category?: string }).category === 'utility';
        const docUtil = util && !isTransform(m.manifest) && !isCaptureTool(m.manifest) && mdl.length === 0;
        setShowImage(util);
        setFocus(docUtil ? 'preview' : mdl.length === 0 ? 'export' : 'inputs');
        // A settings-less doc utility whose template ships a <script> becomes INTERACTIVE -
        // run the tool's own JS in a jsdom so its tabs/buttons/fields work in the terminal.
        // Restricted to no-input tools (text-helper, colour-palette, countdown) so the live
        // DOM is the single source of truth (a tool with declared inputs would have two).
        // Tear down any prior canvas first (one live jsdom per open tool).
        icRef.current?.destroy();
        const hydrated = m.runtime.getHydrated();
        const nextIc = docUtil && isInteractiveHtml(hydrated) ? createInteractive(hydrated, styleFrom(hydrated)) : null;
        setIc(nextIc); setIcSel(0); setIcEdit(null); setIcRev(0);
        // Seed the export panel from the share link's reserved params (link wins over the
        // manifest default), so a colleague's ?format=pdf&w=1200&unit=mm&c2pa=30 link opens
        // pre-dialled instead of silently resetting every knob. (lang is already applied -
        // mountTool passed it to loadTool, so the sidebar labels arrive translated.)
        const rv = m.reserved;
        const r = (m.manifest as { render?: { width?: number; height?: number; unit?: string } }).render ?? {};
        const fmts = exportableFormats(m.manifest);
        // Tolerate the jpg/jpeg synonym split so a link's format resolves to the tool's
        // declared spelling instead of silently falling back to the first format.
        const want = rv.format ? rv.format.toLowerCase() : null;
        const alias = want === 'jpeg' ? 'jpg' : want === 'jpg' ? 'jpeg' : null;
        const fi = want ? (fmts.indexOf(want) >= 0 ? fmts.indexOf(want) : (alias ? fmts.indexOf(alias) : -1)) : -1;
        // No explicit ?format= on the link → a matchExportFormat input's uploaded file
        // picks the default (a seeded ?source=./pic.jpg opens dialled to jpg).
        const mf = fi < 0 ? matchedExportFormat(m.manifest, m.runtime.getModel()) : null;
        const mi = mf ? fmts.indexOf(mf) : -1;
        setFmtIdx(fi >= 0 ? fi : mi >= 0 ? mi : 0);
        fmtLockedRef.current = fi >= 0;
        setWidth(rv.width != null ? String(rv.width) : r.width ? String(r.width) : '');
        setHeight(rv.height != null ? String(rv.height) : r.height ? String(r.height) : '');
        setUnitIdx(Math.max(0, UNITS.indexOf(rv.unit ?? r.unit ?? 'px')));
        setDpi(rv.dpi != null ? String(rv.dpi) : '300');
        setC2paIdx(c2paIndexFromSetting(rv.c2pa, m.manifest as unknown as ProvenanceManifest));
        linkC2paOff.current = rv.c2pa?.on === false;
        // Imprint is the same "absent means the policy" rule as C2PA: a link's explicit
        // imprint=0/1 wins, otherwise the engine's default-on policy decides (off only
        // for render.c2pa:false and on-device privacy tools). Read from the manifest so
        // the terminal matches the web shell and CLI rather than defaulting on its own.
        setImprintOn(rv.imprint ?? imprintDefaultOn(m.manifest as unknown as ProvenanceManifest));
        // `_madewith=0` in a link leaves the design-system record out; absent records the system.
        setMadeWithOn(rv.madeWith !== false);
        setDurableOn(Boolean(rv.durable));
        setFilename(rv.filename ? rv.filename : slug(m.manifest.name ?? toolId));
        setPassword(rv.password ?? '');
        // Print-prep from the link (pdf/pdf-cmyk/cmyk-tiff via the Tier-B web shell).
        const marksCsv = rv.marks
          ? [rv.marks.crop && 'crop', rv.marks.registration && 'reg', rv.marks.bleed && 'bleed', rv.marks.colorBars && 'bars', rv.marks.provenance && 'prov'].filter(Boolean).join(',')
          : undefined;
        // imprint is NOT carried here anymore - it is an editable Imprint row (imprintOn),
        // seeded from the same link param above. linkPrint holds only the knobs with no row.
        setLinkPrint({ bleed: rv.bleed ?? undefined, marks: marksCsv || undefined, pressProfile: rv.profile ?? undefined });
        // Name which knobs the link set, for a visible "review this" cue (and to annotate
        // the Export panel title). A failed render (P1: onInit threw, e.g. a capability this
        // shell can't fulfil) takes priority - surface it loudly instead of a silent preview.
        const knobs = [
          rv.format && 'format', (rv.width != null || rv.height != null) && 'size',
          rv.unit && 'unit', rv.dpi != null && 'dpi', rv.c2pa?.on && 'credential',
          rv.password && 'password', rv.filename && 'filename', rv.lang && `lang ${rv.lang}`,
          rv.bleed && 'bleed', rv.marks && 'marks', rv.durable && 'durable', rv.profile && 'press',
        ].filter(Boolean) as string[];
        setLinkKnobs(knobs);
        const hookErr = m.runtime.hookErrors[0];
        setStatus(
          hookErr ? `⚠ Tool failed to render - ${hookErr.message} (this shell may not support it)`
          : knobs.length ? `Link set: ${knobs.join(', ')} - review Export ↹` : '',
        );
        setLoading(false);
        setRev(x => x + 1);
      } catch (e) { if (alive) { setLoading(false); if (e instanceof LinkPasswordError) { setDraft(''); setMode('linkPassword'); } setStatus('Failed to load: ' + (e as Error).message); } }
    })();
    return () => { alive = false; };
    // `values` is in the deps because two desktop-saved sessions of the SAME tool arrive
    // with the same toolId and an empty query - only the values tell them apart. The route
    // hands over one object per open, so its identity changes exactly when the session does.
  }, [toolId, query, values, fromLink, bridge.host, unlock]);

  // Close the interactive canvas's jsdom when the whole view unmounts.
  useEffect(() => () => { icRef.current?.destroy(); }, []);
  useEffect(() => () => { runtime?.destroy(); }, [runtime]);

  useEffect(() => {
    if (!runtime) return;
    let alive = true;
    void readTerminalBrand(bridge.host, runtime.tokenSelection ?? {}).catch(() => null).then(next => {
      if (!alive) return;
      setTerminalBrand(next?.primary);
      setBrand(next);
    });
    return () => { alive = false; };
  }, [runtime, rev, bridge.host]);

  useEffect(() => {
    setScroll(s => (sel < s ? sel : sel >= s + visibleInputs ? sel - visibleInputs + 1 : s));
  }, [sel, visibleInputs]);

  // The Export panel's width, height and unit are the canvas size (engine 1.293), as the
  // web app's export bar is: a tool that lays itself out for the canvas (Logo Wall)
  // redraws the preview at that shape, so the preview is the file an export writes.
  useEffect(() => {
    if (!runtime) return;
    let alive = true;
    const w = parseFloat(width), h = parseFloat(height);
    void setCanvasSizeFrom(runtime, { width: w > 0 ? w : undefined, height: h > 0 ? h : undefined, unit })
      .then((changed) => { if (alive && changed) setRev(x => x + 1); })
      .catch(() => { /* a hook failure is the runtime's to report; the preview keeps the last frame */ });
    return () => { alive = false; };
  }, [runtime, width, height, unit]);

  useEffect(() => {
    // Only tools that emit an <svg> get the half-block raster; transform/capture utilities
    // show a text result summary instead, so skip the (pointless) rasterisation for them.
    if (!runtime || !showImage || stacked || !rasterPreview) return;
    let alive = true;
    (async () => {
      const svg = await renderSvg(runtime, bridge.dom);
      if (alive) setCells(svg ? svgToCells(svg, previewCols, previewRows) : null);
    })();
    return () => { alive = false; };
  }, [rev, showImage, stacked, rasterPreview, runtime, bridge.dom, previewCols, previewRows]);

  // Render a text-based utility's HTML CONTENT to coloured terminal lines (its result is
  // the content itself, not a file). An INTERACTIVE tool renders from its live jsdom (the
  // tool's script owns the DOM state), marking the focused control and auto-scrolling to
  // keep it on screen; a static doc utility re-hydrates from the runtime each edit.
  useEffect(() => {
    if (!runtime || !htmlDoc) { setHtmlRuns(null); return; }
    try {
      if (interactive && ic) {
        const { lines, focusLine } = ic.renderFocused(Math.max(12, previewCols), icCurrent?.el ?? null);
        setHtmlRuns(lines);
        // Only pull the focused control into view when it CHANGED (←/→ nav or mount) - never
        // on a plain content re-render, so manual j/k scrolling isn't yanked back.
        if (focusLine >= 0 && lastIcSelRef.current !== icSelClamped) {
          const rows = previewContentRows;
          setPreviewScroll(s => focusLine < s ? focusLine : focusLine >= s + rows ? Math.max(0, focusLine - rows + 1) : s);
        }
        lastIcSelRef.current = icSelClamped;
        return;
      }
      const doc = bridge.dom.window.document;
      const canvas = doc.getElementById('canvas');
      if (!canvas) { setHtmlRuns(null); return; }
      canvas.innerHTML = runtime.getHydrated();
      const styleText = Array.from(canvas.querySelectorAll('style')).map(s => s.textContent ?? '').join('\n');
      setHtmlRuns(htmlToRuns(canvas as unknown as Parameters<typeof htmlToRuns>[0], styleText, Math.max(12, previewCols)));
    } catch { setHtmlRuns(null); }
  }, [rev, icRev, icSelClamped, interactive, ic, htmlDoc, runtime, bridge.dom, previewCols, previewContentRows]);

  // Build an ASCII layout mockup for a designer tool (not utilities - they show content;
  // not transform/capture - file/URL utilities). Parses the hydrated body in a DETACHED
  // scratch node (never #canvas - no race with renderSvg) with <style>/<script> stripped
  // (the mockup needs geometry + structure, not CSS, and jsdom's CSS parser throws on some
  // tools' stylesheets). buildMockup picks the SVG-spatial or DOM-structural wireframe.
  useEffect(() => {
    if (!runtime || isUtility || transform || capture || stacked) { setMockup(null); return; }
    try {
      const doc = bridge.dom.window.document;
      const scratch = doc.createElement('div');
      scratch.innerHTML = runtime.getHydrated().replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
      setMockup(buildMockup(scratch as unknown as Parameters<typeof buildMockup>[0], Math.max(12, previewCols), Math.max(4, previewRows)));
    } catch { setMockup(null); }
  }, [rev, isUtility, transform, capture, stacked, runtime, bridge.dom, previewCols, previewRows]);

  // The design-system record's words (plans/319), read again after every edit: a
  // theme choice or a bound description changes what an export writes.
  useEffect(() => {
    if (!runtime || typeof runtime.madeWithPreview !== 'function') { setMadeWithLine(''); return; }
    let alive = true;
    runtime.madeWithPreview()
      .then(p => { if (alive) setMadeWithLine(p ? designRecordWords(p.record) : ''); })
      .catch(() => { if (alive) setMadeWithLine(''); });
    return () => { alive = false; };
  }, [rev, runtime]);

  function refresh(): void {
    if (runtime) {
      const m = runtime.getModel();
      const shown = presentInputs(m) as unknown as ModelItem[];
      setSel(inputFocus(shown, model[sel]?.id, sel));
      setModel(shown);
      if (!restoringRef.current) recordSnapshot(runtime);
      // matchExportFormat: until the user (or a link) picks a format, keep the export
      // format tracking the flagged input's uploaded file (a new .jpg source → jpg).
      if (!fmtLockedRef.current && manifest) {
        const mf = matchedExportFormat(manifest, m);
        const mi = mf ? exportableFormats(manifest).indexOf(mf) : -1;
        if (mi >= 0) setFmtIdx(mi);
      }
    }
    setRev(r => r + 1); setShareUrl('');
  }
  // Push the current state onto the undo stack (deduped by serialised query, capped, and
  // truncating any redo tail). Snapshots hold already-resolved input values by reference -
  // the engine never mutates value objects in place (edits build new arrays/objects).
  function recordSnapshot(rt: Runtime): void {
    const q = currentQuery(rt);
    const h = histRef.current;
    if (h.idx >= 0 && h.stack[h.idx]!.q === q) return;
    const snap = (rt.getModel() as Array<{ id: string; value: unknown }>).map(i => ({ id: i.id, value: i.value }));
    h.stack = h.stack.slice(0, h.idx + 1);
    h.stack.push({ q, snap, themes: rt.tokenSelection });
    if (h.stack.length > 80) h.stack.shift();
    h.idx = h.stack.length - 1;
  }
  // Replay a snapshot: set every input back to its stored value (already resolved), then
  // sync the view WITHOUT recording (restoringRef). Blocks/vector/asset/file all restore
  // through plain setInput since we kept the resolved values.
  async function restoreSnapshot(snap: Array<{ id: string; value: unknown }>, themes?: Record<string, string>): Promise<void> {
    if (!runtime) return;
    restoringRef.current = true;
    await setDocumentTokenSelection(runtime, bridge.host, themes ?? {});
    for (const { id, value } of snap) { try { await runtime.setInput(id, value as never); } catch { /* input gone */ } }
    const shown = presentInputs(runtime.getModel()) as unknown as ModelItem[];
    setSel(inputFocus(shown, model[sel]?.id, sel)); setModel(shown); setRev(r => r + 1); setShareUrl('');
    restoringRef.current = false;
  }
  function undo(): void {
    const h = histRef.current;
    if (h.idx <= 0) { setStatus('Nothing to undo'); return; }
    h.idx -= 1; setBlk(null); void restoreSnapshot(h.stack[h.idx]!.snap, h.stack[h.idx]!.themes); setStatus(`↶ Undo (${h.idx + 1}/${h.stack.length})`);
  }
  function redo(): void {
    const h = histRef.current;
    if (h.idx >= h.stack.length - 1) { setStatus('Nothing to redo'); return; }
    h.idx += 1; setBlk(null); void restoreSnapshot(h.stack[h.idx]!.snap, h.stack[h.idx]!.themes); setStatus(`↷ Redo (${h.idx + 1}/${h.stack.length})`);
  }

  // ── Block helpers ──────────────────────────────────────────────────────────
  function topValues(): Record<string, InputValue> {
    const v: Record<string, InputValue> = {};
    for (const m of runtime?.getModel() ?? []) v[m.id] = m.value as InputValue;
    return v;
  }
  function blockRows(item: ModelItem): BlockRow[] {
    return Array.isArray(item.value) ? item.value as BlockRow[] : [];
  }
  /** Row indices in display order (tree pre-order when nesting is active, else flat). */
  function treeEntries(item: ModelItem): TreeEntry[] {
    const rws = blockRows(item);
    if (item.nesting && nestingActive(item, topValues())) {
      const cfg = nestingConfig(item);
      const keys = deriveBlockKeys(rws, cfg);
      const pidx = blockParentIndex(rws, keys, cfg.parentField);
      return blockTreeOrder(rws, pidx);
    }
    return rws.map((_, i) => ({ idx: i, depth: 0 }));
  }
  /** Fields visible for a row, honouring `showFor` (discriminator) and `showIf`. */
  function visibleFields(item: ModelItem, rowIdx: number): BlockFieldSpec[] {
    const fields = item.fields ?? [];
    const row = blockRows(item)[rowIdx] ?? {};
    const vals = topValues();
    const ids = new Set(fields.map(f => f.id));
    const disc = item.addMenu?.field;
    return fields.filter(f => {
      if (f.showFor) {
        const dv = disc ? row[disc] : undefined;
        if (!f.showFor.includes(String(dv ?? ''))) return false;
      }
      const conditionValues = { ...vals, ...Object.fromEntries([...ids].map(id => [id, row[id]])) };
      if (!matchesShowIf(f.showIf as ShowIf | undefined, conditionValues)) return false;
      return true;
    });
  }
  function typeDefault(t: string): InputValue {
    return t === 'number' ? 0 : t === 'boolean' ? false : '';
  }
  function defaultRow(fields: BlockFieldSpec[]): BlockRow {
    const r: BlockRow = {};
    for (const f of fields) {
      const dflt = (f as { default?: InputValue }).default;
      r[f.id] = dflt ?? typeDefault(f.type ?? 'text');
    }
    return r;
  }
  function coerceField(f: BlockFieldSpec, raw: string): InputValue {
    if ((f.type ?? 'text') === 'number') {
      let n = Number(raw.trim());
      if (!Number.isFinite(n)) n = 0;
      if (typeof f.min === 'number') n = Math.max(f.min, n);
      if (typeof f.max === 'number') n = Math.min(f.max, n);
      return n;
    }
    return raw;
  }
  /** Add-menu choices: canvas `addKinds` (seeded), else the discriminator's options. */
  function addKinds(item: ModelItem): AddKind[] {
    const ck = item.canvas?.addKinds as Array<{ id: string; label?: string; seed?: BlockRow }> | undefined;
    if (Array.isArray(ck) && ck.length) return ck.map(k => ({ id: k.id, label: k.label ?? k.id, seed: k.seed }));
    const disc = item.addMenu?.field;
    const df = disc ? (item.fields ?? []).find(f => f.id === disc) : undefined;
    if (df?.options?.length) return df.options.map(o => ({ id: o.value, label: o.label ?? o.value }));
    return [];
  }
  function openAdd(item: ModelItem): void {
    const kinds = addKinds(item);
    if (kinds.length > 1) { setChooser({ kinds, sel: 0 }); setMode('addkind'); return; }
    addRow(item, kinds[0]);
  }
  function addRow(item: ModelItem, kind?: AddKind): void {
    if (!runtime) return;
    const fields = item.fields ?? [];
    const row: BlockRow = { ...defaultRow(fields), ...(kind?.seed ?? {}) };
    if (kind && !kind.seed && item.addMenu?.field) row[item.addMenu.field] = kind.id;
    const idF = (item.canvas?.idField as string | undefined) ?? item.nesting?.keyField;
    if (idF && !fieldStr(row[idF])) row[idF] = Math.random().toString(36).slice(2, 10);
    const cur = blockRows(item);
    const next = [...cur, row];
    runtime.setInput(item.id, next as never).then(() => { refresh(); setBlk({ row: cur.length, field: -1 }); }).catch(() => {});
  }
  function deleteRow(item: ModelItem): void {
    if (!blk || !runtime) return;
    const cur = blockRows(item);
    const next = cur.filter((_, i) => i !== blk.row);
    const target = Math.max(0, Math.min(blk.row, next.length - 1));
    runtime.setInput(item.id, next as never).then(() => { refresh(); setBlk({ row: target, field: -1 }); }).catch(() => {});
  }
  function moveRow(item: ModelItem, dir: number): void {
    if (!blk || !runtime) return;
    const cur = [...blockRows(item)];
    const from = blk.row, to = from + dir;
    if (to < 0 || to >= cur.length) return;
    const [x] = cur.splice(from, 1);
    cur.splice(to, 0, x!);
    runtime.setInput(item.id, cur as never).then(() => { refresh(); setBlk({ row: to, field: -1 }); }).catch(() => {});
  }
  /** Promote a row to root (`toRoot`) or indent it under the previous displayed row. */
  function reparent(item: ModelItem, toRoot: boolean, order?: number[]): void {
    if (!blk || !runtime) return;
    const cfg = nestingConfig(item);
    const cur = blockRows(item);
    if (toRoot) {
      const next = cur.map((r, i) => (i === blk.row ? { ...r, [cfg.parentField]: '' } : r));
      runtime.setInput(item.id, next as never).then(refresh).catch(() => {});
      return;
    }
    const ord = order ?? treeEntries(item).map(e => e.idx);
    const pos = ord.indexOf(blk.row);
    if (pos <= 0) return;                              // nothing above to nest under
    const prevIdx = ord[pos - 1]!;                     // previous displayed row (never a descendant)
    const keys = deriveBlockKeys(cur, cfg);
    const parentKey = keys[prevIdx];
    if (!parentKey) return;
    // Anchor the new parent's derived key onto its keyField so the ref survives reorders.
    const next = cur.map((r, i) => {
      if (i === blk.row) return { ...r, [cfg.parentField]: parentKey };
      if (i === prevIdx && !fieldStr(r[cfg.keyField])) return { ...r, [cfg.keyField]: parentKey };
      return r;
    });
    runtime.setInput(item.id, next as never).then(refresh).catch(() => {});
  }
  function setField(fieldId: string, val: InputValue): void {
    if (!blk || !runtime) return;
    const item = model[sel];
    if (!item || item.type !== 'blocks') return;
    const cur = blockRows(item);
    const next = cur.map((r, i) => (i === blk.row ? { ...r, [fieldId]: val } : r));
    runtime.setInput(item.id, next as never).then(refresh).catch(() => {});
  }

  function exportFieldValue(key: string): string {
    switch (key) {
      case 'format': return fmt;
      case 'width': return width;
      case 'height': return height;
      case 'unit': return unit;
      case 'dpi': return dpi;
      case 'filename': return outName;
      case 'folder': return outDir;
      case 'password': return password;
      case 'bleed': return linkPrint.bleed ?? '';
      case 'marks': return linkPrint.marks ?? '';
      case 'pressProfile': return linkPrint.pressProfile ?? '';
      default: return '';
    }
  }
  function exportFieldDisplay(key: string): string {
    switch (key) {
      case 'format': return `${fmtEmoji(fmt)} ${fmt.toUpperCase()}`;
      case 'bleed': return linkPrint.bleed || 'none';
      case 'marks': return linkPrint.marks || 'none';
      case 'pressProfile': return linkPrint.pressProfile || 'default';
      case 'width': return width || 'native';
      case 'height': return height || 'native';
      case 'unit': return unit;
      case 'dpi': return unit === 'px' ? `${dpi || '300'} (physical units only)` : (dpi || '300');
      case 'filename': return outName;
      case 'folder': return outDir;
      case 'madewith': return madeWithRowText({ words: madeWithLine, on: madeWithOn, format: fmt, c2paDays: C2PA_DAYS[c2paIdx] ?? 0 });
      case 'c2pa': { const d = C2PA_DAYS[c2paIdx] ?? 0; return d === 0 ? 'off' : `on · ${d}-day cert`; }
      case 'imprint': return isImprintFormat(fmt)
        // A container (pdf/pdf-cmyk/pptx) marks only the raster images it embeds, so a
        // vector/text-only page carries no mark - say "embedded images only" rather than
        // overstate an unconditional in-pixel mark. Raster formats mark every pixel.
        ? (imprintOn ? (isImprintContainerFormat(fmt) ? 'on · embedded images only' : 'on · in-pixel mark') : 'off')
        : (imprintOn ? 'on (formats with pixels only)' : 'no pixels to mark');
      case 'durable': return DURABLE_FMTS.includes(fmt)
        ? (durableOn ? 'on · in-pixel mark' : 'off')
        : (durableOn ? 'on (raster formats only)' : 'raster only');
      case 'password': return password ? '•'.repeat(Math.min(8, password.length)) + ' · pdf lock' : (fmt === 'pdf' ? 'none' : 'pdf only');
      default: return '';
    }
  }

  function commit(raw: string): void {
    setMode('browse');
    // Editing a live interactive control - write straight back into the tool's DOM.
    if (icEdit && ic) { ic.setValue(icEdit, raw); setIcEdit(null); bumpIc(); return; }
    // A table cell edit writes back the WHOLE grid (setCell keeps it rectangular).
    if (grid && model[sel]?.type === 'table') {
      const item = model[sel]!;
      const t = tbl.asTable(item.value);
      const cur = tbl.clampCursor(t, grid.row, grid.col);
      setTable(item, tbl.setCell(t, cur.row, cur.col, raw));
      return;
    }
    // Block field edit takes priority - coerce by the field's type and write it back.
    if (blk && blk.field >= 0 && model[sel]?.type === 'blocks') {
      const item = model[sel]!;
      const vis = visibleFields(item, blk.row);
      const f = vis[Math.min(blk.field, vis.length - 1)];
      if (f) setField(f.id, coerceField(f, raw));
      return;
    }
    if (focus === 'export') {
      const f = EXPORT_FIELDS[exportSel]; if (!f) return;
      if (f.key === 'width') setWidth(raw.trim());
      else if (f.key === 'height') setHeight(raw.trim());
      else if (f.key === 'dpi') { const n = parseInt(raw.trim(), 10); setDpi(Number.isFinite(n) && n > 0 ? String(n) : '300'); }
      else if (f.key === 'filename') setFilename(raw.trim());
      else if (f.key === 'folder') setOutDir(raw.trim() || defaultExportDir());
      else if (f.key === 'password') setPassword(raw.trim());
      else if (f.key === 'bleed' || f.key === 'marks' || f.key === 'pressProfile') setLinkPrint(value => ({ ...value, [f.key]: raw.trim() || undefined }));
      return;
    }
    const item = model[sel]; if (!item || !runtime) return;
    if (item.type === 'file') { void loadFileInput(item.id, raw); return; }
    if (item.type === 'asset') { void setAssetInput(item.id, raw); return; }
    if (item.type === 'vector') { runtime.setInput(item.id, parseVector(item, raw) as never).then(refresh).catch(() => {}); return; }
    const value: unknown = item.type === 'number' ? (Number.isFinite(parseFloat(raw)) ? parseFloat(raw) : 0)
      : item.type === 'longtext' ? unescapeNewlines(raw)
      : raw;
    runtime.setInput(item.id, value as never).then(refresh).catch(() => {});
  }
  // Load a file from disk into a `file` input - read the bytes and set the FileRef the
  // engine's transform hooks (strip-data/compress-pdf) read (.bytes). Node reads the file;
  // setInput doesn't (it can't). Clearing the field (empty path) resets the input to null.
  async function loadFileInput(id: string, path: string): Promise<void> {
    if (!runtime) return;
    const p = path.trim();
    if (!p) { runtime.setInput(id, null as never).then(refresh).catch(() => {}); return; }
    try {
      const abs = expandHome(p);
      const buf = await readFile(abs);
      const bytes = new Uint8Array(buf);
      await runtime.setInput(id, { __file: true, name: basename(abs), mime: mimeForFile(abs), size: bytes.length, bytes, url: null } as never);
      refresh();
      setStatus(`✓ Loaded ${basename(abs)} (${bytes.length.toLocaleString()} bytes)`);
    } catch (e) { setStatus('File error: ' + (e as Error).message); }
  }
  // Import a CSV/JSON file into the pending `blocks` input (importId), replacing its rows
  // with the parsed data via the shared engine importer (parseDataRows). A `table` input
  // takes the same key but the OTHER engine importer (parseTableText - first row =
  // headings), so the terminal fills a grid from a spreadsheet exactly like the CLI's
  // `--<id>-data=table.csv`.
  function importNow(path: string): void {
    setMode('browse');
    const item = model.find(m => m.id === importId);
    const p = path.trim();
    if (!runtime || !item || !p) return;
    (async () => {
      try {
        const text = await readFile(expandHome(p), 'utf8');
        if (item.type === 'table') {
          const parsed = parseTableText(text);
          if (!parsed) throw new Error(`${basename(expandHome(p))} does not parse as a CSV/TSV/Markdown table`);
          await runtime.setInput(item.id, parsed as never);
          refresh();
          setGrid(g => (g ? { row: -1, col: 0 } : g));
          setStatus(`✓ Imported ${parsed.rows.length} row${parsed.rows.length === 1 ? '' : 's'} × ${parsed.columns.length} column${parsed.columns.length === 1 ? '' : 's'} → ${item.id}`);
          return;
        }
        if (item.type !== 'blocks') return;
        const { rows, truncated } = parseDataRows(text, { fields: (item.fields ?? []) as Array<{ id: string; label?: string; type?: string }> });
        // A picture column (a Logo Wall CSV's `logo`) holds paths, catalog ids or URLs:
        // resolve each now, as setInput never does. A relative path is tried from the
        // working directory, then beside the CSV. A file there that is not a picture
        // refuses the import, so nothing of it is set.
        const assetFields = (item.fields ?? []).filter(f => f.type === 'asset').map(f => f.id);
        const unresolved = await resolveRowPictures(rows as Record<string, unknown>[], assetFields, dirname(expandHome(p)), bridge.host);
        await runtime.setInput(item.id, rows as never);
        refresh();
        setStatus(`✓ Imported ${rows.length} row${rows.length === 1 ? '' : 's'} → ${item.id}${truncated ? ' (row cap reached)' : ''}${unresolved ? `; ${unresolved} picture${unresolved === 1 ? '' : 's'} not found` : ''}`);
      } catch (e) {
        setStatus(e instanceof NotAPictureError ? `Import refused: ${e.message} Nothing was imported.` : 'Import failed: ' + (e as Error).message);
      }
    })();
  }
  /** Write a whole table value back through the runtime (the engine rejects ragged grids,
   *  so every mutation goes through the lib helpers that keep it rectangular). */
  function setTable(item: ModelItem, next: TableValue): void {
    if (!runtime) return;
    runtime.setInput(item.id, next as never).then(refresh).catch(() => {});
  }
  // A raw asset id, lolly.tools URL or local picture path as the AssetRef the template
  // reads (lib/asset-ref.ts: a file is read only when its bytes are a picture).
  const resolveAssetRef = (raw: string): Promise<InputValue> => resolveAsset(raw, bridge.host);
  // Set a top-level `asset` input by id / URL (empty clears it).
  async function setAssetInput(id: string, raw: string): Promise<void> {
    if (!runtime) return;
    const r = raw.trim();
    if (!r) { runtime.setInput(id, null as never).then(refresh).catch(() => {}); return; }
    try {
      await runtime.setInput(id, await resolveAssetRef(r) as never);
      refresh();
      setStatus(`✓ Set ${isToolUrl(r) ? 'tool render' : 'asset'} → ${r}`);
    } catch (e) { setStatus('Asset error: ' + (e as Error).message); }
  }
  // Set a block row's `asset` field (e.g. a Design box image) to a catalog asset.
  async function setFieldAsset(fieldId: string, raw: string): Promise<void> {
    const r = raw.trim(); if (!r) { setField(fieldId, null); return; }
    try { setField(fieldId, await resolveAssetRef(r)); setStatus(`✓ Set image → ${r}`); }
    catch (e) { setStatus('Asset error: ' + (e as Error).message); }
  }
  // Open the catalog asset picker for a top-level input OR a block field. Lazy-loads the
  // asset registry the first time (the same catalog/assets/index.json the Assets view browses).
  async function openAssetPicker(target: { type: 'input' | 'field'; id: string }): Promise<void> {
    setPickTarget(target);
    setPick({ query: '', sel: 0, searching: false });
    setMode('picking');
    if (!assets) { try { setAssets(await loadAssets()); } catch { setAssets([]); } }
    try { const p = await getProfile(); setPickPrefs({ favs: loadFavourites(p), hidden: loadHidden(p) }); } catch { /* keep defaults */ }
  }
  // The visual assets the picker offers: search-filtered, hidden dropped, favourites first.
  const pickList: AssetRow[] = pick
    ? sortFavouritesFirst(filterAssets(assets ?? [], pick.query, true).filter(a => !pickPrefs.hidden.has(a.id)), pickPrefs.favs)
    : [];
  function documentOptions() {
    const positive = (raw: string) => { const n = Number(raw); return Number.isFinite(n) && n > 0 ? n : undefined; };
    return { format: fmt, width: positive(width), height: positive(height), unit, dpi: positive(dpi),
      filename, c2pa: !!C2PA_DAYS[c2paIdx], c2paDays: C2PA_DAYS[c2paIdx], imprint: imprintOn, madeWith: madeWithOn,
      durable: durableOn, ...linkPrint, profile: linkPrint.pressProfile };
  }
  const snapshotQuery = runtime ? currentQuery(runtime, documentOptions()) : '';
  useEffect(() => { if (runtime && !loading && cleanQuery.current === null) cleanQuery.current = snapshotQuery; }, [runtime, loading, snapshotQuery]);

  function saveNow(label: string, saveAs = false): void {
    if (!runtime || saving.current) return;
    let dataSnapshot: Record<string, unknown>;
    try { dataSnapshot = modelValues(runtime); inputValuesJson(dataSnapshot); } catch (error) { setMode('browse'); setStatus('Save failed: ' + (error as Error).message); return; }
    saving.current = true; setMode('browse');
    const nm = label.trim() || name;
    const prior = saveAs ? null : saved.current;
    const slot = prior?.slot ?? `${toolId}-${crypto.randomUUID()}`;
    const snapshot = snapshotQuery;
    saveSession({ slot, toolId, label: nm, query: snapshot, values: dataSnapshot, rightsDecisions: runtime.rightsDecisions(), emoji: runtime.emoji.style ? emojiParams(runtime.emoji.style) : { emoji: 'none', emojifx: '' }, updatedAt: new Date().toISOString(), expectedUpdatedAt: prior?.revision ?? null })
      .then(revision => {
        saved.current = { slot, label: nm, revision }; cleanQuery.current = snapshot;
        setStatus(`Saved project "${nm}"`);
        if (leaveAfterSave.current) onBack();
      }).catch(e => { leaveAfterSave.current = false; setStatus('Save failed: ' + (e as Error).message); })
      .finally(() => { saving.current = false; });
  }
  function requestBack(): void {
    if (runtime && cleanQuery.current !== null && snapshotQuery !== cleanQuery.current) { setMode('confirmExit'); return; }
    onBack();
  }
  function shareTool(includePersonal = false): void {
    if (!runtime) return;
    if (includePersonal && reviewedShare.current !== currentQuery(runtime, documentOptions())) { reviewShare(); setStatus('Document changed. Review the updated personal fields.'); return; }
    const q = currentQuery(runtime, documentOptions(), !includePersonal);
    setShareUrl(`https://lolly.tools/#/tool/${toolId}${q ? '?' + q : ''}`);
    setMode('browse');
    setStatus(includePersonal ? 'Share link includes the reviewed personal fields.' : 'Share link ready. Personal fields are omitted.');
  }
  function reviewShare(): void {
    setReportScroll(0);
    if (runtime && personalShareFields(runtime.getModel()).length) {
      reviewedShare.current = currentQuery(runtime, documentOptions());
      showReport('Review personal fields', personalShareFields(runtime.getModel()).map(field => `${field.label}: ${JSON.stringify(field.value)}`));
      setMode('shareReview');
    } else shareTool();
  }
  function doExport(): void {
    if (!runtime || !manifest || exporting.current) return;
    exporting.current = true;
    setStatus('Exporting…');
    const w = parseFloat(width), h = parseFloat(height);
    const dpiN = parseInt(dpi, 10);
    const dims = {
      width: Number.isFinite(w) && w > 0 ? w : undefined,
      height: Number.isFinite(h) && h > 0 ? h : undefined,
      unit, dpi: Number.isFinite(dpiN) && dpiN > 0 ? dpiN : 300,
      c2paDays: C2PA_DAYS[c2paIdx] || undefined,
      // Off on a tool that stamps by default, or a link's own c2pa=off, is the person's choice.
      // Off on a tool that never stamps is nobody's, and that export keeps its bytes.
      c2paOff: !C2PA_DAYS[c2paIdx] && (linkC2paOff.current || (manifest ? c2paDefaultOn(manifest as unknown as ProvenanceManifest) : false)) ? true : undefined,
      // The Imprint (pixel watermark). Resolved to an EXPLICIT boolean so every tier
      // agrees: the Tier-A PNG path reads it to embed the mark browser-free, and the
      // Tier-B path forwards imprint=0/1 (an undefined would let the web shell re-default
      // it on, silently overriding an opt-out). Only sent for formats that carry pixels.
      imprint: isImprintFormat(fmt) ? imprintOn : undefined,
      // The design-system record, as an explicit boolean for the same reason: the
      // Tier-B path forwards only the opt-out, as `_madewith=0`.
      madeWith: madeWithOn,
      // Durable credential: only meaningful for raster formats the mark can ride in;
      // routes the export via the Tier-B web shell, whose durableEmbedCanvas embeds it.
      durable: durableOn && DURABLE_FMTS.includes(fmt) ? true : undefined,
      // Standard PDF open-password (basic lock) - pdf only; threads to the web-shell tier.
      password: fmt === 'pdf' && password ? password : undefined,
      // Print-prep carried from a share link (no TUI rows yet) - honoured on the Tier-B tier.
      ...linkPrint,
    };
    const inBytes = fileRef?.size;   // transform utilities: for the before→after headline
    (async () => {
      try {
        const n = await exportToFile(runtime, bridge.dom, manifest, fmt, outPath, dims);
        if (transform) setLastExport({ in: inBytes, out: n });
        setStatus(`✓ Wrote ${n.toLocaleString()} bytes → ${outPath}`);
      } catch (e) {
        const msg = (e as Error).message;
        setStatus('Export failed: ' + msg);
      } finally { exporting.current = false; }
    })();
  }

  function reportLines(lines: string[]): string[] {
    return terminalReportLines(lines, cols - 6);
  }
  function showReport(title: string, lines: string[]): void { setReport({ title, lines: reportLines(lines).map(text => ({ id: crypto.randomUUID(), text })) }); setReportScroll(0); setMode('report'); }
  async function diagnostics(): Promise<void> {
    try {
      const environment = await describeEnvironment();
      showReport('Renderer readiness and diagnostics', [
        ...formatReadiness(formats, environment).map(item => `${item.format}: ${item.state} (${item.tier}) - ${item.reason}`),
        '', 'Recent tool logs:', ...bridge.logs,
      ]);
    } catch (error) { setStatus((error as Error).message); }
  }
  async function editExternally(): Promise<void> {
    if (!runtime || !manifest) return;
    const base = currentQuery(runtime);
    try {
      const values = Object.fromEntries(runtime.getModel().map(input => [input.id, input.value]));
      const candidate = await editInputValues(values, suspendTerminal);
      const validation = validateDocument({ kind: 'inputs', manifest: { ...manifest, inputs: runtime.getModel() }, value: candidate });
      if (!validation.ok) throw new Error(validation.errors.map(issue => `${issue.path}: ${issue.message}`).join('; '));
      const changes = Object.keys(candidate).filter(id => JSON.stringify(values[id]) !== JSON.stringify(candidate[id]));
      if (!changes.length) { setStatus('Editor made no changes.'); return; }
      pendingEdit.current = { values: Object.fromEntries(changes.map(id => [id, candidate[id]])), base };
      showReport('Review editor changes', changes.map(id => `${id}: ${JSON.stringify(values[id])} -> ${JSON.stringify(candidate[id])}`));
      setReportScroll(0); setMode('reviewEdit');
    } catch (error) { setStatus('Editor: ' + (error as Error).message); }
  }
  async function applyEditor(): Promise<void> {
    if (!runtime || !pendingEdit.current) return;
    const pending = pendingEdit.current;
    pendingEdit.current = null; setMode('browse');
    if (currentQuery(runtime) !== pending.base) { setStatus('Document changed while editing. No editor changes applied.'); return; }
    for (const [id, value] of Object.entries(pending.values)) await runtime.setInput(id, value as never);
    refresh(); setStatus('Editor changes applied. Use undo to restore the previous inputs.');
  }
  const actions: Array<{ label: string; swatch?: string; run: () => void }> = [
    { label: 'Export document', run: doExport },
    { label: 'Save project', run: () => saveNow(saved.current?.label ?? name) },
    { label: 'Save project as', run: () => { setDraft(saved.current?.label ?? name); setMode('naming'); } },
    { label: 'Share link', run: reviewShare },
    { label: 'Copy private Bash/Zsh CLI recipe', run: () => { if (runtime) { try { void flushCopy(cliRecipe(toolId, modelValues(runtime), { ...documentOptions(), tokenSelection: runtime.tokenSelection, ...(runtime.emoji.style ? { emojiStyle: JSON.stringify(runtime.emoji.style) } : { emoji: 'none' }) }, outPath)); } catch (error) { setStatus((error as Error).message); } } } },
    { label: 'Edit inputs in VISUAL / EDITOR', run: () => { void editExternally(); } },
    { label: 'Renderer readiness and recent logs', run: () => { void diagnostics(); } },
    { label: 'Inspect brand palette', run: () => showReport('Brand palette', brand ? [brand.label, ...brand.choices, ...brand.swatches.map(swatch => `${swatch.label}: ${swatch.value}`)] : ['This design system has no colour tokens.']) },
    { label: 'Copy brand palette as JSON', run: () => { if (brand) void flushCopy(JSON.stringify(brand, null, 2)); } },
    { label: `Terminal brand accents: ${brandAccentsEnabled() ? 'on' : 'off'} (toggle)`, run: () => { const enabled = !brandAccentsEnabled(); setBrandAccents(enabled); void getProfile().then(profile => setProfile({ ...profile, terminalBrand: enabled })); setRev(value => value + 1); } },
    { label: 'Input help', run: () => { const input = runtime?.getModel().find(input => input.id === model[sel]?.id); showReport(input?.label ?? 'Input help', [input?.help ?? 'No additional help provided.', `Input: ${input?.id ?? ''}`, `Group: ${input?.group ?? 'general'}`, input?.required ? 'Required' : 'Optional']); } },
    ...model.map((input, index) => ({ label: `Go to input: ${input.group ? input.group + ' / ' : ''}${input.label ?? input.id}`, run: () => { setSel(index); setFocus('inputs'); setBlk(null); setGrid(null); } })),
    { label: 'Document: use default theme choices', run: () => { if (runtime) void setDocumentTokenSelection(runtime, bridge.host, {}).then(refresh).catch(error => setStatus((error as Error).message)); } },
    ...documentThemes.map(choice => ({ label: `Document ${choice.group || 'theme'}: ${choice.name}`, swatch: choice.swatch, run: () => {
      if (!runtime) return;
      void setDocumentTokenSelection(runtime, bridge.host, { ...runtime.tokenSelection, [choice.group ?? '']: choice.id ?? choice.name })
        .then(() => { refresh(); setStatus('Document theme changed. Save to keep this choice.'); })
        .catch(error => setStatus((error as Error).message));
    } })),
    ...(['terminal', 'light', 'dark'] as const).map(appearance => ({ label: `Terminal appearance: ${appearance}`, run: () => { setTerminalAppearance(appearance); void getProfile().then(profile => setProfile({ ...profile, terminalAppearance: appearance })); setRev(value => value + 1); } })),
  ];
  const matchingActions = actions.filter(action => action.label.toLowerCase().includes(actionSearch.toLowerCase()));

  // ── Interactive canvas actions (drive the tool's own live DOM) ──────────────
  function bumpIc(): void { setIcRev(r => r + 1); }
  /** Cycle a live <select>'s option and fire input/change so the tool reacts. */
  function cycleIcSelect(f: Focusable, dir: number): void {
    if (!ic) return;
    const el = f.el as unknown as { options?: ArrayLike<{ value: string }>; selectedIndex?: number };
    const opts = el.options ? Array.from(el.options) : [];
    if (!opts.length) return;
    const cur = Math.max(0, el.selectedIndex ?? 0);
    ic.setValue(f.el, opts[(cur + dir + opts.length) % opts.length]!.value); bumpIc();
  }
  /** Open the in-place editor for a text/select control (textarea → full editor). */
  function beginIcEdit(f: Focusable): void {
    setIcEdit(f.el);
    setDraft(String((f.el as { value?: string }).value ?? f.value ?? ''));
    setMode(f.el.tagName.toLowerCase() === 'textarea' ? 'editml' : 'editing');
  }
  /** Enter/activate a control: cycle a select, edit a text field, else click it. */
  function icActivate(f: Focusable): void {
    if (!ic) return;
    if (f.kind === 'select') { cycleIcSelect(f, 1); return; }
    if (f.editable) { beginIcEdit(f); return; }
    ic.activate(f.el); setIcEdit(null); bumpIc();
    // A tool's copy button (colour values, de-identified map) → the real OS clipboard.
    const copied = ic.takeCopy();
    if (copied != null) void flushCopy(copied);
  }
  async function flushCopy(text: string): Promise<void> {
    const ok = await copyToClipboard(text);
    setStatus(ok ? `✓ Copied ${text.length.toLocaleString()} chars to clipboard` : 'No clipboard tool found (install xclip / wl-copy)');
  }

  useInput((input, key) => {
    if (mode === 'actions') {
      if (key.escape) setMode('browse');
      else if (key.upArrow) setActionIndex(index => Math.max(0, index - 1));
      else if (key.downArrow) setActionIndex(index => Math.min(Math.max(0, matchingActions.length - 1), index + 1));
      else if (key.return) { const action = matchingActions[actionIndex]; setMode('browse'); action?.run(); }
      return;
    }
    if (mode === 'report' || mode === 'reviewEdit') {
      if (key.escape) { pendingEdit.current = null; setMode('browse'); }
      else if (mode === 'reviewEdit' && input === 'a') void applyEditor().catch(error => setStatus((error as Error).message));
      else if (key.upArrow || input === 'k') setReportScroll(value => Math.max(0, value - 1));
      else if (key.downArrow || input === 'j') setReportScroll(value => Math.min(Math.max(0, report.lines.length - 1), value + 1));
      return;
    }
    if (saving.current || exporting.current) return;
    if (mode === 'linkPassword') { if (key.escape) onBack(); return; }
    if (mode === 'confirmExit') {
      if (key.escape) setMode('browse');
      else if (input === 'd') onBack();
      else if (input === 's') { leaveAfterSave.current = true; saveNow(saved.current?.label ?? name); }
      return;
    }
    if (mode === 'shareReview') {
      if (key.escape) setMode('browse');
      else if (input === 'p') shareTool();
      else if (input === 'a') shareTool(true);
      else if (key.upArrow || input === 'k') setReportScroll(value => Math.max(0, value - 1));
      else if (key.downArrow || input === 'j') setReportScroll(value => Math.min(Math.max(0, shareRows.length - 1), value + 1));
      return;
    }
    // Multi-line editing: the <MultilineInput> owns every key (incl. Enter for newlines
    // and Esc to save), so the view handler stays out of its way entirely.
    if (mode === 'editml') return;
    // Add-row "which kind?" chooser (transient overlay in the Inputs panel).
    if (mode === 'addkind') {
      if (!chooser) { setMode('browse'); return; }
      if (key.escape) { setMode('browse'); setChooser(null); return; }
      if (key.upArrow || input === 'k') { setChooser(c => (c ? { ...c, sel: Math.max(0, c.sel - 1) } : c)); return; }
      if (key.downArrow || input === 'j') { setChooser(c => (c ? { ...c, sel: Math.min(c.kinds.length - 1, c.sel + 1) } : c)); return; }
      if (key.return || input === ' ') {
        const item = model[sel]; const k = chooser.kinds[chooser.sel];
        setMode('browse'); setChooser(null);
        if (item && item.type === 'blocks') addRow(item, k);
        return;
      }
      return;
    }
    // Catalog asset picker overlay - browse & choose a catalog image for an asset input.
    if (mode === 'picking') {
      if (!pick) { setMode('browse'); return; }
      if (pick.searching) { if (key.escape) setPick(p => (p ? { ...p, searching: false } : p)); return; }
      if (key.escape) { setMode('browse'); setPick(null); return; }
      if (input === '/') { setPick(p => (p ? { ...p, searching: true } : p)); return; }
      if (key.return) {
        const a = pickList[Math.min(pick.sel, pickList.length - 1)];
        setMode('browse'); setPick(null);
        if (a && pickTarget) {
          if (pickTarget.type === 'input') void setAssetInput(pickTarget.id, a.id);
          else void setFieldAsset(pickTarget.id, a.id);
        }
        return;
      }
      setPick(p => {
        if (!p) return p;
        let n = Math.min(Math.max(p.sel, 0), Math.max(0, pickList.length - 1));
        if (key.downArrow || input === 'j') n += 1;
        else if (key.upArrow || input === 'k') n -= 1;
        else if (input === 'g') n = 0;
        else if (input === 'G') n = pickList.length - 1;
        return { ...p, sel: Math.min(Math.max(0, n), Math.max(0, pickList.length - 1)) };
      });
      return;
    }
    if (mode !== 'browse') { if (key.escape) { setMode('browse'); setIcEdit(null); } return; }

    // Block sub-editor (row list / field list). Fully isolated: esc backs out a level.
    if (blk) {
      const item = model[sel];
      if (!item || item.type !== 'blocks' || !runtime) { setBlk(null); return; }
      const rws = blockRows(item);
      if (blk.field < 0) {
        // ROW LEVEL
        if (key.escape) { setBlk(null); return; }
        if (input === 'a') { openAdd(item); return; }
        const order = treeEntries(item).map(e => e.idx);
        if (order.length === 0) return;
        const pos = Math.max(0, order.indexOf(blk.row));
        if (key.upArrow || input === 'k') { setBlk({ row: order[Math.max(0, pos - 1)]!, field: -1 }); return; }
        if (key.downArrow || input === 'j') { setBlk({ row: order[Math.min(order.length - 1, pos + 1)]!, field: -1 }); return; }
        if (key.return || input === 'e' || key.rightArrow || input === 'l') { setBlk({ row: blk.row, field: 0 }); return; }
        if (input === 'd') { deleteRow(item); return; }
        if (input === '[') { moveRow(item, -1); return; }
        if (input === ']') { moveRow(item, 1); return; }
        if (nestingActive(item, topValues())) {
          if (input === '<') { reparent(item, true); return; }
          if (input === '>') { reparent(item, false, order); return; }
        }
        return;
      }
      // FIELD LEVEL
      if (key.escape) { setBlk({ row: blk.row, field: -1 }); return; }
      const vis = visibleFields(item, blk.row);
      if (vis.length === 0) return;
      const fi = Math.min(blk.field, vis.length - 1);
      if (key.upArrow || input === 'k') { setBlk({ row: blk.row, field: Math.max(0, fi - 1) }); return; }
      if (key.downArrow || input === 'j') { setBlk({ row: blk.row, field: Math.min(vis.length - 1, fi + 1) }); return; }
      const f = vis[fi]!; const t = f.type ?? 'text'; const row = rws[blk.row] ?? {};
      if (t === 'boolean' && (input === ' ' || key.return)) { setField(f.id, !(row[f.id] as boolean)); return; }
      if (t === 'select' && f.options?.length && (key.leftArrow || key.rightArrow || input === 'h' || input === 'l')) {
        const opts = f.options; const cur = Math.max(0, opts.findIndex(o => o.value === row[f.id]));
        const fwd = key.rightArrow || input === 'l';
        setField(f.id, opts[(cur + (fwd ? 1 : -1) + opts.length) % opts.length]!.value);
        return;
      }
      if (t === 'asset') { if (key.return || input === 'e') void openAssetPicker({ type: 'field', id: f.id }); return; }
      if (key.return || input === 'e') {
        // Multi-line block text (longtext fields, or ones flagged multilineFor - e.g. a
        // Design box's body) get the full editor; others the single-line field.
        setDraft(fieldStr(row[f.id]));
        setMode(t === 'longtext' || (f.multilineFor && f.multilineFor.length) ? 'editml' : 'editing');
        return;
      }
      return;
    }

    // Table grid editor. A terminal IS a grid, so this stays one level (no row→field
    // drill-in): the cursor moves over cells, row -1 being the heading row.
    if (grid) {
      const item = model[sel];
      if (!item || item.type !== 'table' || !runtime) { setGrid(null); return; }
      const t = tbl.asTable(item.value);
      const cur = tbl.clampCursor(t, grid.row, grid.col);
      if (key.escape) { setGrid(null); return; }
      if (input === 'i' || input === 'I') { setImportId(item.id); setDraft(''); setMode('importing'); return; }
      if (key.upArrow || input === 'k') { setGrid(tbl.clampCursor(t, cur.row - 1, cur.col)); return; }
      if (key.downArrow || input === 'j') { setGrid(tbl.clampCursor(t, cur.row + 1, cur.col)); return; }
      if (key.leftArrow || input === 'h') { setGrid(tbl.clampCursor(t, cur.row, cur.col - 1)); return; }
      if (key.rightArrow || input === 'l') { setGrid(tbl.clampCursor(t, cur.row, cur.col + 1)); return; }
      if (input === 'a') { setTable(item, tbl.addRow(t, cur.row)); setGrid({ row: Math.max(0, cur.row + 1), col: cur.col }); return; }
      if (input === 'A') { setTable(item, tbl.addColumn(t, cur.col)); setGrid({ row: cur.row, col: cur.col + 1 }); return; }
      if (input === 'd') { const next = tbl.deleteRow(t, cur.row); setTable(item, next); setGrid(tbl.clampCursor(next, cur.row, cur.col)); return; }
      if (input === 'D') { const next = tbl.deleteColumn(t, cur.col); setTable(item, next); setGrid(tbl.clampCursor(next, cur.row, cur.col)); return; }
      if (key.return || input === 'e') {
        if (!t.columns.length) { setTable(item, tbl.addColumn(t, -1)); setGrid({ row: -1, col: 0 }); return; }
        setGrid(cur);
        setDraft(tbl.cellAt(t, cur.row, cur.col));
        setMode('editing');
        return;
      }
      return;
    }

    if (key.escape || input === 'q') return requestBack();
    if (key.tab) {
      // Cycle only the panels that exist: Inputs (if the tool has any) · Export · Preview
      // (when it's showing content). So you can Tab INTO the preview to scroll it.
      const panels: Focus[] = [...(model.length ? ['inputs' as Focus] : []), 'export', ...(previewFocusable ? ['preview' as Focus] : [])];
      setFocus(f => panels[(Math.max(0, panels.indexOf(f)) + 1) % panels.length]!);
      return;
    }
    if (input === '?' || input === ':') { setActionSearch(''); setActionIndex(0); setMode('actions'); return; }
    if (input === 'x') { doExport(); return; }
    if (input === 's') { if (saved.current) saveNow(saved.current.label); else { setDraft(name); setMode('naming'); } return; }
    if (input === 'S') { setDraft(saved.current?.label ?? name); setMode('naming'); return; }
    if (input === 'y') { reviewShare(); return; }
    if (input === 'u') { undo(); return; }
    if (input === 'r') { redo(); return; }
    if (input === 'p' && !stacked) { setShowImage(v => !v); setShareUrl(''); return; }

    // Preview focused. Scrolling ALWAYS works on j/k (so you can read a tall palette or a
    // long result). On an INTERACTIVE tool, ←/→ additionally step between its live controls
    // (buttons/tabs/fields) and ⏎/e activates/edits the current one (auto-scrolling to it).
    if (focus === 'preview') {
      const maxScroll = Math.max(0, (htmlRuns?.length ?? 0) - previewContentRows);
      if (key.upArrow || input === 'k') { setPreviewScroll(s => Math.max(0, s - 1)); return; }
      if (key.downArrow || input === 'j') { setPreviewScroll(s => Math.min(maxScroll, s + 1)); return; }
      if (input === 'g') { setPreviewScroll(0); return; }
      if (input === 'G') { setPreviewScroll(maxScroll); return; }
      if (interactive) {
        const n = focusables.length;
        if (n) {
          if (key.leftArrow || input === 'h') { setIcSel(s => Math.max(0, s - 1)); return; }
          if (key.rightArrow || input === 'l') { setIcSel(s => Math.min(n - 1, s + 1)); return; }
          const f = icCurrent;
          if (f && f.kind === 'checkbox' && input === ' ') { ic!.activate(f.el); bumpIc(); return; }
          if (f && (key.return || input === 'e' || input === ' ')) { icActivate(f); return; }
        }
      }
      return;
    }

    if (focus === 'export') {
      if (key.upArrow || input === 'k') { setExportSel(s => Math.max(0, s - 1)); return; }
      if (key.downArrow || input === 'j') { setExportSel(s => Math.min(EXPORT_FIELDS.length - 1, s + 1)); return; }
      const f = EXPORT_FIELDS[exportSel]; if (!f) return;
      if (f.kind === 'cycle' && (key.leftArrow || key.rightArrow || key.return || input === 'h' || input === 'l')) {
        const fwd = key.rightArrow || key.return || input === 'l';
        if (f.key === 'format' && formats.length) { setFmtIdx(i => (i + (fwd ? 1 : -1) + formats.length) % formats.length); fmtLockedRef.current = true; }
        else if (f.key === 'unit') setUnitIdx(i => (i + (fwd ? 1 : -1) + UNITS.length) % UNITS.length);
        else if (f.key === 'c2pa') setC2paIdx(i => (i + (fwd ? 1 : -1) + C2PA_DAYS.length) % C2PA_DAYS.length);
        else if (f.key === 'imprint') setImprintOn(v => !v);
        else if (f.key === 'madewith') setMadeWithOn(v => !v);
        else if (f.key === 'durable') setDurableOn(v => !v);
        return;
      }
      if ((key.return || input === 'e') && f.kind === 'text') { setDraft(exportFieldValue(f.key)); setMode('editing'); }
      return;
    }

    // focus === 'inputs'
    if (key.upArrow || input === 'k') { setSel(s => Math.max(0, s - 1)); return; }
    if (key.downArrow || input === 'j') { setSel(s => Math.min(Math.max(0, model.length - 1), s + 1)); return; }
    const item = model[sel]; if (!item || !runtime) return;
    // `i` imports a CSV/JSON file into a blocks input (chart/table data) - the same engine
    // importer the web offers, so you fill rows from a spreadsheet instead of typing them.
    if ((item.type === 'blocks' || item.type === 'table') && (input === 'i' || input === 'I')) { setImportId(item.id); setDraft(''); setMode('importing'); return; }
    if (item.type === 'table' && (key.return || input === 'e')) { setGrid({ row: -1, col: 0 }); return; }
    if (item.type === 'blocks' && (key.return || input === 'e')) {
      const order = treeEntries(item).map(e => e.idx);
      setBlk({ row: order[0] ?? 0, field: -1 });
      return;
    }
    if (item.type === 'boolean' && (input === ' ' || key.return)) { runtime.setInput(item.id, (!item.value) as never).then(refresh).catch(() => {}); return; }
    if (item.type === 'select' && item.options?.length && (key.leftArrow || key.rightArrow || input === 'h' || input === 'l')) {
      const opts = item.options; const cur = Math.max(0, opts.findIndex(o => o.value === item.value));
      const fwd = key.rightArrow || input === 'l';
      runtime.setInput(item.id, opts[(cur + (fwd ? 1 : -1) + opts.length) % opts.length]!.value as never).then(refresh).catch(() => {});
      return;
    }
    // Number slider: ←/→ (or h/l) nudge by `step` (default 1), clamped to min/max. ⏎/e
    // still opens the exact-value editor below (TEXTUAL includes 'number').
    if (item.type === 'number' && (key.leftArrow || key.rightArrow || input === 'h' || input === 'l')) {
      const step = item.step && item.step > 0 ? item.step : 1;
      // Read the LIVE value from the runtime (not the React `item`, which lags a frame)
      // so fast key-repeat accumulates instead of restepping from a stale value.
      const live = (runtime.getModel() as unknown as ModelItem[]).find(m => m.id === item.id)?.value ?? item.value;
      const cur = typeof live === 'number' ? live : (parseFloat(String(live ?? '')) || 0);
      let next = cur + ((key.rightArrow || input === 'l') ? step : -step);
      if (item.min !== undefined) next = Math.max(item.min, next);
      if (item.max !== undefined) next = Math.min(item.max, next);
      next = Math.round(next * 1e6) / 1e6;   // kill float drift from fractional steps
      runtime.setInput(item.id, next as never).then(refresh).catch(() => {});
      return;
    }
    // Asset input: ⏎ browses the catalog (picker); `e` types a raw id / lolly.tools URL.
    if (item.type === 'asset' && key.return) { void openAssetPicker({ type: 'input', id: item.id }); return; }
    // Vector (fixed group of numbers): edit inline as comma-separated values, one per field.
    if (item.type === 'vector' && (key.return || input === 'e')) { setDraft(vectorDraft(item)); setMode('editing'); return; }
    if ((key.return || input === 'e') && (TEXTUAL.has(item.type) || EDITABLE_PATH.has(item.type))) {
      // longtext opens the full multi-line editor; everything else the single-line field.
      setDraft(stringifyValue(item));
      setMode(item.type === 'longtext' ? 'editml' : 'editing');
    }
  });

  const windowed = model.slice(scroll, scroll + visibleInputs);
  const range = model.length > visibleInputs ? ` ${scroll + 1}-${Math.min(scroll + visibleInputs, model.length)}/${model.length}` : '';


  // Normal (top-level) inputs list. A tool with no declared inputs (a reference utility
  // like Text Helper / Colour Palette / Countdown Timer) gets a friendly empty state so
  // the blank panel doesn't read as broken - it just has nothing to configure.
  const normalBody = loading
    ? <Text color={theme.dim}>Loading settings…</Text>
    : model.length === 0
    ? (
      <Box flexDirection="column">
        <Text color={theme.dim} wrap="wrap">This utility has no settings.</Text>
        <Text color={theme.accentName} wrap="wrap">Press x to export it{stacked ? '' : ' · p to preview'}.</Text>
      </Box>
    )
    : windowed.map((item, i) => {
        const idx = scroll + i;
        const active = focus === 'inputs' && idx === sel;
        const editingThis = active && mode === 'editing' && (TEXTUAL.has(item.type) || EDITABLE_PATH.has(item.type) || item.type === 'vector');
        const editingMlThis = active && mode === 'editml';
        return (
          <Box key={item.id} flexDirection="column">
            <Text color={active ? theme.accentName : undefined} wrap="truncate-end">{active ? '▸ ' : '  '}{item.label ?? item.id}{item.required ? ' *' : ''}</Text>
            {editingMlThis
              ? <Box paddingLeft={2}><MultilineInput value={draft} onChange={setDraft} onSubmit={commit} width={Math.max(10, inputsW - 4)} height={Math.max(3, Math.min(10, inputsH - 4))} /></Box>
              : editingThis
              ? <Box><Text color={theme.accentName}>  › </Text><TextInput value={draft} onChange={setDraft} onSubmit={commit} /></Box>
              : <Text color={active ? theme.fg : theme.dim} wrap="truncate-end">{'   ' + editHint(item)}</Text>}
          </Box>
        );
      });

  // Block ROW list (windowed around the selected row, indented for nesting).
  let rowBody: ReactNode = null;
  if (blockItem && blk && blk.field < 0) {
    const entries = treeEntries(blockItem);
    const order = entries.map(e => e.idx);
    const selPos = Math.max(0, order.indexOf(blk.row));
    const visRows = Math.max(1, inputsH - 4);
    let start = 0;
    if (order.length > visRows) start = Math.min(Math.max(0, selPos - Math.floor(visRows / 2)), order.length - visRows);
    const win = entries.slice(start, start + visRows);
    rowBody = order.length === 0
      ? <Text color={theme.dim} wrap="wrap">No rows yet - press a to add one.</Text>
      : <>{win.map(e => {
          const active = e.idx === blk.row;
          const indent = '  '.repeat(Math.min(e.depth, 6));
          return <Text key={e.idx} color={active ? theme.accentName : undefined} wrap="truncate-end">{active ? '▸ ' : '  '}{indent}{rowLabel(blockItem, e.idx)}</Text>;
        })}</>;
  }

  // Block FIELD list for one row.
  let fieldBody: ReactNode = null;
  if (blockItem && blk && blk.field >= 0) {
    const row = blockRows(blockItem)[blk.row] ?? {};
    const vis = visibleFields(blockItem, blk.row);
    const fSel = Math.min(blk.field, Math.max(0, vis.length - 1));
    const visF = Math.max(1, inputsH - 4);
    let start = 0;
    if (vis.length > visF) start = Math.min(Math.max(0, fSel - Math.floor(visF / 2)), vis.length - visF);
    const win = vis.slice(start, start + visF);
    fieldBody = vis.length === 0
      ? <Text color={theme.dim} wrap="wrap">No editable fields for this row.</Text>
      : <>{win.map((f, i) => {
          const idx = start + i;
          const active = idx === fSel;
          const t = f.type ?? 'text';
          const editingThis = active && mode === 'editing' && FIELD_TEXTUAL.has(t);
          const editingMlThis = active && mode === 'editml';
          if (editingMlThis) {
            return (
              <Box key={f.id} flexDirection="column">
                <Text color={theme.accentName} wrap="truncate-end">▸ {f.label ?? f.id}</Text>
                <Box paddingLeft={2}><MultilineInput value={draft} onChange={setDraft} onSubmit={commit} width={Math.max(10, inputsW - 4)} height={Math.max(3, Math.min(10, inputsH - 5))} /></Box>
              </Box>
            );
          }
          return (
            <Box key={f.id}>
              <Box width={14}><Text color={active ? theme.accentName : theme.dim} wrap="truncate-end">{active ? '▸ ' : '  '}{f.label ?? f.id}</Text></Box>
              {editingThis
                ? <Box><Text color={theme.accentName}>› </Text><TextInput value={draft} onChange={setDraft} onSubmit={commit} /></Box>
                : <Text color={active ? theme.fg : undefined} wrap="truncate-end">{fieldDisplay(f, row)}</Text>}
            </Box>
          );
        })}</>;
  }

  // Table GRID body: heading row, then body rows, cursor cell in reverse video. Column
  // widths are computed from the content and shrunk to the panel (columnWidths), so the
  // grid never wraps and the panel never shakes.
  let gridBody: ReactNode = null;
  if (gridItem && grid) {
    const t = tbl.asTable(gridItem.value);
    const cur = tbl.clampCursor(t, grid.row, grid.col);
    if (!t.columns.length) {
      gridBody = <Text color={theme.dim} wrap="wrap">Empty table - press A to add a column, or i to import a CSV/TSV/Markdown file.</Text>;
    } else {
      const widths = tbl.columnWidths(t, Math.max(10, inputsW - 4));
      const visRows = Math.max(1, inputsH - 5);   // borders + title + heading row + prompt
      // Window the BODY rows around the cursor; the heading row is always pinned on top.
      const bodySel = Math.max(0, cur.row);
      let start = 0;
      if (t.rows.length > visRows) start = Math.min(Math.max(0, bodySel - Math.floor(visRows / 2)), t.rows.length - visRows);
      const line = (cells: string[], rowIdx: number, dim: boolean): ReactNode => (
        <Text key={rowIdx} wrap="truncate-end">
          {widths.map((w, ci) => (
            <Text key={ci}
              inverse={rowIdx === cur.row && ci === cur.col}
              bold={rowIdx === -1}
              color={rowIdx === cur.row && ci === cur.col ? theme.accentName : dim ? theme.dim : undefined}
            >{tbl.fitCell(cells[ci] ?? '', w) + (ci === widths.length - 1 ? '' : ' ')}</Text>
          ))}
        </Text>
      );
      gridBody = (
        <>
          {line(t.columns, -1, false)}
          {t.rows.length === 0
            ? <Text color={theme.dim} wrap="truncate-end">(no rows - press a to add one)</Text>
            : t.rows.slice(start, start + visRows).map((r, i) => line(r, start + i, true))}
        </>
      );
    }
  }
  // Cell editor: an inline field UNDER the grid, so the cell being typed stays visible.
  if (gridItem && grid && mode === 'editing') {
    const t = tbl.asTable(gridItem.value);
    const cur = tbl.clampCursor(t, grid.row, grid.col);
    const where = cur.row < 0 ? `heading ${cur.col + 1}` : `${t.columns[cur.col] || `col ${cur.col + 1}`} · row ${cur.row + 1}`;
    gridBody = (<>{gridBody}
      <Box><Text color={theme.accentName}>{where} › </Text><TextInput value={draft} onChange={setDraft} onSubmit={commit} /></Box>
    </>);
  }

  // Add-kind chooser body.
  const chooserBody = mode === 'addkind' && chooser ? (
    <>
      <Text color={theme.dim} wrap="truncate-end">Add which?</Text>
      {chooser.kinds.map((k, i) => (
        <Text key={k.id} color={i === chooser.sel ? theme.accentName : undefined} wrap="truncate-end">{i === chooser.sel ? '▸ ' : '  '}{k.label}</Text>
      ))}
    </>
  ) : null;

  // Catalog asset picker body (rendered inside the Inputs panel while mode==='picking').
  const pickWinH = Math.max(3, inputsH - 5);   // title + search line + detail line + borders
  const pickSelC = pick ? Math.min(Math.max(pick.sel, 0), Math.max(0, pickList.length - 1)) : 0;
  const pickStart = Math.max(0, Math.min(pickSelC - Math.floor(pickWinH / 2), Math.max(0, pickList.length - pickWinH)));
  const pickCurrent = pickList[pickSelC];
  const pickerBody = (
    <Box flexDirection="column">
      {pick?.searching
        ? <Box><Text color={theme.accentName}>Search: </Text><TextInput value={pick.query} onChange={v => setPick(p => (p ? { ...p, query: v, sel: 0 } : p))} onSubmit={() => setPick(p => (p ? { ...p, searching: false } : p))} /></Box>
        : <Text color={theme.dim} wrap="truncate-end">{pick?.query ? `Filter: ${pick.query}  (/ change)` : '/ search · j/k · ⏎ choose · esc'}</Text>}
      {assets === null
        ? <Text color={theme.dim}>Loading catalog…</Text>
        : pickList.length === 0
          ? <Text color={theme.dim}>No catalog images match.</Text>
          : pickList.slice(pickStart, pickStart + pickWinH).map((a, i) => {
              const active = pickStart + i === pickSelC;
              return <Text key={a.id} wrap="truncate-end" color={active ? theme.accentName : undefined}>{active ? '▸ ' : '  '}{pickPrefs.favs.has(a.id) ? '★ ' : ''}{assetEmoji(a.type)} {a.id}</Text>;
            })}
      {pickCurrent ? <Text color={theme.dim} wrap="truncate-end">{'  ' + assetDetail(pickCurrent)}</Text> : null}
    </Box>
  );

  let inputsTitle = `Inputs${range}`;
  if (mode === 'picking') inputsTitle = `Catalog image${pickList.length ? ` · ${pickSelC + 1}/${pickList.length}` : ''}`;
  else if (mode === 'addkind') inputsTitle = 'Add row';
  else if (blockItem && blk) inputsTitle = blk.field < 0
    ? `${blockItem.label ?? blockItem.id} · rows`
    : `${rowLabel(blockItem, blk.row)} · fields`;
  else if (gridItem && grid) {
    const t = tbl.asTable(gridItem.value);
    const cur = tbl.clampCursor(t, grid.row, grid.col);
    inputsTitle = `${gridItem.label ?? gridItem.id} · ${t.columns.length}×${t.rows.length} · ${cur.row < 0 ? 'headings' : `row ${cur.row + 1}`}`;
  }

  const inputsBody = mode === 'picking' ? pickerBody
    : mode === 'addkind' ? chooserBody
    : blockItem && blk ? (blk.field < 0 ? rowBody : fieldBody)
    : gridItem && grid ? gridBody
    : normalBody;

  const inputsPanel = (
    <Panel title={inputsTitle} width={inputsW} height={inputsH} active={focus === 'inputs'}>
      {inputsBody}
    </Panel>
  );

  // Collapsed export strip (docFull, not focused): a single summary line, tab to expand.
  const exportPanel = exportCollapsed ? (
    <Panel title="Export ↹" width={cols} height={docExportH} active={false}>
      <Text color={theme.dim} wrap="truncate-end">{`${fmtEmoji(fmt)} ${fmt.toUpperCase()} · ${width || 'native'}×${height || 'native'} ${unit} → ${outPath}   ·   tab to change · x to export`}</Text>
    </Panel>
  ) : (
    <Panel title={linkKnobs.length ? 'Export settings · from link' : 'Export settings'} width={stacked || docFull ? cols : rightW} height={docFull ? docExportH : exportH} active={focus === 'export' && !blk && !grid}>
      {EXPORT_FIELDS.slice(Math.max(0, exportSel - Math.max(1, (docFull ? docExportH : exportH) - 5) + 1), Math.max(0, exportSel - Math.max(1, (docFull ? docExportH : exportH) - 5) + 1) + Math.max(1, (docFull ? docExportH : exportH) - 5)).map((f) => {
        const i = EXPORT_FIELDS.indexOf(f);
        const active = focus === 'export' && !blk && !grid && i === exportSel;
        const editingThis = active && mode === 'editing' && f.kind === 'text';
        return (
          <Box key={f.key}>
            <Box width={16}><Text color={active ? theme.accentName : theme.dim} wrap="truncate-end">{active ? '▸ ' : '  '}{f.label}</Text></Box>
            {editingThis
              ? <Box><Text color={theme.accentName}>› </Text><TextInput value={draft} onChange={setDraft} onSubmit={commit} /></Box>
              : <Text color={active ? theme.fg : undefined} wrap="truncate-end">{f.kind === 'cycle' && active ? `‹ ${exportFieldDisplay(f.key)} ›` : exportFieldDisplay(f.key)}</Text>}
          </Box>
        );
      })}
      <Text color={theme.dim} wrap="truncate-start">→ {outPath}</Text>
    </Panel>
  );

  // Result summaries for the utility subtypes whose output isn't a half-block raster.
  const hydrate = (s?: string | null): string => { try { return runtime ? runtime.getHydratedString(s ?? '').trim() : ''; } catch { return ''; } };
  const a11y = hydrate((manifest as { a11yLabel?: string } | null)?.a11yLabel);
  const transformBody = (() => {
    const meta = hydrate('{{metaSummary}}') || hydrate('{{tailNote}}') || hydrate('{{summary}}');
    const inLine = fileRef?.name ? `In: ${fileRef.name} · ${fmtBytes(fileRef.size)}` : 'Choose a file in the Inputs panel, then press x.';
    const pct = lastExport?.in ? `${lastExport.out <= lastExport.in ? '−' : '+'}${Math.round(Math.abs(1 - lastExport.out / lastExport.in) * 100)}%` : '';
    return (<>
      {a11y ? <Text color={theme.accentName} wrap="wrap">{a11y}</Text> : null}
      <Text color={theme.fg} wrap="wrap">{inLine}</Text>
      {meta ? <Text color={theme.dim} wrap="wrap">{meta}</Text> : null}
      {lastExport ? <Text color={theme.accentName} wrap="wrap">{`✓ ${fmtBytes(lastExport.in)} → ${fmtBytes(lastExport.out)}${pct ? ` (${pct})` : ''}`}</Text>
                  : <Text color={theme.dim} wrap="wrap">Press x to run → {basename(outPath)}</Text>}
    </>);
  })();
  const captureBody = (() => {
    const v = Object.fromEntries(model.map(m => [m.id, m.value]));
    const url = String(v.url ?? '').trim() || '(no URL set)';
    const cropped = ['cropTop', 'cropRight', 'cropBottom', 'cropLeft'].some(k => Number(v[k]) > 0);
    const recolor = String(v.recolor ?? 'none');
    return (<>
      <Text color={theme.accentName} wrap="truncate-end">{url}</Text>
      <Text color={theme.dim} wrap="wrap">{`${width || 'auto'}×${height || 'auto'} ${unit} · ${fmt.toUpperCase()}${cropped ? ' · cropped' : ''}${recolor !== 'none' ? ` · ${recolor}` : ''}`}</Text>
      <Text color={theme.dim} wrap="wrap">Live capture via Chromium - press x to shoot &amp; save.</Text>
    </>);
  })();
  const utilityBanner = (<>
    <Text color={theme.accentName} wrap="wrap">{a11y || name}</Text>
    <Text color={theme.dim} wrap="wrap">Renders as {fmt.toUpperCase()} - press x to export &amp; open.</Text>
  </>);
  // A text-based utility renders its actual HTML content as coloured terminal lines; the
  // focused interactive control (r.focused) is shown in reverse video so it's obvious.
  const htmlBody = htmlRuns && htmlRuns.length
    ? htmlRuns.slice(previewScroll, previewScroll + previewContentRows).map((ln, i) => (
        <Text key={i} wrap="truncate-end">
          {ln.length
            ? ln.map((r, j) => <Text key={j} inverse={r.focused} color={r.fg} backgroundColor={r.bg} bold={r.bold} dimColor={r.dim}>{r.text}</Text>)
            : ' '}
        </Text>
      ))
    : utilityBanner;
  // The ASCII layout mockup (box-drawing wireframe) for a designer tool - its default
  // preview, and the fallback when the colour raster isn't renderable in the terminal.
  const mockupBody = mockup && mockup.length
    ? mockup.map((ln, i) => <Text key={i} wrap="truncate-end">{ln || ' '}</Text>)
    : null;
  const previewBody = shareUrl
    ? (<><Text color={theme.accentName} wrap="wrap">{shareUrl}</Text><Text> </Text><Text color={theme.dim} wrap="wrap">Select to copy · reopens on web, CLI, or the TUI (u). p/y to dismiss.</Text></>)
    : transform ? transformBody
    : capture ? captureBody
    : htmlDoc ? htmlBody
    : (rasterPreview && showImage && !stacked)
      ? (cells && cells.length
        ? cells.map((row, ri) => <Text key={ri} wrap="truncate-end">{row.map((c, ci) => <Text key={ci} color={c.fg} backgroundColor={c.bg}>{c.ch}</Text>)}</Text>)
        : (mockupBody ?? (isUtility ? utilityBanner : <Text color={theme.dim} wrap="wrap">No terminal preview (HTML-layout output - export to view).</Text>)))
    : mockupBody
      ?? (isUtility ? utilityBanner
      : <Text color={theme.dim} wrap="wrap">Press p to render an inline preview here.</Text>);
  const scrollTag = htmlDoc && htmlRuns && htmlRuns.length > previewContentRows
    ? ` · ${previewScroll + 1}-${Math.min(previewScroll + previewContentRows, htmlRuns.length)}/${htmlRuns.length}`
    : '';
  // Keep the first word stable across hydration. Some terminals still consume the
  // first changed border-title cell on Ink's in-place repaint, so render one spare.
  const previewTitle = shareUrl ? 'Preview · share link (y)' : transform ? 'Preview · result' : capture ? 'Preview · capture'
    : htmlDoc ? `Preview · ${interactive ? 'live' : 'content'}${scrollTag}${previewFocusable && focus !== 'preview' ? ' (tab)' : ''}`
    : showImage ? 'Preview · image'
    : (mockup && mockup.length) ? 'Preview · layout · p for image'
    : 'Preview (p)';
  // Editing a live control happens in place: the whole content pane becomes the editor
  // (a textarea → the full multi-line editor, a plain field → a single-line input).
  const editingIc = !!icEdit && (mode === 'editml' || mode === 'editing');
  const icEditor = mode === 'editml'
    ? <MultilineInput value={draft} onChange={setDraft} onSubmit={commit} width={previewCols} height={Math.max(3, previewContentRows)} />
    : <Box><Text color={theme.accentName}>› </Text><TextInput value={draft} onChange={setDraft} onSubmit={commit} /></Box>;
  // The focused-control readout: which control is selected, and what ⏎ will do to it.
  const controlLine = interactive && focus === 'preview' && icCurrent && !editingIc ? (
    <Text wrap="truncate-end"><Text color={theme.dim}>{`[${icSelClamped + 1}/${focusables.length}] `}</Text><Text color={theme.accentName}>{icControlLabel(icCurrent)}</Text><Text color={theme.dim}>{`  ${icControlHint(icCurrent)}`}</Text></Text>
  ) : interactive && !editingIc ? (
    <Text color={theme.dim} wrap="truncate-end">{focusables.length ? 'tab in to use · ⏎ activate · j/k move' : 'live - no controls'}</Text>
  ) : null;
  // Show the panel for every wide layout, and - narrow - for utilities (whose result is
  // the whole point). Non-utility narrow terminals stay single-column (no preview).
  const previewPanel = (!stacked || stackedUtil) ? (
    <Panel key={previewTitle} title={` ${previewTitle}`} width={stacked ? cols : contentW} height={docFull ? contentH : stacked ? previewH : contentH} active={focus === 'preview'}>
      {editingIc ? icEditor : previewBody}
      {controlLine}
    </Panel>
  ) : null;

  const promptRow = (
    <Box height={1} paddingX={1}>
      {mode === 'confirmExit'
        ? <Text color={theme.accentName}>Unsaved changes: s save and leave / d discard / esc stay</Text>
        : mode === 'naming'
        ? <Text><Text color={theme.accentName}>Save project as: </Text><TextInput value={draft} onChange={setDraft} onSubmit={label => saveNow(label, true)} /></Text>
        : mode === 'importing'
        ? <Text><Text color={theme.accentName}>{model.find(m => m.id === importId)?.type === 'table' ? 'Import table (CSV/TSV/Markdown) file: ' : 'Import data (CSV/JSON) file: '}</Text><TextInput value={draft} onChange={setDraft} onSubmit={importNow} /></Text>
        : <Text color={status.startsWith('✓') ? theme.accentName : theme.dim} wrap="truncate-end">{status || ' '}</Text>}
    </Box>
  );

  const shareRows = mode === 'shareReview' ? report.lines : [];
  if (mode === 'linkPassword') return <Box flexDirection="column" width={cols} height={rows}>
    <Panel title="Open password-protected link" width={cols} height={Math.max(5, rows - 2)} active>
      <Text wrap="wrap">{status}</Text>
      <Box><Text>Link password: </Text><TextInput mask="*" value={draft} onChange={setDraft} onSubmit={password => { setMode('browse'); setUnlock(previous => ({ password, attempt: previous.attempt + 1 })); setDraft(''); }} /></Box>
    </Panel>
    <Text>enter open / esc cancel</Text>
  </Box>;
  if (mode === 'shareReview') return <Box flexDirection="column" width={cols} height={rows}>
    <Panel title="Review personal fields" width={cols} height={Math.max(5, rows - 2)} active>
      <Text>These values are omitted unless you include them.</Text>
      {shareRows.slice(reportScroll, reportScroll + Math.max(1, rows - 7)).map(line => <Text key={line.id} wrap="truncate-end">{line.text}</Text>)}
    </Panel>
    <Text>p omit / a include / j,k scroll / esc cancel</Text>
  </Box>;

  if (mode === 'actions' || mode === 'report' || mode === 'reviewEdit') {
    const page = Math.max(1, rows - 6);
    const start = Math.max(0, actionIndex - page + 1);
    return <Box flexDirection="column" width={cols} height={rows}>
      <Panel title={mode === 'actions' ? 'Tool actions' : report.title} width={cols} height={Math.max(4, rows - 2)} active>
        {mode === 'actions' ? <>
          <TextInput value={actionSearch} onChange={value => { setActionSearch(value); setActionIndex(0); }} placeholder="Find an action" />
          {matchingActions.slice(start, start + page).map((action, index) => <Text key={action.label} color={start + index === actionIndex ? theme.accentName : theme.dim} wrap="truncate-end">{start + index === actionIndex ? '> ' : '  '}{action.swatch && process.env.NO_COLOR === undefined ? <Text color={action.swatch}>██ </Text> : null}{action.label}</Text>)}
        </> : report.lines.slice(reportScroll, reportScroll + page).map(line => <Text key={line.id} wrap="truncate-end">{line.text || ' '}</Text>)}
      </Panel>
      <Text>{mode === 'actions' ? 'arrows choose / enter run / esc back' : mode === 'reviewEdit' ? 'a apply / j,k scroll / esc discard' : 'j,k scroll / esc back'}</Text>
    </Box>;
  }

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      <Box height={1} paddingX={1}><Text color={theme.dim}>esc ‹ </Text><Text>Tools › </Text><Text bold color={theme.accentName}>{name}</Text><Text color={theme.dim}>{'    tab: ' + (focus === 'inputs' ? 'Inputs' : focus === 'export' ? 'Export' : interactive ? 'Live' : 'Content')}</Text></Box>
      {brand ? <Box height={1} flexShrink={0} paddingX={1}><BrandStrip brand={brand} columns={cols - 2} /></Box> : null}
      {docFull
        ? <Box flexDirection="column" height={bodyH} overflow="hidden">{previewPanel}{exportPanel}</Box>
        : stacked
        ? <Box flexDirection="column" height={bodyH} overflow="hidden">{inputsPanel}{exportPanel}{stackedUtil ? previewPanel : null}</Box>
        : <Box height={bodyH} overflow="hidden">{inputsPanel}<Box flexDirection="column" width={rightW} overflow="hidden">{exportPanel}{previewPanel}</Box></Box>}
      {promptRow}
      <Footer shortcuts={footerShortcuts} />
    </Box>
  );
}

/** Short label for the focused interactive control (buttons/tabs bracketed). */
function icControlLabel(f: Focusable): string {
  const l = (f.label || f.kind).replace(/\s+/g, ' ').trim();
  const short = l.length > 28 ? l.slice(0, 27) + '…' : l;
  return f.kind === 'button' || f.kind === 'link' ? `‹${short}›` : short;
}
/** What ⏎ (or ←→) does to the focused control - shown in the status readout. */
function icControlHint(f: Focusable): string {
  if (f.kind === 'text') return '⏎ edit';
  if (f.kind === 'select') return '⏎ cycle';
  if (f.kind === 'checkbox') return 'spc toggle';
  return '⏎ activate';
}

function stringifyValue(item: ModelItem): string {
  const v = item.value;
  if (v == null) return '';
  if (typeof v === 'object') { const o = v as { value?: unknown; name?: unknown; id?: unknown }; return String(o.value ?? o.name ?? o.id ?? ''); }
  return String(v);
}
/** A vector compound → "1, 0, 0" (one value per declared field, in order) for editing. */
function vectorDraft(item: ModelItem): string {
  const fs = item.fields ?? [];
  const v = (item.value ?? {}) as Record<string, number>;
  return fs.map(f => String(v[f.id] ?? f.default ?? 0)).join(', ');
}
/** Parse "1, 0, 0" back into a vector compound { fieldId: number }, clamped per field.
 *  Missing/blank slots keep the current value; extra values are ignored. */
function parseVector(item: ModelItem, raw: string): InputValue {
  const fs = item.fields ?? [];
  const parts = raw.split(',').map(s => parseFloat(s.trim()));
  const cur = (item.value ?? {}) as Record<string, number>;
  const out: Record<string, number> = {};
  fs.forEach((f, i) => {
    let n = Number.isFinite(parts[i]) ? parts[i]! : (cur[f.id] ?? f.default ?? 0);
    if (f.min !== undefined) n = Math.max(f.min, n);
    if (f.max !== undefined) n = Math.min(f.max, n);
    out[f.id] = Math.round(n * 1e6) / 1e6;
  });
  return out as InputValue;
}
function editHint(item: ModelItem): string {
  if (item.type === 'boolean') return item.value ? '[x] on' : '[ ] off';
  if (item.type === 'select') { const o = item.options?.find(x => x.value === item.value); return `‹ ${o?.label ?? String(item.value ?? '')} ›`; }
  if (item.type === 'blocks') { const n = Array.isArray(item.value) ? item.value.length : 0; return `${n} ${n === 1 ? 'row' : 'rows'} - ⏎ to edit`; }
  if (item.type === 'table') return tbl.tableSummary(item.value);
  const s = stringifyValue(item);
  if (item.type === 'number' && item.min !== undefined && item.max !== undefined) {
    const cur = typeof item.value === 'number' ? item.value : (parseFloat(s) || 0);
    const frac = item.max > item.min ? (cur - item.min) / (item.max - item.min) : 0;
    const W = 12, filled = Math.round(Math.max(0, Math.min(1, frac)) * W);
    return `‹ ${'█'.repeat(filled)}${'░'.repeat(W - filled)} › ${cur}`;
  }
  if (item.type === 'vector') { const fs = item.fields ?? []; const v = (item.value ?? {}) as Record<string, number>; const parts = fs.map(f => `${f.label ?? f.id} ${v[f.id] ?? f.default ?? 0}`); return parts.length ? `${parts.join(' · ')}  (⏎ edit)` : '(⏎ edit)'; }
  if (item.type === 'file') return s || '(⏎ - type a file path)';
  if (item.type === 'asset') return s ? `${s}  (⏎ browse · e type)` : '(⏎ browse catalog · e type id/URL)';
  if (!TEXTUAL.has(item.type)) return s || '(edit in the web/desktop app)';
  return s || '-';
}
/** Stringify a block sub-field value (asset refs → their id/name). */
function fieldStr(v: InputValue | undefined): string {
  if (v == null) return '';
  if (typeof v === 'object') { const o = v as { value?: unknown; name?: unknown; id?: unknown }; return String(o.value ?? o.name ?? o.id ?? ''); }
  return String(v);
}
/** Display string for one block field's current value in the field list. */
function fieldDisplay(f: BlockFieldSpec, row: BlockRow): string {
  const t = f.type ?? 'text';
  const v = row[f.id];
  if (t === 'boolean') return v ? '[x] on' : '[ ] off';
  if (t === 'select') { const o = f.options?.find(x => x.value === v); return `‹ ${o?.label ?? String(v ?? '')} ›`; }
  if (t === 'asset') { const s = fieldStr(v); return s ? `${s}  (⏎ browse)` : '(⏎ browse catalog)'; }
  const s = fieldStr(v).replace(/\n/g, '↵');
  return s || '-';
}
/** A short human label for a block row (discriminator · text, or an ordinal). */
function rowLabel(item: ModelItem, idx: number): string {
  const rows = Array.isArray(item.value) ? item.value as BlockRow[] : [];
  const row = rows[idx] ?? {};
  const fields = item.fields ?? [];
  const disc = item.addMenu?.field;
  const discVal = disc ? fieldStr(row[disc]).trim() : '';
  const labelField = item.nesting?.labelField ?? (item.canvas?.textField as string | undefined);
  let text = labelField ? fieldStr(row[labelField]) : '';
  if (!text) {
    const tf = fields.find(f => (f.type ?? 'text') === 'text' && fieldStr(row[f.id]).trim());
    text = tf ? fieldStr(row[tf.id]) : '';
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (discVal && text) return `${discVal} · ${text}`;
  return text || discVal || `#${idx + 1}`;
}
