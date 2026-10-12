// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDesignLayoutEvaluator, designLayoutSourceEdit, validateDesignLayout } from '../engine/src/design-layout.ts';
import { loadLayoutKernel } from '../packages/node-shell/src/layout-kernel-node.ts';
const solve = await loadLayoutKernel();
type Row = Record<string, unknown>;
const row = (id: string, patch: Row = {}): Row => ({ id, kind:'box', x:0, y:0, w:100, h:50, rot:0, ...patch });
const root = (patch: Row = {}): Row => row('root',{kind:'frame',layout:'flex',w:300,h:150,...patch});
const group = (patch: Row = {}): Row => row('group',{kind:'group',layoutOwner:'root',...patch});
const near = (actual: unknown, expected: number) => assert.ok(Math.abs(Number(actual)-expected)<0.03,`${actual} != ${expected}`);
const angleNear = (actual: unknown, expected: number) => near(((Number(actual)-expected+180)%360+360)%360-180,0);
const geometry = (box: Row) => ['x','y','w','h','rot'].map(field=>box[field]);
const stable = async (source: Row[], tracks: Row[] = []) => {
  const before=structuredClone(source),evaluate=createDesignLayoutEvaluator(solve),first=await evaluate(source,tracks);
  assert.deepEqual(first.findings,[]); assert.deepEqual(source,before);
  assert.deepEqual(designLayoutSourceEdit(source,first.boxes,first.boxes),source);
  const cached=await evaluate(source,tracks); assert.equal(cached.solved,0); assert.deepEqual(cached.boxes,first.boxes);
  assert.deepEqual((await createDesignLayoutEvaluator(solve)(source,tracks)).boxes,first.boxes);
  return first;
};
const gridTracks: Row[]=[{id:'column',container:'root',axis:'column',order:0,track:'1fr'},{id:'row',container:'root',axis:'row',order:0,track:'1fr'}];

for (const layout of ['flex','grid']) test(`${layout} group fill scales nested descendants once and keeps the opposite fixed axis`,async()=>{
  const source=[root({layout}),group({layoutW:'fill'}),row('a',{group:'group',x:10,y:10,w:20,h:10}),
    row('inner',{kind:'group',group:'group',x:50,y:20,w:30,h:20}),row('leaf',{group:'inner',x:60,y:25,w:10,h:10,rot:90}),
    row('hidden',{group:'inner',x:10,y:10,w:10,h:10,hidden:true})];
  const result=await stable(source,layout==='grid'?gridTracks:[]),g=result.boxes[1]!,a=result.boxes[2]!,inner=result.boxes[3]!,leaf=result.boxes[4]!;
  near(g.w,300); near(g.h,50); near(a.x,30); near(a.y,10); near(a.w,60); near(a.h,10);
  near(inner.x,150); near(inner.w,90); near(leaf.x,190); near(leaf.y,15); near(leaf.w,10); near(leaf.h,30); near(leaf.rot,90);
  near(result.boxes[5]!.x,30); near(result.boxes[5]!.w,30); assert.equal(result.boxes[5]!.hidden,true);
});

for (const angle of [0,45,90,180]) test(`uniform group fill preserves relative nested rotations at parent ${angle} degrees`,async()=>{
  const source=[root({rot:angle}),group({layoutW:'fill',layoutH:'fill',layoutAngle:0}),
    row('inner',{kind:'group',group:'group',x:10,y:10,w:20,h:10,rot:15}),row('leaf',{group:'inner',x:10,y:10,w:20,h:10,rot:27})];
  const result=await stable(source),g=result.boxes[1]!,inner=result.boxes[2]!,leaf=result.boxes[3]!;
  near(g.w,300); near(g.h,150); near(g.rot,angle); angleNear(inner.rot,angle+15); angleNear(leaf.rot,angle+27);
  near(inner.w,60); near(inner.h,30); near(leaf.w,60); near(leaf.h,30);
  const c=Math.cos(angle*Math.PI/180),s=Math.sin(angle*Math.PI/180);
  near(Number(leaf.x)+30,150-90*c+30*s); near(Number(leaf.y)+15,75-90*s-30*c);
});

