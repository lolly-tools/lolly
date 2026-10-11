// SPDX-License-Identifier: MPL-2.0
/** Flow commands commit source ownership and containers in one Design transaction. */
import { readDesignText, serializeTextDocument, removeTextFrames, duplicateTextFrames, linkTextFrames, splitTextThread, insertTextFrame, defaultTextFrameSettings, captureTextFrames, pasteTextFrames } from '@lolly/engine';
import type { TextLayoutReceipt, TextThreadSnapshot } from '@lolly/engine';
import type { TextLayoutV1 } from '@lolly-tools/core';
import { FC_CLIP_PREFIX, type LayoutClipboard } from './shared.ts';
import type { Box } from '../free-canvas-math.ts';
import { announce } from '../../a11y.ts';
import { t } from '../../i18n.ts';
import { bindOp, type FcCtx } from './context.ts';
const fresh = () => `text-${crypto.randomUUID()}`;
function failure(error: unknown): void { announce(error instanceof Error ? error.message : String(error)); }
export async function commit(fc: FcCtx, snapshot: TextThreadSnapshot, boxes: Box[], label: string, patch: Record<string, unknown> = {}, sourceReady = false): Promise<void> {
  const shown = new Map(fc.select.getBoxes().map(box => [String(box[fc.cfg.idField]), box]));
  const frames = new Map(snapshot.frames.map(frame => [frame.id,frame]));
  const next = boxes.map(box => {
    const frame = frames.get(String(box[fc.cfg.idField])); if (!frame) return box;
    const {id:_id,storyId,width,height,hidden:_hidden,locked:_locked,...settings} = frame;
    const previous = shown.get(String(box[fc.cfg.idField]));
    return {...box,[fc.cv.textStoryField!]:storyId,[fc.cv.textFrameField!]:JSON.stringify(settings),
      [fc.cfg.wField]:sourceReady && width === previous?.[fc.cfg.wField] ? box[fc.cfg.wField] : width,
      [fc.cfg.hField]:sourceReady && height === previous?.[fc.cfg.hField] ? box[fc.cfg.hField] : height};
  });
  const raw = fc.runtime.getModel().find(i => i.id === fc.blockId)?.value;
  const source = !sourceReady && Array.isArray(raw) ? fc.layout.sourceEdit(raw, next) : next;
  const values = { ...fc.layout.trackPatch(source), ...patch, [fc.blockId]: source, [fc.cv.textDocumentInput!]: serializeTextDocument(snapshot.document) };
  readDesignText(String(values[fc.cv.textDocumentInput!]), source);
  for (const id of Object.keys(values)) fc.onDirty?.(id);
  await fc.history!.commit!(values, label);
}
/** Deleting an ordinary box needs no text transaction; deleting a frame retains its story. */
export function reconcile(fc: FcCtx, boxes: Box[], patch: Record<string, unknown> = {}, label = t('Delete text frames')): boolean {
  if (!fc.storyText.available()) return false;
  const before = fc.select.getBoxes(), ids = new Set(boxes.map(box => String(box[fc.cfg.idField])));
  const deleted = before.filter(box => box[fc.cv.textStoryField!] && !ids.has(String(box[fc.cfg.idField]))).map(box => String(box[fc.cfg.idField]));
  if (!deleted.length) return false;
  try { const snapshot = removeTextFrames(fc.storyText.read(),deleted); void commit(fc,snapshot,boxes,label,patch,true).catch(failure); }
  catch (error) { failure(error); }
  return true;
}
export async function duplicate(fc: FcCtx, boxes: Box[], copies: ReadonlyMap<string,string>, selected: Set<string>, patch: Record<string, unknown> = {}): Promise<void> {
  try {
    const original = JSON.stringify(fc.select.getBoxes()), snapshot = fc.storyText.read(), source = JSON.stringify(snapshot);
    const textCopies = new Map([...copies].filter(([id]) => snapshot.frames.some(frame => frame.id === id)));
    if (!textCopies.size) { fc.selection = selected; fc.select.commit(boxes, patch); return; }
    const layouts = new Map<string,TextLayoutV1>();
    let partial = false;
    for (const story of snapshot.document.stories) {
      const count = story.frameIds.filter(id => textCopies.has(id)).length;
      if (count && count !== story.frameIds.length) { partial = true; layouts.set(story.id,await fc.storyText.layout({document:snapshot.document,storyId:story.id,frames:snapshot.frames.filter(frame => frame.storyId === story.id)})); }
    }
    const next = await duplicateTextFrames(snapshot,textCopies,layouts,fresh);
    if (fc.disposed || JSON.stringify(fc.select.getBoxes()) !== original || JSON.stringify(fc.storyText.read()) !== source) throw new Error(t('The text changed while the copy was prepared. Try again.'));
    const pending=commit(fc,next,boxes,partial ? t('Duplicate visible text') : t('Duplicate text story'), patch);fc.selection=selected;fc.chromeSync.renderChrome();await pending;
    if (partial) fc.stage.flash(t('Copied the visible text from the selected frames into independent stories.'));
  } catch (error) { failure(error); }
}
export function capture(fc: FcCtx, rows: Box[]): LayoutClipboard {
  const trackRows=fc.runtime.getModel().find(i=>i.id==='layoutTracks')?.value;
  const idsForLayout=new Set(rows.map(r=>String(r.id)));
  const layoutTracks=Array.isArray(trackRows)?trackRows.filter(t=>idsForLayout.has(String(t.container))):[];
  if (!rows.some(box=>box[fc.cv.textStoryField!])) return layoutTracks.length?{version:2,boxes:rows,textDocument:'',layoutTracks}:rows;
  const snapshot=fc.storyText.read(),ids=new Set(rows.map(box=>String(box[fc.cfg.idField]))),receipts=new Map<string,TextLayoutReceipt>();
  for(const story of snapshot.document.stories) if(story.frameIds.some(id=>ids.has(id)) && !story.frameIds.every(id=>ids.has(id))) {
    const receipt=fc.storyText.peek({document:snapshot.document,storyId:story.id,frames:snapshot.frames.filter(frame=>frame.storyId===story.id)});
    if(receipt) receipts.set(story.id,receipt);
  }
  const document=captureTextFrames(snapshot,ids,receipts,fresh), owners=new Map(document.stories.flatMap(story=>story.frameIds.map(id=>[id,story.id])));
  return {version:2,boxes:rows.map(box=>owners.has(String(box[fc.cfg.idField]))?{...box,[fc.cv.textStoryField!]:owners.get(String(box[fc.cfg.idField]))}:box),textDocument:serializeTextDocument(document),layoutTracks};
}
export async function paste(fc: FcCtx, payload: LayoutClipboard, boxes: Box[], copies: ReadonlyMap<string,string>, selected: Set<string>, patch: Record<string, unknown> = {}): Promise<void> {
  try {
    if(Array.isArray(payload)||!payload.textDocument) {if((Array.isArray(payload)?payload:payload.boxes).some(box=>box[fc.cv.textStoryField!]))throw new Error(t('This clipboard is missing its text stories. Copy the text again.'));fc.select.commit(boxes, patch, t('Paste layout'));}
    else {
      const source=readDesignText(payload.textDocument,payload.boxes), snapshot=pasteTextFrames(fc.storyText.read(),source,copies,fresh);
      const pending=commit(fc,snapshot,boxes,t('Paste text frames'),patch);fc.selection=selected;fc.chromeSync.renderChrome();await pending;return;
    }
    fc.selection=selected;fc.chromeSync.renderChrome();
  } catch(error) {failure(error);}
}
export function copyStory(fc: FcCtx, storyId: string): void {
  try {
    const story=fc.storyText.read().document.stories.find(story=>story.id===storyId);if(!story)return;
    const rows=fc.select.getBoxes().filter(box=>story.frameIds.includes(String(box[fc.cfg.idField]))),payload=capture(fc,rows);
    fc.objectClipboard=payload;void navigator.clipboard.writeText(FC_CLIP_PREFIX+JSON.stringify(payload)).then(()=>fc.stage.flash(t('Copied the entire text story and its frames.'))).catch(failure);
  }catch(error){failure(error);}
}
export function target(fc: FcCtx, after: string, targetId: string): boolean {
  const snapshot=fc.storyText.read(),frame=snapshot.frames.find(frame=>frame.id===targetId);if(!frame)return false;
  const story=snapshot.document.stories.find(story=>story.id===frame.storyId)!;
  if(story.frameIds.includes(after)){failure(t('Choose a frame from another story, or drag to create a new frame.'));return true;}
  if(frame.locked || frame.mode==='path' || story.frameIds[0]!==targetId){failure(t('Choose an unlocked first frame of a rectangular text story.'));return true;}
  fc.modes.toPointer();
  if(!story.source && story.frameIds.length===1)void link(fc,after,targetId);
  else fc.storyFlowUi.open(fc.stage.liveBoxEl(after)??fc.canvasEl,after,false,targetId);
  return true;
}
export async function link(fc: FcCtx, sourceId: string, targetId: string, join = false): Promise<void> {
  try { if (fc.editing) fc.textEdit.commitTextEdit(); const next = linkTextFrames(fc.storyText.read(),sourceId,targetId,join,fresh); await commit(fc,next,fc.select.getBoxes(),join ? t('Join stories') : t('Continue text')); }
  catch (error) { failure(error); }
}
export async function disconnect(fc: FcCtx, frameId: string): Promise<void> {
  try {
    if (fc.editing) fc.textEdit.commitTextEdit();
    const snapshot = fc.storyText.read(), original = JSON.stringify(snapshot), story = snapshot.document.stories.find(story => story.frameIds.includes(frameId))!;
    const layout = await fc.storyText.layout({document:snapshot.document,storyId:story.id,frames:snapshot.frames.filter(frame => frame.storyId === story.id)});
    const next = await splitTextThread(snapshot,frameId,layout,fresh);
    if (fc.disposed || JSON.stringify(fc.storyText.read()) !== original) throw new Error(t('The text changed while its frames were prepared. Try again.'));
    await commit(fc,next,fc.select.getBoxes(),t('Disconnect text frames'));
  } catch (error) { failure(error); }
}
export function createTarget(fc: FcCtx, after: string): void {
  if (fc.editing) fc.textEdit.commitTextEdit();
  fc.toolbox.closePopover();
  const kind = fc.addKinds.find(kind=>kind.id==='text'); if (!kind) return;
  fc.modes.setMode('create',{kind:{...kind,id:'linked-text-frame',label:t('Linked text frame'),seed:{...kind.seed,[fc.cv.textFrameField!]:'fixed',__textContinue:after}}});
}
export async function created(fc: FcCtx, boxes: Box[], id: string, after: string): Promise<void> {
  try {
    const snapshot = fc.storyText.read(), source = snapshot.frames.find(frame=>frame.id===after);
    if (!source) throw new Error(t('The source text frame no longer exists.'));
    const box = boxes.find(box=>box[fc.cfg.idField]===id)!; delete box.__textContinue;
    box[fc.cfg.textField] = ''; box[fc.cv.textStoryField!] = source.storyId;
    const next = insertTextFrame(snapshot,after,{...defaultTextFrameSettings(),id,storyId:source.storyId,width:Number(box[fc.cfg.wField]),height:Number(box[fc.cfg.hField])});
    const pending=commit(fc,next,boxes,t('Continue text'));fc.selection=new Set([id]);fc.chromeSync.renderChrome();await pending;
  } catch (error) { failure(error); }
}
export function storyFlowOps(fc: FcCtx) { return {target:bindOp(fc,target),copyStory:bindOp(fc,copyStory),capture:bindOp(fc,capture),paste:bindOp(fc,paste),commit:bindOp(fc,commit),reconcile:bindOp(fc,reconcile),duplicate:bindOp(fc,duplicate),link:bindOp(fc,link),disconnect:bindOp(fc,disconnect),createTarget:bindOp(fc,createTarget),created:bindOp(fc,created)}; }
