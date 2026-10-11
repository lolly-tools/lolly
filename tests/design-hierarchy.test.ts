// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { designHierarchyIndex, designHierarchyAncestors, designHierarchyDescendants, designHierarchyBounds, designHierarchyFlags, designHierarchyPageBoxes, migrateDesignHierarchy, reparentDesignHierarchy, remapDesignHierarchy, refreshDesignGroupBounds, validateDesignHierarchy } from '../engine/src/design-hierarchy.ts';
import { createDesignLayoutEvaluator, validateDesignLayout } from '../engine/src/design-layout.ts';
import { loadLayoutKernel } from '../packages/node-shell/src/layout-kernel-node.ts';
import { boxesToPenpotDoc, buildPenpotEntries } from '../engine/src/penpot-file.ts';
import { importPenpotLayouts } from '../engine/src/penpot-layout.ts';
import { penpotShapeToNode, nodeToBox } from '../engine/src/design-map.ts';
const pages = [{ id: 'p1', name: 'Sketches' }, { id: 'p2', name: 'Final' }];
const box = (id: string, patch: Record<string, unknown> = {}): Record<string, unknown> & {id:string} => ({ id, kind: 'box', x: 0, y: 0, w: 100, h: 40, rot: 0, ...patch });
const rows = () => [box('board', { kind: 'frame', pageId: 'p1' }), box('outer', { kind: 'group', frame: 'board', hidden: true }), box('inner', { kind: 'group', group: 'outer', locked: true }), box('leaf', { group: 'inner', x: 23 }), box('other', { pageId: 'p2' })];
test('nested groups index page, ancestry, flags and descendants once per array revision', () => {
  const source = rows(), index = designHierarchyIndex(source, pages);
  assert.deepEqual(index.findings, []);
  assert.equal(designHierarchyIndex(source, pages), index);
  assert.deepEqual(designHierarchyAncestors(index, 'leaf'), ['inner', 'outer', 'board']);
  assert.deepEqual([...designHierarchyDescendants(index, new Set(['outer']))], ['outer', 'inner', 'leaf']);
  assert.deepEqual(designHierarchyFlags(index, 'leaf'), { hidden: true, locked: true });
  assert.equal(index.pageById.get('leaf'), 'p1');
  assert.deepEqual(designHierarchyPageBoxes(index, 'p2').map(row => row.id), ['other']);
  assert.equal(source[3]!.hidden, undefined);
});
test('validation diagnoses cycles, duplicate identities, dangling pages and cross-page owners', () => {
  assert.ok(validateDesignHierarchy([box('a'), box('a')]).some(f => f.code === 'hierarchy.identity'));
  assert.ok(validateDesignHierarchy([box('a', {kind:'group',group:'b'}),box('b',{kind:'group',group:'a'})]).some(f => f.code === 'hierarchy.cycle'));
  assert.ok(validateDesignHierarchy([box('a',{pageId:'missing'})],pages).some(f => f.code === 'hierarchy.page-missing'));
  assert.ok(validateDesignHierarchy([box('g',{kind:'group',pageId:'p1'}),box('a',{group:'g',pageId:'p2'})],pages).some(f => f.code === 'hierarchy.page-conflict'));
  assert.ok(validateDesignHierarchy([box('g',{kind:'group'}),box('a',{group:'unknown'})]).some(f => f.code === 'hierarchy.group-missing'));
});
test('admission and depth limits fail boundedly', () => {
  assert.equal(validateDesignHierarchy(Array.from({length:20001},(_,n)=>box(String(n))))[0]?.code,'hierarchy.limit');
  assert.equal(validateDesignHierarchy([],Array.from({length:257},(_,n)=>({id:String(n),name:'Page'})))[0]?.code,'hierarchy.limit');
  const chain = Array.from({length:67},(_,n)=>box(String(n),{kind:'group',group:n?String(n-1):''}));
  assert.ok(validateDesignHierarchy(chain).some(f=>f.code==='hierarchy.depth'));
});
test('legacy tag migration adds stable real containers and leaves geometry unchanged', () => {
  const source = [box('a',{group:'tag',frame:'board',x:10}),box('b',{group:'tag',frame:'board',x:150}),box('board',{kind:'frame'})];
  const migrated = migrateDesignHierarchy(source);
  assert.equal(migrateDesignHierarchy(source),migrated);
  assert.deepEqual(migrated.boxes.slice(0,2).map(row=>[row.x,row.y,row.w,row.h]),source.slice(0,2).map(row=>[row.x,row.y,row.w,row.h]));
  assert.equal(migrated.boxes[3]?.kind,'group'); assert.equal(migrated.boxes[3]?.id,'tag');
  assert.equal(migrated.boxes[3]?.frame,'board'); assert.equal(migrated.boxes[0]?.frame,'');
  assert.deepEqual(validateDesignHierarchy(migrated.boxes,migrated.pages),[]);
});
test('legacy tag ID collisions are remapped without reusing an existing layer identity', () => {
  const migrated = migrateDesignHierarchy([box('tag'),box('a',{group:'tag'})]);
  assert.equal(migrated.boxes[0]?.id,'tag'); assert.notEqual(migrated.boxes[1]?.group,'tag');
  assert.deepEqual(validateDesignHierarchy(migrated.boxes),[]);
});
test('reparent carries full subtree to the destination page without moving geometry', () => {
  const source = rows(), moved = reparentDesignHierarchy(source,new Set(['outer']),'','p2',pages);
  for (const id of ['outer','inner','leaf']) assert.equal(moved.find(row=>row.id===id)?.pageId,'p2');
  assert.equal(moved[1]?.frame,''); assert.equal(moved[3]?.x,23);
  assert.throws(()=>reparentDesignHierarchy(source,new Set(['outer']),'inner',undefined,pages),/own subtree/);
});
test('remapping and rotated group bounds preserve ownership and rotation', () => {
  const source = [box('g',{kind:'group',rot:90}),box('a',{group:'g',w:20,h:60,rot:90})];
  const refreshed=refreshDesignGroupBounds(source), index=designHierarchyIndex(refreshed);
  assert.equal(refreshed[0]?.rot,90); assert.ok(Math.abs(Number(refreshed[0]?.w)-20)<1e-8);
  assert.ok(Math.abs(Number(refreshed[0]?.h)-60)<1e-8);
  assert.ok(Math.abs(designHierarchyBounds(index,['a'])!.w-60)<1e-8);
  const copies=remapDesignHierarchy(refreshed,new Map([['g','new-g'],['a','new-a']]));
  assert.equal(copies[1]?.group,'new-g'); assert.equal(copies[1]?.id,'new-a');
});
test('modern solver treats group as one fixed item and carries its nested descendants once', async () => {
  const solve = await loadLayoutKernel();
  const source=[box('root',{kind:'frame',layout:'flex',layoutPadLeft:20,w:400,h:200}),box('g',{kind:'group',layoutOwner:'root',x:100,y:30,w:80,h:50}),box('nested',{kind:'group',group:'g',x:110,y:40,w:20,h:20}),box('leaf',{group:'nested',x:110,y:40,w:20,h:20}),box('sibling',{layoutOwner:'root',w:50})];
  const evaluate=createDesignLayoutEvaluator(solve), result=await evaluate(source);
  assert.deepEqual(result.findings,[]);
  assert.equal(Number(result.boxes[1]?.x),20); assert.equal(Number(result.boxes[3]?.x),30);
  assert.equal(Number(result.boxes[4]?.x),100); assert.equal(result.boxes[3]?.frame,'root');
  const cached=await evaluate(source); assert.equal(cached.solved,0); assert.equal(cached.boxes[3]?.frame,'root');
  assert.equal(source[3]?.x,110);
  assert.ok(validateDesignLayout([box('g',{kind:'group',layoutW:'fill'})]).some(f=>f.code==='layout.group-sizing'));
});
test('Penpot export retains named pages and nested editable groups', () => {
  const source=rows(); source[1]!.hidden=false;
  const doc=boxesToPenpotDoc(source,{name:'Document',canvas:{w:640,h:480},pages});
  assert.deepEqual(doc.pages.map(page=>page.name),['Sketches','Final']);
  const board=doc.pages[0]!.shapes[0]!; assert.equal(board.type,'board');
  if(board.type!=='board') return;
  assert.equal(board.children[0]?.type,'group');
  const g=board.children[0]!; if(g.type!=='group') return; assert.equal(g.children[0]?.type,'group');
  const archive=buildPenpotEntries(doc);
  assert.equal(archive.pageIds.length,2); assert.deepEqual(archive.warnings,[]);
});
test('Penpot group mapping and ownership work without any dynamic layout container', () => {
  const group=nodeToBox(penpotShapeToNode({id:'source-g',type:'group',selrect:{x:10,y:20,width:100,height:40},opacity:.5},{preserveHierarchy:true}),{id:'g'});
  assert.equal(group.kind,'group'); assert.equal(group.opacity,50);
  const imported=importPenpotLayouts([{...group},box('leaf')],['source-g','source-leaf'],{'source-g':{id:'source-g',type:'group',parentId:'00000000-0000-0000-0000-000000000000',shapes:['source-leaf']},'source-leaf':{id:'source-leaf',type:'rect',parentId:'source-g'}});
  assert.deepEqual(imported.findings,[]); assert.equal(imported.boxes[1]?.group,'g');
});
const hookSource=readFileSync(new URL('../community/design/hooks.js',import.meta.url),'utf8');
const compute = new Function('host',`${hookSource}; return compute;`)({});
const model=(boxes:Record<string,unknown>[])=>[{id:'boxes',value:boxes},{id:'pages',value:pages},{id:'background',value:'#ffffff'}];
test('active-page hook projection mounts only that page while keeping all-page Penpot metadata', () => {
  const source=[box('a',{pageId:'p1'}),box('b',{pageId:'p2'}),box('g',{kind:'group',pageId:'p2',locked:true,opacity:100}),box('c',{group:'g',opacity:80})];
  const out=compute(model(source),undefined,undefined,undefined,{pageId:'p2'});
  assert.deepEqual(out.boxHide,['1','','1','']); assert.equal(out.lockAttrs[3],' data-locked="1"');
  assert.match(out.boxStyle[3],/opacity:0\.8/); assert.equal(source[3]!.opacity,80);
  const metadata=JSON.parse(out.penpotDocJson); assert.equal(metadata.boxes.length,4); assert.equal(metadata.pages.length,2);
  const all=compute(model(source)); assert.deepEqual(all.boxHide,['','','1','']);
});
test('off-page artboards and their children are absent from the rendered frame list', () => {
  const source=[box('f1',{kind:'frame',pageId:'p1'}),box('a',{frame:'f1'}),box('f2',{kind:'frame',pageId:'p2'}),box('b',{frame:'f2'})];
  const out=compute(model(source),undefined,undefined,undefined,{pageId:'p2'});
  assert.deepEqual(out.frameGroups.map((frame:{frameId:string})=>frame.frameId),['f2']);
  assert.equal(out.frameGroups[0].children[0].flatIndex,3); assert.equal(out.pasteboard.length,0);
  assert.equal(JSON.parse(out.penpotDocJson).boxes.length,4);
});
test('detached full render gives overlapping loose pages independent export surfaces in page order', () => {
  const source=[box('a',{pageId:'p1',x:20}),box('b',{pageId:'p2',x:20})];
  const out=compute(model(source));
  assert.equal(out.frameGroups.length,2);
  assert.deepEqual(out.frameGroups.map((frame:{children:{id:string}[]})=>frame.children.map(row=>row.id)),[['a'],['b']]);
  assert.deepEqual(out.pasteboard,[]);
  assert.equal(source[0]!.frame,undefined);
});

