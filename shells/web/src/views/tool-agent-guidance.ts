// SPDX-License-Identifier: MPL-2.0
import type { AgentGuidanceHost } from '../lib/agent-invitation-host.ts';
import type { ToolViewCtx } from './tool/context.ts';
import { getInstanceBase } from '../lib/instance.ts';
import type { LiveEditor } from '../lib/live-agent.ts';
import { isTauriMobileShell, isTauriShell } from '../lib/instance-choice.ts';
import { shareDeepLink } from './export-share.ts';

/** Each mounted runtime supplies guidance independently of its live transport. */
export async function mountToolAgentGuidance(tview: ToolViewCtx, documentId: string): Promise<AgentGuidanceHost> {
  const { installAgentGuidance } = await import('./agent-share.ts');
  const tool = tview.tool;
  const instanceBase = getInstanceBase();
  const active = () => tview.viewEl.isConnected && !tview.mountLifecycle.disposed && !tview.openDocument.stopped() && getInstanceBase() === instanceBase;
  const guidance: AgentGuidanceHost = {
    documentId, toolId: tool.manifest.id, toolVersion: tool.manifest.version,
    facts: JSON.stringify({
      toolId: tool.manifest.id, toolVersion: tool.manifest.version, name: tool.manifest.name,
      inputs: (tool.manifest.inputs ?? []).map(input => ({
        id: input.id, type: input.type, ...(input.urlKey ? { urlKey: input.urlKey } : {}),
        ...(input.label ? { label: input.label } : {}),
      })),
      formats: tool.manifest.render.formats ?? [],
    }, null, 2),
    active,
    async skill() {
      if (!active()) throw new Error('This document has closed.');
      const { resolveToolSkill } = await import('../bridge/tool-skill.ts');
      const skill = await resolveToolSkill(tool);
      if (!active()) throw new Error('This document has closed.');
      return skill;
    },
  };
  if (active()) tview.mountLifecycle.add('agent guidance', installAgentGuidance(tview.runtime, guidance));
  return guidance;
}

export async function mountToolAgentInvitations(tview: ToolViewCtx, editor: () => Promise<() => LiveEditor>): Promise<void> {
  if (tview.isPresent) return;
  const [{ installAgentInvitations }, { agentRelayBase }, factory] = await Promise.all([
    import('./agent-share.ts'), import('../lib/agent-invitation-host.ts'), editor(),
  ]);
  const base = agentRelayBase();
  if (base && tview.viewEl.isConnected && !tview.mountLifecycle.disposed) {
    tview.mountLifecycle.add('agent-invitations', installAgentInvitations(tview.runtime, tview.viewEl, base, factory));
    tview.actionsEl?.dispatchEvent(new Event('lolly:share-change'));
  }
}

/** Startup Share waits for the same guidance and editor that a toolbar press reads. */
export async function finishToolAgentShare(tview: ToolViewCtx, documentId: string, ready: Promise<void> | undefined, open: () => void): Promise<void> {
  if (!ready && !tview.isPresent && (tview.canvasEl || tview.contentEl)) {
    ready = mountToolAgentInvitations(tview, async () => {
      const { toolAgentEditor } = await import('./tool-agent-editor.ts');
      return toolAgentEditor(tview, {
        documentId, desktop: isTauriShell() && !isTauriMobileShell(), canvas: (tview.canvasEl ?? tview.contentEl)!,
        size: () => ({ width: tview.nativeW, height: tview.nativeH }),
      });
    });
  }
  await ready;
  if (tview.viewEl.isConnected && !tview.mountLifecycle.disposed && shareDeepLink(tview.urlFlags, !!tview.collabHandle)?.kind === 'open') {
    open();
  }
}
