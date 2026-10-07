// SPDX-License-Identifier: MPL-2.0
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { WebSocketServer } from 'ws';
import { LIVE_LIMITS, LIVE_PROTOCOL, parseLiveRequest, type LiveMethodV1 } from '@lolly-tools/core';
import { LiveRelayBroker, type InvitationGrant } from './live-relay-broker.ts';
import { extraOrigins, liveOriginAllowed } from './live-bridge.ts';
import type { LiveToolBridge } from './live.ts';
import { clientIp, readBody } from './gateway.ts';
import { dispatch } from './server.ts';
import { validRequest, validateHttpHeaders } from './negotiation.ts';

const json = (res: ServerResponse, status: number, value: unknown): void => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value));
};

/** A long-lived service only. Serverless gateways do not advertise this relay. */
export function createLiveRelay(env: NodeJS.ProcessEnv = process.env) {
  const broker = new LiveRelayBroker();
  const wss = new WebSocketServer({ noServer: true, maxPayload: LIVE_LIMITS.maxReplyBytes, perMessageDeflate: false });
  const origins = extraOrigins(env);
  const attempts = new Map<string, number[]>();
  const originOK = (origin: string | undefined): boolean => liveOriginAllowed(origin, origins);
  const grantFrom = (req: IncomingMessage): InvitationGrant | undefined => {
    const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
    return token ? broker.get(token) : undefined;
  };
  const port = (grant: InvitationGrant, client: string): LiveToolBridge => ({
    async connect() {
      const reply = await broker.request(grant, { jsonrpc: '2.0', id: 0, method: 'hello', params: { protocol: LIVE_PROTOCOL, client } });
      if (reply.error) throw new Error(reply.error.message);
      return broker.status(grant);
    },
    async waitConnected() { return broker.status(grant); },
    async request(method, params) {
      const parsed = parseLiveRequest(JSON.stringify({ jsonrpc: '2.0', id: 0, method, params }));
      if (!parsed.ok) throw new Error(parsed.reply.error!.message);
      const reply = await broker.request(grant, { ...parsed.request, method: method as LiveMethodV1 });
      if (reply.error) throw new Error(reply.error.message);
      return reply.result;
    },
    close() { broker.revoke(grant); },
  });
  async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const path = (req.url ?? '').split('?')[0] ?? '';
    if (!['/live/invitations', '/live/rpc', '/live/mcp'].includes(path)) return false;
    const origin = req.headers.origin;
    if (origin !== undefined && (typeof origin !== 'string' || !originOK(origin))) { json(res, 403, { error: 'This site may not connect to the relay.' }); return true; }
    if (origin) { res.setHeader('access-control-allow-origin', origin); res.setHeader('vary', 'Origin'); }
    res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type, authorization, mcp-protocol-version, mcp-method, mcp-name');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return true; }
    if (req.method !== 'POST') { json(res, 405, { error: 'Use POST.' }); return true; }
    if (!req.headers['content-type']?.startsWith('application/json')) { json(res, 415, { error: 'Use application/json.' }); return true; }
    try {
      if (path === '/live/invitations') {
        if (!origin || !originOK(origin)) { json(res, 403, { error: 'Invitations must start in the editor.' }); return true; }
        const ip = clientIp(req, env), now = Date.now();
        for (const [key, times] of attempts) if (times.every(time => time < now - 60_000)) attempts.delete(key);
        const times = (attempts.get(ip) ?? []).filter(time => time > now - 60_000);
        if (times.length >= 10 || (!attempts.has(ip) && attempts.size >= 10_000)) { json(res, 429, { error: 'Too many invitations. Try again in a minute.' }); return true; }
        times.push(now); attempts.set(ip, times);
        const value = JSON.parse(await readBody(req, 8192));
        if (!value || typeof value.documentId !== 'string' || !/^doc:[a-zA-Z0-9-]{1,128}$/.test(value.documentId) || !['edit', 'read'].includes(value.permission)) { json(res, 400, { error: 'An invitation needs a documentId and edit or read permission.' }); return true; }
        const grant = broker.mint(value.documentId, origin, value.permission);
        json(res, 201, { token: grant.token, editorToken: grant.editorToken, expiresAt: grant.expiresAt }); return true;
      }
      const grant = grantFrom(req);
      if (!grant) { json(res, 401, { error: 'This invitation has expired or ended.' }); return true; }
      const raw = await readBody(req, LIVE_LIMITS.maxRequestBytes);
      if (path === '/live/rpc') {
        const parsed = parseLiveRequest(raw);
        json(res, 200, parsed.ok ? await broker.request(grant, parsed.request) : parsed.reply); return true;
      }
      const request: unknown = JSON.parse(raw);
      if (!validRequest(request)) { json(res, 400, { error: 'Invalid JSON-RPC request.' }); return true; }
      const negotiation = validateHttpHeaders(request, req.headers);
      if (negotiation) { json(res, 400, negotiation); return true; }
      const args = (request.params as { arguments?: { client?: unknown } } | undefined)?.arguments;
      const client = typeof args?.client === 'string' ? args.client : grant.client || 'AI agent';
      const reply = await dispatch(request, { live: port(grant, client), liveOnly: true, protocolVersion: typeof req.headers['mcp-protocol-version'] === 'string' ? req.headers['mcp-protocol-version'] : undefined });
      if (reply === null) { res.writeHead(202); res.end(); } else json(res, 200, reply);
      return true;
    } catch {
      json(res, 400, { error: 'The relay could not read this request.' }); return true;
    }
  }
  function mount(server: Server, allowUpgrade = (): boolean => true): () => void {
    const upgrade = (req: IncomingMessage, socket: import('node:stream').Duplex, head: Buffer): void => {
      if ((req.url ?? '').split('?')[0] !== '/live/editor') return;
      if (!allowUpgrade()) { socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
      const origin = req.headers.origin;
      if (!originOK(origin)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
      wss.handleUpgrade(req, socket, head, ws => {
        const timer = setTimeout(() => ws.close(1008, 'Attach first'), 5000);
        ws.once('message', bytes => {
          clearTimeout(timer);
          let token: unknown;
          try { const data = Array.isArray(bytes) ? Buffer.concat(bytes) : Buffer.from(bytes as ArrayBuffer); if (data.length > 4096) throw new Error('Too large'); token = JSON.parse(data.toString()).editorToken; } catch { ws.close(1008, 'Invalid attachment'); return; }
          const grant = typeof token === 'string' ? broker.attach(token, origin!, ws) : undefined;
          if (!grant) { ws.close(1008, 'Invitation ended'); return; }
          ws.send(JSON.stringify({ type: 'attached', documentId: grant.documentId }));
        });
        ws.once('close', () => clearTimeout(timer));
        ws.once('error', () => clearTimeout(timer));
      });
    };
    server.on('upgrade', upgrade);
    return () => { server.off('upgrade', upgrade); broker.dispose(); for (const ws of wss.clients) ws.terminate(); wss.close(); };
  }
  return { handle, mount };
}
