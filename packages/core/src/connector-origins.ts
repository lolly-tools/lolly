// SPDX-License-Identifier: MPL-2.0
/** Public connection policy shared by deployment configuration and clients. */
export const FIXED_CONNECT_ORIGINS = [
  'https://lolly.ing', 'https://lolli.li', 'https://www.googleapis.com',
  'https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'https://api.somafm.com',
  'https://registry.color.org', 'https://www.color.org', 'https://geocoding-api.open-meteo.com',
  'https://api.dropboxapi.com', 'https://content.dropboxapi.com',
  'https://login.microsoftonline.com', 'https://graph.microsoft.com', 'https://api.onedrive.com',
] as const;

export const NATIVE_PROVIDER_ORIGINS = [...FIXED_CONNECT_ORIGINS, 'https://oauth2.googleapis.com',
  'https://www.linkedin.com', 'https://api.linkedin.com'] as const;

/** Accept DNS origins only; URL parsing must not erase paths or credentials. */
export function parseConnectorOrigins(raw = ''): string[] {
  if (typeof raw !== 'string' || raw.length > 8192 || /[^\x20-\x7e]/.test(raw)) {
    throw new Error('Connector origins must be a bounded space-separated list of HTTPS origins');
  }
  const origins = raw.trim() ? raw.trim().split(/ +/) : [];
  if (origins.length > 64) throw new Error('Configure at most 64 connector origins');
  const normalized = origins.map(value => {
    if (!/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]{1,5})?\/?$/i.test(value)) {
      throw new Error('Connector origins must use HTTPS without paths, wildcards or credentials');
    }
    const url = new URL(value);
    if ((url.port && Number(url.port) < 1) || url.hostname.length > 253 || url.hostname.endsWith('.') || !url.hostname.includes('.') ||
      url.hostname.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) ||
      /^[0-9.]+$/.test(url.hostname)) throw new Error('Connector origins must name an exact DNS host');
    return url.origin;
  });
  return [...new Set(normalized)].sort();
}

export function connectorRequestOrigin(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('Connector requests require HTTPS without URL credentials or fragments');
  }
  return url.origin;
}

export function connectSources(origins: readonly string[] = [], native = false): string {
  const checked = parseConnectorOrigins(origins.join(' '));
  return ["'self'", ...(native ? ['ipc:', 'http://ipc.localhost'] : []), 'blob:', 'data:',
    ...(native ? NATIVE_PROVIDER_ORIGINS : FIXED_CONNECT_ORIGINS), 'wss://lolly.ing', ...checked].join(' ');
}

/** Replace only the connection directive, leaving every other directive intact. */
export function configureConnectPolicy(policy: string, origins: readonly string[], native = false): string {
  if (!/(?:^|;)\s*connect-src\s+[^;]+/.test(policy)) throw new Error('The connection policy is missing connect-src');
  return policy.replace(/(^|;)\s*connect-src\s+[^;]+/, (_match, prefix: string) =>
    `${prefix}${prefix ? ' ' : ''}connect-src ${connectSources(origins, native)}`);
}

/** Every enforced header policy must contain the exact destination origin. */
export function headerApprovesConnector(header: string, origin: string): boolean {
  if (!header || header.length > 32768) return false;
  return header.split(',').every(policy => {
    const directive = policy.split(';').map(value => value.trim().split(/\s+/))
      .find(([name]) => name?.toLowerCase() === 'connect-src');
    return !!directive?.slice(1).some(source => {
      try { return parseConnectorOrigins(source)[0] === origin; } catch { return false; }
    });
  });
}
