import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const SKIP=new Set(['node_modules','dist','build','coverage','tools','catalog','target']);
function walk(dir,out,depth=0){
  let names; try{names=readdirSync(dir)}catch{return}
  for(const n of names){
    if(n.startsWith('.')||SKIP.has(n))continue;
    const abs=join(dir,n); let st; try{st=statSync(abs)}catch{continue}
    if(st.isDirectory())walk(abs,out,depth+1); else if(n.endsWith('.json'))out.push(abs);
  }
}
for (const sub of ['shells/tauri-desktop/flatpak','shells/tauri-desktop','shells','docs','engine','.']) {
  const t=Date.now(); const out=[]; walk(sub,out);
  console.log(`${sub.padEnd(34)} ${String(out.length).padStart(6)} json  ${Date.now()-t}ms`);
}
