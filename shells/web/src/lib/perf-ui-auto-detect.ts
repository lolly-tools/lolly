// SPDX-License-Identifier: MPL-2.0
/**
 * The decision behind the automatic Performance UI switch (lib/perf-ui-auto.ts wires it
 * to the page). Pure: no DOM, no clock and no storage. Every time is passed in, on the
 * page's performance.now() timeline, so the tests drive it with synthetic frames.
 *
 * Two signals, and both only ever say "switch on":
 *
 *   1. Software rendering. isSoftwareRenderer() reads the facts the WebGPU startup
 *      check already holds (or a WebGL renderer string). No context is created here.
 *   2. Sustained slowness drawing the chrome while the person uses the app. PerfEvidence
 *      keeps it per wall-clock second and decides from the latest active seconds.
 *
 * The Performance UI only makes the chrome cheaper to draw, so only slowness it can fix
 * counts. With Long Animation Frames (Chromium) that is two kinds of slow time, added
 * into the same seconds:
 *
 *   - a long frame spent mostly in style, layout and paint, never one spent in script;
 *   - a late frame while the main thread was idle: frames 50 ms or more apart with no
 *     long task near them and the main thread busy for at most a quarter of the gap.
 *     Raster and compositing (the blur and shadows the Performance UI removes) run off
 *     the main thread, so their cost is never script or rendering work; when they cannot
 *     keep up, frames simply arrive late while the main thread waits.
 *
 * Where the browser cannot say which (no Long Animation Frames API), slow frame
 * intervals count instead, against stricter numbers. Each number below is explained in
 * place, and every choice leans towards missing a slow device rather than switching a
 * fast one.
 */

/** Each input opens or extends an interaction window to this long after the input. */
export const INTERACTION_TAIL_MS = 1000;
/** Nothing in the first 15 s after the page started counts: boot, first paint and
 *  the catalog arriving are slow on every device. */
export const WARMUP_MS = 15_000;
/** The wiring ignores this long after a route change: a view mounting is a one-off. */
export const ROUTE_SETTLE_MS = 2000;
/** A frame of 50 ms or more is jank a person sees. It is also the Long Animation
 *  Frames threshold, so the two paths start from the same line. */
export const SLOW_FRAME_MS = 50;
/** A frame interval longer than this is a gap (a throttled or paused page), not a frame. */
export const FRAME_GAP_MS = 1000;
/** A second is active when interaction windows covered at least half of that second. */
export const ACTIVE_COVERAGE_MS = 500;
/** Long Animation Frame entries arrive after their frame, so a second is judged only
 *  once this long has passed after its end. */
export const FINALISE_DELAY_MS = 1000;
/** A long frame is render-bound when style, layout and paint took at least half of
 *  the frame and script took no more than a quarter. */
export const RENDER_SHARE_MIN = 0.5;
/** The script share above which a long frame is never render-bound. */
export const SCRIPT_SHARE_MAX = 0.25;
/** A late frame is the compositor's only when the main thread was busy for at most this
 *  share of the gap: the previous frame's own work plus how late this frame's callback
 *  started. More than that and the main thread may have made the frame late, which is
 *  the Long Animation Frames rule's business, or nobody's. */
export const IDLE_MAIN_SHARE_MAX = 0.25;
/** A late frame within this much of a long task is not the compositor's either, however
 *  idle the measured parts looked. */
export const BUSY_MARGIN_MS = 16;
/** The decision reads the latest 40 active seconds. */
export const WINDOW_SECONDS = 40;
/** The struggling seconds must spread over at least 30 s of wall-clock time, so one
 *  burst (a background task, one heavy view) never decides. */
export const MIN_SPAN_MS = 30_000;

/** How each path judges a second and the window. */
export interface PathRule {
  /** Counted slow time in one active second that makes the second struggling. */
  struggleMs: number;
  /** Active seconds needed before any decision. */
  minSeconds: number;
  /** Share of the window's active seconds that must be struggling. */
  share: number;
}

export type MeasurePath = 'loaf' | 'raf';

