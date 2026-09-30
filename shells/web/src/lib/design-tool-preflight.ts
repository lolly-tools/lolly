// SPDX-License-Identifier: MPL-2.0
import { loadTool } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { CompiledDesignTool } from '../../../../engine/src/design-tool/compiler.ts';
import { createToolRuntime } from './mount-runtime.ts';
import { checkTextLayout } from './text-layout-check.ts';
import { DesignPreparationError } from './design-tool-compile.ts';
import { scopeCss } from './scope-css.ts';

/** Every authored choice combination is measured through the recipient runtime. */
export async function preflightDesignTool(compiled: CompiledDesignTool, host: HostV1, options: {signal?: AbortSignal; checkInputs?: boolean; progress?(current: number, total: number): void} = {}): Promise<{thumbnail: string; combinations: number}> {
  const tool = await loadTool(compiled.manifest.id, async path => {
    const value = compiled.files[path.slice(compiled.manifest.id.length + 1)];
    if (value === undefined) throw new Error(`Missing file: ${path}`);
    return typeof value === 'string' ? value : new TextDecoder().decode(value);
  }, { trustClass: 'sideloaded-consented' });
  options.signal?.throwIfAborted();
  const runtime = await createToolRuntime(tool, host);
  const stage = document.createElement('div');
  stage.id = `rules-check-${crypto.randomUUID()}`;
  stage.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;';
  stage.setAttribute('aria-hidden', 'true');
  document.body.append(stage);
  try {
    if (runtime.hookErrors.length) throw new Error(runtime.hookErrors.map(e => e.message).join('\n'));
    let combinations: Array<Record<string, import('../../../../engine/src/inputs.ts').InputValue>> = [{}];
    for (const choice of tool.manifest.designTool!.choices) combinations = combinations.flatMap(values => choice.options.map(option => ({ ...values, [choice.inputId]: option.value })));
    if(tool.manifest.designTool!.sourceTool || options.checkInputs) {
      for(const input of tool.manifest.inputs) {
        const options=input.type==='select'?input.options?.map(o=>o.value):input.type==='boolean'?[true,false]:undefined;
        if(options)combinations=combinations.flatMap(values=>options.map(value=>({...values,[input.id]:value})));
        if(combinations.length>64)throw new Error('Keep up to 64 combinations of editable choices. Make some choices fixed or remove options.');
      }
    }
    let thumbnail = ""; let current = 0;
    for (const values of combinations) {
      options.signal?.throwIfAborted();
      options.progress?.(++current, combinations.length);
      await runtime.applyPatch(values);
      stage.innerHTML = `<style>${scopeCss(tool.styles || '', `#${stage.id}`)}</style>${runtime.getHydrated()}`;
      stage.getBoundingClientRect();
      if (tool.manifest.designTool!.sourceTool) assertSessionDependencies(stage);
      const sourceError=stage.querySelector('[data-source-tool-error]')?.textContent?.trim();if(sourceError)throw new Error(sourceError);
      const result = await checkTextLayout(stage, host.text);
      if (!result.ok) { const box = stage.querySelector<HTMLElement>('[data-fit-status="overflow"], [data-image-status="error"]'); throw new DesignPreparationError(`${Object.entries(values).map(([id,value]) => `${id}: ${value}`).join(', ')}${Object.keys(values).length ? '\n' : ''}${result.issues.join('\n')}`, box?.dataset.designLayer, box?.dataset.publicInput); }
      if (!thumbnail) { const artboard = stage.querySelector<HTMLElement>('.lolly-locked-design')!; const blob = await host.export.render(artboard,'png',{width:512,height:512*Number(artboard.dataset.designHeight)/Number(artboard.dataset.designWidth),watermark:false}); thumbnail = await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload=()=>resolve(String(reader.result)); reader.onerror=()=>reject(reader.error); reader.readAsDataURL(blob); }); }
      for (const image of stage.querySelectorAll('img')) {
        await image.decode().catch(() => { throw new Error('A packaged image could not be decoded.'); });
      }
    }
    options.signal?.throwIfAborted();
    return {thumbnail, combinations:combinations.length};
  } finally { runtime.destroy(); stage.remove(); }
}

/** A small option preview is rendered from the same compiled tool as the reader. */
export async function captureDesignOption(draft: import('@lolly-tools/core/design-tool-v1').DesignToolDraftV1, values: Record<string,string>, canvas: HTMLElement, host: HostV1): Promise<string> {
  const {prepareDesignTool} = await import('./design-tool-compile.ts');
  const compiled = await prepareDesignTool(draft,canvas,host,{preview:true});
  const tool = await loadTool(compiled.manifest.id,async path => {
    const value = compiled.files[path.slice(compiled.manifest.id.length + 1)];
    if (value === undefined) throw new Error(`Missing file: ${path}`);
    return typeof value === 'string' ? value : new TextDecoder().decode(value);
  },{trustClass:'sideloaded-consented'});
  const runtime = await createToolRuntime(tool,host,values);
  const stage = document.createElement('div'); stage.id = `rules-thumb-${crypto.randomUUID()}`;
  stage.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;'; stage.setAttribute('aria-hidden','true');
  document.body.append(stage);
  try {
    stage.innerHTML = `<style>${scopeCss(tool.styles || '',`#${stage.id}`)}</style>${runtime.getHydrated()}`;
    const check = await checkTextLayout(stage, host.text); if (!check.ok) throw new Error(check.issues.join('\n'));
    const artboard = stage.querySelector<HTMLElement>('.lolly-locked-design')!;
    const ratio = Number(artboard.dataset.designHeight) / Number(artboard.dataset.designWidth);
    const blob = await host.export.render(artboard,'png',{width:512,height:512*ratio,watermark:false});
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192));
    return `data:image/png;base64,${btoa(binary)}`;
  } finally { runtime.destroy(); stage.remove(); }
}

/** A source renderer must not fetch artwork or styles from its creator's catalog. */
function assertSessionDependencies(stage:HTMLElement):void {
  const allowed=(url:string):boolean=>/^(data:|#)/i.test(url.trim());
  for(const node of stage.querySelectorAll('img, image, use, video, audio, source, iframe, object, link')) {
    for(const name of ['src','srcset','href','xlink:href','data','poster']) {
      const url=node.getAttribute(name);
      if(url&&!allowed(url))throw new Error('A linked image or style is not included in the tool. Embed it in the source before sharing.');
    }
  }
  const styles=[...stage.querySelectorAll('style')].map(node=>node.textContent||'').concat([...stage.querySelectorAll('[style]')].map(node=>node.getAttribute('style')||''));
  for(const css of styles) {
    if(/@import\b/i.test(css))throw new Error('Include imported styles in the source before sharing.');
    for(const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g))if(!allowed(match[1]!))throw new Error('A style still links to an unpackaged asset. Embed it before sharing.');
  }
}
