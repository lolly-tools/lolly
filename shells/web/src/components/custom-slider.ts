// SPDX-License-Identifier: MPL-2.0
/**
 * The shell's slider - `.custom-slider` (styles in parts/fields.css, beside the
 * `.field-range` recipe it grew up next to).
 *
 * It started as the tool sidebar's control and lived inside tool-inputs.ts, wired
 * straight into a tool Runtime. Everywhere else in the app got a native
 * `<input type="range">` dressed up in CSS to look like it - two objects that had
 * to be kept looking alike by hand, and only one of them had the jelly egg-trail.
 * So the behaviour lives here now, driven by callbacks rather than a Runtime:
 *
 *   · `customSliderHtml()` + `mountCustomSlider()` - the tool sidebar's path,
 *     and anything else building its own markup.
 *   · `upgradeRangeInput()` - the chrome's path. A `.field-range` input is left in
 *     the DOM as the value + event carrier and a real slider is mounted beside it,
 *     so the ~20 surfaces holding a reference to that input (reading `.value`,
 *     listening for 'input'/'change', persisting on 'change') keep working
 *     untouched. `installRangeUpgrader()` applies it app-wide.
 *
 * The egg-trail is gated on the jelly FLAG (jellyEnabled), not on the vendored
 * jelly bundle: it is our own CSS + rAF spring, so it costs nothing to wait for.
 */
import { playSliderTick } from '../lib/sfx.ts';
import { jellyEnabled } from '../lib/jelly.ts';
import { escape } from '../utils.ts';
// The shared read (OS query OR the app's own pref) rather than a local matchMedia,
// so the profile toggle reaches the egg-trail spring too.
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';

export interface CustomSliderSpec {
  min: number;
  max: number;
  step: number;
  value: number;
  /** Appended to the spoken value ("12 px"). */
  unit?: string;
  label?: string;
  /** Detent marks under the track. On by default; off for the chrome's tight rows. */
  ticks?: boolean;
  /** Extra attributes for the host element (e.g. `data-input-id="…"`). */
  attrs?: string;
}

