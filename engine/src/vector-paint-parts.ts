// SPDX-License-Identifier: MPL-2.0
/** Separate paint groups only where inherited compositing can remain exact. */
import { decodeAuthoredPathsResult,encodeAuthoredPaths } from './geom/authored-url.ts';
import { parseVectorPaint,type VectorPaintNode,type VectorPaintV1 } from './vector-paint.ts';
export function splitVectorPaint(raw:string,value:unknown,allowSingle=false):Array<{path:string;paint:VectorPaintV1}>{
  const paths=decodeAuthoredPathsResult(raw);if(!Array.isArray(paths))throw new Error('The authored vector geometry is invalid.');
  const paint=parseVectorPaint(value,paths.length),definitions=new Map<string,VectorPaintNode>();
  function collect(node:VectorPaintNode,inDefinitions=false){if(inDefinitions&&node.attributes.id)definitions.set(node.attributes.id,node);for(const child of node.children??[])collect(child,inDefinitions||node.tag==='defs');}
  collect(paint.root);
  function units(node:VectorPaintNode):VectorPaintNode[]{
    if(node.tag==='defs')return [];
    if(node.tag==='path'||node.attributes['clip-path']||node.attributes.opacity!==undefined&&Number(node.attributes.opacity)!==1)return [node];
    return (node.children??[]).flatMap(child=>units(child).map(unit=>({...node,children:[unit]})));
  }
  const parts=units(paint.root);if(!parts.length)throw new Error('This vector has no visible paint layers.');if(parts.length<2&&!allowSingle)throw new Error('This paint group must stay together to preserve its opacity or clipping. Its points remain editable.');
  if(parts.length>1024)throw new Error('This vector has too many parts to separate. Select a smaller text range first.');
  return parts.map(root=>{
    const needed=new Set<string>();
    function references(node:VectorPaintNode){for(const value of Object.values(node.attributes)){const match=/^url\(#([^)]*)\)$/.exec(value);if(match&&!needed.has(match[1]!)){needed.add(match[1]!);const definition=definitions.get(match[1]!);if(!definition)throw new Error('A vector paint definition is missing.');references(definition);}}for(const child of node.children??[])references(child);}
    references(root);
    const defs=[...needed].map(id=>definitions.get(id)!);
    // A referenced parent already includes its child definitions.
    const descendants=new Set<string>();for(const definition of defs){const visit=(node:VectorPaintNode)=>{for(const child of node.children??[]){if(child.attributes.id)descendants.add(child.attributes.id);visit(child);}};visit(definition);}
    const tree:VectorPaintNode={tag:'g',attributes:{},children:[{tag:'defs',attributes:{},children:defs.filter(node=>!descendants.has(node.attributes.id!))},root]};
    const indices:number[]=[];
    function remap(node:VectorPaintNode):VectorPaintNode{return {...node,attributes:{...node.attributes},...(node.contours?{contours:node.contours.map(index=>{const next=indices.length;indices.push(index);return next;})}:{}),...(node.children?{children:node.children.map(remap)}:{})};}
    const mapped=remap(tree),path=encodeAuthoredPaths(indices.map(index=>paths[index]!));
    return {path,paint:parseVectorPaint({...paint,root:mapped},indices.length)};
  });
}
