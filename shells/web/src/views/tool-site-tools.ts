// SPDX-License-Identifier: MPL-2.0
import { publishSiteEditor } from '../lib/site-tools-context.ts';
import { siteModelContext } from '../lib/site-tools.ts';
import type { LiveEditor } from '../lib/live-agent.ts';
import type { ToolViewCtx } from './tool/context.ts';

/** Document actions use the mounted editor and the same visible roster as other agents. */
export function mountToolSiteEditor(tview: ToolViewCtx, stage: HTMLElement, factory: () => Promise<() => LiveEditor>): typeof factory {
  if (!siteModelContext(document)) return factory;
  const current = () => !tview.mountLifecycle.disposed && !tview.openDocument.stopped();
  let painted = false;
  let publish: (() => void) | undefined;
  tview.mountLifecycle.listen('site editor initial paint', tview.canvasEl!, 'lolly-canvas-painted', () => {
    painted = true;
    publish?.();
  }, { once: true });
  void Promise.all([import('../lib/site-tools-editor.ts'), import('../lib/agent-collaborators.ts'), import('../lib/agent-roster-controls.ts')]).then(([{ createSiteEditor }, { agentRosterFor }, { mountAgentRosterControls }]) => {
    publish = () => {
      if (!current()) return;
      tview.mountLifecycle.add('site agent controls', mountAgentRosterControls(stage, tview.canvasEl));
      tview.mountLifecycle.add('site document actions', publishSiteEditor(createSiteEditor(async () => (await factory())(), agentRosterFor(stage), current)));
    };
    if (painted) publish();
  }).catch(error => tview.host.log('warn', 'Site document actions are unavailable.', { error: String(error) }));
  return factory;
}