export interface CustomSliderHooks {
  /** Every value change - one per detent crossed while dragging. */
  onInput?: (v: number) => void;
  /** A settled value: pointer release, or a keyboard step. */
  onCommit?: (v: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

/**
 * The slider's markup. Ticks are drawn when the range has few enough stops to
 * read as detents rather than hatching.
 */
export function customSliderHtml(spec: CustomSliderSpec): string {
  const { min, max, step, unit = '', label = '', attrs = '' } = spec;
  const num = Math.min(max, Math.max(min, spec.value));
  const pct = ((num - min) / (max - min) * 100).toFixed(3);
  const stops = Math.round((max - min) / step);
  const ticks = (spec.ticks !== false && stops >= 2 && stops <= 30)
    ? `<div class="cs-ticks" aria-hidden="true">${
        Array.from({ length: stops + 1 }, (_, i) =>
          `<span class="cs-tick" style="left:${(i / stops * 100).toFixed(3)}%"></span>`
        ).join('')
      }</div>`
    : '';
  return `<div class="custom-slider" ${attrs}
      data-min="${min}" data-max="${max}" data-step="${step}"${unit ? ` data-unit="${escape(unit)}"` : ''}
      tabindex="0" role="slider" aria-label="${escape(label)}"
      aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${num}" aria-valuetext="${escape(unit ? `${num} ${unit}` : String(num))}">
    <div class="cs-track">
      <div class="cs-fill" style="width:${pct}%"></div>
      <div class="cs-thumb" style="left:${pct}%"></div>
    </div>
    ${ticks}
  </div>`;
}

/** A mounted slider's handle - for pushing a value in from outside. */
export interface MountedSlider {
  /** Move the slider to `v` (snapped + clamped) without firing any hook. */
  setValue: (v: number) => void;
}

/**
 * Wire a `.custom-slider` element: pointer drag, keyboard stepping, the detent
 * tick and the jelly egg-trail. Reads its bounds from the data-* attributes the
 * markup above carries.
 */
export function mountCustomSlider(el: HTMLElement, hooks: CustomSliderHooks = {}): MountedSlider {
  const min  = parseFloat(el.dataset.min ?? '');
  const max  = parseFloat(el.dataset.max ?? '');
  const step = parseFloat(el.dataset.step ?? '') || 1;
  const unit = el.dataset.unit || '';
  const track = el.querySelector<HTMLElement>('.cs-track')!;
  const fill  = el.querySelector<HTMLElement>('.cs-fill')!;
  const thumb = el.querySelector<HTMLElement>('.cs-thumb')!;

  let lastSnapped = parseFloat(el.getAttribute('aria-valuenow') ?? '') || min;

  // ── Jelly egg-trail (flag-gated, purely visual) ──────────────────────────
  // The thumb chases the value with a soft, VISIBLE elastic lag - the same feel
  // as the segmented nav tabs. A spring drags a "visual" position behind the
  // (always-accurate) fill end; the gap between them stretches the thumb into an
  // egg whose rounded end leads and whose pinched tail trails, and it lingers a
  // beat as the spring reels in after you stop - so you see it at normal drag
  // speed, not just fast flicks. This is POSITION-lag driven, not velocity: the
  // old velocity version only showed on quick wiggles and read as a symmetric
  // oval. The fill width, value and ARIA are never touched. Off (old CSS
  // grab-swell) when the flag is off or reduced motion is requested.
  const jelly = jellyEnabled() && !prefersReducedMotion();
  // Tunables - eyeballed against the nav tabs. STIFF/DAMP = the chase spring
  // (softer than the tabs' 260/32 so the lag reads bigger); MAX_LEN caps the
  // tail length px; GRAB/RATE = the round head's press-swell spring; TAIL_BASE
  // = how wide the tail's base is vs the head diameter.
  const J = { STIFF: 150, DAMP: 24, MAX_LEN: 64, GRAB: 1.2, RATE: 15, TAIL_BASE: 0.9 };
  let jVis = NaN, jVel = 0, jPress = 1, jLastT = 0, jRaf = 0, jDragging = false;
  const jBaseW = Math.max(6, thumb.offsetWidth || 14);
  // The trailing tail is a separate triangular element (a single scaleX'd div
  // can't keep the head circular AND taper the other end). The ROUND head
  // (.cs-thumb) stays pinned on the accurate value and follows the drag; a
  // spring drags jVis behind it, and |target − jVis| is the tail length, so the
  // tail grows as you drag and retracts elastically when you stop (the nav-tab
  // feel). Inserted before the thumb so the head paints over the tail's base.
  let jTail: HTMLElement | null = null;
  if (jelly) {
    el.classList.add('cs-jelly');
    jTail = document.createElement('div');
    jTail.className = 'cs-tail';
    jTail.setAttribute('aria-hidden', 'true');
    track.insertBefore(jTail, thumb);
  }

  // Accurate thumb centre in track pixels, read from the live left% the drag
  // handler already set - the spring chases this true position.
  function jThumbPx(): number {
    return (parseFloat(thumb.style.left) || 0) / 100 * track.clientWidth;
  }
  function jStep(t: number): void {
    jRaf = 0;
    const dt = jLastT ? Math.min(0.05, (t - jLastT) / 1000) : 1 / 60;
    jLastT = t;
    const target = jThumbPx();
    if (!Number.isFinite(jVis)) { jVis = target; jVel = 0; }
    // Slightly-underdamped spring drags the visual (tail-tip) position behind.
    jVel += (J.STIFF * (target - jVis) - J.DAMP * jVel) * dt;
    jVis += jVel * dt;
    const lag = target - jVis;                                    // +ve when moving right; tail trails opposite
    const len = Math.min(J.MAX_LEN, Math.abs(lag));               // tail length px
    jPress += ((jDragging ? J.GRAB : 1) - jPress) * (1 - Math.exp(-dt * J.RATE));
    // Round head: pinned on the value, uniform grab-swell only (stays a circle).
    thumb.style.transform = `translate(-50%, -50%) scale(${jPress.toFixed(3)})`;
    if (jTail) {
      const pct = parseFloat(thumb.style.left) || 0;
      const h = jBaseW * jPress * J.TAIL_BASE;                     // base height ≈ head diameter
      // Triangle built pointing +x (apex right); rotate 180° about its base to
      // point left. Tail points AWAY from travel: moving right (lag>0) → left.
      jTail.style.left = `${pct}%`;
      jTail.style.borderWidth = `${(h / 2).toFixed(2)}px 0 ${(h / 2).toFixed(2)}px ${len.toFixed(2)}px`;
      jTail.style.transform = `translateY(-50%) rotate(${lag > 0 ? 180 : 0}deg)`;
      jTail.style.opacity = (Math.min(1, len / 6)).toFixed(3);
    }
    const settled = !jDragging && Math.abs(lag) < 0.3 && Math.abs(jVel) < 0.6 && Math.abs(jPress - 1) < 0.003;
    if (!settled) {
      jRaf = requestAnimationFrame(jStep);
    } else {                                                       // hand the head back to plain CSS, retract the tail
      jVis = NaN; jVel = 0; jPress = 1; jLastT = 0;
      thumb.style.transform = '';
      if (jTail) { jTail.style.opacity = '0'; jTail.style.borderWidth = '0'; }
    }
  }
  function jWake(): void { if (jelly && !jRaf) { jLastT = 0; jRaf = requestAnimationFrame(jStep); } }
  // Keyboard/step change: yank the tail-tip back so the tail flicks out in the
  // step direction, then the spring reels it in.
  function jImpulse(dir: number): void {
    if (!jelly) return;
    jVis = (Number.isFinite(jVis) ? jVis : jThumbPx()) - dir * 14;
    jWake();
  }

  function snap(raw: number): number {
    const s = Math.round((raw - min) / step) * step + min;
    return +(Math.min(max, Math.max(min, s)).toFixed(10));
  }

  // Keep aria-valuenow and a human aria-valuetext (with the unit, when one exists)
  // in lockstep so screen readers announce the value on every change.
  function setAria(v: number): void {
    el.setAttribute('aria-valuenow', String(v));
    el.setAttribute('aria-valuetext', unit ? `${v} ${unit}` : String(v));
  }

  function setThumb(rawVal: number): void {
    const pct = ((Math.min(max, Math.max(min, rawVal)) - min) / (max - min) * 100).toFixed(3);
    fill.style.width = pct + '%';
    thumb.style.left = pct + '%';
  }

  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    el.focus({ preventScroll: true }); // so the keyboard handler is live right after a click
    el.setPointerCapture(e.pointerId);
    hooks.onDragStart?.();
    el.classList.add('dragging');
    if (jelly) { jDragging = true; jVis = NaN; jWake(); }

    function fromPointer(e: PointerEvent): void {
      const rect  = track.getBoundingClientRect();
      if (!rect.width) return;                      // no track to map onto - don't turn the value into NaN
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const raw   = min + ratio * (max - min);
      setThumb(raw);
      const snapped = snap(raw);
      if (snapped !== lastSnapped) {
        lastSnapped = snapped;
        setAria(snapped);
        hooks.onInput?.(snapped);
        playSliderTick(); // a soft detent per step passed (rate-limited in sfx)
      }
    }

    function onUp(): void {
      el.removeEventListener('pointermove', fromPointer);
      el.removeEventListener('pointerup', onUp);
      hooks.onDragEnd?.();
      el.classList.remove('dragging');
      if (jelly) { jDragging = false; jWake(); } // let the egg settle back to a circle
      // Snap thumb to final stop and trigger one last render
      setThumb(lastSnapped);
      hooks.onCommit?.(lastSnapped);
    }

    el.addEventListener('pointermove', fromPointer);
    el.addEventListener('pointerup', onUp);
    fromPointer(e);
  });

