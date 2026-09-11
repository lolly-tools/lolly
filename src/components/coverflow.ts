// SPDX-License-Identifier: MPL-2.0
import { COVERFLOW_TUCK, coverflowPose } from '../lib/coverflow-geometry.ts';

interface Cover { el: HTMLElement; center: number; width: number; drawnCenter: number }
export interface CoverflowHandle {
  /** Remeasure after resize/reflow; true means motion targets need recalculating. */
  refresh(): boolean;
  paint(): void;
  /** Rebase by whole periods without changing the visible fan. Returns the shift. */
  normalize(): number;
  nearest(position?: number): number;
  target(el: HTMLElement): number;
  atClientX(x: number): HTMLElement | null;
  step(direction: number, position?: number): number;
  first(): number;
  last(): number;
  destroy(): void;
}

/** A circular fan for the shared glass tile renderer. One period of real
 * items stays in the accessibility tree; enough decorative copies fill either
 * edge even for a two-item collection. Geometry is read only on reflow, and the
 * frame painter touches only visible covers, like the Docs landing.
 * The host owns input, motion and activation; this component owns layout/looping.
 */
export function mountCoverflow(
  viewport: HTMLElement,
  track: HTMLElement,
  opts: { initialIndex?: number; onChange?: (index: number) => void } = {},
): CoverflowHandle {
  const originals = [...track.querySelectorAll<HTMLElement>('.ftile:not(.ftile--clone)')];
  let covers: Cover[] = [];
  let width = 0, period = 0, start = 0, pitch = 0, clones = 0;
  let painted = NaN, selected = -1, paintedCurrent = -1;
  let initial = true;
  const originalIndex = (absolute: number): number =>
    ((absolute - clones) % originals.length + originals.length) % originals.length;
  const nearestIndex = (position = viewport.scrollLeft): number => {
    const focus = position + width / 2;
    let best = 0, distance = Infinity;
    covers.forEach((cover, i) => {
      const d = Math.abs(cover.center - focus);
      if (d < distance) { distance = d; best = i; }
    });
    return best;
  };
  const targetAt = (index: number): number => (covers[index]?.center ?? width / 2) - width / 2;
  const clone = (el: HTMLElement): HTMLElement => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.classList.add('ftile--clone');
    copy.classList.remove('is-centred');
    copy.style.transform = copy.style.visibility = copy.style.zIndex = '';
    copy.removeAttribute('id');
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    copy.querySelectorAll<HTMLElement>('a,button,input,select,textarea,[tabindex]').forEach(node => node.tabIndex = -1);
    return copy;
  };
  function refresh(): boolean {
    const oldIndex = !initial && covers.length ? originalIndex(nearestIndex()) : Math.max(0, Math.min(originals.length - 1, opts.initialIndex ?? 0));
    const oldTarget = !initial && covers.length ? targetAt(nearestIndex()) : 0;
    const fraction = pitch ? (viewport.scrollLeft - oldTarget) / pitch : 0;
    const oldWidth = width, oldPitch = pitch, oldClones = clones;
    const nextWidth = viewport.clientWidth;
    const tileWidth = originals[0]?.offsetWidth ?? 0;
    // A hidden mount has no geometry yet. setVisible/ResizeObserver retries it.
    if (!nextWidth || !tileWidth || !originals.length) return false;
    width = nextWidth;
    const pad = Math.max(0, (width - tileWidth) / 2);
    track.style.paddingLeft = track.style.paddingRight = `${pad}px`;
    clones = originals.length > 1 ? Math.min(32, Math.max(2, Math.ceil(width / (tileWidth * COVERFLOW_TUCK)) + 2)) : 0;
    const rebuild = initial || clones !== oldClones;
    if (rebuild) {
      track.querySelectorAll('.ftile--clone').forEach(el => el.remove());
      const head = document.createDocumentFragment(), tail = document.createDocumentFragment();
      for (let i = 0; i < clones; i++) {
        head.appendChild(clone(originals[((i - clones) % originals.length + originals.length) % originals.length]!));
        tail.appendChild(clone(originals[i % originals.length]!));
      }
      track.insertBefore(head, originals[0]!);
      track.appendChild(tail);
    }
    covers = [...track.querySelectorAll<HTMLElement>('.ftile')].map(el => ({
      el, center: el.offsetLeft + el.offsetWidth / 2, width: el.offsetWidth || 1, drawnCenter: 0,
    }));
    pitch = covers.length > 1 ? covers[1]!.center - covers[0]!.center : tileWidth;
    start = targetAt(clones);
    period = clones ? targetAt(clones + originals.length) - start : 0;
    // An async stylesheet can still leave <li>s stacked vertically at mount.
    // Their identical x coordinates are not a carousel measurement. Preserve
    // the requested favourite until ResizeObserver sees the horizontal strip.
    if (originals.length > 1 && pitch <= 0) return false;
    const changed = initial || rebuild || oldWidth !== width || oldPitch !== pitch;
    if (changed) viewport.scrollLeft = targetAt(clones + oldIndex) + fraction * pitch;
    initial = false;
    painted = NaN;
    paintedCurrent = -1;
    covers.forEach(cover => cover.el.classList.remove('is-centred'));
    paint();
    return changed;
  }
  function normalize(): number {
    if (!period) return 0;
    const position = viewport.scrollLeft;
    const shift = -Math.floor((position - start + pitch / 2) / period) * period;
    if (shift) viewport.scrollLeft = position + shift;
    return shift;
  }
  function paint(): void {
    const position = viewport.scrollLeft;
    if (initial || painted === position || !covers.length) return;
    painted = position;
    const current = nearestIndex();
    if (current !== paintedCurrent) {
      covers[paintedCurrent]?.el.classList.remove('is-centred');
      covers[current]?.el.classList.add('is-centred');
      paintedCurrent = current;
    }
    const focus = position + width / 2;
    const cutoff = width / 2 / (covers[0]!.width * COVERFLOW_TUCK) + 1.5;
    covers.forEach(cover => {
      const distance = (cover.center - focus) / cover.width;
      const hidden = Math.abs(distance) > cutoff;
      if (hidden) {
        if (cover.el.style.visibility !== 'hidden') cover.el.style.visibility = 'hidden';
        return;
      }
      if (cover.el.style.visibility) cover.el.style.visibility = '';
      const pose = coverflowPose(distance, cover.width);
      cover.el.style.transform = pose.transform;
      cover.el.style.zIndex = pose.zIndex;
      cover.drawnCenter = cover.center + pose.tuck;
    });
    const real = originalIndex(current);
    if (real !== selected) { selected = real; opts.onChange?.(real); }
  }
  refresh();
  return {
    refresh, paint, normalize,
    nearest: position => targetAt(nearestIndex(position)),
    target: el => targetAt(covers.findIndex(cover => cover.el === el)),
    first: () => targetAt(clones),
    last: () => targetAt(clones + originals.length - 1),
    step: (direction, position) => targetAt(Math.max(0, Math.min(covers.length - 1, nearestIndex(position) + direction))),
    atClientX(x) {
      const rect = viewport.getBoundingClientRect();
      const local = (x - rect.left) / (rect.width / width || 1) + viewport.scrollLeft;
      let best: HTMLElement | null = null, distance = Infinity;
      covers.forEach(cover => {
        if (cover.el.style.visibility === 'hidden') return;
        const d = Math.abs(cover.drawnCenter - local);
        if (d < distance) { distance = d; best = cover.el; }
      });
      return best;
    },
    destroy() {
      track.querySelectorAll('.ftile--clone').forEach(el => el.remove());
      originals.forEach(el => {
        el.style.transform = el.style.zIndex = el.style.visibility = '';
        el.classList.remove('is-centred');
      });
      track.style.paddingLeft = track.style.paddingRight = '';
    },
  };
}
