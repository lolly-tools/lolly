// SPDX-License-Identifier: MPL-2.0
import { connectorRequestOrigin, FIXED_CONNECT_ORIGINS, headerApprovesConnector, NATIVE_PROVIDER_ORIGINS, parseConnectorOrigins } from '../../../../packages/core/src/connector-origins.ts';

export class ConnectorOriginError extends Error {
  constructor() {
    super('Connector origin is not configured. Ask your operator to approve this host, then save your work before reopening.');
    this.name = 'ConnectorOriginError';
  }
}

export const nativeConnectorOrigins = (): string[] => [...NATIVE_PROVIDER_ORIGINS,
  ...parseConnectorOrigins((import.meta as unknown as { env?: { VITE_CONNECTOR_ORIGINS?: string } }).env?.VITE_CONNECTOR_ORIGINS ?? '')];

/** Read same-origin deployment headers before sending any connector credentials. */
export function createConnectorGuard(readPolicy: () => Promise<string>, native = false, configured: readonly string[] = []): (url: string) => Promise<void> {
  const fixed: readonly string[] = native ? NATIVE_PROVIDER_ORIGINS : FIXED_CONNECT_ORIGINS;
  const approved = parseConnectorOrigins(configured.filter(origin => !fixed.includes(origin)).join(' '));
  return async url => {
    const origin = connectorRequestOrigin(url);
    if (fixed.includes(origin) || (native && approved.includes(origin))) return;
    if (!native && headerApprovesConnector(await readPolicy().catch(() => ''), origin)) return;
    throw new ConnectorOriginError();
  };
}

let cached: { until: number; value: Promise<string> } | undefined;
async function deploymentPolicy(): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.value;
  const value = (async () => {
    if (typeof location === 'undefined') return '';
    const response = await fetch(new URL('index.html', new URL((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/', location.href)), {
      method: 'HEAD', credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    return response.ok ? response.headers.get('Content-Security-Policy') ?? '' : '';
  })().catch(() => '');
  cached = { until: Date.now() + 30000, value };
  return value;
}

export const approveWebConnector = createConnectorGuard(deploymentPolicy);
