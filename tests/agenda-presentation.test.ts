// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';
import type { ExportOpts } from '../packages/core/src/host-v1.ts';
const shared = await readFile(new URL('../community/_shared/agenda.js',import.meta.url),'utf8');
const clock: any = vm.createContext({Intl,Date}); vm.runInContext(shared,clock);
const fetchFile = (path: string) => readFile(new URL('../community/'+path,import.meta.url),'utf8');
const tool = await loadTool('agenda',fetchFile);
const columns=['Date','Start','End','Title','Speaker','Track','Room','Kind','Note','Session ID'];
async function runtime(rows: string[][], extra: Record<string,unknown>={}) {
  return createRuntime(tool,baseHost(),{sessions:{columns,rows},...extra});
}
const row=['2026-10-14','10:00','11:00','Full title','Speaker','Design','Hall A','session','','stable-id'];
function doc(r: any) { const html=r.getHydrated(); return JSON.parse(/data-ag-document>([\s\S]*?)<\/script>/.exec(html)![1]!); }
test('zone conversion rejects gaps and repeated wall times, and uses event zone',()=>{
 assert.match(clock.agInstant('2026-03-29',90,'Europe/London').error,/does not exist/);
 assert.match(clock.agInstant('2026-10-25',90,'Europe/London').error,/Ambiguous/);
 assert.equal(clock.agInstant('2026-10-14',600,'Europe/London').ms,Date.parse('2026-10-14T09:00Z'));
 assert.match(clock.agInstant('2026-10-14',600,'Mars/Olympus').error,/Unknown/);
});
test('pan holds both ends and scene seeking is independent of previous frames',()=>{
 assert.equal(clock.agPan(1,100,25,2),0);assert.equal(clock.agPan(4,100,25,2),-50);assert.equal(clock.agPan(9,100,25,2),-100);
 const scenes=[{duration:10},{duration:30}];assert.equal(clock.agSceneAt(scenes,39).index,1);assert.equal(clock.agSceneAt(scenes,3).local,3);assert.equal(clock.agSceneAt(scenes,43).local,3);
});
test('all simultaneous ongoing and next sessions are retained',()=>{
 const s=[{id:1,track:'A',startMs:0,endMs:10},{id:2,track:'A',startMs:1,endMs:9},{id:3,track:'A',startMs:11,endMs:20},{id:4,track:'A',startMs:11,endMs:19}];
 const result=clock.agNow(s,5,'track');assert.equal(result[0].now.length,2);assert.equal(result[0].next.length,2);
});
test('invalid dates and times remain visible and carry actionable diagnostics',async()=>{
 const r=await runtime([['2026-02-30','25:01','09:00','Invalid','','','','','','bad']]);const d=doc(r);assert.equal(d.sessions.length,1);assert.equal(d.sessions[0].valid,false);assert.ok(d.diagnostics.some((v:any)=>/Invalid date/.test(v.message)));
});
test('session identity and safe data islands survive changed titles',async()=>{
 const a=doc(await runtime([row]));const edited=[...row];edited[3]='Changed </script><img onerror=bad()>';
 const b=doc(await runtime([edited]));assert.equal(a.sessions[0].id,b.sessions[0].id);assert.equal(b.sessions[0].title,edited[3]);
 assert.equal(clock.agCalendar(a.sessions,'A').match(/UID:.*/)[0],clock.agCalendar(b.sessions,'B').match(/UID:.*/)[0]);
});
test('calendar text folds by UTF-8 bytes and midnight end becomes next day',async()=>{
 const input=[...row];input[1]='23:00';input[2]='24:00';input[3]='🦎'.repeat(80);const d=doc(await runtime([input],{tz:'Europe/London'}));const ics=clock.agCalendar(d.sessions,'Event');assert.match(ics,/DTEND:20261014T230000Z/);for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
});
test('calendar creation time is explicit while event identity stays stable',async()=>{
 const d=doc(await runtime([row]));
 const ics=clock.agCalendar(d.sessions,'Event',Date.parse('2026-09-19T14:05:06Z'));
 assert.match(ics,/DTSTAMP:20260919T140506Z/);
 assert.match(ics,/UID:stable-id@lolly.tools/);
});

