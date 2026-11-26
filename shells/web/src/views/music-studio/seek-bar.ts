// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's seek bar (#/music), along the top of the phone's bottom dock: where
 * the track is, the time gone and the track's length at its ends, and the tune's sections
 * drawn along it in their own colours, faint ahead of the playhead and full behind it, so
 * the bar is also a map of the tune.
 *
 * It seeks by the bar, as the Neurospicy player seeks a generated tune
 * (lib/neurospicy-lofi.ts nearestBar): a tap or a drag goes to the start of the bar under
 * the finger, so the music stays in time, and the section colours make a section's start
 * easy to hit. While the track plays, letting go carries the music on from that bar; while
 * it is stopped, the bar becomes the place play starts from, as a media player's seek bar
 * does. A drag only shows where it will land until it is let go, so the music does not
 * stutter through every bar on the way.
 *
 * It is a slider to the keyboard and a screen reader: Left and Right step a bar, Page Up and
 * Page Down step a section, Home and End go to the first and last bar, and its value says
 * the bar, the section and the time ("Bar 22 of 64, Chorus, 0:42 of 1:54").
 */
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeHtml } from '../../utils.ts';

/** The seek row: the time gone, the bar itself and the track's length. */
export function seekBarHtml(): string {
  return `<div class="ms-seek-row" data-seek-row>`
    + `<span class="ms-seek-time" data-seek-now aria-hidden="true">0:00</span>`
    + `<div class="ms-seek" data-seek role="slider" tabindex="0" aria-label="${escapeHtml(t('Position in the track'))}" aria-valuemin="1" aria-valuemax="1" aria-valuenow="1">`
    + `<span class="ms-seek-map" data-seek-map aria-hidden="true"></span>`
    + `<span class="ms-seek-map ms-seek-played" data-seek-played aria-hidden="true"></span>`
    + `<span class="ms-seek-thumb" data-seek-thumb aria-hidden="true"></span>`
    + `</div>`
    + `<span class="ms-seek-time" data-seek-total aria-hidden="true">0:00</span>`
    + `</div>`;
}

/** The bar whose start is nearest a point `frac` (0 to 1) of the way through the track. */
export function barAtFraction(starts: readonly number[], total: number, frac: number): number {
  const at = Math.min(1, Math.max(0, frac)) * total;
  let best = 0;
  for (let i = 1; i < starts.length; i++) {
    if (Math.abs(starts[i]! - at) <= Math.abs(starts[best]! - at)) best = i;
    else break;
  }
  return best;
}

/** The first bar of the section `step` sections on from the one `bar` is in (back for a negative step). */
export function sectionStep(sections: readonly string[], bar: number, step: number): number {
  const starts: number[] = [];
  sections.forEach((s, i) => { if (i === 0 || s !== sections[i - 1]) starts.push(i); });
  let here = 0;
  for (let i = 0; i < starts.length; i++) if (starts[i]! <= bar) here = i;
  // Back from part way into a section goes to its own start first.
  if (step < 0 && starts[here]! < bar) return starts[here]!;
  return starts[Math.min(starts.length - 1, Math.max(0, here + step))]!;
}

const clock = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** What a screen reader hears for a place in the track: the bar, the section and the time. */
export function seekValueText(bar: number, bars: number, section: string, seconds: number, total: number): string {
  return tRaw('Bar {n} of {total}, {section}, {time} of {length}', { n: bar + 1, total: bars, section, time: clock(seconds), length: clock(total) });
}

export interface SeekBarDeps {
  /** Every bar's start in seconds, and the track's length. */
  times(): { starts: readonly number[]; total: number };
  /** Each bar's kind of section, by the composer's own name for the section. */
  sections(): readonly string[];
  /** A kind of section's colour on the timeline, and its name in this genre. */
  colour(section: string): string;
  label(section: string): string;
  /** Where the music is now: seconds into the track while it plays, or null while stopped. */
  playing(): number | null;
  /** The bar play starts from while stopped. */
  selected(): number;
  /** Go to a bar: carry the music on from it while it plays, or start from it next time while stopped. */
  seek(bar: number): void;
}

export interface SeekBar {
  /** Move the playhead and the times to where the music is (called as it plays). */
  paint(): void;
  /** Draw the sections along the bar again (a new tune, new colours). */
  paintMap(): void;
}

