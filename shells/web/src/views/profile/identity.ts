// SPDX-License-Identifier: MPL-2.0
/**
 * profile: the Content Credentials card - enrolment, status and forgetting the identity.
 *
 * Every function takes the shared `pv: ProfileViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `pv.<module>.<fn>`. Extracted verbatim
 * from mountProfile() by scripts/split-closure.ts.
 */
import { docsAppHref, t, tRaw } from '../../i18n.ts';
import { staggerReveal } from '../../lib/reveal.ts';
import { escape as escapeText } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { verifyLink } from './shared.ts';
import type { CaHealth, IdentityStatus } from './shared.ts';
import { bindOp, type ProfileViewCtx } from './context.ts';

export const identityBody = (pv: ProfileViewCtx) => { const { viewEl } = pv; return viewEl.querySelector<HTMLElement>('#identity-body'); };
export const caHealth = (pv: ProfileViewCtx): Promise<CaHealth | null> => (pv.caHealthP ??= fetch('/api/ca/health').then(r => r.json()).catch(() => null));
// Inline + announced, matching the headshot/import error pattern.
export function showIdentityError(pv: ProfileViewCtx, msg: string) {
  const el = identityBody(pv)?.querySelector<HTMLElement>('.identity-error');
  if (el) { el.textContent = msg; el.hidden = !msg; }
  if (msg) announce(msg, { assertive: true });
}
export function renderEnrollForm(pv: ProfileViewCtx, health: CaHealth | null) {
  const { PROVIDER_LABELS } = pv;
  // Show only the providers the deployment has actually configured (from
  // /api/ca/health.configured), so a button never 501s on click - and a newly
  // configured provider appears with no code change. 'dev' rides on devProvider.
  const cfg = health?.configured ?? {};
  const providers: string[] = [
    ...(cfg.github ? ['github'] : []),
    ...(cfg.google ? ['google'] : []),
    ...(cfg.suse ? ['suse'] : []),
    ...(health?.devProvider === true ? ['dev'] : []),
  ];
  // Nothing to enrol WITH on this deployment: the pitch, the permanence warning
  // and the certificate-lifetime picker would all be controls that lead nowhere,
  // teaching the jargon for a door that isn't there (plans/163 4.5). One status
  // line stands in for the lot. Verifying a file needs no enrolment, so that
  // link stays exactly where it was.
  if (!providers.length) {
    return `
      <p class="storage-hint-text">${t('No sign-in provider is configured on this deployment yet.')}</p>
      ${verifyLink()}
      <p class="identity-error" role="alert" hidden></p>`;
  }
  return `
      <p class="identity-blurb">${t('Sign exports with a verified identity - a short-lived certificate ties your email to files you export; the key never leaves this device.')} <a href="${docsAppHref('trust/content-credentials-identity')}" target="_blank" rel="noopener">${t('How it works')}</a></p>
      <p class="identity-blurb identity-permanence">${t('Know before you enrol: your email address is written into every file you export while enrolled. It stays in every copy you share and cannot be removed later, even after the certificate expires.')}</p>
      <label class="identity-days-row">${t('Verified for')}
        <select class="identity-days-select" aria-label="${escapeText(t('Certificate lifetime'))}">
          <option value="7">${t('7 days')}</option>
          <option value="30" selected>${t('30 days')}</option>
          <option value="90">${t('90 days')}</option>
          <option value="365">${t('365 days')}</option>
        </select>
        <span class="identity-days-hint">${t('- longer keeps exports verified longer; shorter limits misuse if this device is lost. The CA has the final say.')}</span>
      </label>
      <div class="identity-providers">
        ${providers.map(p => `<button type="button" class="btn" data-identity-provider="${p}">${escapeText(PROVIDER_LABELS[p] ?? p)}</button>`).join('')}
      </div>
      ${verifyLink()}
      <p class="identity-error" role="alert" hidden></p>`;
}
export function renderIdentityStatus(pv: ProfileViewCtx, s: IdentityStatus) {
  const { PROVIDER_LABELS } = pv;
  const provider = PROVIDER_LABELS[s.identity?.provider as string] ?? s.identity?.provider ?? '';
  const when = s.notAfter ? new Date(s.notAfter).toLocaleDateString() : '';
  const life = s.expired ? (when ? tRaw('expired {date}', { date: when }) : t('expired')) : (when ? tRaw('renews {date}', { date: when }) : '');
  return `
      <div class="identity-status${s.expired ? ' is-expired' : ''}">
        <p class="identity-signing">${t('Signing as <strong>{email}</strong>', { email: s.identity?.email ?? '' })}${provider ? ` <span class="identity-via">${t('via {provider}', { provider })}</span>` : ''}</p>
        ${life ? `<p class="identity-life">${escapeText(life)}</p>` : ''}
        <div class="identity-actions">
          <button type="button" class="btn" data-identity-act="renew">${t('Renew')}</button>
          <button type="button" class="btn" data-identity-act="forget">${t('Forget this device')}</button>
        </div>
        ${verifyLink()}
        <p class="identity-error" role="alert" hidden></p>
      </div>`;
}
export async function paintIdentity(pv: ProfileViewCtx) {
  const { host } = pv;
  const body = identityBody(pv);
  if (!body) return;
  if (!host.identity) { // bridge feature-detected, like host.previews
    body.innerHTML = `<p class="storage-hint-text">${t("Signing identity isn't available in this build.")}</p>`;
    return;
  }
  try { pv.identityStatus = await host.identity.status(); }
  catch (err) {
    body.innerHTML = `<p class="identity-error" role="alert">${escapeText(String((err as { message?: unknown })?.message ?? err))}</p>`;
    return;
  }
  body.innerHTML = pv.identityStatus?.enrolled
    ? renderIdentityStatus(pv, pv.identityStatus)
    : renderEnrollForm(pv, await caHealth(pv));
  pv.summaries.setSummary('identity-section', pv.identityStatus?.enrolled
    ? (pv.identityStatus.identity?.email ?? tRaw('Enrolled'))
    : tRaw('Not enrolled'));
  staggerReveal([...body.children], { sound: false });  // cascade async content (shuffle already played on open)
}
// One OAuth/dev enrollment round-trip (popup) from a button, with a busy state.
// enroll() resolves with the new status, and rejects on timeout/close/denial
// with a user-presentable Error message. `days` (the 7/30/90/365 lifetime
// pick) defaults to the form's select when not passed explicitly; the CA
// clamps it server-side either way.
export async function enrollWith(pv: ProfileViewCtx, provider: string, btn: HTMLElement, days?: number) {
  const { host } = pv;
  const body = identityBody(pv)!;
  if (!Number.isFinite(days)) days = Number(body.querySelector<HTMLInputElement>('.identity-days-select')?.value);
  showIdentityError(pv, '');
  const label = btn.textContent;
  body.querySelectorAll('button').forEach(b => { b.disabled = true; });
  btn.textContent = t('Waiting…');
  try {
    const s = await host.identity!.enroll(provider, { days });
    await paintIdentity(pv);
    announce(tRaw('Enrolled as {who}', { who: s?.identity?.email ?? t('your account') }));
  } catch (err) {
    body.querySelectorAll('button').forEach(b => { b.disabled = false; });
    btn.textContent = label;
    showIdentityError(pv, String((err as { message?: unknown })?.message ?? err));
  }
}
export const loadIdentity = (pv: ProfileViewCtx): Promise<void> => {
  const { host } = pv;
  // Memoised as a statement, not `pv.identityLoadP ??= …` inside the return: an
  // assignment in an expression position reads as side-effect-free when it is not.
  if (pv.identityLoadP) return pv.identityLoadP;
  pv.identityLoadP = (async () => {
  await paintIdentity(pv);
  const body = identityBody(pv);
  if (!body || !host.identity) return;

  body.addEventListener('click', async (e) => {
    const prov = (e.target as Element).closest<HTMLElement>('[data-identity-provider]');
    if (prov) { await enrollWith(pv, prov.dataset.identityProvider!, prov); return; }
    const act = (e.target as Element).closest<HTMLButtonElement>('[data-identity-act]');
    if (!act) return;
    if (act.dataset.identityAct === 'renew') {
      const provider = pv.identityStatus?.identity?.provider;
      // Renew keeps the lifetime that was chosen last time (derived from the
      // cert window - the status card has no picker; change it via Forget +
      // re-enrol if you want a different duration).
      const prevDays = Math.round((Date.parse(pv.identityStatus?.notAfter as string) - Date.parse(pv.identityStatus?.notBefore as string)) / 86400000);
      // A legacy email (magic-link) identity can no longer renew by email - re-show the
      // enroll form so it re-enrols via a provider instead.
      if (provider === 'email') body.innerHTML = renderEnrollForm(pv, await caHealth(pv));
      else if (provider) await enrollWith(pv, provider, act, [7, 30, 90, 365].includes(prevDays) ? prevDays : undefined);
      return;
    }
    if (act.dataset.identityAct === 'forget') {
      // Low-ceremony confirm: the first click arms the button, a second confirms
      // (it disarms itself after a moment, so a stray click can't linger armed).
      if (act.dataset.confirm !== '1') {
        act.dataset.confirm = '1';
        act.textContent = t('Really forget?');
        act.classList.add('is-confirm');
        setTimeout(() => {
          if (!document.contains(act)) return;
          delete act.dataset.confirm;
          act.textContent = t('Forget this device');
          act.classList.remove('is-confirm');
        }, 4000);
        return;
      }
      act.disabled = true;
      try { await host.identity!.forget(); }
      catch (err) { act.disabled = false; showIdentityError(pv, String((err as { message?: unknown })?.message ?? err)); return; }
      await paintIdentity(pv);
      announce(t('Forgotten - exports on this device sign anonymously again'));
    }
  });

})();
  return pv.identityLoadP;
};
/** Load the credentials card when it is first expanded. */
export function wireIdentityToggle(pv: ProfileViewCtx): void {
  const { identityDetails } = pv;
  identityDetails?.addEventListener('toggle', () => { if (identityDetails!.open) pv.identity.loadIdentity(); });
  if (identityDetails?.open) pv.identity.loadIdentity();
}

export function identityOps(pv: ProfileViewCtx) {
  return {
    identityBody: bindOp(pv, identityBody),
    caHealth: bindOp(pv, caHealth),
    showIdentityError: bindOp(pv, showIdentityError),
    renderEnrollForm: bindOp(pv, renderEnrollForm),
    renderIdentityStatus: bindOp(pv, renderIdentityStatus),
    paintIdentity: bindOp(pv, paintIdentity),
    enrollWith: bindOp(pv, enrollWith),
    loadIdentity: bindOp(pv, loadIdentity),
    wireIdentityToggle: bindOp(pv, wireIdentityToggle),
  };
}
