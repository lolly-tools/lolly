// SPDX-License-Identifier: MPL-2.0
/** One source-copy handoff for saved sessions, templates and open tools. */
import type { Runtime } from '../../../../engine/src/runtime.ts';
import { getDesignToolDraft } from './design-tool-draft.ts';
const waiting = new WeakMap<Runtime,string>();
const editors = new WeakMap<Runtime, (name?: string) => void>();
let pending: { toolId: string; name: string; inputId?: string } | undefined;

export function registerRulesEditor(runtime: Runtime, open: (name?: string) => void): () => void {
  editors.set(runtime, open);
  const name=waiting.get(runtime);
  if(name!==undefined){waiting.delete(runtime);queueMicrotask(()=>{if(editors.get(runtime)===open)open(name);});}
  return () => editors.delete(runtime);
}

export function rulesCopySeed(
  values: Record<string, unknown>,
  name: string
): Record<string, unknown> {
  const seed = structuredClone(values);
  for (const key of ['__label', '__slot', '__designPublication', '__savedAt', '__modifiedAt'])
    delete seed[key];
  const draft = seed.__designTool as { id: string; version: string; name: string } | undefined;
  if (draft) {
    draft.id = `design-${crypto.randomUUID().slice(0, 12)}`;
    draft.version = '1.0.0';
    draft.name = name;
  }
  return seed;
}

export async function launchRulesCopy(
  toolId: string,
  values: Record<string, unknown>,
  name: string,
  inputId?: string
): Promise<void> {
  const { openToolWithSeed } = await import('./drop-router.ts');
  pending = { toolId, name, inputId };
  openToolWithSeed(toolId, rulesCopySeed(values, name));
}

export async function shareCurrentWithRules(
  runtime: Runtime,
  toolId: string,
  values: Record<string, unknown>,
  name: string
): Promise<void> {
  const open = editors.get(runtime);
  if (open && getDesignToolDraft(runtime)) {
    open();
    return;
  }
  await launchRulesCopy(toolId, values, name);
}

export function takeRulesRequest(toolId: string): {name: string; inputId?: string} | undefined {
  if (pending?.toolId !== toolId) return;
  const request = pending; pending = undefined; return request;
}

export function openRegisteredRules(runtime:Runtime,name:string):void {
  const open=editors.get(runtime);
  if(open)open(name);else waiting.set(runtime,name);
}