test('anisotropic group fill refuses shear atomically, including hidden rotated descendants',async()=>{
  for (const hidden of [false,true]) {
    const source=[root(),group({layoutW:'fill'}),row('leaf',{group:'group',rot:27,hidden})],before=structuredClone(source);
    const result=await createDesignLayoutEvaluator(solve)(source);
    assert.match(result.findings[0]!.message,/shear rotated layer "leaf"/); assert.equal(result.boxes,source);
    assert.deepEqual(source,before); assert.deepEqual(result.grids,[]);
  }
});

test('group fill limits come from the modern solver and scale descendants to the allocated size',async()=>{
  for (const [width,expected] of [[100,180],[600,240]]) {
    const result=await stable([root({w:width}),group({layoutW:'fill',layoutMinW:180,layoutMaxW:240}),row('leaf',{group:'group',x:10,y:10,w:20,h:10})]);
    near(result.boxes[1]!.w,expected!); near(result.boxes[1]!.h,50); near(result.boxes[2]!.x,expected!/10); near(result.boxes[2]!.w,expected!/5);
  }
});

test('standalone group hug measures visible leaf bounds and leaves descendants in document coordinates',async()=>{
  const source=[group({layoutOwner:'',w:100,h:100,layoutW:'hug',layoutH:'hug'}),row('a',{group:'group',x:10,y:20,w:20,h:10}),
    row('inner',{kind:'group',group:'group',x:0,y:0,w:1000,h:1000}),row('b',{group:'inner',x:40,y:40,w:20,h:10}),
    row('hidden-branch',{kind:'group',group:'group',x:500,y:500,w:100,h:100,hidden:true}),row('hidden-child',{group:'hidden-branch',x:1000,y:1000,w:20,h:10})];
  const result=await stable(source); assert.deepEqual(geometry(result.boxes[0]!),[10,20,50,30,0]);
  for (let n=1;n<source.length;n++) assert.deepEqual(geometry(result.boxes[n]!),geometry(source[n]!));
  assert.equal(result.boxes[5]!.hidden,true); assert.equal(source[5]!.hidden,undefined); assert.equal(result.solved,0);
  assert.deepEqual((await createDesignLayoutEvaluator(solve)(result.boxes)).boxes,result.boxes);
});

test('group hug preserves a fixed opposite axis and applies explicit intrinsic size limits',async()=>{
  for (const axis of ['W','H']) {
    const source=[group({layoutOwner:'',w:100,h:100,[`layout${axis}`]:'hug',[`layoutMin${axis}`]:60,[`layoutMax${axis}`]:80}),row('leaf',{group:'group',x:10,y:20,w:20,h:10})];
    const result=await stable(source),g=result.boxes[0]!;
    near(g.w,axis==='W'?60:100); near(g.h,axis==='H'?60:100);
    near(g.x,axis==='W'?10:0); near(g.y,axis==='H'?20:0); assert.deepEqual(geometry(result.boxes[1]!),geometry(source[1]!));
  }
});

test('rotated group hug measures in its axes while keeping its rotation and descendant geometry',async()=>{
  const source=[group({layoutOwner:'',x:0,y:0,w:100,h:100,rot:90,layoutW:'hug',layoutH:'hug'}),row('leaf',{group:'group',x:30,y:35,w:20,h:10,rot:90})];
  const result=await stable(source); geometry(result.boxes[0]!).forEach((value,n)=>{near(value,[30,35,20,10,90][n]!);});
  assert.deepEqual(geometry(result.boxes[1]!),geometry(source[1]!));
});

