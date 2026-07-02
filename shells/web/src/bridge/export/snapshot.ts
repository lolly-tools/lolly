// SPDX-License-Identifier: MPL-2.0
/**
 * Export snapshot — the capture-scoped isolation of every export-time DOM side
 * effect (finding 8).
 *
 * The renderer mutates the tool's live DOM during a capture in two ways: it
 * injects an "experimental" watermark overlay, and it detaches editor-only
 * chrome tagged [data-export-hide]. Previously each was an ad-hoc add/remove in
 * createExportAPI.render's try/finally; a leaked mutation (a thrown adapter, a
 * forgotten cleanup) would corrupt the live editor. This module collects both
 * behind a single acquire/release handle whose release() ALWAYS restores — the
 * caller wraps it in try/finally.
 *
 * Live, not cloned — deliberately. dom-to-image-more and the SVG/PDF vector
 * walkers read getComputedStyle / getBoundingClientRect from elements that must
 * be *in the document*: on a detached clone CSS variables don't resolve,
 * animations don't run, and getBoundingClientRect returns zero (see the raster
 * and watermark comments in the adapters). So faithful capture requires mutating
 * the live tree; isolation is achieved by guaranteed restoration, not by a copy.
 */

/** The stamp text for experimental / not-brand-approved exports. */
export const EXPERIMENTAL_WATERMARK_TEXT = 'EXPERIMENTAL — NOT BRAND APPROVED';

/** The corner-overlay style for the experimental watermark. Pure — unit-tested. */
export function watermarkStyle(): Partial<CSSStyleDeclaration> {
  return {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    padding: '4px 8px',
    background: 'rgba(255, 255, 255, 0.85)',
    color: '#c0392b',
    font: 'bold 10px monospace',
    border: '1px solid #c0392b',
    pointerEvents: 'none',
    zIndex: '9999',
  };
}

/**
 * From a flat list of marked elements, keep only the OUTERMOST — those with no
 * ancestor also in the list. Detaching a nested one would orphan its
 * re-insertion parent, so the restore couldn't put it back. Pure graph logic
 * over parent links (parentOf), decoupled from the DOM for unit testing.
 */
export function selectOutermost<E>(marked: readonly E[], parentOf: (e: E) => E | null): E[] {
  const set = new Set(marked);
  return marked.filter(el => {
    for (let p = parentOf(el); p; p = parentOf(p)) if (set.has(p)) return false;
    return true;
  });
}

type Cleanup = () => void;

// Injects the watermark stamp directly on the live node; returns a cleanup fn.
function applyWatermark(node: HTMLElement): Cleanup {
  const stamp = document.createElement('div');
  stamp.textContent = EXPERIMENTAL_WATERMARK_TEXT;
  Object.assign(stamp.style, watermarkStyle());
  const prevPosition = node.style.position;
  if (!node.style.position) node.style.position = 'relative';
  node.appendChild(stamp);
  return () => {
    stamp.remove();
    node.style.position = prevPosition;
  };
}

// Editor-only chrome (size previews, guides, safe-area overlays) opts out of
// EVERY export by tagging itself [data-export-hide]. Detach those nodes for the
// duration of the render and put them back exactly where they were — so no
// export path (raster, SVG, PDF, …) can pick them up regardless of how it reads
// the DOM, and the live editor is untouched afterwards.
function detachHidden(node: HTMLElement): Cleanup {
  const all = [...node.querySelectorAll<HTMLElement>('[data-export-hide]')];
  const marked = selectOutermost(all, el => el.parentElement);
  const slots = marked.map(el => ({ el, parent: el.parentNode, next: el.nextSibling }));
  slots.forEach(({ el }) => el.remove());
  return () => slots.forEach(({ el, parent, next }) => { if (parent) parent.insertBefore(el, next); });
}

export interface SnapshotOptions {
  /** Inject the experimental watermark overlay. */
  watermark?: boolean;
}

/** A capture-scoped handle over the live DOM; release() restores every effect. */
export interface ExportSnapshot {
  /** Undo every export-time mutation. Idempotent-safe under try/finally. */
  release(): void;
}

/**
 * Acquire an export snapshot over the LIVE node: apply the watermark (if asked)
 * and detach [data-export-hide] chrome. The returned handle's release() reverses
 * both, in the inverse order — hidden nodes reattached, then watermark removed —
 * matching the original try/finally discipline. Always pair with try/finally.
 */
export function acquireExportSnapshot(node: HTMLElement, opts: SnapshotOptions = {}): ExportSnapshot {
  const removeWatermark = opts.watermark ? applyWatermark(node) : null;
  const restoreHidden = detachHidden(node);
  return {
    release() {
      restoreHidden();
      removeWatermark?.();
    },
  };
}
