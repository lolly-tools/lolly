// SPDX-License-Identifier: MPL-2.0
/** Motion shared by Docs (static and in-app) and every featured tile carousel.
 * These are the Docs landing's friction, wheel gain and settling rate. Keep a
 * fractional position: reading rounded scrollLeft back every frame loses slow
 * movement on WKWebView, particularly on a 120 Hz display.
 */
const FRAME_MS = 16.67;
const FRICTION = 0.94;
const EASE_PER_SEC = 12;
const MIN_VELOCITY = 6;
const MAX_VELOCITY = 3200;
const WHEEL_GAIN = 14;
export const COVERFLOW_WHEEL_REST_MS = 150;

const clampVelocity = (v: number): number => Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, v));

/** Velocity follows recent hand movement, independent of event delivery rate.
 * Reversing or pausing discards the previous throw, so it cannot pull against
 * the final movement of the finger. Event timestamps also survive main-thread
 * delivery delays without turning a normal swipe into a huge fling. */
export class CoverflowGesture {
  private x = 0;
  private time = 0;
  private velocity = 0;

  start(x: number, time: number): void { this.x = x; this.time = time; this.velocity = 0; }
  move(x: number, time: number): void {
    const elapsed = time - this.time;
    if (elapsed <= 0) return;
    const dx = this.x - x;
    const next = dx * 1000 / elapsed;
    if (elapsed > 80 || next * this.velocity < 0) this.velocity = 0;
    const weight = 1 - 0.7 ** (elapsed / FRAME_MS);
    this.velocity = clampVelocity(this.velocity * (1 - weight) + next * weight);
    this.x = x;
    this.time = time;
  }
  release(time: number, cancelled = false, reduced = false): number {
    return cancelled || reduced || time - this.time > 80 ? 0 : this.velocity;
  }
}

export class CoverflowMotion {
  position = 0;
  velocity = 0;
  target: number | null = null;
  active = false;

  reset(position: number): void {
    this.position = position;
    this.velocity = 0;
    this.target = null;
    this.active = false;
  }
  /** Host scroll bounds / external focus scrolling, allowing subpixel rounding. */
  reconcile(position: number): void {
    if (Math.abs(position - this.position) > 1) this.position = position;
  }
  shift(distance: number): void {
    this.position += distance;
    if (this.target !== null) this.target += distance;
  }
  release(velocity: number): void {
    this.velocity = clampVelocity(velocity);
    this.target = null;
    this.active = Math.abs(this.velocity) > MIN_VELOCITY;
  }
  select(target: number): void {
    this.velocity = 0;
    this.target = target;
    this.active = true;
  }
  wheel(delta: number, reduced: boolean): void {
    this.target = null;
    if (reduced) { this.position += delta; this.velocity = 0; }
    else this.velocity = clampVelocity(this.velocity + delta * WHEEL_GAIN);
    this.active = true;
  }
  /** Coast freely first; choose the nearest tile only once the throw is spent.
   * Integrating the Docs 60 Hz curve preserves its travel at 30/60/120 Hz.
   * A supplied target (arrows, dots, side-tap) interrupts coasting immediately. */
  advance(elapsed: number, nearest: (position: number) => number, reduced: boolean): boolean {
    const frames = Math.max(0, Math.min(200, elapsed)) / FRAME_MS;
    if (!reduced && Math.abs(this.velocity) > MIN_VELOCITY) {
      const decay = FRICTION ** frames;
      this.position += this.velocity * (FRAME_MS / 1000) * (1 - decay) / (1 - FRICTION);
      this.velocity *= decay;
      if (Math.abs(this.velocity) < MIN_VELOCITY) this.velocity = 0;
      this.active = true;
      return true;
    }
    const target = this.target ?? nearest(this.position);
    const difference = target - this.position;
    if (reduced || Math.abs(difference) < 0.5) {
      this.position = target;
      this.velocity = 0;
      this.target = null;
      this.active = false;
      return false;
    }
    this.position += difference * (1 - (1 - FRAME_MS / 1000 * EASE_PER_SEC) ** frames);
    this.active = true;
    return true;
  }
}