for (const layout of ['flex','grid']) test(`${layout} group hug participates as one intrinsic item and settles beside siblings`,async()=>{
  const source=[root({layout}),group({w:100,h:100,layoutW:'hug',layoutH:'hug'}),row('a',{group:'group',x:10,y:20,w:20,h:10}),row('b',{group:'group',x:40,y:40,w:20,h:10}),row('sibling',{layoutOwner:'root',w:30,h:30,layoutOrder:1})];
  const tracks=layout==='grid'?[{id:'c1',container:'root',axis:'column',order:0,track:'auto'},{id:'c2',container:'root',axis:'column',order:1,track:'1fr'}]:[];
  const result=await stable(source,tracks); near(result.boxes[1]!.w,50); near(result.boxes[1]!.h,30);
  near(result.boxes[2]!.x,0); near(result.boxes[2]!.y,0); near(result.boxes[3]!.x,30); near(result.boxes[3]!.y,20); near(result.boxes[4]!.x,50);
});

test('empty and fully hidden group hug use a deterministic small allocation',async()=>{
  for (const child of [[],[row('hidden',{group:'group',hidden:true,w:1000,h:1000})]]) {
    const result=await stable([group({layoutOwner:'',layoutW:'hug',layoutH:'hug'}),...child]);
    near(result.boxes[0]!.w,0.01); near(result.boxes[0]!.h,0.01); near(result.boxes[0]!.x,0); near(result.boxes[0]!.y,0);
  }
});

test('group geometry refusal preserves the entire unsolved document and size admission remains bounded',async()=>{
  const source=[root({w:1e7}),group({layoutW:'fill',w:1,h:1}),row('leaf',{group:'group',w:1e7,h:1})];
  const result=await createDesignLayoutEvaluator(solve)(source); assert.equal(result.boxes,source); assert.match(result.findings[0]!.message,/geometry limit/);
  assert.ok(validateDesignLayout([group({layoutOwner:'',layoutW:'fill'})]).some(finding=>finding.code==='layout.group-sizing'));
  assert.ok(validateDesignLayout([group({layoutOwner:'',layoutW:'hug',layoutMinW:20,layoutMaxW:10})]).some(finding=>finding.code==='layout.limits'));
  assert.ok(validateDesignLayout([group({layoutOwner:'',layoutH:'bogus'})]).some(finding=>finding.code==='layout.sizing'));
});

test('editing one standalone hug-group dimension fixes that axis while content edits keep derived geometry disposable',async()=>{
  const source=[group({layoutOwner:'',layoutW:'hug',layoutH:'hug'}),row('leaf',{group:'group',x:10,y:20,w:20,h:10})];
  const evaluated=(await stable(source)).boxes;
  const content=designLayoutSourceEdit(source,evaluated,evaluated.map(box=>box.id==='leaf'?{...box,name:'Renamed'}:box));
  assert.deepEqual(content[0],source[0]); assert.equal(content[1]!.name,'Renamed');
  for (const field of ['w','h']) {
    const resized=designLayoutSourceEdit(source,evaluated,evaluated.map(box=>box.id==='group'?{...box,[field]:50}:box));
    assert.equal(resized[0]![field],50); assert.equal(resized[0]![field==='w'?'layoutW':'layoutH'],'fixed');
    assert.equal(resized[0]![field==='w'?'layoutH':'layoutW'],'hug'); assert.equal(resized[0]![field==='w'?'h':'w'],evaluated[0]![field==='w'?'h':'w']);
  }
});

for (const angle of [17,45,135]) test(`intrinsic group bounds retain its ${angle}-degree axes independently of leaf rotation`,async()=>{
  const source=[group({layoutOwner:'',w:100,h:100,rot:angle,layoutW:'hug',layoutH:'hug'}),row('leaf',{group:'group',x:30,y:35,w:20,h:10,rot:angle+90})];
  const result=await stable(source); geometry(result.boxes[0]!).forEach((value,n)=>{near(value,[35,30,10,20,angle][n]!);});
  assert.deepEqual(geometry(result.boxes[1]!),geometry(source[1]!));
});

