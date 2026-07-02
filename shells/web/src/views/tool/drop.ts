// SPDX-License-Identifier: MPL-2.0
/**
 * Canvas drop zones + the shared blocks drop-to-add committer (finding 1).
 * Extracted from tool.js unchanged: setupCanvasFileDrop (layout:"canvas" file
 * utilities), setupCanvasBlocksDrop (dropToAdd blocks, e.g. logo-wall) and
 * makeBlocksDropper, which the sidebar blocks list shares so both surfaces
 * commit identically.
 */
import type { InputSpec, InputValue, InputFile, Runtime } from '@lolly/engine';
import { announce } from '../../a11y.ts';
import { storeUserUpload } from '../picker.ts';
import type { UploadHost } from '../picker.ts';
import type { InputHistory } from './input-history.ts';
import { blockFieldDefault, fmtBytes } from './constants.ts';

/** The runtime slice the drop committers read (the live model). */
type DropRuntime = Pick<Runtime, 'getModel'>;
/** The history slice edits route through — the embed editor's silent controller also satisfies it. */
type DropHistory = Pick<InputHistory, 'set'>;
/** The host slice used here (uploads go through storeUserUpload — see UploadHost
 *  in views/picker.ts; log is diagnostics). Was missing `assets` — an oversight
 *  invisible while picker.js (storeUserUpload's home) was untyped JS; the port
 *  to picker.ts surfaced it as a real type error here. */
export interface DropHost extends UploadHost {
  log?: (level: 'debug' | 'info' | 'warn' | 'error', msg: string, ctx?: object) => void;
}

/** A blocks input that declares the drop-to-add affordance (schema extension). */
export interface DropToAddInput extends InputSpec {
  dropToAdd: { field: string; accept?: string };
}

/**
 * Read a picked / dropped File into the in-memory FileRef the input model carries
 * (bytes + metadata). The bytes live only in memory and are never uploaded — the
 * url is a local object URL for previews. Shared by the sidebar file-picker and
 * the canvas drop zone so both produce an identical model value.
 */
export async function fileToRef(file: File): Promise<InputFile> {
  return {
    __file: true,
    name: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    bytes: new Uint8Array(await file.arrayBuffer()),
    url: URL.createObjectURL(file),
  };
}

/**
 * Canvas-as-drop-zone for render.layout:"canvas" file utilities. The whole canvas
 * accepts a drag-and-drop file; a click opens the native picker only via an explicit
 * [data-file-pick] affordance (the empty-state drop zone and the Replace button both
 * carry it). Listeners live on the stable contentEl container and a hidden <input>
 * parked in viewEl, so they survive the per-render innerHTML swaps of the canvas
 * content. The picked file is written straight into the normal input model — no
 * special-casing downstream.
 */
export function setupCanvasFileDrop({ viewEl, contentEl, runtime, history, input, onDirty }: {
  viewEl: HTMLElement;
  contentEl: HTMLElement;
  runtime: DropRuntime;
  history: DropHistory;
  input: InputSpec;
  onDirty?: (id: string) => void;
}): void {
  const id = input.id;
  const accept = Array.isArray(input.accept) ? input.accept.join(',') : '';

  const native = document.createElement('input');
  native.type = 'file';
  if (accept) native.accept = accept;
  native.style.display = 'none';
  viewEl.appendChild(native);

  const revokePrev = () => {
    const prev = runtime.getModel().find(i => i.id === id)?.value;
    if (prev && typeof prev === 'object' && 'url' in prev && typeof prev.url === 'string' && prev.url) URL.revokeObjectURL(prev.url);
  };
  const load = async (file: File | null | undefined): Promise<void> => {
    if (!file) return;
    if (input.maxSize && file.size > input.maxSize) {
      announce(`That file is too large (max ${fmtBytes(input.maxSize)}).`, { assertive: true });
      return;
    }
    const ref = await fileToRef(file);
    revokePrev();
    void history.set(id, ref);
    onDirty?.(id);
  };

  native.addEventListener('change', () => { void load(native.files && native.files[0]); native.value = ''; });

  // Click to pick: only an explicit [data-file-pick] affordance opens the picker (the
  // empty-state drop zone and the Replace button both carry it). We deliberately do
  // NOT treat a click on bare canvas as a pick — the canvas is full-bleed, so the dead
  // space around the centred drop zone would swallow stray clicks (including near-misses
  // on the fixed "Tools" return button in the corner) and surprise the user with a file
  // dialog. Drag-and-drop still covers the whole canvas.
  contentEl.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('[data-file-pick]')) native.click();
  });

  // Drag-and-drop over the whole canvas. A depth counter tracks enter/leave across
  // child nodes so the highlight doesn't flicker as the pointer crosses them.
  let depth = 0;
  const setDrag = (on: boolean) => contentEl.classList.toggle('is-file-dragover', on);
  contentEl.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; setDrag(true); });
  contentEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  contentEl.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (--depth <= 0) { depth = 0; setDrag(false); }
  });
  contentEl.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    setDrag(false);
    void load(e.dataTransfer?.files && e.dataTransfer.files[0]);
  });
}

/**
 * Canvas-as-drop-zone for a sidebar tool that declares a `dropToAdd` blocks input
 * (e.g. logo-wall). The whole canvas — most usefully its empty state — accepts a
 * drag-and-drop of several files and appends one block per file, exactly like
 * dropping onto the sidebar list (shared committer + _dropChains serialisation), so
 * the template's "Drop your logos here" invite actually works and a populated wall
 * still grows by dropping more. A click on an explicit [data-file-pick] affordance
 * (the empty-state invite carries one) opens the multi-file native picker. Bare-canvas
 * clicks are left alone so the full-bleed dead space can't surprise the user with a
 * file dialog, and so per-cell click-to-focus (data-canvas-input) keeps working.
 * Listeners live on the stable contentEl, so they survive the per-render innerHTML
 * swaps of the canvas content.
 */
