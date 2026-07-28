import { readFileSync } from 'node:fs';
import { parseIccProfile, iccGamutIntent } from './engine/src/index.ts';

for (const f of ['/tmp/sRGB2014.icc', '/tmp/app.icc', '/tmp/dispclass.icc']) {
  const bytes = new Uint8Array(readFileSync(f));
  const p = parseIccProfile(bytes);
  if (!p) { console.log(`${f}: UNREADABLE`); continue; }
  const intents = (['perceptual', 'relative', 'saturation', 'absolute'] as const).filter(i => iccGamutIntent(p, i));
  console.log(`${f} (${bytes.length} B)\n  class=${p.deviceClass} space=${p.dataColourSpace} n=${p.nChannels} v=${p.version} desc=${JSON.stringify(p.description)}\n  gamut intents=[${intents.join(',')}] -> ${intents.length ? 'MOUNTS' : 'refused'}`);
}
