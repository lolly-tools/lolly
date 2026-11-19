// SPDX-License-Identifier: MPL-2.0
/**
 * The local web server behind `lolly app`: a built web app, served to this machine only.
 *
 * Browser storage is kept per origin, so the address is fixed (127.0.0.1 and one port)
 * and a taken port is reported, never swapped for another. Routes and security headers
 * come from web-app-routes.ts (the hosted deployment's own rules) and cache headers from
 * the shared delivery rules in @lolly-tools/core, so this server holds no policy text.
 *
 * Node built-ins only.
 */
import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createReadStream, readFileSync, statSync, type Stats } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { cachePolicy, publicStaticDeliveryClass } from '@lolly-tools/core/delivery-v1';
import { hostedHeaders, resolveRoute } from './web-app-routes.ts';

/** The default port. Fixed, because a new port is a new origin with empty storage. */
export const APP_DEFAULT_PORT = 47474;
/** The marker a running launcher answers with, so a second launch can recognise one. */
export const APP_PING_MARKER = 'lolly-browser-app';
export const APP_PING_PATH = '/__lolly/ping';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.xml': 'application/xml', '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.jxl': 'image/jxl', '.wasm': 'application/wasm', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.pdf': 'application/pdf', '.zip': 'application/zip',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.flac': 'audio/flac', '.mp4': 'video/mp4', '.webm': 'video/webm', '.glb': 'model/gltf-binary',
  '.onnx': 'application/octet-stream', '.bin': 'application/octet-stream',
};

export const contentTypeFor = (path: string): string => MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';

/** Does the Host header belong to this server? Anything else is a rebinding attempt. */
export function isOwnHost(host: string | undefined, port: number): boolean {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

/**
 * The request target as a clean absolute path, or the status that refuses the request.
 * A dot segment is answered as missing, the way the hosted server answers one.
 */
export function cleanRequestPath(target: string | undefined): { path: string } | { refuse: 400 | 404 } {
  if (!target?.startsWith('/')) return { refuse: 400 };
  let path: string;
  try { path = decodeURIComponent(target.split('?')[0]!); } catch { return { refuse: 400 }; }
  if (path.includes('\0') || path.includes('\\') || path.includes('//')) return { refuse: 400 };
  if (path.split('/').some(segment => segment.startsWith('.'))) return { refuse: 404 };
  return { path };
}

/** Cache-Control for a request path and final status, from the shared delivery rules. */
export function cacheControlFor(path: string, status: number): string {
  // The service worker keeps the one spelling the hosted server gives that file.
  if (path === '/sw.js' && status < 400) return 'no-cache, s-maxage=0, no-transform';
  return cachePolicy(publicStaticDeliveryClass(path), { status }).cacheControl;
}

/** The encodings a client accepts, from its Accept-Encoding header. */
function acceptedEncodings(header: string | undefined): Set<string> {
  const out = new Set<string>();
  for (const part of (header ?? '').split(',')) {
    const [name, ...params] = part.trim().toLowerCase().split(';');
    if (name && !params.some(param => /^\s*q=0(\.0*)?\s*$/.test(param))) out.add(name);
  }
  return out;
}

const PRECOMPRESSED = [['br', '.br'], ['gzip', '.gz']] as const;

function statFile(path: string): Stats | null {
  try { const stats = statSync(path); return stats.isFile() ? stats : null; } catch { return null; }
}

/** One `bytes=a-b` range against a known size. null means "send the whole file". */
function byteRange(header: string | undefined, size: number): { start: number; end: number } | 'unsatisfiable' | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start > end || start >= size ? 'unsatisfiable' : { start, end };
}

export interface AppServerOptions {
  /** The built web app directory. It must hold index.html. */
  dir: string;
  port?: number;
}

export interface AppServer {
  server: Server;
  port: number;
  /** The origin the app is opened at. */
  origin: string;
  /** The served build's version, from the build's precache.json when present. */
  version: string | null;
  close: () => Promise<void>;
}

/** The version the web build wrote into precache.json, or null. */
export function builtVersion(dir: string): string | null {
  try {
    const version = (JSON.parse(readFileSync(join(dir, 'precache.json'), 'utf8')) as { version?: unknown }).version;
    return typeof version === 'string' ? version : null;
  } catch { return null; }
}

