// SPDX-License-Identifier: MPL-2.0
/**
 * The Design inspector's field diamonds (plans/328): a keyframe toggle beside Fill,
 * Stroke, Stroke width and Corner radius, and the routing that makes an edit of an
 * ANIMATED property write its keyframe instead of the field.
 *
 * Kept outside `initDesignInspector`, which has a no-growth maintainability budget: the
 * column builds one `InspectorKeys` and asks it for markup, values and routing.
 *
 * The rules, which the timeline answers through `InspectorKeysPort`:
 *
 * - a property that is NOT animated is an ordinary field: an edit writes the box as it
 *   always did, and only its diamond adds a keyframe;
 * - an ANIMATED property follows the playhead: parked on a keyframe, an edit writes that
 *   keyframe; anywhere else the field shows the value the keyframes give there and an
 *   edit is refused with the reason, because nothing would show it;
 * - with the timeline closed there is no playhead on screen, so no diamond is drawn and
 *   every field is ordinary.
 */
import { t } from '../i18n.ts';
import { announce } from '../a11y.ts';
import { escape as escapeHtml } from '../utils.ts';
import type { InspectorKeysPort } from './design-ports.ts';
import type { KfProp } from './kf-props.ts';
import type { Box } from './free-canvas-math.ts';

/** The four fields a diamond sits beside, by the tool's own field names. */
export interface InspectorKeyFields {
  fillField?: string;
  strokeField?: string;
  strokeWField?: string;
  radiusField?: string;
}

export interface InspectorKeys {
  /** The diamond's markup for `prop` on the rows on screen, or '' when none is shown. */
  diamond(prop: KfProp): string;
  /** The value a field shows: the keyframed value at the playhead when animated, else `raw`. */
  shown(b: Box, prop: KfProp, raw: unknown): unknown;
  /** The same, as a number for a number cell. */
  num(b: Box, prop: KfProp, raw: number): number;
  /** Route a write of `field`: true when the keyframes took it (or refused it), false to write the field. */
  route(field: string | undefined, value: unknown): boolean;
  /** The same, by property. */
  routeProp(prop: KfProp, value: unknown): boolean;
  /** Bind every diamond inside `scroll` (after each rebuild). */
  wire(scroll: HTMLElement): void;
}

const GLYPH = '<svg class="fc-kf-key-glyph" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.2 10.8 6 6 10.8 1.2 6Z"/></svg>';

const idOf = (b: Box): string => String(b.id ?? '');

export function inspectorKeys(
  port: InspectorKeysPort | undefined, fields: InspectorKeyFields, ids: () => readonly string[],
): InspectorKeys {
  const propOf = (field: string | undefined): KfProp | null => {
    if (!field) return null;
    if (field === fields.fillField) return 'fill';
    if (field === fields.strokeField) return 'stroke';
    if (field === fields.strokeWField) return 'lw';
    if (field === fields.radiusField) return 'cr';
    return null;
  };
  const routeProp = (prop: KfProp, value: unknown): boolean => {
    const list = [...ids()];
    if (!port || !list.length) return false;
    const r = port.route(list, prop, value);
    if (r === 'locked') announce(t('This property is animated. Move the playhead onto a keyframe to change it, or add one.'), { assertive: true });
    return r !== 'base';
  };
  return {
    diamond(prop) {
      const id = ids()[0];
      const s = id && port ? port.state(id, prop) : null;
      if (!s) return '';
      return `<button type="button" class="fc-kf-key" data-act="kfkey-${prop}" data-kf-prop="${prop}" data-state="${s.state}"`
        + ` aria-label="${escapeHtml(s.label)}" data-tip="${escapeHtml(s.label)}"${s.disabled ? ' aria-disabled="true"' : ''}>${GLYPH}</button>`;
    },
    shown(b, prop, raw) {
      const v = port?.shown(idOf(b), prop);
      return v == null ? raw : v;
    },
    num(b, prop, raw) {
      const v = port?.shown(idOf(b), prop);
      return typeof v === 'number' && Number.isFinite(v) ? v : raw;
    },
    route(field, value) {
      const prop = propOf(field);
      return prop ? routeProp(prop, value) : false;
    },
    routeProp,
    wire(scroll) {
      if (!port) return;
      scroll.querySelectorAll<HTMLButtonElement>('[data-kf-prop]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.getAttribute('aria-disabled') === 'true') { announce(btn.getAttribute('aria-label') ?? ''); return; }
          port.toggle([...ids()], btn.dataset.kfProp as KfProp);
        });
      });
    },
  };
}
