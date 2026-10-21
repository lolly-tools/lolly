// SPDX-License-Identifier: MPL-2.0
/**
 * A token's value, drawn small: a colour chip, a shadow chip, an "Aa" in the
 * face, a bar at a length, an easing curve. Shared by the Tokens room, its App
 * appearance roles and the token workspace, so one value looks the same in all
 * three.
 *
 * Pure and escaping. Every value that reaches a `style` attribute has passed a
 * narrow gate first (a plain hex, a validated length or shadow, a font stack of
 * plain names), and the result is escaped again on the way out. Anything that
 * fails its gate draws nothing rather than a guess.
 */
import { colorToHex } from '../../../../engine/src/tokens.ts';
import { brandFontStack, uiTokenCssValue } from '../brand-vars.ts';
import { icon } from '../lib/icons.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';

/** Plain-English names for DTCG `$type`s, keyed by the type itself. */
export const TOKEN_TYPE_LABELS: Record<string, string> = {
  color: 'Colour', dimension: 'Size', fontFamily: 'Font family', fontWeight: 'Font weight', typography: 'Text style',
  shadow: 'Shadow', gradient: 'Gradient', number: 'Number', duration: 'Duration', cubicBezier: 'Easing',
  asset: 'Logo or asset', border: 'Border', strokeStyle: 'Stroke style', transition: 'Transition',
};

/** A type's readable name, or the raw type when Lolly has none. Literal t() calls,
 *  one per type, because the string scan reads only literals. */
export function tokenTypeLabel(type: string | undefined | null): string {
  switch (type) {
    case 'color': return t('Colour');
    case 'dimension': return t('Size');
    case 'fontFamily': return t('Font family');
    case 'fontWeight': return t('Font weight');
    case 'typography': return t('Text style');
    case 'shadow': return t('Shadow');
    case 'gradient': return t('Gradient');
    case 'number': return t('Number');
    case 'duration': return t('Duration');
    case 'cubicBezier': return t('Easing');
    case 'asset': return t('Logo or asset');
    case 'border': return t('Border');
    case 'strokeStyle': return t('Stroke style');
    case 'transition': return t('Transition');
    default: return type || t('Unknown type');
  }
}

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const HEX = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;
const hexOf = (value: unknown): string | null => {
  const hex = colorToHex(value);
  return typeof hex === 'string' && HEX.test(hex) ? hex : null;
};

/** A token value as one line of text: strings bare, shadows as `x y blur spread colour`, font lists as `A, B`. */
export function tokenValueText(type: string | undefined | null, value: unknown): string {
  if (value === undefined) return t('Unavailable');
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const dim = dimensionOf(value);
  if (dim) return dim;
  if (type === 'shadow' || (isRec(value) && 'offsetX' in value)) {
    const one = (v: unknown): string => isRec(v) ? [v.offsetX, v.offsetY, v.blur, v.spread, v.color].map(x => String(x ?? '0')).join(' ') : JSON.stringify(v);
    if (Array.isArray(value)) return value.map(one).join(', ');
    return one(value);
  }
  if (Array.isArray(value) && value.every(v => typeof v === 'string')) return value.join(', ');
  return JSON.stringify(value) ?? '';
}

export interface TokenPreviewOptions {
  /** The token's dotted path: `opacity.*` draws a chip at that opacity, `stroke.*` a bar's height, `rotation.*` a turned arrow. */
  path?: string;
  /** A gradient's resolved CSS. The caller resolves the stops; the helper only wraps the result. */
  css?: string;
}

const LENGTH = /^\d+(?:\.\d+)?(?:px|rem|em)$/;
/** A DTCG dimension object (`{ value: 4, unit: 'px' }`) as CSS text, or null. */
const dimensionOf = (value: unknown): string | null =>
  isRec(value) && typeof value.value === 'number' && Number.isFinite(value.value) && typeof value.unit === 'string' && /^(?:px|rem|em)$/.test(value.unit) ? `${value.value}${value.unit}` : null;
const GRADIENT_CSS = /^(?:linear|radial|conic)-gradient\([^;{}<>"]*\)$/;

/** A small drawing of the value, or '' when there is nothing safe to draw. */
export function tokenPreviewHtml(type: string | undefined | null, value: unknown, opts: TokenPreviewOptions = {}): string {
  const path = opts.path ?? '';
  const group = path.split('.')[0] ?? '';
  switch (type) {
    case 'color': {
      const hex = hexOf(value);
      return hex ? `<span class="tk-chip" style="--sw:${esc(hex)}" aria-hidden="true"></span>` : '';
    }
    case 'shadow': {
      const css = uiTokenCssValue('shadow', value);
      return css ? `<span class="be-tok-shadow-chip tk-shadow" style="box-shadow:${esc(css)}" aria-hidden="true"></span>` : '';
    }
    case 'fontFamily': {
      const stack = brandFontStack(value, 'sans-serif');
      return stack ? `<span class="tk-face-aa" style="font-family:${esc(stack)}" aria-hidden="true">Aa</span>` : '';
    }
    case 'dimension': {
      const obj = dimensionOf(value);
      const len = typeof value === 'string' && LENGTH.test(value.trim()) ? value.trim()
        : typeof value === 'number' && Number.isFinite(value) && value >= 0 ? `${value}px`
          : obj && !obj.startsWith('-') ? obj : null;
      if (!len) return '';
      return `<span class="tk-bar${group === 'stroke' ? ' tk-bar--stroke' : ''}" style="--len:${esc(len)}" aria-hidden="true"></span>`;
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '';
      if (group === 'opacity' && value >= 0 && value <= 1) return `<span class="tk-chip tk-chip--opacity" style="--op:${value}" aria-hidden="true"></span>`;
      if (group === 'rotation') return `<span class="tk-turn" style="--turn:${value}deg" aria-hidden="true">${icon('arrowRight', { size: 14 })}</span>`;
      return '';
    }
    case 'cubicBezier': {
      if (!Array.isArray(value) || value.length !== 4 || value.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < -5 || v > 5)) return '';
      const [x1, y1, x2, y2] = value as number[];
      const n = (v: number): string => String(Math.round(v * 100) / 100);
      return `<svg class="tk-ease" viewBox="0 0 40 24" width="40" height="24" aria-hidden="true"><path d="M0 24 C${n(x1! * 40)} ${n((1 - y1!) * 24)}, ${n(x2! * 40)} ${n((1 - y2!) * 24)}, 40 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
    }
    case 'gradient': {
      const css = (opts.css ?? '').trim();
      return GRADIENT_CSS.test(css) ? `<span class="tk-chip tk-chip--wide" style="background:${esc(css)}" aria-hidden="true"></span>` : '';
    }
    default:
      return '';
  }
}
