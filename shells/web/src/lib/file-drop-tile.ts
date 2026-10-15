// SPDX-License-Identifier: MPL-2.0
/**
 * Choose-a-file tiles that take a dropped file.
 *
 * A dashed border says "drop here", so a dashed tile that opens a file picker has to
 * accept a drop as well. This module turns any tile marked `data-file-drop` into one,
 * by handing the dropped files to the function the tile's picker already calls. The
 * type and size checks stay in that shared function, never here, so a picked file and
 * a dropped file cannot be judged by two different rules.
 *
 * Keyboard and screen-reader paths are untouched: nothing here adds a focusable
 * element, a role or an accessible name. The picker stays the way in for those, and
 * a drop is the pointer's way to the same door.
 *
 * Markup contract: `data-file-drop` on the tile, `data-drop-label` for the short cue
 * drawn while a file is over it (styles/parts/components.css), and the `is-dragover`
 * class this module toggles, which each tile's own sheet turns into a solid border.
 *
 * Imports nothing from views/ and no stylesheet (the layering check).
 */

/** The cue and handlers key off this attribute. */
const TILE = '[data-file-drop]';

/**
 * The type an OS picker reports for an extension, used when a drag source gives a blank
 * `File.type`. Matches the My images picker's accept list.
 */
const TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  apng: 'image/apng',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

/**
 * HTML `accept` rules: an empty list takes anything; a token starting with a dot matches
 * the end of the file name; `type/*` matches the MIME group; anything else is an exact
 * MIME type. Case never matters.
 */
export function acceptMatches(file: File, accept: string): boolean {
  const tokens = accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

/**
 * Some drag sources hand over a blank `type`. Give the file the type a picker would have
 * reported for its extension; a typed file or an unknown extension comes back unchanged.
 */
export function withDroppedType(file: File): File {
  if (file.type) return file;
  const dot = file.name.lastIndexOf('.');
  const type = dot < 0 ? undefined : TYPE_BY_EXTENSION[file.name.slice(dot + 1).toLowerCase()];
  if (!type) return file;
  return new File([file], file.name, { type, lastModified: file.lastModified });
}

/** Split files by an `accept` list, keeping their order. */
export function splitByAccept(files: File[], accept: string): { accepted: File[]; refused: File[] } {
  const accepted: File[] = [];
  const refused: File[] = [];
  for (const file of files) (acceptMatches(file, accept) ? accepted : refused).push(file);
  return { accepted, refused };
}

/**
 * True when a drop tile inside `root` is rendered. A room that hides its tiles (a closed
 * fold, a hidden step) does not count, so a view can tell whether the pointer has a tile
 * to aim for. `selector` widens the search to a view's other drop areas, such as a room's
 * own intake zone. Without `checkVisibility` the `[hidden]` attribute is the only signal.
 */
export function hasVisibleFileDrop(root: ParentNode, selector = TILE): boolean {
  for (const el of root.querySelectorAll<HTMLElement>(selector)) {
    if (el.checkVisibility?.() ?? !el.closest('[hidden]')) return true;
  }
  return false;
}

export interface FileDropOptions {
  /** The tile's own file input: its `multiple` decides the count rule. */
  inputOf(tile: HTMLElement): HTMLInputElement | null;
  /** The function the input's `change` handler calls, so both paths share one door. */
  onFiles(tile: HTMLElement, files: File[]): void | Promise<void>;
  /** Show the refusal in the tile's own error place. */
  onRefuse(tile: HTMLElement, reason: 'count'): void;
  /** True while the picker could not be used either (a disabled button, a hidden step). */
  busy?(tile: HTMLElement): boolean;
  signal?: AbortSignal;
}

const hasFiles = (e: DragEvent): boolean => !!e.dataTransfer?.types.includes('Files');

/**
 * Wire drag-and-drop for every `[data-file-drop]` tile under `root`. Delegated on the
 * root, so a repaint that replaces the tiles keeps working.
 */
export function bindFileDropTiles(root: HTMLElement, opts: FileDropOptions): void {
  const { signal } = opts;
  const tileOf = (e: Event): HTMLElement | null => {
    const target = e.target;
    if (!(target instanceof Element)) return null;
    const tile = target.closest<HTMLElement>(TILE);
    return tile && root.contains(tile) ? tile : null;
  };
  const clear = (except?: HTMLElement): void => {
    for (const el of root.querySelectorAll<HTMLElement>(`${TILE}.is-dragover`)) {
      if (el !== except) el.classList.remove('is-dragover');
    }
  };

  // dragenter and dragover answer alike: without preventDefault the drop never fires,
  // and the browser would open the file in the tab.
  const over = (e: DragEvent): void => {
    const tile = tileOf(e);
    if (!tile || !hasFiles(e)) return; // text and internal drags keep their own meaning
    // The tile chose its destination: a view-level router or the studio's
    // drag-anywhere must not answer this drag as well.
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer) return;
    if (opts.busy?.(tile)) {
      e.dataTransfer.dropEffect = 'none';
      clear();
      return;
    }
    e.dataTransfer.dropEffect = 'copy';
    clear(tile);
    tile.classList.add('is-dragover');
  };
  root.addEventListener('dragenter', over, { signal });
  root.addEventListener('dragover', over, { signal });

  root.addEventListener(
    'dragleave',
    (e) => {
      const tile = tileOf(e);
      if (!tile) return;
      // relatedTarget still inside the tile = moving between its children, not a leave.
      const next = e.relatedTarget;
      if (!(next instanceof Node && tile.contains(next))) tile.classList.remove('is-dragover');
    },
    { signal },
  );

  root.addEventListener(
    'drop',
    (e) => {
      const tile = tileOf(e);
      const dropped = e.dataTransfer?.files;
      if (!tile || !dropped?.length) return;
      e.preventDefault();
      e.stopPropagation();
      clear();
      // A busy tile still swallows the drop so the browser does not open the file.
      if (opts.busy?.(tile)) return;
      const files = [...dropped].map(withDroppedType);
      if (files.length > 1 && !opts.inputOf(tile)?.multiple) {
        opts.onRefuse(tile, 'count');
        return;
      }
      void opts.onFiles(tile, files);
    },
    { signal },
  );
}
