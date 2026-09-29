// SPDX-License-Identifier: MPL-2.0
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { resolveModelsDir } from '../../packages/node-shell/src/ml/session.ts';
import type { CorpusIndex } from './corpus.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

export function safeFile(base: string, relative: string): string | null {
  try {
    const realBase = realpathSync(base);
    const file = realpathSync(path.resolve(base, relative));
    return file.startsWith(`${realBase}${path.sep}`) && statSync(file).isFile() ? file : null;
  } catch { return null; }
}

export async function serve(port: number, corpusPath?: string): Promise<void> {
  const common = { bundle: true, write: false, format: 'esm' as const, platform: 'browser' as const, target: 'es2022', nodePaths: [path.join(root, 'shells/web/node_modules')], logLevel: 'silent' as const };
  const [app, worker] = await Promise.all([
    build({ ...common, entryPoints: [path.join(here, 'app.ts')] }),
    build({ ...common, stdin: { contents: "import * as tf from '@huggingface/transformers'; import { startWorker } from './worker.ts'; startWorker(tf);", resolveDir: here, loader: 'ts' } }),
  ]);
  const models = resolveModelsDir();
  const webRequire = createRequire(path.join(root, 'shells/web/package.json'));
  const transformersRequire = createRequire(webRequire.resolve('@huggingface/transformers'));
  const ort = path.dirname(transformersRequire.resolve('onnxruntime-web'));
  const corpusRoot = corpusPath ? path.resolve(corpusPath) : undefined;
  const corpus = corpusRoot ? JSON.parse(readFileSync(path.join(corpusRoot, 'index.json'), 'utf8')) as CorpusIndex : undefined;
  const corpusIds = new Set(corpus?.cases.map(c => c.id));
  const server = createServer((req, res) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname); }
    catch { res.writeHead(400).end(); return; }
    const send = (type: string, body: string | Uint8Array): void => {
      res.setHeader('Content-Type', type);
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (pathname === '/') return send('text/html; charset=utf-8', readFileSync(path.join(here, 'index.html')));
    if (pathname === '/app.js') return send('text/javascript', app.outputFiles![0]!.contents);
    if (pathname === '/worker.js') return send('text/javascript', worker.outputFiles![0]!.contents);
    if (pathname === '/style.css') return send('text/css', readFileSync(path.join(here, 'style.css')));
    if (pathname === '/corpus') return send('application/json', JSON.stringify(corpus ?? null));
    if (pathname === '/config') return send('application/json', JSON.stringify({
      embed: existsSync(path.join(models, 'embed/onnx/model_quantized.onnx')),
      smol: existsSync(path.join(models, 'reword/smollm2-360m-instruct/onnx/model_q4.onnx')),
    }));
    let file: string | null = null;
    const entry = /^\/corpus\/(cases|previews|pictures)\/([a-f0-9]{16}-p[1-9][0-9]*)\.(json|png|jpg|webp)$/.exec(pathname);
    if (corpusRoot && entry && corpusIds.has(entry[2]!) && ((entry[1] === 'cases' && entry[3] === 'json') || (entry[1] === 'previews' && entry[3] === 'png') || (entry[1] === 'pictures' && ['png', 'jpg', 'webp'].includes(entry[3]!)))) file = safeFile(corpusRoot, `${entry[1]}/${entry[2]}.${entry[3]}`);
    if (pathname.startsWith('/models/embed/') || pathname.startsWith('/models/reword/smollm2-360m-instruct/')) file = safeFile(models, pathname.slice('/models/'.length));
    if (pathname.startsWith('/ort/')) file = safeFile(ort, pathname.slice('/ort/'.length));
    if (!file) { res.writeHead(404).end('Not found'); return; }
    const types: Record<string, string> = { '.wasm': 'application/wasm', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.onnx': 'application/octet-stream' };
    res.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
    res.setHeader('Content-Length', statSync(file).size);
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  });
  server.listen(port, '127.0.0.1', () => console.log(`Layout lab: http://127.0.0.1:${port}\nModels: ${models}\nInference runs in a browser worker. No external requests or automatic downloads.`));
}
