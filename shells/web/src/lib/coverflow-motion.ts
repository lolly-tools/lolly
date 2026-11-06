// SPDX-License-Identifier: MPL-2.0
/** Motion shared by Docs (static and in-app) and every featured tile carousel,
 * built on the vendored Detent physics (detent-physics.ts, MIT).
 *
 * Every motion is planned once, when it starts, and then read off the clock.
 * A release projects where the throw would come to rest, picks the cover nearest
 * that point and glides there: Detent's release planner retunes the coast so it
 * ends on that cover and hands the last cover-width to one spring. Arrow keys,
 * dots, side taps and the Docs autoplay run the same spring from wherever the
 * strip is, carrying its current speed. The same elapsed time gives the same
 * position at 30, 60 or 120 Hz, and nothing crawls: the cover is chosen at the
 * release, not after the throw has run out.
 *
 * Positions are scroll px. Keep a fractional position: reading rounded
 * scrollLeft back every frame loses slow movement on WKWebView, particularly on
 * a 120 Hz display.
 */
import {
  burstVelocity,
  crossings,
  dampingFor,
  ios,
  type Motion,
  type Physics,
  release,
  spring,
  velocityTracker,
  WHEEL_DECAY,
  WHEEL_IDLE,
  wheelReader,
} from './detent-physics.ts';

/** Detent's iOS feel with a critically damped spring, so a settle never swings
 *  back past its cover, stiff enough to settle a one-cover step in about a
 *  quarter of a second, and Detent's "snappy" pull at the end of a throw. */
export const COVERFLOW_PHYSICS: Physics = {
  ...ios,
  spring: { stiffness: 800, damping: dampingFor(1, 800, 1), mass: 1 },
  magnet: 1.6,
  snapDuration: 600,
};

/** Where the covers rest: cover i at about origin + i * pitch, for 0 <= i < count.
 *  `at(i)`, when given, is cover i's exact resting position: a cover 66vw wide is a
 *  fractional pitch, and laid-out offsets round, so the uniform rows drift a pixel or
 *  more along a long strip. The glide is planned on the rows and ends on `at(i)`. */
export interface CoverflowGrid {
  origin: number;
  pitch: number;
  count: number;
  at?: (index: number) => number;
}

const restDelta = (): number =>
  0.5 / (typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1);

/** Release velocity from the hand's recent movement (Detent's weighted fit over the
 *  last 100 ms). Event timestamps survive main-thread delivery delays. px/ms in
 *  scroll direction: dragging left moves the strip forward. */
export class CoverflowGesture {
  // A finger that rested 80 ms before lifting throws nothing: Lolly's rule before
  // the port, kept because Detent's 40 ms turned a slow swipe on a busy phone into
  // no throw at all.
  private tracker = velocityTracker(100, 80);

  start(x: number, time: number): void {
    this.tracker.reset();
    this.tracker.push(time, -x);
  }
  move(x: number, time: number): void {
    this.tracker.push(time, -x);
  }
  release(time: number, cancelled = false, reduced = false): number {
    return cancelled || reduced ? 0 : this.tracker.get(time);
  }
}

export class CoverflowMotion {
  position = 0;
  /** px/ms, positive while the scroll position grows. */
  velocity = 0;
  /** Where the running motion comes to rest, or null at rest. */
  target: number | null = null;
  /** Moving: a planned glide, or a trackpad being followed. */
  active = false;
  /** A trackpad is driving the strip directly, 1:1. */
  following = false;
  private plan: Motion | null = null;
  private start = 0;
  /** Whole-period rebases since the plan began: the plan's own positions do not move. */
  private offset = 0;
  private wheelTracker = velocityTracker();
  private wheelAt = 0;
  /** Frame spacing while following: under a busy main thread the browser coalesces
   *  wheel events, so "quiet" has to mean longer than a frame as well as WHEEL_IDLE. */
  private frameAt = 0;
  private frameGap = 16;

  reset(position: number): void {
    this.position = position;
    this.velocity = 0;
    this.target = null;
    this.active = false;
    this.following = false;
    this.plan = null;
  }

  /** Host scroll bounds or focus scrolling moved the strip under the model. */
  reconcile(position: number): void {
    if (Math.abs(position - this.position) <= 1) return;
    this.position = position;
    if (this.plan && this.target !== null)
      this.run(this.springTo(this.target), performance.now(), this.target);
  }