  el.addEventListener('keydown', e => {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp')   next = lastSnapped + step;
    else if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') next = lastSnapped - step;
    else if (e.key === 'Home')      next = min;
    else if (e.key === 'End')       next = max;
    else if (e.key === 'PageUp')    next = lastSnapped + step * 10;
    else if (e.key === 'PageDown')  next = lastSnapped - step * 10;
    if (next === null) return;
    e.preventDefault();
    const snapped = snap(next);
    if (snapped === lastSnapped) return;
    jImpulse(Math.sign(snapped - lastSnapped)); // pop the egg in the step direction
    lastSnapped = snapped;
    setThumb(lastSnapped);
    setAria(lastSnapped);
    hooks.onCommit?.(lastSnapped);
  });

  return {
    setValue(v: number): void {
      const snapped = snap(v);
      if (snapped === lastSnapped) return;
      lastSnapped = snapped;
      setThumb(snapped);
      setAria(snapped);
      jWake();
    },
  };
}

/* ── The chrome's sliders ────────────────────────────────────────────────────
 * `.field-range` (parts/fields.css) is the class every plain range in the chrome
 * opts into, so it is the one hook needed to give them all the real slider: the
 * volume pair in the Neurospicy player, the brand editor's radius and shades,
 * the type demo's weight axis, token opacity, the cropper's zoom, the HDR tuning
 * row. The native input stays and remains the value + event carrier, so nothing
 * that already talks to it has to change.
 */
const RANGE_SEL = 'input.field-range';

/**
 * Fired on an upgraded input when its slider drag starts and ends,
 * `detail.dragging` saying which. Bubbles.
 */
