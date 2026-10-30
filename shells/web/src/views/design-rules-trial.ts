// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { DesignToolDraftV1 } from '@lolly-tools/core/design-tool-v1';
import type { ToolManifest } from '@lolly/engine';
import { mountModal } from '../components/modal.ts';
import { mountRulesPreview } from './design-rules-preview.ts';
import { t } from '../i18n.ts';

/** Try the actual downloaded bytes while the unsaved authoring master stays mounted. */
export async function tryDesignToolFile(file:File, host:HostV1):Promise<void> {
  const { readLollyFile, extractBundledTool } = await import('../lib/lolly-pack.ts');
  const parsed=await readLollyFile(new Uint8Array(await file.arrayBuffer()));const bundle=extractBundledTool(parsed);
  if(!bundle)throw new Error('This file contains no reusable tool.');
  const manifest=JSON.parse(new TextDecoder().decode(bundle.files['tool.json'])) as ToolManifest;
  const policy=manifest.designTool;if(!policy)throw new Error('This file has no designer rules.');
  let reader:ReturnType<typeof mountRulesPreview>|undefined;
  const modal=mountModal('',{className:'modal dr-source',ariaLabel:t('Try downloaded tool'),onClose(){reader?.destroy();}});
  const heading=document.createElement('h2');heading.textContent=manifest.name;
  const note=document.createElement('p');note.textContent=t('Running the portable tool. The authoring session stays open behind this preview.');
  const root=document.createElement('div');root.className='dr-preview dr-trial';root.classList.toggle('is-on-canvas',policy.presentation==='on-canvas');
  const controls=document.createElement('div');controls.className='dr-preview-controls tool-panel';
  const stage=document.createElement('div');stage.className='dr-preview-stage';
  const edit=document.createElement('button');edit.className='btn btn--glass dr-edit-inputs';edit.textContent=t('Edit inputs');
  const message=document.createElement('p');message.className='dr-preview-status';message.setAttribute('role','status');
  const scale=document.createElement('div');scale.className='dr-preview-scale';const canvas=document.createElement('div');canvas.id=`rules-trial-${crypto.randomUUID()}`;canvas.dataset.rulesPreviewCanvas='';canvas.style.transformOrigin='top left';scale.append(canvas);stage.append(edit,message,scale);root.append(controls,stage);
  const done=document.createElement('button');done.className='btn btn--primary';done.textContent=t(policy.sourceTool ? 'Back to authoring' : 'Back to master');done.onclick=()=>modal.close();
  modal.el.append(heading,note,root,done);
  const draft:DesignToolDraftV1={...policy,id:manifest.id,name:manifest.name,version:manifest.version,recipes:[],variants:policy.variants.map(v=>({...v,background:'#fff',boxes:[]}))};
  reader=mountRulesPreview({root,source:canvas,host,draft:()=>draft,compiled:{manifest,files:bundle.files},hideDefaults:true,status:messageText=>{message.textContent=messageText;},defaults() {}});
  root.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'&&!(event.target as Element).closest('input,textarea,select')) {reader?.undo(event.shiftKey);event.preventDefault();event.stopPropagation();}});
  try {await reader.show();} catch(error) {message.textContent=(error as Error).message;}
}
