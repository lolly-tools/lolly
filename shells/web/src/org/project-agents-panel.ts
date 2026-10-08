// SPDX-License-Identifier: MPL-2.0
/** A project’s agents join through private invitations under their inviters’ identities. */
import { tRaw as t } from '../i18n.ts';
import { copyText } from '../lib/copy-text.ts';
import { projectAgentsAPI, projectAgentInstructions, type ProjectAgentsAPI, type ProjectAgentList } from './project-agents.ts';
import '../styles/project-agents.css';

export function mountProjectAgentsPanel(host: HTMLElement, opts: {
  projectId: string; projectName: string; isCurrent?(): boolean;
  api?: ProjectAgentsAPI; copy?(text: string): Promise<boolean>;
}): () => void {
  let disposed = false, loading = 0;
  const panel = document.createElement('section'); panel.className = 'project-agents';
  const current = () => !disposed && panel.isConnected && (opts.isCurrent?.() ?? true);
  const api = opts.api ?? projectAgentsAPI(opts.projectId, current), copy = opts.copy ?? copyText;
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] => {
    const el = document.createElement(tag); if (text !== undefined) el.textContent = text; return el;
  };
  const action = (label: string, run: () => void) => { const button = node('button', label); button.type = 'button'; button.className = 'btn btn--sm'; button.addEventListener('click', run); return button; };
  const title = node('h3', t('Project agents'));
  const description = node('p', t('Invite an agent to work with your team across this project and its subfolders. Agents use their inviter’s current permissions.'));
  const status = node('p'); status.setAttribute('role', 'status');
  const list = node('div'), formSlot = node('div'), invitationSlot = node('div');
  const refresh = action(t('Refresh'), () => { void load(); });
  panel.append(title, description, refresh, status, list, formSlot, invitationSlot); host.append(panel);
  const say = (error: unknown) => { if (current()) status.textContent = error instanceof Error ? error.message : t('Could not manage agent invitations.'); };
  function paint(data: ProjectAgentList): void {
    list.replaceChildren();
    if (!data.agents.length) list.append(node('p', t('No agents have been invited to this project yet.')));
    for (const agent of data.agents.slice().reverse()) {
      const row = node('article'); row.className = 'project-agent';
      const state = agent.revokedAt ? t('Revoked') : Date.parse(agent.expiresAt) <= Date.now() ? t('Expired') : agent.connected ? t('Connected') : t('Active');
      row.append(node('strong', agent.label), node('p', [agent.role === 'editor' ? t('Editor') : t('Viewer'), state,
        agent.actingFor ? t('Acts for {name}', { name: agent.actingFor }) : ''].filter(Boolean).join(' · ')));
      const expiry = node('time', t('Expires {when}', { when: new Date(agent.expiresAt).toLocaleString() })); expiry.dateTime = agent.expiresAt; row.append(expiry);
      if (agent.canRevoke && !agent.revokedAt && Date.parse(agent.expiresAt) > Date.now()) {
        const revoke = action(t('Revoke invitation'), () => {
          revoke.disabled = true;
          void api.revoke(agent.id).then(() => {
            if (!current()) return;
            if (invitationSlot.dataset.agentId === agent.id) invitationSlot.replaceChildren();
            status.textContent = t('Agent invitation revoked.'); void load();
          }).catch(error => { say(error); revoke.disabled = false; });
        }); row.append(revoke);
      }
      list.append(row);
    }
    formSlot.replaceChildren();
    if (!data.enabled || !data.canInvite) { formSlot.append(node('p', t('Invitations are unavailable while this project is read-only.'))); return; }
    const form = node('form'); form.className = 'project-agent-form';
    const field = (label: string, input: HTMLElement) => { const wrap = node('label', label); wrap.append(input); form.append(wrap); };
    const name = node('input'); name.name = 'label'; name.required = true; name.maxLength = 80; name.className = 'field-input'; name.placeholder = t('Design partner');
    field(t('Agent name'), name);
    const role = node('select'); role.name = 'role'; role.className = 'field-select';
    for (const [value, label] of [['editor', 'Can edit'], ['viewer', 'Can view']] as const) {
      if (value === 'editor' && !data.canEdit) continue;
      const option = node('option', t(label)); option.value = value; role.append(option);
    }
    field(t('Agent access'), role);
    const hours = node('select'); hours.name = 'hours'; hours.className = 'field-select';
    for (const [value, label] of [['1', 'One hour'], ['24', 'One day'], ['168', 'Seven days']] as const) {
      const option = node('option', t(label)); option.value = value; hours.append(option);
    }
    hours.value = '24'; field(t('Invitation expires in'), hours);
    const invite = node('button', t('Create agent invitation')); invite.type = 'submit'; invite.className = 'btn btn--primary'; form.append(invite);
    form.addEventListener('submit', event => {
      event.preventDefault(); if (!name.value.trim() || invite.disabled) return;
      invite.disabled = true; status.textContent = t('Creating agent invitation…');
      void api.create({ label: name.value.trim(), role: role.value === 'editor' ? 'editor' : 'viewer', hours: Number(hours.value) }).then(invitation => {
        if (!current()) return;
        const instructions = projectAgentInstructions(invitation, opts.projectName);
        const text = node('textarea'); text.className = 'field-input'; text.readOnly = true; text.rows = 12; text.value = instructions; text.spellcheck = false; text.setAttribute('aria-label', t('Agent instructions'));
        const copied = action(t('Copy agent instructions'), () => { void copy(instructions).then(ok => { if (current()) status.textContent = ok ? t('Agent instructions copied.') : t('Could not copy. Select the instructions and copy them.'); }).catch(say); });
        invitationSlot.dataset.agentId = invitation.agent.id;
        invitationSlot.replaceChildren(node('h4', t('Agent instructions')), node('p', t('Copy these instructions before leaving. The connection key is shown only now.')), text, copied);
        status.textContent = t('Invitation created. Send the instructions privately to your agent.');
        void load();
      }).catch(say).finally(() => { invite.disabled = false; });
    });
    formSlot.append(form);
  }
  async function load(): Promise<void> {
    const ticket = ++loading; refresh.disabled = true;
    try { const data = await api.list(); if (current() && ticket === loading) paint(data); }
    catch (error) { say(error); }
    finally { if (current() && ticket === loading) refresh.disabled = false; }
  }
  queueMicrotask(() => { if (current()) void load(); });
  return () => { disposed = true; loading++; invitationSlot.replaceChildren(); panel.remove(); };
}
