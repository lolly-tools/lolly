// SPDX-License-Identifier: MPL-2.0
/**
 * Send to {host}: what this copy changes on the instance, shown before anything is
 * sent. The instance compares the document with its mounted one and decides, so this
 * sheet reports that answer rather than guessing.
 */
import { mountModal } from '../../components/modal.ts';
import { t, tRaw } from '../../i18n.ts';
import { icon } from '../icons.ts';
import { sha256Hex } from '../../../../../engine/src/bytes.ts';
import type { BrandEditHostingV1, BrandEditLineV1, BrandEditPreviewV1 } from '../brand-page-hosting.ts';
import { buildInstanceEdit, noteInstanceEditSent, restartInstanceEdit, type InstanceEdit, type InstanceEditHost } from './instance-edit.ts';
import type { ActiveRecord } from './active.ts';

type EditingCopy = ActiveRecord;
import '../../styles/parts/brand-page.css';

/** Past this, the rest of the list is one step away. */
const SHOWN_LINES = 8;

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

/** A swatch only for a value that reads as a colour, painted by the browser's own parser. */
function swatch(value: string | null): HTMLElement | null {
  if (!value || !globalThis.CSS?.supports?.('color', value)) return null;
  const chip = node('span', 'ie-swatch');
  chip.style.background = value;
  return chip;
}

function valueCell(value: string): HTMLElement {
  const cell = node('span', 'ie-value');
  const chip = swatch(value);
  if (chip) cell.append(chip);
  cell.append(node('span', 'ie-value-text', value));
  return cell;
}

const ACTION: Record<BrandEditLineV1['action'], () => string> = {
  added: () => t('Added'), changed: () => t('Changed'), removed: () => t('Removed'),
};

function lineRow(line: BrandEditLineV1): HTMLElement {
  const row = node('li', 'ie-line');
  const name = node('span', 'ie-line-name', line.label ?? line.name);
  if (line.label) name.title = line.name;
  row.append(name);
  const values = node('span', 'ie-line-values');
  if (line.before) values.append(valueCell(line.before));
  if (line.before && line.after) values.append(node('span', 'ie-arrow', '→'));
  if (line.after) values.append(valueCell(line.after));
  if (!line.before && !line.after) values.append(node('span', 'ie-action', ACTION[line.action]()));
  row.append(values);
  return row;
}

/** One sentence each, in the order a person needs them. */
function whatFollows(preview: BrandEditPreviewV1, staysHere: InstanceEdit['staysHere'], host: string): string[] {
  const out = [preview.approval
    ? tRaw('This waits for approval, then goes live on {host}.', { host })
    : tRaw('People on {host} get this at their next sync.', { host })];
  out.push(t('Previews and social cards keep their old colours until the next image.'));
  if (preview.connect === 'withdrawn') out.push(t('New apps cannot download a connect pack until this edit is rolled back or a new pack is uploaded.'));
  if (staysHere.length) {
    const words = { fonts: t('fonts'), logos: t('logos'), other: t('other settings') };
    out.push(tRaw('Changes to {list} stay on this device.', { list: staysHere.map(kind => words[kind]).join(', ') }));
  }
  return out;
}

