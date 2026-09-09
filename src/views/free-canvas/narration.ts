// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: sequenced frames and deck narration.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { framesAreSequenced, sequenceFramesInOrder } from '../free-canvas-math.ts';
import type { Box } from '../free-canvas-math.ts';
import type { NarrationStatus } from '../design-ports.ts';
import { DESIGN_NARRATION_FIELDS, narrationFrames as narrationFramesOf, narrationStatusFor, reanchorNarration } from '../../lib/narration.ts';
import type { NarrationFields, NarrationTiming } from '../../lib/narration.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { announce } from '../../a11y.ts';
import { t, tRaw } from '../../i18n.ts';
import { bindOp, type FcCtx } from './context.ts';

export function hideSeqPrompt(fc: FcCtx): void {
  const { seqPromptEl } = fc;
  if (!seqPromptEl.hidden) seqPromptEl.hidden = true;
}
/** The frames-as-scenes field config, or null when this tool has no frames/time model. */
export function frameSeqCfg(fc: FcCtx): {
  kindField: string;
  frameKind: string;
  startField: string;
  durField: string;
} | null {
  const { cfg, frameCfg, timeCfg } = fc;
  if (!frameCfg || !timeCfg) return null;
  return {
    kindField: cfg.kindField,
    frameKind: frameCfg.frameKind,
    startField: timeCfg.startField,
    durField: timeCfg.durField,
  };
}
export function frameCount(fc: FcCtx, boxes: Box[]): number {
  const { cfg, frameCfg } = fc;
  if (!frameCfg) return 0;
  let n = 0;
  for (const b of boxes) if (b && String(b[cfg.kindField]) === frameCfg.frameKind) n++;
  return n;
}
/** The field map lib/narration.ts writes through, built from THIS tool's canvas
 *  config so the pure module never has to know Design's names by heart. */