export const PATH_RULES: Readonly<Record<MeasurePath, PathRule>> = {
  // Long Animation Frames (Chromium): a quarter of a second lost to render-bound long
  // frames or to late frames on an idle main thread, in seven of every ten active
  // seconds, over at least 12 of them. Late frames get no looser rule of their own.
  loaf: { struggleMs: 250, minSeconds: 12, share: 0.7 },
  // requestAnimationFrame elsewhere cannot tell script from rendering, so it needs half
  // of each second below 20 fps, in eight of every ten seconds, over at least 20.
  raf: { struggleMs: 500, minSeconds: 20, share: 0.8 },
};

/** The fields of a Long Animation Frame entry this module reads. */
export interface LongFrame {
  startTime: number;
  duration: number;
  /** 0 when the frame had no rendering phase. */
  renderStart: number;
  /** 0 when the frame had no style and layout phase. */
  styleAndLayoutStart: number;
  /** Scripts of 5 ms or more; forced style and layout inside them counts as script.
   *  `startTime` places a script inside the frame (0 when the browser leaves it out). */
  scripts: ReadonlyArray<{ startTime?: number; duration: number }>;
}

export type FrameCause = 'render' | 'script' | 'mixed';

/** Where a long frame's time went. Only 'render' ever counts towards the switch. */
export function classifyLongFrame(frame: LongFrame): FrameCause {
  const duration = frame.duration;
  if (!(duration > 0)) return 'mixed';
  const end = frame.startTime + duration;
  const render = frame.styleAndLayoutStart > 0 ? Math.max(0, end - frame.styleAndLayoutStart) : 0;
  let script = 0;
  for (const s of frame.scripts) script += Math.max(0, s.duration);
  if (script / duration >= RENDER_SHARE_MIN) return 'script';
  if (render / duration >= RENDER_SHARE_MIN && script / duration <= SCRIPT_SHARE_MAX) return 'render';
  return 'mixed';
}

/** A frame `interval` ms after the one before, with `mainMs` of main-thread work measured
 *  inside it: is it late because of the compositor? Only when it is slow (50 ms or more,
 *  and not a pause) and the main thread was idle for at least three quarters of the gap.
 *  PerfEvidence also drops it when a long task comes near, or when the work long
 *  animation frames report inside it passes the same quarter. */
export function isCompositorLate(interval: number, mainMs: number): boolean {
  if (!(interval >= SLOW_FRAME_MS) || interval > FRAME_GAP_MS) return false;
  return mainMs >= 0 && mainMs <= interval * IDLE_MAIN_SHARE_MAX;
}

/** What a graphics adapter says about itself. Any field may be missing. */
export interface GraphicsFacts {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
  /** A WebGL renderer string, when a caller has one already. */
  renderer?: string;
  isFallbackAdapter?: boolean;
}

/** Renderers that draw on the CPU: Chromium's SwiftShader, Mesa's llvmpipe, lavapipe
 *  and softpipe, Windows' Basic Render Driver (WARP) and GDI Generic, Apple's
 *  software renderer, and the generic spellings. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|lavapipe|softpipe|basic render driver|gdi generic|apple software renderer|software (?:rasteri[sz]er|renderer|adapter)/i;

/** True when the adapter draws without graphics acceleration. */
export function isSoftwareRenderer(facts: GraphicsFacts | null | undefined): boolean {
  if (!facts) return false;
  if (facts.isFallbackAdapter === true) return true;
  return [facts.vendor, facts.architecture, facts.device, facts.description, facts.renderer]
    .some(text => typeof text === 'string' && SOFTWARE_RENDERER.test(text));
}

interface Span { start: number; end: number }
interface ActiveSecond { at: number; struggling: boolean }

/**
 * Evidence of slowness drawing the chrome, kept per wall-clock second.
 *
 * The wiring reports each input (eligible or not), and either each long frame, each
 * long task and each frame with the main-thread time inside it (Long Animation
 * Frames), or each frame interval (requestAnimationFrame elsewhere), and calls settle()
 * now and then. Slow time counts only inside eligible interaction windows. Once
 * settle() has returned true the evidence is done: it never decides again, in either
 * direction.
 */
