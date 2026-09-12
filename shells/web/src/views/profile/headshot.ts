// SPDX-License-Identifier: MPL-2.0
/**
 * profile: your details - the opt-in pill, the headshot slot and the form submit.
 *
 * Every function takes the shared `pv: ProfileViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `pv.<module>.<fn>`. Extracted verbatim
 * from mountProfile() by scripts/split-closure.ts.
 */
import type { Profile } from '@lolly-tools/core/host-v1';
import { t } from '../../i18n.ts';
import { playSfx } from '../../lib/sfx.ts';
import { announce } from '../../a11y.ts';
import { openHeadshotCropper } from '../../components/headshot-cropper.ts';
import { sanitizeSvgToString } from '../../bridge/svg-sanitize.ts';
import { DEFAULT_HEADSHOT, HEADSHOT_ID, saveHeadshot } from './shared.ts';
import { bindOp, type ProfileViewCtx } from './context.ts';

export const paintHeadshot = (pv: ProfileViewCtx, url: string) => {
  const { viewEl } = pv;
  pv.headshotUrl = url || '';
  const preview = viewEl.querySelector<HTMLElement>('#headshot-preview');
  if (preview) {
    // Set the image as a background so the overlaid Edit button (and its click
    // listener) is never re-created.
    preview.classList.toggle('is-empty', !pv.headshotUrl);
    // Fall back to the default mark so the circle is never a blank swatch.
    preview.style.backgroundImage = `url('${pv.headshotUrl || DEFAULT_HEADSHOT}')`;
  }
  const uploadBtn = viewEl.querySelector('#headshot-upload');
  if (uploadBtn) uploadBtn.textContent = pv.headshotUrl ? t('Edit') : t('Upload');
  const removeBtn = viewEl.querySelector<HTMLElement>('#headshot-remove');
  if (removeBtn) removeBtn.hidden = !pv.headshotUrl;
};
/** The opt-in pill follows its checkbox. */
export function wireDetailsOptIn(pv: ProfileViewCtx): void {
  const { viewEl } = pv;
  // Opt-in pill reflects the checkbox state (saved on form submit).
  const useDetailsInput = viewEl.querySelector<HTMLInputElement>('[name="useDetails"]'); pv.useDetailsInput = useDetailsInput;
  const optInTag = viewEl.querySelector('.profile-check-tag'); pv.optInTag = optInTag;
  const optInText = viewEl.querySelector('.profile-check-text'); pv.optInText = optInText;
  useDetailsInput?.addEventListener('change', () => {
    const on = useDetailsInput!.checked;
    if (optInTag) optInTag.textContent = on ? t('Opted-in') : t('opt-in');
    if (optInText) optInText.textContent = on ? t('Using my details') : t('Use my details to create');
    // Opt-in plays a rising-then-falling chime, the app's most expressive sound cue; opt-out
    // plays a sad one. (The checkbox's press-tick already played via the global click cue.)
    playSfx(on ? 'optIn' : 'optOut');
  });
}

/** Headshot upload, crop, save and remove. */
export function wireHeadshot(pv: ProfileViewCtx): void {
  const { headshotFileInput, host, viewEl } = pv;
  // The whole circle is the hit-area: a click anywhere on the preview opens the
  // file picker (the Upload/Edit button is just a visual affordance now, and its
  // own click bubbles up here too). The ✕ remove badge handles its own click, so
  // ignore taps that land on it.
  viewEl.querySelector('#headshot-preview')?.addEventListener('click', e => {
    if ((e.target as Element).closest('#headshot-remove')) return;
    headshotFileInput?.click();
  });
  headshotFileInput?.addEventListener('change', async () => {
    const file = headshotFileInput!.files?.[0];
    headshotFileInput!.value = '';
    if (!file) return;
    const errEl = viewEl.querySelector<HTMLElement>('#headshot-error');
    if (errEl) errEl.hidden = true;
    try {
      const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
      if (isSvg) {
        // Vector headshot: keep it vector (tools clip to a circle at render time),
        // so no raster cropper. Sanitise first - an uploaded SVG is untrusted markup.
        const clean = await sanitizeSvgToString(await file.text());
        const ref = await saveHeadshot(host, new Blob([clean], { type: 'image/svg+xml' }), { vector: true });
        pv.headshot.paintHeadshot(ref.url);
        await pv.storage.refreshCounter();
        return;
      }
      const cropped = await openHeadshotCropper(file); // throws on undecodable
      if (!cropped) return; // user cancelled
      const ref = await saveHeadshot(host, cropped.blob);
      pv.headshot.paintHeadshot(ref.url);
      await pv.storage.refreshCounter();
    } catch (err) {
      host.log?.('error', 'Headshot save failed', { error: String(err) });
      // Inline + announced, matching the import-dialog error pattern - not a
      // blocking alert(). e.g. the storage-cap message.
      const msg = String((err as { message?: unknown })?.message ?? err);
      if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
      announce(msg, { assertive: true });
    }
  });
  viewEl.querySelector('#headshot-remove')?.addEventListener('click', async () => {
    await host.assets._deleteUserAsset!(HEADSHOT_ID).catch(() => {});
    const current = await host.profile.get();
    delete current.headshot;
    await host.profile.set!(current);
    pv.headshot.paintHeadshot('');
    await pv.storage.refreshCounter();
  });
}

/** The personal-details form submit. */
export function wireDetailsForm(pv: ProfileViewCtx): void {
  const { host, viewEl } = pv;
  // Personal details form
  viewEl.querySelector('#profile-form')!.addEventListener('submit', async e => {
    e.preventDefault();
    // Either the native submit button or its jelly-mode <jelly-button> stand-in;
    // disabling goes through the ATTRIBUTE (jelly-button observes it and syncs
    // its shadow button; on a native button it's equivalent to .disabled).
    const btn = (e.target as HTMLFormElement).querySelector<HTMLElement>('button[type="submit"], jelly-button[type="submit"]');
    const label = btn?.textContent ?? t('Save');
    btn?.toggleAttribute('disabled', true);
    const data = Object.fromEntries(new FormData(e.target as HTMLFormElement).entries());
    // Checkboxes aren't reliably in FormData (omitted when unchecked), so read it explicitly.
    const useDetails = (e.target as HTMLFormElement).querySelector<HTMLInputElement>('[name="useDetails"]')?.checked ?? false;
    delete data.useDetails;
    try {
      const current = await host.profile.get();
      // The FormData rows are dynamic string/File pairs; the merged record is a Profile.
      await host.profile.set!({ ...current, ...data, useDetails } as unknown as Profile);
      if (btn) btn.textContent = t('Saved');
      playSfx('saveProfile');   // an "all set" confirmation chime on a successful save
      announce(t('Profile saved'));
      // Stay on the page; restore the button shortly after so users can keep editing.
      setTimeout(() => { if (btn) { btn.textContent = label; btn.toggleAttribute('disabled', false); } }, 1600);
    } catch {
      if (btn) { btn.textContent = label; btn.toggleAttribute('disabled', false); }
      announce(t("Couldn't save - try again"), { assertive: true });
    }
  });
}

export function headshotOps(pv: ProfileViewCtx) {
  return {
    paintHeadshot: bindOp(pv, paintHeadshot),
    wireDetailsOptIn: bindOp(pv, wireDetailsOptIn),
    wireHeadshot: bindOp(pv, wireHeadshot),
    wireDetailsForm: bindOp(pv, wireDetailsForm),
  };
}
