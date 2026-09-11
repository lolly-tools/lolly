// SPDX-License-Identifier: MPL-2.0

import { DEFAULT_FILE_MAX_BYTES } from '@lolly/engine';
import type { InputFile } from '@lolly-tools/core/host-v1';
import type { InputSpec } from '../../../../engine/src/inputs.ts';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import { asRow } from './tool-types.ts';

/**
 * Canvas-as-drop-zone for render.layout:"canvas" file utilities. The whole canvas
 * accepts a drag-and-drop file; a click opens the native picker only via an explicit
 * [data-file-pick] affordance (the empty-state drop zone and the Replace button both
 * carry it). Listeners live on the stable contentEl container and a hidden <input>
 * parked in viewEl, so they survive the per-render innerHTML swaps of the canvas
 * content. The picked file is written straight into the normal input model - no
 * special-casing downstream.
 */
export function setupCanvasFileDrop({
  viewEl,
  contentEl,
  runtime,
  input,
  onDirty,
  fileToRef,
  formatBytes,
}: {
  viewEl: HTMLElement;
  contentEl: HTMLElement;
  runtime: Runtime;
  input: InputSpec;
  onDirty?: (id: string) => void;
  fileToRef: (file: File) => Promise<InputFile>;
  formatBytes: (bytes: number) => string;
}): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const id = input.id;
  const accept = Array.isArray(input.accept) ? input.accept.join(',') : '';
  const multiple = Boolean(input.multiple);

  const native = document.createElement('input');
  native.type = 'file';
  if (multiple) native.multiple = true;
  if (accept) native.accept = accept;
  native.style.display = 'none';
  viewEl.appendChild(native);

  const cap = input.maxSize ?? DEFAULT_FILE_MAX_BYTES;
  const withinCap = (file: File): boolean => {
    if (file.size > cap) {
      announce(t('That file is too large (max {size}).', { size: formatBytes(cap) }), {
        assertive: true,
      });
      return false;
    }
    return true;
  };
  const revokeValue = (value: unknown) => {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      const url = asRow(item).url;
      if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
  };
  const revokePrev = () => {
    revokeValue(runtime.getModel().find((i) => i.id === id)?.value);
  };
  // A `multiple` file input APPENDS every accepted drop to its array; a single one
  // replaces (revoking the previous preview URL). Shared by the picker + drop paths.
  const load = async (files: FileList | File[] | null | undefined) => {
    const list = files ? Array.from(files) : [];
    if (!list.length) return;
    if (multiple) {
      const accepted = list.filter(withinCap);
      const refs = await Promise.all(accepted.map(fileToRef));
      if (signal.aborted) {
        revokeValue(refs);
        return;
      }
      if (!refs.length) return;
      const cur = runtime.getModel().find((i) => i.id === id)?.value;
      const existing = Array.isArray(cur) ? cur : [];
      runtime.setInput(id, [...existing, ...refs] as never);
      onDirty?.(id);
      return;
    }
    const file = list[0];
    if (!file || !withinCap(file)) return;
    const ref = await fileToRef(file);
    if (signal.aborted) {
      revokeValue(ref);
      return;
    }
    revokePrev();
    runtime.setInput(id, ref);
    onDirty?.(id);
  };

  native.addEventListener(
    'change',
    () => {
      void load(native.files);
      native.value = '';
    },
    { signal }
  );

  // Click to pick: only an explicit [data-file-pick] affordance opens the picker (the
  // empty-state drop zone and the Replace button both carry it). We deliberately do
  // NOT treat a click on bare canvas as a pick - the canvas is full-bleed, so the dead
  // space around the centred drop zone would swallow stray clicks (including near-misses
  // on the fixed "Tools" return button in the corner) and surprise the user with a file
  // dialog. Drag-and-drop still covers the whole canvas.
  contentEl.addEventListener(
    'click',
    (e) => {
      if ((e.target as HTMLElement).closest('[data-file-pick]')) native.click();
    },
    { signal }
  );

  // Drag-and-drop over the whole canvas. A depth counter tracks enter/leave across
  // child nodes so the highlight doesn't flicker as the pointer crosses them. Only
  // real file drags count (same guard as setupCanvasBlocksDrop) - a dragged text
  // selection or in-app drag must not flash the drop highlight.
  let depth = 0;
  const setDrag = (on: boolean) => contentEl.classList.toggle('is-file-dragover', on);
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
  contentEl.addEventListener(
    'dragenter',
    (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDrag(true);
    },
    { signal }
  );
  contentEl.addEventListener(
    'dragover',
    (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    },
    { signal }
  );
  contentEl.addEventListener(
    'dragleave',
    (e) => {
      e.preventDefault();
      if (--depth <= 0) {
        depth = 0;
        setDrag(false);
      }
    },
    { signal }
  );
  contentEl.addEventListener(
    'drop',
    (e) => {
      e.preventDefault();
      depth = 0;
      setDrag(false);
      // A multiple input takes the whole drop; a single one takes the first file.
      void load(
        multiple ? e.dataTransfer?.files : e.dataTransfer?.files && [e.dataTransfer.files[0]!]
      );
    },
    { signal }
  );

  return () => {
    controller.abort();
    setDrag(false);
    native.remove();
    revokePrev();
  };
}