/** The request handler, apart from the listening socket so tests can drive both. */
export function appRequestHandler(opts: Required<AppServerOptions> & { version: string | null }): (req: IncomingMessage, res: ServerResponse) => void {
  const root = resolve(opts.dir);
  const onDisk = (path: string): string | null => {
    const full = resolve(root, `.${path}`);
    return full.startsWith(root + sep) ? full : null;
  };
  const isFile = (path: string): boolean => { const full = onDisk(path); return full !== null && statFile(full) !== null; };

  const plain = (res: ServerResponse, path: string, status: number, body: string, extra: Record<string, string> = {}): void => {
    res.writeHead(status, {
      ...hostedHeaders(path), 'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': cacheControlFor(path, status), ...extra,
    });
    res.end(res.req.method === 'HEAD' ? undefined : body);
  };

  return (req, res) => {
    if (!isOwnHost(req.headers.host, opts.port)) { plain(res, '/', 403, 'This server answers only on its own local address.\n'); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { plain(res, '/', 405, 'Only GET and HEAD are served.\n', { Allow: 'GET, HEAD' }); return; }
    const cleaned = cleanRequestPath(req.url);
    if ('refuse' in cleaned) { plain(res, '/', cleaned.refuse, cleaned.refuse === 400 ? 'Bad request.\n' : 'Not found.\n'); return; }
    const { path } = cleaned;

    if (path === APP_PING_PATH) {
      res.writeHead(200, { ...hostedHeaders(path), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ app: APP_PING_MARKER, version: opts.version }));
      return;
    }

    const answer = resolveRoute(path, isFile);
    if (answer.kind === 'redirect') {
      const query = req.url!.includes('?') ? req.url!.slice(req.url!.indexOf('?')) : '';
      plain(res, path, 308, '', { Location: encodeURI(answer.location) + query });
      return;
    }
    const file = answer.kind === 'file' ? onDisk(answer.path) : null;
    const stats = file ? statFile(file) : null;
    if (!file || !stats) { plain(res, path, 404, 'Not found.\n'); return; }

    // A precompressed sibling is sent whole, so a range request reads the plain file.
    const accepted = req.headers.range ? new Set<string>() : acceptedEncodings(req.headers['accept-encoding'] as string | undefined);
    const packed = PRECOMPRESSED.map(([encoding, suffix]) => ({ encoding, stats: accepted.has(encoding) ? statFile(file + suffix) : null, path: file + suffix }))
      .find(candidate => candidate.stats !== null);
    const body = packed ? { path: packed.path, stats: packed.stats!, encoding: packed.encoding as string | null } : { path: file, stats, encoding: null };
    const etag = `W/"${body.stats.size.toString(36)}-${Math.round(body.stats.mtimeMs).toString(36)}${body.encoding ? `-${body.encoding}` : ''}"`;
    const headers: Record<string, string> = {
      'Content-Type': contentTypeFor(file),
      ...hostedHeaders(path),
      'Cache-Control': cacheControlFor(path, 200),
      ETag: etag, 'Accept-Ranges': 'bytes', Vary: 'Accept-Encoding',
      ...(body.encoding ? { 'Content-Encoding': body.encoding } : {}),
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers).end(); return; }

    const range = byteRange(req.headers.range, body.stats.size);
    if (range === 'unsatisfiable') { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${body.stats.size}` }).end(); return; }
    const span = range ?? { start: 0, end: body.stats.size - 1 };
    if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${body.stats.size}`;
    headers['Content-Length'] = String(body.stats.size === 0 ? 0 : span.end - span.start + 1);
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === 'HEAD' || body.stats.size === 0) { res.end(); return; }
    createReadStream(body.path, span).on('error', () => res.destroy()).pipe(res);
  };
}

/** Thrown when the port is taken; `code` is the listen error's own (EADDRINUSE). */
export class AppServerError extends Error {
  readonly code: string | undefined;
  constructor(message: string, code?: string) { super(message); this.name = 'AppServerError'; this.code = code; }
}

/** Serve `dir` on 127.0.0.1. Rejects when the directory has no index.html or the port is taken. */
export function startAppServer(options: AppServerOptions): Promise<AppServer> {
  const dir = resolve(options.dir);
  const port = options.port ?? APP_DEFAULT_PORT;
  if (!statFile(join(dir, 'index.html'))) {
    return Promise.reject(new AppServerError(`No built web app at ${dir}: that directory has no index.html.`, 'ENOENT'));
  }
  const version = builtVersion(dir);
  const server = createServer();
  return new Promise<AppServer>((ok, fail) => {
    server.once('error', (err: NodeJS.ErrnoException) => fail(new AppServerError(err.message, err.code)));
    server.listen(port, '127.0.0.1', () => {
      // The handler checks the Host header against the port that was bound, which a
      // caller asking for port 0 only learns here.
      const bound = (server.address() as { port: number }).port;
      server.on('request', appRequestHandler({ dir, port: bound, version }));
      ok({
        server, port: bound, origin: `http://127.0.0.1:${bound}`, version,
        close: () => new Promise<void>(done => { server.close(() => done()); server.closeAllConnections(); }),
      });
    });
  });
}

export type PortHolder = { kind: 'lolly'; version: string | null } | { kind: 'foreign' };

/** Ask whatever holds the port whether it is a running Lolly launcher. */
export function probePort(port: number, timeoutMs = 1500): Promise<PortHolder> {
  return new Promise<PortHolder>((done) => {
    const foreign = (): void => done({ kind: 'foreign' });
    const req = httpRequest({ host: '127.0.0.1', port, path: APP_PING_PATH, method: 'GET', timeout: timeoutMs }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => { if (text.length < 4096) text += chunk; });
      res.on('error', foreign);
      res.on('end', () => {
        try {
          const body = JSON.parse(text) as { app?: unknown; version?: unknown };
          if (res.statusCode === 200 && body.app === APP_PING_MARKER) {
            done({ kind: 'lolly', version: typeof body.version === 'string' ? body.version : null });
          } else foreign();
        } catch { foreign(); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', foreign);
    req.end();
  });
}