test('collective group opacity refuses leaf alpha approximation', () => {
  assert.throws(() => compute(model([box('g',{kind:'group',pageId:'p1',opacity:50}),box('a',{group:'g'}),box('b',{group:'g'})])), /composited image/);
});
test('legacy tags across artboards remain readable and report conversion issues without changing clipping', () => {
  const source=[box('f1',{kind:'frame'}),box('f2',{kind:'frame'}),box('a',{group:'old-tag',frame:'f1'}),box('b',{group:'old-tag',frame:'f2'})];
  const migration=migrateDesignHierarchy(source);
  assert.equal(migration.boxes,source); assert.equal(migration.findings[0]?.code,'hierarchy.legacy-group-scope');
  assert.equal(migration.boxes[2]?.frame,'f1'); assert.equal(migration.boxes[3]?.frame,'f2');
});
test('group render order keeps nested leaves contiguous with stable source indices', () => {
  const source=[box('a',{group:'g'}),box('b'),box('c',{group:'g'}),box('g',{kind:'group'})];
  const out=compute([{id:'boxes',value:source}]);
  assert.deepEqual(out.renderBoxes.map((row:{flatIndex:number})=>row.flatIndex),[1,3,0,2]);
});
test('native Penpot hierarchy export refuses its shape ceiling rather than dropping a subtree', () => {
  assert.throws(()=>boxesToPenpotDoc(Array.from({length:6000},(_,n)=>box(String(n),{pageId:'p1'})),{name:'Large',canvas:{w:640,h:480},pages}),/6,000 layers/);
});