/**
 * Canvas-as-drop-zone for a sidebar tool that declares a `dropToAdd` blocks input
 * (e.g. logo-wall). The whole canvas - most usefully its empty state - accepts a
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
export function setupCanvasBlocksDrop<Host>({
  viewEl,
  contentEl,
  runtime,
  host,
  input,
  onDirty,
  makeDropper,
}: {
  viewEl: HTMLElement;
  contentEl: HTMLElement;
  runtime: Runtime;
  host: Host;
  input: InputSpec;
  onDirty?: (id: string) => void;
  makeDropper: (options: {
    runtime: Runtime;
    host: Host;
    input: InputSpec;
    onDirty?: (id: string) => void;
    signal?: AbortSignal;
  }) => {
    accept: string;
    addFiles: (files: FileList | File[] | null | undefined) => Promise<void>;
  };
}): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const { accept, addFiles } = makeDropper({ runtime, host, input, onDirty, signal });

  const native = document.createElement('input');
  native.type = 'file';
  native.multiple = true;
  if (accept) native.accept = accept;
  native.style.display = 'none';
  viewEl.appendChild(native);
  native.addEventListener(
    'change',
    () => {
      void addFiles(native.files);
      native.value = '';
    },
    { signal }
  );

  contentEl.addEventListener(
    'click',
    (e) => {
      if ((e.target as HTMLElement).closest('[data-file-pick]')) native.click();
    },
    { signal }
  );
  contentEl.addEventListener(
    'keydown',
    (e) => {
      if (
        (e.key === 'Enter' || e.key === ' ') &&
        (e.target as HTMLElement).closest('[data-file-pick]')
      ) {
        e.preventDefault();
        // Stop Space from also reaching setupStageNav's window-level keydown, which
        // would arm Space-to-pan; the file dialog steals focus before the keyup, so
        // it'd otherwise stay stuck on.
        e.stopPropagation();
        native.click();
      }
    },
    { signal }
  );

  let depth = 0;
  const setDrag = (on: boolean) => contentEl.classList.toggle('is-file-dragover', on);
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
  contentEl.addEventListener(
    'dragenter',
    (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDrag(true);
    },
    { signal }
  );
  contentEl.addEventListener(
    'dragover',
    (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    },
    { signal }
  );
  contentEl.addEventListener(
    'dragleave',
    (e) => {
      e.preventDefault();
      if (--depth <= 0) {
        depth = 0;
        setDrag(false);
      }
    },
    { signal }
  );
  contentEl.addEventListener(
    'drop',
    (e) => {
      e.preventDefault();
      depth = 0;
      setDrag(false);
      void addFiles(e.dataTransfer?.files);
    },
    { signal }
  );

  return () => {
    controller.abort();
    setDrag(false);
    native.remove();
  };
}
