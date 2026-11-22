// SPDX-License-Identifier: MPL-2.0
/** Fill missing scene previews only when their saved-session tiles come into view.
 *  Each finished thumb is written onto its row (the caller's session record) and handed
 *  to `changed` with its slot, so the caller can patch that one tile in place. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { WebStateAPI } from '../bridge/state.ts';
import { previewImg, type PictureSource } from '../components/preview-image.ts';
import { escape as escapeHtml } from '../utils.ts';
import { t } from '../i18n.ts';
interface SceneEntry {slot:string;toolId:string;thumb?:string|null;preview?:unknown;updatedAt:string}
/** A stored picture or a drawn one already belongs to the row. */
const pictured=(row:SceneEntry):boolean=>!!(row.thumb||row.preview);
export function createProjectScenePreviews(root:HTMLElement,host:HostV1,changed:(slot:string,thumb:string)=>void) {
  let stopped=false,running=false;
  let rows=new Map<string,SceneEntry>();
  const queue:string[]=[],pending=new Set<string>(),failed=new Set<string>();
  const key=(row:SceneEntry):string=>`${row.slot}:${row.updatedAt}`;
  async function pump():Promise<void> {
    if(running)return;
    running=true;
    try {
      while(queue.length&&!stopped) {
        const slot=queue.shift()!,row=rows.get(slot);
        if(!row||pictured(row)){pending.delete(slot);continue;}
        const identity=key(row);
        try {
          const values=await (host.state as WebStateAPI).load(slot);
          if(!values||stopped)continue;
          const {renderFeaturedVariant}=await import('../lib/featured-render.ts');
          const thumb=await renderFeaturedVariant(host,'3d-studio',['png'],slot,values,'project-scene');
          const current=rows.get(slot);
          if(!stopped&&current&&key(current)===identity&&!pictured(current)&&thumb){current.thumb=thumb;changed(slot,thumb);}
        }catch{failed.add(identity);}
        finally{pending.delete(slot);}
      }
    }finally{running=false;}
  }
  const observer=new IntersectionObserver(items=>{
    for(const item of items) {
      if(!item.isIntersecting)continue;
      const node=item.target as HTMLElement,slot=node.dataset.openSession??node.dataset.tool;
      const row=slot?rows.get(slot):undefined;
      if(!row||pictured(row)||pending.has(row.slot)||failed.has(key(row)))continue;
      observer.unobserve(node);pending.add(row.slot);queue.push(row.slot);
    }
    void pump();
  },{rootMargin:'160px'});
  return {
    refresh(entries:readonly SceneEntry[]) {
      rows=new Map(entries.filter(row=>row.toolId==='3d-studio').map(row=>[row.slot,row]));
      observer.disconnect();
      for(const node of root.querySelectorAll<HTMLElement>('[data-open-session], .ftile[data-tool]')) {
        const row=rows.get(node.dataset.openSession??node.dataset.tool??'');
        if(row&&!pictured(row)&&!failed.has(key(row)))observer.observe(node);
      }
    },
    destroy(){stopped=true;observer.disconnect();queue.length=0;},
  };
}

export async function projectRecentExports():Promise<Array<{href:string;picture:PictureSource;caption:string;at:number}>> {
  try {
    const {listExports,exportReopenHref}=await import('../lib/export-history.ts');
    return (await listExports(12)).filter(item=>item.thumb||item.preview).map(item=>({href:exportReopenHref(item),picture:{preview:item.preview,thumb:item.thumb},caption:item.filename||item.label,at:item.at}));
  }catch{return [];}
}

/** The Recent exports rail at the root of Projects (plans/133 WP-10): the downloads
 *  log's reopen tiles, each picture read through components/preview-image.ts. */
export function recentExportsRailHtml(items: ReadonlyArray<{ href: string; picture: PictureSource; caption: string; at: number }>, collapsed: boolean): string {
  return `
        <section class="projects-exports folder-exports">
          <button type="button" class="projects-exports-head" data-recents-toggle aria-expanded="${!collapsed}">
            <span class="folder-exports-title">${t('Recent exports')}</span>
            <span class="projects-exports-count">${items.length}</span>
          </button>
          ${collapsed ? '' : `<div class="folder-exports-rail">
            ${items.map(x => `
              ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - exportReopenHref() builds a fixed '#/tool/<id>' hash route */ ''}
              <a class="folder-export-tile" href="${escapeHtml(x.href)}" data-open-export
                 title="${escapeHtml(x.caption)} · ${escapeHtml(new Date(x.at).toLocaleDateString())}">
                ${previewImg(x.picture, `alt="${escapeHtml(x.caption)}" loading="lazy"`)}
              </a>`).join('')}
          </div>`}
        </section>`;
}