export class PerfEvidence {
  readonly path: MeasurePath;
  private readonly rule: PathRule;
  private windows: Span[] = [];
  private readonly slow = new Map<number, number>();
  private nextSecond = 0;
  private active: ActiveSecond[] = [];
  private decided = false;
  /** Long tasks: the main thread was busy for all of each. */
  private tasks: Span[] = [];
  /** The work inside each long animation frame: its scripts and its rendering phase.
   *  Never a long frame's whole span, which also holds the wait for a rendering update
   *  the compositor held back: on a device whose compositor cannot keep up, every gap
   *  between frames that a task starts in shows up as a long frame with no work inside. */
  private work: Span[] = [];
  /** Late frames on an idle main thread, in time order, waiting until a long task or
   *  long frame that would rule them out has had time to arrive. */
  private late: Span[] = [];
  /** Late frames counted as the compositor's so far, for the probe log. */
  lateCounted = 0;

  constructor(path: MeasurePath) {
    this.path = path;
    this.rule = PATH_RULES[path];
  }

  /** Whether the evidence has already decided. */
  get done(): boolean { return this.decided; }

  /** The end of the latest interaction window (0 when there is none). */
  openUntil(): number { return this.windows.at(-1)?.end ?? 0; }

  /** An input at `t`. An eligible one opens or extends a window; an ineligible one
   *  (busy, hidden, another route, still warming up) closes any open window at `t`. */
  interaction(t: number, eligible: boolean): void {
    if (this.decided) return;
    if (!eligible || t < WARMUP_MS) { this.cut(t); return; }
    const last = this.windows.at(-1);
    if (last && t <= last.end) last.end = Math.max(last.end, t + INTERACTION_TAIL_MS);
    else this.windows.push({ start: t, end: t + INTERACTION_TAIL_MS });
  }

  /** Close any open window at `t` (the tab hid, work started). */
  cut(t: number): void {
    const last = this.windows.at(-1);
    if (last && last.end > t) last.end = Math.max(last.start, t);
  }

  /** A Long Animation Frame entry. Only a render-bound one adds slow time. */
  longFrame(frame: LongFrame): void {
    if (this.decided || classifyLongFrame(frame) !== 'render') return;
    this.addSlow(frame.startTime, frame.startTime + frame.duration);
  }

  /** A requestAnimationFrame interval ending at `end`. Slow when 50 ms or more; a gap
   *  longer than FRAME_GAP_MS is a pause, not a frame. */
  frameInterval(end: number, interval: number): void {
    if (this.decided || interval < SLOW_FRAME_MS || interval > FRAME_GAP_MS) return;
    this.addSlow(end - interval, end);
  }

  /** A long task: the main thread was busy from `start` for `duration` ms. */
  longTask(start: number, duration: number): void {
    if (this.decided || !(duration > 0)) return;
    this.tasks.push({ start, end: start + duration });
  }

  /** The work a long animation frame reports, whatever its cause and whether or not the
   *  person was interacting: each script, and the rendering phase. */
  frameWork(frame: LongFrame): void {
    if (this.decided) return;
    const end = frame.startTime + frame.duration;
    if (frame.renderStart > 0 && frame.renderStart < end) this.work.push({ start: frame.renderStart, end });
    for (const script of frame.scripts) {
      // A script the browser does not place is taken to fill the frame from its start.
      const start = script.startTime && script.startTime > 0 ? script.startTime : frame.startTime;
      if (script.duration > 0) this.work.push({ start, end: start + script.duration });
    }
  }

  /** A frame on the Long Animation Frames path, `interval` ms after the one before and
   *  ending at `end`, with `mainMs` of main-thread work measured inside the gap. A late frame
   *  on an idle main thread is held, and counts at settle() unless a long task, or long
   *  frames with work inside it, turn up by then. */
  compositorFrame(end: number, interval: number, mainMs: number): void {
    if (this.decided || !isCompositorLate(interval, mainMs)) return;
    this.late.push({ start: end - interval, end });
  }

