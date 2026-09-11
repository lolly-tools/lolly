// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: small helpers - buttons, box lookups, media durations, row labels.
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tp.<module>.<fn>`. Extracted verbatim
 * from initTimelinePanel() by scripts/split-closure.ts.
 */
import { t } from '../../i18n.ts';
import { icon } from '../../lib/icons.ts';
import type { IconName } from '../../lib/icons.ts';
import { indexOfId } from '../timeline-math.ts';
import type { Box, MediaDurFn } from '../timeline-math.ts';
import { isNarrationGroup } from '../../lib/narration.ts';
import { cssEscape } from './shared.ts';
import type { BoxMedia } from './shared.ts';
import { bindOp, type TpCtx } from './context.ts';

export const compactPanel = (_tp: TpCtx): boolean =>
  typeof matchMedia === 'function' &&
  matchMedia(
    '(pointer: coarse) and (max-width: 640px), (pointer: coarse) and (max-height: 430px)'
  ).matches;
export const btn = (_tp: TpCtx, cls: string, label: string, glyph: string): HTMLButtonElement => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `tl-btn ${cls}`;
  b.setAttribute('aria-label', label);
  b.setAttribute('data-tip', label);
  b.innerHTML = glyph;
  return b;
};
/**
 * A button that says what it does IN WORDS, with the glyph beside the text rather
 * than instead of it.
 *
 * The panel's `btn()` above is the TOOLBAR recipe - a 24px target in a row of
 * peers, where the icon is the whole control and the label lives in `aria-label` +
 * a tooltip. That is the wrong register inside the inspector, where an action
 * arrives alone in a disclosed group with nothing beside it to give it context:
 * "+Keyframe" and "Animate" are decisions, and a decision gets a word. Built ON
 * `btn` (never beside it) so there is still exactly one place that mints the icon
 * markup and the accessible name.
 */
export const actionBtn = (tp: TpCtx, cls: string, label: string, glyph: IconName): HTMLButtonElement => {
  const b = btn(tp, `tl-action ${cls}`, label, icon(glyph));
  // The text IS the label now, so the hover bubble would just repeat it.
  b.removeAttribute('data-tip');
  const span = document.createElement('span');
  span.className = 'tl-action-label';
  span.textContent = label;
  b.appendChild(span);
  return b;
};
// ── model plumbing (every write funnels through here) ───────────────────────

/** The one write path. Called at most once per gesture, on pointerup. */
export function write(tp: TpCtx, next: Box[]): void {
  const { blockId, commit, onDirty } = tp;
  onDirty?.(blockId);
  commit(next);
}
/** Set fields on one box. A VALUE write - no arithmetic, by design (see header). */
export function patchBox(tp: TpCtx, boxes: Box[], id: string, patch: Record<string, Box[string]>): Box[] {
  const { cfg } = tp;
  const i = indexOfId(boxes, cfg, id);
  if (i < 0) return boxes;
  return boxes.map((b, k) => (k === i ? { ...b!, ...patch } : b));
}
/** The canvas element rendering a box, if it is on screen. */
export function boxEl(tp: TpCtx, id: string): HTMLElement | null {
  const { canvasEl } = tp;
  if (!id) return null;
  return canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${cssEscape(id)}"]`);
}
/**
 * The media length a DETACHED sound borrows from the clip it came from.
 *
 * A detached audio box is a REFERENCE - same asset ref, same URL - but the tool hook
 * only stamps `data-audio-dur` when the ASSET carries a `meta.durationMs`, and a video
 * file's ref usually does not (its length is discovered by decoding it). The partner
 * video element has already decoded, and `video.duration` is the same number the
 * sound's own source runs for. Without this a detached sound is unclamped: you can
 * drag its out-edge past the end of the file into silence, and "fit to media" cannot
 * work - the exact hole `data-audio-dur` exists to close for a library track.
 *
 * Reads the partner's <video> DIRECTLY rather than recursing through mediaOf, so a
 * mutually-linked pair can never loop.
 */
export function linkedMediaDur(tp: TpCtx, id: string): number | null {
  const { cfg, getBoxes } = tp;
  const link = cfg.linkField;
  if (!link) return null;
  const rows = getBoxes();
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return null;
  const partner = rows[i]![link];
  if (partner == null || partner === '') return null;
  const video = boxEl(tp, String(partner))?.querySelector<HTMLVideoElement>('video.lolly-box-video');
  const d = Number(video?.duration);
  return Number.isFinite(d) && d > 0 ? d : null;
}
/** Struck-through / ignored (plans/174) - kept in the ruler, skipped everywhere else. */
export const boxIgnored = (tp: TpCtx, b: Box | undefined): boolean =>
  { const { cfg } = tp; return !!b && !!cfg.ignoredField && (b[cfg.ignoredField] === true || b[cfg.ignoredField] === 'true'); };
