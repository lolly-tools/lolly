/**
 * Floating value indicator for Figma-style scrub drags.
 *
 * While a number is being dragged-to-scrub (e.g. the export width/height fields),
 * the live value is hard to read: on desktop the pointer is locked so the cursor
 * vanishes, and on touch the finger sits right on top of the field. This shows a
 * small floating bubble with the current value during the drag and hides it on
 * release.
 *
 * Two positioning modes:
 *   • anchorEl — pin the bubble above a control (desktop / pointer-locked mouse,
 *     where the pointer coordinates are frozen).
 *   • finger   — track the bubble above a touch point (mobile), so it clears the
 *     fingertip that would otherwise hide the value.
 *
 * The bubble is a single reusable element appended to <body>, positioned `fixed`
 * so it escapes any scroll/transform container. It is purely presentational
 * (aria-hidden, pointer-events: none) — the underlying <input> stays the source
 * of truth for assistive tech.
 */

const GAP = 10;       // px between the bubble's caret tip and the target
const MARGIN = 8;     // keep the bubble this far from the viewport edges
const CARET = 6;      // caret height (must match the CSS border width)
const FINGER = 22;    // half-height of the band a fingertip is assumed to cover

let bubble = null;

function ensureBubble() {
  if (bubble && bubble.isConnected) return bubble;
  bubble = document.createElement('div');
  bubble.className = 'scrub-readout';
  bubble.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bubble);
  return bubble;
}

// Place the bubble centred on targetX, above the [topAvoid, bottomAvoid] band,
// flipping below when there isn't room above. Caret tracks the true target even
// when the bubble is clamped to the viewport edge.
function place(targetX, topAvoid, bottomAvoid) {
  const b = bubble;
  const pw = b.offsetWidth;
  const ph = b.offsetHeight;

  let left = targetX - pw / 2;
  left = Math.max(MARGIN, Math.min(window.innerWidth - MARGIN - pw, left));
  b.style.left = `${Math.round(left)}px`;

  const caretX = Math.max(10, Math.min(pw - 10, targetX - left));
  b.style.setProperty('--caret-x', `${Math.round(caretX)}px`);

  let top = topAvoid - GAP - CARET - ph;   // preferred: above the target
  if (top < MARGIN) {
    top = bottomAvoid + GAP + CARET;        // no room above → flip below
    b.classList.add('is-below');
  } else {
    b.classList.remove('is-below');
  }
  b.style.top = `${Math.round(top)}px`;
}

/**
 * Show (or update) the readout.
 * @param {object} o
 * @param {string} o.text     value to display
 * @param {Element} [o.anchorEl]  anchor above this element (desktop)
 * @param {{x:number,y:number}} [o.finger]  track above this touch point (mobile)
 */
export function showScrubReadout({ text, anchorEl, finger }) {
  const b = ensureBubble();
  b.textContent = text;
  // The bubble always has layout (hidden via opacity:0, not display:none), so
  // place() can read its size right away — position first, then reveal.
  if (finger) {
    place(finger.x, finger.y - FINGER, finger.y + FINGER);
  } else if (anchorEl) {
    const r = anchorEl.getBoundingClientRect();
    place(r.left + r.width / 2, r.top, r.bottom);
  }
  b.classList.add('is-visible');
}

export function hideScrubReadout() {
  if (!bubble) return;
  bubble.classList.remove('is-visible');
}