test('canonical page metadata retains hidden static layers for native archive round trips', () => {
  const out=compute(model([box('hidden',{pageId:'p2',hidden:true})]));
  assert.equal(JSON.parse(out.penpotDocJson).boxes[0]?.id,'hidden');
});

test('unsafe legacy migration is atomic and preserves dynamic layout ownership', () => {
  const mixed=[box('f1',{kind:'frame'}),box('f2',{kind:'frame'}),box('a',{group:'unsafe',frame:'f1'}),box('b',{group:'unsafe',frame:'f2'}),box('safe',{group:'convertible',frame:'f1'})];
  const result=migrateDesignHierarchy(mixed); assert.equal(result.boxes,mixed);
  assert.equal(designHierarchyIndex(result.boxes).findings.length,0);
  const layout=[box('owner',{layout:'flex'}),box('child',{group:'old',layoutOwner:'owner'})];
  const refused=migrateDesignHierarchy(layout); assert.equal(refused.boxes,layout);
  assert.equal(refused.boxes[1]?.layoutOwner,'owner'); assert.equal(refused.findings[0]?.code,'hierarchy.legacy-group-scope');
});

test('all-page deck lowering keeps editor page order ahead of local artboard order', () => {
  const source=[box('f1',{kind:'frame',pageId:'p1',order:99,bg:'#112233'}),box('f2',{kind:'frame',pageId:'p2',order:0,bg:'#445566'})];
  const out=compute(model(source));
  assert.deepEqual(out.frameGroups.map((frame:{frameId:string})=>frame.frameId),['f1','f2']);
  assert.deepEqual(JSON.parse(out.deckJson).slides.map((slide:{bg:string})=>slide.bg),['#112233','#445566']);
});