/** Open the sheet for one editing copy. Resolves when it closes. */
export async function openInstanceEditSheet(host: InstanceEditHost, record: EditingCopy, hosting: BrandEditHostingV1): Promise<void> {
  let alive = true;
  let settle: () => void = () => {};
  const closed = new Promise<void>(resolve => { settle = resolve; });
  const title = tRaw('Send to {host}', { host: hosting.host });
  const modal = mountModal(`
    <header class="bp-head">
      <div>
        <h2 class="modal-title">${title}</h2>
        <p class="bp-intro">${t('Colours, colour roles and the brand page address.')}</p>
      </div>
      <button type="button" class="bp-close" data-ie-close aria-label="${t('Close')}">${icon('close', { size: 20 })}</button>
    </header>
    <div class="ie-body" data-ie-body><p class="bp-note">${t('Comparing with the instance…')}</p></div>
    <footer class="bp-foot">
      <p class="bp-status" data-ie-status role="status" aria-live="polite"></p>
      <div class="bp-actions">
        <button type="button" class="be-btn" data-ie-restart hidden>${tRaw('Start again from {host}', { host: hosting.host })}</button>
        <a class="be-btn" data-ie-open target="_blank" rel="noopener noreferrer" hidden>${icon('externalLink', { size: 16 })}<span>${t('Open the console')}</span></a>
        <button type="button" class="be-cta is-active" data-ie-send disabled>${icon('globe', { size: 16 })}<span>${title}</span></button>
      </div>
    </footer>
  `, { className: 'modal brand-page-sheet instance-edit-sheet', ariaLabel: title, onClose: () => { alive = false; settle(); } });
  const el = modal.el;
  const body = el.querySelector<HTMLElement>('[data-ie-body]')!;
  const status = el.querySelector<HTMLElement>('[data-ie-status]')!;
  const sendBtn = el.querySelector<HTMLButtonElement>('[data-ie-send]')!;
  const restartBtn = el.querySelector<HTMLButtonElement>('[data-ie-restart]')!;
  const openLink = el.querySelector<HTMLAnchorElement>('[data-ie-open]')!;
  el.querySelector('[data-ie-close]')!.addEventListener('click', () => modal.close());
  const say = (message: string): void => { status.textContent = message; };
  openLink.href = `${hosting.base}/admin#/instance?tab=design`;

  let current = record;
  const review = async (): Promise<void> => {
    sendBtn.disabled = true;
    say('');
    try {
      const document = await hosting.read();
      const head = await host.assets._getBlob(current.headId);
      if (!head) throw new Error(t('This copy could not be read.'));
      const copy = JSON.parse(await head.text()) as Record<string, unknown>;
      const edit = buildInstanceEdit(JSON.parse(document.base) as Record<string, unknown>, copy);
      const text = JSON.stringify(edit.doc);
      const preview = await hosting.preview({ document: text, base: document.baseChecksum });
      if (!alive) return;
      const servedDigest = await sha256Hex(new TextEncoder().encode(document.served));
      const moved = servedDigest !== current.instanceEdit?.servedDigest && servedDigest !== preview.digest;
      restartBtn.hidden = !moved;
      restartBtn.onclick = () => {
        restartBtn.disabled = true;
        void restartInstanceEdit(host, current, document).then(next => {
          current = next;
          restartBtn.disabled = false;
          globalThis.dispatchEvent?.(new Event('lolly:design-system-changed'));
          return review();
        }).catch((error: unknown) => { restartBtn.disabled = false; say(error instanceof Error ? error.message : String(error)); });
      };
      const out: HTMLElement[] = [];
      if (moved) out.push(node('p', 'ie-moved', tRaw('{host} has changed since this copy was made. Sending replaces those changes.', { host: hosting.host })));
      if (preview.outOfScope.length || preview.invalid.length) {
        out.push(node('h3', 'ie-heading', t('This cannot be sent')));
        const list = node('ul', 'ie-refused');
        for (const line of [...preview.invalid, ...preview.outOfScope.map(where => tRaw('It also changes {where}, which {host} does not take from here.', { where, host: hosting.host }))]) list.append(node('li', '', line));
        out.push(list);
      } else if (preview.unchanged || !preview.lines.length) {
        out.push(node('p', 'bp-note', tRaw('This copy matches {host}. There is nothing to send.', { host: hosting.host })));
      } else {
        out.push(node('h3', 'ie-heading', t('What changes')));
        const rows = preview.lines.map(lineRow);
        const list = node('ul', 'ie-lines');
        list.append(...rows.slice(0, SHOWN_LINES));
        out.push(list);
        if (rows.length > SHOWN_LINES) {
          const more = node('details', 'ie-more');
          more.append(node('summary', '', tRaw('{n} more', { n: rows.length - SHOWN_LINES })));
          const rest = node('ul', 'ie-lines');
          rest.append(...rows.slice(SHOWN_LINES));
          more.append(rest);
          out.push(more);
        }
        for (const line of whatFollows(preview, edit.staysHere, hosting.host)) out.push(node('p', 'bp-note', line));
        sendBtn.disabled = false;
        sendBtn.onclick = () => {
          sendBtn.disabled = true;
          say(t('Sending…'));
          void hosting.send({ document: text, base: document.baseChecksum, revision: preview.revision, reviewToken: preview.reviewToken }).then(async sent => {
            if (sent.state === 'live') current = await noteInstanceEditSent(host, current, text);
            if (!alive) return;
            say(sent.state === 'pending'
              ? tRaw('Sent. It goes live on {host} once approved.', { host: hosting.host })
              : tRaw('Live on {host}. People get it at their next sync.', { host: hosting.host }));
            openLink.hidden = false;
            restartBtn.hidden = true;
            sendBtn.hidden = true;
          }).catch((error: unknown) => {
            if (!alive) return;
            sendBtn.disabled = false;
            say(error instanceof Error ? error.message : String(error));
          });
        };
      }
      body.replaceChildren(...out);
    } catch (error) {
      if (!alive) return;
      body.replaceChildren(node('p', 'bp-note', error instanceof Error ? error.message : String(error)));
    }
  };
  void review();
  return closed;
}
