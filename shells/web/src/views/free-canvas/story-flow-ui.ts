// SPDX-License-Identifier: MPL-2.0
/** Labelled flow ports and a keyboard-accessible target list stay on the canvas. */
import { linkTextFrames } from '@lolly/engine';
import { mountTextFrameControls } from '../../lib/text-frame-controls.ts';
import { styleTextControls, textControlAction, textControlGroup, textControlGrid, textControlRow } from '../../lib/text-control-ui.ts';
import type { IconName } from '../../lib/icons.ts';
import { t } from '../../i18n.ts';
import { bindOp, type FcCtx } from './context.ts';
import type { CanvasIndex } from './shared.ts';
export function open(fc: FcCtx, anchor: HTMLElement, id: string, frameOptions = false, targetId?: string): void {
  if(fc.storyPath.frame(id)?.path){fc.storyPathUi.open(anchor,id);return;}
  if (fc.editing) fc.textEdit.commitTextEdit(); fc.toolbox.closePopover();
  const snapshot = fc.storyText.read(), story = snapshot.document.stories.find(story=>story.frameIds.includes(id)); if (!story) return;
  const frame = snapshot.frames.find(frame=>frame.id===id)!, index = story.frameIds.indexOf(id);
  const panel = document.createElement('div'); panel.className = 'fc-text-popover'; panel.dataset.textFlow = id; panel.setAttribute('role','dialog'); panel.setAttribute('aria-label',frameOptions?t('Frame options'):t('Continue text'));
  fc.popover = panel; fc.popoverAnchor = anchor; panel.setAttribute('data-export-hide','');
  panel.addEventListener('pointerdown',event=>event.stopPropagation());
  panel.addEventListener('keydown',event=>{ if (event.key==='Escape') { event.preventDefault(); event.stopPropagation(); fc.toolbox.closePopover(true); } });
  const header = document.createElement('div'); header.className = 'text-control-header';
  const title = document.createElement('p'); title.textContent = frameOptions ? t('Frame options') : t('Continue text'); header.append(title); panel.append(header);
  if (story.frameIds.length > 1) { const count = document.createElement('p'); count.textContent = t('Frame {n} of {total}',{n:index+1,total:story.frameIds.length}); panel.append(count); }
  textControlAction(header,t('Close'),()=>fc.toolbox.closePopover(true),'close',true);
  let actionRoot: HTMLElement = panel;
  const action = (label: string, run: () => void, disabled = false, glyph?: IconName, iconOnly = false): HTMLButtonElement => {
    const button = textControlAction(actionRoot,label,run,glyph,iconOnly); button.disabled = disabled; return button;
  };
  const navigate = (target: string) => { fc.toolbox.closePopover(); fc.selection = new Set([target]); fc.chromeSync.renderChrome(); fc.stage.liveBoxEl(target)?.scrollIntoView({block:'nearest',inline:'nearest'}); };
  if (frameOptions) {
    const adjust = textControlGroup(panel,t('Adjust on canvas'));
    actionRoot=textControlGrid(adjust);
    action(t('Adjust frame'),()=>fc.storyGuides.open(anchor,id),!!frame.locked,'fitArtboard');
    action(t('Adjust spacing'),()=>fc.storyGuides.open(anchor,id,true),!!frame.locked,'arrowsH');
    actionRoot=panel;
    const controls = mountTextFrameControls(panel,()=>fc.storyText.read().frames.find(frame=>frame.id===id)!,()=>story.frameIds.length>1,value=>{
      void fc.storyTextProperties.apply([id],{kind:'frame',value},t('Text frame')).then(()=>controls.refresh());
    },()=>{const value=fc.storyText.read();return fc.storyText.peek({document:value.document,storyId:story.id,frames:value.frames.filter(frame=>frame.storyId===story.id)})?.layout.frames.find(frame=>frame.id===id)?.appliedScale??1;});
    panel.append(adjust.parentElement!);
  } else {
    action(t('New linked frame'),()=>{fc.toolbox.closePopover();fc.storyFlow.createTarget(id);},!!frame.locked || frame.mode==='path','link').classList.add('btn--primary');
    const targets = snapshot.document.stories.filter(item=>item.id!==story.id && item.frameIds.length && !snapshot.frames.some(frame=>frame.storyId===item.id && (frame.locked || frame.mode==='path')));
    if (targets.length) {
      const select = document.createElement('select'); select.setAttribute('aria-label',t('Target text frame'));
      for (const target of targets) {
        const box = fc.select.getBoxes().find(box=>box[fc.cfg.idField]===target.frameIds[0]);
        const artboard=fc.select.getBoxes().find(item=>item[fc.cfg.idField]===box?.frame);
        select.add(new Option(`${String(artboard?.[fc.nameField]||box?.frame||t('Pasteboard'))}: ${String(box?.[fc.nameField] || target.source.slice(0,40) || t('Empty text frame'))} (${target.source||target.frameIds.length>1?t('Join stories'):t('Empty frame')})`,target.frameIds[0]));
      }
      textControlRow(panel,t('Target text frame'),select);if(targetId)select.value=targetId;
      const continueButton=action(t('Continue into selected frame'),()=>{
        const current = fc.storyText.read(), target = current.document.stories.find(story=>story.frameIds[0]===select.value); if (!target) return;
        if (!target.source && target.frameIds.length===1) {fc.toolbox.closePopover();void fc.storyFlow.link(id,select.value);return;}
        const preview = linkTextFrames(current,id,select.value,true,()=>`text-${crypto.randomUUID()}`), captured = JSON.stringify(current);
        const merged = preview.document.stories.find(item=>item.id===story.id)!;
        const label = document.createElement('label'); label.textContent = t('Join preview: source story, paragraph break, target story');
        const source = document.createElement('textarea'); source.readOnly = true; source.value = merged.source; source.setAttribute('aria-label',t('Joined story preview')); label.append(source); panel.replaceChildren(label);actionRoot=panel;styleTextControls(panel);
        action(t('Join stories'),()=>{
          if (JSON.stringify(fc.storyText.read())!==captured) {label.textContent=t('The stories changed. Close this preview and try again.');return;}
          fc.toolbox.closePopover();void fc.storyFlow.commit(preview,fc.select.getBoxes(),t('Join stories'));
        });
        action(t('Cancel'),()=>fc.toolbox.closePopover(true));
      },!!frame.locked);
      if(targetId)queueMicrotask(()=>continueButton.click());
    }
    if (story.frameIds.length > 1) {
      const navigation=textControlGrid(panel);actionRoot=navigation;
      action(t('Previous text frame'),()=>navigate(story.frameIds[index-1]!),index===0,'arrowLeft',true);
      action(t('Next text frame'),()=>navigate(story.frameIds[index+1]!),index===story.frameIds.length-1,'arrowRight',true);
    }
    actionRoot=textControlGroup(panel,t('More actions'));
    action(t('Copy entire story'),()=>{fc.toolbox.closePopover();fc.storyFlow.copyStory(story.id);},false,'clipboard');
    action(t('Select story frames'),()=>{fc.toolbox.closePopover();fc.selection=new Set(story.frameIds);fc.chromeSync.renderChrome();},false,'fitAll');
    action(t('Disconnect after this frame'),()=>{fc.toolbox.closePopover();void fc.storyFlow.disconnect(id);},index===story.frameIds.length-1 || !!frame.locked,'unlink');
    actionRoot=panel;
    const status = document.createElement('p'); status.className='text-control-status';status.setAttribute('role','status'); status.textContent = t('Laying out text…'); header.after(status);
    void fc.storyText.layout({document:snapshot.document,storyId:story.id,frames:snapshot.frames.filter(frame=>frame.storyId===story.id)}).then(layout=>{
      if (!panel.isConnected) return;
      status.textContent = layout.overset ? t('{n} characters continue beyond the last frame.',{n:layout.overset.end-layout.overset.start}) : t('All story text fits.');
      if (layout.overset) { const preview = document.createElement('p'); preview.dataset.textContinuation=''; preview.textContent=story.source.slice(layout.overset.start,layout.overset.start+400); panel.append(preview); }
    }).catch(error=>{if(panel.isConnected)status.textContent=error instanceof Error?error.message:String(error);});
  }
  actionRoot=document.createElement('div');actionRoot.className='text-control-footer';panel.append(actionRoot);
  action(t('Edit story'),()=>fc.storyRecovery.edit(anchor,story.id));
  action(t('Done'),()=>fc.toolbox.closePopover(true));
  styleTextControls(panel); document.body.append(panel);
  const rect = anchor.getBoundingClientRect(), view = window.visualViewport;
  const left = view?.offsetLeft ?? 0, top = view?.offsetTop ?? 0, width = view?.width ?? innerWidth, height = view?.height ?? innerHeight;
  panel.style.maxHeight = `${Math.max(120,height-32)}px`;
  panel.style.left = `${Math.max(left+8,Math.min(rect.left,left+width-panel.offsetWidth-8))}px`;
  panel.style.top = `${Math.max(top+8,Math.min(rect.bottom+8,top+height-panel.offsetHeight-8))}px`;
  panel.querySelector<HTMLElement>('.btn--primary,input,select,.text-control-footer button')?.focus();
}
/** The ports the last full paint placed, each with the text frame it hangs off, and the
 *  canvas index current then: a paint since may have added a frame that needs one. */