test('migrated groups keep their top-member paint slot without changing leaf indices', () => {
  const source=[box('a',{group:'old'}),box('b',{group:'old'}),box('later')];
  const migrated=migrateDesignHierarchy(source);
  assert.deepEqual(migrated.boxes.slice(0,3).map(row=>row.id),['a','b','later']);
  const painted=compute([{id:'boxes',value:migrated.boxes}]);
  assert.deepEqual(painted.renderBoxes.filter((row:{id:string})=>row.id!=='old').map((row:{id:string})=>row.id),['a','b','later']);
  assert.deepEqual(designHierarchyIndex(migrated.boxes).rootsByPage.get('page-1'),['old','later']);
  const doc=boxesToPenpotDoc(migrated.boxes,{name:'Legacy stack',canvas:{w:640,h:480}});
  assert.deepEqual(doc.pages[0]!.shapes[0]!.type==='board' ? doc.pages[0]!.shapes[0]!.children.map(row=>row.sourceId) : [],['old','later']);
});
test('interleaved legacy tags keep original independent paint order and report atomic conversion refusal', () => {
  const source=[box('a',{group:'old'}),box('between'),box('b',{group:'old'})];
  const migrated=migrateDesignHierarchy(source); assert.equal(migrated.boxes,source);
  assert.match(migrated.findings[0]!.message,/interleaves/);
  const painted=compute([{id:'boxes',value:migrated.boxes}]);
  assert.deepEqual(painted.renderBoxes.map((row:{id:string})=>row.id),['a','between','b']);
});
