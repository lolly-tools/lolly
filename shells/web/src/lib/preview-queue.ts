// SPDX-License-Identifier: MPL-2.0
import { previewDeadline } from './preview-deadline.ts';
/** One serial idle queue shared by the gallery grid and featured strips. */
export interface PreviewTask {
  /** Lower runs first; null parks the task until the view makes it relevant. */
  priority(): number | null;
  stale?(): boolean;
  run(): Promise<void>;
}

const idle = (callback: () => void): (() => void) => {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(callback, { timeout: 3000 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(callback, 60);
  return () => clearTimeout(id);
};

export function createPreviewQueue(
  schedule: (callback: () => void) => () => void = idle,
  onError: (error: unknown) => void = error => console.warn('Preview render failed', error),
  timeoutMs = 60_000,
) {
  let tasks: PreviewTask[] = [];
  let cancel: (() => void) | undefined;
  let running = false;
  let destroyed = false;
  let paused = false;
  /** Short holds from moving strips (a Cover Flow swipe), counted so two strips and
   *  the welcome dialog's setPaused never release each other's pause. */
  let holds = 0;
  const halted = (): boolean => destroyed || paused || holds > 0;

  function wake(): void {
    if (halted() || running || cancel || !tasks.length) return;
    cancel = schedule(() => {
      cancel = undefined;
      if (halted()) return;
      // Choose AFTER yielding: a newly queued cover always outranks an extra
      // template, including one that was waiting when this idle was requested.
      tasks = tasks.filter(task => !task.stale?.());
      let chosen = -1;
      let best = Infinity;
      tasks.forEach((task, i) => {
        const priority = task.priority();
        if (priority !== null && priority < best) { chosen = i; best = priority; }
      });
      if (chosen < 0) return;
      const task = tasks.splice(chosen, 1)[0]!;
      running = true;
      void previewDeadline(Promise.resolve().then(() => task.run()), timeoutMs).catch(onError).finally(() => {
        running = false;
        wake();
      });
    });
  }

  return {
    add(task: PreviewTask): void { if (!destroyed) { tasks.push(task); wake(); } },
    wake,
    setPaused(value: boolean): void {
      paused = value;
      if (paused) { cancel?.(); cancel = undefined; }
      else wake();
    },
    /** Hold the queue until the returned release is called (once; later calls do
     *  nothing). A render already running finishes; nothing new starts meanwhile. */
    hold(): () => void {
      holds++;
      cancel?.();
      cancel = undefined;
      let held = true;
      return () => {
        if (!held) return;
        held = false;
        holds--;
        wake();
      };
    },
    destroy(): void { destroyed = true; tasks = []; cancel?.(); cancel = undefined; },
  };
}

export type PreviewQueue = ReturnType<typeof createPreviewQueue>;