  /** The loop re-based the strip by whole periods: the same picture, a different scrollLeft. */
  shift(distance: number): void {
    this.position += distance;
    this.offset += distance;
    if (this.target !== null) this.target += distance;
  }

  /** Release at velocity `v` (px/ms): project the throw, choose the cover nearest
   *  its end, glide there. Reduced motion jumps to the nearest cover instead. */
  release(v: number, now: number, grid: CoverflowGrid, reduced: boolean, decay?: number): void {
    this.following = false;
    if (!(grid.pitch > 0)) {
      this.rest(this.position);
      return;
    }
    const x = this.position - grid.origin;
    const bounds = { min: 0, max: Math.max(0, grid.count - 1), loop: false, count: grid.count };
    const restAt = (index: number): number => grid.at?.(index) ?? grid.origin + index * grid.pitch;
    if (reduced) {
      this.rest(restAt(Math.max(bounds.min, Math.min(bounds.max, Math.round(x / grid.pitch)))));
      return;
    }
    const physics = { ...COVERFLOW_PHYSICS, restDelta: restDelta(), ...(decay ? { decay } : {}) };
    const planned = release(x, v, grid.pitch, bounds, physics);
    const origin = grid.origin;
    const from = this.position;
    const row = origin + planned.to;
    const exact = restAt(planned.index);
    // Fold the row's rounding error in as the glide progresses, so the motion starts
    // where the strip is and ends on the cover itself, with no jump at either end.
    const fix = exact - row;
    const span = row - from;
    this.run(
      {
        to: exact,
        duration: planned.duration,
        at: (t) => {
          const s = planned.at(t);
          const x = s.x + origin;
          const k =
            Math.abs(span) >= 1
              ? Math.min(1, Math.max(0, (x - from) / span))
              : Math.min(1, t / Math.max(1, planned.duration));
          return { ...s, x: x + fix * k };
        },
      },
      now,
      exact
    );
  }

  /** Glide to scroll position `target` with the one spring (keys, dots, taps, autoplay). */
  select(target: number, now: number, reduced = false): void {
    this.following = false;
    if (reduced) {
      this.rest(target);
      return;
    }
    this.run(this.springTo(target), now, target);
  }

  /** Follow a trackpad 1:1. advance() settles the strip once WHEEL_IDLE ms pass
   *  with no further event. */
  follow(delta: number, now: number): void {
    if (!this.following) {
      this.plan = null;
      this.target = null;
      this.wheelTracker.reset();
      this.frameAt = 0;
      this.frameGap = 16;
    }
    this.following = true;
    this.active = true;
    this.position += delta;
    this.wheelAt = now;
    this.wheelTracker.push(now, this.position);
    this.velocity = this.wheelTracker.get(now);
  }

  /** Bring position and velocity up to `now`. False once at rest. A trackpad that
   *  has gone quiet settles here, from where it left the strip, with the speed the
   *  fingers (and the operating system's momentum) had at the last event. */
  advance(now: number, grid: () => CoverflowGrid, reduced: boolean): boolean {
    if (this.following) {
      if (this.frameAt) this.frameGap = now - this.frameAt;
      this.frameAt = now;
      if (now - this.wheelAt <= Math.max(WHEEL_IDLE, 1.5 * this.frameGap)) return true;
      this.release(this.wheelTracker.get(this.wheelAt), now, grid(), reduced);
    }
    const plan = this.plan;
    if (!plan) return false;
    const t = Math.max(0, now - this.start);
    if (t >= plan.duration) {
      this.rest(plan.to + this.offset);
      return false;
    }
    const s = plan.at(t);
    this.position = s.x + this.offset;
    this.velocity = s.v;
    return true;
  }

  private springTo(target: number): Motion {
    return spring(
      this.position,
      target,
      this.velocity,
      COVERFLOW_PHYSICS.spring,
      COVERFLOW_PHYSICS.snapDuration,
      restDelta()
    );
  }

  private run(plan: Motion, now: number, target: number): void {
    this.plan = plan;
    this.start = now;
    this.offset = 0;
    this.target = target;
    this.active = true;
    if (plan.duration <= 0) this.rest(target);
  }

  private rest(position: number): void {
    this.position = position;
    this.velocity = 0;
    this.target = null;
    this.plan = null;
    this.active = false;
    this.following = false;
  }
}

