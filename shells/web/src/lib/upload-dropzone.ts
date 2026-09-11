// SPDX-License-Identifier: MPL-2.0
/**
 * Shared upload dropzone - the catalogue view's "Your uploads" drop area, extracted
 * into a mountable component so the #/start Catalogue tab can offer the same ingest
 * surface. Drag files in or click to browse: a <label> over a visually-hidden file
 * input, so click-to-open is native and the input stays keyboard-focusable
 * (Enter/Space opens the OS picker; .updz:focus-within draws the ring). The zone carries
 * BOTH leads and dropzone.css shows one per pointer type: drag copy for a mouse, a
 * full-width CTA on touch, where dragging a file in is not a gesture that exists.
 *
 * Files ingest through the SAME storeUserUpload path as the asset picker (downscale/
 * sanitise/credential-preserve/animated-sniff); a PDF/.ai converts page(s) to SVG
 * assets via the lazily-loaded pdf-import chunk, and a PowerPoint .pptx converts
 * chosen slide(s) the same way via pptx-import. An image is offered the shared
 * trim-to-content card first (plan 97 section 7.3 - see offerTrim below), which is why the
 * loop stores `await offerTrim(file)` rather than `file`. Ingest is sequential on purpose - 
 * parallel ingest of a big multi-drop would spike memory (each raster decode holds a
 * full bitmap) - and the single-flight guard is module-level so a mid-ingest re-mount
 * (the catalogue rebuilds its body per render) can't open a second lane. The other
 * half of that rule: a mid-ingest re-mount also STOPS the old loop from asking
 * anything (see `disposed`), because a question mounted into a container that is no
 * longer on the page can never be answered, and one unanswerable question would hold
 * that module-level lane shut for the rest of the session.
 */
import { storeUserUpload, isPdfUpload, isPptxUpload, UPLOAD_ACCEPT } from '../views/picker.ts';
import type { PickerHost } from '../views/picker.ts';
import { announce } from '../a11y.ts';
import { playSfx } from './sfx.ts';
import { escape } from '../utils.ts';
// Only the trim card's strings and the touch CTA go through t() - the zone's own copy
// predates it and its translation is a separate i18n pass, not something to half-do here.
import { t } from '../i18n.ts';
import '../styles/parts/dropzone.css';

export interface DropzoneOpts {
  /** Filetype hint line under the prompt; defaults to the full ingest-path list. */
  hint?: string;
  /** Tighter row for dense surfaces (hides the hint line). */
  compact?: boolean;
  /** Called after a successful ingest with how many assets landed. */
  onAdded?: (count: number) => void | Promise<void>;
}

// What the ingest path ACTUALLY accepts - keep in step with UPLOAD_ACCEPT.
// Rendered as glanceable category chips (label to scan, exact formats on hover) so the
// support list is subordinate to the drop prompt instead of a run-on sentence beside it.
const FORMAT_GROUPS: ReadonlyArray<{ label: string; formats: string }> = [
  { label: 'Images', formats: 'PNG, JPG, WEBP, GIF' },
  { label: 'SVG', formats: 'SVG vector' },
  { label: 'PDF & AI', formats: 'PDF, Illustrator' },
  { label: 'Slides', formats: 'PowerPoint' },
  { label: 'Audio', formats: 'MP3, WAV, OGG, M4A, FLAC' },
  { label: 'Video', formats: 'Video & Lottie' },
  { label: 'Text & code', formats: 'Text, Markdown & code files' },
];
const DEFAULT_HINT_HTML = FORMAT_GROUPS
  .map((g) => `<span class="updz-chip" title="${escape(g.formats)}">${escape(g.label)}</span>`)
  .join('');

// Lucide-style upload glyph (themes via currentColor; sized in dropzone.css).
const UPLOAD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>';

// One ingest at a time ACROSS every mounted dropzone (see the module doc above).
let ingesting = false;

/**
 * Render the dropzone into `container` and wire its ingest loop. Returns a teardown
 * that drops the listeners - call it before re-painting the surface that holds the
 * mount (an in-flight ingest keeps running and still delivers its onAdded).
 */
