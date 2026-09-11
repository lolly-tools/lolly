// SPDX-License-Identifier: MPL-2.0
/**
 * Components as templates - the storage half.
 *
 * `views/design-import.ts` parses a design file's component masters into
 * {@link DesignTemplate}s (boxes + slots, through the SAME shared resolvers the
 * board and scene walks use). This module owns what happens next: minting one
 * ordinary saved session per component and filing them into one new Projects
 * folder named after the imported file.
 *
 * Deliberately DOM-free and parser-free, so the session/folder shaping is
 * unit-testable against a fake host (see design-templates.test.ts) without a
 * jsdom harness or the zip machinery. `views/free-canvas.ts`'s import panel is
 * the only caller: parse, then file.
 *
 * The template artifact is a plain session (plan section 2.2): nothing new has to exist
 * for a template to be stored, listed, renamed, filed, shared or backed up.
 * Template-ness is metadata in the established `__` namespace on the payload - 
 * `__template: true` plus `__slots` - which is purely additive, so old readers
 * ignore it and SESSION_FORMAT_VERSION does not move.
 */

import { createFolderStore, type FolderHost } from '../folders.ts';

/** A fill-in-the-blank in an imported template, addressed by the box it edits. */
export interface DesignTemplateSlot {
  /** The finalized box id (`n0`, `n1`, …) this slot edits. */
  boxId: string;
  kind: 'text' | 'image';
  /** The author's own shape name, e.g. `subtitle_solid`. */
  label: string;
  /** Text slots: the master's placeholder copy. */
  text?: string;
}

/** One component master, mapped to everything a saved session needs. */
export interface DesignTemplate {
  /** The component name (the session label). */
  name: string;
  /** The authored grouping path (`titles`); '' when ungrouped. */
  path: string;
  /** Design boxes, shifted to the origin. */
  boxes: unknown[];
  width: number;
  height: number;
  slots: DesignTemplateSlot[];
  /** Penpot's own component preview as a data URL, when the export carried one. */
  thumb?: string;
}

/** The slice of the web host this module writes through. */
export interface TemplateHost extends FolderHost {
  state: {
    list(): Promise<ReadonlyArray<{ slot: string }>>;
    save(slot: string, data: Record<string, unknown>, thumb?: string | null): Promise<void>;
  };
}

/** Options for {@link fileTemplatesAsSessions}. */
export interface TemplateFilingOpts {
  /** The imported file's name - the folder is named after it. */
  fileName: string;
  /** The tool the sessions resume into (the editor that ran the import). */
  toolId: string;
  toolVersion?: string;
  /** The tool's blocks input the boxes array is written to (`boxes`). */
  boxesField: string;
  /** The tool's default export format, for the session's export bar. */
  format?: string;
  /** Per-template failures are reported here and skipped, never thrown. */
  warn?: (msg: string) => void;
  /** Injected clock - the slot stamp. Tests pin it; production omits it. */
  now?: () => number;
}

/** What the import panel reports back to the user. */
export interface TemplateFilingResult {
  saved: number;
  folderName: string;
  slots: string[];
}

/** A Penpot component preview beyond this is dropped (a session record holds the
 *  data URL inline, exactly like every other session thumbnail). */
export const TEMPLATE_THUMB_MAX_BYTES = 512 * 1024;

/** The file's own name, extension stripped, as the folder is named. */
export function templateFolderName(fileName: unknown): string {
  const stem = String(fileName ?? '').replace(/\.[a-z0-9]+$/i, '').trim();
  return stem ? `${stem} templates` : 'Imported templates';
}

/**
 * The exact session payload a template saves as. Pure, so the wire shape is
 * pinned by a test rather than by reading the caller.
 */
export function templateSessionData(
  template: DesignTemplate,
  opts: { toolId: string; toolVersion?: string; boxesField: string; format?: string },
): Record<string, unknown> {
  return {
    [opts.boxesField]: template.boxes,
    __toolId: opts.toolId,
    __toolVersion: opts.toolVersion ?? '',
    __label: template.name,
    // The additive template markers (plan section 2.2). Unknown `__` keys are ignored
    // by every existing reader, so this needs no format-version bump.
    __template: true,
    __slots: template.slots,
    __export_format: opts.format ?? '',
    __export_width: String(template.width),
    __export_height: String(template.height),
    __export_unit: 'px',
  };
}

/**
 * Save one session per template and file them all into one new folder named
 * after the imported file.
 *
 * Best-effort per template: a failed save warns and the rest continue, because
 * half a design system is worth more than an aborted import. The folder is
 * created ONCE, up front, so a partially failed batch still lands somewhere the
 * user can find it. Re-importing the same file mints a second folder (plan section 2.8
 * question 2 - the v1 assumption).
 */
