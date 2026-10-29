// SPDX-License-Identifier: MPL-2.0
/** Adapt the shared text editor to the mounted document's history and save actions. */
import type { ToolViewCtx } from './tool/context.ts';

export async function mountToolTextWorkspace(view: ToolViewCtx): Promise<void> {
  const hydrated = view.runtime.getHydrated();
  if (!hydrated.includes('data-text-workspace') || !view.contentEl?.parentElement) return;
  const { mountTextWorkspace } = await import('./text.ts');
  if (view.mountLifecycle.disposed) return;
  const content = view.contentEl;
  content.style.display = 'none';
  const cleanup = await mountTextWorkspace({
    container: content.parentElement!, runtime: view.runtime, host: view.host,
    onDirty: view.session.markUserDirty, history: view.actionsApi?.history,
    writing: hydrated.includes('data-write-workspace'),
    saveProject: view.canSaveSession && view.actionsApi?.save ? async () => {
      if (!view.openSaveAs) throw new Error('Project saving is unavailable.');
      await view.openSaveAs('project');
    } : undefined,
    meta: read => { view.documentMeta = read; },
  });
  view.mountLifecycle.add('text-workspace', () => { cleanup(); content.style.removeProperty('display'); });
}
