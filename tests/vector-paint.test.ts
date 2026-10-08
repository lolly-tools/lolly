// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { Resvg } from '@resvg/resvg-js';
import { importVectorPaint } from '../engine/src/vector-paint-import.ts';
import { renderVectorPaint, vectorPaintMatrices, vectorMatrix, inverseVectorMatrix, multiplyVectorMatrix, parseVectorPaint } from '../engine/src/vector-paint.ts';
import { decodeAuthoredPathsResult, encodeAuthoredPaths } from '../engine/src/geom/authored-url.ts';
const parser=new(new JSDOM('').window.DOMParser)(),parse=(source:string)=>parser.parseFromString(source,'image/svg+xml');
const source='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><defs><linearGradient id="ink"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient><radialGradient id="light"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ff8800"/></radialGradient><clipPath id="crop"><rect x="10" y="0" width="130" height="90"/></clipPath><path id="mark" d="M0 0L20 0L20 20L0 20Z"/></defs><g opacity=".5" clip-path="url(#crop)" transform="translate(5 4)"><rect x="0" y="0" width="100" height="80" fill="url(#ink)"/><rect x="50" y="10" width="100" height="80" fill="url(#light)" stroke="#112233" stroke-width="2"/><use href="#mark" x="20" y="20" fill="#000000"/></g></svg>';
test('editable vector paint preserves gradients, clips, use references and group opacity',()=>{
  const converted=importVectorPaint(source,parse),svg=renderVectorPaint(converted.path,converted.paint,200,100,'copy');
  assert.ok(new Resvg(svg).render().pixels.equals(new Resvg(source).render().pixels),'converted paints retain exact raster output');
  assert.ok(!JSON.stringify(converted.paint).includes('"d":'),'paint does not duplicate geometry');assert.ok(!svg.includes('<use'));
  const a=parse(svg),b=parse(renderVectorPaint(converted.path,converted.paint,200,100,'other'));
  const ids=new Set(Array.from(a.querySelectorAll('[id]')).map(el=>el.id));assert.ok(Array.from(b.querySelectorAll('[id]')).every(el=>!ids.has(el.id)));
  const paths=decodeAuthoredPathsResult(converted.path);assert.ok(Array.isArray(paths));assert.equal(paths.length,4);
  const matrices=vectorPaintMatrices(converted.paint,paths.length);assert.deepEqual(matrices[3],[1,0,0,1,25,24]);
  const changed=structuredClone(paths);changed[3]!.nodes[0]!.x+=.1;
  assert.notDeepEqual(new Resvg(renderVectorPaint(encodeAuthoredPaths(changed),converted.paint,200,100,'edited')).render().pixels,new Resvg(svg).render().pixels);
});
test('lowered circles, rounded rectangles, polygons and transforms retain raster appearance',()=>{
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 120 120"><g transform="rotate(12 50 50)" fill="#00aa55"><circle cx="30" cy="30" r="20"/><ellipse cx="70" cy="60" rx="20" ry="30"/><rect x="0" y="60" width="30" height="25" rx="5"/><polygon points="50,0 90,0 80,20"/></g></svg>';
  const converted=importVectorPaint(svg,parse),a=new Resvg(svg).render().pixels,b=new Resvg(renderVectorPaint(converted.path,converted.paint,120,120,'round')).render().pixels;
  const error=a.reduce((sum,value,index)=>sum+Math.abs(value-b[index]!),0)/a.length;assert.ok(error<.05,`mean channel error ${error}`);
  const matrix=vectorMatrix('translate(10 20) rotate(30 2 3) scale(2 3) skewX(4)');const result=multiplyVectorMatrix(matrix,inverseVectorMatrix(matrix));result.forEach((value,index)=>{assert.ok(Math.abs(value-[1,0,0,1,0,0][index]!)<1e-9);});
});
test('malformed or stale paint fails atomically before SVG emission',()=>{
  const {path,paint}=importVectorPaint(source,parse);
  for(const mutate of [(p:typeof paint)=>{p.root.attributes.onclick='alert(1)';},(p:typeof paint)=>{p.root.attributes.fill='url(https://example.com/a)';},(p:typeof paint)=>{p.root.children=[];},(p:typeof paint)=>{p.root.tag='script';}]){const invalid=structuredClone(paint);mutate(invalid);assert.throws(()=>renderVectorPaint(path,invalid,200,100,'bad'));}
  assert.throws(()=>renderVectorPaint(path,paint,200,100,'"><script>'));
  assert.throws(()=>parseVectorPaint(paint,3));
  assert.throws(()=>importVectorPaint('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="https://example.com/a"/></svg>',parse));
});


test('ungroup keeps each shaped outline and each clipped paint unit exact and editable',async()=>{
  const {splitVectorPaint}=await import('../engine/src/vector-paint-parts.ts');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><defs><linearGradient id="g"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient><clipPath id="c"><circle cx="100" cy="50" r="40"/></clipPath></defs><g fill="#335588" transform="translate(5 4)"><path d="M0 0H20V20H0Z M5 5V15H15V5Z" fill-rule="evenodd"/><path d="M25 0H40V20H25Z"/></g><g clip-path="url(#c)" opacity=".6"><rect x="60" y="10" width="80" height="80" fill="url(#g)"/><circle cx="120" cy="50" r="25" fill="#ffaa00"/></g></svg>';
  const vector=importVectorPaint(svg,parse),parts=splitVectorPaint(vector.path,vector.paint);assert.equal(parts.length,3);
  const combined='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">'+parts.map((part,index)=>renderVectorPaint(part.path,part.paint,200,100,`part-${index}`)).join('')+'</svg>';
  assert.deepEqual(new Resvg(combined).render().pixels,new Resvg(renderVectorPaint(vector.path,vector.paint,200,100,'original')).render().pixels);
  for(const part of parts){const paths=decodeAuthoredPathsResult(part.path);assert.ok(Array.isArray(paths));assert.equal(vectorPaintMatrices(part.paint,paths.length,paths).length,paths.length);}
  assert.throws(()=>splitVectorPaint(parts[2]!.path,parts[2]!.paint),/must stay together/);
  const retained=splitVectorPaint(parts[2]!.path,parts[2]!.paint,true);assert.equal(retained.length,1);
  assert.deepEqual(new Resvg(renderVectorPaint(retained[0]!.path,retained[0]!.paint,200,100,'retained')).render().pixels,new Resvg(renderVectorPaint(parts[2]!.path,parts[2]!.paint,200,100,'part')).render().pixels);
});
