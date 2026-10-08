// SPDX-License-Identifier: MPL-2.0
import { previewContentWork } from './collab-preview-content.ts';

interface Job {
  source: HTMLElement;
  current(): boolean;
  apply(content: HTMLElement): void;
  work?: ReturnType<typeof previewContentWork>;
}

/** Detailed artwork follows the outline's first presentation opportunity. */
export function previewRefiner(view: Window, idle: (applied: number) => void = () => {}) {
  const jobs = new Map<string, Job>();
  const applied = new Map<string, Job>();
  let frame = 0, disposed = false;
  const request = (fn: FrameRequestCallback) => view.requestAnimationFrame(fn);
  function flush(): void {
    frame = 0;
    if (disposed) return;
    const deadline = view.performance.now() + 4;
    const ready: Array<{ key: string; job: Job; content: HTMLElement }> = [];
    // Finish style reads before attaching any completed clone to the live overlay.
    for (const [key, job] of jobs) {
      if (!job.current()) { jobs.delete(key); continue; }
      job.work ??= previewContentWork(job.source);
      const result = job.work.step(deadline);
      if (result.done) {
        jobs.delete(key);
        if (result.content) ready.push({ key, job, content: result.content });
      }
      if (view.performance.now() >= deadline) break;
    }
    for (const { key, job, content } of ready) if (job.current()) { job.apply(content); applied.set(key, job); }
    if (jobs.size) frame = request(flush);
    else { idle([...applied.values()].filter(job => job.current()).length); applied.clear(); }
  }
  return {
    set(key: string, source: HTMLElement, current: Job['current'], apply: Job['apply']) {
      if (disposed) return;
      applied.delete(key);
      jobs.set(key, { source, current, apply });
      if (!frame) frame = request(() => { frame = request(flush); });
    },
    delete(key: string) { jobs.delete(key); applied.delete(key); },
    dispose() { disposed = true; if (frame) view.cancelAnimationFrame(frame); frame = 0; jobs.clear(); applied.clear(); },
  };
}
