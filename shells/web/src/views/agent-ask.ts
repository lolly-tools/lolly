// SPDX-License-Identifier: MPL-2.0
/**
 * Ask an agent: the desktop Design editor's way to hand one request to an agent CLI
 * already on this computer (Claude Code or Codex), with no MCP setup. Opening the
 * panel is what runs detection; nothing is looked for before that.
 *
 * Before the first request to each engine the panel says where the request goes,
 * under whose account and who pays, and the person allows that engine once on this
 * device. The run reads the document through live-v1 and applies the answer the same
 * way (lib/device-agents.ts), so the agent shows in People while it works and every
 * change is one step in the person's history.
 *
 * DOM nodes only, no raw-HTML sink: agent names, versions, paths and the CLI's own
 * words are untrusted text and only ever reach `textContent`.
 */

import '../styles/script-audio.css';
import '../styles/agent-connect.css';
import { t, tRaw } from '../i18n.ts';
import { announce } from '../a11y.ts';
import { button, dialog, el, mountAgentPill, POLICY_OFF, type AgentPill } from './agent-connect.ts';
import type { TauriInvoke } from '../lib/nearby-boot.ts';
import type { LiveEditor, LiveSession } from '../lib/live-agent.ts';
import { AiPolicyError } from '../lib/ai-policy.ts';
import {
  AGENT_LIMITS, allowEngine, detectDeviceAgents, engineAllowed, ENGINE_VENDORS, runDeviceAgent,
  type DeviceAgent, type DeviceRunPhase, type DeviceRunResult,
} from '../lib/device-agents.ts';

export interface AgentAskHost {
  /** Where the People entry lives: the tool view, so it leaves with the view. */
  viewEl: HTMLElement;
  invoke: TauriInvoke;
  editor(): Promise<() => LiveEditor>;
  /** A detection that found nothing at all, so the menu can stop offering the row. */
  onNothingFound?(): void;
}

/** Why a found agent cannot be asked, in the person's words. */
export function agentNote(agent: DeviceAgent): string {
  if (agent.kind === 'app') return t('Installed app. Lolly cannot send requests to apps.');
  if (agent.kind === 'local-model') return t('Running on this device. Lolly does not use local models for this yet.');
  switch (agent.note) {
    case 'update': return t('Found, but this version is too old. Update it to use it here.');
    case 'batch-shim': return t('Found as a script Lolly does not start. Install the native version to use it here.');
    case 'unsafe-location': return t('Found in a folder other people on this computer can change, so Lolly does not start that copy.');
    default: return t('Found. Lolly does not send requests to this agent yet.');
  }
}

/** What a finished run means, in the person's words. */
export function resultText(result: DeviceRunResult, agent: string): string {
  if (result.status === 'applied') return tRaw('Done: {label}. Undo takes it back.', { label: result.label || t('AI agent') });
  if (result.status === 'empty') return tRaw('{agent} suggested no changes: {label}', { agent, label: result.label || '-' });
  switch (result.reason) {
    case 'policy': return POLICY_OFF();
    case 'not-signed-in': return tRaw('{agent} is not signed in. Sign in to it in a terminal, then try again.', { agent });
    case 'timeout': return tRaw('{agent} took longer than five minutes, so Lolly stopped the request. Nothing was changed.', { agent });
    case 'cancelled': return t('Stopped. Nothing was changed.');
    case 'too-large': return t('The answer was too large to use. Nothing was changed.');
    case 'busy': return t('Another request is still running. Wait until it finishes, or press Stop.');
    case 'not-detected': return tRaw('Lolly could not find {agent} again. Close this panel and open it again.', { agent });
    case 'stale': return tRaw('The document changed while {agent} was working, so nothing was applied. Ask again.', { agent });
    case 'bad-output': return t('The answer could not be used. Nothing was changed.');
    case 'refused': return t('Lolly could not apply the change. Nothing was changed.');
    default: return tRaw('{agent} could not finish the request. Nothing was changed.', { agent });
  }
}

function phaseText(phase: DeviceRunPhase, agent: string): string {
  if (phase === 'reading') return t('Reading the document…');
  if (phase === 'applying') return t('Applying the changes…');
  return tRaw('{agent} is working…', { agent });
}

