// SPDX-License-Identifier: MPL-2.0
/**
 * The unit keyframe times and the Time segment are typed in (plans/328).
 *
 * Milliseconds, seconds or frames at the project frame rate. A CHROME preference, kept
 * on this device under one localStorage key and never in the document: the wire stores
 * milliseconds whatever a person reads them in, so two people can share a link and each
 * see their own unit. Frames are shown with up to two decimals, because a keyframe set in
 * milliseconds need not sit on the frame grid and rounding it would show a time that is
 * not where the keyframe is; a frame number TYPED is placed exactly on the grid.
 */
import { t } from '../i18n.ts';

export type TimeUnit = 'ms' | 's' | 'f';

/** The localStorage key (the `lolly-` chrome-preference prefix). */
export const TIME_UNIT_KEY = 'lolly-timeline-units';

export const TIME_UNITS: readonly TimeUnit[] = Object.freeze(['ms', 's', 'f'] as const);

const isUnit = (v: unknown): v is TimeUnit => v === 'ms' || v === 's' || v === 'f';

/**
 * The saved unit, or null when this device has never picked one (or storage is off).
 * Null keeps each surface on the unit it has always used - milliseconds for keyframe
 * times, seconds for the Time segment - until a person chooses, and then both follow.
 */
export function readTimeUnit(): TimeUnit | null {
  try {
    const v = localStorage.getItem(TIME_UNIT_KEY);
    return isUnit(v) ? v : null;
  } catch { return null; }
}

export function writeTimeUnit(unit: TimeUnit): void {
  try { localStorage.setItem(TIME_UNIT_KEY, unit); } catch { /* storage off: the choice lasts the session */ }
}

const round = (v: number, dp: number): number => {
  const k = 10 ** dp;
  const n = Math.round(v * k) / k;
  return Object.is(n, -0) ? 0 : n;
};

/** Milliseconds as the number a field in `unit` shows. */
export function msToUnit(ms: number, unit: TimeUnit, fps: number): number {
  const v = Number.isFinite(ms) ? ms : 0;
  if (unit === 'ms') return Math.round(v);
  if (unit === 's') return round(v / 1000, 3);
  return round((v * (fps > 0 ? fps : 30)) / 1000, 2);
}

/** The number typed into a field in `unit`, as whole milliseconds. */
export function unitToMs(value: number, unit: TimeUnit, fps: number): number {
  const v = Number.isFinite(value) ? value : 0;
  if (unit === 'ms') return Math.round(v);
  if (unit === 's') return Math.round(v * 1000);
  return Math.round((v * 1000) / (fps > 0 ? fps : 30));
}

/** The arrow-key step of a field in `unit`: 10 ms, a hundredth of a second, one frame. */
export function unitStep(unit: TimeUnit): number {
  return unit === 'ms' ? 10 : unit === 's' ? 0.01 : 1;
}

/** The unit's name, for the switch and for screen readers. */
export function unitName(unit: TimeUnit): string {
  return unit === 'ms' ? t('Milliseconds') : unit === 's' ? t('Seconds') : t('Frames');
}

/** The unit's short mark, shown on the switch. */
export function unitMark(unit: TimeUnit): string {
  return unit === 'ms' ? 'ms' : unit === 's' ? 's' : 'fr';
}

/**
 * The switch: three segments in one radio group. `onChange` gets the new unit after it is
 * saved; the caller rebuilds whatever shows times.
 */
export function unitSwitch(current: TimeUnit, onChange: (unit: TimeUnit) => void): HTMLElement {
  const group = document.createElement('div');
  group.className = 'tl-units';
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', t('Time units'));
  for (const unit of TIME_UNITS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tl-units-seg';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(unit === current));
    b.tabIndex = unit === current ? 0 : -1;
    b.setAttribute('aria-label', unitName(unit));
    b.title = unitName(unit);
    b.textContent = unitMark(unit);
    b.addEventListener('click', () => {
      if (unit === current) return;
      writeTimeUnit(unit);
      onChange(unit);
    });
    group.appendChild(b);
  }
  // Arrow keys move the choice, as in any radio group.
  group.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = TIME_UNITS.indexOf(current);
    const step = (e.key === 'ArrowRight') === (document.documentElement.dir !== 'rtl') ? 1 : -1;
    const next = TIME_UNITS[(i + step + TIME_UNITS.length) % TIME_UNITS.length]!;
    writeTimeUnit(next);
    onChange(next);
  });
  return group;
}
