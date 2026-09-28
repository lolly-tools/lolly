// SPDX-License-Identifier: MPL-2.0
/** A host-owned workspace reuses unchanged paragraphs and their settled flow prefix. */
import type { TextArtworkV1,TextDocumentV1,TextLayoutServicesV1,TextLayoutV1,TextParagraphV1,TextStoryV1 } from '@lolly-tools/core';
import { prepareTextParagraph } from './text-paragraph.ts';
import type { TextFlowCursor } from './text-flow.ts';
type Prepared=Awaited<ReturnType<typeof prepareTextParagraph>>;
export interface TextFlowCheckpoint {
  paragraph:number;lines:number;diagnostics:number;resources:number;shaper:string;cursor:TextFlowCursor;consumed:number;
  ends:Array<[number,number]>;bottoms:Array<[number,number]>;widths:Array<[string,number]>;
}
export interface TextFlowCache { signature:string;keys:string[];layout:TextLayoutV1;checkpoints:TextFlowCheckpoint[] }
export function createTextCompositionCache(){
  const entries=new Map<string,{prepared:Prepared;bytes:number}>();let bytes=0;
  let flow:TextFlowCache|undefined;
  return {
    async prepare(textDocument:TextDocumentV1,story:TextStoryV1,paragraph:TextParagraphV1,services:TextLayoutServicesV1,artwork:TextArtworkV1[]=[]){
      const overlaps=(item:{start:number;end:number})=>item.start<paragraph.end&&item.end>paragraph.start;
      const key=JSON.stringify([paragraph,story.source.slice(paragraph.start,paragraph.end),story.defaultStyle,story.spans.filter(overlaps),story.breaks.filter(item=>item.start>=paragraph.start&&item.start<paragraph.end),story.inlines.filter(item=>item.offset>=paragraph.start&&item.offset<paragraph.end),textDocument.styles,textDocument.fonts.map(({source:_source,...identity})=>identity),artwork.filter(overlaps)]);
      let entry=entries.get(key);
      if(entry){entries.delete(key);entries.set(key,entry);}
      else{
        const prepared=await prepareTextParagraph(textDocument,story,paragraph,services,artwork);
        // A prepared closure retains its document and up to one MiB of line shapes.
        const cost=2*(key.length+JSON.stringify(textDocument).length)+1024*1024;
        if(paragraph.end-paragraph.start<=4096&&cost<=32*1024*1024){
          while(entries.size&&(entries.size>=32||bytes+cost>32*1024*1024)){const first=entries.keys().next().value!;bytes-=entries.get(first)!.bytes;entries.delete(first);}
          entry={prepared,bytes:cost};entries.set(key,entry);bytes+=cost;
        }else entry={prepared,bytes:0};
      }
      const {shape,hyphen,...metadata}=entry.prepared;
      // A caller may annotate its layout. It must never mutate another revision, so
      // every result is a copy. `.shared` reads the cached result itself, for a caller
      // that only reads and copies what it keeps: line breaking asks for many candidate
      // lines and keeps a few, and copying each one was the largest single cost of
      // composing a long document. A wrapper that replaces `shape` (a drop capital)
      // drops `.shared` with it, so its callers are back to copies.
      const copiedShape=Object.assign(async(...args:Parameters<typeof shape>)=>structuredClone(await shape(...args)),{shared:shape});
      const copiedHyphen=Object.assign(async(at:number)=>structuredClone(await hyphen(at)),{shared:hyphen});
      return {key,prepared:{...structuredClone(metadata),shape:copiedShape,hyphen:copiedHyphen}};
    },
    previous():TextFlowCache|undefined{return flow;},
    remember(value:TextFlowCache):void{
      flow=JSON.stringify(value).length*2<=8*1024*1024?structuredClone(value):undefined;
    },
    clear(){entries.clear();bytes=0;flow=undefined;},
  };
}
export type TextCompositionCache=ReturnType<typeof createTextCompositionCache>;