/**
 * A box's media, read from the LIVE CANVAS rather than the model: the hook has already
 * resolved the asset ref to a URL there, and a decoded <video> also knows its real
 * duration - which is exactly what trimClip's media clamp wants.
 */
export function mediaOf(tp: TpCtx, id: string): BoxMedia {
  const el = boxEl(tp, id);
  if (!el) return { url: '', kind: '', dur: null };
  const audio = el.querySelector<HTMLElement>('.lolly-box-audio[data-audio-src]');
  if (audio) {
    // An audio box has no media element to ask for .duration, so the tool hook
    // stamps the source's length from the asset's own metadata. This is what lets
    // a sound be trimmed PRECISELY: trimClip clamps clipIn + dur*speed against it,
    // "fit to media" works, and promote defaults the length to the track rather
    // than to a flat 3s. Absent (a procedural bed has no fixed length) reads back
    // as null, which is the old unclamped behaviour.
    const ms = Number(audio.getAttribute('data-audio-dur'));
    return {
      url: audio.getAttribute('data-audio-src') || '',
      kind: 'audio',
      dur: Number.isFinite(ms) && ms > 0 ? ms / 1000 : linkedMediaDur(tp, id),
    };
  }
  const video = el.querySelector<HTMLVideoElement>('video.lolly-box-video');
  if (video) {
    const d = Number(video.duration);
    return {
      url: video.currentSrc || video.src || '',
      kind: 'video',
      dur: Number.isFinite(d) && d > 0 ? d : null,
    };
  }
  // A Lottie is a MARKER div, not an <img>: the shell's lottie-mount enhancer builds
  // a live <svg> inside it. Checked before the <img> branch because the marker also
  // carries .lolly-box-img (it inherits the same position/size rules). Its picture is
  // that mounted <svg> - absent until the player has painted, which just means the
  // bar stays plain until the next thumb pass.
  const lottie = el.querySelector<HTMLElement>('.lolly-box-lottie[data-lottie-src]');
  if (lottie) {
    return {
      url: lottie.getAttribute('data-lottie-src') || '',
      kind: 'lottie',
      dur: null,
      el: lottie.querySelector('svg'),
    };
  }
  // Plain images AND tool clips: a tool-as-clip resolves through host.compose to a
  // data: URL and arrives here as an ordinary <img>, so it needs no branch of its own.
  const img = el.querySelector<HTMLImageElement>('img.lolly-box-img');
  if (img) return { url: img.currentSrc || img.src || '', kind: 'image', dur: null, el: img };
  return { url: '', kind: '', dur: null };
}
export const mediaDur = (tp: TpCtx, b: Parameters<MediaDurFn>[0]): ReturnType<MediaDurFn> => {
  const { cfg } = tp;
  const id = b?.[cfg.idField];
  return id == null || id === '' ? null : mediaOf(tp, String(id)).dur;
};
/** Trim a label to `max` graphemes-ish, with the ellipsis inside the budget. */
export function trimLabel(_tp: TpCtx, s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
/**
 * The FIRST LINE of a box's own words, trimmed (plans/179 T11).
 *
 * First line, because a bar is one line tall and a paragraph's second sentence is
 * not what identifies it; 24 characters, because that is about what a bar shows
 * before the ellipsis is doing all the talking anyway.
 */
export function textLabel(tp: TpCtx, el: HTMLElement | null): string {
  const raw = el?.querySelector<HTMLElement>('.lolly-box-text')?.textContent ?? '';
  for (const line of raw.split('\n')) {
    const s = line.trim();
    if (s) return trimLabel(tp, s, 24);
  }
  return '';
}
/**
 * A FRAME's label: the board's own name, else its place in the deck (plans/179 T11).
 *
 * Both halves come off the live canvas rather than the model, for `mediaOf`'s reason
 * and one more of their own. The name is `data-frame-name`, which the tool hook
 * stamps from the blocks input's `labelField` - so a renamed board says its name on
 * the timeline for the same reason it says it in the sidebar. The NUMBER is the
 * page's position among `[data-frame-id]` in DOM order, which is the deck's own page
 * order (`frameGroupsFor` sorts by `order` then x before it emits) - so the timeline
 * cannot number a deck differently from the canvas, the presenter or the PDF.
 */
export function frameLabel(tp: TpCtx, id: string): string {
  const { canvasEl } = tp;
  const pages = Array.from(canvasEl.querySelectorAll<HTMLElement>('[data-frame-id]'));
  const n = pages.findIndex((p) => p.getAttribute('data-frame-id') === id);
  const named = pages[n]?.getAttribute('data-frame-name')?.trim() ?? '';
  if (named) return trimLabel(tp, named, 48);
  return t('Slide {n}', { n: n >= 0 ? n + 1 : pages.length + 1 });
}
/**
 * A bar/chip/lane's human label: the user's own name if one was set (rename), else
 * the box's own first line of text, else what it IS (plans/179 T11).
 *
 * "Clip" is the answer of last resort and nothing routine may reach it. It used to be
 * what the audio bed, every untimed background box and every artboard chip got called -
 * a timeline whose rows all read "Clip" tells the user nothing at all - so the kind
 * ladder below answers off the MODEL after the media probe has had its say. Model
 * last, deliberately: the probe knows a `kind:'image'` box is really a video because
 * the hook resolved its asset, and the manifest's own add-kinds seed several
 * different things as `image`.
 */
export function labelFor(tp: TpCtx, id: string): string {
  const { cfg, getBoxes } = tp;
  const el = boxEl(tp, id);
  const rows = getBoxes();
  const ci = indexOfId(rows, cfg, id);
  const row = ci >= 0 ? rows[ci]! : undefined;
  // The user's own name wins over everything - that is what a rename is for.
  if (row && cfg.labelField) {
    const own = String(row[cfg.labelField] ?? '').trim();
    if (own) return trimLabel(tp, own, 48);
  }
  // A generated NARRATION clip says what it is (plans/180). The row's `group` is the
  // stable, untranslated token that identifies it, and the word is translated HERE, at
  // paint time: storing a t() literal in the model would put the author's UI language
  // into the document, the packed `z=` link and every exported layer name.
  if (row && cfg.groupField && isNarrationGroup(row[cfg.groupField])) return t('Narration');
  // A CAMERA next, and off the MODEL: it paints nothing, so every probe below reads
  // '' on it and its chip would have said "Clip" - the one thing a camera is not
  // (plans/104 section 5.4). This is the label the "Always on" scenery chip wears, which is
  // the whole affordance the implicit scene camera is discovered through.
  if (row && tp.camera.isCameraBox(row)) return t('Camera');
  const txt = textLabel(tp, el);
  if (txt) return txt;
  const kind = mediaOf(tp, id).kind;
  if (kind === 'video') return t('Video');
  if (kind === 'audio') return t('Audio');
  if (kind === 'image') return t('Image');
  if (kind === 'lottie') return t('Animation');
  // No media and no words. The box's OWN kind, read the way `isCameraBox` reads it -
  // the hooks' rule, one field, no cfg entry to invent (kind is canvas vocabulary,
  // not timing vocabulary).
  switch (row ? String(row.kind ?? '') : '') {
    case 'audio':
      return t('Audio');
    case 'video':
    case 'clip':
      return t('Video');
    case 'image':
      return t('Image');
    case 'path':
      return t('Shape');
    case 'camera':
      return t('Camera');
    case 'text':
      return t('Text');
    case 'box':
      return t('Box');
    case 'frame':
      return frameLabel(tp, id);
    default:
      return t('Clip');
  }
}
export function helpersOps(tp: TpCtx) {
  return {
    compactPanel: bindOp(tp, compactPanel),
    btn: bindOp(tp, btn),
    actionBtn: bindOp(tp, actionBtn),
    write: bindOp(tp, write),
    patchBox: bindOp(tp, patchBox),
    boxEl: bindOp(tp, boxEl),
    linkedMediaDur: bindOp(tp, linkedMediaDur),
    boxIgnored: bindOp(tp, boxIgnored),
    mediaOf: bindOp(tp, mediaOf),
    mediaDur: bindOp(tp, mediaDur),
    trimLabel: bindOp(tp, trimLabel),
    textLabel: bindOp(tp, textLabel),
    frameLabel: bindOp(tp, frameLabel),
    labelFor: bindOp(tp, labelFor),
  };
}
