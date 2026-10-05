// SPDX-License-Identifier: MPL-2.0
/** Invite an agent to the live document using the inviter's existing identity. */
import { mountModal } from '../components/modal.ts';
import { instanceFetch, instancePath, getInstanceBase } from '../lib/instance.ts';
import { icon } from '../lib/icons.ts';
import { tRaw } from '../i18n.ts';
import { agentConnection, agentInviteState, orgAgentInvitesEnabled } from './document-agent-config.ts';

interface Agent { id: string; label: string; role: 'viewer' | 'editor'; actingFor: string; expiresAt: string; revokedAt?: string; connected: boolean; canRevoke: boolean }
interface Listing { enabled: boolean; canEdit: boolean; agents: Agent[] }
let open: HTMLDialogElement | undefined, sequence = 0;
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const el = document.createElement(tag); el.className = cls; el.textContent = tRaw(text); return el;
};
const button = (text: string, symbol?: Parameters<typeof icon>[0]) => {
  const el = element('button', 'btn btn--sm'); el.type = 'button';
  if (symbol) el.innerHTML = icon(symbol);
  el.append(document.createTextNode(tRaw(text))); return el;
};

export async function openAgentInvites(sessionId: string, isCurrent: () => boolean): Promise<void> {
  if (!orgAgentInvitesEnabled() || open?.isConnected) return;
  const base = getInstanceBase(), address = location.href, abort = new AbortController();
  let connection = '', busy = false;
  const modal = mountModal('', { className: 'modal team-invite-dialog document-agents', ariaLabel: tRaw('Invite agent'),
    onClose: () => { open = undefined; connection = ''; abort.abort(); } });
  open = modal.el;
  const current = () => modal.el.isConnected && isCurrent() && base === getInstanceBase() && address === location.href;
  const header = element('header', 'team-project-head'), heading = element('h2', 'modal-title', 'Invite agent'), close = button('Close');
  close.addEventListener('click', () => modal.close()); header.append(heading, close);
  const hint = element('p', 'muted', 'Your agent acts on your behalf in this document. Its access cannot exceed yours. You can revoke it at any time.');
  const status = element('p', 'document-agent-status', 'Loading agent invitations…'); status.setAttribute('role', 'status');
  const form = element('form', 'document-agent-form'); form.hidden = true;
  const label = element('input', 'input'); label.type = 'text'; label.maxLength = 80; label.required = true; label.autocomplete = 'off'; label.placeholder = tRaw('e.g. Keynote assistant');
  const role = element('select', 'input');
  const hours = element('select', 'input');
  for (const [value, text] of [['1', '1 hour'], ['24', '24 hours'], ['168', '7 days']]) { const o = element('option', '', text); o.value = value!; hours.append(o); } hours.value = '24';
  const field = (text: string, control: HTMLElement) => {
    const wrap = element('div', 'document-agent-field'), l = element('label', '', text);
    control.id = `agent-field-${++sequence}`; l.htmlFor = control.id; wrap.append(l, control); return wrap;
  };
  const submit = button('Create invitation', 'aiSpark'); submit.type = 'submit';
  form.append(field('Agent name', label), field('Access', role), field('Expires in', hours), submit);
  const accessHint = element('p', 'muted', 'Viewers read the document. Editors make changes alongside its collaborators.');
  const setup = element('section', 'document-agent-setup'); setup.hidden = true; setup.setAttribute('aria-label', tRaw('Agent connection'));
  const key = element('input', 'input'); key.type = 'password'; key.readOnly = true; key.autocomplete = 'off';
  const endpoint = element('input', 'input'); endpoint.readOnly = true;
  const revealLabel = element('label', 'document-agent-reveal'), reveal = element('input'); reveal.type = 'checkbox';
  reveal.addEventListener('change', () => { key.type = reveal.checked ? 'text' : 'password'; });
  revealLabel.append(reveal, document.createTextNode(tRaw('Show connection key')));
  const copy = button('Copy MCP configuration', 'clipboard'), instructions = button('Copy instructions', 'clipboard');
  const copyText = async (value: string) => {
    try { await navigator.clipboard.writeText(value); if (current()) status.textContent = tRaw('Copied. Paste it into your agent’s MCP settings.'); }
    catch { if (current()) status.textContent = tRaw('Clipboard unavailable. Select the connection details to copy them.'); }
  };
  copy.addEventListener('click', () => { if (connection) void copyText(connection); });
  instructions.addEventListener('click', () => { if (connection) void copyText(`Connect to Lolly using this MCP configuration. This invitation acts under my identity in one document. Read the document and its editing claims before making small changes.\n\n${connection}`); });
  const copyActions = element('div', 'team-project-actions'); copyActions.append(copy, instructions);
  setup.append(element('h3', '', 'Connect your agent'), element('p', 'muted', 'The key is shown only now. Copy it privately to your agent. Closing this window clears it from the page.'), field('MCP endpoint', endpoint), field('Connection key', key), revealLabel, copyActions);
  const list = element('section', 'document-agent-list'); list.setAttribute('aria-label', tRaw('Invited agents'));
  const refresh = button('Refresh', 'refresh'); refresh.addEventListener('click', () => { if (!busy) void load(); });
  modal.el.append(header, hint, status, form, accessHint, setup, element('h3', '', 'Agents with access'), refresh, list); close.focus();
  const path = `/api/v1/sessions/${encodeURIComponent(sessionId)}/agents`;
  async function request(method: string, suffix = '', body?: unknown): Promise<Response> {
    return instanceFetch(path + suffix, { method, credentials: 'include', signal: abort.signal,
      headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  function render(agents: Agent[]) {
    list.replaceChildren();
    if (!agents.length) list.append(element('p', 'muted', 'No agents invited yet.'));
    for (const agent of agents) {
      const row = element('div', 'document-agent-row'), avatar = element('span', 'document-agent-avatar'); avatar.innerHTML = icon('aiSpark'); avatar.setAttribute('aria-hidden', 'true');
      const info = element('div', 'document-agent-info'), name = element('strong', '', agent.label);
      const state = agentInviteState(agent), stateText = { ready: 'Ready to connect', connected: 'Connected', expired: 'Expired', revoked: 'Revoked' }[state];
      info.append(name, element('p', 'muted', `${agent.role === 'editor' ? 'Editor' : 'Viewer'} · ${stateText}`), element('p', 'muted', `Acts for ${agent.actingFor}`));
      const date = new Date(agent.expiresAt); if (Number.isFinite(date.getTime())) info.append(element('p', 'muted', `Expires ${date.toLocaleString()}`));
      row.append(avatar, info);
      if (agent.canRevoke && state !== 'revoked' && state !== 'expired') {
        const revoke = button('Revoke', 'close'); revoke.title = tRaw('Disconnect this agent and invalidate its key');
        revoke.addEventListener('click', async () => {
          if (busy) return; busy = true; revoke.disabled = true;
          try { const r = await request('DELETE', `/${encodeURIComponent(agent.id)}`); if (!r.ok) throw new Error(); if (current()) { status.textContent = tRaw('Agent access revoked.'); await load(); } }
          catch { if (current()) status.textContent = tRaw('Could not revoke access. Refresh and try again.'); }
          finally { busy = false; revoke.disabled = false; }
        }); row.append(revoke);
      }
      list.append(row);
    }
  }
  async function load() {
    try {
      const response = await request('GET'); if (!response.ok) throw new Error();
      const data = await response.json() as Listing; if (!current()) { modal.close(); return; }
      if (!data.enabled || !Array.isArray(data.agents)) throw new Error();
      const previous = role.value; role.replaceChildren();
      for (const [value, text] of [['viewer', 'Viewer'], ...(data.canEdit ? [['editor', 'Editor']] : [])]) { const o = element('option', '', text); o.value = value!; role.append(o); }
      role.value = previous === 'viewer' || !data.canEdit ? 'viewer' : 'editor';
      form.hidden = false; render(data.agents); if (status.textContent === tRaw('Loading agent invitations…')) status.textContent = '';
    } catch { if (current()) status.textContent = tRaw('Agent invitations could not be loaded. Try Refresh.'); }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !form.reportValidity()) return; busy = true; submit.disabled = true;
    status.textContent = tRaw('Creating invitation…');
    try {
      const r = await request('POST', '', { label: label.value.trim(), role: role.value, hours: Number(hours.value) });
      if (!r.ok) throw new Error(); const data = await r.json() as { secret: string; endpoint: string };
      if (!current()) { modal.close(); return; }
      connection = agentConnection(data.endpoint, data.secret, new URL(instancePath('/api/workspace/mcp'), location.href).href);
      key.value = data.secret; endpoint.value = data.endpoint; setup.hidden = false;
      status.textContent = tRaw('Invitation ready. Copy the connection for your agent.'); await load(); copy.focus();
    } catch { if (current()) status.textContent = tRaw('Invitation was not confirmed. Refresh the list before creating another.'); }
    finally { busy = false; submit.disabled = false; }
  });
  await load();
}