export async function fileTemplatesAsSessions(
  host: TemplateHost,
  templates: readonly DesignTemplate[],
  opts: TemplateFilingOpts,
): Promise<TemplateFilingResult> {
  const warn = opts.warn ?? (() => {});
  const folderName = templateFolderName(opts.fileName);
  const stamp = opts.now ? opts.now() : Date.now();
  const store = createFolderStore(host);
  let folderId: string | null = null;
  try {
    folderId = (await store.create(folderName)).id;
  } catch (err) {
    warn(`Couldn’t create the “${folderName}” folder (${msg(err)}). The templates were saved loose.`);
  }

  const slots: string[] = [];
  for (let i = 0; i < templates.length; i++) {
    const tpl = templates[i]!;
    const slot = `${opts.toolId}:${stamp + i}`;
    try {
      await host.state.save(slot, templateSessionData(tpl, opts), tpl.thumb ?? null);
      slots.push(slot);
      if (folderId) await store.addItem(folderId, { type: 'session', ref: slot });
    } catch (err) {
      warn(`Couldn’t save the “${tpl.name}” template (${msg(err)}).`);
    }
  }
  return { saved: slots.length, folderName, slots };
}

const msg = (err: unknown): string => String((err as Error)?.message || err);

// ── Penpot component previews ────────────────────────────────────────────────

/**
 * Penpot's own component preview for a master frame, as a data URL.
 *
 * The export stores it as `files/<fid>/thumbnails/component/<pageId>/<frameId>.json`
 * (a pointer record carrying `mediaId`) → `objects/<mediaId>.png`. Free, and it
 * is what the component looks like in Penpot, so a template tile needs no bake.
 *
 * The bytes are UNTRUSTED: the magic number decides the type (never the
 * declared `contentType`), only real raster formats are accepted - an SVG or
 * anything unrecognised is dropped rather than carried into an `<img>` - and an
 * oversized preview is dropped rather than inlined into a session record. The
 * result is a data URL used as an image source only; it is never inserted as
 * markup.
 */
export function penpotComponentThumb(
  files: Record<string, Uint8Array>,
  fileId: string,
  pageId: string,
  frameId: string,
): string | null {
  const ptr = files[`files/${fileId}/thumbnails/component/${pageId}/${frameId}.json`];
  if (!ptr) return null;
  let mediaId = '';
  try { mediaId = String(JSON.parse(new TextDecoder().decode(ptr)).mediaId ?? ''); }
  catch { return null; }
  if (!mediaId || /[/\\]/.test(mediaId)) return null;
  const path = Object.keys(files).find((p) => p.startsWith(`objects/${mediaId}.`) && !/\.json$/i.test(p));
  if (!path) return null;
  const bytes = files[path]!;
  if (!bytes.length || bytes.length > TEMPLATE_THUMB_MAX_BYTES) return null;
  const mime = rasterMime(bytes);
  if (!mime) return null;
  return `data:${mime};base64,${base64(bytes)}`;
}

/** The raster type the BYTES declare, or null for anything else (incl. SVG). */
function rasterMime(b: Uint8Array): string | null {
  if (b.length >= 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
  return null;
}

/** Bytes → base64, chunked (a whole-array `fromCharCode.apply` blows the stack). */
function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(s);
}

// ── slot → box ───────────────────────────────────────────────────────────────

/**
 * The box id each mapped node ended up with, positionally.
 *
 * `finalizeBoxes` mints ids from the OUTPUT index (`n0`, `n1`, …) and silently
 * drops degenerate nodes, so a node's index is not its box's index. Rather than
 * re-implement the engine's drop rule in the shell (two copies to keep in sync),
 * this walks both lists in order and pairs a node with the next box carrying its
 * geometry. Both are in the same order by construction, so the walk is linear.
 *
 * If the engine ever changes how a box is derived the pairing simply stops
 * matching, and the affected slots lose their `boxId` - it can never silently
 * hand a slot the WRONG box.
 */
/** The slice of a finalized box the pairing reads (structurally satisfied by
 *  the engine's `Box`, which has no index signature). */
export interface AlignedBox {
  id?: unknown; kind?: unknown; x?: unknown; y?: unknown; w?: unknown; h?: unknown;
}

export function alignBoxIds(
  nodes: ReadonlyArray<Record<string, unknown> | null | undefined>,
  boxes: ReadonlyArray<AlignedBox>,
): Array<string | null> {
  const out: Array<string | null> = [];
  let j = 0;
  for (const n of nodes) {
    const want = n ? nodeGeom(n) : null;
    const box = want && j < boxes.length ? boxes[j]! : null;
    if (box && want
      && String(box.kind ?? '') === want.kind
      && Number(box.x) === want.x && Number(box.y) === want.y
      && Number(box.w) === want.w && Number(box.h) === want.h) {
      out.push(String(box.id ?? ''));
      j++;
    } else {
      out.push(null);
    }
  }
  return out;
}

/** What `nodeToBox` will make of a node's kind + geometry (its rounding rules). */
function nodeGeom(n: Record<string, unknown>): { kind: string; x: number; y: number; w: number; h: number } {
  const num = (v: unknown, d: number): number => (Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    kind: n.kind === 'text' ? 'text' : (n.kind === 'image' ? 'image' : 'box'),
    x: Math.round(num(n.x, 0)),
    y: Math.round(num(n.y, 0)),
    w: Math.max(1, Math.round(num(n.w, 1))),
    h: Math.max(1, Math.round(num(n.h, 1))),
  };
}