const placed = new WeakMap<FcCtx, { index: CanvasIndex; ports: Array<{ button: HTMLButtonElement; svg: SVGSVGElement; port: string }> }>();
function place(button: HTMLButtonElement, rect: DOMRect, port: string, stage: DOMRect): void {
  button.style.left = `${Math.max(4,Math.min((port==='input'?rect.left:rect.right)-stage.left,stage.width-button.offsetWidth-4))}px`;
  button.style.top = `${Math.max(4,Math.min((port==='input'?rect.top-button.offsetHeight-4:rect.bottom+4)-stage.top,stage.height-button.offsetHeight-4))}px`;
}
/**
 * The text ports and threads. A `view` paint (the view moved, nothing else) moves the
 * ports the last full paint placed instead of sweeping the canvas for text frames again:
 * which frames carry ports answers to the selection and the text, and neither moved.
 */
export function paint(fc: FcCtx, view = false): void {
  if (!fc.storyText.available()) return;
  fc.storyPathUi.paint();
  let chrome = fc.overlay.querySelector<HTMLElement>('[data-text-flow-chrome]');
  if (!chrome) {chrome=document.createElement('div');chrome.dataset.textFlowChrome='';chrome.setAttribute('data-export-hide','');fc.overlay.append(chrome);}
  chrome.hidden = !!fc.editing; if (fc.editing) return;
  const snapshot=fc.storyText.snapshot(),orphans=snapshot.document.stories.filter(story=>!story.frameIds.length);
  let recovery=chrome.querySelector<HTMLButtonElement>('[data-text-unplaced]');
  if(orphans.length){if(!recovery){recovery=document.createElement('button');recovery.type='button';recovery.dataset.textUnplaced='';recovery.className='fc-text-flow-port';recovery.style.left='40px';recovery.style.bottom='12px';recovery.addEventListener('click',()=>fc.storyRecovery.unplaced(recovery!));chrome.append(recovery);}recovery.textContent=t('Place text ({n})',{n:orphans.length});recovery.style.left=`${Math.max(40,(fc.navReserveLeft||0)+12)}px`;}
  else recovery?.remove();
  const stage = fc.stageEl.getBoundingClientRect(), keep = new Set<string>();
  let threads=chrome.querySelector<SVGSVGElement>('[data-text-threads]');
  if(!threads){threads=document.createElementNS('http://www.w3.org/2000/svg','svg');threads.dataset.textThreads='';threads.setAttribute('aria-hidden','true');Object.assign(threads.style,{position:'absolute',inset:'0',width:'100%',height:'100%',overflow:'visible',pointerEvents:'none'});chrome.prepend(threads);}
  const paths:string[]=[];
  for(const story of snapshot.document.stories.filter(story=>story.frameIds.some(id=>fc.selection.has(id))))for(let i=1;i<story.frameIds.length;i++){
    const a=fc.stage.liveBoxEl(story.frameIds[i-1]!)?.getBoundingClientRect(),b=fc.stage.liveBoxEl(story.frameIds[i]!)?.getBoundingClientRect();if(!a?.width || !b?.width)continue;
    const x=a.right-stage.left,y=a.bottom-stage.top,u=b.left-stage.left,v=b.top-stage.top;
    paths.push(`<path d="M${x} ${y}C${x+32} ${y} ${u-32} ${v} ${u} ${v}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 4"/>`);
  }
  threads.innerHTML=paths.join('');

  const held = view ? placed.get(fc) : undefined;
  if (held && held.index === fc.stage.canvasIndex() && held.ports.every(p=>p.svg.isConnected && p.button.isConnected)) {
    const rects = held.ports.map(p=>p.svg.getBoundingClientRect());
    for (let n = 0; n < held.ports.length; n++) place(held.ports[n]!.button,rects[n]!,held.ports[n]!.port,stage);
    return;
  }
  const next: Array<{ button: HTMLButtonElement; svg: SVGSVGElement; port: string }> = [];
  for (const svg of fc.canvasEl.querySelectorAll<SVGSVGElement>('svg[data-text-frame]')) {
    const id = svg.dataset.textFrame!, selected = fc.selection.has(id), overflow = svg.hasAttribute('data-text-overset');
    // The cheap test first: a find over every frame, for every frame, was quadratic.
    if (!selected && !overflow) continue;
    if(snapshot.frames.find(frame=>frame.id===id)?.mode==='path')continue;
    const rect = svg.getBoundingClientRect();
    for (const port of selected ? ['input','output'] : ['output']) {
      const key = `${id}:${port}`; keep.add(key);
      let button = [...chrome.querySelectorAll<HTMLButtonElement>('[data-text-port]')].find(button=>button.dataset.textPort===key);
      if (!button) {button=document.createElement('button');button.type='button';button.dataset.textPort=key;button.className='fc-text-flow-port';button.addEventListener('pointerdown',event=>event.stopPropagation());button.addEventListener('click',event=>{event.stopPropagation();fc.storyFlowUi.open(button!,id);});chrome.append(button);}
      button.textContent = port==='input'?t('In'):overflow?t('Overflow'):t('Continue text'); button.setAttribute('aria-label',port==='input'?t('Text input port'):overflow?t('View text overflow'):t('Continue text'));
      place(button, rect, port, stage);
      next.push({ button, svg, port });
    }
  }
  placed.set(fc, { index: fc.stage.canvasIndex(), ports: next });
  for (const button of chrome.querySelectorAll<HTMLButtonElement>('[data-text-port]')) if (!keep.has(button.dataset.textPort!)) button.remove();
}
export function storyFlowUiOps(fc: FcCtx) {return {open:bindOp(fc,open),paint:bindOp(fc,paint)};}
