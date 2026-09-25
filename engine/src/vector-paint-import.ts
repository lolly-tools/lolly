// SPDX-License-Identifier: MPL-2.0
/** Lower admitted static artwork into editable contours and a separate paint tree. */
import { admitTextInlineSvg, type EmojiXmlParser } from './emoji-svg.ts';
import { parseSvgPath } from './svg-path.ts';
import { pathFromSubPaths, closeContour, type Contour } from './geom/path.ts';
import type { AuthoredPath } from './geom/spline.ts';
import { encodeAuthoredPaths } from './geom/authored-url.ts';
import { parseVectorPaint, type VectorPaintNode, type VectorPaintV1 } from './vector-paint.ts';
export function vectorContourNodes(contour:Contour,width:number,height:number):AuthoredPath{
  if(!contour.curves.length)throw new Error('The vector has no editable curve.');
  const nodes:AuthoredPath['nodes']=[],curves=(contour.closed?closeContour(contour):contour).curves;
  for(let i=0;i<curves.length;i++){
    const curve=curves[i]!,previous=curves[i-1]??(contour.closed?curves.at(-1):undefined);
    nodes.push({x:curve[0]/width,y:curve[1]/height,hOutX:(curve[2]-curve[0])/width,hOutY:(curve[3]-curve[1])/height,...(previous?{hInX:(previous[4]-curve[0])/width,hInY:(previous[5]-curve[1])/height}:{}),continuity:'corner'});
  }
  if(!contour.closed){const last=curves.at(-1)!;nodes.push({x:last[6]/width,y:last[7]/height,hInX:(last[4]-last[6])/width,hInY:(last[5]-last[7])/height,continuity:'corner'});}
  return {kind:'cubic',closed:contour.closed,nodes};
}
const geometry:Record<string,string[]>={path:['d'],rect:['x','y','width','height','rx','ry'],circle:['cx','cy','r'],ellipse:['cx','cy','rx','ry'],line:['x1','y1','x2','y2'],polygon:['points'],polyline:['points']};
/** One SVG shape element (path, rect with rx/ry, circle, ellipse, line, polygon, polyline) as path data in its own user space. */
export function shapePath(element:Element):string{
  const n=(name:string,fallback=0)=>element.hasAttribute(name)?Number(element.getAttribute(name)):fallback;
  switch(element.localName){
    case 'path':return element.getAttribute('d')??'';
    case 'line':return `M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`;
    case 'polygon':case 'polyline':{const points=(element.getAttribute('points')??'').trim().split(/[\s,]+/).map(Number);return points.reduce((d,value,index)=>index%2?d:`${d}${index?'L':'M'}${value} ${points[index+1]}`,'')+(element.localName==='polygon'?'Z':'');}
    case 'circle':case 'ellipse':{const x=n('cx'),y=n('cy'),rx=n(element.localName==='circle'?'r':'rx'),ry=n(element.localName==='circle'?'r':'ry');if(!rx||!ry)return '';return `M${x-rx} ${y}A${rx} ${ry} 0 1 1 ${x+rx} ${y}A${rx} ${ry} 0 1 1 ${x-rx} ${y}Z`;}
    case 'rect':{const x=n('x'),y=n('y'),w=n('width'),h=n('height'),rx=Math.min(w/2,n('rx',n('ry'))),ry=Math.min(h/2,n('ry',n('rx')));if(!w||!h)return '';if(!rx||!ry)return `M${x} ${y}H${x+w}V${y+h}H${x}Z`;return `M${x+rx} ${y}H${x+w-rx}A${rx} ${ry} 0 0 1 ${x+w} ${y+ry}V${y+h-ry}A${rx} ${ry} 0 0 1 ${x+w-rx} ${y+h}H${x+rx}A${rx} ${ry} 0 0 1 ${x} ${y+h-ry}V${y+ry}A${rx} ${ry} 0 0 1 ${x+rx} ${y}Z`;}
    default:throw new Error('Unsupported vector shape.');
  }
}
export function importVectorPaint(svg:string,parseXml:EmojiXmlParser):{path:string;paint:VectorPaintV1}{
  const admitted=admitTextInlineSvg(svg,parseXml,'vector'),doc=parseXml(admitted),root=doc.documentElement;
  const view=(root.getAttribute('viewBox')??'').split(/[\s,]+/).map(Number),width=view[2]!,height=view[3]!;
  const paths:AuthoredPath[]=[],idMap=new Map(Array.from(doc.getElementsByTagName('*')).filter(el=>el.hasAttribute('id')).map(el=>[el.getAttribute('id')!,el]));
  function walk(element:Element,definition=false,instance=false):VectorPaintNode|null{
    const tag=element.localName,attributes=Object.fromEntries(Array.from(element.attributes).map(attr=>[attr.name,attr.value]));
    if(instance)delete attributes.id;
    if(tag==='use'){
      const target=idMap.get(attributes.href!.slice(1));if(!target)throw new Error('Missing local vector shape.');
      const x=Number(attributes.x??0),y=Number(attributes.y??0),own=attributes.transform??'';
      for(const key of ['href','x','y','width','height'])delete attributes[key];attributes.transform=`${own} translate(${x} ${y})`.trim();
      const child=walk(target,false,true);return {tag:'g',attributes,children:child?[child]:[]};
    }
    if(geometry[tag]){
      if(definition)return null;
      const d=shapePath(element),contours=pathFromSubPaths(parseSvgPath(d)).filter(contour=>contour.curves.length);if(!contours.length)return null;
      const indices=contours.map(contour=>{const index=paths.length;paths.push(vectorContourNodes(contour,width,height));return index;});
      for(const key of geometry[tag]!)delete attributes[key];return {tag:'path',attributes,contours:indices};
    }
    const children=Array.from(element.children).flatMap(child=>{const node=walk(child,tag==='defs',instance);return node?[node]:[];});
    if(tag==='svg'){
      for(const key of ['xmlns','viewBox','width','height','preserveAspectRatio'])delete attributes[key];
      const own=attributes.transform??'';attributes.transform=`translate(${-view[0]!} ${-view[1]!}) ${own}`.trim();return {tag:'g',attributes,children};
    }
    return {tag,attributes,children};
  }
  const tree=walk(root)!;if(!paths.length)throw new Error('This selection has no visible vector geometry.');
  const path=encodeAuthoredPaths(paths),paint=parseVectorPaint({version:1,width,height,root:tree},paths.length);
  return {path,paint};
}
