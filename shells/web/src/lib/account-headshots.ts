// SPDX-License-Identifier: MPL-2.0
/** Workspace portraits use project images, never arbitrary URLs from another person. */
import { decodeCanvasAsset, encodeCanvasAsset } from '@lolly-tools/core/canvas-asset-v1';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { CollabSession, CollabSessionHandle } from './collab-session.ts';
import { getInstanceBase } from './instance.ts';
import { collabInitials } from './collab-identity.ts';
import { collabLabelColor } from './collab-label-color.ts';

const portraits = new Map<string, string>();
const colors = new Map<string, string>();
let scope = '';
export function setAccountHeadshot(userId: string, url: string | undefined, doc: Document): void {
  if (url) {
    try {
      const parsed = new URL(url, doc.location.href);
      if (!(parsed.origin === doc.location.origin && ['https:', 'http:', 'blob:'].includes(parsed.protocol))
        && !/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(url)) return;
    } catch { return; }
    portraits.set(userId, url); if (portraits.size > 200) portraits.delete(portraits.keys().next().value!);
  } else portraits.delete(userId);
  for (const avatar of doc.querySelectorAll<HTMLElement>('[data-account-avatar]')) if (avatar.dataset.accountAvatar === userId) paintAccountAvatar(avatar, userId);
}

export function paintAccountAvatar(avatar: HTMLElement, userId: string): void {
  avatar.dataset.accountAvatar = userId;
  avatar.style.position = 'relative';
  const url = portraits.get(userId), old = avatar.querySelector<HTMLImageElement>('img[data-headshot]');
  if (old?.getAttribute('src') === url) return;
  old?.remove();
  for (const child of avatar.children) (child as HTMLElement).hidden = false;
  if (!url) return;
  const image = avatar.ownerDocument.createElement('img'); image.dataset.headshot = ''; image.alt = ''; image.referrerPolicy = 'no-referrer';
  image.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit';
  image.addEventListener('load', () => { for (const child of avatar.children) if (child !== image) (child as HTMLElement).hidden = true; });
  image.addEventListener('error', () => { image.remove(); for (const child of avatar.children) (child as HTMLElement).hidden = false; });
  image.src = url; avatar.append(image);
}

export function accountAvatar(doc: Document, userId: string, name: string): HTMLElement {
  const avatar = doc.createElement('span'), letters = doc.createElement('span');
  avatar.className = 'account-avatar'; avatar.setAttribute('aria-hidden', 'true');
  const label = collabLabelColor(colors.get(userId) ?? '#7474a0');
  avatar.style.cssText = `display:inline-grid;place-items:center;flex:none;align-self:start;width:calc(36px * var(--a11y-fs));height:calc(36px * var(--a11y-fs));border-radius:var(--radius-round);font-size:var(--fs-sm);font-weight:650;background:${label.fill};color:${label.ink}`;
  letters.textContent = collabInitials(name); avatar.append(letters); paintAccountAvatar(avatar, userId);
  return avatar;
}

export function mountWorkHeadshots(session: CollabSession, handle: CollabSessionHandle, host: HostV1 | null | undefined, doc: Document): () => void {
  if (handle.admission !== 'work-room' || !handle.assets || !host) return () => {};
  const account = handle.self.userId, nextScope = `${getInstanceBase()}\n${account ?? ''}`;
  if (scope !== nextScope) {
    portraits.clear(); colors.clear(); scope = nextScope;
    for (const avatar of doc.querySelectorAll<HTMLElement>('[data-account-avatar]')) paintAccountAvatar(avatar, avatar.dataset.accountAvatar!);
  }
  let disposed = false, generation = 0;
  const known = new Map<string, string>();
  const active = () => !disposed && scope === nextScope && handle.self.userId === account;
  async function publish(): Promise<void> {
    const ticket = ++generation;
    try {
      const profile = await host!.profile.get();
      if (!active() || ticket !== generation || !account) return;
      if (!profile.headshot) { session.updateSurface({ headshot: undefined }); setAccountHeadshot(account, undefined, doc); return; }
      const image = await host!.assets.get(profile.headshot.id, profile.headshot.pin);
      if (!active() || ticket !== generation) return;
      setAccountHeadshot(account, image.url, doc);
      if (session.state().role === 'observer') return;
      const shared = await handle.assets!.prepare(profile.headshot), encoded = encodeCanvasAsset(shared);
      if (active() && ticket === generation && encoded && encoded.length <= 512 && ['raster', 'vector'].includes(shared.type)) session.updateSurface({ headshot: encoded });
    } catch { /* An unavailable portrait leaves the person's initials. */ }
  }
  const offProfile = host.profile.subscribe?.(() => { void publish(); }) ?? (() => {});
  const offSession = session.subscribe(state => {
    for (const person of [state.self, ...state.peers]) {
      if (/^#[0-9a-f]{6}$/i.test(person.color)) colors.set(person.userId, person.color);
      if (known.get(person.userId) === (person.headshot ?? '')) continue;
      known.set(person.userId, person.headshot ?? '');
      const ref = decodeCanvasAsset(person.headshot);
      if (!ref) { if (!person.isSelf) setAccountHeadshot(person.userId, undefined, doc); continue; }
      void handle.assets!.resolve(ref).then(image => {
        if (active() && known.get(person.userId) === person.headshot) setAccountHeadshot(person.userId, image.url, doc);
      }).catch(() => { /* Initials remain when a project image cannot be read. */ });
    }
  });
  void publish();
  return () => { disposed = true; generation++; offProfile(); offSession(); };
}
