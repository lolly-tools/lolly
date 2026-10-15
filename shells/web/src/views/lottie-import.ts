// SPDX-License-Identifier: MPL-2.0
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { readLottie, selectLottie, type LottiePackage } from '../../../../engine/src/dotlottie.ts';
import { LOTTIE_LIMITS } from '../../../../engine/src/lottie-model.ts';
import { mountModal } from '../components/modal.ts';
import { t } from '../i18n.ts';

export async function prepareLottieUpload(file: File) {
  if (file.size > LOTTIE_LIMITS.inputBytes) throw new Error(t('That animation exceeds the 64 MB source limit.'));
  const pkg = readLottie(new Uint8Array(await file.arrayBuffer()));
  if (pkg.animations.some(choice => choice.durationMs < 100)) throw new Error(t('Sequence needs animations lasting at least 0.1 seconds.'));
  const selected = selectLottie(pkg);
  return {
    blob: file, format: pkg.version === 'json' ? 'json' : 'lottie',
    width: selected.animation.w, height: selected.animation.h,
    durationMs: selected.durationMs, fps: selected.animation.fr,
    meta: {
      lottieVersion: pkg.version, lottieAnimationId: pkg.initial,
      lottieAnimations: pkg.animations.map(({ id, name, animation, durationMs }) => ({ id, name, width: animation.w, height: animation.h, fps: animation.fr, ip: animation.ip, op: animation.op, durationMs })),
      lottieWarnings: pkg.warnings,
    },
  };
}
/** Selection is copied to the append-only Design animationId field on insertion. */
export async function chooseLottieAsset(ref: AssetRef): Promise<AssetRef | null> {
  if (ref.type !== 'lottie') return ref;
  const player = await import('./lottie-mount.ts');
  const pkg = await player.fetchLottiePackage(ref.url);
  const id = pkg.animations.length === 1 && !pkg.warnings.length ? pkg.initial : await chooseAnimation(pkg, ref.url);
  if (!id) return null;
  const choice = selectLottie(pkg, id);
  if (choice.durationMs < 100) throw new Error(t('Sequence needs animations lasting at least 0.1 seconds.'));
  return { ...ref, width: choice.animation.w, height: choice.animation.h, meta: { ...ref.meta, lottieAnimationId: id, durationMs: choice.durationMs, fps: choice.animation.fr } };
}
async function chooseAnimation(pkg: LottiePackage, url: string): Promise<string | null> {
  const player = await import('./lottie-mount.ts');
  return new Promise(resolve => {
    const modal = mountModal<string>('', { className: 'modal-overlay lottie-choice', ariaLabel: t('Choose an animation'), onClose: value => { player.destroyLottiePlayers(modal.el); resolve(value ?? null); } });
    const card = document.createElement('div'); card.className = 'confirm-dialog';
    card.style.cssText = 'width:min(28rem,90vw);padding:1.5rem;background:var(--ui-color-surface-raised);color:var(--ui-color-text-default);border-radius:1rem';
    const title = document.createElement('h2'); title.textContent = t('Choose an animation');
    const select = document.createElement('select'); select.setAttribute('aria-label', t('Animation'));
    for (const choice of pkg.animations) { const option = document.createElement('option'); option.value = choice.id; option.textContent = `${choice.name} (${(choice.durationMs / 1000).toFixed(2)} s)`; select.append(option); }
    select.value = pkg.initial;
    const preview = document.createElement('div'); preview.style.cssText = 'width:100%;height:240px';
    preview.setAttribute('data-lottie-src', url); preview.setAttribute('data-lottie-autoplay', 'false');
    const description = document.createElement('p'); description.textContent = pkg.warnings.join(' ');
    const use = document.createElement('button'); use.type = 'button'; use.textContent = t('Insert animation');
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = t('Cancel');
    const draw = () => { preview.setAttribute('data-lottie-animation', select.value); void player.mountLottieMarker(preview); };
    select.addEventListener('change', draw);
    use.addEventListener('click', () => modal.close(select.value)); cancel.addEventListener('click', () => modal.close());
    card.append(title, select, preview, description, cancel, use); modal.el.append(card); draw(); select.focus();
  });
}
