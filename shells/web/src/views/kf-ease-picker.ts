// SPDX-License-Identifier: MPL-2.0
/**
 * The keyframe curve picker's vocabulary (plans/329): one `<select>` in three groups.
 *
 * - **Design system**: the active design system's curves and springs, offered only when
 *   it has some. Choosing one BINDS the keyframe to the token by name (`et(<path>)` on the
 *   wire, carrying the token's current value for wherever it is missing), so a change to
 *   the token changes the motion.
 * - **Curves**: the shipped curves and Hold, unchanged.
 * - **Springs**: Gentle, Quick, Bouncy and Slow.
 *
 * Custom is a state, not a route (section 8's M2.7, as before): a keyframe holding a
 * curve or spring of its own shows "Custom" or "Custom spring" in its group, and a
 * binding to a token this design system lacks shows the token's name with that said.
 * Dragging the docked plot or moving a spring parameter is what writes a custom value.
 */
import { t } from '../i18n.ts';
import { EASINGS } from '../lib/transitions.ts';
import {
  KF_EASE_TOKENS, KF_HOLD_EASE, KF_SPRING_PRESETS, kfBindEase, kfEaseKind, kfEaseName, kfEaseSpringName,
  kfEaseTokenPath, kfSpringToken, type MotionTokens,
} from '@lolly/engine';
import { kfEasePreset } from './timeline-panel/shared.ts';

/** A named spring's word. Spelled as literal calls so the catalogs can find each one. */
function springLabel(name: string): string {
  if (name === 'gentle') return t('Gentle');
  if (name === 'quick') return t('Quick');
  if (name === 'bouncy') return t('Bouncy');
  return t('Slow');
}

/** A bound option's value: the binding without its fallback, completed on commit. */
const refValue = (path: string): string => `et(${path})`;

export interface KfEasePicker {
  /** The keyframe's ease for the option now selected, ready to write. */
  easeFor(value: string): string;
}

/**
 * Fill `el` with the curve vocabulary and select the option `ease` means. Returns the
 * mapping from an option back to the ease a commit writes.
 */
export function fillKfEaseSelect(el: HTMLSelectElement, ease: string, motion: MotionTokens): KfEasePicker {
  el.textContent = '';
  const group = (label: string): HTMLOptGroupElement => {
    const g = document.createElement('optgroup');
    g.label = label;
    el.appendChild(g);
    return g;
  };
  const opt = (parent: HTMLElement, value: string, label: string): void => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    parent.appendChild(o);
  };

  const kind = kfEaseKind(ease);
  const boundPath = kind === 'token' ? kfEaseTokenPath(ease) : null;
  const bindings = new Map<string, string>();

  // ── the design system ────────────────────────────────────────────────────
  if (motion.curves.length || boundPath) {
    const ds = group(t('Design system'));
    for (const c of motion.curves) {
      const value = refValue(c.path);
      bindings.set(value, kfBindEase(c.path, c.ease) ?? c.ease);
      opt(ds, value, c.kind === 'spring' ? t('{name} spring', { name: c.label }) : c.label);
    }
    if (boundPath && !motion.curves.some((c) => c.path === boundPath)) {
      // Kept, and named for what it is: the keyframe plays the value it was saved with.
      opt(ds, refValue(boundPath), t('{name} (not in this design system)', { name: boundPath }));
      bindings.set(refValue(boundPath), ease);
    }
  }

  // ── the shipped curves ───────────────────────────────────────────────────
  const curves = group(t('Curves'));
  for (const tok of KF_EASE_TOKENS) {
    // The engine gives the curve's name; `EASINGS` gives that name its word. One vocabulary,
    // so a curve cannot be called two things in two places.
    const name = kfEaseName(tok);
    opt(curves, tok, name && Object.hasOwn(EASINGS, name) ? t((EASINGS as Record<string, string>)[name]!) : tok);
  }
  opt(curves, KF_HOLD_EASE, t('Hold'));

  // ── the springs ──────────────────────────────────────────────────────────
  const springs = group(t('Springs'));
  for (const [name, p] of Object.entries(KF_SPRING_PRESETS)) opt(springs, kfSpringToken(p), springLabel(name));

  // ── which option this keyframe is ────────────────────────────────────────
  let seed: string;
  if (boundPath) {
    seed = refValue(boundPath);
  } else if (kind === 'spring') {
    seed = ease;
    if (!kfEaseSpringName(ease)) opt(springs, ease, t('Custom spring'));
  } else {
    // ONE WIRE, NORMALISED ONE WAY ON READ (plans/179 M4): a bezier spelled like a preset
    // IS that preset, so the preset is selected rather than a Custom twin of the preset.
    seed = kfEasePreset(ease);
    if (!KF_EASE_TOKENS.includes(seed as (typeof KF_EASE_TOKENS)[number]) && seed !== KF_HOLD_EASE) opt(curves, seed, t('Custom'));
  }
  el.value = seed;
  return { easeFor: (value) => bindings.get(value) ?? value };
}
