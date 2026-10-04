// SPDX-License-Identifier: MPL-2.0
/** Tool preview pages redirect into the app, which otherwise loses the navigation type. */
export const TOOL_RELOAD_KEY = 'lolly:tool-reload';
export function toolAddressKey(address: string): string {
  const raw = String(address ?? '').replace(/^#/, ''), q = raw.indexOf('?');
  let path = q < 0 ? raw : raw.slice(0, q);
  try { path = decodeURIComponent(path); } catch { /* Preserve an invalid address as written. */ }
  path = path.replace(/^\/any-site(?=\/)/, '').replace(/^\/t\//, '/tool/');
  if (path === '/design') path = '/tool/design';
  const params = new URLSearchParams(q < 0 ? '' : raw.slice(q + 1));
  for (const key of [...params.keys()]) if (key.startsWith('_')) params.delete(key);
  params.sort(); return `${path}?${params.toString()}`;
}
/** A short-lived, one-use hint about this same tool address, never an access credential. */
export function consumeToolReload(toolId: string, address: string): 'reload' | 'back_forward' | null {
  try {
    const raw = sessionStorage.getItem(TOOL_RELOAD_KEY); sessionStorage.removeItem(TOOL_RELOAD_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !('toolId' in value) || value.toolId !== toolId
      || !('address' in value) || typeof value.address !== 'string' || toolAddressKey(value.address) !== toolAddressKey(address)
      || !('at' in value) || typeof value.at !== 'number' || Date.now() - value.at < 0 || Date.now() - value.at > 30_000
      || !('type' in value) || value.type !== 'reload' && value.type !== 'back_forward') return null;
    return value.type;
  } catch { return null; }
}
