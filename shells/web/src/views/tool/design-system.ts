// SPDX-License-Identifier: MPL-2.0
/**
 * tool view: design-system changes and the render shutter.
 *
 * Every function takes the shared `tview: ToolViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tview.<module>.<fn>`. Extracted verbatim
 * from mountTool() by scripts/split-closure.ts.
 */
import { escape as escapeText } from '../../utils.ts';
import { t } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { bindOp, type ToolViewCtx } from './context.ts';

// A switch while this tool is open (plans/186 section 3.4 step 6): the switch does
// not tear a tool down, so it is told here and offered a reload.
export const onDesignSystemChanged = (tview: ToolViewCtx, e: Event): void => {
  const { mountedSystemId, stageEl, viewEl } = tview;
  const rec = (e as CustomEvent<{ id: string; label: string }>).detail;
  if (!rec || rec.id === mountedSystemId || viewEl.querySelector('#ds-switched-notice')) return;
  const body = viewEl.querySelector<HTMLElement>('.sidebar-body') ?? stageEl;
  const el = document.createElement('div');
  el.className = 'tool-notice';
  el.id = 'ds-switched-notice';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="tool-notice-text">${t('Switched to <strong>{name}</strong>. Reload this tool to render with it.', { name: escapeText(rec.label) })} <button type="button" class="tool-notice-link" id="ds-switched-reload">${t('Reload')}</button></span><button type="button" class="tool-notice-close" id="ds-switched-dismiss" aria-label="${escapeText(t('Dismiss this message'))}">✕</button>`;
  body.prepend(el);
  el.querySelector('#ds-switched-reload')?.addEventListener('click', () =>
    window.dispatchEvent(new Event('lolly:remount'))
  );
  el.querySelector('#ds-switched-dismiss')?.addEventListener('click', () => el.remove());
};
export const openShutter = (tview: ToolViewCtx): void => { const { shutter } = tview; shutter.open(); };
// Named apart from the object because `shutter` is shadowed by the boolean opt
// inside exportUnscaledRaw, which is where the progress actually arrives.
export const reportShutterProgress = (tview: ToolViewCtx, done: number, total: number): void =>
  { const { shutter } = tview; shutter.progress(done, total); };
// A long export (video, a sequence, a big multi-page fan-out) seals the screen
// for minutes - fullscreen on a phone - so it closes WITH a status block: the
// tool name, the format, live progress and elapsed time, plus a way out. An
// export that passed an abort signal gets Cancel (the encode loops poll it and
// stop); the rest keep Hide, which opens the shutter and lets the export finish
// underneath rather than claiming to stop it.
// The block only appears once the export outlasts STATUS_DELAY (lib/shutter.ts),
// which is what keeps a sub-second still export looking exactly as it did.
export const closeShutter = (tview: ToolViewCtx, detail?: string, onCancel?: () => void): Promise<void> =>
  { const { shutter } = tview; return shutter.close({
    label: tview.tool.manifest.name,
    ...(detail ? { detail } : {}),
    onHide: () => {
      openShutter(tview);
      announce(t('Exporting…'));
    },
    ...(onCancel ? { onCancel } : {}),
  }); };
// Standalone visual (no export gating) - used by Copy, whose clipboard write
// must stay in the user-gesture context, so we can't await the shutter first.
export function playShutter(tview: ToolViewCtx): void {
  const { shutter } = tview;
  shutter.play();
}
export function designSystemOps(tview: ToolViewCtx) {
  return {
    onDesignSystemChanged: bindOp(tview, onDesignSystemChanged),
    openShutter: bindOp(tview, openShutter),
    reportShutterProgress: bindOp(tview, reportShutterProgress),
    closeShutter: bindOp(tview, closeShutter),
    playShutter: bindOp(tview, playShutter),
  };
}
