// SPDX-License-Identifier: MPL-2.0
/**
 * share-link-panel - the controls for turning a file that sits at a provider into a
 * link: who can open it, how long, a password where the provider has one, and the
 * plain statement of what will happen.
 *
 * One panel serves two places: the Share dialog's "Share through your cloud" section
 * (which sends first, then links) and the notice under an ordinary Send (the file is
 * already there). The caller supplies `getRef`, which resolves the provider's handle
 * for the file; everything else is the same.
 *
 * Wording rules the panel keeps: it says who can open the link, where the file
 * lives, when the link stops, whether it can be switched off, and that Lolly holds
 * no copy of the link or any token on a server. When the provider or an
 * administrator refuses an audience it says so and offers the narrower ones as
 * choices the person makes; it never picks one for them.
 */

import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import { safeHref } from '../utils.ts';
import { SHARE_AUDIENCES, type SendTarget, type ShareAudience, type SharedLinkRecord } from '../lib/send-target.ts';
import { audienceLabel, audienceSentence, createShareLink } from '../lib/share-links.ts';

export interface ShareLinkPanelOpts {
  target: SendTarget;
  fileName: string;
  /** Resolve the provider's handle for the file, sending it first when needed. */
  getRef: () => Promise<{ ref: string; openUrl?: string; fileName?: string }>;
  /** The main button: "Create link" or "Send and copy link". */
  actionLabel: string;
  copy: (text: string) => Promise<void>;
  /** Where to send a person when this connection cannot make links itself. */
  openUrl?: string;
  onCreated?: (record: SharedLinkRecord) => void;
}

const EXPIRY_CHOICES = [1, 7, 30, 90];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: Array<Node | string>): HTMLElementTagNameMap[K] {
  const { cls, ...rest } = props as { cls?: string };
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  Object.assign(node, rest);
  node.append(...kids);
  return node;
}

function field(label: string, control: HTMLElement): HTMLLabelElement {
  const row = el('label', { cls: 'share-link-field' });
  row.style.cssText = 'display:flex;flex-direction:column;gap:.25rem;font-size:.85rem';
  row.append(el('span', {}, label), control);
  return row;
}

/** The plain-language statement under the controls. Pure for tests. */
export function shareStatement(target: Pick<SendTarget, 'kind' | 'label' | 'shareCapabilities'>, audience: ShareAudience, days: number | undefined): string[] {
  const caps = target.shareCapabilities!();
  const lines = [
    audienceSentence(audience),
    t('The file stays in your {provider}.', { provider: target.label }),
    days !== undefined ? t('The link stops working after {n} days.', { n: days }) : t('The link does not expire.'),
    caps.revocable ? t('You can switch it off any time with Stop sharing.') : t('It cannot be switched off early; it works until it expires.'),
  ];
  if (audience === 'people' && target.kind === 'gdrive') lines.push(t('Google emails each person you name.'));
  lines.push(
    t('Lolly keeps no copy of the link and no sign-in token on a server.'),
    t("The provider's preview may remove Content Credentials. The file people download keeps them."),
  );
  return lines;
}

