// SPDX-License-Identifier: MPL-2.0
/**
 * Connect an AI agent (plans/289 D1): the Design menu's way to let an agent on this
 * computer work in the open document while the person watches.
 *
 *   - In a browser the agent's local MCP server gives the agent a code; the person
 *     types it here and the tab pairs (lib/live-agent-connect.ts).
 *   - In the desktop app there is no code: the person turns on Allow AI control,
 *     a device setting, and the app listens for the agent itself
 *     (lib/live-agent-desktop.ts).
 *
 * While an agent is linked a pill in the corner says so, shows its latest change,
 * and has Disconnect. Every change it makes is one step in the person's history.
 *
 * Built with DOM nodes only, no raw-HTML sink: the agent's name and notes are
 * untrusted text and only ever reach `textContent`.
 */

import '../styles/script-audio.css';
import '../styles/agent-connect.css';
import { trapFocus, type FocusTrap } from '../lib/focus-trap.ts';
import { NAV_EVENTS } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { announce } from '../a11y.ts';
import { PairError, pairWithAgent, parsePairingCode, type AgentLink, type PairFailure } from '../lib/live-agent-connect.ts';
import type { LiveEditor } from '../lib/live-agent.ts';
import type { AgentChange } from '@lolly-tools/core/agent-presence-v1';
import { agentRosterFor } from '../lib/agent-collaborators.ts';
import { mountCollabPill, type CollabPill } from '../components/collab-pill.ts';
import { mountAgentChanges, type AgentChanges } from '../components/agent-changes.ts';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const LEAD = (): string => t('An AI agent on this computer can read and change this document while you watch. Each change it makes is one step in your history, so Undo takes it back.');
const TRUST = (): string => t('Connect only an agent you trust. It can change this document, but not your files or settings.');

interface DialogParts { body: HTMLElement; actions: HTMLElement; status: HTMLElement; close(): void; trap(initial: HTMLElement): void; onEnter(fn: () => void): void }

