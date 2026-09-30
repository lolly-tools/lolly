// SPDX-License-Identifier: MPL-2.0
/** Allocate the Rules panel before fitting artwork, retaining the editor's own view. */
export function mountRulesWorkspace(opts: {
  stage: HTMLElement; panel: HTMLElement; toolbar: HTMLElement;
  navigation?: { fit(): void; preserve(): (() => void) | undefined };
}) {
  let active = false;
  let restore: (() => void) | undefined;
  let frame = 0;
  let last = '';
  const measure = (): void => {
    frame = 0;
    if (!active || !opts.stage.isConnected) return;
    const stage = opts.stage.getBoundingClientRect();
    const panel = opts.panel.getBoundingClientRect();
    const toolbar = opts.toolbar.getBoundingClientRect();
    const bottomSheet = panel.width > stage.width * .75;
    const bottom = opts.panel.hidden || !bottomSheet ? 0 : Math.max(0, stage.bottom - panel.top);
    const right = opts.panel.hidden || bottomSheet ? 0 : Math.max(0, stage.right - panel.left);
    const top = Math.max(0, toolbar.bottom - stage.top);
    const key = `${stage.width}/${stage.height}/${top}/${right}/${bottom}`;
    if (key === last) return;
    last = key;
    for (const [edge, value] of Object.entries({ top, right, bottom, left: 0 })) opts.stage.style.setProperty(`--rules-${edge}`, `${value}px`);
    opts.navigation?.fit();
  };
  const schedule = (): void => { if (active && !frame) frame = requestAnimationFrame(measure); };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : undefined;
  for (const element of [opts.stage, opts.panel, opts.toolbar]) observer?.observe(element);
  const set = (next: boolean): void => {
    if (active === next) { schedule(); return; }
    active = next; last = '';
    if (active) {
      restore = opts.navigation?.preserve();
      opts.stage.style.setProperty('--rules-workspace', '1');
      measure();
    } else {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      for (const key of ['workspace', 'top', 'right', 'bottom', 'left']) opts.stage.style.removeProperty(`--rules-${key}`);
      restore?.(); restore = undefined;
    }
  };
  return { set, refresh: schedule, destroy() { set(false); observer?.disconnect(); } };
}
