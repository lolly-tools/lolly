// SPDX-License-Identifier: MPL-2.0

export interface LiveInvitation { base: string; token: string }

/** The shell and discovery record admit the same configured relay address. */
export function readLiveRelay(value: unknown, origin?: string): string | null {
  if (typeof value !== 'string' || !value || value.length > 2048) return null;
  try {
    const url = new URL(value, origin);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    if (url.username || url.password || url.search || url.hash || !url.pathname.replace(/\/$/, '').endsWith('/live')) return null;
    return url.href.replace(/\/$/, '');
  } catch { return null; }
}

/** The secret stays in the fragment when instructions include this invitation. */
export function readLiveInvitation(value: unknown): LiveInvitation | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    if (url.username || url.password || url.search || !url.pathname.endsWith('/live/invite')) return null;
    const token = new URLSearchParams(url.hash.slice(1)).get('token');
    if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) return null;
    return { base: `${url.origin}${url.pathname.slice(0, -7)}`, token };
  } catch { return null; }
}

export function liveInvitationUrl(base: string, token: string): string {
  const value = `${base.replace(/\/$/, '')}/invite#token=${token}`;
  if (!readLiveInvitation(value)) throw new Error('Invalid agent invitation.');
  return value;
}