test('intrinsic group measurement refuses excessive aggregate work with no partial projection',async()=>{
  const groups=Array.from({length:64},(_,n)=>row(`g${n}`,{kind:'group',group:n?`g${n-1}`:'',layoutW:'hug'}));
  const source=[...groups,...Array.from({length:19936},(_,n)=>row(`leaf${n}`,{group:'g63'}))];
  assert.deepEqual(validateDesignLayout(source),[]);
  const result=await createDesignLayoutEvaluator(solve)(source); assert.equal(result.boxes,source);
  assert.match(result.findings[0]!.message,/aggregate reflow work budget/); assert.deepEqual(result.grids,[]);
});

test('uniform fill supports groups rotated relative to their layout owner without resetting nested angles',async()=>{
  const result=await stable([root({w:3*(100*Math.cos(Math.PI/6)+50*Math.sin(Math.PI/6)),h:3*(100*Math.sin(Math.PI/6)+50*Math.cos(Math.PI/6))}),group({rot:30,layoutAngle:30,layoutW:'fill',layoutH:'fill'}),row('inner',{kind:'group',group:'group',x:30,y:15,w:20,h:10,rot:55}),row('leaf',{group:'inner',x:35,y:20,w:10,h:5,rot:77})]);
  near(result.boxes[1]!.rot,30); near(result.boxes[2]!.rot,55); near(result.boxes[3]!.rot,77);
  near(result.boxes[2]!.w,60); near(result.boxes[2]!.h,30); near(result.boxes[3]!.w,30); near(result.boxes[3]!.h,15);
});

test('hug-to-fixed resize materializes group origins and one coherent descendant geometry space',async()=>{
  for (const angle of [0,27,90]) {
    const source=[group({layoutOwner:'',w:100,h:100,rot:angle,layoutW:'hug',layoutH:'hug'}),row('leaf',{group:'group',x:20,y:30,w:40,h:50,rot:angle})];
    const evaluated=(await stable(source)).boxes;
    const g=evaluated[0]!,leaf=evaluated[1]!;
    const proposed: Row[]=[{...g,w:Number(g.w)*2,h:Number(g.h)*2}, {...leaf,w:Number(leaf.w)*2,h:Number(leaf.h)*2,x:Number(g.x),y:Number(g.y)}];
    // Uniform numeric group resizing also carries its opposite dimension; only W was requested.
    const canonical=designLayoutSourceEdit(source,evaluated,proposed,{groupSizeAxes:new Map([['group',new Set(['W'])]])});
    assert.equal(canonical[0]!.layoutW,'fixed'); assert.equal(canonical[0]!.layoutH,'hug');
    assert.deepEqual(geometry(canonical[0]!),geometry(proposed[0]!)); assert.deepEqual(geometry(canonical[1]!),geometry(proposed[1]!));
    const resized=await stable(canonical); geometry(resized.boxes[0]!).forEach((value,n)=>{near(value,Number(proposed[0]![['x','y','w','h','rot'][n]!]));});
    assert.deepEqual(geometry(resized.boxes[1]!),geometry(proposed[1]!));
  }
});

test('intrinsic group maxima bound allocation and refuse unrepresentable zero-sized maxima atomically',async()=>{
  const source=[group({layoutOwner:'',layoutW:'hug',layoutMaxW:30}),row('leaf',{group:'group',x:20,w:100})];
  const bounded=await stable(source); near(bounded.boxes[0]!.w,30); assert.deepEqual(geometry(bounded.boxes[1]!),geometry(source[1]!));
  const zero=source.map(box=>box.id==='group'?{...box,layoutMaxW:0}:box),refused=await createDesignLayoutEvaluator(solve)(zero);
  assert.equal(refused.boxes,zero); assert.match(refused.findings[0]!.message,/maximum size of at least 0.01/);
});
