// SPDX-License-Identifier: MPL-2.0
/** The instance's front door, shared by boot and every Home control. */
let destination = '/#/';

export function validHomeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\]/.test(value) || [...value].some(c => c < ' ' || c === '\u007f')) return null;
  if (value.startsWith('/')) return value.startsWith('//') ? null : value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function setHomeDestination(view?: 'tools' | 'projects', url?: string): void {
  destination = validHomeUrl(url) ?? `/#/${view === 'projects' ? 'p' : view ?? ''}`;
}

export function homeHref(): string { return destination; }

/** Keep app routes in the router; other destinations use normal navigation. */
export function navigateHome(navigate: (href: string) => void): void {
  if (destination.startsWith('/#/')) navigate(destination);
  else window.location.assign(destination);
}