export function wireSeekBar(root: ParentNode, d: SeekBarDeps): SeekBar | null {
  const found = {
    bar: root.querySelector<HTMLElement>('[data-seek]'),
    map: root.querySelector<HTMLElement>('[data-seek-map]'),
    played: root.querySelector<HTMLElement>('[data-seek-played]'),
    thumb: root.querySelector<HTMLElement>('[data-seek-thumb]'),
  };
  if (!found.bar || !found.map || !found.played || !found.thumb) return null;
  const bar: HTMLElement = found.bar, map: HTMLElement = found.map, played: HTMLElement = found.played, thumb: HTMLElement = found.thumb;
  const nowEl = root.querySelector<HTMLElement>('[data-seek-now]');
  const totalEl = root.querySelector<HTMLElement>('[data-seek-total]');
  /** The bar a drag would land on, shown until the finger lifts. */
  let dragging: number | null = null;
  let lastBar = -1;

  function paintMap(): void {
    const { starts, total } = d.times();
    const sections = d.sections();
    const runs: HTMLElement[] = [];
    for (let i = 0; i < sections.length;) {
      let j = i;
      while (j + 1 < sections.length && sections[j + 1] === sections[i]) j++;
      const from = (starts[i] ?? 0) / (total || 1), to = (j + 1 < starts.length ? starts[j + 1]! : total) / (total || 1);
      const seg = document.createElement('span');
      seg.className = 'ms-seek-run';
      seg.style.left = `${(from * 100).toFixed(3)}%`;
      seg.style.width = `${((to - from) * 100).toFixed(3)}%`;
      if (sections[i] !== 'rest') seg.style.background = d.colour(sections[i]!);
      runs.push(seg);
      i = j + 1;
    }
    map.replaceChildren(...runs);
    played.replaceChildren(...runs.map(r => r.cloneNode(true)));
    bar.setAttribute('aria-valuemax', String(Math.max(1, starts.length)));
    if (totalEl) totalEl.textContent = clock(total);
    lastBar = -1;
    paint();
  }

  function paint(): void {
    const { starts, total } = d.times();
    const live = d.playing();
    const at = dragging !== null ? dragging : live === null ? d.selected() : -1;
    const seconds = at >= 0 ? starts[at] ?? 0 : live ?? 0;
    const frac = total ? Math.min(1, seconds / total) : 0;
    played.style.clipPath = `inset(0 ${((1 - frac) * 100).toFixed(3)}% 0 0)`;
    thumb.style.left = `${(frac * 100).toFixed(3)}%`;
    if (nowEl) nowEl.textContent = clock(seconds);
    // The bar's value moves only when the bar does, so a screen reader is not flooded as it plays.
    let n = 0;
    for (let i = 1; i < starts.length && starts[i]! <= seconds + 1e-6; i++) n = i;
    if (n === lastBar) return;
    lastBar = n;
    const sections = d.sections();
    bar.setAttribute('aria-valuenow', String(n + 1));
    bar.setAttribute('aria-valuetext', seekValueText(n, starts.length, d.label(sections[n] ?? ''), seconds, total));
  }

  const barUnder = (clientX: number): number => {
    const r = bar.getBoundingClientRect();
    const { starts, total } = d.times();
    return barAtFraction(starts, total, r.width ? (clientX - r.left) / r.width : 0);
  };
  bar.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    bar.setPointerCapture(e.pointerId);
    bar.classList.add('is-dragging');
    dragging = barUnder(e.clientX);
    lastBar = -1;
    paint();
  });
  bar.addEventListener('pointermove', (e) => {
    if (dragging === null || !bar.hasPointerCapture(e.pointerId)) return;
    const next = barUnder(e.clientX);
    if (next !== dragging) { dragging = next; paint(); }
  });
  const release = (e: PointerEvent): void => {
    if (dragging === null) return;
    const to = dragging;
    dragging = null;
    bar.classList.remove('is-dragging');
    if (bar.hasPointerCapture(e.pointerId)) bar.releasePointerCapture(e.pointerId);
    if (e.type === 'pointerup') d.seek(to);
    lastBar = -1;
    paint();
  };
  bar.addEventListener('pointerup', release);
  bar.addEventListener('pointercancel', release);
  bar.addEventListener('keydown', (e) => {
    const { starts } = d.times();
    if (!starts.length || e.altKey || e.ctrlKey || e.metaKey) return;
    const live = d.playing();
    let here = d.selected();
    if (live !== null) for (let i = 1; i < starts.length && starts[i]! <= live + 1e-6; i++) here = i;
    let to: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') to = here + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') to = here - 1;
    else if (e.key === 'PageDown') to = sectionStep(d.sections(), here, 1);
    else if (e.key === 'PageUp') to = sectionStep(d.sections(), here, -1);
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = starts.length - 1;
    if (to === null) return;
    e.preventDefault();
    e.stopPropagation();
    d.seek(Math.max(0, Math.min(starts.length - 1, to)));
    lastBar = -1;
    paint();
  });
  paintMap();
  return { paint, paintMap };
}

/**
 * On a phone, Render, Save and the link move down into the dock beside play and shuffle,
 * within the thumb's reach; on a wider screen they sit at the end of the toolbar. The same
 * buttons move (with the failure line each may carry after it), so their menus, states and
 * listeners go with them. Answers a way to stop following the screen's width.
 */
export function dockActions(page: ParentNode): () => void {
  const dock = page.querySelector<HTMLElement>('[data-dock-actions]');
  const barEnd = page.querySelector<HTMLElement>('.ms-bar-end');
  const narrow = window.matchMedia('(max-width: 760px)');
  const place = (): void => {
    const to = narrow.matches ? dock : barEnd;
    if (!to) return;
    for (const sel of ['[data-render]', '[data-save]', '[data-link]']) {
      const btn = page.querySelector<HTMLElement>(sel);
      if (!btn) continue;
      const error = btn.nextElementSibling?.classList.contains('ms-act-error') ? btn.nextElementSibling : null;
      to.append(btn);
      if (error) to.append(error);
    }
  };
  place();
  narrow.addEventListener('change', place);
  return () => narrow.removeEventListener('change', place);
}
