// SPDX-License-Identifier: MPL-2.0
/**
 * Endless horizontal drag travel - the design-tool behaviour where dragging a number
 * (or a strip) keeps going when the mouse reaches the edge of the screen, the cursor
 * reappearing on the other side while the value keeps moving.
 *
 * A page cannot move the real cursor, so this uses the Pointer Lock API, which hides
 * it and reports raw `movementX` with no edge to stop at. The lock is taken LAZILY:
 * only once a drag is within {@link EDGE_PX} of the window edge and still travelling
 * outward. A drag that never reaches an edge is untouched - plain clientX arithmetic,
 * no lock, and no browser "press Esc to show your cursor" notice. While locked, a
 * stand-in cursor (`.drag-wrap-cursor`, parts/overrides.css) is drawn where the pointer
 * would be, wrapping round the window, so the wrap reads as it does in Figma.
 *
 * Mouse and pen only: touch has no cursor and no lock. A lock the browser refuses
 * (no user activation left, an iframe without allow-pointer-lock, a denied
 * permission) just leaves the drag clamped at the edge, which is what every drag
 * did before this.
 *
 * Usage, inside an existing drag loop:
 *   const travel = dragTravel(el, downEvent);   // on pointerdown
 *   const dx = travel.move(moveEvent);          // on every pointermove: total dx
 *   travel.end();                               // on pointerup / cancel / teardown
 *
 * `onLost` fires when the lock ends by itself (Escape, a window switch) so the
 * caller can finish the gesture instead of waiting for a pointerup that the locked
 * element may never see.
 */

/** Distance from the window edge at which a drag heading outward takes the lock. */
export const EDGE_PX = 24;

export interface DragTravel {
  /** Total horizontal travel since the press, including laps round the screen. */
  move(e: PointerEvent): number;
  /** Whether the pointer is currently locked (the stand-in cursor is showing). */
  locked(): boolean;
  /** Whether a lock has been asked for or is held. Taking a lock releases pointer
   *  capture, so a caller that ends its drag on `lostpointercapture` checks this to
   *  tell the lock's own release from a real one. */
  engaged(): boolean;
  /** Release the lock and remove the stand-in cursor. Safe to call twice. */
  end(): void;
}

export function dragTravel(target: Element, down: PointerEvent, opts: { onLost?: () => void } = {}): DragTravel {
  const startX = down.clientX;
  const y = down.clientY;
  let total = 0;
  let lockedAt: number | null = null;   // travel when the lock took hold
  let lockTravel = 0;                    // movementX summed since then
  let requested = false;
  let ended = false;
  let cursor: HTMLElement | null = null;
  const canLock = down.pointerType !== 'touch' && typeof target.requestPointerLock === 'function';

  const isLocked = (): boolean => document.pointerLockElement === target;

  const paintCursor = (): void => {
    if (!cursor) return;
    const w = window.innerWidth || 1;
    const x = (((startX + total) % w) + w) % w;
    cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const onLockChange = (): void => {
    if (ended) return;
    if (isLocked()) {
      lockedAt = total;
      lockTravel = 0;
      cursor = document.createElement('div');
      cursor.className = 'drag-wrap-cursor';
      cursor.setAttribute('aria-hidden', 'true');
      document.body.appendChild(cursor);
      paintCursor();
      return;
    }
    // The lock ended without us asking: Escape, a window switch, a permission
    // prompt. Drop the stand-in and let the caller end the gesture.
    if (lockedAt != null) {
      cleanup();
      opts.onLost?.();
    }
  };

  const cleanup = (): void => {
    document.removeEventListener('pointerlockchange', onLockChange);
    cursor?.remove();
    cursor = null;
    lockedAt = null;
  };

  if (canLock) document.addEventListener('pointerlockchange', onLockChange);

  return {
    move(e: PointerEvent): number {
      if (lockedAt != null && isLocked()) {
        lockTravel += e.movementX;
        total = lockedAt + lockTravel;
        paintCursor();
        return total;
      }
      total = e.clientX - startX;
      if (canLock && !requested && !ended) {
        const w = window.innerWidth;
        const outward = (e.clientX <= EDGE_PX && e.movementX < 0) || (e.clientX >= w - EDGE_PX && e.movementX > 0);
        if (outward) {
          requested = true;
          try {
            // Chrome returns a promise and rejects unadjustedMovement where the OS cannot
            // give raw input, so ask again without it. Safari returns nothing at all.
            const retry = (): void => { if (!ended) target.requestPointerLock()?.catch(() => {}); };
            target.requestPointerLock({ unadjustedMovement: true })?.catch(retry);
          } catch { /* no lock here - the drag stays clamped at the edge */ }
        }
      }
      return total;
    },
    locked: isLocked,
    engaged: () => requested && !ended,
    end(): void {
      if (ended) return;
      ended = true;
      cleanup();
      if (isLocked()) document.exitPointerLock();
    },
  };
}
