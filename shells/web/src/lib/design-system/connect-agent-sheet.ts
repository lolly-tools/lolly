// SPDX-License-Identifier: MPL-2.0
/**
 * Connect an agent: paste-ready setup for the common clients and the design system's
 * `AGENTS.md`, each with a plain line on what it can do. A server draws with its own
 * design system, so the public server draws Lolly Demo and the sheet says so. A secret
 * never appears here: an instance's settings name an environment variable, and the
 * token stays with the person who minted the token.
 */
import { mountModal } from '../../components/modal.ts';
import { t, tRaw } from '../../i18n.ts';
import { icon } from '../icons.ts';
import { copyText } from '../copy-text.ts';
import { segHtml } from '../seg.ts';
import { connectedInstance } from '../brand-page-hosting.ts';
import { assembleBrandPage, EMPTY_CHOICES, readBrandPageSources, type BrandPageHost } from './brand-page-sources.ts';
import { clientSetup, PUBLIC_MCP_URL, PUBLIC_SERVER_SYSTEM, TOKEN_ENV, type AgentClient } from './agent-setup.ts';
import '../../styles/parts/brand-page.css';

const CLIENTS: ReadonlyArray<{ id: AgentClient; label: string }> = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'vscode', label: 'VS Code' },
];

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

/** Text to paste: where it goes, its Copy button, then the text. */
function pasteBlock(copyButton: HTMLTemplateElement, where: string, text: string, label: string, onCopied: (ok: boolean) => void): HTMLElement {
  const box = node('div', 'bp-paste');
  const head = node('div', 'bp-paste-head');
  const copy = copyButton.content.firstElementChild!.cloneNode(true) as HTMLButtonElement;
  copy.setAttribute('aria-label', label);
  copy.addEventListener('click', () => { void copyText(text).then(onCopied); });
  head.append(node('code', 'bp-paste-where', where), copy);
  const pre = node('pre', 'bp-paste-text', text);
  pre.tabIndex = 0;
  box.append(head, pre);
  return box;
}