const versioned = (agent: DeviceAgent): string => (agent.version ? `${agent.label} ${agent.version}` : agent.label);

export function openAgentAsk(host: AgentAskHost): void {
  const d = dialog(t('Ask an agent'));
  d.body.append(el('p', 'agent-connect-lead', t('An agent on this computer reads this document and suggests changes. Each change is one step in your history, so Undo takes it back.')));
  const list = el('div', 'agent-ask-list');
  list.setAttribute('role', 'radiogroup');
  list.setAttribute('aria-label', t('Agents on this device'));
  const notice = el('div', 'agent-ask-notice');
  // renderNotice writes the label, with the engine's name in the text.
  const allow = button('', true);
  const label = el('label', 'script-audio-label', t('What should the agent do?'));
  label.htmlFor = 'agent-ask-request';
  const request = el('textarea', 'field-input agent-ask-request');
  request.id = 'agent-ask-request';
  request.rows = 3;
  request.maxLength = AGENT_LIMITS.maxRequestChars;
  request.placeholder = t('For example: shorten the headline and make it bold');
  const others = el('details', 'agent-ask-others');
  others.append(el('summary', undefined, t('Also on this device')));
  const progress = el('p', 'agent-connect-note agent-ask-progress');
  const elapsed = el('span', 'agent-ask-elapsed');
  elapsed.setAttribute('aria-hidden', 'true');
  const detail = el('p', 'agent-connect-note agent-ask-detail');
  const stop = button(t('Stop'));
  const close = button(t('Close'));
  const ask = button(t('Ask'), true);
  for (const node of [list, notice, label, request, others, progress, detail, stop, ask]) node.hidden = true;
  d.body.append(list, notice, label, request, progress, detail, others);
  d.actions.append(close, stop, ask);
  close.addEventListener('click', d.close);

  let agents: DeviceAgent[] = [];
  let chosen: DeviceAgent | null = null;
  let running: AbortController | null = null;
  let pill: AgentPill | null = null;
  let pillTimer: ReturnType<typeof setTimeout> | undefined;
  let ticker: ReturnType<typeof setInterval> | undefined;
  let session: LiveSession | null = null;

  const dropPill = (): void => { clearTimeout(pillTimer); pill?.remove(); pill = null; };
  d.onClose(() => { running?.abort(); clearInterval(ticker); dropPill(); });

  const syncAsk = (): void => {
    const ready = !!chosen && engineAllowed(chosen.id) && !running;
    ask.hidden = !chosen;
    ask.disabled = !ready || !request.value.trim();
    request.disabled = !!running || !chosen || !engineAllowed(chosen.id);
  };

  const renderNotice = (): void => {
    notice.replaceChildren();
    notice.hidden = !chosen;
    if (!chosen) return;
    const agent = chosen.label;
    const vendor = ENGINE_VENDORS[chosen.id] ?? agent;
    notice.append(
      el('p', undefined, tRaw('Your request and this document go to {vendor} through {agent}, under the account {agent} is signed in with.', { vendor, agent })),
      el('p', undefined, tRaw('Your plan with {vendor} pays for each request.', { vendor })),
      el('p', undefined, t('The agent runs with no tools: it cannot read your files, run commands or browse the web.')),
    );
    if (!engineAllowed(chosen.id)) {
      allow.textContent = tRaw('Allow {agent}', { agent });
      notice.append(allow);
    }
    syncAsk();
  };

  allow.addEventListener('click', () => {
    if (!chosen) return;
    allowEngine(chosen.id);
    renderNotice();
    request.focus();
  });
  request.addEventListener('input', syncAsk);

  const renderList = (): void => {
    const runnable = agents.filter(a => a.runnable);
    list.replaceChildren();
    list.hidden = !runnable.length;
    label.hidden = !runnable.length;
    request.hidden = !runnable.length;
    for (const agent of runnable) {
      const row = el('label', 'field-toggle agent-ask-choice');
      const radio = el('input', 'field-radio');
      radio.type = 'radio';
      radio.name = 'agent-ask-engine';
      radio.value = agent.id;
      radio.checked = agent === chosen;
      radio.addEventListener('change', () => { chosen = agent; renderNotice(); });
      const name = el('span', 'agent-ask-name', versioned(agent));
      const path = el('span', 'agent-ask-path', agent.path);
      row.append(radio, name, path);
      list.append(row);
    }
    const rest = agents.filter(a => !a.runnable);
    others.hidden = !rest.length;
    for (const node of [...others.children].slice(1)) node.remove();
    for (const agent of rest) {
      const row = el('p', 'agent-connect-note agent-ask-other');
      row.append(el('strong', undefined, versioned(agent)), document.createTextNode(' '), el('span', undefined, agentNote(agent)));
      others.append(row);
    }
    others.open = !runnable.length;
  };

  const finish = (result: DeviceRunResult, agent: DeviceAgent): void => {
    running = null;
    session = null;
    clearInterval(ticker);
    elapsed.remove();
    progress.hidden = true;
    stop.hidden = true;
    list.querySelectorAll('input').forEach((radio) => { radio.disabled = false; });
    const message = resultText(result, agent.label);
    d.status.textContent = message;
    announce(message);
    const words = result.status === 'failed' ? result.detail?.trim() : '';
    detail.textContent = words ?? '';
    detail.hidden = !words;
    if (result.status === 'applied') request.value = '';
    syncAsk();
    // Let the People entry show the change for a moment, then leave.
    pillTimer = setTimeout(dropPill, result.status === 'applied' ? 6000 : 1500);
  };

  const go = (): void => {
    const agent = chosen;
    const words = request.value.trim();
    if (!agent || !words || running || !engineAllowed(agent.id)) return;
    const controller = new AbortController();
    running = controller;
    dropPill();
    detail.hidden = true;
    d.status.textContent = '';
    stop.hidden = false;
    progress.hidden = false;
    list.querySelectorAll('input').forEach((radio) => { radio.disabled = true; });
    syncAsk();
    const started = Date.now();
    elapsed.textContent = '';
    ticker = setInterval(() => { elapsed.textContent = ` ${t('{seconds} s', { seconds: Math.round((Date.now() - started) / 1000) })}`; }, 1000);
    pill = mountAgentPill(host.viewEl, {
      client: () => agent.label,
      disconnect: () => controller.abort(),
      pause: (value) => session?.pause(value),
    });
    pill.activity('hello');
    void host.editor().then(editor => runDeviceAgent({
      invoke: host.invoke,
      agent,
      editor: editor(),
      request: words,
      signal: controller.signal,
      onSession: (s) => { session = s; },
      onActivity: (event) => pill?.activity(event.method, event.note, event.change),
      onPhase: (phase) => {
        progress.textContent = phaseText(phase, agent.label);
        if (phase === 'working') { progress.append(elapsed); pill?.activity('agent.working'); }
      },
    })).catch((error: unknown) => ({ status: 'failed' as const, reason: 'failed' as const, detail: error instanceof Error ? error.message : String(error) }))
      .then((result) => { if (running === controller) finish(result, agent); });
  };
  ask.addEventListener('click', go);
  stop.addEventListener('click', () => running?.abort());
  request.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); go(); }
  });

  d.status.textContent = t('Looking for agents on this device…');
  d.trap(close);
  detectDeviceAgents(host.invoke).then((rows) => {
    agents = rows;
    const runnable = rows.filter(a => a.runnable);
    chosen = runnable[0] ?? null;
    renderList();
    renderNotice();
    if (!rows.length) {
      d.status.textContent = t('No agent was found on this device. Install Claude Code or Codex and sign in to it, then open this again.');
      host.onNothingFound?.();
    } else if (!runnable.length) {
      d.status.textContent = t('Lolly found agents on this device, but none it can send requests to yet.');
    } else {
      d.status.textContent = '';
      (chosen && engineAllowed(chosen.id) ? request : list.querySelector<HTMLInputElement>('input:checked') ?? close).focus();
    }
  }, (error: unknown) => {
    d.status.textContent = error instanceof AiPolicyError ? POLICY_OFF()
      : tRaw('Lolly could not look for agents: {reason}', { reason: error instanceof Error ? error.message : String(error) });
  });
}
