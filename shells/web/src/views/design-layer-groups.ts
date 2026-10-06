// SPDX-License-Identifier: MPL-2.0
/** Artboard parents and their layer lists share one navigator with the page previews. */
import type { Box } from './free-canvas-math.ts';
import { tRaw as t } from '../i18n.ts';

/** Reorder displayed members in their existing slots, preserving collapsed siblings. */
export function mergeLayerOrder(all: string[], ordered: string[]): string[] {
  const members = new Set(ordered), remaining = ordered.filter(id => all.includes(id));
  let index = 0;
  return all.map(id => members.has(id) ? remaining[index++]! : id);
}

export function mountLayerGroups(opts: {
  host: HTMLElement; pages: HTMLElement; section: HTMLElement; list: HTMLElement; heading: HTMLElement;
  id(box:Box):string; name(box:Box,index:number):string; children(box:Box):Box[];
  row(box:Box,index:number,loose:boolean,list:HTMLElement):HTMLElement;
  group(box:Box):string; select(ids:string[]):void;
  jump(id:string):void;
}) {
  const expanded = new Map<string,boolean>();
  const objectExpanded = new Map<string,boolean>();
  const objectMembers = new WeakMap<HTMLElement, string[]>();
  let mode: 'layers' | 'pages' = 'layers';
  const scroll = { layers: 0, pages: 0 };
  let active = '';
  let chosen:string[]=[];
  let hasFrames = false;
  let hasLayers = false;
  const switcher=document.createElement('div');switcher.className='fc-nav-modes';
  switcher.setAttribute('role','group');switcher.setAttribute('aria-label',t('Navigator view'));
  const buttons=new Map<string,HTMLButtonElement>();
  const applyMode=():void=>{
    opts.pages.hidden=mode!=='pages'||!hasFrames;
    opts.section.hidden=mode!=='layers'||!hasLayers;
    switcher.hidden=!hasFrames;
    for(const [key,button] of buttons)button.setAttribute('aria-pressed',String(mode===key));
  };
  for(const [key,label] of [['layers','Layers'],['pages','Pages']] as const){
    const button=document.createElement('button');button.type='button';button.className='btn btn--ghost btn--sm';
    button.textContent=t(label);button.onclick=()=>{
      if (mode === key) return;
      scroll[mode] = opts.host.scrollTop;
      mode=key;applyMode();
      opts.host.scrollTop = scroll[mode];
    };buttons.set(key,button);switcher.append(button);
  }
  opts.host.prepend(switcher);opts.heading.hidden=true;
  opts.list.setAttribute('role','region');opts.list.setAttribute('aria-label',t('Document layers'));opts.list.removeAttribute('aria-multiselectable');
  function paintLayers(boxes: Box[], list: HTMLElement, parent: string, loose: boolean): void {
    const groups = new Map<string, Box[]>();
    for (const box of boxes) {
      const id = opts.group(box); if (!id) continue;
      const members = groups.get(id) ?? []; members.push(box); groups.set(id, members);
    }
    const painted = new Set<string>();
    for (const [index, box] of boxes.entries()) {
      const id = opts.group(box);
      if (!id) { list.append(opts.row(box, index, loose, list)); continue; }
      if (painted.has(id)) continue; painted.add(id);
      const members = groups.get(id)!, key = JSON.stringify([parent, id]);
      const group = document.createElement('details'); group.className = 'fc-nav-group fc-nav-object-group';
      objectMembers.set(group, members.map(opts.id));
      group.dataset.objectGroup = id; group.open = objectExpanded.get(key) ?? true;
      const summary = document.createElement('summary');
      const select = document.createElement('button'); select.type = 'button'; select.className = 'btn btn--ghost fc-nav-group-jump';
      select.textContent = t('Group {n}', { n: [...groups.keys()].indexOf(id) + 1 });
      select.setAttribute('aria-label', t('Select group {n}', { n: [...groups.keys()].indexOf(id) + 1 }));
      select.onclick = event => { event.preventDefault(); event.stopPropagation(); if (parent) opts.jump(parent); opts.select(members.map(opts.id)); };
      const count = document.createElement('span'); count.className = 'chip chip--count'; count.textContent = String(members.length);
      count.setAttribute('aria-label', t('{n} layers', { n: members.length }));
      summary.append(select, count); group.append(summary);
      const children = document.createElement('div'); children.className = 'fc-nav-group-children';
      children.setAttribute('role', 'group'); children.setAttribute('aria-label', select.textContent);
      const paint = (): void => {
        children.replaceChildren(...(group.open ? members.map((member, i) => opts.row(member, i, loose, list)) : []));
        paintActive(active, chosen);
      };
      group.addEventListener('toggle', () => { if (!group.isConnected) return; objectExpanded.set(key, group.open); paint(); });
      summary.addEventListener('keydown', event => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault(); event.stopPropagation(); group.open = event.key === 'ArrowRight';
          objectExpanded.set(key, group.open); paint();
          if (group.open) children.querySelector<HTMLElement>('[data-nav-row]')?.focus();
          else summary.focus();
        }
      });
      group.append(children); list.append(group); paint();
    }
  }
  function render(frames:Box[],loose:Box[],nextActive:string):void {
    if(nextActive!==active&&nextActive)expanded.set(nextActive,true);
    active=nextActive;hasFrames=frames.length>0;hasLayers=hasFrames||loose.length>0;
    opts.heading.textContent=t(hasFrames?'Layers':'Loose layers');opts.heading.hidden=hasFrames;
    const known=new Set(frames.map(opts.id));for(const id of expanded.keys())if(!known.has(id))expanded.delete(id);
    opts.list.replaceChildren();
    for(const [index,frame] of frames.entries()) {
      const id=opts.id(frame),children=opts.children(frame).slice().reverse(),name=opts.name(frame,index);
      const group=document.createElement('details');group.className='fc-nav-group';group.dataset.artboard=id;
      group.open=expanded.get(id)??id===active;
      const summary=document.createElement('summary');
      const jump=document.createElement('button');jump.type='button';jump.className='btn btn--ghost fc-nav-group-jump';jump.dataset.jumpArtboard=id;
      jump.textContent=name;jump.title=t('Go to {name}',{name});
      jump.onclick=event=>{event.preventDefault();event.stopPropagation();expanded.set(id,true);group.open=true;paint();opts.jump(id);};
      const count=document.createElement('span');count.className='chip chip--count';count.textContent=String(children.length);count.setAttribute('aria-label',t('{n} layers',{n:children.length}));
      summary.append(jump,count);group.append(summary);
      const list=document.createElement('div');list.className='fc-nav-group-children';list.dataset.layerGroup=id;
      list.setAttribute('role','listbox');list.setAttribute('aria-multiselectable','true');list.setAttribute('aria-label',t('{name} layers',{name}));
      let paintedOpen=group.open;
      const paint=():void=>{paintedOpen=group.open;list.replaceChildren();if(group.open)paintLayers(children,list,id,false);paintActive(active,chosen);};
      group.addEventListener('toggle',()=>{if(!group.isConnected)return;expanded.set(id,group.open);if(paintedOpen!==group.open)paint();});
      group.append(list);paint();opts.list.append(group);
      summary.addEventListener('keydown',event=>{
        if(event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();group.open=true;paint();list.querySelector<HTMLElement>('[data-nav-row]')?.focus();}
        if(event.key==='ArrowLeft'){event.preventDefault();event.stopPropagation();group.open=false;summary.focus();}
      });
      list.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'&&!event.altKey&&!event.ctrlKey&&!event.metaKey){
        const nested=(event.target as Element).closest('.fc-nav-object-group');
        if(nested&&(event.target as Element).closest('summary'))return;
        event.preventDefault();event.stopPropagation();(nested?.querySelector<HTMLElement>('summary')??summary).focus();
      }},true);
    }
    if(loose.length){
      const list=document.createElement('div');list.className='fc-nav-group-children';list.dataset.layerGroup='';list.setAttribute('role','listbox');list.setAttribute('aria-multiselectable','true');list.setAttribute('aria-label',t('Loose layers'));
      if(hasFrames){const label=document.createElement('h3');label.className='fc-nav-subhead';label.textContent=t('Loose layers');opts.list.append(label);}
      paintLayers(loose.slice().reverse(),list,'',true);opts.list.append(list);
    }
    applyMode();paintActive(nextActive,[]);
  }
  function paintActive(id:string,selected:string[]):void {
    chosen=selected;
    for(const group of opts.list.querySelectorAll<HTMLElement>('[data-artboard]')){
      const current=group.dataset.artboard===id;group.classList.toggle('is-active-board',current);
      const button=group.querySelector('button')!;if(current)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');
    }
    for (const group of opts.list.querySelectorAll<HTMLElement>('[data-object-group]')) {
      const on = (objectMembers.get(group) ?? []).some(id => selected.includes(id));
      group.classList.toggle('is-active-group', on);
    }
    for(const list of opts.list.querySelectorAll('[data-layer-group]')){
      const rows=[...list.querySelectorAll<HTMLElement>('[data-nav-row]')];const rover=rows.find(row=>selected.includes(row.dataset.id||''))||rows[0];
      for(const row of rows){row.tabIndex=row===rover?0:-1;const on=selected.includes(row.dataset.id||'');row.classList.toggle('is-active',on);row.setAttribute('aria-selected',String(on));}
    }
  }
  return {render,paintActive};
}
