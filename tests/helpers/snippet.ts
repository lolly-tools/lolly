// SPDX-License-Identifier: MPL-2.0
import { readFile } from 'node:fs/promises';
import { loadTool } from '../../engine/src/loader.ts';
import { createRuntime } from '../../engine/src/runtime.ts';
import type { InputValue } from '../../engine/src/inputs.ts';
import { highlightCode } from '../../engine/src/text-syntax.ts';
import { baseHost } from './host.ts';

const root = new URL('../../community/', import.meta.url);
export const snippetTool = await loadTool('snippet', p => readFile(new URL(p, root), 'utf8'));
export const snippetHooks = await readFile(new URL('snippet/hooks.js', root), 'utf8');
export interface SceneState { doc: number; caret: number; selection: [number, number] | null; open: boolean; focused: boolean }
export interface SceneEvent {
  action: string; start: number; end: number; before: SceneState; after: SceneState;
  cuts: [number, number][]; insert: string; at: number;
}
export interface SnippetScene {
  animated: boolean; docs: { text: string; html: string }[]; events: SceneEvent[];
  initial: SceneState; duration: number; poster: number; warnings: string[];
}
export async function snippetRender(values: Record<string, InputValue> = {}) {
  const errors: string[] = [];
  const runtime = await createRuntime(snippetTool, baseHost({
    textTools: { highlight: async (...args: Parameters<typeof highlightCode>) => highlightCode(...args) },
    log: (level: string, message: string) => { if (level === 'error') errors.push(message); },
  }), values);
  if (errors.length) throw new Error(errors.join('\n'));
  const scene = JSON.parse(runtime.getHydratedString('{{{snippetScene}}}')) as SnippetScene;
  return { runtime, scene, html: runtime.getHydrated() };
}
