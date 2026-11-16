// SPDX-License-Identifier: MPL-2.0
/**
 * The tool view's stage kit (lib/stage-kit.ts, plan 368 W1a): the one layer on the stage
 * where a tool's own controls are drawn at screen size, beside the picture.
 *
 * Made on first request, never before: a tool that asks for no controls costs nothing
 * and its stage is exactly as it was. Disposed with the mount, which hands the stage back
 * its reserved band and tells the canvas to fit again. Offered only where the stage
 * navigation runs (`canvasStage`): a framed tool, a paged document, a bare utility and
 * the visitor page draw no stage chrome, and a studio there draws no toolbar.
 */
import { t } from '../../i18n.ts';
import { mountStageKit, type StageKit } from '../../lib/stage-kit.ts';
import { bindOp, type ToolViewCtx } from './context.ts';

/** The mounted kit, made now if this is the first request. Null where no stage chrome is drawn. */
export function stageKit(tview: ToolViewCtx): StageKit | null {
  if (tview.stageKitHandle) return tview.stageKitHandle;
  if (!tview.canvasStage || !tview.stageEl || !tview.canvasEl || tview.mountLifecycle.disposed) return null;
  const kit = mountStageKit(tview.stageEl, { canvas: tview.canvasEl, label: t('Canvas controls') });
  tview.stageKitHandle = kit;
  tview.mountLifecycle.add('stage kit', () => {
    kit.dispose();
    tview.stageKitHandle = null;
  });
  return kit;
}

export function stageKitOps(tview: ToolViewCtx) {
  return {
    get: bindOp(tview, stageKit),
  };
}