/** Wheel and trackpad input for a Cover Flow, shared so Docs and the gallery
 *  read the same event the same way. Detent's reader classifies each gesture
 *  from its first event: a trackpad starts at 1 to 3 px and is followed 1:1,
 *  then settles on a cover WHEEL_IDLE ms after its last event (macOS momentum
 *  events included, so the strip ends where the fingers' throw ended); a mouse
 *  notch starts at 10 px or more, or comes in line or page mode, or carries a
 *  Windows-style wheelDelta of 120, and steps one cover; an accelerated mouse
 *  spin becomes a short throw. A vertical gesture, trackpad or wheel, is never
 *  taken: it scrolls the page. */
export function coverflowWheel(
  motion: CoverflowMotion,
  host: {
    grid(): CoverflowGrid;
    /** The resting position one cover from `from` (the running target, else the current cover). */
    step(direction: 1 | -1, from: number | undefined): number;
    reduced(): boolean;
    /** Something moved: make sure the frame loop runs. */
    kick(): void;
  }
): (e: WheelEvent) => void {
  const reader = wheelReader({ orientation: 'horizontal', crossAxisNotches: false });
  let last = Number.NEGATIVE_INFINITY;
  return (e) => {
    // The event's own time when it is on the page clock (a test DOM may stamp
    // epoch time instead): a handler that runs late must not stretch the gaps.
    const now =
      Math.abs(e.timeStamp - performance.now()) < 10_000 ? e.timeStamp : performance.now();
    // While a trackpad is still being followed, a gap longer than WHEEL_IDLE is a
    // busy main thread holding events back, not a new gesture: keep the reading.
    const at = motion.following && now - last > WHEEL_IDLE ? last + WHEEL_IDLE : now;
    last = at;
    const read = reader.read({
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      deltaMode: e.deltaMode,
      timeStamp: at,
      wheelDeltaX: (e as WheelEvent & { wheelDeltaX?: number }).wheelDeltaX,
      wheelDeltaY: (e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY,
    });
    if (read.kind === 'ignore') return;
    e.preventDefault();
    const reduced = host.reduced();
    if (read.kind === 'step' || (read.kind === 'burst' && reduced)) {
      motion.select(host.step(read.direction, motion.target ?? undefined), now, reduced);
    } else if (read.kind === 'burst') {
      const grid = host.grid();
      const v = burstVelocity(
        read.rate,
        read.direction,
        motion.velocity,
        grid.pitch,
        COVERFLOW_PHYSICS.maxVelocity
      );
      motion.release(v, now, grid, reduced, WHEEL_DECAY);
    } else {
      motion.follow(read.delta, now);
    }
    host.kick();
  };
}

/** A short vibration as each cover passes the centre during a person's own touch
 *  gesture (the drag, and the glide it throws), as the timeline's snap does
 *  (views/timeline-panel/gestures.ts). Only where the Vibration API exists, never
 *  under reduced motion, never for keys, wheels, autoplay or the first paint.
 *  Spaced at least 35 ms apart, as Detent's own haptics are, so a fast spin
 *  thins out rather than buzzing. */
export function coverflowHaptics(reduced: () => boolean): {
  /** A pointer went down with the strip at scroll position `position`. */
  begin(pointerType: string, position: number): void;
  end(): void;
  /** The strip is now at scroll position `position`. */
  moved(position: number, grid: CoverflowGrid): void;
  /** The loop re-based the strip by `distance`: the same picture, so no tick. */
  shift(distance: number): void;
} {
  let on = false;
  let last = -Infinity;
  let at = 0;
  return {
    begin(pointerType, position) {
      on =
        pointerType === 'touch' &&
        !reduced() &&
        typeof navigator !== 'undefined' &&
        typeof navigator.vibrate === 'function';
      at = position;
    },
    end() {
      on = false;
    },
    shift(distance) {
      at += distance;
    },
    moved(position, grid) {
      const from = at;
      at = position;
      if (!on || !(grid.pitch > 0) || from === position) return;
      crossings(from - grid.origin, position - grid.origin, grid.pitch, () => {
        const now = performance.now();
        if (now - last < 35 || reduced()) return;
        last = now;
        try {
          navigator.vibrate(8);
        } catch {
          /* a denied or absent vibrator is not an error */
        }
      });
    },
  };
}