export function mountUploadDropzone(container: HTMLElement, host: PickerHost, opts: DropzoneOpts = {}): () => void {
  container.innerHTML = `
    <label class="updz${opts.compact ? ' updz--compact' : ''}">
      <input type="file" class="updz-input visually-hidden" multiple accept="${escape(`${UPLOAD_ACCEPT},.zip,.tar,.tgz,.gz`)}" aria-label="Upload files to your library">
      <span class="updz-icon" aria-hidden="true">${UPLOAD_ICON}</span>
      <span class="updz-copy">
        <span class="updz-text"><span class="updz-lead">Drag &amp; drop files here, or <span class="updz-browse">browse</span></span><span class="updz-cta btn btn--primary">${t('Choose files')}</span></span>
        <span class="updz-hint">${opts.hint ? escape(opts.hint) : DEFAULT_HINT_HTML}</span>
      </span>
    </label>`;
  const zone = container.querySelector<HTMLElement>('.updz')!;
  const input = container.querySelector<HTMLInputElement>('.updz-input')!;

  // Answers the trim card on the user's behalf when the surface goes away under it
  // (see offerTrim). Null whenever no card is up.
  let closeOffer: (() => void) | null = null;
  // Set by the teardown below. An ingest that outlives its mount must stop ASKING:
  // this closure's `container` is detached (or repainted) by then, so a card
  // appended to it is invisible and unanswerable, and the promise it hands back to
  // the loop would never settle - permanently latching the module-level
  // single-flight guard and killing every dropzone in the app until a reload.
  let disposed = false;

  /**
   * Plan 97 section 7.3: every surface where a user file becomes an asset offers the same
   * trim-to-content card, so a padded logo dropped here behaves like one dropped in
   * the Logos room. Resolves to the file to actually ingest - the trimmed bytes, the
   * original when the user keeps the margins, and the original untouched when the
   * file is not an image, cannot be measured, or is already tight (no card at all).
   *
   * NULL means the user backed out (Escape, or the card's ✕): that file is skipped
   * and nothing is stored for it. The loop carries on with the next one.
   *
   * MUST run before storeUserUpload: that path's normaliser strips an SVG's root
   * width/height, after which a viewBox rewrite has nothing left to bite on.
   *
   * Never rejects - a failed measurement is not a reason to fail an upload.
   */
  async function offerTrim(file: File): Promise<File | null> {
    if (disposed || !container.isConnected) return file;
    // Lazy chunk: the measure/crop code (and its canvas work) costs nothing until a
    // file actually arrives.
    const trim = await import('./design-system/trim-offer.ts').catch(() => null);
    if (!trim) return file;
    const proposal = await trim.prepareTrim(file).catch(() => null);
    if (!proposal) return file;
    // Re-checked AFTER both awaits: the measure of a big raster is long enough for
    // the surface to repaint under it.
    if (disposed || !container.isConnected) return file;
    const mount = document.createElement('div');
    mount.className = 'trimo-host';
    container.appendChild(mount);
    return new Promise<File | null>((resolve) => {
      // Assigned by the mount call below; a decision can only arrive from a click or
      // an Escape, i.e. strictly after that, so the null guard is the "already
      // answered" latch rather than a race.
      let teardown: (() => void) | null = null;
      // `restoreFocus` only when the USER answered: the card held focus and its buttons
      // are about to be removed, so hand it back to the affordance that started this.
      const finish = (chosen: File | null, restoreFocus = false): void => {
        if (!teardown) return;
        teardown();
        teardown = null;
        mount.remove();
        closeOffer = null;
        if (restoreFocus && input.isConnected) input.focus();
        resolve(chosen);
      };
      teardown = trim.mountTrimOffer(mount, proposal, {
        t,
        onResolve: (chosen) => finish(chosen, true),
        onCancel: () => finish(null, true),
      });
      // A surface that repaints while the card is up (the catalogue rebuilds its body
      // per render) calls our teardown: answer with the ORIGINAL file rather than
      // leaving the ingest loop - and, through the single-flight guard, every later
      // drop - waiting on a promise nothing will ever settle. Not a user dismissal:
      // they dropped the file, so it still lands, with the margins it arrived with.
      closeOffer = () => finish(proposal.originalFile);
    });
  }

  async function ingestFiles(files: File[]): Promise<void> {
    if (!files.length || ingesting) return;
    ingesting = true;
    try {
      await runIngest(files);
    } finally {
      // The guard is module-level, so ANY escape from the loop that left it set
      // would refuse every later drop across every mounted zone until a reload.
      // A lazy chunk that fails to load (a stale service-worker build) is the one
      // that actually happens.
      ingesting = false;
    }
  }

  async function runIngest(files: File[]): Promise<void> {
    const textEl = zone.querySelector<HTMLElement>('.updz-text');
    const idleText = textEl?.innerHTML ?? '';
    zone.classList.add('is-busy');
    if (textEl) textEl.textContent = 'Adding…';
    try {
      await ingestLoop(files, textEl);
    } finally {
      // Always, on every exit: `.is-busy` turns pointer events off, so a zone left
      // wearing it after a throw refuses every later drop even though the lane is
      // free again. Surfaces that rebuild after onAdded (the catalogue) orphan this
      // node and the restore is harmless; ones that don't get the zone back ready.
      zone.classList.remove('is-busy');
      if (textEl) textEl.innerHTML = idleText;
    }
  }

  async function ingestLoop(files: File[], textEl: HTMLElement | null): Promise<void> {
    // Explode a dropped plain archive (.zip/.tar/.tar.gz) into its member files first,
    // so its contents land in the library. Non-archives pass through untouched; an
    // office/OCF package that shares the PK magic is NOT expanded (kept as-is and
    // handled/errored by the normal path). Lazy chunk - the engine zip/tar readers
    // load only when an archive actually arrives.
    const { expandArchiveFiles, isIgnoredUploadName } = await import('./archive-ingest.ts');
    // Drop a folder extracted from a macOS zip and its `._` AppleDouble stubs / .DS_Store
    // ride along as real File drops (they never reach the archive exploder). Skip them here
    // too, so the junk filter covers both the zip-explode and the dragged-folder paths.
    const expanded = (await expandArchiveFiles(files)).filter((f) => !isIgnoredUploadName(f.name));
    if (textEl) textEl.textContent = expanded.length === 1 ? 'Adding…' : `Adding ${expanded.length} files…`;
    let stored = 0;
    for (const file of expanded) {
      try {
        // A PDF/.ai converts page(s) to SVG assets - multi-page docs ask which pages
        // (or all) via the shared picker dialog. Lazy chunk: pdf-lib loads only when
        // a PDF actually arrives. Cancelling the dialog stores nothing for that file.
        if (isPdfUpload(file)) {
          const { ingestPdfAsSvgAssets } = await import('../views/pdf-import.ts');
          const refs = await ingestPdfAsSvgAssets(host, file, {
            mode: 'multi',
            warn: (m) => announce(m, { assertive: true }),
          });
          stored += refs.length;
          continue;
        }
        // A .pptx deck converts chosen slide(s) to SVG assets the same way, via the
        // lazily-loaded pptx-import chunk (fflate + the engine reader, not pdf-lib).
        if (isPptxUpload(file)) {
          const { ingestPptxAsSvgAssets } = await import('../views/pptx-import.ts');
          const refs = await ingestPptxAsSvgAssets(host, file, {
            mode: 'multi',
            warn: (m) => announce(m, { assertive: true }),
          });
          stored += refs.length;
          continue;
        }
        // The trim question, then the ingest - in that order, and with the answer's
        // file, never the one the loop started with (offerTrim's doc comment says why).
        const answered = await offerTrim(file);
        if (!answered) continue;   // backed out of the card: this file is skipped
        await storeUserUpload(host, answered, { sourceHint: 'drop' });
        stored++;
      } catch (err) {
        host.log('error', 'Upload failed', { file: file.name, error: String(err) });
        // Cap/quota errors carry a user-ready message; prefix only the rest.
        announce((err as { code?: unknown }).code ? (err as Error).message : `Upload failed: ${(err as Error).message}`, { assertive: true });
      }
    }
    if (!stored) return;   // nothing landed; runIngest's finally restores the zone
    playSfx('drop');
    announce(`Added ${stored} file${stored === 1 ? '' : 's'} to your uploads.`);
    await opts.onAdded?.(stored);
  }

  const ac = new AbortController();
  const { signal } = ac;
  input.addEventListener('change', () => {
    const files = [...(input.files ?? [])];
    input.value = ''; // allow re-selecting the same file after an error
    void ingestFiles(files);
  }, { signal });
  // Drag-and-drop onto the zone. dragover MUST preventDefault or the drop never fires;
  // only file drags count (dragging some page image around shouldn't light it up).
  zone.addEventListener('dragover', (e) => {
    if (ingesting || !e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    zone.classList.add('is-dragover');
  }, { signal });
  zone.addEventListener('dragleave', (e) => {
    // relatedTarget still inside the zone = moving between its children, not a leave.
    if (!(e.relatedTarget instanceof Node && zone.contains(e.relatedTarget))) zone.classList.remove('is-dragover');
  }, { signal });
  zone.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.files.length) return;
    e.preventDefault();
    zone.classList.remove('is-dragover');
    void ingestFiles([...e.dataTransfer.files]);
  }, { signal });

  return () => {
    ac.abort();
    // This mount is over: an ingest still running belongs to a container that is
    // detached (or already repainted by the next mount), so it must stop asking.
    disposed = true;
    // An unanswered trim card dies with the mount: resolve it (keep the original) so
    // the ingest it is blocking can finish instead of stalling the single-flight lane.
    closeOffer?.();
  };
}
