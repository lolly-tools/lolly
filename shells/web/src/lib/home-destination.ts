// SPDX-License-Identifier: MPL-2.0
/** The instance's front door, shared by boot and every Home control. */
let destination = '/#/';

export function validHomeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\s\\\u0000-\u001f\u007f]/.test(value)) return null;
  if (!(value.startsWith('/') && !value.startsWith('//')) && !value.startsWith('https://')) return null;
  try {
    const url = new URL(value, 'https://instance.invalid');
    return url.protocol === 'https:' && !url.username && !url.password ? value : null;
  } catch { return null; }
}

export function setHomeDestination(view?: 'tools' | 'projects', url?: string): void {
  destination = validHomeUrl(url) ?? (view === 'projects' ? '/#/p' : view === 'tools' ? '/#/tools' : '/#/');
}

export function homeHref(): string { return destination; }

/** Keep app routes in the router; other destinations use normal navigation. */
export function navigateHome(navigate: (href: string) => void): void {
  const url = new URL(destination, window.location.href);
  if (url.origin === window.location.origin && url.pathname === '/' && url.hash.startsWith('#/')) {
    navigate(url.pathname + url.search + url.hash);
  } else {
    window.location.assign(url.href);
  }
}
