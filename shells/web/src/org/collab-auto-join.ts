// SPDX-License-Identifier: MPL-2.0
/** Shared documents enter their Work room when their tool is ready. */
import { registerToolReady } from '../lib/tool-ready.ts';
import { activeTeamSessionOrigin, teamOriginGeneration, teamSessionLive } from './team-session-origin.ts';
import { canJoinCollab } from './collab-config.ts';
import { openWorkCollab, type WorkCollabDeps } from './collab-work-opener.ts';
import { loadNamespace, t, tRaw } from '../i18n.ts';
import { announce } from '../a11y.ts';

export interface AutomaticWorkCollabDeps extends WorkCollabDeps {
  readonly join?: typeof openWorkCollab;
}
export function registerAutomaticWorkCollab(deps: AutomaticWorkCollabDeps = {}): () => void {
  return registerToolReady((tool, current) => {
    const origin = activeTeamSessionOrigin(tool.toolId);
    if (!origin || tool.collaborating || tool.unsaved?.() || teamSessionLive(origin.sessionId) || !(deps.canJoin ?? canJoinCollab)()) return;
    const generation = teamOriginGeneration();
    let disposed = false;
    let connecting = false;
    const wanted = (): boolean => !disposed && current() && generation === teamOriginGeneration()
      && activeTeamSessionOrigin(tool.toolId)?.sessionId === origin.sessionId;
    const status = document.createElement('div');
    status.className = 'collab-auto-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const message = document.createElement('span');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = t('Try again');
    retry.hidden = true;
    status.append(message, retry);
    tool.view.append(status);
    // Until the room snapshot and seat arrive, a local edit could be replaced
    // by the server's snapshot. Navigation outside the tool remains available.
    const block = (event: Event): void => {
      if (!connecting || status.contains(event.target as Node)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const events = ['pointerdown', 'keydown', 'beforeinput'] as const;
    for (const event of events) tool.view.addEventListener(event, block, true);
    const showFailure = (reason: string): void => {
      message.textContent = reason;
      retry.hidden = false;
      status.classList.add('is-failed');
      announce(reason, { assertive: true });
    };
    const join = async (): Promise<void> => {
      if (!wanted() || tool.unsaved?.() || connecting) return;
      connecting = true;
      retry.hidden = true;
      status.classList.remove('is-failed');
      try {
        await loadNamespace('collab');
        if (!wanted()) return;
        message.textContent = tRaw('Connecting');
        const outcome = await (deps.join ?? openWorkCollab)({ toolId: tool.toolId, sessionId: origin.sessionId, baseParts: [] },
          { ...deps, stillWanted: wanted });
        if (!wanted()) return;
        if (outcome.ok) status.remove();
        else showFailure(outcome.message);
      } catch {
        if (wanted()) showFailure(tRaw('This instance could not be reached. Try again when you are back online.'));
      } finally { connecting = false; }
    };
    retry.addEventListener('click', () => { void join(); });
    void join();
    return () => {
      disposed = true;
      status.remove();
      for (const event of events) tool.view.removeEventListener(event, block, true);
    };
  });
}