test('a legacy table gains persistent identities on its first edit',async()=>{
 const old={columns:columns.slice(0,9),rows:[row.slice(0,9)]};
 const r=await createRuntime(tool,baseHost(),{sessions:old});
 await r.setInput('sessions',old);
 const stored=r.getModel().find(i=>i.id==='sessions')!.value as {columns:string[];rows:string[][]};
 assert.equal(stored.columns.at(-1),'Session ID');
 const id=stored.rows[0]!.at(-1);assert.ok(id);
 const edited=structuredClone(stored);edited.rows[0]![3]='A new title';await r.setInput('sessions',edited);
 assert.equal(doc(r).sessions[0].id,id);
});
test('unknown zones are visible without passing an invalid zone to the browser clock',async()=>{
 const d=doc(await runtime([row],{tz:'Mars/Olympus'}));assert.equal(d.tz,'');assert.match(d.zoneWarning,/Unknown/);assert.equal(d.sessions[0].valid,false);
});
test('reordered headings never let missing optional columns steal a named column',async()=>{
 const r=await createRuntime(tool,baseHost(),{sessions:{columns:['Title','Room','Start','Date','End','Extra'],rows:[['Night programme','Hall','23:00','2026-10-14','24:00','keep']]}});
 const s=doc(r).sessions[0];assert.equal(s.title,'Night programme');assert.equal(s.room,'Hall');assert.equal(s.valid,true);assert.equal(s.speaker,'');
});
test('overnight dates and calendar event identities survive revisions',async()=>{
 const values={columns:[...columns,'End date'],rows:[[...row.slice(0,1),'23:30','01:00',...row.slice(3),'2026-10-15']]};
 const r=await createRuntime(tool,baseHost(),{sessions:values,eventId:'event-one',tz:'Europe/London'});
 const s=doc(r).sessions[0];assert.equal(s.valid,true);assert.equal(s.endMs-s.startMs,90*60000);
 const one=clock.agCalendar([s],'Event');assert.match(one,/UID:event-one\/stable-id@lolly.tools/);
 s.eventId='event-two';assert.notEqual(clock.agCalendar([s],'Event').match(/UID:.*/)[0],one.match(/UID:.*/)[0]);
});
test('cancelled sessions stay in calendar revisions and leave live now/next',async()=>{
 const s={id:'a',eventId:'event',title:'Cancelled',valid:true,status:'cancelled',track:'A',startMs:0,endMs:100};
 assert.equal(clock.agNow([s],50,'track').length,0);assert.match(clock.agCalendar([s],'Event'),/STATUS:CANCELLED/);
});
test('duplicate explicit IDs are diagnosed rather than silently replaced',async()=>{
 const r=await runtime([row,[...row]]);await r.setInput('sessions',{columns,rows:[row,[...row]]});
 assert.ok(doc(r).diagnostics.some((d:any)=>d.message==='Duplicate Session ID'));
});

// Export validation uses the current input snapshot even after an invalid revision.
test('normal exports validate the current programme and recover after a correction',async()=>{
 const host=baseHost({export:{}}); let called=0;host.export.render=async()=>{called++;return new Blob(['ok']);};
 const r=await createRuntime(tool,host,{sessions:{columns,rows:[row]}});
 await r.export({} as Element,'zip');assert.equal(called,1);
 await r.setInput('sessions',{columns,rows:[['2026-02-30',...row.slice(1)]]});
 await assert.rejects(r.export({} as Element,'zip'),/Fix the date/);assert.equal(called,1);
 await r.setInput('sessions',{columns,rows:[row]});await r.export({} as Element,'zip');assert.equal(called,2);
});


test('a render language override reaches hook copy and portable output without changing the profile',async()=>{
 let exportedLang='';
 const host=baseHost({export:{render:async(_node:unknown,_format:string,opts?:ExportOpts)=>{exportedLang=opts?.portableDocument?.lang ?? '';return new Blob(['page']);},download:async()=>{}}});
 const translated=await loadTool('agenda',path=>readFile(new URL('../community/'+path,import.meta.url),'utf8'),{lang:'es'});
 const r=await createRuntime(translated,host,{now:'2026-10-14T09:30'});
 assert.equal(doc(r).lang,'es');
 await r.setInput('title','Evento');
 assert.equal(doc(r).lang,'es');
 await r.export({},'html');
 assert.equal(exportedLang,'es');
 assert.notEqual((await host.profile.get()).lang,'es');
});

// The motion presets: every part settles before the thumbnail frame (2 s), cards
// arrive after the heading, a preset with an exit is gone at the scene's end so a
// loop meets its own start, and Still never moves.
const presentation = await readFile(new URL('../community/agenda/presentation.js', import.meta.url), 'utf8');
const motionSource = presentation.slice(presentation.indexOf('var AG_MOTIONS'), presentation.indexOf('// === lolly:shared backdrop-shaders'));
const motion: any = vm.createContext({ Math }); vm.runInContext(motionSource, motion);
test('motion presets settle, stagger and leave at the loop point', () => {
  const presets = Object.keys(motion.AG_MOTIONS);
  assert.deepEqual(presets, ['calm', 'editorial', 'expressive', 'broadcast', 'cascade', 'slide']);
  const manifest = JSON.parse(readFileSync(new URL('../community/agenda/tool.json', import.meta.url), 'utf8'));
  const options = manifest.inputs.find((i: any) => i.id === 'motion').options.map((o: any) => o.value);
  assert.deepEqual([...options].sort(), ['off', ...presets].sort(), 'every preset is offered, and nothing else');
  for (const preset of presets) {
    for (const part of [-1, 0, 1, 2, 3, 4]) {
      const pose = motion.agMotionPose(preset, 2, 12, part, 3);
      assert.deepEqual([pose.opacity, Math.round(pose.x * 1e6) || 0, Math.round(pose.y * 1e6) || 0, pose.scale, pose.clip], [1, 0, 0, 1, 1], `${preset} part ${part} settled at 2 s`);
    }
    const early = (part: number) => motion.agMotionPose(preset, 0.1, 12, part, 3);
    assert.ok(early(3).opacity <= early(0).opacity, `${preset}: a later card is no further along than the heading`);
    const m = motion.AG_MOTIONS[preset];
    if (m.exit) {
      const end = motion.agMotionPose(preset, 12, 12, m.carousel ? -1 : 1, 3);
      assert.equal(end.opacity, 0, `${preset} has left by the end of its scene`);
    }
  }
  assert.deepEqual({ ...motion.agMotionPose('off', 0, 12, 0, 3) }, { opacity: 1, x: 0, y: 0, scale: 1, clip: 1 });
});
