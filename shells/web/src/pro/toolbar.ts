// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — top toolbar wiring (chrome only, no batch state).
 *
 * Owns the three self-contained pieces of toolbar behaviour that are pure DOM
 * chrome: responsive reparenting of the unit/DPI/format/sessions controls across
 * the mobile breakpoint, auto-sizing the zip-name field so its ".zip" suffix
 * trails the text, the UI zoom (−/+) buttons, and the narrow-width hamburger menu.
 *
 * None of this touches the batch model — index.ts keeps that — so it takes only
 * the mounted view element (whose static shell index.ts has already rendered) and
 * hands back `sizeZip` (which index.ts also calls after programmatic zip-name
 * writes) plus a `detach` for teardown.
 */

/** Toolbar handles returned to the orchestrator. */
export interface ToolbarHandles {
  /** Re-measure and size the zip-name field (called after programmatic writes). */
  sizeZip(): void;
  /** Tear down observers and document/media listeners. */
  detach(): void;
}

/** Query a required element from the already-rendered shell, or fail loudly. */
function req<E extends Element>(root: ParentNode, selector: string): E {
  const el = root.querySelector<E>(selector);
  if (!el) throw new Error(`pro/toolbar: missing element ${selector}`);
  return el;
}

export function setupToolbar(viewEl: HTMLElement): ToolbarHandles {
  const renderBtn = req<HTMLButtonElement>(viewEl, '#pro-render');
  const zipNameInput = req<HTMLInputElement>(viewEl, '#pro-zip-name');

  // Unit + DPI + Format + Sessions sit next to Render on desktop, but tuck into
  // the collapsible toolbar group (hamburger menu) on mobile. CSS can't reparent
  // across the breakpoint, so relocate them on match-media change.
  const unitField = req<HTMLElement>(viewEl, '#pro-unit-field');
  const dpiField = req<HTMLElement>(viewEl, '#pro-dpi-field');
  const formatField = req<HTMLElement>(viewEl, '#pro-format-field');
  const sessionsBtn = req<HTMLElement>(viewEl, '#pro-sessions');
  const toolbarGroup = req<HTMLElement>(viewEl, '#pro-toolbar-group');
  const narrowMq = window.matchMedia('(max-width: 720px)'); // keep in sync with the @media in pro.css
  const placeFormat = (): void => {
    if (narrowMq.matches) toolbarGroup.append(unitField, dpiField, formatField, sessionsBtn);
    else renderBtn.before(unitField, dpiField, formatField, sessionsBtn); // desktop order
  };
  placeFormat();
  narrowMq.addEventListener('change', placeFormat);

  // Auto-size the zip-name field so the ".zip" suffix trails the last character
  // the user types instead of being pinned to the far right. A hidden span mirrors
  // the text to measure its pixel width; we clamp to the room the field actually
  // has so a long name scrolls inside the input rather than shoving ".zip" off the
  // edge. On mobile the field is a full-width dropdown row, so CSS owns sizing there.
  const zipField = req<HTMLElement>(viewEl, '.pro-zip');
  const zipExt = req<HTMLElement>(zipField, '.pro-zip-ext');
  const zipMeasure = document.createElement('span');
  zipMeasure.className = 'pro-zip-measure';
  zipMeasure.setAttribute('aria-hidden', 'true');
  zipField.appendChild(zipMeasure);
  const sizeZip = (): void => {
    if (narrowMq.matches) { zipNameInput.style.width = ''; return; }
    zipMeasure.textContent = zipNameInput.value || zipNameInput.placeholder || '';
    const cs = getComputedStyle(zipField);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const gap = parseFloat(cs.columnGap || cs.gap || '0') || 0;
    const room = zipField.clientWidth - padX - zipExt.offsetWidth - gap;
    const want = zipMeasure.offsetWidth + 2;        // +2 keeps the caret from clipping
    zipNameInput.style.width = `${Math.max(40, Math.min(want, room))}px`;
  };
  const zipRO = new ResizeObserver(sizeZip);        // fires on mount + toolbar/zoom reflow
  zipRO.observe(zipField);
  narrowMq.addEventListener('change', sizeZip);

  // UI zoom (the −/+ buttons): emulate Cmd +/− using the CSS `zoom` property,
  // which reflows the whole page like native zoom. Works on desktop AND lets a
  // zoomed mobile display be shrunk back down. Applied to <html> so it affects
  // the entire UI, and persisted across the session.
  const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
  const ZOOM_KEY = 'ct-ui-zoom';
  const readZoom = (): number => { const z = parseFloat(localStorage.getItem(ZOOM_KEY) ?? ''); return Number.isFinite(z) && z > 0 ? z : 1; };
  const applyZoom = (z: number): void => {
    document.documentElement.style.zoom = z === 1 ? '' : String(z);
    try { localStorage.setItem(ZOOM_KEY, String(z)); } catch { /* storage may be blocked */ }
  };
  const stepZoom = (dir: number): void => {
    const cur = readZoom();
    const i = ZOOM_STEPS.reduce((best, s, idx) => Math.abs(s - cur) < Math.abs((ZOOM_STEPS[best] ?? 1) - cur) ? idx : best, 0);
    applyZoom(ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, i + dir))] ?? 1);
  };
  applyZoom(readZoom()); // restore any prior zoom on entry
  req<HTMLButtonElement>(viewEl, '#pro-zoom-out').addEventListener('click', () => stepZoom(-1));
  req<HTMLButtonElement>(viewEl, '#pro-zoom-in').addEventListener('click', () => stepZoom(1));

  // Hamburger: at narrow widths the toolbar controls collapse into a dropdown
  // (CSS-driven); this just toggles it open and closes it on an outside tap.
  const toolbarEl = req<HTMLElement>(viewEl, '.pro-toolbar');
  const menuBtn = req<HTMLButtonElement>(viewEl, '#pro-menu');
  const closeMenu = (): void => { toolbarEl.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false'); };
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menuBtn.setAttribute('aria-expanded', toolbarEl.classList.toggle('is-open') ? 'true' : 'false');
  });
  const onDocPointer = (e: PointerEvent): void => {
    if (toolbarEl.classList.contains('is-open') && e.target instanceof Node && !toolbarEl.contains(e.target)) closeMenu();
  };
  document.addEventListener('pointerdown', onDocPointer);

  return {
    sizeZip,
    detach() {
      zipRO.disconnect();
      narrowMq.removeEventListener('change', placeFormat);
      narrowMq.removeEventListener('change', sizeZip);
      document.removeEventListener('pointerdown', onDocPointer);
    },
  };
}
