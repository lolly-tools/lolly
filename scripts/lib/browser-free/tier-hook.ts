// SPDX-License-Identifier: MPL-2.0
/**
 * The measuring hook `scripts/tool-browser-free.ts` loads into a CLI process with
 * `--import`. It changes no drawing. It only:
 *
 *   - with BROWSER_FREE_TIER=B, makes `eligibleForResvgPng` answer false, so the CLI's own
 *     fall-through sends the same request to the browser tier;
 *   - with BROWSER_FREE_ALL=1, admits every tool by its manifest (`toolAdmission`), so each
 *     case the per-render checks admit is drawn and compared, whatever the tool's flag says;
 *   - logs which tier wrote the file (`BROWSER_FREE tierA` or `BROWSER_FREE tierB`);
 *   - with BROWSER_FREE_SVG_OUT set, writes the SVG resvg was handed and its placement;
 *   - with BROWSER_FREE_TAG_TEXT=1, tags each text run the CLI outlines, so the comparator
 *     can find the words (the tag is an inert attribute; the pixels do not change).
 *
 * Never loaded by the shells themselves.
 */
import { registerHooks } from 'node:module';

const RASTER = '/packages/node-shell/src/raster.ts';
const ADMISSION = '/packages/node-shell/src/resvg-admission.ts';
const WEBSHELL = '/packages/node-shell/src/webshell-render.ts';
const OUTLINE = '/shells/cli/src/svg-outline.ts';

function wrap(src: string, name: string, wrapper: string): string {
  const head = `export function ${name}(`;
  const asyncHead = `export async function ${name}(`;
  if (src.includes(asyncHead)) return src.replace(asyncHead, `${wrapper}\nasync function __measured_${name}(`);
  if (src.includes(head)) return src.replace(head, `${wrapper}\nfunction __measured_${name}(`);
  throw new Error(`browser-free measuring hook: ${name} not found`);
}

registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (!url.startsWith('file:')) return loaded;
    const which = [RASTER, ADMISSION, WEBSHELL, OUTLINE].find((end) => url.endsWith(end));
    if (!which) return loaded;
    let src = typeof loaded.source === 'string' ? loaded.source : Buffer.from(loaded.source as Uint8Array).toString('utf8');
    if (which === OUTLINE) {
      if (process.env.BROWSER_FREE_TAG_TEXT !== '1') return loaded;
      const anchor = '    el.replaceWith(path);';
      if (!src.includes(anchor)) throw new Error('browser-free measuring hook: outline anchor not found');
      src = src.replace(anchor, `    path.setAttribute('data-measure-text', raw.slice(0, 80));\n${anchor}`);
    } else if (which === ADMISSION) {
      src = wrap(src, 'toolAdmission', `export function toolAdmission(...a) { const r = __measured_toolAdmission(...a); return process.env.BROWSER_FREE_ALL === '1' && !r.untrusted ? { ...r, browserFree: true } : r; }`);
    } else if (which === RASTER) {
      src = wrap(src, 'eligibleForResvgPng', `export function eligibleForResvgPng(...a) { if (process.env.BROWSER_FREE_TIER === 'B') return false; return __measured_eligibleForResvgPng(...a); }`);
      src = wrap(src, 'rasterizeTierAPng', `export async function rasterizeTierAPng(svg, ...a) { process.stderr.write('BROWSER_FREE tierA\\n'); const out = process.env.BROWSER_FREE_SVG_OUT; if (out) { const fs = await import('node:fs'); fs.writeFileSync(out, svg); fs.writeFileSync(out + '.placement.json', JSON.stringify(a[2]?.placement ?? { kind: 'fill' })); } return __measured_rasterizeTierAPng(svg, ...a); }`);
    } else {
      src = wrap(src, 'renderViaWebShell', `export async function renderViaWebShell(...a) { process.stderr.write('BROWSER_FREE tierB\\n'); return __measured_renderViaWebShell(...a); }`);
    }
    return { ...loaded, source: src };
  },
});