export function setupCanvasBlocksDrop({ viewEl, contentEl, runtime, history, host, input, onDirty }: {
  viewEl: HTMLElement;
  contentEl: HTMLElement;
  runtime: DropRuntime;
  history: DropHistory;
  host: DropHost;
  input: DropToAddInput;
  onDirty?: (id: string) => void;
}): void {
  const { accept, addFiles } = makeBlocksDropper({ runtime, history, host, input, onDirty });

  const native = document.createElement('input');
  native.type = 'file';
  native.multiple = true;
  if (accept) native.accept = accept;
  native.style.display = 'none';
  viewEl.appendChild(native);
  native.addEventListener('change', () => { void addFiles(native.files); native.value = ''; });

  contentEl.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('[data-file-pick]')) native.click();
  });
  contentEl.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof Element && e.target.closest('[data-file-pick]')) {
      e.preventDefault();
      // Stop Space from also reaching setupStageNav's window-level keydown, which
      // would arm Space-to-pan; the file dialog steals focus before the keyup, so
      // it'd otherwise stay stuck on.
      e.stopPropagation();
      native.click();
    }
  });

  let depth = 0;
  const setDrag = (on: boolean) => contentEl.classList.toggle('is-file-dragover', on);
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
  contentEl.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setDrag(true); });
  contentEl.addEventListener('dragover', (e) => { if (!hasFiles(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
  contentEl.addEventListener('dragleave', (e) => { e.preventDefault(); if (--depth <= 0) { depth = 0; setDrag(false); } });
  contentEl.addEventListener('drop', (e) => { e.preventDefault(); depth = 0; setDrag(false); void addFiles(e.dataTransfer?.files); });
}

// Serialises drop-to-add commits per blocks-input id across re-renders (see the
// dropToAdd wiring below): each multi-file drop waits for the previous one to
// commit before reading the live array, so two quick drops can't both read the
// same base and clobber one another.
const _dropChains = new Map<string, Promise<void>>();

export interface BlocksDropper {
  accept: string;
  plural: string;
  addFiles(fileList: FileList | File[] | null | undefined): Promise<void>;
}

// Builds the "upload each file → append one block per file" committer for a blocks
// input that declares `dropToAdd`. Shared by the sidebar blocks list (renderInputs)
// and the canvas drop zone (setupCanvasBlocksDrop, e.g. logo-wall) so both surfaces
// accept a pile of files identically and serialise through _dropChains — a drop onto
// the canvas and one onto the sidebar can't read the same base array and clobber.
export function makeBlocksDropper({ runtime, history, host, input, onDirty }: {
  runtime: DropRuntime;
  history: DropHistory;
  host: DropHost;
  input: DropToAddInput;
  onDirty?: (id: string) => void;
}): BlocksDropper {
  const blockId = input.id;
  const field = input.dropToAdd.field;

  // Accept filter: "image/*" (default) matches any image; a trailing /* matches a
  // whole MIME group; an exact type matches itself. Files with no MIME type (some
  // OS drag sources report none) are allowed when accept has a wildcard group, so
  // they're not silently dropped — the upload path validates bytes.
  const accept = (input.dropToAdd.accept || 'image/*').trim();
  const accepted = (file: File): boolean => {
    const t = (file.type || '').toLowerCase();
    if (!accept || accept === '*' || accept === '*/*') return true;
    if (!t) return accept.includes('/*');
    return accept.split(',').some(a => {
      a = a.trim().toLowerCase();
      return a.endsWith('/*') ? t.startsWith(a.slice(0, -1)) : t === a;
    });
  };

  // The noun for prompts/announcements comes from the input label, so this stays
  // generic — a future "Documents"/"Videos" blocks input reads correctly.
  const plural = (input.label || 'files').toLowerCase();
  const singular = plural.replace(/s$/, '');

  const commit = async (fileList: File[]): Promise<void> => {
    const all = fileList;
    const files = all.filter(accepted);
    if (all.length && !files.length) { announce(`Those don't look like ${plural}.`, { assertive: true }); return; }
    if (!files.length) return;
    const made: Record<string, InputValue>[] = [];
    for (const file of files) {
      try {
        const ref = await storeUserUpload(host, file);
        const block: Record<string, InputValue> = {};
        for (const f of input.fields ?? []) block[f.id] = f.id === field ? ref : blockFieldDefault(f);
        made.push(block);
      } catch (e) {
        host.log?.('warn', `drop-to-add: couldn't add ${file.name}`, { error: String(e) });
        announce(`Couldn't add ${file.name}.`, { assertive: true });
      }
    }
    if (!made.length) return;
    // Re-read the live array at commit time: an earlier drop (or another edit) may
    // have changed it while our uploads were in flight.
    const live = runtime.getModel().find(i => i.id === blockId)?.value;
    const base = Array.isArray(live) ? live : [];
    void history.set(blockId, [...base, ...made]);
    onDirty?.(blockId);
    announce(`Added ${made.length} ${made.length === 1 ? singular : plural}.`);
  };

  // Chain commits for this input so concurrent drops/selections (from either the
  // sidebar or the canvas) serialise — each reads the live array only after the
  // previous one has committed. Snapshot the files NOW: commit runs a microtask
  // later, by which time a change handler's `value = ''` may have emptied the list.
  const addFiles = (fileList: FileList | File[] | null | undefined): Promise<void> => {
    const snapshot = Array.from(fileList || []);
    const next = (_dropChains.get(blockId) || Promise.resolve()).then(() => commit(snapshot));
    _dropChains.set(blockId, next.catch(() => {}));
    return next;
  };

  return { accept, plural, addFiles };
}