/** The shared overlay: header, body, footer, Escape and backdrop to close, focus trap. */
function dialog(title: string): DialogParts {
  let trap: FocusTrap | undefined;
  let enter: (() => void) | null = null;
  const overlay = el('div', 'script-audio-overlay');
  const backdrop = el('div', 'script-audio-backdrop');
  backdrop.setAttribute('aria-hidden', 'true');
  const panel = el('div', 'script-audio-panel agent-connect');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', title);
  const head = el('header', 'script-audio-head');
  head.appendChild(el('span', undefined, title));
  const closeBtn = el('button', 'script-audio-close', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', t('Close'));
  head.appendChild(closeBtn);
  const body = el('div', 'script-audio-body');
  const status = el('p', 'agent-connect-status');
  status.setAttribute('role', 'status');
  const actions = el('footer', 'script-audio-actions');
  panel.append(head, body, actions);
  overlay.append(backdrop, panel);
  document.body.appendChild(overlay);
  const opener = document.activeElement;
  const close = (): void => {
    trap?.release();
    document.removeEventListener('keydown', onKey);
    for (const ev of NAV_EVENTS) window.removeEventListener(ev, close);
    overlay.remove();
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Enter' && enter && document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'text') { e.preventDefault(); enter(); }
  };
  document.addEventListener('keydown', onKey);
  for (const ev of NAV_EVENTS) window.addEventListener(ev, close);
  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  return {
    body, actions, status, close,
    trap: (initial) => { body.append(status); trap = trapFocus(overlay, { initialFocus: initial }); },
    onEnter: (fn) => { enter = fn; },
  };
}

function button(text: string, primary = false): HTMLButtonElement {
  const b = el('button', primary ? 'script-audio-save' : 'script-audio-cancel', text);
  b.type = 'button';
  return b;
}

// ── the browser: pair with a code ─────────────────────────────────────────────

export interface AgentConnectHost {
  /** Where the pill lives: the tool view, so it leaves with the view. */
  viewEl: HTMLElement;
  editor(): LiveEditor;
  /** The link this view holds, if any, and the setter the view keeps it with. */
  link(): AgentLink | null;
  setLink(link: AgentLink | null): void;
}

/** Open the code dialog; with a link already up it offers Disconnect instead. */
export function openAgentConnect(host: AgentConnectHost): void {
  const d = dialog(t('Connect an AI agent'));
  const cancel = button(t('Cancel'));
  cancel.addEventListener('click', d.close);
  const current = host.link();
  if (current) {
    d.body.append(
      el('p', 'agent-connect-lead', tRaw('{name} is connected to this document.', { name: current.session.client() || t('AI agent') })),
      el('p', 'agent-connect-note', t('Its changes stay in your history after you disconnect, so Undo still takes them back.')),
    );
    const off = button(t('Disconnect'), true);
    off.addEventListener('click', () => { current.disconnect(); d.close(); });
    d.actions.append(cancel, off);
    d.trap(off);
    return;
  }
  d.body.append(el('p', 'agent-connect-lead', LEAD()), el('p', 'agent-connect-note', t('Ask the agent to connect to Lolly. It gives you a code. Type the code here.')));
  const label = el('label', 'script-audio-label', t('Code from the agent'));
  label.htmlFor = 'agent-connect-code';
  const input = el('input', 'field-input agent-connect-code');
  input.id = 'agent-connect-code';
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = '52817-K7QF-9XMB';
  d.body.append(label, input, el('p', 'agent-connect-note', TRUST()));
  const connect = button(t('Connect'), true);
  connect.disabled = true;
  d.actions.append(cancel, connect);
  input.addEventListener('input', () => { connect.disabled = !parsePairingCode(input.value); d.status.textContent = ''; });

  let busy = false;
  const go = (): void => {
    const code = parsePairingCode(input.value);
    if (!code || busy) return;
    busy = true;
    connect.disabled = true;
    d.status.textContent = t('Connecting…');
    let pill: AgentPill | null = null;
    void pairWithAgent(code, host.editor(), {
      onActivity: (event) => pill?.activity(event.method, event.note, event.change),
      onEnd: (reason) => {
        host.setLink(null);
        pill?.remove();
        announce(reason === 'person' ? t('The AI agent was disconnected.') : t('The AI agent disconnected.'));
      },
    }).then((link) => {
      host.setLink(link);
      pill = mountAgentPill(host.viewEl, { client: () => link.session.client(), disconnect: () => link.disconnect(), pause: value => link.session.pause(value) });
      d.close();
    }, (error: unknown) => {
      busy = false;
      connect.disabled = false;
      d.status.textContent = failureText(error instanceof PairError ? error.reason : 'unreachable');
    });
  };
  connect.addEventListener('click', go);
  d.onEnter(go);
  d.trap(input);
}

function failureText(reason: PairFailure): string {
  switch (reason) {
    case 'wrong-code': return t('The agent did not accept that code. Check it and try again.');
    case 'timeout': return t('The agent did not answer. Check that it is still running and gave you this code.');
    case 'closed': return t('The agent closed the connection before it was ready. Ask it for a new code.');
    default: return t('Could not reach the agent on this computer. Check the code, and that the agent is still waiting.');
  }
}

// ── the desktop app: Allow AI control ─────────────────────────────────────────

export interface AgentControlHost {
  allowed(): boolean;
  /** Turn the setting and the app's listener on or off; rejects with the app's message. */
  setAllowed(on: boolean): Promise<void>;
  /** The agent currently connected to this document, or '' for none. */
  connectedClient(): string;
  disconnect(): void;
  /** Let a disconnected agent connect again. */
  renew(): void;
}

/** The desktop form: one setting, and the connected agent if there is one. */
export function openAgentControl(host: AgentControlHost): void {
  const d = dialog(t('Connect an AI agent'));
  d.body.append(el('p', 'agent-connect-lead', LEAD()));
  const row = el('label', 'field-toggle agent-connect-switch');
  const box = el('input', 'field-check');
  box.type = 'checkbox';
  box.checked = host.allowed();
  row.append(box, el('span', undefined, t('Allow AI control on this device')));
  d.body.append(row, el('p', 'agent-connect-note', t('While this is on, an AI agent on this computer that uses Lolly\'s MCP server can connect to the open Design document without a code. Turn it off to stop every agent.')), el('p', 'agent-connect-note', TRUST()));
  const who = el('p', 'agent-connect-lead');
  const off = button(t('Disconnect'));
  const again = button(t('Let it connect again'));
  const sync = (): void => {
    const name = host.connectedClient();
    who.textContent = name ? tRaw('{name} is connected to this document.', { name }) : '';
    who.hidden = !name;
    off.hidden = !name;
    again.hidden = true;
  };
  off.addEventListener('click', () => { host.disconnect(); sync(); again.hidden = false; });
  again.addEventListener('click', () => { host.renew(); again.hidden = true; d.status.textContent = t('The agent can connect again.'); });
  d.body.append(who);
  box.addEventListener('change', () => {
    const on = box.checked;
    box.disabled = true;
    d.status.textContent = '';
    host.setAllowed(on).then(() => {
      d.status.textContent = on ? t('AI control is on. Ask the agent to connect to Lolly.') : t('AI control is off.');
      sync();
    }, (error: unknown) => {
      box.checked = !on;
      d.status.textContent = tRaw('Could not change the setting: {reason}', { reason: error instanceof Error ? error.message : String(error) });
    }).finally(() => { box.disabled = false; });
  });
  const done = button(t('Done'), true);
  done.addEventListener('click', d.close);
  d.actions.append(off, again, done);
  sync();
  d.trap(box);
}

// ── the pill ──────────────────────────────────────────────────────────────────

export interface AgentPill { activity(method: string, note?: string, change?: AgentChange): void; remove(): void }

/** The corner pill while an agent is linked: who, what it last did, and Disconnect. */
export function mountAgentPill(viewEl: HTMLElement, link: { client(): string; disconnect(): void; pause?(paused: boolean): void }): AgentPill {
  const stage = viewEl.querySelector<HTMLElement>('.tool-stage') ?? viewEl;
  const canvas = viewEl.querySelector<HTMLElement>('#tool-canvas, #tool-content');
  const roster = agentRosterFor(stage);
  const name = (): string => link.client() || t('AI agent');
  const agent = roster.join(name(), { disconnect: () => link.disconnect(), pause: value => link.pause?.(value) });
  let pill: CollabPill | null = null;
  let changes: AgentChanges | null = null;
  const refresh = (): void => {
    if (roster.hasPeople()) { pill?.destroy(); pill = null; changes?.dispose(); changes = null; return; }
    pill ??= mountCollabPill(stage, { source: roster, className: 'collab-pill--stage collab-pill--agent', onDisconnectAgent: id => roster.disconnect(id), onPauseAgent: id => roster.pause(id) });
    if (canvas) changes ??= mountAgentChanges(stage, canvas, roster);
  };
  refresh();
  const off = roster.subscribe(refresh);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let removed = false;
  return {
    activity(method, note, change) {
      if (removed) return;
      if (method === 'hello') { agent.update({ name: name() }); return; }
      const activity = method === 'document.apply' ? note
        : method === 'history.undo' ? t('Undo last change') : method === 'look' ? t('Looking at the document') : undefined;
      if (!activity && !change) return;
      const paused = roster.local().find(entry => entry.id === agent.id)?.phase === 'paused';
      agent.update({ name: name(), activity, ...(paused ? {} : { phase: 'working' }), ...(change ? { change } : {}) });
      clearTimeout(timer);
      timer = setTimeout(() => {
        const paused = roster.local().find(entry => entry.id === agent.id)?.phase === 'paused';
        agent.update({ ...(paused ? {} : { phase: 'idle' }), activity: undefined, change: undefined });
      }, 4000);
    },
    remove() { if (removed) return; removed = true; clearTimeout(timer); off(); agent.remove(); pill?.destroy(); changes?.dispose(); },
  };
}
