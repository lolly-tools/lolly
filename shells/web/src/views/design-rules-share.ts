// SPDX-License-Identifier: MPL-2.0
import { validateDesignTool, type DesignToolDraftV1, type DesignToolFindingV1 } from '@lolly-tools/core/design-tool-v1';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import { mountModal } from '../components/modal.ts';
import { DesignSourceReviewError } from '../lib/design-tool-source.ts';
import { prepareDesignTool, designToolRights, DesignPreparationError } from '../lib/design-tool-compile.ts';
import { preflightDesignTool } from '../lib/design-tool-preflight.ts';
import { getDesignPublication, restoreDesignPublication, compiledDesignDigest, nextDesignVersion } from '../lib/design-tool-publication.ts';
import { buildLollyFile, readLollyFile } from '../lib/lolly-pack.ts';
import { lollyBytesLabel } from '../lib/lolly-intake.ts';
import { escape as e } from '../utils.ts';
import { t } from '../i18n.ts';

/** Preflight owns cancellation and publication identity, separate from rule edits. */
export function createRulesShare(opts: {
  runtime: Runtime; host: HostV1; canvas: HTMLElement; draft(): DesignToolDraftV1;
  saveMaster(): void; checkSource(): void; commit(draft: DesignToolDraftV1): void;
  repair(issue: DesignToolFindingV1): void; status(message: string): void;
  rights?():Promise<Array<{id:string;name:string;reason:string}>>;
  prepare?(draft:DesignToolDraftV1,options:{include:ReadonlySet<string>;signal:AbortSignal}):Promise<import('../../../../engine/src/design-tool/compiler.ts').CompiledDesignTool>;
}) {
  let cached: {digest: string; blob: Blob; filename: string} | undefined;
  let active: ReturnType<typeof mountModal> | undefined;
  const open = (): void => {
    if (active?.el.isConnected) return;
    const candidate = structuredClone(opts.draft());
    const abort = new AbortController();
    let checking = false; let ready: typeof cached; let dirty = true; let issues: DesignToolFindingV1[] = [];
    const included = new Set<string>();
    const modal = mountModal(`<header><h2>${t('Share your design with your rules')}</h2><p>${t('One portable tool. Only the inputs you choose can be edited.')}</p></header><label class="dr-field">${t('Tool name')}<input class="field-input" data-name value="${e(candidate.name)}"></label><label class="dr-field">${t('Instructions for recipients')}<textarea class="field-input" data-description maxlength="2000" rows="2">${e(candidate.description || '')}</textarea></label><div class="dr-share-overview"><img data-artwork hidden alt="${t('Tool preview')}"><div><p data-package-details></p><ol class="dr-share-fields">${candidate.inputs.map(f => `<li>${e(String(f.input.label || f.input.id))}</li>`).join('')}</ol></div></div><fieldset class="dr-axis"><legend>${t('People can export')}</legend><div class="dr-row-actions">${(['png','svg','pdf'] as const).map(format => `<label class="dr-check"><input type="checkbox" data-output="${format}"${candidate.formats.includes(format) ? ' checked' : ''}>${format.toUpperCase()}</label>`).join('')}</div></fieldset><div data-inclusion></div><div data-issues></div><p class="dr-share-status" role="status" aria-live="polite">${t('Review the preview and fields, then check the file.')}</p><footer><button class="btn" data-cancel>${t('Back')}</button><button class="btn" data-check>${t('Check file')}</button><button class="btn btn--primary" data-download>${t('Download .lolly')}</button><button class="btn" data-save-master hidden>${t(candidate.sourceTool ? 'Save authoring session' : 'Save Design master')}</button><button class="btn btn--primary" data-try hidden>${t('Try downloaded file')}</button></footer>`, {className:'modal dr-share',ariaLabel:t('Share tool'),onClose() {abort.abort(); active = undefined;}});
    active = modal;
    const message = modal.el.querySelector<HTMLElement>('.dr-share-status')!;
    const details = modal.el.querySelector<HTMLElement>('[data-package-details]')!;
    const download = modal.el.querySelector<HTMLButtonElement>('[data-download]')!;
    const check = modal.el.querySelector<HTMLButtonElement>('[data-check]')!;
    const trial = modal.el.querySelector<HTMLButtonElement>('[data-try]')!;
    const artwork = modal.el.querySelector<HTMLImageElement>('[data-artwork]')!;
    details.textContent = t('Version {version} · {n} layouts', {version:candidate.version,n:candidate.variants.length});
    const paintIssues = (): void => {
      const container = modal.el.querySelector('[data-issues]')!; container.replaceChildren();
      for (const issue of issues) {
        const row = document.createElement('div'); row.className = 'dr-issue';
        const text = document.createElement('p'); text.textContent = issue.message;
        const repair = document.createElement('button'); repair.className = 'btn btn--sm'; repair.textContent = t(issue.code === 'source-review' ? 'Compare with source' : /font/i.test(issue.message) ? 'Review font' : issue.layerId ? 'Review object' : 'Review rule');
        repair.addEventListener('click', () => { opts.commit(candidate); modal.close(); opts.repair(issue); }); row.append(text,repair); container.append(row);
      }
    };
    const prepare = async (): Promise<boolean> => {
      if (checking) return false;
      if (!dirty && ready) return true;
      checking = true; check.disabled = download.disabled = true;
      try {
        candidate.name = modal.el.querySelector<HTMLInputElement>('[data-name]')!.value.trim();
        candidate.description = modal.el.querySelector<HTMLTextAreaElement>('[data-description]')!.value.trim();
        issues = validateDesignTool(candidate); paintIssues();
        if (issues.length) { message.textContent = t('{n} issues to review before sharing.',{n:issues.length}); return false; }
        opts.checkSource(); message.textContent = t('Preparing fonts and images…');
        const previous = getDesignPublication(opts.runtime);
        candidate.version = previous?.version || candidate.version;
        const compile=(draft:DesignToolDraftV1)=>opts.prepare?opts.prepare(draft,{include:included,signal:abort.signal}):prepareDesignTool(draft,opts.canvas,opts.host,{include:included,signal:abort.signal});
        let compiled = await compile(candidate);
        let digest = await compiledDesignDigest(compiled);
        if (previous && previous.digest !== digest) {
          candidate.version = nextDesignVersion(previous.version);
          compiled = await compile(candidate);
          digest = await compiledDesignDigest(compiled);
        }
        const report = await preflightDesignTool(compiled,opts.host,{signal:abort.signal,progress(current,total) {message.textContent = t('Checking layout {current} of {total}…',{current,total});}});
        abort.signal.throwIfAborted(); artwork.src = report.thumbnail; artwork.hidden = false;
        if (cached?.digest === digest) ready = cached;
        else {
          const files = Object.fromEntries(Object.entries(compiled.files).map(([key,value])=>[key,typeof value === 'string' ? new TextEncoder().encode(value) : value]));
          const result = await buildLollyFile({kind:'tool',session:null,toolId:candidate.id,toolVersion:candidate.version,name:`${candidate.name}-${candidate.version}`,userAssets:[],toolCredits:JSON.parse(String(compiled.files['compilation.json'])).dependencies.map((d:{credit?:string})=>d.credit).filter(Boolean).join('\n\n'),tool:{id:candidate.id,version:candidate.version,trust:'custom',files}});
          await readLollyFile(new Uint8Array(await result.blob.arrayBuffer()));
          ready = {digest,blob:result.blob,filename:result.filename};
        }
        abort.signal.throwIfAborted();
        details.textContent = `v${candidate.version} · ${lollyBytesLabel(ready.blob.size)} · ${candidate.variants.length} ${t(candidate.variants.length === 1 ? 'layout' : 'layouts')}`;
        message.textContent = t('Layout checks passed ({n}). The file is ready.',{n:report.combinations}); dirty = false; return true;
      } catch (error) {
        if (abort.signal.aborted) return false;
        issues = [{code:error instanceof DesignSourceReviewError ? 'source-review' : 'preflight',message:(error as Error).message,...(error instanceof DesignPreparationError ? {inputId:error.inputId,layerId:error.layerId} : {})}]; paintIssues(); message.textContent = t('Review this issue, then check the file again.'); return false;
      } finally {checking = false; check.disabled = download.disabled = false;}
    };
    modal.el.addEventListener('change', event => {
      const target = event.target as HTMLInputElement;
      if (target.dataset.output) candidate.formats = [...modal.el.querySelectorAll<HTMLInputElement>('[data-output]:checked')].map(el => el.dataset.output as 'png'|'svg'|'pdf');
      dirty = true; ready = undefined; trial.hidden = true; check.hidden = false; download.classList.add('btn--primary');
    });
    modal.el.querySelector('[data-cancel]')!.addEventListener('click',()=>modal.close());
    check.addEventListener('click',()=>{void prepare();});
    download.addEventListener('click', async () => {
      if (!await prepare() || !ready || abort.signal.aborted) return;
      try {
        await opts.host.export.download(ready.blob,ready.filename); cached = ready;
        restoreDesignPublication(opts.runtime,{version:candidate.version,digest:ready.digest}); opts.commit(candidate);
        message.textContent = t(candidate.sourceTool ? 'Downloaded. Save the authoring session to keep its rules and publication revision.' : 'Downloaded. Save the Design master to keep its rules and publication revision.');
        trial.hidden = false; check.hidden = true; download.classList.remove('btn--primary'); (modal.el.querySelector('[data-save-master]') as HTMLElement).hidden = false; download.textContent = t('Download again');
      } catch (error) {message.textContent = t('Download could not finish: {message}',{message:(error as Error).message});}
    });
    modal.el.querySelector('[data-save-master]')!.addEventListener('click',()=>{modal.close();opts.saveMaster();});
    trial.addEventListener('click',async()=>{
      if (!ready) return; const file = new File([ready.blob],ready.filename); modal.close();
      const {tryDesignToolFile} = await import('./design-rules-trial.ts');
      await tryDesignToolFile(file,opts.host).catch(error=>opts.status(error.message));
    });
    void (opts.rights ? opts.rights() : designToolRights(candidate,opts.host)).then(held=>{
      if (abort.signal.aborted) return;
      for (const source of held) {
        const label=document.createElement('label');label.className='dr-check';const checkbox=document.createElement('input');checkbox.type='checkbox';
        const span=document.createElement('span');span.textContent=t('I have permission to include {name}.',{name:source.name});
        const reason=document.createElement('small');reason.textContent=source.reason;span.append(document.createElement('br'),reason);
        checkbox.addEventListener('change',()=>{if(checkbox.checked)included.add(source.id);else included.delete(source.id);}); label.append(checkbox,span);modal.el.querySelector('[data-inclusion]')!.append(label);
      }
    }).catch(error=>{if(!abort.signal.aborted)message.textContent=error.message;});
  };
  return {open,destroy() {active?.close();}};
}
