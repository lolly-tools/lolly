import { chromium } from 'playwright';
import { build } from 'esbuild';
const bundle = async () => (await build({
  stdin: { contents: `import { renderSvgFromHtml } from '/Users/andy/Build/lolly/shells/web/src/bridge/export.ts';
                      window.__render = renderSvgFromHtml;`,
           resolveDir: '/Users/andy/Build/lolly/shells/web/src/bridge', loader: 'ts' },
  bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent',
})).outputFiles[0].text;
const code = await bundle();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.addInitScript(() => { try{['lolly-welcome-dismissed','lolly-tips-dismissed','lolly-privacy-ack','lolly-capture-neutral'].forEach(k=>localStorage.setItem(k,'1'));}catch(_){} });
await p.goto('http://localhost:5173/#/', { waitUntil: 'networkidle' });
await p.waitForTimeout(4000);
await p.addScriptTag({ content: code });
console.log(JSON.stringify(await p.evaluate(async () => {
  const root = document.querySelector('.gallery-view') || document.body;
  const blob = await window.__render(root, { convertPaths: false });
  const svg = await blob.text();
  const imgs = [...svg.matchAll(/<image[^>]*>/g)].map(m => (m[0].match(/\b(?:x|y|width|height)="[\d.]+"/g)||[]).join(' '));
  return { bytes: svg.length, images: imgs.length, geom: imgs.slice(0, 8) };
}), null, 1));
await b.close();
