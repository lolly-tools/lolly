// SPDX-License-Identifier: MPL-2.0
/** Fill missing scene previews only when their saved-session tiles come into view.
 *  Each finished thumb is written onto its row (the caller's session record) and handed
 *  to `changed` with its slot, so the caller can patch that one tile in place. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { WebStateAPI } from '../bridge/state.ts';
interface SceneEntry {slot:string;toolId:string;thumb?:string|null;updatedAt:string}
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
        if(!row||row.thumb){pending.delete(slot);continue;}
        const identity=key(row);
        try {
          const values=await (host.state as WebStateAPI).load(slot);
          if(!values||stopped)continue;
          const {renderFeaturedVariant}=await import('../lib/featured-render.ts');
          const thumb=await renderFeaturedVariant(host,'3d-studio',['png'],slot,values,'project-scene');
          const current=rows.get(slot);
          if(!stopped&&current&&key(current)===identity&&!current.thumb&&thumb){current.thumb=thumb;changed(slot,thumb);}
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
      if(!row||row.thumb||pending.has(row.slot)||failed.has(key(row)))continue;
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
        if(row&&!row.thumb&&!failed.has(key(row)))observer.observe(node);
      }
    },
    destroy(){stopped=true;observer.disconnect();queue.length=0;},
  };
}

export async function projectRecentExports():Promise<Array<{href:string;thumb:string;caption:string;at:number}>> {
  try {
    const {listExports,exportReopenHref}=await import('../lib/export-history.ts');
    return (await listExports(12)).filter(item=>item.thumb).map(item=>({href:exportReopenHref(item),thumb:item.thumb!,caption:item.filename||item.label,at:item.at}));
  }catch{return [];}
}
