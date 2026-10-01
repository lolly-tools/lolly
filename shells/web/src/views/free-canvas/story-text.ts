// SPDX-License-Identifier: MPL-2.0
/** The composed text session plugs into Design's existing selection and history. */
import { readDesignText, serializeTextDocument, upgradeDesignText, defaultTextFrameSettings, textRecipe, parseColor, designTextWrap } from '@lolly/engine';
import type { TextLayoutRequestV1 } from '@lolly-tools/core';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { Runtime } from '../../../../../engine/src/runtime.ts';
import { mountTextEditor, type TextEditorSnapshot } from '../../lib/text-editor-session.ts';
import { mountTextControls } from '../../lib/text-editor-controls.ts';
import { captureLegacyText } from '../../lib/text-editor-migration.ts';
import { emojiPickerOptions } from '../../lib/emoji-picker-options.ts';
import { t } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { pinEditorFont } from '../../lib/text-editor-fonts.ts';
import { nativeTextCaretRect } from '../../lib/text-native-dom.ts';
import { parseCssColorFull } from '../../bridge/export-css.ts';
import { rgbaToHex } from '../../lib/color-formats.ts';
import { retainTextRecovery } from '../../lib/text-collab.ts';
import type { Box } from '../free-canvas-math.ts';
import type { FmtBar } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';
function report(fc: FcCtx, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error); announce(message);
  fc.fmtbar?.setAttribute('data-text-error', message); console.warn('Text edit:', message);
}
export function available(fc: FcCtx): boolean { return !!fc.cv.textDocumentInput && !!fc.runtime.layoutText && !!fc.history?.commit; }
export function request(fc:FcCtx,value:TextLayoutRequestV1):TextLayoutRequestV1{return {...value,wrap:value.wrap??designTextWrap(fc.select.getBoxes())};}
export function layout(fc:FcCtx,value:TextLayoutRequestV1){return fc.runtime.layoutText!(request(fc,value));}
export function peek(fc:FcCtx,value:TextLayoutRequestV1){return fc.runtime.peekTextLayout?.(request(fc,value));}
export function read(fc: FcCtx): TextEditorSnapshot {
  return readDesignText(fc.runtime.getModel().find(item => item.id === fc.cv.textDocumentInput)?.value, fc.select.getBoxes());
}
export async function write(fc: FcCtx, value: TextEditorSnapshot, label: string, typingGroup?: string): Promise<void> {
  if (!fc.history?.commit || !fc.cv.textDocumentInput) throw new Error('Text editing requires transaction history.');
  const before = read(fc);
  if (before.frames.some(frame=>frame.locked && JSON.stringify(value.frames.find(item=>item.id===frame.id))!==JSON.stringify(frame))) throw new Error(t('Unlock this text frame before changing its geometry.'));
  const frames = new Map(value.frames.map(frame => [frame.id, frame]));
  const boxes = fc.select.getBoxes().map(box => {
    const frame = frames.get(String(box[fc.cfg.idField])); if (!frame) return box;
    const { id: _id, storyId, width, height, hidden: _hidden, locked: _locked, ...settings } = frame;
    return { ...box, [fc.cv.textStoryField!]: storyId, [fc.cv.textFrameField!]: JSON.stringify(settings), [fc.cfg.wField]: width, [fc.cfg.hField]: height };
  });
  const values: Record<string, unknown> = {}, text = serializeTextDocument(value.document);
  readDesignText(text,boxes);
  if (text !== fc.runtime.getModel().find(item => item.id === fc.cv.textDocumentInput)?.value) values[fc.cv.textDocumentInput] = text;
  if (JSON.stringify(boxes) !== JSON.stringify(fc.select.getBoxes())) values[fc.blockId] = boxes;
  if (!Object.keys(values).length) return;
  for (const id of Object.keys(values)) fc.onDirty?.(id);
  await fc.history.commit(values, label, typingGroup);
}
export function start(fc: FcCtx, id: string, options: { selectAll?: boolean; point?: { x: number; y: number } } = {}): void {
  if (!available(fc)) { report(fc, new Error(t('This host cannot edit composed text.'))); return; }
  const el = fc.canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${fc.keys.cssEscape(id)}"] .lolly-box-text`);
  if (!el) return;
  const boxEl = el.closest<HTMLElement>('.lolly-box'), before = el.innerHTML, abort = new AbortController();
  let controls: ReturnType<typeof mountTextControls> | undefined;
  fc.editing = { id, el, boxEl, prevHtml: before, prevSource: '', prevRichText: '', prevStyle: el.style.cssText, prevBoxStyle: boxEl?.style.cssText ?? '', pending: {} };
  fc.stageEl.classList.add('is-text-editing'); boxEl?.classList.add('fc-box-editing');
  fc.rail.clearChrome(); fc.rail.hideCtxBar(); fc.document.closeMorePanel(); fc.toolbox.closePopover();
  fc.fmtbar = document.createElement('div') as FmtBar; fc.fmtbar.className = 'fc-fmtbar'; fc.fmtbar.setAttribute('data-export-hide', ''); fc.overlay.append(fc.fmtbar);
  const editor = mountTextEditor(el, {
    removed: () => { void finish(fc, false, true); },
    frameId: id, read: () => read(fc), write: (value, label, typing) => write(fc, value, label, typing),
    layout: value => layout(fc,value),
    assets: (fc.host as HostV1).assets, text:(fc.host as HostV1).text,
    recover: value => {
      const boxes = value.frames.map(frame => {
        const previous = fc.select.getBoxes().find(box => box[fc.cfg.idField] === frame.id);
        const { id, storyId, width, height, hidden, locked, ...settings } = frame;
        return { ...previous, [fc.cfg.idField]: id, [fc.cfg.kindField]: 'text', [fc.cfg.textField]: '', [fc.cv.textStoryField!]: storyId, [fc.cv.textFrameField!]: JSON.stringify(settings), [fc.cfg.wField]: width, [fc.cfg.hField]: height, hidden, locked };
      });
      retainTextRecovery(fc.runtime, { [fc.cv.textDocumentInput!]: serializeTextDocument(value.document), [fc.blockId]: boxes }, value.document.stories.map(story => story.source).join(' ').slice(0, 80));
    },
    frameElement: id => fc.canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${fc.keys.cssEscape(id)}"] .lolly-box-text`),
    nativeRoot: fc.overlay,
    history: redo => { if (redo) fc.history?.redo(); else fc.history?.undo(); },
    changed: () => { controls?.refresh(); position(fc); fc.canvasEl.dispatchEvent(new Event('lolly:text-selection-change')); }, error: error => report(fc, error),
  });
  controls = mountTextControls(fc.fmtbar, editor, {
    fonts: fc.fontOptions, family: value => {
      const probe = document.createElement('span'); probe.style.fontFamily = fc.helpers.fontStackFor(value); el.append(probe);
      const family = getComputedStyle(probe).fontFamily; probe.remove(); return family;
    },
    emoji: emojiPickerOptions(fc.host as HostV1, fc.runtime as Runtime),
    adjustType:anchor=>{void fc.storyType.open(anchor,id,editor.range);},
    convert:anchor=>fc.storyVector.open(anchor,{id,range:editor.range}),
    done: () => finish(fc), focus: active => {fc.canvasEl.classList.toggle('is-text-focus', active);fc.stageEl.dispatchEvent(new CustomEvent('fc-text-focus',{detail:{active}}));}, error: error => report(fc, error),
  });
  const unsubscribe = fc.runtime.subscribe(() => { try { editor.refresh(); } catch (error) { report(fc, error); } });
  fc.editing.composed = {
    editor,
    cancel: () => editor.cancel(),
    destroy: () => { abort.abort(); unsubscribe?.(); controls?.destroy(); editor.destroy(); },
    position: () => position(fc),
  };
  editor.input.addEventListener('keydown', event => {
    if (event.isComposing || editor.surface.composing) { event.stopPropagation(); return; }
    if (event.key === 'Escape') { event.preventDefault(); if (!controls?.close()) finish(fc, true); }
    else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); finish(fc); }
    else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') { event.preventDefault(); fc.fmtbar?.querySelector<HTMLButtonElement>('[aria-label="'+t('Bold')+'"]')?.click(); }
    event.stopPropagation();
  }, { signal: abort.signal });
  editor.input.addEventListener('blur', event => {
    if (controls?.owns(event.relatedTarget as Node) || (event.relatedTarget as Element)?.closest?.('[data-composed-inspector],[data-topbar="inspector"]') || editor.surface.composing) return;
    if (event.relatedTarget && !(event.relatedTarget as Element).closest('.emoji-pop')) finish(fc);
  }, { signal: abort.signal });
  el.addEventListener('lolly:text-frame-removed', () => finish(fc, false, true), { signal: abort.signal });
  document.addEventListener('pointerdown', event => {
    const target = event.target as Node;
    if (!el.contains(target) && !editor.input.contains(target) && !controls?.owns(target) && !(target as Element).closest?.('.emoji-pop,[data-composed-inspector],[data-topbar="inspector"]') && !editor.surface.composing) finish(fc);
  }, { capture: true, signal: abort.signal });
  window.visualViewport?.addEventListener('resize', () => position(fc), { signal: abort.signal });
  window.visualViewport?.addEventListener('scroll', () => position(fc), { signal: abort.signal });
  window.addEventListener('resize', () => position(fc), { signal: abort.signal });
  // A model change reaches the canvas on the next paint, and a chrome sync queued before
  // the change can run ahead of that paint. A linked frame that moved or turned would
  // then keep its old projection, so place the editor again after every clean paint.
  fc.canvasEl.addEventListener('lolly-canvas-painted', () => position(fc), { signal: abort.signal });
  void editor.ready.then(() => {
    if (fc.editing?.id !== id) return;
    if (options.point) editor.selectAt(options.point.x, options.point.y);
    else if(!options.selectAll&&fc.textPathSelection?.id===id&&fc.textPathSelection.story===editor.story.id&&fc.textPathSelection.revision===editor.story.revision)editor.select(fc.textPathSelection);
    else editor.select({ start: options.selectAll ? 0 : editor.story.source.length, end: editor.story.source.length });
    controls?.refresh(); position(fc);
  });
}
export function position(fc: FcCtx): void {
  if (!fc.fmtbar || !fc.editing) return;
  fc.editing.composed?.editor.reposition();
  const stage = fc.stageEl.getBoundingClientRect(), box = fc.editing.boxEl?.getBoundingClientRect();
  if (!box) return;
  const bar = fc.fmtbar, view = window.visualViewport, compact = (view?.width ?? innerWidth) <= 720;
  const left = Math.max(fc.navReserveLeft || 0, (view?.offsetLeft ?? 0) - stage.left, 0) + 8;
  const right = Math.min(stage.width - (fc.inspectorReserveRight || 0), (view?.offsetLeft ?? 0) + (view?.width ?? innerWidth) - stage.left) - 8;
  const availableWidth = Math.max(180, right - left);
  const actions = document.querySelector<HTMLElement>('.design-compact-actions')?.getBoundingClientRect();
  const bottom = Math.min(stage.bottom, (view?.offsetTop ?? 0) + (view?.height ?? innerHeight), compact && actions?.height ? actions.top : Infinity);
  bar.style.maxWidth = `${Math.min(availableWidth, compact ? 600 : 640)}px`;
  if (compact) {
    bar.style.left = `${left}px`; bar.style.width = `${availableWidth}px`;
    bar.style.top = `${Math.max(6, bottom - stage.top - bar.offsetHeight - 8)}px`;
  } else {
    bar.style.width = '';
    bar.style.left = `${Math.max(left, Math.min((box.left + box.right) / 2 - stage.left - bar.offsetWidth / 2, right - bar.offsetWidth))}px`;
    const above = box.top - stage.top - bar.offsetHeight - 8;
    bar.style.top = `${Math.max(6, above >= 6 ? above : Math.min(box.bottom - stage.top + 8, stage.height - bar.offsetHeight - 6))}px`;
  }
  const native = fc.editing.composed?.editor.input, selection = document.getSelection();
  if (!native || !selection?.focusNode || !native.contains(selection.focusNode)) return;
  const rect = nativeTextCaretRect(native); if (!rect?.height) return;
  const top = Math.max(stage.top + fc.contextBar.stageReserves().top, view?.offsetTop ?? 0) + 8;
  const safeBottom = compact ? bar.getBoundingClientRect().top - 12 : bottom - 12;
  if (safeBottom <= top + rect.height) return;
  if (rect.left < stage.left + left || rect.right > stage.left + right || rect.top < top || rect.bottom > safeBottom) {
    fc.stageEl.dispatchEvent(new CustomEvent('fc-focus-rect', { bubbles: true, detail: { x: rect.x, y: rect.y, w: rect.width, h: rect.height, viewport: { x: stage.left + left, y: top, w: right - left, h: safeBottom - top } } }));
  }
}
export async function finish(fc: FcCtx, cancel = false, removed = false): Promise<void> {
  const editing = fc.editing; if (!editing?.composed) return;
  const editor=editing.composed.editor;
  try { if(removed)editor.recoverDraft(); else { if(cancel)editing.composed.cancel(); await editor.settle(); } } catch(error) { report(fc,error); return; }
  if(fc.editing!==editing)return;
  if(!cancel&&!removed&&editor.frame.path)fc.textPathSelection={id:editing.id,story:editor.story.id,revision:editor.story.revision,...editor.range};
  fc.editing = null; editing.composed.destroy(); fc.textEdit.hideFmtBar();
  if(cancel){editing.el.innerHTML=editing.prevHtml;if(editing.boxEl)editing.boxEl.style.cssText=editing.prevBoxStyle;}
  editing.boxEl?.classList.remove('fc-box-editing'); fc.stageEl.classList.remove('is-text-editing');
  fc.history?.endGesture?.(); fc.chromeSync.renderChrome(); fc.canvasEl.focus({ preventScroll: true });
}
export async function upgrade(fc: FcCtx, id: string, edit = true): Promise<void> {
  if (!available(fc)) return;
  try {
    if (fc.editing?.composed) { await finish(fc); if(fc.editing)return; } else if (fc.editing) fc.textEdit.commitTextEdit();
    const el = fc.canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${fc.keys.cssEscape(id)}"] .lolly-box-text`);
    if (!el) return;
    const original = JSON.stringify(fc.select.getBoxes()), captured = await captureLegacyText(el);
    if (fc.disposed || JSON.stringify(fc.select.getBoxes()) !== original) throw new Error(t('The object changed while its fonts loaded. Try again.'));
    const input = fc.runtime.getModel().find(item => item.id === fc.cv.textDocumentInput)?.value;
    const patch = upgradeDesignText(input, fc.select.getBoxes(), id, { storyId: `story-${crypto.randomUUID()}`, ...captured });
    fc.onDirty?.(fc.cv.textDocumentInput!); fc.onDirty?.(fc.blockId);
    await fc.history!.commit!({ [fc.cv.textDocumentInput!]: patch.textDocument, [fc.blockId]: patch.boxes }, t('Upgrade text'));
    if(edit)fc.textEdit.editAfterPaint(id, {});
  } catch (error) { report(fc, error); }
}
export async function create(fc: FcCtx, boxes: Box[], id: string, mode: 'auto-width' | 'fixed' | 'auto-height', addAtMs?: number | null): Promise<void> {
  if (!available(fc)) return;
  const box = boxes.find(item => item[fc.cfg.idField] === id)!;
  if (typeof box.__textPlace === 'string') { await fc.storyRecovery.created(boxes,id,box.__textPlace); return; }
  if (typeof box.__textContinue === 'string') { await fc.storyFlow.created(boxes,id,box.__textContinue); return; }
  const before = JSON.stringify(fc.select.getBoxes());
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  probe.style.fontFamily = fc.helpers.fontStackFor(box[fc.cfg.fontField]);
  probe.style.fontSize = `${Number(box[fc.cfg.fontSizeField]) || 64}px`;
  probe.style.fontWeight = String(box[fc.cfg.weightField] || 400);
  probe.style.color = String(box[fc.cfg.textColorField] || '#000000');
  fc.canvasEl.append(probe);
  try {
    const computed = getComputedStyle(probe), source = String(box[fc.cfg.textField] ?? ''), color = parseCssColorFull(computed.color);
    const size = parseFloat(computed.fontSize), style = { fontFamily: computed.fontFamily, fontWeight: computed.fontWeight, fontStyle: computed.fontStyle };
    const pinned = await pinEditorFont(style, source);
    if (fc.disposed || JSON.stringify(fc.select.getBoxes()) !== before) throw new Error(t('The document changed while its fonts loaded. Try again.'));
    const current = fc.runtime.getModel().find(item => item.id === fc.cv.textDocumentInput)?.value;
    const path=fc.storyPath.seed(box,boxes);
    delete box.__textPath;delete box.__textPathAttach;delete box.__textGuideD;
    const patch = upgradeDesignText(current, boxes, id, { storyId: `story-${crypto.randomUUID()}`, source, ...pinned,
      paragraph:textRecipe(mode==='auto-width'?'heading':'body'),
      character: { ...pinned.character, size, color: parseColor(computed.color) ? computed.color : color ? rgbaToHex(...color) : '#000000' }, settings: {...defaultTextFrameSettings(path?'path':mode),...(path?{path}:{})} });
    if(path){const snapshot=readDesignText(patch.textDocument,patch.boxes);const story=snapshot.document.stories.find(story=>story.frameIds.includes(id))!;await fc.runtime.layoutText!({document:snapshot.document,storyId:story.id,frames:snapshot.frames.filter(frame=>frame.storyId===story.id)});if(JSON.stringify(fc.select.getBoxes())!==before)throw new Error(t('The document changed while its guide was prepared. Try again.'));}
    fc.onDirty?.(fc.blockId); fc.onDirty?.(fc.cv.textDocumentInput!);
    await fc.history!.commit!({ [fc.cv.textDocumentInput!]: patch.textDocument, [fc.blockId]: patch.boxes }, t('Add text'));
    if (addAtMs != null) fc.timelinePanel?.promote(id, { start: addAtMs / 1000, dur: null });
    fc.selection = new Set([id]);
    fc.textEdit.editAfterPaint(id, { selectAll: true });
  } catch (error) { report(fc, error); } finally { probe.remove(); }
}
export function storyTextOps(fc: FcCtx) { return {request:bindOp(fc,request),layout:bindOp(fc,layout),peek:bindOp(fc,peek), read: bindOp(fc, read), write: bindOp(fc, write), create: bindOp(fc, create), available: bindOp(fc, available), start: bindOp(fc, start), finish: bindOp(fc, finish), upgrade: bindOp(fc, upgrade), position: bindOp(fc, position) }; }
