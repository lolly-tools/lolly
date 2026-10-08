// SPDX-License-Identifier: MPL-2.0
/** Paint trees reference authored contours; geometry has exactly one writable source. */
import { staticSvgAttribute } from './emoji-svg.ts';
import { escapeXml } from './xml-escape.ts';
import { decodeAuthoredPathsResult } from './geom/authored-url.ts';
import { toCubics, type AuthoredPath } from './geom/spline.ts';
import { toSvgPathData, pathBounds, type Contour } from './geom/path.ts';
import { svgTransform } from './emoji-svg-syntax.ts';
import * as pmath from './geom/portable-math.ts';
export type VectorMatrix = [number,number,number,number,number,number];
export interface VectorPaintNode { tag: string; attributes: Record<string,string>; contours?: number[]; children?: VectorPaintNode[] }
export interface VectorPaintV1 { version: 1; width: number; height: number; root: VectorPaintNode }
const presentation=['id','transform','fill','stroke','fill-rule','opacity','fill-opacity','stroke-opacity','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','stop-color','stop-opacity','color-interpolation','clip-rule','clip-path','paint-order'];
const tags:Record<string,string[]>={g:[],defs:[],path:[],linearGradient:['x1','y1','x2','y2','gradientUnits','gradientTransform','spreadMethod'],radialGradient:['cx','cy','r','fx','fy','fr','gradientUnits','gradientTransform','spreadMethod'],stop:['offset'],clipPath:['clipPathUnits']};
const identity:VectorMatrix=[1,0,0,1,0,0];
export function multiplyVectorMatrix(a:VectorMatrix,b:VectorMatrix):VectorMatrix{return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
export function inverseVectorMatrix(m:VectorMatrix):VectorMatrix{
  const d=m[0]*m[3]-m[1]*m[2];if(Math.abs(d)<1e-12)throw new Error('This vector has a collapsed transform. Restore its scale before editing points.');
  return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];
}
export function vectorMatrix(value=''):VectorMatrix{
  if(!value)return [...identity];svgTransform(value);let result:VectorMatrix=[...identity];
  for(const match of value.matchAll(/([A-Za-z]+)\s*\(([^)]*)\)/g)){
    const a=(match[2]!.match(/[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/g)??[]).map(Number);let next:VectorMatrix;
    switch(match[1]){
      case 'matrix':next=a as VectorMatrix;break;
      case 'translate':next=[1,0,0,1,a[0]!,a[1]??0];break;
      case 'scale':next=[a[0]!,0,0,a[1]??a[0]!,0,0];break;
      case 'rotate':{const angle=a[0]!*Math.PI/180;next=[pmath.cos(angle),pmath.sin(angle),-pmath.sin(angle),pmath.cos(angle),0,0];if(a.length===3)next=multiplyVectorMatrix(multiplyVectorMatrix([1,0,0,1,a[1]!,a[2]!],next),[1,0,0,1,-a[1]!,-a[2]!]);break;}
      case 'skewX':next=[1,0,pmath.tan(a[0]!*Math.PI/180),1,0,0];break;
      case 'skewY':next=[1,pmath.tan(a[0]!*Math.PI/180),0,1,0,0];break;
      default:throw new Error('Unsupported vector transform.');
    }
    result=multiplyVectorMatrix(result,next);
  }
  if(result.some(value=>!Number.isFinite(value)||Math.abs(value)>1e9))throw new Error('The vector transform exceeds the supported range.');return result;
}
export function parseVectorPaint(value:unknown,count:number):VectorPaintV1{
  if(typeof value==='string'){if(value.length>1_000_000)throw new Error('Vector paint is too large.');value=JSON.parse(value);}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid vector paint.');
  const paint=value as VectorPaintV1;
  if(paint.version!==1||![paint.width,paint.height].every(value=>Number.isFinite(value)&&value>0&&value<=1e6))throw new Error('Invalid vector paint dimensions.');
  let nodes=0,budget=0;const used=new Set<number>(),ids=new Map<string,string>(),refs:Array<{id:string;tags:string[]}>=[];
  function visit(node:VectorPaintNode,depth:number):VectorPaintNode{
    if(!node||typeof node!=='object'||++nodes>4096||depth>32||!Object.hasOwn(tags,node.tag))throw new Error('Unsupported vector paint tree.');
    if(!node.attributes||typeof node.attributes!=='object'||Array.isArray(node.attributes)||Object.keys(node.attributes).length>48)throw new Error('Invalid vector paint attributes.');
    const attributes:Record<string,string>={};
    for(const [name,value] of Object.entries(node.attributes)){
      if(typeof value==='string')budget+=value.length;
      if(typeof value!=='string'||(!presentation.includes(name)&&!tags[node.tag]!.includes(name))||budget>1_000_000)throw new Error('Unsupported vector paint attribute.');
      attributes[name]=staticSvgAttribute(name,value,node.tag,true);
      if(name==='id'){if(ids.has(value))throw new Error('Duplicate vector paint id.');ids.set(value,node.tag);}
      const ref=/^url\(#([^)]*)\)$/.exec(value);if(ref)refs.push({id:ref[1]!,tags:name==='clip-path'?['clipPath']:['linearGradient','radialGradient']});
    }
    let contours:number[]|undefined;
    if(node.tag==='path'){
      if(!Array.isArray(node.contours)||!node.contours.length||node.contours.length>20000)throw new Error('Vector paint needs its authored contours.');
      contours=node.contours.map(index=>{if(!Number.isInteger(index)||index<0||index>=count||used.has(index))throw new Error('Vector paint no longer matches its authored contours.');used.add(index);return index;});
    }else if(node.contours!==undefined)throw new Error('Only vector paths own contours.');
    if(node.children!==undefined&&(!Array.isArray(node.children)||node.children.length>4096))throw new Error('Invalid vector paint children.');
    if(['path','stop'].includes(node.tag)&&node.children?.length)throw new Error('This vector paint node cannot have children.');
    return {tag:node.tag,attributes,...(contours?{contours}:{}),...(node.children?{children:node.children.map(child=>visit(child,depth+1))}:{})};
  }
  const root=visit(paint.root,0);if(root.tag!=='g'||used.size!==count)throw new Error('Vector paint no longer matches its authored contours.');
  for(const ref of refs)if(!ref.tags.includes(ids.get(ref.id)??''))throw new Error('The vector paint has an invalid local reference.');
  return {version:1,width:paint.width,height:paint.height,root};
}
/** Matrices put each editable contour in the same local frame as its painted ink. */
export function vectorPaintMatrices(paint:VectorPaintV1,count:number,authored?:AuthoredPath[]):VectorMatrix[]{
  const admitted=parseVectorPaint(paint,count),result:VectorMatrix[]=new Array(count),clips=new Map<string,VectorPaintNode>(),pending:Array<{node:VectorPaintNode;matrix:VectorMatrix}>=[];
  function collect(node:VectorPaintNode):void{if(node.tag==='clipPath'&&node.attributes.id)clips.set(node.attributes.id,node);for(const child of node.children??[])collect(child);}collect(admitted.root);
  function bounds(node:VectorPaintNode):ReturnType<typeof pathBounds>{
    if(!authored)throw new Error('This vector clip needs its authored geometry.');const contours:Contour[]=[];
    function walk(node:VectorPaintNode,matrix:VectorMatrix):void{
      if(node.tag==='defs')return;
      for(const index of node.contours??[]){const path=authored![index]!,curves=toCubics(path).map(curve=>curve.map((value,i)=>{if(i%2)return matrix[1]*curve[i-1]!*paint.width+matrix[3]*value*paint.height+matrix[5];return matrix[0]*value*paint.width+matrix[2]*curve[i+1]!*paint.height+matrix[4];}) as typeof curve);contours.push({curves,closed:path.closed});}
      for(const child of node.children??[])walk(child,multiplyVectorMatrix(matrix,vectorMatrix(child.attributes.transform)));
    }walk(node,identity);return pathBounds(contours);
  }
  function visit(node:VectorPaintNode,parent:VectorMatrix):void{
    if(node.tag==='defs')return;
    const matrix=multiplyVectorMatrix(parent,vectorMatrix(node.attributes.transform));
    for(const index of node.contours??[])result[index]=matrix;
    const clip=/^url\(#([^)]+)\)$/.exec(node.attributes['clip-path']??'');
    if(clip){const definition=clips.get(clip[1]!)!;let placement=matrix;if(definition.attributes.clipPathUnits==='objectBoundingBox'){const box=bounds(node);if(!box)throw new Error('This vector clip has no finite bounding box.');placement=multiplyVectorMatrix(matrix,[box.x1-box.x0,0,0,box.y1-box.y0,box.x0,box.y0]);}pending.push({node:definition,matrix:placement});}
    for(const child of node.children??[])visit(child,matrix);
  }
  visit(admitted.root,identity);const placed=new Map<string,VectorMatrix>();
  for(let i=0;i<pending.length;i++){if(i>4096)throw new Error('Vector clipping exceeds the supported depth.');const {node,matrix}=pending[i]!,id=node.attributes.id!,before=placed.get(id);if(before){if(JSON.stringify(before)!==JSON.stringify(matrix))throw new Error('This shared clip has several placements. Separate its uses before editing points.');continue;}placed.set(id,matrix);visit(node,matrix);}
  if(result.some(matrix=>!matrix)||result.filter(Boolean).length!==count)throw new Error('Unused clip geometry cannot be edited.');return result;
}
/** Node editing works in painted frame coordinates and writes back through the inverse. */
export function transformVectorPaintPaths(paths:AuthoredPath[],paintValue:unknown,inverse=false,original=paths):AuthoredPath[]{
  const paint=parseVectorPaint(paintValue,paths.length),matrices=vectorPaintMatrices(paint,paths.length,original);
  return paths.map((path,index)=>{let matrix=multiplyVectorMatrix(multiplyVectorMatrix([1/paint.width,0,0,1/paint.height,0,0],matrices[index]!),[paint.width,0,0,paint.height,0,0]);if(inverse)matrix=inverseVectorMatrix(matrix);
    const vector=(x:number,y:number)=>({x:matrix[0]*x+matrix[2]*y,y:matrix[1]*x+matrix[3]*y});
    return {...path,nodes:path.nodes.map(node=>{const point=vector(node.x,node.y),incoming=vector(node.hInX??0,node.hInY??0),outgoing=vector(node.hOutX??0,node.hOutY??0);return {...node,x:point.x+matrix[4],y:point.y+matrix[5],hInX:incoming.x,hInY:incoming.y,hOutX:outgoing.x,hOutY:outgoing.y};})};
  });
}
export function renderVectorPaint(raw:string,paintValue:unknown,width:number,height:number,prefix:string):string{
  const decoded=decodeAuthoredPathsResult(raw);if(!Array.isArray(decoded))throw new Error(`The authored vector path is ${decoded}.`);
  const paint=parseVectorPaint(paintValue,decoded.length);
  if(![width,height].every(value=>Number.isFinite(value)&&value>0&&value<=1e6)||!/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(prefix))throw new Error('Invalid vector placement.');
  const paths=decoded.map(path=>toSvgPathData([{curves:toCubics({...path,nodes:path.nodes.map(node=>({...node,x:node.x*paint.width,y:node.y*paint.height,...(node.hInX!==undefined?{hInX:node.hInX*paint.width}:{}),...(node.hInY!==undefined?{hInY:node.hInY*paint.height}:{}),...(node.hOutX!==undefined?{hOutX:node.hOutX*paint.width}:{}),...(node.hOutY!==undefined?{hOutY:node.hOutY*paint.height}:{})}))}),closed:path.closed}]));
  const attribute=(name:string,value:string)=>escapeXml(name==='id'?`${prefix}-${value}`:value.replace(/url\(#([^)]+)\)/g,`url(#${prefix}-$1)`));
  function emit(node:VectorPaintNode):string{return `<${node.tag}${Object.entries(node.attributes).map(([name,value])=>` ${name}="${attribute(name,value)}"`).join('')}${node.contours?` d="${escapeXml(node.contours.map(index=>paths[index]).join(' '))}"`:''}>${(node.children??[]).map(emit).join('')}</${node.tag}>`;}
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${paint.width} ${paint.height}" preserveAspectRatio="none" overflow="visible">${emit(paint.root)}</svg>`;
}
