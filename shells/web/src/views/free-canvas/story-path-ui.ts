// SPDX-License-Identifier: MPL-2.0
/** One anchored path surface serves creation, attachment and exact guide settings. */
import { textGuideGeometry, parseSvgPath } from '@lolly/engine';
import { mountTextPathControls } from '../../lib/text-path-controls.ts';
import { boxToPath } from '../vector-ops.ts';
import { styleTextControls } from '../../lib/text-control-ui.ts';
import { t } from '../../i18n.ts';
import { bindOp, type FcCtx } from './context.ts';
export function open(fc:FcCtx,anchor:HTMLElement,id?:string,attach=false):void{
  if(fc.editing)fc.textEdit.commitTextEdit();fc.toolbox.closePopover();
  const frame=id?fc.storyPath.frame(id):undefined;
  const panel=document.createElement('div');panel.className='fc-text-popover';panel.dataset.textPath='';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',attach?t('Attach text to path'):frame?.path?t('Path options'):t('Text on a path'));panel.setAttribute('data-export-hide','');fc.popover=panel;fc.popoverAnchor=anchor;
  const status=document.createElement('p');status.setAttribute('role','status');
  const action=(label:string,run:()=>void)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',run);panel.append(button);return button;};
  const check=(label:string)=>{const row=document.createElement('label'),input=document.createElement('input');input.type='checkbox';row.append(input,document.createTextNode(label));panel.append(row);return input;};
  if(attach){
    const pair=fc.storyPath.selection();if(!pair)return;
    const note=document.createElement('p');note.textContent=t('The text owns an editable copy of this guide. One paragraph and one continuous guide are supported.');panel.append(note);
    const remove=check(t('Remove original guide'));
    action(t('Attach text to path'),()=>{fc.toolbox.closePopover();void fc.storyPath.attach(String(pair.text[fc.cfg.idField]),String(pair.guide[fc.cfg.idField]),remove.checked);});
  }else if(frame?.path){
    action(t('Edit text'),()=>{fc.toolbox.closePopover();fc.storyText.start(id!);});
    action(t('Edit path'),()=>{fc.toolbox.closePopover();fc.penTool.startPenEdit(id!);});
    action(t('Adjust path'),()=>fc.storyPathHandles.open(anchor,id!));
    const controls=mountTextPathControls(panel,()=>fc.storyPath.frame(id!)!,value=>{void fc.storyPath.update(id!,value,t('Text path')).then(()=>{controls.refresh();status.textContent='';}).catch(error=>{status.textContent=error instanceof Error?error.message:String(error);controls.refresh();});});
    const keep=check(t('Keep guide as a separate shape'));action(t('Detach from path'),()=>{fc.toolbox.closePopover();void fc.storyPath.detach(id!,keep.checked);});
    action(t('Edit story'),()=>fc.storyRecovery.edit(anchor,frame.storyId));
  }else{
    action(t('Draw a guide'),()=>fc.storyPath.draw());
    const select=document.createElement('select');select.setAttribute('aria-label',t('Existing guide'));
    for(const box of fc.select.getBoxes())if(boxToPath(box,fc.vectorCfg ?? undefined))select.add(new Option(String(box[fc.nameField]||box[fc.cfg.idField]),String(box[fc.cfg.idField])));
    if(select.options.length){panel.append(select);action(t('Use selected guide'),()=>{const id=select.value;fc.toolbox.closePopover();void fc.storyPath.fromGuide(id);});}
  }
  panel.append(status);action(t('Done'),()=>fc.toolbox.closePopover(true));
  panel.addEventListener('pointerdown',event=>event.stopPropagation());panel.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();fc.toolbox.closePopover(true);}});
  styleTextControls(panel);document.body.append(panel);const rect=anchor.getBoundingClientRect(),view=window.visualViewport,left=view?.offsetLeft??0,top=view?.offsetTop??0,width=view?.width??innerWidth,height=view?.height??innerHeight;
  panel.style.maxHeight=`${Math.max(120,height-32)}px`;panel.style.left=`${Math.max(left+8,Math.min(rect.left,left+width-panel.offsetWidth-8))}px`;panel.style.top=`${Math.max(top+8,Math.min(rect.bottom+8,top+height-panel.offsetHeight-8))}px`;panel.querySelector<HTMLElement>('button,input,select')?.focus();
}
export function paint(fc:FcCtx):void{
  let chrome=fc.overlay.querySelector<HTMLElement>('[data-text-path-chrome]');if(!chrome){chrome=document.createElement('div');chrome.dataset.textPathChrome='';chrome.setAttribute('data-export-hide','');fc.overlay.append(chrome);}chrome.hidden=!!fc.editing||!!fc.penEdit||fc.popover?.hasAttribute('data-text-path-adjust')===true;if(chrome.hidden)return;
  const keep=new Set<string>(),root=fc.overlay.getBoundingClientRect();
  for(const frame of fc.storyText.snapshot().frames.filter(frame=>frame.path&&(fc.selection.has(frame.id)||fc.stage.liveBoxEl(frame.id)?.querySelector('[data-text-overset]')))){
    const path=frame.path!,svg=fc.stage.liveBoxEl(frame.id)?.querySelector<SVGSVGElement>('svg[data-text-frame]'),matrix=svg?.getScreenCTM();if(!matrix)continue;
    const curve=textGuideGeometry(path.d),points:Array<{x:number;y:number}>=[];
    for(const property of ['start','end','baseline'] as const){let distance=property==='start'?path.start:property==='end'?path.end:(path.start+path.end)/2;if(path.flip)distance=path.start+path.end-distance;if(path.reverse)distance=curve.length-distance;if(parseSvgPath(path.d)[0]?.closed)distance=((distance%curve.length)+curve.length)%curve.length;const sample=curve.at(distance),angle=(sample.angle+(path.reverse?180:0)+(path.flip?180:0))*Math.PI/180;const point=new DOMPoint(sample.x-Math.sin(angle)*path.baseline,sample.y+Math.cos(angle)*path.baseline).matrixTransform(matrix);
      let x=point.x-root.x-22,y=point.y-root.y-22;while(points.some(p=>Math.abs(p.x-x)<46&&Math.abs(p.y-y)<46))y+=48;points.push({x,y});
      const key=`${frame.id}:${property}`;keep.add(key);let button=[...chrome.querySelectorAll<HTMLButtonElement>('[data-text-path-port]')].find(button=>button.dataset.textPathPort===key);
      if(!button){button=document.createElement('button');button.type='button';button.className='fc-text-flow-port';button.dataset.textPathPort=key;button.addEventListener('pointerdown',event=>event.stopPropagation());button.addEventListener('click',()=>fc.storyPathHandles.open(button!,frame.id,property));chrome.append(button);}
      const overflow=property==='end'&&svg!.hasAttribute('data-text-overset');button.textContent=overflow?t('Overflow'):property==='start'?t('Start'):property==='end'?t('End'):t('Offset');button.setAttribute('aria-label',overflow?t('Path text overflow'):property==='start'?t('Path start'):property==='end'?t('Path end'):t('Baseline offset'));button.style.left=`${x}px`;button.style.top=`${y}px`;
    }
  }
  for(const button of chrome.querySelectorAll<HTMLButtonElement>('[data-text-path-port]'))if(!keep.has(button.dataset.textPathPort!))button.remove();
}
export function storyPathUiOps(fc:FcCtx){return {open:bindOp(fc,open),paint:bindOp(fc,paint)};}
