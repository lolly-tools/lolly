// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { Resvg } from '@resvg/resvg-js';
import { svgImagePaths } from '../shells/web/src/views/svg-image-vector.ts';
import { boxToPath, type Box } from '../shells/web/src/views/vector-ops.ts';
import { toSvgPathData } from '../engine/src/geom/path.ts';
import { renderVectorPaint } from '../engine/src/vector-paint.ts';
const dom = new JSDOM('');
globalThis.DOMParser = dom.window.DOMParser; globalThis.XMLSerializer = dom.window.XMLSerializer;
const svg = (body: string, attributes = 'viewBox="0 0 100 100"') => `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}>${body}</svg>`;
const wrap = (body: string) => svg(body, 'width="800" height="650"');
const source: Box = { id:'image',kind:'image',x:120,y:140,w:400,h:300,rot:0,image:{id:'library/logo',url:'logo.svg'},opacity:100 };
function pose(box: Box, body: string): string {
  const x=Number(box.x), y=Number(box.y), w=Number(box.w), h=Number(box.h);
  return `<g opacity="${Number(box.opacity??100)/100}" transform="translate(${x+w/2} ${y+h/2}) rotate(${box.rot??0}) scale(${box.flipH?-1:1} ${box.flipV?-1:1}) translate(${-w/2} ${-h/2})">${body}</g>`;
}
function pathRows(rows: Box[]): string {
  return rows.map((row, index)=>row.pathPaint ? pose(row,renderVectorPaint(String(row.path),row.pathPaint,Number(row.w),Number(row.h),'row'+index))
    : `<path d="${toSvgPathData(boxToPath(row)!)}" fill="${row.bg}" fill-rule="${row.fillRule??'nonzero'}" opacity="${Number(row.opacity??100)/100}"/>`).join('');
}
function sameInk(markup: string, box: Box, imageRect: [number,number,number,number], mask = ''): Box[] {
  const rows=svgImagePaths(markup,box,{}), [x,y,w,h]=imageRect;
  const href='data:image/svg+xml;base64,'+Buffer.from(markup).toString('base64');
  const image=`<svg width="${box.w}" height="${box.h}" overflow="hidden"><image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" href="${href}"/></svg>`;
  const before=wrap(pose(box,mask?`<defs><clipPath id="outer">${mask}</clipPath></defs><g clip-path="url(#outer)">${image}</g>`:image));
  const after=wrap(pathRows(rows)), a=new Resvg(before).render().pixels, b=new Resvg(after).render().pixels;
  const error=a.reduce((sum,value,index)=>sum+Math.abs(value-b[index]!),0)/a.length;
  // Resvg rasterises an embedded source SVG before resizing the image. Its one-pixel
  // viewport fringes differ from directly painted paths; interior ink must match.
  assert.ok(error<0.4,`mean channel error ${error}`);
  for(let py=2;py<648;py++)for(let px=2;px<798;px++){
    const i=(py*800+px)*4,delta=[0,1,2,3].reduce((sum,c)=>sum+Math.abs(a[i+c]!-b[i+c]!),0);
    if(delta<32)continue;
    let edge=false;
    for(let dy=-2;dy<=2&&!edge;dy++)for(let dx=-2;dx<=2&&!edge;dx++){
      const j=((py+dy)*800+px+dx)*4;
      edge=[0,1,2,3].some(c=>Math.abs(a[i+c]!-a[j+c]!)>16);
    }
    assert.ok(edge,`interior ink changed at ${px},${py}`);
  }
  assert.ok(rows.every(row=>row.kind==='path'&&row.path&&!row.image));
  return rows;
}
test('unpack makes independently editable solid paths at the original contain placement and stack order',()=>{
  const art=svg('<metadata>credits</metadata><title>Logo</title><g fill="#ff0000"><rect x="10" y="20" width="30" height="40"/><path fill="#00ff00" d="M60 10H90V50H60Z"/></g>');
  const before=structuredClone(source), rows=sameInk(art,source,[50,0,300,300]);
  assert.equal(rows.length,2); assert.deepEqual(source,before);
  assert.ok(rows.every(row=>!row.pathPaint)); assert.deepEqual(rows.map(row=>row.bg),['#ff0000','#00ff00']);
  assert.deepEqual(rows.map(row=>[row.x,row.y,row.w,row.h]),[[200,200,90,120],[350,170,90,120]]);
  rows[1]!.bg='#0000ff';assert.equal(rows[0]!.bg,'#ff0000');
});
test('viewBox origins, intrinsic aspect and viewport alignment survive rotated placement',()=>{
  const art=svg('<g transform="translate(10 20)"><path fill="#ff0000" d="M0 0H80V40H0Z"/><rect fill="#0000ff" x="85" y="10" width="10" height="20"/></g>','viewBox="10 20 100 50" width="200" height="200" preserveAspectRatio="xMaxYMin meet"');
  sameInk(art,{...source,rot:17},[50,0,300,300]);
});
test('fill, cover, scale-down and none preserve placement including clipped source strokes',()=>{
  const art=svg('<path d="M-20 10H120V90H-20Z" fill="#ffd700" stroke="#0000ff" stroke-width="4"/>');
  sameInk(art,{...source,fit:'fill'},[0,0,400,300]);
  sameInk(art,{...source,fit:'cover',imgpos:'right bottom'},[0,-100,400,400]);
  sameInk(art,{...source,fit:'none',imgpos:'left top'},[0,0,100,100]);
  sameInk(art,{...source,fit:'scale-down'},[150,100,100,100]);
});
test('framing zoom, default anchor, reflected rotation and rounded clipping remain exact',()=>{
  const art=svg('<rect fill="#800080" width="100" height="100"/><circle fill="#ffff00" cx="30" cy="30" r="12"/>');
  sameInk(art,{...source,imageFraming:{zoom:200}},[-100,-150,600,600]);
  sameInk(art,{...source,imageFraming:{x:0,y:100,zoom:50}},[0,150,150,150]);
  sameInk(art,{...source,rot:12,flipH:true,fit:'cover'},[0,-50,400,400]);
  sameInk(art,{...source,shape:'pill',fit:'fill'},[0,0,400,300],'<rect width="400" height="300" rx="150"/>');
  sameInk(art,{...source,shape:'ellipse',fit:'fill'},[0,0,400,300],'<ellipse cx="200" cy="150" rx="200" ry="150"/>');
});
test('fixed SVG dimensions without a viewBox and fractional intrinsic dimensions remain placed correctly',()=>{
  sameInk(svg('<rect width="200" height="100" fill="#008000"/>','width="200" height="100"'),source,[0,50,400,200]);
  sameInk(svg('<rect width="100" height="100" fill="#008000"/>','viewBox="0 0 100 100" width="100.5" height="50.25" preserveAspectRatio="none"'),source,[0,50,400,200]);
});
test('intrinsic slice and none, gradients and local use become editable paint without losing ink',()=>{
  const art=svg('<defs><linearGradient id="g"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient><path id="p" d="M0 0H100V50H0Z" fill="url(#g)"/></defs><use href="#p"/><path d="M0 50H100V100H0Z" fill="#008000"/>','viewBox="0 0 100 100" width="200" height="100" preserveAspectRatio="xMidYMid slice"');
  sameInk(art,source,[0,50,400,200]);
  sameInk(art.replace('xMidYMid slice','none'),{...source,fit:'fill'},[0,0,400,300]);
});
test('overlapping alpha stays a single editable paint group instead of changing compositing',()=>{
  const art=svg('<rect width="70" height="70" fill="#ff0000"/><rect x="30" y="30" width="70" height="70" fill="#0000ff"/>');
  assert.equal(sameInk(art,{...source,opacity:50},[50,0,300,300]).length,1);
  const entrance=sameInk(art,{...source,enter:'fade',rot:12},[50,0,300,300]);assert.equal(entrance.length,1);assert.equal(entrance[0]!.enter,'fade');assert.equal(entrance[0]!.rot,12);
  assert.equal(sameInk(svg('<g opacity=".5"><rect width="70" height="70" fill="#ff0000"/><rect x="30" y="30" width="70" height="70" fill="#0000ff"/></g>'),source,[50,0,300,300]).length,1);
});
test('static class styles retain specificity, inheritance, inline overrides and separate path fills',()=>{
  const art=svg('<style>/* themed icon */path { fill:#ff0000 }.ink {fill:#3366ff}.ink {stroke:none}#accent {fill:#008000}</style><g class="ink"><path d="M10 10H40V80H10Z"/><path id="accent" class="ink" fill="#ff0000" d="M60 10H90V80H60Z" style="fill:#ffff00"/></g>');
  const rows=sameInk(art,source,[50,0,300,300]);assert.equal(rows.length,2);assert.equal(rows[0]!.bg,'#ff0000');assert.equal(rows[1]!.bg,'#ffff00');
  const classOnly=sameInk(svg('<style>.c1{fill:#ff6633}.c2{fill:#3366ff}</style><path class="c1" d="M10 10H40V80H10Z"/><path class="c2" d="M60 10H90V80H60Z"/>'),source,[50,0,300,300]);
  assert.deepEqual(classOnly.map(row=>row.bg),['#ff6633','#3366ff']);
  const specificity=svg(`<style id="styles">${'.ink'.repeat(11)}{fill:#ff0000}#accent{fill:#008000}</style><path id="accent" class="ink" d="M10 10H40V80H10Z"/>`);
  assert.equal(sameInk(specificity,source,[50,0,300,300])[0]!.bg,'#008000');
});
test('unsupported painting and image effects fail before changing their source',()=>{
  const before=structuredClone(source);
  for(const art of [svg('<text>Text</text>'),svg('<style>path:hover{fill:red}</style><path d="M0 0H20V20Z"/>'),svg('<style>@media (prefers-color-scheme:dark){path{fill:red}}</style><path d="M0 0H20V20Z"/>'),svg('<style>path{filter:blur(2px)}</style><path d="M0 0H20V20Z"/>'),svg('<rect filter="url(#f)" width="100" height="100"/>')]) assert.throws(()=>svgImagePaths(art,source,{}));
  for(const extra of [{locked:true},{blur:4},{kf:'keys'},{bg:'red'},{text:'label'},{textStory:'story'},{clip:'mask'}]) assert.throws(()=>svgImagePaths(svg('<rect width="100" height="100"/>'),{...source,...extra},{}));
  assert.throws(()=>svgImagePaths(svg('<style>'+'.ink{fill:#ff0000}'.repeat(65)+'</style><path class="ink" d="M0 0H20V20Z"/>'),source,{}),/too many CSS rules/);
  assert.deepEqual(source,before);
});