/** Open the sheet. Resolves when it closes. */
export function openConnectAgentSheet(host: BrandPageHost): Promise<void> {
  let settle: () => void = () => {};
  const closed = new Promise<void>(resolve => { settle = resolve; });
  let alive = true;
  const instance = connectedInstance();
  const modal = mountModal(`
    <header class="bp-head">
      <div>
        <h2 class="modal-title">${t('Connect an agent')}</h2>
        <p class="bp-intro">${t('Choose how much an agent can do.')}</p>
      </div>
      <button type="button" class="bp-close" data-ca-close aria-label="${t('Close')}">${icon('close', { size: 20 })}</button>
    </header>
    <div class="ca-body">
      <section class="ca-option">
        <h3>${t('AGENTS.md in a project')}</h3>
        <p class="bp-line">${t('Agents read this system’s names and rules.')}</p>
        <p class="bp-line">${t('It draws nothing, and needs no server or key.')}</p>
        <div class="ca-agents" data-ca-agents>
          <p class="bp-note" data-ca-agents-note>${t('Reading this design system…')}</p>
          <div class="ca-actions" data-ca-agents-actions hidden>
            <button type="button" class="be-btn" data-ca-agents-copy>${icon('clipboard', { size: 16 })}<span>${t('Copy AGENTS.md')}</span></button>
            <button type="button" class="be-btn" data-ca-agents-save>${icon('download', { size: 16 })}<span>${t('Download AGENTS.md')}</span></button>
          </div>
        </div>
      </section>
      <section class="ca-option">
        <h3>${t('A server that draws')}</h3>
        <p class="bp-line">${t('Each server draws with its own design system.')}</p>
        <div class="ca-clients" data-ca-clients>${segHtml('ca-client', CLIENTS, 'claude', t('MCP client'))}</div>
        <div data-ca-servers></div>
        <template data-ca-copy><button type="button" class="be-btn">${icon('clipboard', { size: 16 })}<span>${t('Copy')}</span></button></template>
      </section>
      <p class="bp-status" data-ca-status role="status" aria-live="polite"></p>
    </div>
  `, { className: 'modal brand-page-sheet connect-agent-sheet', ariaLabel: t('Connect an agent'), onClose: () => { alive = false; settle(); } });
  const el = modal.el;
  const status = el.querySelector<HTMLElement>('[data-ca-status]')!;
  const say = (message: string): void => { status.textContent = message; };
  const copied = (ok: boolean): void => say(ok ? t('Copied.') : t('Could not copy. Select the text and copy it yourself.'));
  el.querySelector('[data-ca-close]')!.addEventListener('click', () => modal.close());
  const copyButton = el.querySelector<HTMLTemplateElement>('[data-ca-copy]')!;

  let client: AgentClient = 'claude';
  // The name decides one line: the public server draws this system only when this system is Lolly Demo.
  let systemName = '';
  const paintServers = (): void => {
    const out: HTMLElement[] = [];
    const isDemo = systemName.trim().toLowerCase() === PUBLIC_SERVER_SYSTEM.toLowerCase();
    const publicBlock = node('div', 'ca-server');
    publicBlock.append(node('h4', '', t('Lolly’s public server')));
    publicBlock.append(node('p', 'bp-line', isDemo || !systemName
      ? tRaw('Draws with {system}.', { system: PUBLIC_SERVER_SYSTEM })
      : tRaw('Draws with {system}, not {name}.', { system: PUBLIC_SERVER_SYSTEM, name: systemName })));
    publicBlock.append(node('p', 'bp-line', t('It needs no key, and has a daily budget.')));
    const setup = clientSetup(client, 'lolly', PUBLIC_MCP_URL);
    publicBlock.append(pasteBlock(copyButton, setup.where, setup.text, t('Copy the public server setup'), copied));
    out.push(publicBlock);
    if (instance) {
      const own = node('div', 'ca-server');
      own.append(node('h4', '', tRaw('Your instance, {host}', { host: instance.host })));
      own.append(node('p', 'bp-line', t('Draws with the design systems this instance holds.')));
      own.append(node('p', 'bp-line', tRaw('It reads a service token from {env}. Your administrator can mint one.', { env: TOKEN_ENV })));
      const mine = clientSetup(client, 'lolly-work', instance.mcpUrl, TOKEN_ENV);
      own.append(pasteBlock(copyButton, mine.where, mine.text, t('Copy the instance setup'), copied));
      out.push(own);
    } else if (!isDemo) {
      const none = node('div', 'ca-server');
      none.append(node('h4', '', systemName || t('This design system')));
      none.append(node('p', 'bp-line', t('No hosted server draws with this design system yet.')));
      none.append(node('p', 'bp-line', t('A Lolly Work instance can host one for the systems it holds.')));
      out.push(none);
    }
    el.querySelector('[data-ca-servers]')!.replaceChildren(...out);
  };
  paintServers();
  el.querySelector('[data-ca-clients]')!.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-val]');
    const next = button?.dataset.val as AgentClient | undefined;
    if (!button || !next || !CLIENTS.some(row => row.id === next)) return;
    client = next;
    el.querySelectorAll('[data-ca-clients] button').forEach(other => { other.setAttribute('aria-pressed', String(other === button)); });
    paintServers();
  });

  void (async () => {
    const box = el.querySelector<HTMLElement>('[data-ca-agents]')!;
    const note = el.querySelector<HTMLElement>('[data-ca-agents-note]')!;
    try {
      const sources = await readBrandPageSources(host, { allowManaged: !!instance?.brandPages });
      if (!alive) return;
      if (!sources) { note.textContent = t('Add colours, type or logos first, then come back.'); return; }
      systemName = sources.name;
      paintServers();
      const build = await assembleBrandPage(sources, EMPTY_CHOICES);
      if (!alive) return;
      const file = build.files.find(row => row.path === 'AGENTS.md');
      const text = file ? new TextDecoder().decode(file.bytes) : '';
      el.querySelector('[data-ca-agents-copy]')!.addEventListener('click', () => { void copyText(text).then(copied); });
      el.querySelector('[data-ca-agents-save]')!.addEventListener('click', () => {
        void Promise.resolve(host.export.download(new Blob([text], { type: 'text/markdown' }), 'AGENTS.md')).then(() => say(t('Downloaded.')), () => say(t('Could not save the file. Please try again.')));
      });
      const read = node('details', 'bp-more');
      read.append(node('summary', '', t('Read the file')));
      const pre = node('pre', 'bp-paste-text', text);
      pre.tabIndex = 0;
      read.append(pre);
      note.hidden = true;
      el.querySelector<HTMLElement>('[data-ca-agents-actions]')!.hidden = false;
      box.append(read);
    } catch { if (alive) note.textContent = t('Could not read this design system. Please try again.'); }
  })();
  return closed;
}
