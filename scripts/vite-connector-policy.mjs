// SPDX-License-Identifier: MPL-2.0
import { readFileSync } from 'node:fs';
import { configureConnectPolicy, parseConnectorOrigins } from '../packages/core/src/connector-origins.ts';

/** Development uses the same connection policy, plus this server's exact HMR origin. */
export function connectorDevPolicy(policy) {
  const base = policy ?? JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
    .headers.flatMap(block => block.headers).find(header => header.key === 'Content-Security-Policy').value;
  const configured = configureConnectPolicy(base, parseConnectorOrigins(process.env.VITE_CONNECTOR_ORIGINS ?? ''), !!policy);
  return {
    name: 'connector-development-policy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const host = request.headers.host ?? '';
        if (!/^(?:localhost|[a-z0-9.-]+|\[[a-f0-9:]+\])(?::[0-9]{1,5})?$/i.test(host)) {
          response.statusCode = 400;
          response.end('Invalid development host');
          return;
        }
        const websocket = `${server.config.server.https ? 'wss' : 'ws'}://${host}`;
        response.setHeader('Content-Security-Policy', configured.replace(/connect-src ([^;]+)/, `connect-src $1 ${websocket}`));
        response.setHeader('X-Content-Type-Options', 'nosniff');
        next();
      });
    },
  };
}