export const SLIDER_DRAG_EVENT = 'lolly:slider-drag';

/** The prototype value accessor, so a patched element can still reach the real one. */
const NATIVE_VALUE = typeof HTMLInputElement === 'undefined'
  ? undefined
  : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

/** Replace one `.field-range` input's UI with a real slider. Idempotent. */
export function upgradeRangeInput(input: HTMLInputElement): void {
  if (input.dataset.csUpgraded) return;
  const min = parseFloat(input.min || '0');
  const max = parseFloat(input.max || '100');
  const step = parseFloat(input.step || '') || 1;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return;  // nothing sane to draw
  input.dataset.csUpgraded = 'on';

  const host = document.createElement('div');
  host.innerHTML = customSliderHtml({
    min, max, step,
    value: parseFloat(input.value) || min,
    label: input.getAttribute('aria-label') ?? '',
    ticks: false,        // a volume or opacity row is too tight to hatch
    attrs: 'data-cs-for-range',
  });
  const el = host.firstElementChild as HTMLElement;
  input.after(el);
  // The input keeps the value and the events; it just stops being the control.
  // Out of the a11y tree too - the slider beside it carries the same label, and
  // both being announced would double up every slider in the chrome.
  input.classList.add('is-upgraded');
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');

  // slider → input. `echo` marks the write as ours so the mirror below doesn't
  // bounce it straight back into the slider mid-drag.
  let echo = false;
  const relay = (v: number, type: 'input' | 'change'): void => {
    echo = true;
    try {
      input.value = String(v);
      input.dispatchEvent(new Event(type, { bubbles: true }));
    } finally { echo = false; }
  };
  const slider = mountCustomSlider(el, {
    onInput: (v) => relay(v, 'input'),
    // A commit after a drag has already sent its 'input'; a keyboard step hasn't
    // (it commits straight away), and a native range fires both - so send the
    // missing one rather than a duplicate.
    onCommit: (v) => {
      if (parseFloat(input.value) !== v) relay(v, 'input');
      relay(v, 'change');
    },
    // The drag has to be announced, not just its values: a surface that rebuilds
    // its markup on 'input' (the tool sidebar, on a block field) would replace the
    // element the pointer is captured on and the drag would die on its first step.
    // Those surfaces held off by watching pointerdown/up on the input itself,
    // which no longer sees the gesture - so it is relayed as this event pair.
    onDragStart: () => input.dispatchEvent(new CustomEvent(SLIDER_DRAG_EVENT, { bubbles: true, detail: { dragging: true } })),
    onDragEnd: () => input.dispatchEvent(new CustomEvent(SLIDER_DRAG_EVENT, { bubbles: true, detail: { dragging: false } })),
  });

  // input → slider. Surfaces set `input.value` directly to push state back into a
  // slider (the brand editor's radius, the type demo's weight axis, a player
  // reopening at the stored volume) and mostly fire no event with it, so there is
  // nothing to listen for - the property itself is the hook.
  if (NATIVE_VALUE?.get && NATIVE_VALUE.set) {
    const { get, set } = NATIVE_VALUE;
    Object.defineProperty(input, 'value', {
      configurable: true,
      enumerable: true,
      get(this: HTMLInputElement): string { return get.call(this) as string; },
      set(this: HTMLInputElement, v: string) {
        set.call(this, v);
        if (!echo) slider.setValue(parseFloat(get.call(this) as string));
      },
    });
  }
}

/** Upgrade every `.field-range` in `root` (or `root` itself, if it is one). */
export function upgradeRanges(root: ParentNode = document): void {
  if (root instanceof HTMLInputElement) { if (root.matches(RANGE_SEL)) upgradeRangeInput(root); return; }
  for (const el of root.querySelectorAll<HTMLInputElement>(RANGE_SEL)) upgradeRangeInput(el);
}

let watching = false;

/**
 * Sweep the document once, then upgrade sliders as they mount. Views here render
 * by writing innerHTML, so there is no single place to hook - but a mutation
 * callback runs before the next paint, so a slider is never seen as a native one
 * first. Only addedNodes are scanned, so the work is bounded by what actually
 * mounted rather than by the size of the page.
 */
export function installRangeUpgrader(): void {
  if (watching || typeof document === 'undefined' || !document.body) return;
  watching = true;
  upgradeRanges(document);
  new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) if (n instanceof Element) upgradeRanges(n);
    }
  }).observe(document.body, { childList: true, subtree: true });
}
