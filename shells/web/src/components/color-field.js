// SPDX-License-Identifier: MPL-2.0
/**
 * Shared SUSE colour picker — the ONE colour field used across the app.
 *
 * Renders the palette swatches + hex entry + alpha + native picker + current
 * swatch, and wires their behaviour. Both the single-tool sidebar (views/tool.js)
 * and the /pro batch grid use this, so there is a single implementation to
 * maintain (no per-view variations).
 *
 * Markup styling lives in styles/app.css (`.color-picker-field`, `.color-popover`,
 * `.color-swatch`, `.color-trigger`, …) — global, so it applies wherever this
 * markup is mounted.
 *
 *   colorFieldHtml(id, value, { float })   → HTML string for one field
 *   wireColorField(scopeEl, { onChange, onInteractStart, onInteractEnd })
 *
 * `float` makes the popover position itself (fixed) anchored to the trigger and
 * close on outside-click — for hosts where the field sits inside a clipping /
 * scrolling container (the /pro grid). Regular sidebar fields use plain CSS
 * positioning; block-colour fields keep their sidebar-spanning behaviour.
 */
import { PALETTE } from '../palette.js';
import { escape } from '../utils.js';

// The swatch source the picker renders. Defaults to the built-in brand palette
// (so the picker works before — and without — tokens), and is replaced at runtime
// by setSwatches() with swatches resolved from design tokens. Shape per swatch:
//   { value: '#rrggbb' | 'transparent', label, group, ref|null }
// `ref` is the canonical token reference ('{color.brand.jungle}'); choosing such a
// swatch stores a token value so the colour stays linked to the token.
let SWATCHES = PALETTE.map(s => ({ value: s.hex, label: s.label, group: s.group ?? null, ref: null }));

/** Replace the picker's swatches (e.g. with tokens). Ignored if empty/invalid. */
export function setSwatches(list) {
  if (Array.isArray(list) && list.length) SWATCHES = list;
}

// A colour value may be a token value object ({ ref, value }); the field UI works
// in plain colour strings, so coerce to the (cached) hex for display.
function toHex(value) {
  return (value && typeof value === 'object' && typeof value.ref === 'string') ? (value.value ?? '') : value;
}

export function colorFieldHtml(id, value, { float = false, swatchesOnly = false } = {}) {
  const rawVal = toHex(value) ?? '';
  const isTransparent = rawVal === 'transparent';
  const isHex8 = /^#[0-9a-fA-F]{8}$/.test(rawVal);
  const isHex6 = /^#[0-9a-fA-F]{6}$/.test(rawVal);
  const rgbHex = isHex8 ? rawVal.slice(0, 7) : (isHex6 ? rawVal : '#000000');
  const alphaInt = isHex8 ? parseInt(rawVal.slice(7, 9), 16) : (isTransparent ? 0 : 255);
  const alphaPct = Math.round(alphaInt / 255 * 100);
  const hexDisplay = isHex8 ? rawVal.toLowerCase() : (isHex6 ? rawVal.toLowerCase() : '');
  const previewBg = isTransparent ? '' : `style="background:${rawVal || '#000000'}"`;
  const previewClass = `color-trigger-preview${isTransparent ? ' color-swatch--transparent' : ''}`;
  const eid = escape(id);

  // Swatches are NOT rendered here — they're the heaviest part (the whole
  // palette per field) and are built lazily on first popover open (see
  // buildSwatches in wireColorField). Keeps the initial grid DOM light.
  return `<div class="color-picker-field${float ? ' color-field--float' : ''}" data-color-field="${eid}">
    <button type="button" class="color-trigger" data-color-trigger="${eid}" aria-haspopup="true" aria-expanded="false" aria-label="Colour: ${escape(hexDisplay || rawVal || '#000000')}">
      <span class="${previewClass}" ${previewBg} aria-hidden="true"></span>
      <span class="color-trigger-hex">${escape(hexDisplay || rawVal || '#000000')}</span>
    </button>
    <div class="color-popover" role="group" aria-label="Colour options" hidden>
      ${swatchesOnly ? '' : `<input type="text" class="color-hex-input" data-color-hex="${eid}"
             value="${escape(hexDisplay || rawVal || '#000000')}" placeholder="#rrggbbaa"
             maxlength="9" spellcheck="false" autocomplete="off" aria-label="Hex colour value">
      <div class="color-alpha-row">
        <span class="color-alpha-label" aria-hidden="true">A</span>
        <input type="range" class="color-alpha-slider" data-color-alpha="${eid}"
               min="0" max="255" value="${alphaInt}" aria-label="Opacity">
        <span class="color-alpha-pct" data-alpha-pct="${eid}">${alphaPct}%</span>
      </div>
      <input type="color" class="color-popover-native" data-input-id="${eid}" value="${escape(rgbHex)}" aria-label="Pick a custom colour">`}
      <div class="color-swatches"></div>
    </div>
  </div>`;
}