  /** Judge every second that is old enough, then decide. True exactly once. */
  settle(now: number): boolean {
    if (this.decided) return false;
    // Long frames and long tasks are delivered after the fact, so a late frame is judged
    // only once it is as old as a second has to be before it is judged.
    const ready = now - FINALISE_DELAY_MS;
    while (this.late.length && this.late[0]!.end <= ready) {
      const f = this.late.shift()!;
      if (this.tasks.some(b => b.start < f.end + BUSY_MARGIN_MS && b.end > f.start - BUSY_MARGIN_MS)) continue;
      let work = 0;
      for (const w of this.work) work += Math.max(0, Math.min(w.end, f.end) - Math.max(w.start, f.start));
      if (work > (f.end - f.start) * IDLE_MAIN_SHARE_MAX) continue;
      this.addSlow(f.start, f.end);
      this.lateCounted += 1;
    }
    const keepAfter = ready - FRAME_GAP_MS - BUSY_MARGIN_MS;
    this.tasks = this.tasks.filter(b => b.end > keepAfter);
    this.work = this.work.filter(b => b.end > keepAfter);
    // No second is judged while a late frame that touches it is still waiting.
    const waiting = this.late.length ? Math.floor(this.late[0]!.start / 1000) : Number.POSITIVE_INFINITY;
    const limit = Math.min(Math.floor(ready / 1000), waiting);
    if (limit > this.nextSecond) {
      const coverage = new Map<number, number>();
      for (const w of this.windows) {
        const first = Math.max(this.nextSecond, Math.floor(w.start / 1000));
        const last = Math.min(limit - 1, Math.ceil(w.end / 1000) - 1);
        for (let s = first; s <= last; s++) {
          const covered = Math.min(w.end, (s + 1) * 1000) - Math.max(w.start, s * 1000);
          if (covered > 0) coverage.set(s, (coverage.get(s) ?? 0) + covered);
        }
      }
      for (const s of [...coverage.keys()].sort((a, b) => a - b)) {
        if ((coverage.get(s) ?? 0) < ACTIVE_COVERAGE_MS) continue;
        this.active.push({ at: s * 1000, struggling: (this.slow.get(s) ?? 0) >= this.rule.struggleMs });
      }
      if (this.active.length > WINDOW_SECONDS) this.active = this.active.slice(-WINDOW_SECONDS);
      this.nextSecond = limit;
      this.windows = this.windows.filter(w => w.end > limit * 1000);
      for (const s of [...this.slow.keys()]) if (s < limit) this.slow.delete(s);
    }
    if (!this.verdict()) return false;
    this.decided = true;
    this.windows = [];
    this.slow.clear();
    this.tasks = [];
    this.work = [];
    this.late = [];
    return true;
  }

  /** The window as numbers, for the probe log and the tests. */
  summary(): { active: number; struggling: number; spanMs: number } {
    const struggling = this.active.filter(s => s.struggling);
    const spanMs = struggling.length ? struggling.at(-1)!.at + 1000 - struggling[0]!.at : 0;
    return { active: this.active.length, struggling: struggling.length, spanMs };
  }

  private verdict(): boolean {
    const { active, struggling, spanMs } = this.summary();
    if (active < this.rule.minSeconds) return false;
    if (struggling / active < this.rule.share) return false;
    return spanMs >= MIN_SPAN_MS;
  }

  /** Add [start, end) of slow time, clipped to the eligible windows and split by second. */
  private addSlow(start: number, end: number): void {
    for (const w of this.windows) {
      const a = Math.max(start, w.start);
      const b = Math.min(end, w.end);
      for (let s = Math.floor(a / 1000); s * 1000 < b; s++) {
        if (s < this.nextSecond) continue;
        const piece = Math.min(b, (s + 1) * 1000) - Math.max(a, s * 1000);
        if (piece > 0) this.slow.set(s, (this.slow.get(s) ?? 0) + piece);
      }
    }
  }
}
