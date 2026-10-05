// SPDX-License-Identifier: MPL-2.0
/** Prepare linked SVG conversion before offering one reversible document write. */
import type { Box } from './vector-ops.ts';
import { svgImagePaths, type SvgImageFields } from './svg-image-vector.ts';
import { isSvgImageRef } from './free-canvas-math.ts';
import { readBounded } from '../lib/clip-thumbs.ts';
import { t } from '../i18n.ts';
export interface SvgUnpackPorts {
  cfg: SvgImageFields;
  labelField: string;
  referenceFields: string[];
  boxes(): Box[];
  selected(): Set<string>;
  disposed(): boolean;
  freshId(rows: Box[]): string;
  resolve?(id: string, version?: string): Promise<{url:string;meta?:unknown}>;
  confirm(ask: {at:{x:number;y:number};title:string;hint:string;confirm:string;apply():void}): void;
  commit(rows: Box[], ids: string[]): void;
  flash(message: string): void;
}
export async function unpackSvgImagePaths(ports: SvgUnpackPorts, at: {x:number;y:number}): Promise<void> {
  const {cfg}=ports, idField=cfg.idField||'id', imageField=cfg.imageField||'image';
  const original=ports.boxes(), selection=[...ports.selected()].sort(), snapshot=JSON.stringify(original);
  const targets=original.filter(row=>selection.includes(String(row[idField]))&&isSvgImageRef(row[imageField]));
  if (!targets.length) return;
  const stale=()=>ports.disposed()||JSON.stringify(ports.boxes())!==snapshot||JSON.stringify([...ports.selected()].sort())!==JSON.stringify(selection);
  try {
    const replacements=new Map<Box,Box[]>(), ids:string[]=[];
    let minted=original;
    for (const source of targets) {
      const sourceId=String(source[idField]);
      if (original.some(row=>ports.referenceFields.some(field=>field&&row[field]===sourceId))) throw new Error(t('Remove references to this image before unpacking its layers.'));
      let ref=source[imageField] as {url?:string;id?:string;source?:string;version?:string;type?:string;format?:string;meta?:unknown};
      if (!ref.url&&ref.id&&ports.resolve) {const resolved=await ports.resolve(ref.id,ref.version);ref={...ref,url:resolved.url,meta:ref.meta??resolved.meta};}
      if (!ref.url) throw new Error(t('This SVG image has no readable source.'));
      const response=await fetch(ref.url,{signal:AbortSignal.timeout(20_000)});
      if(!response.ok)throw new Error(t('The SVG image could not be read.'));
      // Admission reads original markup so unsupported visible elements cannot be
      // removed by a display sanitiser before the conversion has a chance to refuse.
      const bytes=await readBounded(response,1_000_000);
      if(!bytes)throw new Error(t('This SVG is too large to unpack into editable paths.'));
      const markup=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
      if (stale()) { if (!ports.disposed()) ports.flash(t('The selection changed while reading the SVG. Try unpacking again.')); return; }
      const parts=svgImagePaths(markup,source,cfg);
      const credit=JSON.stringify({version:1,assetSource:{id:ref.id,source:ref.source,version:ref.version,type:ref.type,format:ref.format,meta:ref.meta}});
      const name=String(source[ports.labelField]||t('SVG'));
      const rows=parts.map((part,index)=>{
        const id=ports.freshId(minted); minted=[...minted,{[idField]:id}]; ids.push(id);
        return {...part,[idField]:id,...(ports.labelField?{[ports.labelField]:t('{name}: path {n}',{name,n:index+1})}:{}),vectorSource:credit};
      });
      replacements.set(source,rows);
    }
    const prepared=original.flatMap(row=>replacements.get(row)??[row]);
    ports.confirm({at,title:t('Unpack SVG layers?'),confirm:t('Replace with paths'),
      hint:t('Replace the linked image with {n} editable path objects. The library asset stays intact. Undo restores the image. Overlapping opacity and clipping may keep several shapes in one path object.',{n:ids.length}),
      apply(){
        if(stale()){if(!ports.disposed())ports.flash(t('The selection changed. Try unpacking again.'));return;}
        ports.commit(prepared,ids); ports.flash(t('Unpacked into {n} editable path objects.',{n:ids.length}));
      },
    });
  } catch(error) {
    if(!ports.disposed())ports.flash(t('The SVG could not be unpacked: {reason}',{reason:error instanceof Error?error.message:String(error)}));
  }
}