/** The palette swatch buttons for a field — built lazily on first popover open. */
function swatchButtonsHtml(id) {
  const eid = escape(id);
  return SWATCHES.map(s => {
    const isTrans = s.value === 'transparent';
    const refAttr = s.ref ? ` data-swatch-ref="${escape(s.ref)}"` : '';
    const label = s.group && s.label ? `${s.group} · ${s.label}` : (s.label || s.value);
    return `<button type="button"
      class="color-swatch${isTrans ? ' color-swatch--transparent' : ''}"
      data-swatch-for="${eid}" data-swatch-value="${escape(s.value)}"${refAttr}
      ${isTrans ? '' : `style="background:${escape(s.value)}"`}
      title="${escape(label)}" aria-label="${escape(label)}"></button>`;
  }).join('');
}

/**
 * Wire every colour field within `scope`. Calls onChange(id, value) with the
 * canonical value string (#rrggbb, #rrggbbaa, or 'transparent'). The trigger
 * preview + sibling controls are kept in sync so the field reflects changes
 * without the host needing to re-render.
 */
export function wireColorField(scope, { onChange = () => {}, onInteractStart, onInteractEnd } = {}) {
  const interact = (on) => { (on ? onInteractStart : onInteractEnd)?.(); };
  const q = (sel) => scope.querySelector(sel);

  function updateTrigger(field, value) {
    const preview = field?.querySelector('.color-trigger-preview');
    const hexText = field?.querySelector('.color-trigger-hex');
    const isTrans = value === 'transparent';
    if (preview) {
      preview.classList.toggle('color-swatch--transparent', isTrans);
      preview.style.background = isTrans ? '' : (value || '#000000');
    }
    if (hexText) hexText.textContent = value || '#000000';
    const trigger = field?.querySelector('.color-trigger');
    if (trigger) trigger.setAttribute('aria-label', `Colour: ${value || '#000000'}`);
  }

  // ── Palette swatches (lazy) ──────────────────────────────────────────────────
  // Apply a swatch's colour to the field, syncing the popover controls + trigger.
  // A swatch carrying a token `ref` emits a token value ({ ref, value }) so the
  // colour stays linked to the token; a plain swatch emits the hex string. Editing
  // the hex/native/alpha afterwards emits a plain string, de-linking from the token.
  function applySwatch(field, hex, ref = null) {
    const id = field.dataset.colorField;
    const native = field.querySelector('input.color-popover-native');
    const hexInput = field.querySelector('.color-hex-input');
    const alphaSlider = field.querySelector('.color-alpha-slider');
    const alphaPctEl = field.querySelector('.color-alpha-pct');
    if (native && hex.startsWith('#')) native.value = hex.slice(0, 7);
    if (hexInput) hexInput.value = hex;
    if (alphaSlider) alphaSlider.value = hex === 'transparent' ? 0 : 255;
    if (alphaPctEl) alphaPctEl.textContent = (hex === 'transparent' ? 0 : 100) + '%';
    updateTrigger(field, hex);
    onChange(id, ref ? { ref, value: hex } : hex);
  }

  // Build the swatch grid the first time a field's popover opens — deferring the
  // whole palette (the heaviest part of each colour cell) until it's needed.
  function buildSwatches(field) {
    const box = field.querySelector('.color-swatches');
    if (!box || box.childElementCount) return; // already built
    box.innerHTML = swatchButtonsHtml(field.dataset.colorField);
    box.querySelectorAll('[data-swatch-value]').forEach(btn =>
      btn.addEventListener('click', () => applySwatch(field, btn.dataset.swatchValue, btn.dataset.swatchRef || null)));
  }

  // ── Trigger: open/close the popover ──────────────────────────────────────────
  scope.querySelectorAll('[data-color-trigger]').forEach(trigger => {
    const field = trigger.closest('[data-color-field]');
    trigger.addEventListener('click', () => {
      const popover = field?.querySelector('.color-popover');
      if (!popover) return;
      scope.querySelectorAll('.color-popover:not([hidden])').forEach(p => {
        if (p !== popover) {
          p.hidden = true; p.style.cssText = '';
          p.closest('[data-color-field]')?.querySelector('.color-trigger')?.setAttribute('aria-expanded', 'false');
        }
      });
      popover.hidden = !popover.hidden;
      trigger.setAttribute('aria-expanded', String(!popover.hidden));
      if (popover.hidden) { popover.style.cssText = ''; disarmOutside(); }
      else { buildSwatches(field); positionPopover(field, trigger, popover); }
    });

    // Escape closes this field's open popover and returns focus to the trigger.
    // Bound to the field (re-created on each render) — not the persistent scope —
    // so re-wiring on re-render doesn't accumulate listeners.
    field?.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const popover = field.querySelector('.color-popover:not([hidden])');
      if (!popover) return;
      popover.hidden = true; popover.style.cssText = ''; disarmOutside();
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
      e.stopPropagation();
    });
  });

  function positionPopover(field, trigger, popover) {
    if (field.classList.contains('block-color-field')) {
      // Block colour fields span the sidebar (escape its overflow clipping).
      const sidebar = scope.closest('.sidebar-body') || scope.closest('.sidebar');
      if (sidebar) {
        const sb = sidebar.getBoundingClientRect();
        const t = trigger.getBoundingClientRect();
        popover.style.cssText = `position:fixed;top:${t.bottom + 4}px;left:${sb.left + 14}px;width:${sb.width - 28}px;right:auto;z-index:9999;`;
      }
    } else if (field.classList.contains('color-field--float')) {
      // Float: dock to the CELL frame's top-left (not the trigger's — the field's
      // padding would otherwise leave the popover a few px low), escaping any
      // scroll container; close on outside. Match the cell width when it's wider
      // than the minimum (the field is fluid at 100%), squaring the docked corner.
      const t = (trigger.closest('td') || trigger).getBoundingClientRect();
      const W = Math.max(224, Math.round(t.width));
      const left = Math.max(8, Math.min(t.left, window.innerWidth - W - 8));
      popover.style.cssText = `position:fixed;top:${Math.round(t.top)}px;left:${left}px;width:${W}px;right:auto;z-index:9999;border-top-left-radius:0;`;
      armOutside(field, popover);
    }
    // else: regular sidebar field → default CSS (absolute) positioning.
  }

  // Outside-click close (float fields only).
  let outside = null;
  function armOutside(field, popover) {
    disarmOutside();
    outside = (e) => { if (!field.contains(e.target)) { popover.hidden = true; popover.style.cssText = ''; field.querySelector('.color-trigger')?.setAttribute('aria-expanded', 'false'); disarmOutside(); } };
    setTimeout(() => document.addEventListener('pointerdown', outside), 0);
  }
  function disarmOutside() {
    if (outside) { document.removeEventListener('pointerdown', outside); outside = null; }
  }

  // ── Native colour input (RGB) ────────────────────────────────────────────────
  scope.querySelectorAll('input.color-popover-native[data-input-id]').forEach(native => {
    const id = native.dataset.inputId;
    const field = native.closest('[data-color-field]');
    native.addEventListener('pointerdown', () => interact(true));
    native.addEventListener('pointerup', () => interact(false));
    native.addEventListener('input', () => {
      const alphaSlider = q(`[data-color-alpha="${CSS.escape(id)}"]`);
      const alphaInt = alphaSlider ? parseInt(alphaSlider.value, 10) : 255;
      const fullHex = (alphaInt < 255 ? native.value + alphaInt.toString(16).padStart(2, '0') : native.value).toLowerCase();
      const hexInput = q(`[data-color-hex="${CSS.escape(id)}"]`);
      if (hexInput) hexInput.value = fullHex;
      updateTrigger(field, fullHex);
      onChange(id, fullHex);
    });
  });

  // ── Hex text entry ───────────────────────────────────────────────────────────
  scope.querySelectorAll('.color-hex-input[data-color-hex]').forEach(hexInput => {
    const id = hexInput.dataset.colorHex;
    const field = hexInput.closest('[data-color-field]');
    hexInput.addEventListener('focus', () => interact(true));
    hexInput.addEventListener('blur', () => interact(false));
    hexInput.addEventListener('input', () => {
      const raw = hexInput.value.trim();
      if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(raw)) return;
      const native = q(`input.color-popover-native[data-input-id="${CSS.escape(id)}"]`);
      if (native) native.value = raw.slice(0, 7);
      const alphaSlider = q(`[data-color-alpha="${CSS.escape(id)}"]`);
      const alphaPctEl = q(`[data-alpha-pct="${CSS.escape(id)}"]`);
      const alphaInt = raw.length === 9 ? parseInt(raw.slice(7, 9), 16) : 255;
      if (alphaSlider) alphaSlider.value = alphaInt;
      if (alphaPctEl) alphaPctEl.textContent = Math.round(alphaInt / 255 * 100) + '%';
      const finalVal = (alphaInt < 255 ? raw.slice(0, 9) : raw.slice(0, 7)).toLowerCase();
      updateTrigger(field, finalVal);
      onChange(id, finalVal);
    });
  });

  // ── Alpha slider ─────────────────────────────────────────────────────────────
  scope.querySelectorAll('.color-alpha-slider[data-color-alpha]').forEach(alphaSlider => {
    const id = alphaSlider.dataset.colorAlpha;
    const field = alphaSlider.closest('[data-color-field]');
    alphaSlider.addEventListener('pointerdown', () => interact(true));
    alphaSlider.addEventListener('pointerup', () => interact(false));
    alphaSlider.addEventListener('input', () => {
      const alphaInt = parseInt(alphaSlider.value, 10);
      const alphaPctEl = q(`[data-alpha-pct="${CSS.escape(id)}"]`);
      if (alphaPctEl) alphaPctEl.textContent = Math.round(alphaInt / 255 * 100) + '%';
      const native = q(`input.color-popover-native[data-input-id="${CSS.escape(id)}"]`);
      const rgbHex = native?.value || '#000000';
      const fullHex = (alphaInt < 255 ? rgbHex + alphaInt.toString(16).padStart(2, '0') : rgbHex).toLowerCase();
      const hexInput = q(`[data-color-hex="${CSS.escape(id)}"]`);
      if (hexInput) hexInput.value = fullHex;
      updateTrigger(field, fullHex);
      onChange(id, fullHex);
    });
  });
}
