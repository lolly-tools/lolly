// SPDX-License-Identifier: MPL-2.0
/**
 * share-through-section - the "Share through <provider>" section of the Share dialog.
 *
 * Registers into the generic lib/share-sections.ts seam as a side effect of import
 * (main.ts imports it beside the other self-registering sections). The section is
 * additive: it renders nothing unless the person has a connected provider that can
 * make links and the dialog is over a document it can build as a `.lolly` file, so a
 * plain build's dialog is unchanged.
 *
 * Choosing it sends the `.lolly` file to the provider the person picked, then asks
 * the provider for the link they chose. The provider list is read when the dialog
 * opens (built-in targets are loaded on demand, here), and the heavy panel code is
 * imported only then.
 */

import { registerShareSection } from './share-sections.ts';
import type { ShareSectionContext } from './share-sections.ts';
import { canShare, sendTargetId, sendTargetsFor, type SendTarget } from './send-target.ts';
import { primeShareState } from './share-links.ts';
import { t } from '../i18n.ts';

/** Targets that can both take a `.lolly` file and make a link for that file. */
export function shareThroughTargets(): SendTarget[] {
  return sendTargetsFor('lolly').filter(canShare);
}

export async function buildShareThroughSection(ctx: ShareSectionContext): Promise<HTMLElement | null> {
  if (!ctx.file) return null;
  const { ensureBuiltinSendTargets } = await import('./send-targets-builtin.ts');
  await ensureBuiltinSendTargets().catch(() => { /* no providers to offer */ });
  await primeShareState();
  const targets = shareThroughTargets();
  if (!targets.length) return null;

  const [{ createShareLinkPanel }, { buildSharedLinksList }] = await Promise.all([
    import('../components/share-link-panel.ts'),
    import('../components/shared-links-list.ts'),
  ]);

  const section = document.createElement('section');
  section.className = 'share-through';
  const heading = document.createElement('h3');
  heading.textContent = t('Share through your cloud');
  const hint = document.createElement('p');
  hint.textContent = t('Sends this file to a service you connected, then makes a link there. The file goes from this device to the service; Lolly keeps no copy.');
  hint.style.cssText = 'margin:0 0 .5rem;font-size:.85rem;color:hsl(var(--muted-foreground))';

  const pick = document.createElement('select');
  pick.setAttribute('aria-label', t('Provider'));
  for (const tg of targets) pick.append(Object.assign(document.createElement('option'), { value: sendTargetId(tg), textContent: tg.label }));
  const host = document.createElement('div');
  host.style.cssText = 'margin-top:.5rem';

  const mountPanel = (): void => {
    const target = targets.find((x) => sendTargetId(x) === pick.value)!;
    let sent: { ref: string; openUrl?: string; fileName: string } | null = null;
    host.replaceChildren(createShareLinkPanel({
      target,
      fileName: '',
      actionLabel: t('Send and copy link'),
      copy: ctx.copy,
      getRef: async () => {
        // One send per provider choice: asking again for a narrower audience reuses the file.
        if (sent) return sent;
        const { blob, filename } = await ctx.file!();
        const out = await target.send({
          bytes: new Uint8Array(await blob.arrayBuffer()), name: filename.replace(/\.lolly$/i, ''), format: 'lolly', mime: blob.type || 'application/octet-stream',
        });
        if (!out.ref) throw new Error(t('This provider did not say where the file went, so it cannot make a link.'));
        sent = { ref: out.ref, ...(out.url ? { openUrl: out.url } : {}), fileName: filename };
        return sent;
      },
      onCreated: () => { void refreshList(); },
    }));
  };
  const listHost = document.createElement('div');
  const refreshList = async (): Promise<void> => {
    const list = await buildSharedLinksList();
    listHost.replaceChildren(...(list && !list.hidden ? [list] : []));
  };
  pick.addEventListener('change', mountPanel);
  mountPanel();
  await refreshList();

  section.append(heading, hint, pick, host, listHost);
  return section;
}

registerShareSection(buildShareThroughSection, { sharesToNetwork: false });
