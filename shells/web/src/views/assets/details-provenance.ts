// SPDX-License-Identifier: MPL-2.0
/** Authorship declarations beside the asset's origins and Content Credentials. */
import { announce } from '../../a11y.ts';
import { promptDialog } from '../../components/confirm-dialog.ts';
import { t, tRaw } from '../../i18n.ts';
import { readAuthorDeclaration, withAuthorDeclaration } from '../../lib/asset-authorship.ts';
import { bindOp, type DetailsCtx } from './details-context.ts';

export function renderAuthorship(dt: DetailsCtx): void {
  const { dlg, ref, isUser } = dt;
  const box = dlg.querySelector<HTMLElement>('[data-authorship]');
  if (!box) return;
  box.replaceChildren();
  const declaration = readAuthorDeclaration(ref.meta);
  const state = document.createElement('span');
  state.className = 'cat-origins-state';
  state.textContent = declaration ? tRaw('{name} · self-declared', { name: declaration.name }) : t('Not declared');
  box.append(state);
  if (!isUser) return;
  const controls = document.createElement('span');
  controls.className = 'cat-origins-ctl';
  const button = (label: string, act: string): HTMLButtonElement => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'btn cat-origin-btn';
    el.dataset.act = act;
    el.textContent = label;
    return el;
  };
  controls.append(button(declaration ? t('Edit author declaration') : t('Claim authorship'), 'author-declare'));
  if (declaration) controls.append(button(t('Remove declaration'), 'author-clear'));
  box.append(controls);
}

export async function updateAuthorship(dt: DetailsCtx, clear: boolean): Promise<void> {
  const { cat, dlg, host, ref, isUser } = dt;
  if (!isUser) return;
  let name: string | null = null;
  if (!clear) {
    const profile = cat.profile;
    const current = readAuthorDeclaration(ref.meta)?.name ?? [profile?.firstname, profile?.lastname].filter(Boolean).join(' ');
    name = await promptDialog({
      title: t('Claim authorship'),
      message: t('Declare that you are the author of this work. This saves your name with the asset record; existing credits, AI origins and signed Content Credentials stay intact.'),
      value: current,
      placeholder: t('Author name'),
      confirmLabel: t('Save declaration'),
    });
    if (name === null || cat.detailsDialog !== dlg) return;
    if (!name.trim() || name.trim().length > 200) { announce(t('Enter an author name of up to 200 characters.')); return; }
  }
  const buttons = [...dlg.querySelectorAll<HTMLButtonElement>('[data-authorship] button')];
  buttons.forEach(button => { button.disabled = true; });
  try {
    const rec = (await host.assets._exportUserAssets()).find(r => r.id === ref.id);
    if (!rec) throw new Error('Asset no longer exists');
    const at = new Date().toISOString();
    const meta = withAuthorDeclaration(rec.meta, name, at);
    await host.assets._updateUserAssetMeta(ref.id, meta);
    // Reflect only this field: AI flags on a resolved ref may come from its preserved credential.
    ref.meta = withAuthorDeclaration(ref.meta, name, at) as typeof ref.meta;
    if (cat.detailsDialog === dlg) renderAuthorship(dt);
    announce(clear ? t('Author declaration removed.') : t('Authorship saved as your declaration.'));
  } catch {
    buttons.forEach(button => { button.disabled = false; });
    announce(t('Could not save the author declaration.'));
  }
}

export function provenanceOps(dt: DetailsCtx) {
  return {
    renderAuthorship: bindOp(dt, renderAuthorship),
    updateAuthorship: bindOp(dt, updateAuthorship),
  };
}