export function createShareLinkPanel(opts: ShareLinkPanelOpts): HTMLElement {
  const { target } = opts;
  const caps = target.shareCapabilities!();
  const root = el('div', { cls: 'share-link-panel' });
  root.style.cssText = 'display:flex;flex-direction:column;gap:.6rem';

  if (!caps.audiences.length) {
    // This connection was found unable to make links (OneDrive's app-folder token).
    root.append(el('p', {}, t('{provider} does not let Lolly make links for this connection.', { provider: target.label })));
    if (opts.openUrl && safeHref(opts.openUrl)) {
      root.append(el('a', { href: opts.openUrl, target: '_blank', rel: 'noopener' }, t('Open {provider} to share', { provider: target.label })));
    }
    return root;
  }

  const audience = el('select');
  audience.dataset.shareAudience = '';
  for (const a of SHARE_AUDIENCES.filter((x) => caps.audiences.includes(x))) audience.append(el('option', { value: a }, audienceLabel(a)));
  root.append(field(t('Who can open it'), audience));

  const people = el('input', { type: 'text', placeholder: t('name@example.org, other@example.org') });
  people.dataset.sharePeople = '';
  const peopleRow = field(t('Email addresses'), people);
  peopleRow.hidden = true;
  root.append(peopleRow);

  const expiry = el('select');
  expiry.dataset.shareExpiry = '';
  if (caps.expiry) {
    const max = caps.maxExpiryDays ?? Infinity;
    if (!caps.expiryRequired) expiry.append(el('option', { value: '' }, t('Until I stop sharing')));
    for (const d of EXPIRY_CHOICES.filter((x) => x <= max)) expiry.append(el('option', { value: String(d) }, t('{n} days', { n: d })));
    if (caps.expiryRequired) expiry.value = String(Math.min(7, max));
    root.append(field(t('Link lasts'), expiry));
  }

  const password = el('input', { type: 'password', autocomplete: 'new-password' });
  password.dataset.sharePassword = '';
  if (caps.password) root.append(field(t('Password (optional)'), password));

  const statement = el('ul');
  statement.style.cssText = 'margin:0;padding-left:1.1rem;font-size:.82rem;color:hsl(var(--muted-foreground))';
  root.append(statement);

  const days = (): number | undefined => (caps.expiry && expiry.value ? Number(expiry.value) : undefined);
  const refresh = (): void => {
    const a = audience.value as ShareAudience;
    peopleRow.hidden = a !== 'people';
    statement.replaceChildren(...shareStatement(target, a, days()).map((line) => el('li', {}, line)));
  };
  audience.addEventListener('change', refresh);
  expiry.addEventListener('change', refresh);
  refresh();

  const go = el('button', { type: 'button', cls: 'btn btn--sm' }, opts.actionLabel);
  go.dataset.shareGo = '';
  const out = el('div');
  out.setAttribute('role', 'status');
  out.setAttribute('aria-live', 'polite');
  root.append(go, out);

  const show = (...kids: Array<Node | string>): void => { out.replaceChildren(...kids); };

  go.addEventListener('click', async () => {
    go.disabled = true;
    go.setAttribute('aria-busy', 'true');
    show(t('Working...'));
    try {
      const { ref, openUrl, fileName } = await opts.getRef();
      const a = audience.value as ShareAudience;
      const result = await createShareLink(target, ref, fileName ?? opts.fileName, {
        audience: a,
        ...(a === 'people' ? { people: people.value.split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean) } : {}),
        ...(caps.password && password.value ? { password: password.value } : {}),
        ...(days() !== undefined ? { expiresInDays: days()! } : {}),
      });
      if (result.ok) {
        const box = el('input', { type: 'text', readOnly: true, value: result.link.url });
        box.setAttribute('aria-label', t('Share link'));
        box.style.cssText = 'width:100%';
        const copy = el('button', { type: 'button', cls: 'btn btn--sm' }, t('Copy link'));
        copy.addEventListener('click', () => { void opts.copy(result.link.url).then(() => announce(t('Link copied'))); });
        const kids: Array<Node | string> = [
          el('p', {}, `${audienceSentence(result.link.audience)} ${t('It lives in your {provider}.', { provider: target.label })}`),
          box, copy,
        ];
        for (const n of result.link.notes ?? []) kids.push(el('p', {}, n));
        show(...kids);
        void opts.copy(result.link.url).then(() => announce(t('Link copied')), () => { /* the Copy button is there */ });
        opts.onCreated?.(result.record);
      } else if (result.kind === 'refused') {
        const kids: Array<Node | string> = [el('p', {}, result.message)];
        if (result.narrower.length) {
          kids.push(el('p', {}, t('You can choose a narrower audience instead:')));
          for (const n of result.narrower) {
            const b = el('button', { type: 'button', cls: 'btn btn--sm' }, audienceLabel(n));
            b.addEventListener('click', () => { audience.value = n; refresh(); show(t('Press {action} to make the link.', { action: opts.actionLabel })); });
            kids.push(b);
          }
        }
        show(...kids);
      } else {
        const kids: Array<Node | string> = [el('p', {}, result.message)];
        const href = result.handoffUrl ?? openUrl ?? opts.openUrl;
        if (href && safeHref(href)) kids.push(el('a', { href, target: '_blank', rel: 'noopener' }, t('Open {provider} to share', { provider: target.label })));
        show(...kids);
      }
    } catch (err) {
      const msg = String((err as Error)?.message || '');
      show(msg && msg.length <= 200 ? msg : t('Could not make the link - try again'));
      announce(t('Could not make the link'), { assertive: true });
    } finally {
      go.disabled = false;
      go.removeAttribute('aria-busy');
    }
  });

  return root;
}