export function narrationFields(fc: FcCtx): NarrationFields | null {
  const { FRAME_NOTES_FIELD, cfg, frameCfg, timeCfg } = fc;
  if (!frameCfg || !timeCfg || !cfg.groupField) return null;
  return {
    ...DESIGN_NARRATION_FIELDS,
    idField: cfg.idField,
    kindField: cfg.kindField,
    frameField: frameCfg.frameField,
    frameKind: frameCfg.frameKind,
    orderField: frameCfg.orderField || 'order',
    groupField: cfg.groupField,
    laneField: timeCfg.laneField,
    startField: timeCfg.startField,
    durField: timeCfg.durField,
    enterField: timeCfg.enterField,
    exitField: timeCfg.exitField,
    enterMsField: timeCfg.enterMsField,
    exitMsField: timeCfg.exitMsField,
    notesField: FRAME_NOTES_FIELD,
    ...(timeCfg.duckField ? { duckField: timeCfg.duckField } : {}),
    ...(cfg.imageField ? { assetField: cfg.imageField } : {}),
    ...(cfg.textField ? { textField: cfg.textField } : {}),
  };
}
/** A document-level number input, or `fallback` when it is unset or nonsense. */
export function docNumInput(fc: FcCtx, id: string, fallback: number): number {
  const { runtime } = fc;
  const v = runtime.getModel().find((i) => i.id === id)?.value;
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
/** The document's lead-in and tail, with the manifest's own defaults. Read fresh every
 *  time: both are doc inputs the author can change between two narrate runs. */
export function narrationTiming(fc: FcCtx): NarrationTiming {
  return {
    leadInMs: docNumInput(fc, 'narrationLeadInMs', 400),
    tailMs: docNumInput(fc, 'narrationTailMs', 600),
  };
}
/**
 * Frames re-flowed, and everything anchored to them moved with it (plans/180 T7).
 *
 * `sequenceFramesInOrder` writes FRAME rows only - a Design box stores absolute
 * film-clock seconds, so a re-pack that lengthens slide one leaves slide two's voice,
 * its captions and its build fragments speaking over slide one. One commit, so the
 * whole re-flow is a single undo step.
 */
export function commitSequenced(fc: FcCtx, placed: Box[]): void {
  const f = narrationFields(fc);
  fc.select.commit(f ? reanchorNarration(placed, f, narrationTiming(fc)) : placed);
}
/** One slide's narration status, for the navigator dot and the inspector button. */
export function narrationStatusOf(fc: FcCtx, frameId: string): NarrationStatus {
  const f = narrationFields(fc);
  return f ? narrationStatusFor(fc.select.getBoxes(), f, frameId) : 'none';
}
/** How many slides carry speaker notes at all - what greys the deck-wide row. */
export function framesWithNotes(fc: FcCtx): number {
  const f = narrationFields(fc);
  if (!f) return 0;
  let n = 0;
  for (const fr of narrationFramesOf(fc.select.getBoxes(), f)) if (fr.spoken) n++;
  return n;
}
export async function narrateDeck(fc: FcCtx, frameId?: string): Promise<void> {
  const { cfg, frameCfg, host, runtime, timeCfg } = fc;
  if (fc.disposed || !frameCfg || !timeCfg || !cfg.groupField) return;
  // A second press while a run is in flight used to do nothing at all - no toast, no
  // announcement, no state change - so the button read as broken. Say what is going on.
  if (fc.narrateBusy) {
    announce(t('A narration run is already going.'));
    return;
  }
  const speech = (host as unknown as HostV1).speech;
  if (!speech?.isAvailable()) return;
  fc.narrateBusy = true;
  const release = (): void => {
    fc.narrateBusy = false;
  };
  try {
    // Lazy for the Script-audio reason: the whole speech path is a chunk nothing
    // else on this canvas needs until somebody asks for a voice.
    const [{ openNarrateConsent }, { currentLang }] = await Promise.all([
      import('../../lib/narration.ts'),
      import('../../i18n.ts'),
    ]);
    const fields = narrationFields(fc);
    if (!fields) {
      release();
      return;
    }
    const docText = (id: string): string => {
      const v = runtime.getModel().find((i) => i.id === id)?.value;
      return v == null ? '' : String(v);
    };
    const tr = frameCfg.transitionField;
    await openNarrateConsent(
      host as unknown as Parameters<typeof openNarrateConsent>[0],
      {
        fields,
        getBoxes: fc.select.getBoxes,
        commit: fc.select.commit,
        repack: (floors) => {
        const timeCfg = fc.timeCfg as NonNullable<FcCtx['timeCfg']>;
          // One commit for both halves: the frames re-flow, then every clip, caption and
          // build fragment anchored to them follows (plans/180 T7).
          commitSequenced(fc, 
            sequenceFramesInOrder(fc.select.getBoxes(), {
              defaultDurMs: 3000,
              lane: 'seq',
              minDurMs: floors,
              idField: cfg.idField,
              ...(tr
                ? { transitionField: tr, docTransition: fc.select.docTransitionValue() }
                : { defaultEnter: 'fade', defaultExit: 'fade' }),
              startField: timeCfg.startField,
              durField: timeCfg.durField,
              laneField: timeCfg.laneField,
              enterField: timeCfg.enterField,
              exitField: timeCfg.exitField,
              orderField: frameCfg.orderField || 'order',
              kindField: cfg.kindField,
              frameKind: frameCfg.frameKind,
            })
          );
        },
        voice: docText('narrationVoice'),
        speed: docNumInput(fc, 'narrationSpeed', 1),
        timing: narrationTiming(fc),
        // Asking for ONE slide is always a deliberate re-record, so it never waits
        // for the notes to have changed.
        ...(frameId ? { frameIds: [frameId], force: true } : {}),
        lang: currentLang(),
      },
      { onDismiss: release, onSettled: release }
    );
  } catch (err) {
    (host as unknown as HostV1).log?.('warn', `narrate failed - ${String(err)}`);
    release();
  }
}
/**
 * Offer to sequence the frames when the timeline is open - but only when frames exist and
 * NONE are timed yet (never nag once sequenced), and only once per session (a decline
 * sticks). Positioned by CSS at the top-centre of the overlay, out of the toolbar's way.
 */
export function maybePromptSequenceFrames(fc: FcCtx): void {
  const { seqPromptEl, seqPromptTxt } = fc;
  if (fc.disposed || fc.seqPromptDismissed) return;
  const sc = frameSeqCfg(fc);
  if (!sc || !fc.timelinePanel?.isOpen()) {
    hideSeqPrompt(fc);
    return;
  }
  const boxes = fc.select.getBoxes();
  const n = frameCount(fc, boxes);
  if (n < 1 || framesAreSequenced(boxes, sc)) {
    hideSeqPrompt(fc);
    return;
  }
  seqPromptTxt.textContent =
    n === 1
      ? t('Play this frame in the timeline?')
      : tRaw('Play your {n} frames in order?').replace('{n}', String(n));
  seqPromptEl.hidden = false;
}
export function narrationOps(fc: FcCtx) {
  return {
    hideSeqPrompt: bindOp(fc, hideSeqPrompt),
    frameSeqCfg: bindOp(fc, frameSeqCfg),
    frameCount: bindOp(fc, frameCount),
    narrationFields: bindOp(fc, narrationFields),
    docNumInput: bindOp(fc, docNumInput),
    narrationTiming: bindOp(fc, narrationTiming),
    commitSequenced: bindOp(fc, commitSequenced),
    narrationStatusOf: bindOp(fc, narrationStatusOf),
    framesWithNotes: bindOp(fc, framesWithNotes),
    narrateDeck: bindOp(fc, narrateDeck),
    maybePromptSequenceFrames: bindOp(fc, maybePromptSequenceFrames),
  };
}
