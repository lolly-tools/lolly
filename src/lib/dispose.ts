// SPDX-License-Identifier: MPL-2.0
/**
 * A disposable scope for anything a mount registers and must release.
 *
 * Views tear down through the `view._cleanup` property convention (main.ts):
 * each mount hand-assembles a closure that removes its listeners, cancels its
 * rAF and clears its timers, and forgets one of them often enough that the
 * tree carries twenty rAF sites with no cancel. A scope turns that into one
 * shape: register through the scope, dispose the scope. Every registration
 * returns its own release function too, so a listener a view wants to drop
 * early does not need a second bookkeeping path.
 *
 *   const scope = createScope();
 *   scope.listen(window, 'resize', onResize);
 *   scope.raf(function tick() { …; scope.raf(tick); });
 *   scope.timeout(() => …, 250);
 *   view._cleanup = () => scope.dispose();
 *
 * Disposal is idempotent and never throws: a release that throws is logged
 * and the rest still run, so one bad teardown cannot trap a navigation (the
 * failure main.ts guards against).
 */
export interface Scope {
  /** addEventListener now, removeEventListener on dispose. */
  listen<K extends keyof WindowEventMap>(target: Window, type: K, fn: (ev: WindowEventMap[K]) => void, opts?: AddEventListenerOptions | boolean): () => void;
  listen<K extends keyof DocumentEventMap>(target: Document, type: K, fn: (ev: DocumentEventMap[K]) => void, opts?: AddEventListenerOptions | boolean): () => void;
  listen<K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, fn: (ev: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions | boolean): () => void;
  listen(target: EventTarget, type: string, fn: EventListenerOrEventListenerObject, opts?: AddEventListenerOptions | boolean): () => void;
  /** requestAnimationFrame now, cancelAnimationFrame on dispose (a frame that already ran is a no-op). */
  raf(fn: FrameRequestCallback): () => void;
  /** setTimeout now, clearTimeout on dispose. */
  timeout(fn: () => void, ms: number): () => void;
  /** setInterval now, clearInterval on dispose. */
  interval(fn: () => void, ms: number): () => void;
  /** Any other release step (an observer's disconnect, a stream's stop). */
  add(release: () => void): () => void;
  /** Run every release once, newest first. Safe to call twice. */
  dispose(): void;
  /** True once dispose() has run; late registrations are released immediately. */
  readonly disposed: boolean;
}

export function createScope(onError: (e: unknown) => void = (e) => console.error('[scope] release threw:', e)): Scope {
  const releases: (() => void)[] = [];
  let disposed = false;
  const add = (release: () => void): (() => void) => {
    if (disposed) { try { release(); } catch (e) { onError(e); } return () => {}; }
    releases.push(release);
    return () => {
      const i = releases.indexOf(release);
      if (i >= 0) releases.splice(i, 1);
      try { release(); } catch (e) { onError(e); }
    };
  };
  const scope: Scope = {
    listen(target: EventTarget, type: string, fn: EventListenerOrEventListenerObject, opts?: AddEventListenerOptions | boolean) {
      target.addEventListener(type, fn, opts);
      return add(() => target.removeEventListener(type, fn, opts));
    },
    raf(fn) {
      const id = requestAnimationFrame(fn);
      return add(() => cancelAnimationFrame(id));
    },
    timeout(fn, ms) {
      const id = setTimeout(fn, ms);
      return add(() => clearTimeout(id));
    },
    interval(fn, ms) {
      const id = setInterval(fn, ms);
      return add(() => clearInterval(id));
    },
    add,
    dispose() {
      if (disposed) return;
      disposed = true;
      while (releases.length) {
        const release = releases.pop()!;
        try { release(); } catch (e) { onError(e); }
      }
    },
    get disposed() { return disposed; },
  };
  return scope;
}
